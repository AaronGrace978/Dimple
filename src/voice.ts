import { playPcm } from "./audio";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VOICE_KEY = "raymarch_kokoro_voice";

export const LOCAL_VOICES = [
  { id: "af_heart", name: "Heart" },
  { id: "af_bella", name: "Bella" },
  { id: "af_nicole", name: "Nicole" },
  { id: "af_sarah", name: "Sarah" },
  { id: "am_puck", name: "Puck" },
  { id: "am_echo", name: "Echo" },
  { id: "am_michael", name: "Michael" },
  { id: "bm_george", name: "George" },
  { id: "bf_emma", name: "Emma" },
] as const;

type LocalVoiceId = (typeof LOCAL_VOICES)[number]["id"];

type Kokoro = {
  generate: (
    text: string,
    opts: { voice: string; speed?: number },
  ) => Promise<{ audio: Float32Array; sampling_rate: number }>;
};

let ttsPromise: Promise<Kokoro> | null = null;
let status = "voice idle";
const listeners = new Set<(s: string) => void>();

export function voiceStatus(): string {
  return status;
}

export function onVoiceStatus(fn: (s: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(s: string): void {
  status = s;
  for (const fn of listeners) fn(s);
}

export function localVoice(): LocalVoiceId {
  const v = localStorage.getItem(VOICE_KEY);
  return LOCAL_VOICES.some((x) => x.id === v) ? (v as LocalVoiceId) : "af_heart";
}

export function setLocalVoice(id: string): void {
  if (LOCAL_VOICES.some((x) => x.id === id)) localStorage.setItem(VOICE_KEY, id);
}

async function loadTts(): Promise<Kokoro> {
  if (ttsPromise) return ttsPromise;
  ttsPromise = (async () => {
    emit("loading voice (first time)…");
    const mod = await import("kokoro-js");
    const tts = await mod.KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: "q8",
      device: "wasm",
    });
    emit("voice ready");
    return tts as Kokoro;
  })().catch((err) => {
    ttsPromise = null;
    emit(err instanceof Error ? err.message : "voice failed");
    throw err;
  });
  return ttsPromise;
}

export function prepareLocalVoice(): Promise<void> {
  return loadTts().then(() => undefined);
}

export async function speakLocal(text: string): Promise<void> {
  const line = text.trim();
  if (!line) return;
  const tts = await loadTts();
  emit("speaking…");
  const audio = await tts.generate(line, { voice: localVoice(), speed: 1.05 });
  await playPcm(audio.audio, audio.sampling_rate);
  emit("voice ready");
}
