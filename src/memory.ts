export type ChatLine = {
  role: "you" | "dimple";
  text: string;
  at: number;
};

export type DimpleMemory = {
  companion: string;
  facts: string[];
  chat: ChatLine[];
};

const STORE = "raymarch_dimple_memory";
const COMPANION = "raymarch_companion";
const MAX_CHAT = 80;
const MAX_FACTS = 40;

export function emptyMemory(): DimpleMemory {
  return { companion: "", facts: [], chat: [] };
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
} {
  const mem = loadMemory();
  return {
    who: mem.companion || "visitor",
    facts: mem.facts.slice(-16),
    recent: mem.chat.slice(-10).map((l) => ({ role: l.role, text: l.text })),
  };
}
