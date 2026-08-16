import {
  clamp,
  copy,
  dist,
  dot,
  len,
  madd,
  normalize,
  scale,
  sub,
  type Vec3,
  vx,
} from "./math";
import { gradWorld, mapWorld } from "./sdf";

export type PresenceState = {
  pos: Vec3;
  vel: Vec3;
  iso: number;
  morph: number;
  hue: number;
  pulse: number;
  thought: number;
  mood: string;
  speech: string;
  trail0: Vec3;
  trail1: Vec3;
  trail2: Vec3;
  trailW: Vec3;
};

export class Presence {
  pos: Vec3 = vx(0.4, 0.5, 1.2);
  vel: Vec3 = vx();
  iso = 0.42;
  morph = 0.35;
  hue = 0.48;
  pulse = 0;
  thought = 0;
  mood = "awake";
  speech = "";
  wish: Vec3 = vx();
  targetIso = 0.42;
  targetMorph = 0.35;
  targetHue = 0.48;
  private trails: Vec3[] = [copy(this.pos), copy(this.pos), copy(this.pos)];
  private trailClock = 0;
  private speechClock = 0;

  applyIntent(intent: {
    wish: Vec3;
    iso: number;
    morph: number;
    hue?: number;
    speech?: string;
    mood?: string;
  }): void {
    this.wish = normalize(intent.wish);
    this.targetIso = clamp(intent.iso, 0.22, 1.35);
    this.targetMorph = clamp(intent.morph, 0, 1);
    if (intent.hue !== undefined) this.targetHue = ((intent.hue % 1) + 1) % 1;
    if (intent.mood) this.mood = intent.mood;
    if (intent.speech) {
      this.speech = intent.speech;
      this.speechClock = 4.5;
    }
  }

  startle(): void {
    this.pulse = 1;
    this.thought = Math.max(this.thought, 0.4);
  }

  tick(dt: number, time: number): void {
    this.iso += (this.targetIso - this.iso) * Math.min(1, dt * 2.4);
    this.morph += (this.targetMorph - this.morph) * Math.min(1, dt * 1.8);
    this.hue += (this.targetHue - this.hue) * Math.min(1, dt * 1.2);
    this.pulse = Math.max(0, this.pulse - dt * 1.6);
    this.thought = Math.max(0, this.thought - dt * 0.55);
    this.speechClock = Math.max(0, this.speechClock - dt);
    if (this.speechClock <= 0) this.speech = "";

    const accel = 5.8;
    this.vel = madd(this.vel, this.wish, accel * dt);
    this.vel = scale(this.vel, Math.exp(-dt * 2.1));
    const speed = len(this.vel);
    if (speed > 3.4) this.vel = scale(this.vel, 3.4 / speed);

    this.pos = madd(this.pos, this.vel, dt);

    const n = gradWorld(this.pos, time);
    const d = mapWorld(this.pos, time);
    this.pos = madd(this.pos, n, this.iso - d);

    const vn = dot(this.vel, n);
    this.vel = sub(this.vel, scale(n, vn));

    this.trailClock += dt;
    if (this.trailClock > 0.09) {
      this.trailClock = 0;
      this.trails.pop();
      this.trails.unshift(copy(this.pos));
    }
  }

  snapshot(): PresenceState {
    const w = [
      clamp(1 - dist(this.pos, this.trails[0] ?? this.pos) * 0.15, 0.15, 1),
      clamp(0.75 - dist(this.pos, this.trails[1] ?? this.pos) * 0.12, 0.08, 0.85),
      clamp(0.5 - dist(this.pos, this.trails[2] ?? this.pos) * 0.1, 0.05, 0.7),
    ] as const;
    return {
      pos: copy(this.pos),
      vel: copy(this.vel),
      iso: this.iso,
      morph: this.morph,
      hue: this.hue,
      pulse: this.pulse,
      thought: this.thought,
      mood: this.mood,
      speech: this.speech,
      trail0: copy(this.trails[0] ?? this.pos),
      trail1: copy(this.trails[1] ?? this.pos),
      trail2: copy(this.trails[2] ?? this.pos),
      trailW: [w[0], w[1], w[2]],
    };
  }
}
