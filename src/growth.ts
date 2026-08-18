import { clamp } from "./math";
import { loadMemory } from "./memory";

const STORE = "raymarch_growth";

export type Growth = {
  /** Talk, listen, think — lobes, speech, hue. */
  chat: number;
  /** Pet, pebble, shove — trails, motion, coverage. */
  play: number;
};

let cache: Growth | null = null;

function empty(): Growth {
  return { chat: 0.04, play: 0.04 };
}

function read(): Growth {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      const g = clamp(parsed, 0, 1);
      return { chat: clamp(g * 0.55, 0.03, 1), play: clamp(g * 0.45, 0.03, 1) };
    }
    if (parsed && typeof parsed === "object") {
      const o = parsed as Partial<Growth>;
      return {
        chat: clamp(typeof o.chat === "number" ? o.chat : 0.04, 0.02, 1),
        play: clamp(typeof o.play === "number" ? o.play : 0.04, 0.02, 1),
      };
    }
  } catch {
    /* ignore */
  }
  return empty();
}

function persist(g: Growth): Growth {
  const next: Growth = {
    chat: clamp(g.chat, 0.02, 1),
    play: clamp(g.play, 0.02, 1),
  };
  cache = next;
  localStorage.setItem(STORE, JSON.stringify(next));
  return next;
}

export function overall(g: Growth): number {
  return clamp(g.chat * 0.52 + g.play * 0.48, 0.04, 1);
}

/** Existing companions aren't newborns. Chat + affection seed the spoken branch. */
export function loadShape(): Growth {
  if (cache) return cache;
  const mem = loadMemory();
  const stored = read();
  const fromChat = clamp((mem.chat.length / 48) * 0.55 + mem.affection * 0.28, 0, 0.92);
  const floor = mem.chat.length > 2 ? 0.12 : 0.045;
  cache = persist({
    chat: Math.max(stored.chat, fromChat, floor * 0.7),
    play: Math.max(stored.play, floor * 0.55, mem.affection * 0.18),
  });
  return cache;
}

export function loadGrowth(): number {
  return overall(loadShape());
}

export function saveGrowth(g: number): number {
  const cur = loadShape();
  const v = clamp(g, 0.04, 1);
  const now = overall(cur);
  if (now < 0.001) {
    persist({ chat: v * 0.52, play: v * 0.48 });
    return v;
  }
  const k = v / now;
  persist({ chat: cur.chat * k, play: cur.play * k });
  return overall(loadShape());
}

export function bumpChat(delta: number): number {
  const s = loadShape();
  return overall(persist({ chat: s.chat + delta, play: s.play }));
}

export function bumpPlay(delta: number): number {
  const s = loadShape();
  return overall(persist({ chat: s.chat, play: s.play + delta }));
}

export function bumpGrowth(delta: number): number {
  bumpChat(delta * 0.5);
  return bumpPlay(delta * 0.5);
}

export function clearGrowth(): void {
  cache = null;
  localStorage.removeItem(STORE);
}

export function growthStage(g: number): string {
  if (g < 0.12) return "flicker";
  if (g < 0.28) return "sprout";
  if (g < 0.52) return "forming";
  if (g < 0.78) return "itself";
  return "bloom";
}

export function growthLabel(g: number, shape?: Growth): string {
  const stage = growthStage(g);
  const s = shape ?? loadShape();
  if (s.chat > s.play + 0.12) return `${stage} · spoken`;
  if (s.play > s.chat + 0.12) return `${stage} · played`;
  return stage;
}
