import type { OrbitCamera } from "./camera";

const DEAD = 0.18;
const prev: boolean[] = [];

export type ControlHooks = {
  chatOpen: () => boolean;
  typing: () => boolean;
  openChat: () => void;
  closePanels: () => void;
  toggleSettings: () => void;
  toggleFollow: () => void;
  talk: () => void;
  sendTyped: () => void;
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

export function pollGamepad(
  cam: OrbitCamera,
  hooks: ControlHooks,
  dt: number,
): void {
  const pads = navigator.getGamepads?.() ?? [];
  const pad = pads[0] ?? pads[1];
  if (!pad) return;

  const lx = axis(pad, 0);
  const ly = axis(pad, 1);
  const rx = axis(pad, 2);
  const ry = axis(pad, 3);
  const l2 = pad.buttons[6]?.value ?? 0;
  const r2 = pad.buttons[7]?.value ?? 0;

  if (!hooks.typing()) {
    cam.look((rx + lx * 0.35) * dt * 2.4, (ry + ly * 0.2) * dt * 1.9);
    const zoom = 1 + (ly * 0.35 + (r2 - l2)) * dt * 1.6;
    cam.zoomBy(zoom);
  }

  if (edge(pad, 0)) {
    if (hooks.chatOpen() && hooks.typing()) hooks.sendTyped();
    else if (hooks.chatOpen()) hooks.sendTyped();
    else hooks.openChat();
  }
  if (edge(pad, 1)) hooks.closePanels();
  if (edge(pad, 2)) hooks.talk();
  if (edge(pad, 3)) hooks.toggleFollow();
  if (edge(pad, 8)) hooks.openChat();
  if (edge(pad, 9)) hooks.toggleSettings();
  if (edge(pad, 12)) hooks.toggleFollow();
  if (edge(pad, 13)) hooks.tapCenter();
  if (edge(pad, 10) || edge(pad, 11)) hooks.tapCenter();
}
