import { clamp, type Vec3 } from "./math";
import { qualityTier } from "./quality";

/** Signed stains in the field. Negative amp is fear, positive is joy. */
export type Stain = {
  x: number;
  z: number;
  amp: number;
  invR2: number;
  /** Unix ms when this feeling was last lived. */
  born: number;
  /** Strongest |amp| this stain ever held — old joy settles toward a fraction of it. */
  peak: number;
};

const STORE = "raymarch_emotion_stains";
const MAX_STORE = 24;
const BASE_R = 2.8;

let stains: Stain[] = load();
let saveAt = 0;
let lastTick = Date.now();

function load(): Stain[] {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Stain>[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .filter(
        (s): s is Partial<Stain> =>
          !!s &&
          typeof s.x === "number" &&
          typeof s.z === "number" &&
          typeof s.amp === "number" &&
          typeof s.invR2 === "number",
      )
      .map((s) => ({
        x: s.x!,
        z: s.z!,
        amp: s.amp!,
        invR2: s.invR2!,
        born: typeof s.born === "number" ? s.born : now - 1_200_000,
        peak: typeof s.peak === "number" ? s.peak : Math.abs(s.amp!),
      }))
      .slice(-MAX_STORE);
  } catch {
    return [];
  }
}

function persist(): void {
  localStorage.setItem(STORE, JSON.stringify(stains.slice(-MAX_STORE)));
}

function maybeSave(force = false): void {
  const now = performance.now();
  if (!force && now - saveAt < 1200) return;
  saveAt = now;
  persist();
}

export function clearEmotion(): void {
  stains = [];
  persist();
}

export function allStains(): readonly Stain[] {
  return stains;
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

function warmth(s: Stain): number {
  if (s.peak <= 0 || s.amp <= 0) return 0;
  return Math.min(0.16, s.peak * 0.22);
}

/** Leave a feeling in the world at xz. Nearby stains merge. */
export function stain(pos: Vec3, valence: number, amount: number): void {
  const amp = clamp(valence, -1, 1) * clamp(amount, 0.02, 1);
  if (Math.abs(amp) < 0.02) return;
  const x = pos[0];
  const z = pos[2];
  const now = Date.now();
  let merged = false;
  for (const s of stains) {
    const dx = s.x - x;
    const dz = s.z - z;
    if (dx * dx + dz * dz < 2.1) {
      s.amp = clamp(s.amp * 0.86 + amp, -1.4, 1.4);
      s.x = (s.x * 2 + x) / 3;
      s.z = (s.z * 2 + z) / 3;
      s.born = s.born * 0.62 + now * 0.38;
      s.peak = Math.max(s.peak, Math.abs(s.amp));
      merged = true;
      break;
    }
  }
  if (!merged) {
    stains.push({
      x,
      z,
      amp,
      invR2: 1 / (BASE_R * BASE_R),
      born: now,
      peak: Math.abs(amp),
    });
    if (stains.length > MAX_STORE) stains.shift();
  }
  maybeSave();
}

/**
 * Time weathers the field. Fear softens toward nothing. Joy settles into
 * gentle warmth instead of a spike. Sleep processes feelings faster.
 */
export function tickEmotion(sleep: number): void {
  const now = Date.now();
  const wall = Math.min(180, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  if (wall < 0.016 || !stains.length) return;
  const rate = wall * (sleep > 0.45 ? 3.6 : 1);
  const fearTau = 95;
  const joyTau = 170;
  const next: Stain[] = [];
  for (const s of stains) {
    const hours = Math.max(0, (now - s.born) / 3_600_000);
    const age = Math.exp(-hours / 10);
    if (s.amp < 0) {
      s.amp *= Math.exp(-rate / fearTau) * (0.72 + 0.28 * age);
    } else {
      const warm = warmth(s);
      s.amp = warm + (s.amp - warm) * Math.exp(-rate / joyTau);
      s.amp *= 0.82 + 0.18 * age;
      if (s.amp < warm) s.amp = warm;
    }
    const r0 = 1 / Math.sqrt(Math.max(1e-4, s.invR2));
    const r = Math.min(5.8, r0 + rate * 0.0045);
    s.invR2 = 1 / (r * r);
    if (s.amp < 0 && s.amp > -0.018) continue;
    if (s.amp >= 0 && s.amp < 0.012 && warmth(s) < 0.02) continue;
    next.push(s);
  }
  stains = next;
  maybeSave();
}

/** Dreams chew a feeling down after growing landscape from it. */
export function fadeNear(x: number, z: number, mul: number): void {
  const m = clamp(mul, 0.2, 0.95);
  for (const s of stains) {
    const dx = s.x - x;
    const dz = s.z - z;
    if (dx * dx + dz * dz > 7.5) continue;
    if (s.amp < 0) s.amp *= m;
    else {
      const warm = warmth(s);
      s.amp = warm + (s.amp - warm) * m;
    }
  }
  maybeSave(true);
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
