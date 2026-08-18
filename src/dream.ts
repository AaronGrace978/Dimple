import { clamp, type Vec3 } from "./math";
import { allStains, fadeNear } from "./emotion";
import { qualityTier } from "./quality";
import { settleBeads } from "./thoughts";

/** Landscape Dimple dreamed into the field. Positive amp grows a monolith; negative erodes. */
export type DreamMark = {
  x: number;
  z: number;
  amp: number;
  invR2: number;
  born: number;
};

const STORE = "raymarch_dream_marks";
const MAX = 6;
const DREAM_WAKE = [
  "i dreamed the field into a new shape",
  "mm. the stains went to weather while i slept",
  "the nest grew a memory. look.",
  "old fear softened. i left a hollow where it was",
  "joy piled up. there's a new stone out there",
];

let marks: DreamMark[] = load();
let visible: DreamMark[] = [];
let saveAt = 0;
let sleepAcc = 0;
let lastPulse = 0;
let sessionWorked = false;
let lastTick = Date.now();

syncVisible();

function load(): DreamMark[] {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<DreamMark>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is DreamMark =>
          !!m &&
          typeof m.x === "number" &&
          typeof m.z === "number" &&
          typeof m.amp === "number" &&
          typeof m.invR2 === "number",
      )
      .map((m) => ({
        x: m.x,
        z: m.z,
        amp: clamp(m.amp, -1.2, 1.2),
        invR2: m.invR2,
        born: typeof m.born === "number" ? m.born : Date.now(),
      }))
      .slice(-MAX);
  } catch {
    return [];
  }
}

function persist(): void {
  localStorage.setItem(STORE, JSON.stringify(marks.slice(-MAX)));
}

function syncVisible(): void {
  const cap = qualityTier() === 0 ? 2 : MAX;
  visible = [...marks].sort((a, b) => Math.abs(b.amp) - Math.abs(a.amp)).slice(0, cap);
}

function maybeSave(force = false): void {
  const now = performance.now();
  syncVisible();
  if (!force && now - saveAt < 1400) return;
  saveAt = now;
  persist();
}

export function clearDreams(): void {
  marks = [];
  sessionWorked = false;
  syncVisible();
  persist();
}

export function allDreams(): readonly DreamMark[] {
  return marks;
}

export function visibleDreams(): readonly DreamMark[] {
  return visible;
}

function growAt(x: number, z: number, delta: number): void {
  let merged = false;
  for (const m of marks) {
    const dx = m.x - x;
    const dz = m.z - z;
    if (dx * dx + dz * dz < 1.8) {
      m.amp = clamp(m.amp + delta, -1.2, 1.2);
      m.x = (m.x * 2 + x) / 3;
      m.z = (m.z * 2 + z) / 3;
      m.born = Date.now();
      merged = true;
      break;
    }
  }
  if (!merged) {
    const cap = qualityTier() === 0 ? 2 : MAX;
    marks.push({
      x,
      z,
      amp: clamp(delta, -1.2, 1.2),
      invR2: 1 / (2.2 * 2.2),
      born: Date.now(),
    });
    if (marks.length > cap) {
      marks.sort((a, b) => Math.abs(a.amp) - Math.abs(b.amp));
      marks.shift();
    }
  }
  sessionWorked = true;
}

function weather(wall: number, sleep: number): void {
  if (!marks.length || wall < 0.02) return;
  const hours = wall / 3600;
  const fade = Math.exp(-(hours * (sleep > 0.45 ? 0.08 : 0.35)) / 36);
  const next: DreamMark[] = [];
  for (const m of marks) {
    m.amp *= fade;
    if (Math.abs(m.amp) < 0.04) continue;
    next.push(m);
  }
  marks = next;
  syncVisible();
}

function pulse(): void {
  const stains = allStains();
  let joy: { x: number; z: number; amp: number } | null = null;
  let fear: { x: number; z: number; amp: number } | null = null;
  for (const s of stains) {
    if (s.amp > 0.14 && (!joy || s.amp > joy.amp)) joy = s;
    if (s.amp < -0.12 && (!fear || s.amp < fear.amp)) fear = s;
  }
  if (joy) {
    growAt(joy.x, joy.z, 0.14 + joy.amp * 0.08);
    fadeNear(joy.x, joy.z, 0.62);
  }
  if (fear) {
    growAt(fear.x, fear.z, -0.12 + fear.amp * 0.04);
    fadeNear(fear.x, fear.z, 0.55);
  }
  for (const m of marks) {
    const drift = 0.05 + Math.abs(m.amp) * 0.02;
    m.x += (Math.sin(m.born * 0.001 + m.z) - 0.15) * drift;
    m.z += (Math.cos(m.born * 0.0013 + m.x) + 0.1) * drift;
    const r = Math.hypot(m.x, m.z);
    if (r > 8.2) {
      m.x *= 8.2 / r;
      m.z *= 8.2 / r;
    }
  }
  settleBeads(
    marks.filter((m) => m.amp > 0.08).map((m) => ({ x: m.x, z: m.z })),
    2.4,
  );
  if (marks.length) sessionWorked = true;
  maybeSave(true);
}

/**
 * Sleep is generative. While resting, Dimple processes beads and stains —
 * growing stones where joy piled up, eroding where fear gathered.
 */
export function tickDream(sleep: number, dt: number): void {
  const now = Date.now();
  const wall = Math.min(180, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  weather(wall, sleep);
  if (sleep < 0.45) {
    sleepAcc = 0;
    lastPulse = 0;
    maybeSave();
    return;
  }
  sleepAcc += dt;
  if (sleepAcc - lastPulse < 2.15) return;
  lastPulse = sleepAcc;
  pulse();
  syncVisible();
}

export function consumeDreamNote(): string | null {
  if (!sessionWorked) return null;
  sessionWorked = false;
  return DREAM_WAKE[Math.floor(Math.random() * DREAM_WAKE.length)] ?? DREAM_WAKE[0]!;
}

export function dreamGround(x: number, z: number): number {
  let lift = 0;
  let dent = 0;
  for (const m of marks) {
    const dx = x - m.x;
    const dz = z - m.z;
    const w = 1 / (1 + (dx * dx + dz * dz) * m.invR2);
    if (m.amp > 0) lift += m.amp * w * 0.22;
    else dent += -m.amp * w * 0.28;
  }
  return lift - dent;
}

export function dreamLandmarks(): { name: string; pos: Vec3; iso: number }[] {
  return marks
    .filter((m) => m.amp > 0.2)
    .map((m, i) => ({
      name: `dream-${i}`,
      pos: [m.x, 0.9 + m.amp * 0.7, m.z] as Vec3,
      iso: 0.34,
    }));
}

/** Pack for the shader: xy = xz, z = signed amp, w = invR2. */
export function packDreams(): { data: Float32Array; count: number } {
  const ranked = visible;
  const data = new Float32Array(MAX * 4);
  for (let i = 0; i < ranked.length; i++) {
    const m = ranked[i]!;
    data[i * 4] = m.x;
    data[i * 4 + 1] = m.z;
    data[i * 4 + 2] = m.amp;
    data[i * 4 + 3] = m.invR2;
  }
  return { data, count: ranked.length };
}
