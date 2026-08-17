import { workerTranscribe, initWhisper, onSpeechStatus } from "./speechHub";

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

onSpeechStatus((s) => {
  if (/whisper|hearing|mic/i.test(s) || s.includes("whisper")) emit(s);
});

export function prepareWhisper(): Promise<void> {
  emit("loading whisper (first time)…");
  return initWhisper().catch((err) => {
    emit(err instanceof Error ? err.message : "whisper failed");
    throw err;
  });
}

export function transcribePcm(pcm: Float32Array, sampleRate: number): Promise<string> {
  emit("whisper…");
  return workerTranscribe(pcm, sampleRate);
}
