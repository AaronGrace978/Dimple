import { playPcm, speechGeneration } from "./audio";
import { initKokoro, onSpeechStatus, workerSpeak } from "./speechHub";

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

onSpeechStatus((s) => {
  if (/voice|speaking|kokoro/i.test(s)) emit(s);
});

export function localVoice(): LocalVoiceId {
  const v = localStorage.getItem(VOICE_KEY);
  return LOCAL_VOICES.some((x) => x.id === v) ? (v as LocalVoiceId) : "af_heart";
}

export function setLocalVoice(id: string): void {
  if (LOCAL_VOICES.some((x) => x.id === id)) localStorage.setItem(VOICE_KEY, id);
}

export function prepareLocalVoice(): Promise<void> {
  emit("loading voice (first time)…");
  return initKokoro().catch((err) => {
    emit(err instanceof Error ? err.message : "voice failed");
    throw err;
  });
}

export async function speakLocal(
  text: string,
  opts?: { speed?: number; pitch?: number; warmth?: number },
): Promise<void> {
  const line = text.trim();
  if (!line) return;
  const gen = speechGeneration();
  emit("speaking…");
  const audio = await workerSpeak(line, localVoice(), opts?.speed ?? 1.05);
  if (gen !== speechGeneration()) {
    emit("voice ready");
    return;
  }
  await playPcm(audio.pcm, audio.sampleRate, {
    rate: opts?.pitch ?? 1,
    warmth: opts?.warmth ?? 0.65,
  });
  emit("voice ready");
}
