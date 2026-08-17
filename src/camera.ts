import { add, clamp, cross, normalize, scale, sub, type Vec3 } from "./math";
import { FOV } from "./sdf";

export type PointerMode = "orbit" | "reach";

export class OrbitCamera {
  yaw = 0.62;
  pitch = 0.38;
  dist = 7.4;
  follow = true;
  target: Vec3 = [0, 0.6, 0];
  pos: Vec3 = [0, 2, 7];
  private dragging = false;
  private reaching = false;
  private lastX = 0;
  private lastY = 0;
  private moved = 0;

  attach(
    canvas: HTMLCanvasElement,
    onTap: (ndcX: number, ndcY: number) => void,
    opts?: {
      mode?: (ndcX: number, ndcY: number) => PointerMode;
      onReach?: (
        ndcX: number,
        ndcY: number,
        dx: number,
        dy: number,
        phase: "start" | "move" | "end",
      ) => void;
    },
  ): void {
    const ndc = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / Math.max(1, rect.width),
        y: (e.clientY - rect.top) / Math.max(1, rect.height),
      };
    };
    canvas.addEventListener("pointerdown", (e) => {
      const p = ndc(e);
      this.moved = 0;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      const mode = opts?.mode?.(p.x, p.y) ?? "orbit";
      this.reaching = mode === "reach";
      this.dragging = mode === "orbit";
      canvas.setPointerCapture(e.pointerId);
      if (this.reaching) opts?.onReach?.(p.x, p.y, 0, 0, "start");
    });
    canvas.addEventListener("pointermove", (e) => {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.moved += Math.abs(dx) + Math.abs(dy);
      const p = ndc(e);
      if (this.reaching) {
        opts?.onReach?.(p.x, p.y, dx, dy, "move");
        return;
      }
      if (!this.dragging) return;
      this.yaw -= dx * 0.005;
      this.pitch = clamp(this.pitch + dy * 0.004, 0.08, 1.35);
    });
    canvas.addEventListener("pointerup", (e) => {
      const p = ndc(e);
      if (this.reaching) {
        opts?.onReach?.(p.x, p.y, 0, 0, "end");
        this.reaching = false;
        if (this.moved < 8) onTap(p.x, p.y);
        return;
      }
      this.dragging = false;
      if (this.moved < 6) onTap(p.x, p.y);
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.dist = clamp(this.dist * (1 + e.deltaY * 0.0012), 2.4, 16);
      },
      { passive: false },
    );
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = clamp(this.pitch + dy, 0.08, 1.35);
  }

  zoomBy(factor: number): void {
    this.dist = clamp(this.dist * factor, 2.4, 16);
  }

  flatRight(): Vec3 {
    return normalize([-Math.sin(this.yaw), 0, Math.cos(this.yaw)]);
  }

  flatFwd(): Vec3 {
    return normalize([-Math.cos(this.yaw), 0, -Math.sin(this.yaw)]);
  }

  tick(agent: Vec3, dt: number): void {
    const aim: Vec3 = this.follow ? agent : this.target;
    this.target = [
      this.target[0] + (aim[0] - this.target[0]) * Math.min(1, dt * 3.2),
      this.target[1] + (aim[1] + 0.15 - this.target[1]) * Math.min(1, dt * 3.2),
      this.target[2] + (aim[2] - this.target[2]) * Math.min(1, dt * 3.2),
    ];
    const cp = Math.cos(this.pitch);
    const offset: Vec3 = [
      Math.cos(this.yaw) * cp * this.dist,
      Math.sin(this.pitch) * this.dist,
      Math.sin(this.yaw) * cp * this.dist,
    ];
    this.pos = add(this.target, offset);
  }

  rayFromNdc(nx: number, ny: number, aspect: number): { ro: Vec3; rd: Vec3 } {
    const uvx = (nx - 0.5) * aspect;
    const uvy = 0.5 - ny;
    const fwd = normalize(sub(this.target, this.pos));
    const right = normalize(cross(fwd, [0, 1, 0]));
    const up = cross(right, fwd);
    const rd = normalize(
      add(add(fwd, scale(right, uvx * FOV)), scale(up, uvy * FOV)),
    );
    return { ro: this.pos, rd };
  }

  project(world: Vec3, aspect: number): { nx: number; ny: number; z: number } | null {
    const fwd = normalize(sub(this.target, this.pos));
    const right = normalize(cross(fwd, [0, 1, 0]));
    const up = cross(right, fwd);
    const rel = sub(world, this.pos);
    const z = rel[0] * fwd[0] + rel[1] * fwd[1] + rel[2] * fwd[2];
    if (z < 0.14) return null;
    const x = (rel[0] * right[0] + rel[1] * right[1] + rel[2] * right[2]) / (z * FOV);
    const y = (rel[0] * up[0] + rel[1] * up[1] + rel[2] * up[2]) / (z * FOV);
    return { nx: x / aspect + 0.5, ny: 0.5 - y, z };
  }
}
