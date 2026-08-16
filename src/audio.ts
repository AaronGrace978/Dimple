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
