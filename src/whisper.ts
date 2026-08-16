const SAMPLE_RATE = 16000;
const MODEL_ID = "Xenova/whisper-tiny.en";

type Asr = (
  audio: Float32Array,
  options: { sampling_rate: number; chunk_length_s?: number; stride_length_s?: number },
) => Promise<{ text?: string }>;

let asrPromise: Promise<Asr> | null = null;
let status = "whisper idle";
const listeners = new Set<(s: string) => void>();

export function whisperStatus(): string {
  return status;
}

export function onWhisperStatus(fn: (s: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(s: string): void {
  status = s;
  for (const fn of listeners) fn(s);
}

export function resampleTo16k(samples: Float32Array, fromRate: number): Float32Array {
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

export function hasSpeechEnergy(pcm: Float32Array): boolean {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i]! * pcm[i]!;
  return Math.sqrt(sum / Math.max(1, pcm.length)) > 0.008;
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

async function loadAsr(): Promise<Asr> {
  if (asrPromise) return asrPromise;
  asrPromise = (async () => {
    emit("loading whisper (first time)…");
    const mod = await import("@huggingface/transformers");
    const env = mod.env as {
      allowLocalModels: boolean;
      allowRemoteModels: boolean;
      useBrowserCache: boolean;
    };
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;
    const transcriber = await mod.pipeline("automatic-speech-recognition", MODEL_ID, {
      dtype: "q8",
      device: "wasm",
    });
    emit("whisper ready");
    return transcriber as Asr;
  })().catch((err) => {
    asrPromise = null;
    emit(err instanceof Error ? err.message : "whisper failed");
    throw err;
  });
  return asrPromise;
}

export function prepareWhisper(): Promise<void> {
  return loadAsr().then(() => undefined);
}

export async function transcribePcm(pcm: Float32Array, sampleRate: number): Promise<string> {
  if (!pcm.length) return "";
  const audio = resampleTo16k(pcm, sampleRate);
  if (audio.length < SAMPLE_RATE * 0.3 || !hasSpeechEnergy(audio)) return "";
  const asr = await loadAsr();
  emit("hearing…");
  const result = await asr(audio, {
    sampling_rate: SAMPLE_RATE,
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  const text = normalize(result.text ?? "");
  emit("whisper ready");
  if (!text || isJunk(text)) return "";
  return text;
}
