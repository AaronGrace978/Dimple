import { add, copy, type Vec3, vx } from "./math";
import { feelXZ } from "./emotion";

function sdOctahedron(p: Vec3, s: number): number {
  return (Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]) - s) * 0.57735027;
}

function sdCappedCylinder(p: Vec3, h: number, r: number): number {
  const dx = Math.hypot(p[0], p[2]) - r;
  const dy = Math.abs(p[1]) - h;
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(ox, oy);
}

export function crystalCenter(i: number): Vec3 {
  const a = i * 1.0471976 + 0.18;
  return [Math.cos(a) * 5.25, 0.62, Math.sin(a) * 5.25];
}

/** Keep in lockstep with src/shaders/frag.glsl — SCENE REV 4 */

export const FOV = 1.15;

const EPS = 0.002;

function sdSphere(p: Vec3, r: number): number {
  return Math.hypot(p[0], p[1], p[2]) - r;
}

function sdBox(p: Vec3, b: Vec3): number {
  const qx = Math.abs(p[0]) - b[0];
  const qy = Math.abs(p[1]) - b[1];
  const qz = Math.abs(p[2]) - b[2];
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const oz = Math.max(qz, 0);
  const outside = Math.hypot(ox, oy, oz);
  const inside = Math.min(Math.max(qx, qy, qz), 0);
  return outside + inside;
}

function sdTorusXZ(p: Vec3, R: number, r: number): number {
  const q = Math.hypot(p[0], p[2]) - R;
  return Math.hypot(q, p[1]) - r;
}

function sdTorusXY(p: Vec3, R: number, r: number): number {
  const q = Math.hypot(p[0], p[1]) - R;
  return Math.hypot(q, p[2]) - r;
}

export function monolithCenter(i: number): Vec3 {
  const a = i * Math.PI * 0.5 + 0.4;
  return [Math.cos(a) * 3.1, 1.15, Math.sin(a) * 3.1];
}

export function moonCenter(i: number, time: number): Vec3 {
  const a = time * 0.17 + i * 2.094395;
  return [
    Math.cos(a) * 2.35,
    1.55 + 0.35 * Math.sin(time * 0.31 + i),
    Math.sin(a) * 2.35,
  ];
}

export function moonRadius(i: number): number {
  return 0.2 - i * 0.04;
}

export const PORTAL: Vec3 = [0, 1.15, -4.55];

/** Nest under the grove, northeast of the pool. This is home / base. */
export const GROVE_A = 0.7;
export const BED: Vec3 = [
  Math.cos(GROVE_A) * 5.72,
  0.16,
  Math.sin(GROVE_A) * 5.72,
];

export const RINGS = [1.55, 2.45, 4.2, 6.8, 8.4] as const;

const TREE_A = [0.48, 0.92, 0.7] as const;
const TREE_R = [6.28, 6.22, 6.42] as const;
const TREE_S = [1, 0.86, 1.12] as const;

export function treeCenter(i: number): Vec3 {
  const a = TREE_A[i] ?? TREE_A[0]!;
  const r = TREE_R[i] ?? TREE_R[0]!;
  return [Math.cos(a) * r, 0, Math.sin(a) * r];
}

export function treeScale(i: number): number {
  return TREE_S[i] ?? 1;
}

export function bedRest(): Vec3 {
  return [BED[0], 0.38, BED[2]];
}

function mapOneTree(p: Vec3, i: number): number {
  const c = treeCenter(i);
  const s = treeScale(i);
  const trunkH = 0.5 * s;
  let d = sdCappedCylinder(
    [p[0] - c[0], p[1] - trunkH, p[2] - c[2]],
    trunkH,
    0.046 * s,
  );
  const cy = trunkH * 2.05;
  d = Math.min(d, sdSphere([p[0] - c[0], p[1] - cy, p[2] - c[2]], 0.36 * s));
  d = Math.min(
    d,
    sdSphere(
      [p[0] - (c[0] + 0.2 * s), p[1] - (cy + 0.12), p[2] - (c[2] - 0.08 * s)],
      0.24 * s,
    ),
  );
  d = Math.min(
    d,
    sdSphere(
      [p[0] - (c[0] - 0.16 * s), p[1] - (cy + 0.05), p[2] - (c[2] + 0.14 * s)],
      0.22 * s,
    ),
  );
  return d;
}

export function mapTrees(p: Vec3): number {
  let d = 1e5;
  for (let i = 0; i < 3; i++) d = Math.min(d, mapOneTree(p, i));
  return d;
}

export function mapBed(p: Vec3): number {
  const q: Vec3 = [p[0] - BED[0], p[1] - BED[1], p[2] - BED[2]];
  let d = sdTorusXZ(q, 0.4, 0.09);
  d = Math.min(d, Math.hypot(q[0], q[1] * 1.7, q[2]) - 0.36);
  d = Math.min(d, sdSphere([q[0] - 0.14, q[1] - 0.08, q[2] - 0.06], 0.11));
  return d;
}

export function mapWorld(p: Vec3, time: number): number {
  const r = Math.hypot(p[0], p[2]);
  const hills = 0.62 * Math.sin(p[0] * 0.21 + 0.7) * Math.sin(p[2] * 0.18 - 0.4);
  const t = Math.min(1, Math.max(0, (r - 8.2) / (13.5 - 8.2)));
  const feel = feelXZ(p[0], p[2]);
  let d = p[1] - hills * t - feel.joy * 0.07 + feel.fear * 0.03;

  d = Math.min(d, Math.max(Math.abs(p[1] - 0.025) - 0.02, r - 1.12));
  d = Math.min(d, sdCappedCylinder([p[0], p[1] - 0.06, p[2]], 0.06, 1.28));
  d = Math.min(d, sdTorusXZ([p[0], p[1] - 0.05, p[2]], 1.55, 0.045));
  d = Math.min(d, sdTorusXZ([p[0], p[1] - 0.07, p[2]], 2.45, 0.05));
  d = Math.min(d, sdTorusXZ([p[0], p[1] - 0.08, p[2]], 4.2, 0.08));
  d = Math.min(d, sdTorusXZ(p, 6.8, 0.22));
  d = Math.min(d, sdTorusXZ([p[0], p[1] - 0.12, p[2]], 8.4, 0.16));

  for (let i = 0; i < 4; i++) {
    const c = monolithCenter(i);
    const feel = feelXZ(c[0], c[2]);
    const al = Math.hypot(c[0], c[2]) || 1;
    const mx = c[0] + (c[0] / al) * feel.fear * 0.42;
    const mz = c[2] + (c[2] / al) * feel.fear * 0.42;
    const my = c[1] + feel.joy * 0.12;
    d = Math.min(
      d,
      sdBox([p[0] - mx, p[1] - my, p[2] - mz], [0.28, 1.15, 0.28]),
    );
    d = Math.min(
      d,
      sdBox([p[0] - mx, p[1] - (my + 1.22), p[2] - mz], [0.38, 0.08, 0.38]),
    );
    d = Math.min(
      d,
      sdSphere([p[0] - mx, p[1] - 2.52, p[2] - mz], 0.1),
    );
  }

  for (let i = 0; i < 6; i++) {
    const c = crystalCenter(i);
    const feel = feelXZ(c[0], c[2]);
    const size = 0.62 * (1 - Math.min(0.48, feel.fear * 0.48)) * (1 + Math.min(0.28, feel.joy * 0.28));
    const q: Vec3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    d = Math.min(d, sdOctahedron(q, size));
    d = Math.min(d, sdOctahedron([q[0], q[1] - 0.72, q[2]], size * 0.45));
  }

  for (let i = 0; i < 3; i++) {
    const c = moonCenter(i, time);
    const q: Vec3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    d = Math.min(d, sdSphere(q, moonRadius(i)));
  }

  const portal: Vec3 = [p[0] - PORTAL[0], p[1] - PORTAL[1], p[2] - PORTAL[2]];
  d = Math.min(d, sdTorusXY(portal, 0.95, 0.07));
  d = Math.min(d, sdBox([p[0] + 1.05, p[1] - 1.0, p[2] + 4.55], [0.12, 1.0, 0.12]));
  d = Math.min(d, sdBox([p[0] - 1.05, p[1] - 1.0, p[2] + 4.55], [0.12, 1.0, 0.12]));
  d = Math.min(d, sdBox([p[0], p[1] - 2.12, p[2] + 4.55], [1.18, 0.1, 0.12]));

  d = Math.min(d, mapTrees(p));
  d = Math.min(d, mapBed(p));

  return d;
}

export function gradWorld(p: Vec3, time: number): Vec3 {
  const dx =
    mapWorld([p[0] + EPS, p[1], p[2]], time) -
    mapWorld([p[0] - EPS, p[1], p[2]], time);
  const dy =
    mapWorld([p[0], p[1] + EPS, p[2]], time) -
    mapWorld([p[0], p[1] - EPS, p[2]], time);
  const dz =
    mapWorld([p[0], p[1], p[2] + EPS], time) -
    mapWorld([p[0], p[1], p[2] - EPS], time);
  const l = Math.hypot(dx, dy, dz);
  if (l < 1e-8) return [0, 1, 0];
  return [dx / l, dy / l, dz / l];
}

export function marchWorld(
  origin: Vec3,
  dir: Vec3,
  time: number,
  maxT = 14,
): { t: number; hit: boolean } {
  let t = 0;
  for (let i = 0; i < 48; i++) {
    const p = add(origin, [dir[0] * t, dir[1] * t, dir[2] * t]);
    const d = mapWorld(p, time);
    if (d < 0.02) return { t, hit: true };
    t += d;
    if (t > maxT) return { t: maxT, hit: false };
  }
  return { t, hit: t < maxT };
}

export type Landmark = { name: string; pos: Vec3; iso: number };

export function landmarks(time: number): Landmark[] {
  const list: Landmark[] = [
    { name: "pool", pos: vx(0, 0.4, 0), iso: 0.36 },
    { name: "crystal", pos: crystalCenter(0), iso: 0.45 },
    { name: "inner-ring", pos: vx(4.2, 0.45, 0), iso: 0.38 },
    { name: "far-ring", pos: vx(-4.0, 0.45, 1.2), iso: 0.38 },
    { name: "portal", pos: copy(PORTAL), iso: 0.55 },
    { name: "outer", pos: vx(0, 0.5, 6.2), iso: 0.4 },
    { name: "bed", pos: bedRest(), iso: 0.24 },
  ];
  for (let i = 0; i < 3; i++) {
    const c = treeCenter(i);
    const s = treeScale(i);
    list.push({
      name: `tree-${i}`,
      pos: [c[0], 1.05 * s, c[2]],
      iso: 0.32,
    });
  }
  for (let i = 0; i < 4; i++) {
    const c = monolithCenter(i);
    list.push({
      name: `monolith-${i}`,
      pos: [c[0], 2.45, c[2]],
      iso: 0.36,
    });
  }
  list.push({
    name: "moon-0",
    pos: moonCenter(0, time),
    iso: 0.5,
  });
  return list;
}

export const PROBE_DIRS: Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
  [0.707, 0, 0.707],
  [-0.707, 0, 0.707],
];

export function senseField(origin: Vec3, time: number) {
  return PROBE_DIRS.map((dir) => {
    const { t, hit } = marchWorld(origin, dir, time, 10);
    return { dir, dist: t, hit };
  });
}
