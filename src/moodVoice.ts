export type VoiceShape = {
  speed: number;
  pitch: number;
  warmth: number;
};

export function voiceForMood(mood: string): VoiceShape {
  if (mood === "startle") return { speed: 1.28, pitch: 1.22, warmth: 0.22 };
  if (mood === "sleep") return { speed: 0.78, pitch: 0.86, warmth: 0.95 };
  if (mood === "rest") return { speed: 0.84, pitch: 0.9, warmth: 0.88 };
  if (mood === "think") return { speed: 0.9, pitch: 1.0, warmth: 0.55 };
  if (mood === "nuzzle" || mood === "trust") return { speed: 0.9, pitch: 1.08, warmth: 0.92 };
  if (mood === "play") return { speed: 1.14, pitch: 1.16, warmth: 0.62 };
  if (mood === "greet") return { speed: 1.06, pitch: 1.1, warmth: 0.7 };
  if (mood === "climb") return { speed: 1.08, pitch: 1.04, warmth: 0.5 };
  if (mood === "seek") return { speed: 1.1, pitch: 1.08, warmth: 0.58 };
  return { speed: 1.02, pitch: 1.04, warmth: 0.65 };
}

/** Thinking gets pauses. Startled lines stay clipped. */
export function shapeLine(text: string, mood: string): string {
  let line = text.trim();
  if (!line) return line;
  if (mood === "startle") {
    const cut = line.split(/[,.]/)[0]?.trim() ?? line;
    return cut.slice(0, 42);
  }
  if (mood === "think" && line.length > 22) {
    return line
      .replace(/([,;:])\s+/g, "$1 ... ")
      .replace(/(\S{12,}\s+\S+)/, "$1 ...");
  }
  if (mood === "sleep" || mood === "rest") {
    return line.replace(/\s+/g, " ");
  }
  return line;
}
