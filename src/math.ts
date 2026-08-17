export type Vec3 = [number, number, number];

export const vx = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function madd(a: Vec3, b: Vec3, s: number): Vec3 {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function len(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function normalize(a: Vec3): Vec3 {
  const l = len(a);
  if (l < 1e-8) return [0, 0, 0];
  return scale(a, 1 / l);
}

export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function clamp(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x));
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist(a: Vec3, b: Vec3): number {
  return len(sub(a, b));
}

export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function copy(a: Vec3): Vec3 {
  return [a[0], a[1], a[2]];
}

/** Ray-sphere hit distance, or -1 if the ray misses. */
export function rayHitsSphere(ro: Vec3, rd: Vec3, center: Vec3, radius: number): number {
  const oc = sub(ro, center);
  const b = dot(oc, rd);
  const c = dot(oc, oc) - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t > 0.04 ? t : -1;
}
