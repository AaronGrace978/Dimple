import type { Vec3 } from "./math";
import {
  BED,
  PORTAL,
  RINGS,
  crystalCenter,
  monolithCenter,
  treeCenter,
} from "./sdf";

const EXTENT = 9.4;

export type FieldMapMarks = {
  dimple: Vec3;
  you: Vec3;
  yaw: number;
  pebble: Vec3 | null;
  guest: Vec3 | null;
  asleep: boolean;
  expanded: boolean;
};

function xz(x: number, z: number, w: number, h: number): [number, number] {
  return [(0.5 + x / (2 * EXTENT)) * w, (0.5 - z / (2 * EXTENT)) * h];
}

function ring(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  radius: number,
  color: string,
  width: number,
): void {
  const [cx, cy] = xz(0, 0, w, h);
  const rx = (radius / (2 * EXTENT)) * w;
  ctx.beginPath();
  ctx.arc(cx, cy, rx, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  glow?: string,
): void {
  if (glow) {
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function label(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  size: number,
): void {
  ctx.font = `${size}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + size * 0.7, y);
}

export function drawFieldMap(
  canvas: HTMLCanvasElement,
  marks: FieldMapMarks,
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  const bw = Math.floor(w * dpr);
  const bh = Math.floor(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(6, 8, 12, 0.92)";
  ctx.fillRect(0, 0, w, h);

  ring(ctx, w, h, 1.12, "rgba(80, 140, 160, 0.45)", 1.2);
  for (const r of RINGS) {
    const gold = r === 6.8 || r === 4.2;
    ring(
      ctx,
      w,
      h,
      r,
      gold ? "rgba(180, 140, 70, 0.4)" : "rgba(232, 228, 217, 0.16)",
      gold ? 1.4 : 1,
    );
  }

  if (marks.expanded) {
    for (let i = 0; i < 4; i++) {
      const c = monolithCenter(i);
      const [x, y] = xz(c[0], c[2], w, h);
      ctx.fillStyle = "rgba(160, 155, 145, 0.7)";
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
    for (let i = 0; i < 6; i++) {
      const c = crystalCenter(i);
      const [x, y] = xz(c[0], c[2], w, h);
      ctx.fillStyle = "rgba(140, 90, 210, 0.8)";
      ctx.beginPath();
      ctx.moveTo(x, y - 3.5);
      ctx.lineTo(x + 2.5, y);
      ctx.lineTo(x, y + 3.5);
      ctx.lineTo(x - 2.5, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  for (let i = 0; i < 3; i++) {
    const c = treeCenter(i);
    const [x, y] = xz(c[0], c[2], w, h);
    dot(ctx, x, y, marks.expanded ? 4 : 2.5, "rgba(70, 160, 90, 0.95)", "rgba(40, 90, 50, 0.35)");
  }

  const [bx, by] = xz(BED[0], BED[2], w, h);
  const nestGlow = marks.asleep ? "rgba(220, 90, 130, 0.45)" : "rgba(200, 80, 120, 0.22)";
  dot(ctx, bx, by, marks.expanded ? 6 : 5, "rgba(230, 120, 150, 0.95)", nestGlow);
  ctx.font = `${marks.expanded ? 10 : 8}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.fillStyle = "rgba(230, 160, 175, 0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("BASE", bx, by + (marks.expanded ? 7 : 6));

  const [px, py] = xz(PORTAL[0], PORTAL[2], w, h);
  ctx.beginPath();
  ctx.arc(px, py, marks.expanded ? 7 : 5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(90, 180, 255, 0.85)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  if (marks.expanded) label(ctx, px + 4, py, "portal", "rgba(140, 200, 255, 0.85)", 9);

  if (marks.pebble) {
    const [x, y] = xz(marks.pebble[0], marks.pebble[2], w, h);
    dot(ctx, x, y, 3, "rgba(90, 220, 230, 0.95)");
  }
  if (marks.guest) {
    const [x, y] = xz(marks.guest[0], marks.guest[2], w, h);
    dot(ctx, x, y, 4, "rgba(180, 140, 255, 0.95)", "rgba(120, 80, 200, 0.3)");
  }

  const [yx, yy] = xz(marks.you[0], marks.you[2], w, h);
  const fx = -Math.cos(marks.yaw);
  const fz = -Math.sin(marks.yaw);
  const ux = fx;
  const uy = -fz;
  const rx = -uy;
  const ry = ux;
  ctx.beginPath();
  ctx.moveTo(yx + ux * 7, yy + uy * 7);
  ctx.lineTo(yx - ux * 4 + rx * 4.5, yy - uy * 4 + ry * 4.5);
  ctx.lineTo(yx - ux * 2, yy - uy * 2);
  ctx.lineTo(yx - ux * 4 - rx * 4.5, yy - uy * 4 - ry * 4.5);
  ctx.closePath();
  ctx.fillStyle = "rgba(232, 228, 217, 0.95)";
  ctx.fill();

  const [dx, dy] = xz(marks.dimple[0], marks.dimple[2], w, h);
  dot(
    ctx,
    dx,
    dy,
    marks.expanded ? 5.5 : 4.5,
    "rgba(126, 224, 200, 1)",
    "rgba(126, 224, 200, 0.28)",
  );

  ctx.font = "8px \"IBM Plex Mono\", ui-monospace, monospace";
  ctx.fillStyle = "rgba(138, 133, 120, 0.9)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("N", 6, 5);

  if (marks.expanded) {
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(232, 228, 217, 0.7)";
    ctx.font = "9px \"IBM Plex Mono\", ui-monospace, monospace";
    ctx.fillText("you  dimple  nest=base", 8, h - 6);
  }
}
