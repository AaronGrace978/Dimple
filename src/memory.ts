export type ChatLine = {
  role: "you" | "dimple";
  text: string;
  at: number;
};

export type DimpleMemory = {
  companion: string;
  facts: string[];
  chat: ChatLine[];
  affection: number;
  lastSeen: number;
};

const STORE = "raymarch_dimple_memory";
const COMPANION = "raymarch_companion";
const MAX_CHAT = 80;
const MAX_FACTS = 40;

export function emptyMemory(): DimpleMemory {
  return { companion: "", facts: [], chat: [], affection: 0, lastSeen: 0 };
}

export function loadMemory(): DimpleMemory {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return emptyMemory();
    const parsed = JSON.parse(raw) as Partial<DimpleMemory>;
    return {
      companion: typeof parsed.companion === "string" ? parsed.companion : "",
      facts: Array.isArray(parsed.facts)
        ? parsed.facts.filter((f): f is string => typeof f === "string").slice(-MAX_FACTS)
        : [],
      chat: Array.isArray(parsed.chat)
        ? parsed.chat
            .filter(
              (l): l is ChatLine =>
                !!l &&
                (l.role === "you" || l.role === "dimple") &&
                typeof l.text === "string",
            )
            .slice(-MAX_CHAT)
        : [],
      affection: clamp01(typeof parsed.affection === "number" ? parsed.affection : 0),
      lastSeen: typeof parsed.lastSeen === "number" ? parsed.lastSeen : 0,
    };
  } catch {
    return emptyMemory();
  }
}

function save(mem: DimpleMemory): DimpleMemory {
  const next: DimpleMemory = {
    companion: mem.companion.trim().slice(0, 40),
    facts: mem.facts.slice(-MAX_FACTS),
    chat: mem.chat.slice(-MAX_CHAT),
    affection: clamp01(mem.affection),
    lastSeen: mem.lastSeen || 0,
  };
  localStorage.setItem(STORE, JSON.stringify(next));
  if (next.companion) localStorage.setItem(COMPANION, next.companion);
  return next;
}

export function loadCompanion(): string {
  const mem = loadMemory();
  if (mem.companion) return mem.companion;
  return localStorage.getItem(COMPANION) ?? "";
}

export function setCompanion(name: string): DimpleMemory {
  const mem = loadMemory();
  mem.companion = name.trim().slice(0, 40);
  return save(mem);
}

export function addFact(fact: string): DimpleMemory {
  const text = fact.trim().slice(0, 160);
  if (!text) return loadMemory();
  const mem = loadMemory();
  if (mem.facts.some((f) => f.toLowerCase() === text.toLowerCase())) return mem;
  mem.facts.push(text);
  return save(mem);
}

export function appendChat(role: ChatLine["role"], text: string): DimpleMemory {
  const line = text.trim();
  if (!line) return loadMemory();
  const mem = loadMemory();
  const last = mem.chat[mem.chat.length - 1];
  if (last && last.role === role && last.text === line) return mem;
  mem.chat.push({ role, text: line.slice(0, 400), at: Date.now() });
  return save(mem);
}

export function clearMemory(): DimpleMemory {
  localStorage.removeItem(STORE);
  localStorage.removeItem(COMPANION);
  return save(emptyMemory());
}

export function maybeLearnName(text: string): string | null {
  const m = text.match(
    /(?:i(?:['’]m| am)|call me|my name is)\s+([a-z][a-z0-9 ._-]{1,32})/i,
  );
  if (!m?.[1]) return null;
  const name = m[1].replace(/[.,!?]+$/g, "").trim();
  if (!name) return null;
  setCompanion(name);
  addFact(`buddy's name is ${name}`);
  return name;
}

export function memoryPacket(): {
  who: string;
  facts: string[];
  recent: { role: string; text: string }[];
  affection: number;
} {
  const mem = loadMemory();
  return {
    who: mem.companion || "visitor",
    facts: mem.facts.slice(-16),
    recent: mem.chat.slice(-10).map((l) => ({ role: l.role, text: l.text })),
    affection: mem.affection,
  };
}

export function bumpAffection(delta: number): number {
  const mem = loadMemory();
  mem.affection = clamp01((mem.affection || 0) + delta);
  save(mem);
  return mem.affection;
}

/** Hours since Dimple last saw you. Updates lastSeen. */
export function markSeen(): { hoursAway: number; affection: number } {
  const mem = loadMemory();
  const prev = mem.lastSeen || 0;
  const hoursAway = prev > 0 ? Math.max(0, (Date.now() - prev) / 3_600_000) : 0;
  if (hoursAway > 0.5) {
    mem.affection = clamp01(mem.affection * Math.exp(-hoursAway * 0.04));
  }
  mem.lastSeen = Date.now();
  save(mem);
  return { hoursAway, affection: mem.affection };
}

export function touchSeen(): void {
  const mem = loadMemory();
  mem.lastSeen = Date.now();
  save(mem);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
