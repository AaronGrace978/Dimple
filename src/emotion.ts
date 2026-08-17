import { clamp, type Vec3 } from "./math";
import { qualityTier } from "./quality";

/** Signed stains in the field. Negative amp is fear, positive is joy. */
export type Stain = {
  x: number;
  z: number;
  amp: number;
  invR2: number;
};

const STORE = "raymarch_emotion_stains";
const MAX_STORE = 24;

let stains: Stain[] = load();
let saveAt = 0;

function load(): Stain[] {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Stain>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is Stain =>
          !!s &&
          typeof s.x === "number" &&
          typeof s.z === "number" &&
          typeof s.amp === "number" &&
          typeof s.invR2 === "number",
      )
      .slice(-MAX_STORE);
  } catch {
    return [];
  }
}

function persist(): void {
  localStorage.setItem(STORE, JSON.stringify(stains.slice(-MAX_STORE)));
}

export function clearEmotion(): void {
  stains = [];
  persist();
}

export function moodValence(mood: string): number {
  if (mood === "startle") return -0.85;
  if (mood === "sleep") return 0.08;
  if (mood === "nuzzle" || mood === "trust") return 0.9;
  if (mood === "play" || mood === "greet") return 0.72;
  if (mood === "rest") return 0.28;
  if (mood === "think") return 0.18;
  if (mood === "climb") return 0.22;
  if (mood === "seek") return 0.35;
  return 0.12;
}

/** Leave a feeling in the world at xz. Nearby stains merge. */
export function stain(pos: Vec3, valence: number, amount: number): void {
  const amp = clamp(valence, -1, 1) * clamp(amount, 0.02, 1);
  if (Math.abs(amp) < 0.02) return;
  const x = pos[0];
  const z = pos[2];
  let merged = false;
  for (const s of stains) {
    const dx = s.x - x;
    const dz = s.z - z;
    if (dx * dx + dz * dz < 2.1) {
      s.amp = clamp(s.amp * 0.86 + amp, -1.4, 1.4);
      s.x = (s.x * 2 + x) / 3;
      s.z = (s.z * 2 + z) / 3;
      merged = true;
      break;
    }
  }
  if (!merged) {
    stains.push({ x, z, amp, invR2: 1 / (2.8 * 2.8) });
    if (stains.length > MAX_STORE) stains.shift();
  }
  const now = performance.now();
  if (now - saveAt > 1200) {
    saveAt = now;
    persist();
  }
}

export function feelXZ(x: number, z: number): { fear: number; joy: number } {
  let fear = 0;
  let joy = 0;
  for (const s of stains) {
    const dx = x - s.x;
    const dz = z - s.z;
    const w = 1 / (1 + (dx * dx + dz * dz) * s.invR2);
    if (s.amp < 0) fear += -s.amp * w;
    else joy += s.amp * w;
  }
  return { fear: clamp(fear, 0, 1.8), joy: clamp(joy, 0, 1.8) };
}

export function feelMeans(): { fear: number; joy: number } {
  if (!stains.length) return { fear: 0, joy: 0 };
  let fear = 0;
  let joy = 0;
  for (const s of stains) {
    if (s.amp < 0) fear += -s.amp;
    else joy += s.amp;
  }
  const n = Math.max(1, stains.length);
  return { fear: clamp(fear / n, 0, 1), joy: clamp(joy / n, 0, 1) };
}

/** Pack strongest stains for the shader: xy = xz, z = signed amp, w = invR2. */
export function packEmotions(): { data: Float32Array; count: number; fear: number; joy: number } {
  const cap = qualityTier() === 0 ? 4 : 8;
  const ranked = [...stains].sort((a, b) => Math.abs(b.amp) - Math.abs(a.amp)).slice(0, cap);
  const data = new Float32Array(8 * 4);
  for (let i = 0; i < ranked.length; i++) {
    const s = ranked[i]!;
    data[i * 4] = s.x;
    data[i * 4 + 1] = s.z;
    data[i * 4 + 2] = s.amp;
    data[i * 4 + 3] = s.invR2;
  }
  const means = feelMeans();
  return { data, count: ranked.length, fear: means.fear, joy: means.joy };
}
