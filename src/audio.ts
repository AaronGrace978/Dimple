let ctx: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;

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

export function stopPcm(): void {
  try {
    playing?.stop();
  } catch {
    /* already stopped */
  }
  playing = null;
}

export async function playPcm(pcm: Float32Array, sampleRate: number): Promise<void> {
  const c = await unlockAudio();
  stopPcm();
  const copy = new Float32Array(pcm);
  const buffer = c.createBuffer(1, copy.length, sampleRate);
  buffer.copyToChannel(copy, 0);
  await new Promise<void>((resolve, reject) => {
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    playing = src;
    src.onended = () => {
      if (playing === src) playing = null;
      resolve();
    };
    try {
      src.start();
    } catch (err) {
      playing = null;
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
  const c = await unlockAudio();
  stopPcm();
  const buffer = await c.decodeAudioData(data.slice(0));
  await new Promise<void>((resolve, reject) => {
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    playing = src;
    src.onended = () => {
      if (playing === src) playing = null;
      resolve();
    };
    try {
      src.start();
    } catch (err) {
      playing = null;
      reject(err);
    }
  });
}
