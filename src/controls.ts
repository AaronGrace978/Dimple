import type { OrbitCamera } from "./camera";

const DEAD = 0.18;
const prev: boolean[] = [];
let pttHeld = false;

export type ControlHooks = {
  chatOpen: () => boolean;
  typing: () => boolean;
  openChat: () => void;
  closePanels: () => void;
  toggleSettings: () => void;
  toggleFollow: () => void;
  pttStart: () => void;
  pttStop: () => void;
  tapCenter: () => void;
};

function edge(pad: Gamepad, i: number): boolean {
  const down = Boolean(pad.buttons[i]?.pressed);
  const hit = down && !prev[i];
  prev[i] = down;
  return hit;
}

function axis(pad: Gamepad, i: number): number {
  const v = pad.axes[i] ?? 0;
  return Math.abs(v) < DEAD ? 0 : v;
}

function activePad(): Gamepad | null {
  const pads = navigator.getGamepads?.() ?? [];
  let fallback: Gamepad | null = null;
  for (const p of pads) {
    if (!p) continue;
    fallback ??= p;
    for (const b of p.buttons) {
      if (b.pressed || (b.value ?? 0) > 0.4) return p;
    }
    for (const a of p.axes) {
      if (Math.abs(a) > 0.25) return p;
    }
  }
  return fallback;
}

function trigger(pad: Gamepad, button: number, ax: number): number {
  const b = pad.buttons[button]?.value ?? 0;
  const a = pad.axes[ax] ?? 0;
  const fromAxis = a > 0.1 ? a : 0;
  return Math.max(b, fromAxis);
}

export function pollGamepad(
  cam: OrbitCamera,
  hooks: ControlHooks,
  dt: number,
): void {
  const pad = activePad();
  if (!pad) return;

  const typing = hooks.typing();
  const lx = axis(pad, 0);
  const ly = axis(pad, 1);
  const rx = axis(pad, 2);
  const ry = axis(pad, 3);
  const l2 = trigger(pad, 6, 4);
  const r2 = trigger(pad, 7, 5);
  const xBtn = Boolean(pad.buttons[2]?.pressed);
  const l1 = Boolean(pad.buttons[4]?.pressed);
  const wantPtt = xBtn || l1 || l2 > 0.35;

  if (wantPtt && !pttHeld) hooks.pttStart();
  if (!wantPtt && pttHeld) hooks.pttStop();
  pttHeld = wantPtt;

  if (typing) {
    if (edge(pad, 1)) hooks.closePanels();
    return;
  }

  cam.look((rx + lx * 0.35) * dt * 2.4, (ry + ly * 0.2) * dt * 1.9);
  cam.zoomBy(1 + (ly * 0.35 + (r2 - (wantPtt ? 0 : l2))) * dt * 1.6);

  if (edge(pad, 0) && !pttHeld && !hooks.chatOpen()) hooks.openChat();
  if (edge(pad, 1)) hooks.closePanels();
  if (edge(pad, 3)) hooks.toggleFollow();
  if (edge(pad, 8) && !pttHeld) hooks.openChat();
  if (edge(pad, 9)) hooks.toggleSettings();
  if (edge(pad, 12)) hooks.toggleFollow();
  if (edge(pad, 13)) hooks.tapCenter();
  if (edge(pad, 10) || edge(pad, 11)) hooks.tapCenter();
}
