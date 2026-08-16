import { isSteamDeck } from "./quality";
import { prepareWhisper, transcribePcm } from "./whisper";

const MAX_SECONDS = 45;

let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let mute: GainNode | null = null;
let samples: number[] = [];
let captureRate = 16000;
let recording = false;
let holding = false;

export function canListen(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

export function isHoldingTalk(): boolean {
  return holding;
}

function cleanupGraph(): void {
  processor?.disconnect();
  processor = null;
  mute?.disconnect();
  mute = null;
}

export function stopListen(): void {
  holding = false;
  recording = false;
  cleanupGraph();
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  void audioCtx?.close();
  audioCtx = null;
  samples = [];
}

export async function pttStart(onStatus?: (s: string) => void): Promise<void> {
  if (holding) return;
  holding = true;
  recording = true;
  samples = [];
  onStatus?.("hold and speak…");
  void prepareWhisper().catch(() => undefined);
  try {
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    }
    audioCtx = audioCtx ?? new AudioContext();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    captureRate = audioCtx.sampleRate;
    const source = audioCtx.createMediaStreamSource(stream);
    processor = audioCtx.createScriptProcessor(4096, 1, 1);
    mute = audioCtx.createGain();
    mute.gain.value = 0;
    processor.onaudioprocess = (ev) => {
      if (!recording) return;
      const input = ev.inputBuffer.getChannelData(0);
      if (samples.length >= captureRate * MAX_SECONDS) return;
      samples.push(...input);
    };
    source.connect(processor);
    processor.connect(mute);
    mute.connect(audioCtx.destination);
  } catch (err) {
    holding = false;
    recording = false;
    onStatus?.(err instanceof Error ? err.message : "mic failed");
  }
}

export async function pttStop(onStatus?: (s: string) => void): Promise<string> {
  if (!holding && !recording) return "";
  holding = false;
  recording = false;
  cleanupGraph();
  const raw = new Float32Array(samples);
  samples = [];
  if (raw.length < captureRate * 0.3) {
    onStatus?.("hold longer");
    return "";
  }
  onStatus?.("whisper…");
  try {
    const text = await transcribePcm(raw, captureRate);
    onStatus?.(text ? "whisper ready" : "didn't catch that");
    return text;
  } catch (err) {
    onStatus?.(err instanceof Error ? err.message : "whisper failed");
    return "";
  }
}

/** Focus the field only. Do not also open Steam OSK — that double-types. */
export function wakeKeyboard(input: HTMLInputElement): void {
  input.focus({ preventScroll: true });
  if (!isSteamDeck()) {
    try {
      const vk = (
        navigator as Navigator & { virtualKeyboard?: { show?: () => void } }
      ).virtualKeyboard;
      vk?.show?.();
    } catch {
      /* ignore */
    }
  }
}

export function guardDoubleType(input: HTMLInputElement): void {
  let last = { t: 0, k: "" };
  input.addEventListener(
    "keydown",
    (e) => {
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      if (last.k === e.key && now - last.t < 28) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      last = { t: now, k: e.key };
    },
    true,
  );
}
