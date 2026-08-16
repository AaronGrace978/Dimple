import { add, clamp, cross, normalize, scale, sub, type Vec3 } from "./math";
import { FOV } from "./sdf";

export class OrbitCamera {
  yaw = 0.62;
  pitch = 0.38;
  dist = 7.4;
  follow = true;
  target: Vec3 = [0, 0.6, 0];
  pos: Vec3 = [0, 2, 7];
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private moved = 0;

  attach(canvas: HTMLCanvasElement, onClick: (ndcX: number, ndcY: number) => void): void {
    canvas.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.moved = 0;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.moved += Math.abs(dx) + Math.abs(dy);
      this.yaw -= dx * 0.005;
      this.pitch = clamp(this.pitch + dy * 0.004, 0.08, 1.35);
    });
    canvas.addEventListener("pointerup", (e) => {
      this.dragging = false;
      if (this.moved < 6) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        onClick(x, y);
      }
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
}
