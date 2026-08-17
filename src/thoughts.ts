import { dist, type Vec3 } from "./math";
import { qualityTier } from "./quality";

export type Bead = {
  pos: Vec3;
  word: string;
  mood: string;
  hue: number;
  at: number;
};

const STORE = "raymarch_thought_beads";
const MAX = 48;

let beads: Bead[] = load();
let saveAt = 0;

function load(): Bead[] {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Bead>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (b): b is Bead =>
          !!b &&
          Array.isArray(b.pos) &&
          b.pos.length >= 3 &&
          typeof b.word === "string" &&
          typeof b.mood === "string",
      )
      .map((b) => ({
        pos: [Number(b.pos[0]) || 0, Number(b.pos[1]) || 0.4, Number(b.pos[2]) || 0] as Vec3,
        word: b.word.slice(0, 22),
        mood: b.mood,
        hue: typeof b.hue === "number" ? b.hue : 0.48,
        at: typeof b.at === "number" ? b.at : 0,
      }))
      .slice(-MAX);
  } catch {
    return [];
  }
}

function persist(): void {
  localStorage.setItem(STORE, JSON.stringify(beads.slice(-MAX)));
}

export function clearThoughts(): void {
  beads = [];
  persist();
}

const STOP = new Set([
  "the",
  "and",
  "you",
  "that",
  "this",
  "with",
  "from",
  "have",
  "just",
  "like",
  "it's",
  "i'm",
  "for",
  "not",
  "but",
  "are",
  "was",
  "were",
]);

export function fragment(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const keep = words.filter((w) => !STOP.has(w) && w.length > 2);
  const pick = keep[0] ?? words[0] ?? text.trim().slice(0, 14);
  return pick.slice(0, 18);
}

export function dropBead(pos: Vec3, text: string, mood: string, hue: number): void {
  const word = fragment(text);
  if (!word) return;
  const last = beads[beads.length - 1];
  if (last && last.word === word && dist(last.pos, pos) < 0.55) return;
  beads.push({
    pos: [pos[0], pos[1] + 0.08, pos[2]],
    word,
    mood,
    hue,
    at: Date.now(),
  });
  if (beads.length > MAX) beads.shift();
  const now = performance.now();
  if (now - saveAt > 800) {
    saveAt = now;
    persist();
  }
}

export function allBeads(): Bead[] {
  return beads;
}

export function nearestBeads(from: Vec3, n = 4): Bead[] {
  return [...beads]
    .sort((a, b) => dist(a.pos, from) - dist(b.pos, from))
    .slice(0, n);
}

export function packBeads(from: Vec3): {
  p0: Vec3;
  p1: Vec3;
  p2: Vec3;
  p3: Vec3;
  w: [number, number, number, number];
  labels: Bead[];
} {
  const n = qualityTier() === 0 ? 2 : 4;
  const near = nearestBeads(from, n);
  const empty: Vec3 = [0, -8, 0];
  const w: [number, number, number, number] = [0, 0, 0, 0];
  const pts = [empty, empty, empty, empty] as Vec3[];
  for (let i = 0; i < near.length; i++) {
    pts[i] = near[i]!.pos;
    const d = dist(from, near[i]!.pos);
    w[i] = Math.max(0.15, 1 - d * 0.12);
  }
  return { p0: pts[0]!, p1: pts[1]!, p2: pts[2]!, p3: pts[3]!, w, labels: near };
}
