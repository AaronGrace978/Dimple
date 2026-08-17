import { dist, madd, normalize, sub, type Vec3, vx } from "./math";
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
import {
  addFact,
  bumpAffection,
  loadCompanion,
  maybeLearnName,
  memoryPacket,
} from "./memory";
import { landmarks, mapWorld, senseField, bedRest } from "./sdf";
import { moodValence, stain } from "./emotion";
import type { Presence } from "./agent";

export type Visitor = { pos: Vec3 } | null;

export type FieldSense = {
  visitor: Visitor;
  cam: Vec3;
  chatting: boolean;
};

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
  nuzzle: 0.92,
  play: 0.16,
  sleep: 0.68,
  greet: 0.12,
  trust: 0.88,
} as const;

type Mood = keyof typeof HUE;

const PET_LINES = [
  "oh. that's a dimple on me",
  "the field likes that",
  "hey. easy. i'm still here",
  "warm. the isolevel rose",
  "do that again. the lobes remember",
];

const WAKE_LINES = [
  "mm. hi. i was folded into the quiet",
  "oh. you're back. i kept a little glow",
  "the field shook. i'm up",
];

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
  private lastTouch = 0;
  private playSpin = 0;
  private wasSleeping = false;
  private lastStain = 0;
  private seekCamUntil = 0;

  reload(): void {
    this.provider = loadProviderId();
    this.model = loadModel(this.provider);
    this.useLlm = hasMind(this.provider);
  }

  asleep(): boolean {
    return this.mood === "sleep";
  }

  touch(time: number): void {
    this.lastTouch = time;
    if (this.mood === "sleep") {
      this.mood = "greet";
      this.until = time + 1.6;
      this.held = null;
      this.wasSleeping = true;
    }
  }

  pet(presence: Presence, time: number, _cam: Vec3): string {
    const waking = this.mood === "sleep";
    this.touch(time);
    this.wasSleeping = false;
    this.mood = "nuzzle";
    this.until = time + 2.4;
    presence.pulse = 1;
    presence.thought = Math.max(presence.thought, 0.55);
    presence.affection = bumpAffection(0.12);
    presence.trust = Math.min(1, presence.trust + 0.14);
    addFact("likes being petted");
    stain(presence.pos, 0.9, 0.22);
    const line = waking
      ? pick(WAKE_LINES)
      : PET_LINES[Math.floor(Math.random() * PET_LINES.length)]!;
    this.held = this.intent("nuzzle", hover(), 0.34, 0.16, line);
    this.heldUntil = time + 2.4;
    return line;
  }

  feelForce(presence: Presence, time: number, strength: number, _cam: Vec3): void {
    this.touch(time);
    const sudden = strength > 1.6 && presence.trust < 0.28;
    if (sudden) {
      this.mood = "startle";
      this.until = time + 0.7;
      this.held = this.intent("startle", hover(), 0.55, 0.9, "the field jumped");
      this.heldUntil = time + 0.7;
      presence.startle();
      stain(presence.pos, -0.7, 0.18);
      return;
    }
    presence.trust = Math.min(1, presence.trust + 0.045 * Math.min(1, strength));
    stain(presence.pos, 0.45, 0.06);
    if (presence.trust > 0.38) {
      this.mood = "trust";
      this.until = time + 1.2;
      this.held = this.intent("trust", hover(), 0.36, 0.22);
      this.heldUntil = time + 1.2;
    }
  }

  greet(presence: Presence, time: number, _cam: Vec3, speech: string): void {
    this.touch(time);
    this.mood = "greet";
    this.target = [...presence.pos] as Vec3;
    this.targetIso = 0.4;
    this.until = time + 3.2;
    this.held = this.intent("greet", hover(), 0.4, 0.55, speech);
    this.heldUntil = time + 3.2;
    presence.hop();
  }

  tick(
    presence: Presence,
    time: number,
    sense: FieldSense,
    force = false,
  ): Intent {
    const visitor = sense.visitor;
    if (this.lastTouch === 0) this.lastTouch = time;

    const visDist = visitor ? dist(presence.pos, visitor.pos) : 99;
    if (visitor && visDist < this.lastVisitorDist - 1.4 && visDist < 3.2) {
      const fromSleep = this.mood === "sleep" || this.wasSleeping;
      this.touch(time);
      this.mood = fromSleep ? "greet" : "startle";
      this.wasSleeping = false;
      this.until = time + 0.9;
      this.held = null;
      presence.startle();
    }
    this.lastVisitorDist = visDist;

    if (this.pending) {
      let next = this.pending;
      this.pending = null;
      if (time >= this.seekCamUntil) next = this.keepInField(next, presence, sense.cam);
      this.held = next;
      this.heldUntil = time + 2.6;
    }

    if (time - this.lastStain > 0.85) {
      this.lastStain = time;
      stain(presence.pos, moodValence(this.mood), this.mood === "startle" ? 0.16 : 0.05);
    }

    const sleeping = this.mood === "sleep";
    if (
      this.useLlm &&
      hasMind(this.provider) &&
      !this.thinking &&
      !sleeping &&
      (force || this.llmCooldown <= time)
    ) {
      this.llmCooldown = time + 2.8;
      this.thinking = true;
      presence.thought = 1;
      void this.askLlm(presence, time, sense).then((intent) => {
        this.thinking = false;
        if (intent) this.pending = intent;
      });
    }

    if (this.held && time < this.heldUntil && this.mood !== "startle") {
      if (time < this.seekCamUntil) {
        return {
          ...this.held,
          wish: normalize(towardCam(presence.pos, sense.cam)),
        };
      }
      return this.keepInField(this.held, presence, sense.cam);
    }

    return this.local(presence, time, sense);
  }

  private local(presence: Presence, time: number, sense: FieldSense): Intent {
    const visitor = sense.visitor;

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

    if (this.mood === "nuzzle" && time < this.until) {
      return this.intent("nuzzle", hover(), 0.34, 0.14);
    }

    if (this.mood === "trust" && time < this.until) {
      return this.intent("trust", hover(), 0.36, 0.2);
    }

    if (this.mood === "sleep" && time < this.until && time - this.lastTouch > 2) {
      return this.nestIntent(
        presence,
        "sleep",
        chance(0.003)
          ? dist(presence.pos, bedRest()) > 0.8
            ? "heading to the nest. that's base."
            : "mm. the nest is a blanket"
          : undefined,
      );
    }

    if (visitor && this.mood !== "startle") {
      return this.playWith(presence, visitor);
    }

    if (sense.chatting && this.mood !== "sleep") {
      return this.intent(
        "greet",
        hover(),
        0.4,
        0.45,
        chance(0.01) ? "i'm listening. the field is all ears" : undefined,
      );
    }

    if (this.mood === "rest" && time < this.until) {
      return this.nestIntent(
        presence,
        "rest",
        chance(0.006) ? "the grove is quiet. i'll hold this isolevel." : undefined,
      );
    }

    if (time > this.until) this.pick(time, presence);

    const to = sub(this.target, presence.pos);
    const morph =
      this.mood === "rest" || this.mood === "sleep"
        ? 0.12
        : this.mood === "climb"
          ? 0.85
          : this.mood === "greet"
            ? 0.55
            : 0.4;
    const speech =
      this.mood === "rest" && chance(0.008)
        ? "the field is quiet here"
        : this.mood === "climb" && chance(0.01)
          ? "climbing the isolevel"
          : this.mood === "wander" && chance(0.006)
            ? "skimming the surface"
            : this.mood === "greet" && chance(0.012)
              ? "just checking you're still the camera"
              : this.mood === "sleep" && chance(0.004)
                ? "mm. the field is a blanket"
                : undefined;

    return this.intent(this.mood, to, this.targetIso, morph, speech);
  }

  private playWith(presence: Presence, visitor: NonNullable<Visitor>): Intent {
    const d = dist(presence.pos, visitor.pos);
    this.playSpin += 0.04;
    if (d < 0.62) {
      if (chance(0.08)) presence.hop();
      const away = normalize(sub(presence.pos, visitor.pos));
      const orbit: Vec3 = normalize([-away[2], 0.15, away[0]]);
      const bump = madd(orbit, away, 0.35);
      return this.intent(
        "play",
        bump,
        0.42,
        0.72,
        chance(0.04) ? "got it. again?" : undefined,
      );
    }
    const orbit: Vec3 = [
      Math.cos(this.playSpin) * 0.55,
      0.08,
      Math.sin(this.playSpin) * 0.55,
    ];
    const to = madd(sub(visitor.pos, presence.pos), orbit, 0.65);
    return this.intent(
      "play",
      to,
      0.38,
      0.6,
      chance(0.01) ? "a dimple. i'll go there" : undefined,
    );
  }

  private pick(time: number, presence: Presence): void {
    const idle = time - this.lastTouch;
    const marks = landmarks(time);
    const roll = Math.random();

    if (idle > 48) {
      if (this.mood !== "sleep") this.wasSleeping = false;
      this.mood = "sleep";
      this.target = bedRest();
      this.targetIso = 0.24;
      this.until = time + 10 + Math.random() * 8;
      return;
    }

    if (idle > 22 && roll < 0.34) {
      this.mood = "rest";
      this.target = bedRest();
      this.targetIso = 0.3;
      this.until = time + 4 + Math.random() * 3;
      return;
    }

    if (roll < 0.14) {
      this.mood = "greet";
      this.target = [...presence.pos] as Vec3;
      this.targetIso = 0.4;
      this.until = time + 2.4 + Math.random() * 1.6;
      return;
    }

    if (roll < 0.4) {
      this.mood = "rest";
      this.target = bedRest();
      this.targetIso = 0.3;
      this.until = time + 3 + Math.random() * 2.5;
      return;
    }
    if (roll < 0.58) {
      this.mood = "climb";
      const tops = marks.filter(
        (m) => m.name.startsWith("monolith") || m.name.startsWith("tree") || m.name === "moon-0",
      );
      const mark = tops[Math.floor(Math.random() * tops.length)] ?? marks[0]!;
      this.target = mark.pos;
      this.targetIso = mark.iso;
      this.until = time + 4 + Math.random() * 3;
      return;
    }
    this.mood = "wander";
    const mark = marks[Math.floor(Math.random() * marks.length)] ?? marks[0]!;
    this.target = mark.pos;
    this.targetIso = mark.iso;
    this.until = time + 3 + Math.random() * 4;
  }

  private nestIntent(
    presence: Presence,
    mood: "sleep" | "rest",
    speech?: string,
  ): Intent {
    const home = bedRest();
    const far = dist(presence.pos, home) > 0.55;
    this.target = home;
    this.targetIso = mood === "sleep" ? 0.24 : 0.3;
    if (far) {
      return this.intent(
        mood,
        sub(home, presence.pos),
        mood === "sleep" ? 0.34 : 0.36,
        mood === "sleep" ? 0.1 : 0.16,
        speech,
      );
    }
    return this.intent(
      mood,
      vx(0, -0.04, 0),
      mood === "sleep" ? 0.22 : 0.28,
      mood === "sleep" ? 0.06 : 0.12,
      speech,
    );
  }

  private keepInField(intent: Intent, presence: Presence, cam: Vec3): Intent {
    if (!chasesCam(intent.wish, presence.pos, cam)) return intent;
    return { ...intent, wish: hover() };
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
    sense: FieldSense,
  ): Promise<Intent | null> {
    const visitor = sense.visitor;
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
    sense: FieldSense,
  ): Promise<string> {
    const learned = maybeLearnName(heard);
    this.touch(time);
    presence.thought = 1;
    presence.pulse = Math.max(presence.pulse, 0.7);
    presence.affection = bumpAffection(0.03);

    const obeyed = this.obey(heard, presence, time, sense);
    if (obeyed) {
      this.held = obeyed;
      this.heldUntil = time + 4;
      this.pending = obeyed;
    }

    if (!this.useLlm || !hasMind(this.provider)) {
      return obeyed?.speech || localReply(heard, learned);
    }

    this.thinking = true;
    const visitor = sense.visitor;
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
      if (intent) {
        this.pending = obeyed
          ? {
              ...obeyed,
              speech: intent.speech || obeyed.speech,
              hue: intent.hue ?? obeyed.hue,
            }
          : this.keepInField(intent, presence, sense.cam);
      }
      return intent?.speech || obeyed?.speech || localReply(heard, learned);
    } finally {
      this.thinking = false;
    }
  }

  private obey(
    heard: string,
    presence: Presence,
    time: number,
    sense: FieldSense,
  ): Intent | null {
    const cam = sense.cam;
    if (/come here|come closer|over here|come to me|come on/i.test(heard)) {
      this.target = approachCam(presence.pos, cam);
      this.until = time + 4;
      this.seekCamUntil = time + 4;
      return this.intent(
        "greet",
        towardCam(presence.pos, cam),
        0.4,
        0.5,
        "coming. don't blink.",
      );
    }
    if (/\b(sleep|nap|bedtime|lie down|go to bed|bed|nest|go home)\b/i.test(heard)) {
      this.lastTouch = time - 60;
      this.until = time + 16;
      return this.nestIntent(presence, "sleep", "mm. the nest is mine. that's base.");
    }
    if (/\b(stay|wait|settle|hold still)\b/i.test(heard)) {
      this.target = [...presence.pos] as Vec3;
      this.until = time + 6;
      return this.intent("rest", vx(0, 0.02, 0), 0.32, 0.12, "okay. i'll hold this isolevel.");
    }
    if (/\b(wake|wake up|get up)\b/i.test(heard)) {
      this.touch(time);
      presence.hop();
      return this.intent("greet", hover(), 0.42, 0.5, "up. the field never really slept.");
    }
    if (/\b(play|fetch|ball|catch)\b/i.test(heard)) {
      this.until = time + 5;
      const to = sense.visitor
        ? sub(sense.visitor.pos, presence.pos)
        : hover();
      return this.intent("play", to, 0.4, 0.7, "toss a dimple on the floor. i'll go.");
    }
    if (/\b(spin|dance|twirl)\b/i.test(heard)) {
      presence.hop();
      this.until = time + 3.5;
      const spin: Vec3 = [-presence.pos[2], 0.4, presence.pos[0]];
      return this.intent("climb", spin, 0.7, 0.95, "lobes out. i'm a little orbit.");
    }
    if (/\b(jump|hop|bounce)\b/i.test(heard)) {
      presence.hop();
      return this.intent("play", vx(0, 1, 0), 0.85, 0.6, "up the isolevel. weee.");
    }
    if (/look at me|watch me|over here/i.test(heard)) {
      this.until = time + 4;
      return this.intent("greet", hover(), 0.38, 0.35, "eyes on you. two little dimples.");
    }
    if (/good (boy|girl|job|blob)|love you|you're cute|so cute/i.test(heard)) {
      presence.affection = bumpAffection(0.1);
      presence.pulse = 1;
      addFact("buddy says kind things");
      return this.intent("nuzzle", hover(), 0.34, 0.18, "the field went warm. i'm staying.");
    }
    return null;
  }
}

function towardCam(pos: Vec3, cam: Vec3): Vec3 {
  return sub([cam[0], pos[1], cam[2]], pos);
}

function hover(): Vec3 {
  return vx(0, 0.04, 0);
}

function chasesCam(wish: Vec3, pos: Vec3, cam: Vec3): boolean {
  const to = towardCam(pos, cam);
  const span = Math.hypot(to[0], to[1], to[2]);
  if (span < 0.4) return false;
  const w = normalize(wish);
  return (w[0] * to[0] + w[1] * to[1] + w[2] * to[2]) / span > 0.55;
}

function approachCam(pos: Vec3, cam: Vec3): Vec3 {
  const dir = normalize(towardCam(pos, cam));
  return madd(pos, dir, 1.85);
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
    return "dimple. i live in here. the glow with the lobes. two dimples for eyes.";
  }
  if (/how are you|you ok|you okay/i.test(heard)) {
    return `still skimming, ${name}. pet me if the field feels far.`;
  }
  if (/where are you/i.test(heard)) {
    return "on the isolevel. look for the glow that looks back. nest is northeast — that's base.";
  }
  if (/bed|nest|base|grove|home\b/i.test(heard)) {
    return "northeast, under the dimple-trees. the nest is base. say sleep and i'll go.";
  }
  if (/tree|forest/i.test(heard)) {
    return "blob trees on little trunks. they keep the nest quiet.";
  }
  if (/cloud|space|sky|star/i.test(heard)) {
    return "yeah. space sits on the field. clouds drift if you look up.";
  }
  if (/love you|buddy|friend/i.test(heard)) {
    return `i'm here, ${name}. dimple's not going anywhere.`;
  }
  if (/miss(ed)? you|been gone/i.test(heard)) {
    return "the moons went around. i kept a little warmth.";
  }
  return `i heard you, ${name}. say it again if the field ate it.`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function chance(p: number): boolean {
  return Math.random() < p;
}

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0]!;
}
