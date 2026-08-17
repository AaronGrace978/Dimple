import { getAudioContext, isSpeaking, unlockAudio } from "./audio";
import { qualityTier } from "./quality";

const KEY = "raymarch_field_sings";

let on = localStorage.getItem(KEY) !== "0";
let ready = false;
let lastTick = 0;
let pad: OscillatorNode | null = null;
let fifth: OscillatorNode | null = null;
let shimmer: OscillatorNode | null = null;
let filter: BiquadFilterNode | null = null;
let gain: GainNode | null = null;
let targetHz = 146.83;

export function fieldSings(): boolean {
  return on;
}

export function setFieldSings(value: boolean): void {
  on = value;
  localStorage.setItem(KEY, value ? "1" : "0");
  if (!value) hush(0.15);
}

function hush(seconds: number): void {
  if (!gain) return;
  const c = getAudioContext();
  const t = c.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0.0001, t + seconds);
}

async function boot(): Promise<void> {
  if (ready) return;
  const c = await unlockAudio();
  const deck = qualityTier() === 0;
  filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 720;
  filter.Q.value = 0.7;
  gain = c.createGain();
  gain.gain.value = 0.0001;
  filter.connect(gain);
  gain.connect(c.destination);

  pad = c.createOscillator();
  pad.type = "sine";
  pad.frequency.value = targetHz;
  pad.connect(filter);
  pad.start();

  if (!deck) {
    fifth = c.createOscillator();
    fifth.type = "triangle";
    fifth.frequency.value = targetHz * 1.5;
    const g5 = c.createGain();
    g5.gain.value = 0.18;
    fifth.connect(g5);
    g5.connect(filter);
    fifth.start();

    shimmer = c.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = targetHz * 2;
    const gs = c.createGain();
    gs.gain.value = 0.08;
    shimmer.connect(gs);
    gs.connect(filter);
    shimmer.start();
  }
  ready = true;
}

function baseHz(mood: string): number {
  if (mood === "startle") return 233.08;
  if (mood === "sleep") return 98;
  if (mood === "rest") return 110;
  if (mood === "think") return 130.81;
  if (mood === "nuzzle" || mood === "trust") return 138.59;
  if (mood === "play") return 164.81;
  if (mood === "greet") return 155.56;
  if (mood === "climb") return 174.61;
  return 146.83;
}

export function tickMusic(sample: {
  field: number;
  mood: string;
  fear: number;
  joy: number;
  growth: number;
  iso: number;
}): void {
  if (!on) return;
  const now = performance.now();
  if (now - lastTick < 90) return;
  lastTick = now;
  if (!ready) {
    void boot().catch(() => undefined);
    return;
  }
  if (!pad || !filter || !gain) return;
  const c = getAudioContext();
  const t = c.currentTime;
  const root = baseHz(sample.mood);
  const fieldLift = Math.tanh(sample.field) * 18;
  const joyLift = sample.joy * 12;
  const fearBite = sample.fear * 9;
  targetHz = root + fieldLift + joyLift - fearBite * 0.4 + sample.iso * 6;
  pad.frequency.setTargetAtTime(Math.max(70, targetHz), t, 0.12);
  fifth?.frequency.setTargetAtTime(Math.max(90, targetHz * (sample.fear > 0.45 ? 1.414 : 1.5)), t, 0.16);
  shimmer?.frequency.setTargetAtTime(Math.max(140, targetHz * (2 + sample.growth * 0.15)), t, 0.2);
  const cutoff = 280 + sample.joy * 900 + sample.growth * 420 - sample.fear * 180;
  filter.frequency.setTargetAtTime(Math.max(180, cutoff), t, 0.18);
  const speaking = isSpeaking();
  const vol = speaking ? 0.004 : 0.018 + sample.growth * 0.012 + sample.joy * 0.01;
  gain.gain.setTargetAtTime(on ? vol : 0.0001, t, speaking ? 0.04 : 0.2);
}

export function stopMusic(): void {
  hush(0.2);
}
