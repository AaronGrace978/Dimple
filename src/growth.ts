import { clamp } from "./math";
import { loadMemory } from "./memory";

const STORE = "raymarch_growth";

function stored(): number {
  try {
    const v = Number(localStorage.getItem(STORE));
    return Number.isFinite(v) ? clamp(v, 0, 1) : 0;
  } catch {
    return 0;
  }
}

/** Existing companions aren't newborns. Chat + affection set a floor. */
export function loadGrowth(): number {
  const mem = loadMemory();
  const fromLife = clamp(mem.chat.length / 48 * 0.55 + mem.affection * 0.4, 0, 0.92);
  const g = Math.max(stored(), fromLife, mem.chat.length > 2 ? 0.12 : 0.045);
  return clamp(g, 0.04, 1);
}

export function saveGrowth(g: number): number {
  const v = clamp(g, 0.04, 1);
  localStorage.setItem(STORE, String(v));
  return v;
}

export function bumpGrowth(delta: number): number {
  return saveGrowth(loadGrowth() + delta);
}

export function clearGrowth(): void {
  localStorage.removeItem(STORE);
}

export function growthLabel(g: number): string {
  if (g < 0.12) return "flicker";
  if (g < 0.28) return "sprout";
  if (g < 0.52) return "forming";
  if (g < 0.78) return "itself";
  return "bloom";
}
