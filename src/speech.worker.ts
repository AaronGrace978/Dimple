/// <reference lib="webworker" />

const SAMPLE_RATE = 16000;
const WHISPER_ID = "Xenova/whisper-tiny.en";
const KOKORO_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

type Asr = (
  audio: Float32Array,
  options: { sampling_rate: number; chunk_length_s?: number; stride_length_s?: number },
) => Promise<{ text?: string }>;

type Kokoro = {
  generate: (
    text: string,
    opts: { voice: string; speed?: number },
  ) => Promise<{ audio: Float32Array; sampling_rate: number }>;
};

type InMsg =
  | { id: number; type: "init-whisper" }
  | { id: number; type: "init-kokoro" }
  | { id: number; type: "transcribe"; pcm: Float32Array; sampleRate: number }
  | { id: number; type: "speak"; text: string; voice: string; speed?: number };

let asr: Asr | null = null;
let tts: Kokoro | null = null;
let hearQ: Promise<void> = Promise.resolve();
let voiceQ: Promise<void> = Promise.resolve();

function post(data: object, transfer: Transferable[] = []): void {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(data, transfer);
}

function status(message: string): void {
  post({ type: "status", message });
}

function ok(id: number): void {
  post({ id, type: "ok" });
}

function fail(id: number, err: unknown): void {
  post({
    id,
    type: "error",
    message: err instanceof Error ? err.message : String(err),
  });
}

async function pickDevice(): Promise<"webgpu" | "wasm"> {
  try {
    const gpu = (self as unknown as { navigator?: { gpu?: { requestAdapter: () => Promise<unknown> } } })
      .navigator?.gpu;
    if (gpu && (await gpu.requestAdapter())) return "webgpu";
  } catch {
    /* wasm */
  }
  return "wasm";
}

function resampleTo16k(samples: Float32Array, fromRate: number): Float32Array {
  if (fromRate === SAMPLE_RATE) return samples;
  const ratio = fromRate / SAMPLE_RATE;
  const n = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const src = i * ratio;
    const idx = Math.floor(src);
    const frac = src - idx;
    const a = samples[idx] ?? 0;
    const b = samples[idx + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

function hasSpeechEnergy(pcm: Float32Array): boolean {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i]! * pcm[i]!;
  return Math.sqrt(sum / Math.max(1, pcm.length)) > 0.0015;
}

function normalize(text: string): string {
  return text
    .replace(/\[BLANK_AUDIO\]/gi, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isJunk(text: string): boolean {
  return /^(you|thank you|thanks|okay|ok|hmm|uh|um|the|a|i|yeah)\.?$/i.test(text);
}

async function loadWhisper(): Promise<Asr> {
  if (asr) return asr;
  status("loading whisper (first time)…");
  const mod = await import("@huggingface/transformers");
  const env = mod.env as {
    allowLocalModels: boolean;
    allowRemoteModels: boolean;
    useBrowserCache: boolean;
  };
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;
  const device = await pickDevice();
  try {
    const transcriber = await mod.pipeline("automatic-speech-recognition", WHISPER_ID, {
      dtype: "q8",
      device,
    });
    asr = transcriber as Asr;
  } catch {
    const transcriber = await mod.pipeline("automatic-speech-recognition", WHISPER_ID, {
      dtype: "q8",
      device: "wasm",
    });
    asr = transcriber as Asr;
  }
  status("whisper ready");
  return asr;
}

async function loadKokoro(): Promise<Kokoro> {
  if (tts) return tts;
  status("loading voice (first time)…");
  // Web build (not the Node entry) so espeak phonemes work in a worker.
  const mod = await import("kokoro-js");
  // WebGPU output for this model is often noise. WASM is slower and correct.
  tts = (await mod.KokoroTTS.from_pretrained(KOKORO_ID, {
    dtype: "q8",
    device: "wasm",
  })) as Kokoro;
  status("voice ready");
  return tts;
}

function copyWave(audio: { audio?: Float32Array; sampling_rate?: number }): {
  pcm: Float32Array;
  sampleRate: number;
} {
  const src = audio.audio;
  if (!src || !src.length) throw new Error("kokoro returned no audio");
  // Must copy. audio.audio is a view onto the ONNX WASM heap; transferring
  // that buffer plays garbage and detaches the model.
  const pcm = new Float32Array(src);
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]!));
  if (peak > 1.25) {
    const g = 0.9 / peak;
    for (let i = 0; i < pcm.length; i++) pcm[i]! *= g;
  }
  return { pcm, sampleRate: audio.sampling_rate || 24_000 };
}

async function transcribe(pcm: Float32Array, sampleRate: number): Promise<string> {
  if (!pcm.length) return "";
  const audio = resampleTo16k(pcm, sampleRate);
  if (audio.length < SAMPLE_RATE * 0.2) return "";
  if (!hasSpeechEnergy(audio) && audio.length < SAMPLE_RATE * 0.7) return "";
  const model = await loadWhisper();
  status("hearing…");
  const result = await model(audio, {
    sampling_rate: SAMPLE_RATE,
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  const text = normalize(result.text ?? "");
  status("whisper ready");
  if (!text) return "";
  if (isJunk(text) && audio.length < SAMPLE_RATE * 1.1) return "";
  return text;
}

async function speak(
  text: string,
  voice: string,
  speed = 1.05,
): Promise<{ pcm: Float32Array; sampleRate: number }> {
  const model = await loadKokoro();
  status("speaking…");
  const audio = await model.generate(text, {
    voice,
    speed: Math.min(1.4, Math.max(0.7, speed)),
  });
  status("voice ready");
  return copyWave(audio);
}

function handle(msg: InMsg): Promise<void> {
  return (async () => {
    try {
      if (msg.type === "init-whisper") {
        await loadWhisper();
        ok(msg.id);
        return;
      }
      if (msg.type === "init-kokoro") {
        await loadKokoro();
        ok(msg.id);
        return;
      }
      if (msg.type === "transcribe") {
        const text = await transcribe(msg.pcm, msg.sampleRate);
        post({ id: msg.id, type: "transcript", text });
        return;
      }
      const { pcm, sampleRate } = await speak(msg.text, msg.voice, msg.speed);
      post({ id: msg.id, type: "audio", pcm, sampleRate }, [pcm.buffer]);
    } catch (err) {
      fail(msg.id, err);
    }
  })();
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (msg.type === "init-kokoro" || msg.type === "speak") {
    voiceQ = voiceQ.then(() => handle(msg));
    return;
  }
  hearQ = hearQ.then(() => handle(msg));
};
