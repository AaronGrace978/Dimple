let ctx: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;
let speechGain: GainNode | null = null;
let speaking = false;
/** Bumped on every hush so in-flight Kokoro cannot start playback. */
let speechGen = 0;

export function speechGeneration(): number {
  return speechGen;
}

export function bumpSpeechGeneration(): number {
  speechGen += 1;
  return speechGen;
}

export function isSpeaking(): boolean {
  return speaking || playing !== null;
}

export function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === "closed") ctx = new AudioContext();
  return ctx;
}

export async function unlockAudio(): Promise<AudioContext> {
  const c = getAudioContext();
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* still locked until a gesture */
    }
  }
  return c;
}

function hushGain(): void {
  if (!speechGain || !ctx || ctx.state === "closed") return;
  try {
    speechGain.gain.cancelScheduledValues(ctx.currentTime);
    speechGain.gain.setValueAtTime(0, ctx.currentTime);
  } catch {
    /* context gone */
  }
}

function cutSource(): void {
  try {
    playing?.stop();
  } catch {
    /* already stopped */
  }
  playing = null;
  speaking = false;
}

export function stopPcm(): void {
  bumpSpeechGeneration();
  hushGain();
  cutSource();
}

export async function playPcm(
  pcm: Float32Array,
  sampleRate: number,
  opts?: { rate?: number; warmth?: number },
): Promise<void> {
  const gen = speechGeneration();
  const c = await unlockAudio();
  if (gen !== speechGeneration()) return;
  cutSource();
  const copy = new Float32Array(pcm);
  const buffer = c.createBuffer(1, copy.length, sampleRate);
  buffer.copyToChannel(copy, 0);
  const rate = Math.min(1.45, Math.max(0.7, opts?.rate ?? 1));
  const warmth = Math.min(1, Math.max(0, opts?.warmth ?? 0.65));
  await new Promise<void>((resolve, reject) => {
    if (gen !== speechGeneration()) {
      resolve();
      return;
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800 + warmth * 9000;
    filter.Q.value = 0.55;
    const g = c.createGain();
    g.gain.value = 1;
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    playing = src;
    speechGain = g;
    speaking = true;
    src.onended = () => {
      if (playing === src) playing = null;
      if (speechGain === g) speechGain = null;
      speaking = false;
      resolve();
    };
    try {
      src.start();
    } catch (err) {
      playing = null;
      if (speechGain === g) speechGain = null;
      speaking = false;
      reject(err);
    }
  });
}

/** Quiet field-tick. Does not cut off spoken audio. */
export function chirp(kind: "pet" | "wake" | "sleep"): void {
  void unlockAudio().then((c) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    if (kind === "pet") {
      o.frequency.setValueAtTime(392, t);
      o.frequency.exponentialRampToValueAtTime(660, t + 0.07);
      o.frequency.exponentialRampToValueAtTime(523, t + 0.16);
      g.gain.exponentialRampToValueAtTime(0.055, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.start(t);
      o.stop(t + 0.22);
    } else if (kind === "wake") {
      o.frequency.setValueAtTime(280, t);
      o.frequency.exponentialRampToValueAtTime(520, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.04, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.start(t);
      o.stop(t + 0.3);
    } else {
      o.frequency.setValueAtTime(330, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.22);
      g.gain.exponentialRampToValueAtTime(0.03, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.start(t);
      o.stop(t + 0.34);
    }
    o.connect(g);
    g.connect(c.destination);
  });
}

export async function playBytes(data: ArrayBuffer): Promise<void> {
  const gen = speechGeneration();
  const c = await unlockAudio();
  if (gen !== speechGeneration()) return;
  const buffer = await c.decodeAudioData(data.slice(0));
  if (gen !== speechGeneration()) return;
  cutSource();
  await new Promise<void>((resolve, reject) => {
    if (gen !== speechGeneration()) {
      resolve();
      return;
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = c.createGain();
    g.gain.value = 1;
    src.connect(g);
    g.connect(c.destination);
    playing = src;
    speechGain = g;
    speaking = true;
    src.onended = () => {
      if (playing === src) playing = null;
      if (speechGain === g) speechGain = null;
      speaking = false;
      resolve();
    };
    try {
      src.start();
    } catch (err) {
      playing = null;
      if (speechGain === g) speechGain = null;
      speaking = false;
      reject(err);
    }
  });
}
