import { dist, normalize, sub, type Vec3, vx } from "./math";
import {
  CHAT_PROMPT,
  completeJson,
  extractJson,
  hasMind,
  loadKey,
  loadModel,
  loadProviderId,
  type ProviderId,
} from "./providers";
import { addFact, loadCompanion, maybeLearnName, memoryPacket } from "./memory";
import { landmarks, mapWorld, senseField } from "./sdf";
import type { Presence } from "./agent";

export type Visitor = { pos: Vec3 } | null;

export type Intent = {
  wish: Vec3;
  iso: number;
  morph: number;
  hue?: number;
  speech?: string;
  mood?: string;
};

const HUE = {
  wander: 0.48,
  seek: 0.09,
  climb: 0.73,
  rest: 0.58,
  startle: 0.02,
  think: 0.62,
} as const;

type Mood = keyof typeof HUE;

export class Mind {
  useLlm = true;
  thinking = false;
  provider: ProviderId = loadProviderId();
  model = loadModel(loadProviderId());
  private until = 0;
  private mood: Mood = "wander";
  private target: Vec3 = vx(0, 0.5, 0);
  private targetIso = 0.42;
  private lastVisitorDist = 99;
  private llmCooldown = 0;
  private pending: Intent | null = null;
  private held: Intent | null = null;
  private heldUntil = 0;

  reload(): void {
    this.provider = loadProviderId();
    this.model = loadModel(this.provider);
    this.useLlm = hasMind(this.provider);
  }

  tick(
    presence: Presence,
    time: number,
    visitor: Visitor,
    force = false,
  ): Intent {
    const visDist = visitor ? dist(presence.pos, visitor.pos) : 99;
    if (visitor && visDist < this.lastVisitorDist - 1.4 && visDist < 3.2) {
      this.mood = "startle";
      this.until = time + 0.9;
      this.held = null;
      presence.startle();
    }
    this.lastVisitorDist = visDist;

    if (this.pending) {
      this.held = this.pending;
      this.pending = null;
      this.heldUntil = time + 2.6;
    }

    if (
      this.useLlm &&
      hasMind(this.provider) &&
      !this.thinking &&
      (force || this.llmCooldown <= time)
    ) {
      this.llmCooldown = time + 2.8;
      this.thinking = true;
      presence.thought = 1;
      void this.askLlm(presence, time, visitor).then((intent) => {
        this.thinking = false;
        if (intent) this.pending = intent;
      });
    }

    if (this.held && time < this.heldUntil && this.mood !== "startle") {
      return this.held;
    }

    return this.local(presence, time, visitor);
  }

  private local(presence: Presence, time: number, visitor: Visitor): Intent {
    if (this.mood === "startle" && time < this.until) {
      const away = visitor
        ? sub(presence.pos, visitor.pos)
        : vx(presence.vel[0], 0.2, presence.vel[2]);
      return this.intent(
        "startle",
        away,
        0.62,
        0.95,
        this.until - time > 0.75 ? "the field jumped" : undefined,
      );
    }

    if (visitor && this.mood !== "startle") {
      const d = dist(presence.pos, visitor.pos);
      if (d < 0.7) {
        const away = normalize(sub(presence.pos, visitor.pos));
        const orbit: Vec3 = normalize([-away[2], 0.1, away[0]]);
        return this.intent(
          "seek",
          orbit,
          0.4,
          0.7,
          chance(0.015) ? "you pressed the field" : undefined,
        );
      }
      return this.intent(
        "seek",
        sub(visitor.pos, presence.pos),
        0.38,
        0.55,
        chance(0.012) ? "a dimple. i'll go there" : undefined,
      );
    }

    if (time > this.until) this.pick(time, presence);

    const to = sub(this.target, presence.pos);
    const morph = this.mood === "rest" ? 0.15 : this.mood === "climb" ? 0.85 : 0.4;
    const speech =
      this.mood === "rest" && chance(0.008)
        ? "the field is quiet here"
        : this.mood === "climb" && chance(0.01)
          ? "climbing the isolevel"
          : this.mood === "wander" && chance(0.006)
            ? "skimming the surface"
            : undefined;

    return this.intent(this.mood, to, this.targetIso, morph, speech);
  }

  private pick(time: number, presence: Presence): void {
    const marks = landmarks(time);
    const roll = Math.random();
    if (roll < 0.18) {
      this.mood = "rest";
      this.target = [...presence.pos] as Vec3;
      this.targetIso = 0.34;
      this.until = time + 2.5 + Math.random() * 2;
      return;
    }
    if (roll < 0.38) {
      this.mood = "climb";
      const tops = marks.filter((m) => m.name.startsWith("monolith") || m.name === "moon-0");
      const pick = tops[Math.floor(Math.random() * tops.length)] ?? marks[0]!;
      this.target = pick.pos;
      this.targetIso = pick.iso;
      this.until = time + 4 + Math.random() * 3;
      return;
    }
    this.mood = "wander";
    const pick = marks[Math.floor(Math.random() * marks.length)] ?? marks[0]!;
    this.target = pick.pos;
    this.targetIso = pick.iso;
    this.until = time + 3 + Math.random() * 4;
  }

  private intent(
    mood: Mood,
    wish: Vec3,
    iso: number,
    morph: number,
    speech?: string,
  ): Intent {
    this.mood = mood;
    return {
      wish: normalize(wish),
      iso,
      morph,
      hue: HUE[mood],
      mood,
      speech,
    };
  }

  private async askLlm(
    presence: Presence,
    time: number,
    visitor: Visitor,
  ): Promise<Intent | null> {
    const probes = senseField(presence.pos, time).map((p) => ({
      dir: p.dir.map((n) => round(n)),
      dist: round(p.dist),
      hit: p.hit,
    }));
    const packet = {
      who: "Dimple",
      buddy: loadCompanion() || "visitor",
      memory: memoryPacket(),
      pos: presence.pos.map(round),
      vel: presence.vel.map(round),
      iso: round(presence.iso),
      field: round(mapWorld(presence.pos, time)),
      mood: presence.mood,
      visitor: visitor
        ? { pos: visitor.pos.map(round), dist: round(dist(presence.pos, visitor.pos)) }
        : null,
      probes,
    };

    const raw = await completeJson({
      provider: this.provider,
      model: this.model,
      key: loadKey(this.provider),
      user: JSON.stringify(packet),
    });
    if (!raw) return null;
    return parseIntent(extractJson(raw));
  }

  async converse(
    heard: string,
    presence: Presence,
    time: number,
    visitor: Visitor,
  ): Promise<string> {
    const learned = maybeLearnName(heard);
    presence.thought = 1;
    presence.pulse = Math.max(presence.pulse, 0.7);

    if (!this.useLlm || !hasMind(this.provider)) {
      return localReply(heard, learned);
    }

    this.thinking = true;
    const probes = senseField(presence.pos, time).map((p) => ({
      dir: p.dir.map((n) => round(n)),
      dist: round(p.dist),
      hit: p.hit,
    }));
    const packet = {
      who: "Dimple",
      buddy: loadCompanion() || "visitor",
      memory: memoryPacket(),
      heard,
      pos: presence.pos.map(round),
      vel: presence.vel.map(round),
      iso: round(presence.iso),
      field: round(mapWorld(presence.pos, time)),
      mood: presence.mood,
      visitor: visitor
        ? { pos: visitor.pos.map(round), dist: round(dist(presence.pos, visitor.pos)) }
        : null,
      probes,
    };

    try {
      const raw = await completeJson({
        provider: this.provider,
        model: this.model,
        key: loadKey(this.provider),
        user: JSON.stringify(packet),
        system: CHAT_PROMPT,
      });
      const intent = raw ? parseIntent(extractJson(raw)) : null;
      if (intent) this.pending = intent;
      return intent?.speech || localReply(heard, learned);
    } finally {
      this.thinking = false;
    }
  }
}

function parseIntent(raw: string): Intent | null {
  try {
    const j = JSON.parse(raw) as {
      wish?: unknown;
      iso?: unknown;
      morph?: unknown;
      hue?: unknown;
      speech?: unknown;
      mood?: unknown;
      remember?: unknown;
    };
    const w = j.wish;
    const wish: Vec3 =
      Array.isArray(w) && w.length >= 3
        ? [Number(w[0]) || 0, Number(w[1]) || 0, Number(w[2]) || 0]
        : [0, 0.15, 0];
    if (typeof j.remember === "string") addFact(j.remember);
    return {
      wish: normalize(wish),
      iso: Number(j.iso) || 0.42,
      morph: Number(j.morph) || 0.4,
      hue: typeof j.hue === "number" ? j.hue : undefined,
      speech: typeof j.speech === "string" ? j.speech.slice(0, 180) : undefined,
      mood: typeof j.mood === "string" ? j.mood : undefined,
    };
  } catch {
    return null;
  }
}

function localReply(heard: string, learned: string | null): string {
  const who = learned || loadCompanion();
  const name = who || "you";
  if (learned) return `okay. i'll call you ${learned}. i'm dimple.`;
  if (/hello|hey|hi\b|yo\b/i.test(heard)) {
    return `hey ${name}. i'm dimple. the field's holding.`;
  }
  if (/who are you|your name/i.test(heard)) {
    return "dimple. i live in here. the glow with the lobes.";
  }
  if (/cloud|space|sky|star/i.test(heard)) {
    return "yeah. space sits on the field. clouds drift if you look up.";
  }
  if (/love you|buddy|friend/i.test(heard)) {
    return `i'm here, ${name}. dimple's not going anywhere.`;
  }
  return `i heard you, ${name}. say it again if the field ate it.`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function chance(p: number): boolean {
  return Math.random() < p;
}
