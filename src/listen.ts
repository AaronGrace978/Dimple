import { unlockAudio } from "./audio";
import { isSteamDeck } from "./quality";
import { prepareWhisper, transcribePcm } from "./whisper";

const MAX_SECONDS = 20;
const MIN_SECONDS = 0.2;

let stream: MediaStream | null = null;
let processor: ScriptProcessorNode | null = null;
let mute: GainNode | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let recorder: MediaRecorder | null = null;
let recBlobs: Blob[] = [];
let chunks: Float32Array[] = [];
let captured = 0;
let captureRate = 16000;
let recording = false;
let holding = false;
let session = 0;

export function canListen(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

export function isHoldingTalk(): boolean {
  return holding;
}

function flatten(parts: Float32Array[]): Float32Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Float32Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function cleanupGraph(stopRec = true): void {
  if (stopRec) {
    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {
      /* already stopped */
    }
    recorder = null;
  }
  processor?.disconnect();
  processor = null;
  mute?.disconnect();
  mute = null;
  source?.disconnect();
  source = null;
}

export function stopListen(): void {
  session += 1;
  holding = false;
  recording = false;
  cleanupGraph();
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  chunks = [];
  recBlobs = [];
  captured = 0;
}

async function openMic(): Promise<MediaStream> {
  if (stream && stream.getAudioTracks().some((t) => t.readyState === "live")) return stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    return stream;
  }
}

export function warmMic(): void {
  void openMic().catch(() => undefined);
}

function startScriptCapture(ctx: AudioContext, media: MediaStream): void {
  source = ctx.createMediaStreamSource(media);
  processor = ctx.createScriptProcessor(4096, 1, 1);
  mute = ctx.createGain();
  mute.gain.value = 0;
  processor.onaudioprocess = (ev) => {
    if (!recording) return;
    const input = ev.inputBuffer.getChannelData(0);
    const room = captureRate * MAX_SECONDS - captured;
    const n = Math.min(input.length, room);
    if (n <= 0) return;
    const slice = new Float32Array(n);
    slice.set(n === input.length ? input : input.subarray(0, n));
    chunks.push(slice);
    captured += n;
  };
  source.connect(processor);
  processor.connect(mute);
  mute.connect(ctx.destination);
}

function startRecorder(media: MediaStream): void {
  recBlobs = [];
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  const mime = types.find((t) => MediaRecorder.isTypeSupported(t));
  try {
    recorder = mime ? new MediaRecorder(media, { mimeType: mime }) : new MediaRecorder(media);
  } catch {
    recorder = null;
    return;
  }
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) recBlobs.push(ev.data);
  };
  try {
    recorder.start(80);
  } catch {
    recorder = null;
  }
}

export async function pttStart(onStatus?: (s: string) => void): Promise<void> {
  const id = ++session;
  holding = true;
  recording = true;
  chunks = [];
  recBlobs = [];
  captured = 0;
  onStatus?.("hold and speak…");
  void prepareWhisper().catch(() => undefined);
  try {
    const media = await openMic();
    if (id !== session || !holding) return;
    const live = media.getAudioTracks().filter((t) => t.readyState === "live");
    if (!live.length) throw new Error("mic blocked — Steam Properties → enable microphone");
    const ctx = await unlockAudio();
    captureRate = ctx.sampleRate || 48000;
    startScriptCapture(ctx, media);
    startRecorder(media);
    if (id !== session || !holding) {
      cleanupGraph();
      return;
    }
    onStatus?.("listening — keep holding");
  } catch (err) {
    if (id !== session) return;
    holding = false;
    recording = false;
    onStatus?.(err instanceof Error ? err.message : "mic failed");
  }
}

async function pcmFromRecorder(ctx: AudioContext): Promise<Float32Array | null> {
  if (!recBlobs.length) return null;
  try {
    const blob = new Blob(recBlobs, { type: recBlobs[0]?.type || "audio/webm" });
    if (blob.size < 200) return null;
    const buf = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    return decoded.getChannelData(0).slice();
  } catch {
    return null;
  }
}

export async function pttStop(onStatus?: (s: string) => void): Promise<string> {
  if (!holding && !recording) return "";
  session += 1;
  holding = false;
  recording = false;
  const rec = recorder;
  recorder = null;
  cleanupGraph(false);
  if (rec) {
    await new Promise<void>((resolve) => {
      const t = window.setTimeout(resolve, 500);
      rec.onstop = () => {
        window.clearTimeout(t);
        resolve();
      };
      try {
        if (rec.state !== "inactive") rec.stop();
        else resolve();
      } catch {
        resolve();
      }
    });
  }
  const fromScript = flatten(chunks);
  chunks = [];
  captured = 0;
  const ctx = await unlockAudio();
  const fromRec = await pcmFromRecorder(ctx);
  recBlobs = [];
  const raw =
    fromRec && fromRec.length > fromScript.length ? fromRec : fromScript;
  const rate = fromRec && fromRec.length > fromScript.length ? ctx.sampleRate : captureRate;
  const seconds = raw.length / Math.max(1, rate);
  if (seconds < MIN_SECONDS) {
    onStatus?.(
      raw.length
        ? "hold longer"
        : "mic silent — Steam: game properties → enable microphone, then hold X",
    );
    return "";
  }
  onStatus?.("whisper…");
  try {
    const text = await transcribePcm(raw, rate);
    onStatus?.(text ? "whisper ready" : "didn't catch that — speak closer / hold longer");
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
