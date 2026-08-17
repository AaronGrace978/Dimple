import { copy, dist, type Vec3, vx } from "./math";
import { PORTAL } from "./sdf";

export type GuestBlob = {
  id: string;
  pos: Vec3;
  vel: Vec3;
  morph: number;
  hue: number;
  pulse: number;
  thought: number;
  growth: number;
  sleep: number;
  look: Vec3;
  mood: string;
  word: string;
  nearPortal: boolean;
};

const KEY = "raymarch_portal_on";
const CHAN = "dimple-portal-field";

let on = localStorage.getItem(KEY) !== "0";
let selfId = "";
let echo: GuestBlob | null = null;
let lan: GuestBlob | null = null;
let lastBeacon = 0;
let lastPull = 0;
let channel: BroadcastChannel | null = null;

function id(): string {
  if (selfId) return selfId;
  try {
    const old = sessionStorage.getItem("raymarch_portal_id");
    if (old) {
      selfId = old;
      return selfId;
    }
  } catch {
    /* private mode */
  }
  selfId = `d${Math.random().toString(36).slice(2, 10)}`;
  try {
    sessionStorage.setItem("raymarch_portal_id", selfId);
  } catch {
    /* ignore */
  }
  return selfId;
}

function bus(): BroadcastChannel | null {
  if (channel) return channel;
  try {
    channel = new BroadcastChannel(CHAN);
    channel.onmessage = (ev: MessageEvent<GuestBlob>) => {
      const blob = ev.data;
      if (!blob || blob.id === id()) return;
      lan = blob;
    };
  } catch {
    channel = null;
  }
  return channel;
}

export function portalOn(): boolean {
  return on;
}

export function setPortalOn(value: boolean): void {
  on = value;
  localStorage.setItem(KEY, value ? "1" : "0");
  if (!value) lan = null;
}

export function nearPortal(pos: Vec3): boolean {
  return dist(pos, PORTAL) < 2.35;
}

export function rememberEcho(blob: Omit<GuestBlob, "id" | "nearPortal"> & { nearPortal?: boolean }): void {
  echo = {
    ...blob,
    id: "echo",
    pos: copy(blob.pos),
    vel: copy(blob.vel),
    look: copy(blob.look),
    nearPortal: Boolean(blob.nearPortal),
  };
}

function parseGuest(raw: unknown): GuestBlob | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Partial<GuestBlob>;
  if (typeof j.id !== "string" || j.id === id()) return null;
  if (!Array.isArray(j.pos) || j.pos.length < 3) return null;
  return {
    id: j.id,
    pos: [Number(j.pos[0]) || 0, Number(j.pos[1]) || 0.5, Number(j.pos[2]) || 0],
    vel: Array.isArray(j.vel)
      ? [Number(j.vel[0]) || 0, Number(j.vel[1]) || 0, Number(j.vel[2]) || 0]
      : vx(),
    morph: Number(j.morph) || 0.3,
    hue: Number(j.hue) || 0.62,
    pulse: Number(j.pulse) || 0,
    thought: Number(j.thought) || 0,
    growth: Number(j.growth) || 0.3,
    sleep: Number(j.sleep) || 0,
    look: Array.isArray(j.look)
      ? [Number(j.look[0]) || 0, Number(j.look[1]) || 0.5, Number(j.look[2]) || 0]
      : vx(),
    mood: typeof j.mood === "string" ? j.mood : "wander",
    word: typeof j.word === "string" ? j.word.slice(0, 22) : "",
    nearPortal: Boolean(j.nearPortal),
  };
}

async function pullLan(): Promise<void> {
  try {
    const res = await fetch("/portal/peers", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { peers?: unknown[] };
    const list = Array.isArray(data.peers) ? data.peers : [];
    for (const row of list) {
      const g = parseGuest(row);
      if (g) {
        lan = g;
        return;
      }
    }
  } catch {
    /* web loop has no UDP */
  }
}

export async function beacon(blob: GuestBlob): Promise<void> {
  if (!on) return;
  const now = performance.now();
  if (now - lastBeacon < 380) return;
  lastBeacon = now;
  const payload = { ...blob, id: id() };
  bus()?.postMessage(payload);
  if (now - lastPull > 420) {
    lastPull = now;
    void pullLan();
  }
  try {
    await fetch("/portal/beacon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* vite */
  }
}

export function currentGuest(selfNear: boolean): GuestBlob | null {
  if (!on) return null;
  if (lan) return lan;
  if (selfNear && echo) {
    const orbit = performance.now() / 1000;
    return {
      ...echo,
      pos: [
        PORTAL[0] + Math.cos(orbit * 0.55) * 0.85,
        PORTAL[1] + 0.08 * Math.sin(orbit * 1.3),
        PORTAL[2] + Math.sin(orbit * 0.55) * 0.85,
      ],
      id: "echo",
    };
  }
  return null;
}

export function portalStatus(guest: GuestBlob | null): string {
  if (!on) return "portal closed";
  if (guest && guest.id !== "echo") return "portal · another dimple";
  if (guest) return "portal · echo of you";
  return "portal · listening on lan";
}
