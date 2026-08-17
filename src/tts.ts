import { playBytes, speechGeneration, stopPcm, unlockAudio } from "./audio";
import { shapeLine, voiceForMood } from "./moodVoice";
import { isSteamDeck } from "./quality";
import { speakLocal } from "./voice";

const KEY = "raymarch_eleven_key";
const VOICE = "raymarch_eleven_voice";
const MODEL = "raymarch_eleven_model";
const ENGINE = "raymarch_tts_engine";
const ENABLED = "raymarch_tts_on";
const FIELD = "raymarch_tts_field";

export type TtsEngine = "local" | "browser" | "elevenlabs";

export const ELEVEN_MODELS = [
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
  "eleven_multilingual_v2",
  "eleven_v3",
] as const;

const FALLBACK_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
];

export function ttsEnabled(): boolean {
  return localStorage.getItem(ENABLED) !== "0";
}

export function setTtsEnabled(on: boolean): void {
  localStorage.setItem(ENABLED, on ? "1" : "0");
  if (!on) stopSpeak();
}

export function ttsFieldLines(): boolean {
  return localStorage.getItem(FIELD) === "1";
}

export function setTtsFieldLines(on: boolean): void {
  localStorage.setItem(FIELD, on ? "1" : "0");
}

export function parseTtsEngine(value: string): TtsEngine {
  if (value === "elevenlabs" || value === "browser" || value === "local") return value;
  return "local";
}

export function ttsEngine(): TtsEngine {
  const v = localStorage.getItem(ENGINE);
  if (v === "elevenlabs") return "elevenlabs";
  if (v === "browser") return isSteamDeck() ? "local" : "browser";
  return "local";
}

export function setTtsEngine(engine: TtsEngine): void {
  localStorage.setItem(ENGINE, engine);
}

export function elevenKey(): string {
  return localStorage.getItem(KEY) ?? "";
}

export function setElevenKey(value: string): void {
  const v = value.trim();
  if (v) localStorage.setItem(KEY, v);
  else localStorage.removeItem(KEY);
}

export function elevenVoice(): string {
  return localStorage.getItem(VOICE) ?? FALLBACK_VOICES[0]!.id;
}

export function setElevenVoice(id: string): void {
  localStorage.setItem(VOICE, id);
}

export function elevenModel(): string {
  return localStorage.getItem(MODEL) ?? "eleven_flash_v2_5";
}

export function setElevenModel(id: string): void {
  localStorage.setItem(MODEL, id);
}

export function stopSpeak(): void {
  try {
    speechSynthesis.cancel();
  } catch {
    /* no browser voices */
  }
  stopPcm();
}

export async function listElevenVoices(key = elevenKey()): Promise<{ id: string; name: string }[]> {
  if (!key) return FALLBACK_VOICES;
  try {
    const res = await fetch("/p/elevenlabs/v1/voices", {
      headers: { "xi-api-key": key },
    });
    if (!res.ok) return FALLBACK_VOICES;
    const data = (await res.json()) as { voices?: { voice_id?: string; name?: string }[] };
    const live = (data.voices ?? [])
      .map((v) => ({ id: v.voice_id ?? "", name: v.name ?? "voice" }))
      .filter((v) => v.id);
    return live.length ? live : FALLBACK_VOICES;
  } catch {
    return FALLBACK_VOICES;
  }
}

function stillThisUtterance(gen: number): boolean {
  return ttsEnabled() && gen === speechGeneration();
}

export async function speak(text: string, mood = "wander"): Promise<void> {
  const line = shapeLine(text, mood);
  if (!line || !ttsEnabled()) return;
  stopSpeak();
  const gen = speechGeneration();
  await unlockAudio();
  if (!stillThisUtterance(gen)) return;
  const shape = voiceForMood(mood);

  const engine = ttsEngine();
  if (engine === "elevenlabs" && elevenKey()) {
    try {
      await speakEleven(line, shape, gen);
      return;
    } catch {
      /* Deck / missing key / network — fall through */
    }
  }
  if (!stillThisUtterance(gen)) return;
  if (engine !== "browser") {
    try {
      await speakLocal(line, { speed: shape.speed, pitch: shape.pitch, warmth: shape.warmth });
      return;
    } catch {
      /* fall through */
    }
  }
  if (!stillThisUtterance(gen)) return;
  if (speakBrowser(line, shape)) return;
  try {
    await speakLocal(line, { speed: shape.speed, pitch: shape.pitch, warmth: shape.warmth });
  } catch {
    /* nowhere left to speak */
  }
}

function speakBrowser(text: string, shape = voiceForMood("wander")): boolean {
  try {
    const voices = speechSynthesis.getVoices();
    if (!voices.length && isSteamDeck()) return false;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = shape.speed;
    utter.pitch = shape.pitch;
    const soft = voices.find((v) => /natural|neural|aria|jenny|samantha|google/i.test(v.name));
    if (soft) utter.voice = soft;
    speechSynthesis.speak(utter);
    return true;
  } catch {
    return false;
  }
}

async function speakEleven(
  text: string,
  shape = voiceForMood("wander"),
  gen = speechGeneration(),
): Promise<void> {
  const res = await fetch(
    `/p/elevenlabs/v1/text-to-speech/${encodeURIComponent(elevenVoice())}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": elevenKey(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: elevenModel(),
        voice_settings: {
          stability: 0.28 + shape.warmth * 0.4,
          similarity_boost: 0.7,
          style: shape.speed > 1.1 ? 0.35 : 0.12,
        },
      }),
    },
  );
  if (!res.ok) throw new Error("elevenlabs failed");
  if (!stillThisUtterance(gen)) return;
  await playBytes(await res.arrayBuffer());
}
