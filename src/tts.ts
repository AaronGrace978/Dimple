const KEY = "raymarch_eleven_key";
const VOICE = "raymarch_eleven_voice";
const MODEL = "raymarch_eleven_model";
const ENGINE = "raymarch_tts_engine";
const ENABLED = "raymarch_tts_on";
const FIELD = "raymarch_tts_field";

export type TtsEngine = "browser" | "elevenlabs";

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

let currentAudio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;

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

export function ttsEngine(): TtsEngine {
  return localStorage.getItem(ENGINE) === "elevenlabs" ? "elevenlabs" : "browser";
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
  speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
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

export async function speak(text: string): Promise<void> {
  const line = text.trim();
  if (!line || !ttsEnabled()) return;
  stopSpeak();

  if (ttsEngine() === "elevenlabs" && elevenKey()) {
    try {
      await speakEleven(line);
      return;
    } catch {
      // fall through to browser voice
    }
  }
  speakBrowser(line);
}

function speakBrowser(text: string): void {
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.96;
  utter.pitch = 1.05;
  const voices = speechSynthesis.getVoices();
  const soft = voices.find((v) => /natural|neural|aria|jenny|samantha|google/i.test(v.name));
  if (soft) utter.voice = soft;
  speechSynthesis.speak(utter);
}

async function speakEleven(text: string): Promise<void> {
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
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
    },
  );
  if (!res.ok) throw new Error("elevenlabs failed");
  const blob = await res.blob();
  objectUrl = URL.createObjectURL(blob);
  currentAudio = new Audio(objectUrl);
  currentAudio.onended = () => stopSpeak();
  await currentAudio.play();
}
