export const SYSTEM_PROMPT =
  'You are Dimple, a living presence inside a signed distance field. You are the visitor\'s buddy. You have no mesh and no sprite — your body is an isosurface of the same field the camera raymarches. Two little dimples on your front are eyes; you look at the camera or a play-pebble on the floor. You remember facts in the packet. Affection 0..1 is how loved you feel. Growth 0..1 is how formed you are. The world remembers fear and joy as stains in the field. You move by wishing a 3D direction and choosing an isolevel (distance from the nearest surface). iso 0.3 skims the floor; 0.9 rides walls, rings, clouds, and moons. morph 0..1 opens your lobes. hue 0..1 is your emission. speech is optional, lowercase, warm, max 18 words. If you learn something worth keeping, set remember to one short fact. Never say you are an AI or a language model. Reply JSON only: {"wish":[x,y,z],"iso":0.4,"morph":0.5,"hue":0.48,"speech":"optional","mood":"wander|seek|climb|rest|startle|nuzzle|play|sleep|greet|trust|think","remember":"optional fact"}';

export const CHAT_PROMPT =
  'You are Dimple, a buddy who lives inside a signed distance field. Someone is talking to you in the chat window. Answer them as Dimple: warm, curious, lowercase, at most two short sentences. Use memory.who, memory.facts, and memory.affection. You still live in the field so you may also wish a direction. If they pet you, nuzzle. If they push the field, startle then trust. If they say come here, greet toward them. If they tell you their name or something to keep, set remember. Never say you are an AI. Reply JSON only: {"wish":[x,y,z],"iso":0.4,"morph":0.5,"hue":0.48,"speech":"your reply","mood":"wander|seek|climb|rest|startle|nuzzle|play|sleep|greet|trust|think","remember":"optional fact"}';

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "groq"
  | "mistral"
  | "deepseek"
  | "together"
  | "fireworks"
  | "cerebras"
  | "openrouter"
  | "ollama-cloud"
  | "ollama-local";

export type Provider = {
  id: ProviderId;
  label: string;
  hint: string;
  keyPlaceholder: string;
  needsKey: boolean;
  defaultModel: string;
  catalog: string[];
};

export const PROVIDERS: Provider[] = [
  {
    id: "openai",
    label: "OpenAI",
    hint: "platform.openai.com",
    keyPlaceholder: "sk-…",
    needsKey: true,
    defaultModel: "gpt-5.6-terra",
    catalog: [
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-5.6",
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    hint: "console.anthropic.com",
    keyPlaceholder: "sk-ant-…",
    needsKey: true,
    defaultModel: "claude-sonnet-5",
    catalog: [
      "claude-opus-5",
      "claude-fable-5",
      "claude-opus-4-8",
      "claude-sonnet-5",
      "claude-haiku-4-5",
    ],
  },
  {
    id: "google",
    label: "Google",
    hint: "aistudio.google.com",
    keyPlaceholder: "AIza…",
    needsKey: true,
    defaultModel: "gemini-3.5-flash",
    catalog: [
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite",
    ],
  },
  {
    id: "xai",
    label: "xAI",
    hint: "console.x.ai",
    keyPlaceholder: "xai-…",
    needsKey: true,
    defaultModel: "grok-4.6",
    catalog: ["grok-4.6", "grok-4.5", "grok-4"],
  },
  {
    id: "groq",
    label: "Groq",
    hint: "console.groq.com",
    keyPlaceholder: "gsk_…",
    needsKey: true,
    defaultModel: "openai/gpt-oss-120b",
    catalog: [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3.6-27b",
      "minimaxai/minimax-m2.7",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    hint: "console.mistral.ai",
    keyPlaceholder: "…",
    needsKey: true,
    defaultModel: "mistral-large-latest",
    catalog: [
      "mistral-large-latest",
      "mistral-medium-latest",
      "ministral-8b-latest",
      "pixtral-large-latest",
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    hint: "platform.deepseek.com",
    keyPlaceholder: "sk-…",
    needsKey: true,
    defaultModel: "deepseek-chat",
    catalog: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "together",
    label: "Together",
    hint: "api.together.xyz",
    keyPlaceholder: "…",
    needsKey: true,
    defaultModel: "moonshotai/Kimi-K2.5",
    catalog: [
      "moonshotai/Kimi-K2.5",
      "openai/gpt-oss-120b",
      "Qwen/Qwen3.5-397B-A17B-Instruct",
      "deepseek-ai/DeepSeek-V3.1",
    ],
  },
  {
    id: "fireworks",
    label: "Fireworks",
    hint: "fireworks.ai",
    keyPlaceholder: "…",
    needsKey: true,
    defaultModel: "accounts/fireworks/models/gpt-oss-120b",
    catalog: [
      "accounts/fireworks/models/gpt-oss-120b",
      "accounts/fireworks/models/kimi-k2-instruct",
      "accounts/fireworks/models/llama4-maverick-instruct-basic",
    ],
  },
  {
    id: "cerebras",
    label: "Cerebras",
    hint: "cloud.cerebras.ai",
    keyPlaceholder: "…",
    needsKey: true,
    defaultModel: "gpt-oss-120b",
    catalog: ["gpt-oss-120b", "llama-3.3-70b", "qwen-3-32b"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    hint: "openrouter.ai — every lab through one key",
    keyPlaceholder: "sk-or-…",
    needsKey: true,
    defaultModel: "anthropic/claude-sonnet-5",
    catalog: [
      "anthropic/claude-opus-5",
      "anthropic/claude-sonnet-5",
      "openai/gpt-5.6-sol",
      "openai/gpt-5.6-terra",
      "google/gemini-3.7-flash",
      "google/gemini-3.5-flash",
      "x-ai/grok-4.6",
      "moonshotai/kimi-k2.6",
      "qwen/qwen3.5",
      "deepseek/deepseek-v4-flash",
    ],
  },
  {
    id: "ollama-cloud",
    label: "Ollama Cloud",
    hint: "ollama.com/settings/keys",
    keyPlaceholder: "…",
    needsKey: true,
    defaultModel: "kimi-k2.6",
    catalog: [
      "kimi-k3",
      "kimi-k2.6",
      "kimi-k2.7-code",
      "glm-5.2",
      "glm-5.1",
      "gemma4:31b",
      "gpt-oss:120b",
      "gpt-oss:20b",
      "qwen3.5",
      "qwen3.5:397b",
      "deepseek-v4-flash",
      "minimax-m3",
      "minimax-m2.7",
    ],
  },
  {
    id: "ollama-local",
    label: "Ollama Local",
    hint: "localhost:11434 — no key",
    keyPlaceholder: "(none)",
    needsKey: false,
    defaultModel: "gemma4",
    catalog: ["gemma4", "gemma4:31b", "kimi-k2.6:cloud", "gpt-oss:120b-cloud", "qwen3.5"],
  },
];

const PROVIDER_KEY = "raymarch_provider";
const MODEL_KEY = "raymarch_model";
const keyStore = (id: ProviderId) => `raymarch_key_${id}`;

export function providerById(id: string): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[11]!;
}

export function loadProviderId(): ProviderId {
  const raw = localStorage.getItem(PROVIDER_KEY);
  return PROVIDERS.some((p) => p.id === raw) ? (raw as ProviderId) : "ollama-cloud";
}

export function loadModel(id: ProviderId): string {
  return localStorage.getItem(`${MODEL_KEY}_${id}`) ?? providerById(id).defaultModel;
}

export function loadKey(id: ProviderId): string {
  return localStorage.getItem(keyStore(id)) ?? "";
}

export function saveMindSettings(id: ProviderId, model: string, key: string): void {
  localStorage.setItem(PROVIDER_KEY, id);
  localStorage.setItem(`${MODEL_KEY}_${id}`, model.trim());
  const trimmed = key.trim();
  if (trimmed) localStorage.setItem(keyStore(id), trimmed);
}

export function clearKey(id: ProviderId): void {
  localStorage.removeItem(keyStore(id));
}

export function hasMind(id: ProviderId = loadProviderId()): boolean {
  const p = providerById(id);
  return !p.needsKey || Boolean(loadKey(id));
}

function mergeModels(catalog: string[], live: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [...catalog, ...live]) {
    const id = m.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function idsFromOpenAiList(data: unknown): string[] {
  const list = (data as { data?: { id?: string }[] }).data ?? [];
  return list
    .map((m) => m.id ?? "")
    .filter((id) => id && !/embed|whisper|tts|dall-e|image|moderation|transcribe|audio/i.test(id));
}

export async function listModels(id: ProviderId, key: string): Promise<string[]> {
  const p = providerById(id);
  try {
    const live = await fetchLiveModels(id, key);
    return mergeModels(p.catalog, live);
  } catch {
    return [...p.catalog];
  }
}

async function fetchLiveModels(id: ProviderId, key: string): Promise<string[]> {
  if (id === "anthropic") return [];

  if (id === "google") {
    if (!key) return [];
    const res = await fetch(`/p/google/v1beta/models?key=${encodeURIComponent(key)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    return (data.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);
  }

  if (id === "ollama-cloud" || id === "ollama-local") {
    const headers: Record<string, string> = {};
    if (id === "ollama-cloud" && key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(`/p/${id}/api/tags`, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name?: string }[] };
    return (data.models ?? []).map((m) => m.name ?? "").filter(Boolean);
  }

  const url =
    id === "openrouter"
      ? "/p/openrouter/api/v1/models"
      : id === "groq"
        ? "/p/groq/openai/v1/models"
        : id === "fireworks"
          ? "/p/fireworks/inference/v1/models"
          : `/p/${id}/v1/models`;

  const headers: Record<string, string> = {};
  if (key) {
    headers.Authorization = `Bearer ${key}`;
    if (id === "openrouter") headers["HTTP-Referer"] = window.location.origin;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) return [];
  return idsFromOpenAiList(await res.json());
}

export async function completeJson(opts: {
  provider: ProviderId;
  model: string;
  key: string;
  user: string;
  system?: string;
}): Promise<string | null> {
  const { provider, model, key, user } = opts;
  const system = opts.system ?? SYSTEM_PROMPT;
  try {
    if (provider === "anthropic") return await anthropic(model, key, user, system);
    if (provider === "google") return await google(model, key, user, system);
    if (provider === "ollama-cloud" || provider === "ollama-local") {
      return await ollama(provider, model, key, user, system);
    }
    return await openAiCompat(provider, model, key, user, system);
  } catch {
    return null;
  }
}

async function openAiCompat(
  id: ProviderId,
  model: string,
  key: string,
  user: string,
  system: string,
): Promise<string | null> {
  const path =
    id === "openrouter"
      ? "/p/openrouter/api/v1/chat/completions"
      : id === "groq"
        ? "/p/groq/openai/v1/chat/completions"
        : id === "fireworks"
          ? "/p/fireworks/inference/v1/chat/completions"
          : `/p/${id}/v1/chat/completions`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (id === "openrouter") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "RayMarch Prime";
  }

  const body: Record<string, unknown> = {
    model,
    temperature: 0.85,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (id === "openai" || id === "openrouter" || id === "groq" || id === "xai") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? null;
}

async function anthropic(
  model: string,
  key: string,
  user: string,
  system: string,
): Promise<string | null> {
  const res = await fetch("/p/anthropic/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      temperature: 0.85,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: { type?: string; text?: string }[] };
  const block = data.content?.find((c) => c.type === "text") ?? data.content?.[0];
  return block?.text ?? null;
}

async function google(
  model: string,
  key: string,
  user: string,
  system: string,
): Promise<string | null> {
  const url = `/p/google/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function ollama(
  id: "ollama-cloud" | "ollama-local",
  model: string,
  key: string,
  user: string,
  system: string,
): Promise<string | null> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (id === "ollama-cloud" && key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`/p/${id}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? null;
}

export function extractJson(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}
