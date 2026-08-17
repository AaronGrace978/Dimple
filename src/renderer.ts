import { loc, program } from "./gl";
import type { Vec3 } from "./math";
import {
  dprCap,
  qualityTier,
  startScale,
  targetFrameMs,
  type QualityTier,
} from "./quality";
import vertSrc from "./shaders/vert.glsl?raw";
import fragSrc from "./shaders/frag.glsl?raw";

export type FrameState = {
  time: number;
  camPos: Vec3;
  camTarget: Vec3;
  agentPos: Vec3;
  agentVel: Vec3;
  morph: number;
  hue: number;
  pulse: number;
  thought: number;
  visitorPos: Vec3;
  visitorOn: number;
  trail0: Vec3;
  trail1: Vec3;
  trail2: Vec3;
  trailW: Vec3;
  lookAt: Vec3;
  affection: number;
  sleep: number;
};

type Uniforms = {
  uResolution: WebGLUniformLocation;
  uTime: WebGLUniformLocation;
  uCamPos: WebGLUniformLocation;
  uCamTarget: WebGLUniformLocation;
  uAgentPos: WebGLUniformLocation;
  uAgentVel: WebGLUniformLocation;
  uAgentMorph: WebGLUniformLocation;
  uAgentHue: WebGLUniformLocation;
  uAgentPulse: WebGLUniformLocation;
  uThought: WebGLUniformLocation;
  uVisitorPos: WebGLUniformLocation;
  uVisitorOn: WebGLUniformLocation;
  uTrail0: WebGLUniformLocation;
  uTrail1: WebGLUniformLocation;
  uTrail2: WebGLUniformLocation;
  uTrailW: WebGLUniformLocation;
  uQuality: WebGLUniformLocation;
  uLookAt: WebGLUniformLocation;
  uAffection: WebGLUniformLocation;
  uSleep: WebGLUniformLocation;
};

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private readonly prog: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly u: Uniforms;
  private dpr = 1;
  private scale = 1;
  private emaMs = 16;
  fps = 60;
  tier: QualityTier = 2;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 is required to enter the field.");
    this.gl = gl;
    this.prog = program(gl, vertSrc, fragSrc);
    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Could not create VAO");
    this.vao = vao;
    this.u = {
      uResolution: loc(gl, this.prog, "uResolution"),
      uTime: loc(gl, this.prog, "uTime"),
      uCamPos: loc(gl, this.prog, "uCamPos"),
      uCamTarget: loc(gl, this.prog, "uCamTarget"),
      uAgentPos: loc(gl, this.prog, "uAgentPos"),
      uAgentVel: loc(gl, this.prog, "uAgentVel"),
      uAgentMorph: loc(gl, this.prog, "uAgentMorph"),
      uAgentHue: loc(gl, this.prog, "uAgentHue"),
      uAgentPulse: loc(gl, this.prog, "uAgentPulse"),
      uThought: loc(gl, this.prog, "uThought"),
      uVisitorPos: loc(gl, this.prog, "uVisitorPos"),
      uVisitorOn: loc(gl, this.prog, "uVisitorOn"),
      uTrail0: loc(gl, this.prog, "uTrail0"),
      uTrail1: loc(gl, this.prog, "uTrail1"),
      uTrail2: loc(gl, this.prog, "uTrail2"),
      uTrailW: loc(gl, this.prog, "uTrailW"),
      uQuality: loc(gl, this.prog, "uQuality"),
      uLookAt: loc(gl, this.prog, "uLookAt"),
      uAffection: loc(gl, this.prog, "uAffection"),
      uSleep: loc(gl, this.prog, "uSleep"),
    };
    this.applyQuality();
  }

  applyQuality(): void {
    this.tier = qualityTier();
    this.scale = startScale(this.tier);
    this.emaMs = targetFrameMs(this.tier);
  }

  noteFrame(ms: number): void {
    const clamped = Math.min(80, Math.max(6, ms));
    this.emaMs = this.emaMs * 0.9 + clamped * 0.1;
    this.fps = 1000 / this.emaMs;
    const target = targetFrameMs(this.tier);
    if (this.emaMs > target * 1.12) this.scale = Math.max(0.48, this.scale * 0.97);
    else if (this.emaMs < target * 0.78) this.scale = Math.min(1, this.scale * 1.015);
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, dprCap(this.tier));
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * this.dpr * this.scale));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * this.dpr * this.scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  draw(state: FrameState): void {
    const { gl, u } = this;
    this.resize();
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(u.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, state.time);
    gl.uniform3f(u.uCamPos, state.camPos[0], state.camPos[1], state.camPos[2]);
    gl.uniform3f(
      u.uCamTarget,
      state.camTarget[0],
      state.camTarget[1],
      state.camTarget[2],
    );
    gl.uniform3f(
      u.uAgentPos,
      state.agentPos[0],
      state.agentPos[1],
      state.agentPos[2],
    );
    gl.uniform3f(
      u.uAgentVel,
      state.agentVel[0],
      state.agentVel[1],
      state.agentVel[2],
    );
    gl.uniform1f(u.uAgentMorph, state.morph);
    gl.uniform1f(u.uAgentHue, state.hue);
    gl.uniform1f(u.uAgentPulse, state.pulse);
    gl.uniform1f(u.uThought, state.thought);
    gl.uniform3f(
      u.uVisitorPos,
      state.visitorPos[0],
      state.visitorPos[1],
      state.visitorPos[2],
    );
    gl.uniform1f(u.uVisitorOn, state.visitorOn);
    gl.uniform3f(u.uTrail0, state.trail0[0], state.trail0[1], state.trail0[2]);
    gl.uniform3f(u.uTrail1, state.trail1[0], state.trail1[1], state.trail1[2]);
    gl.uniform3f(u.uTrail2, state.trail2[0], state.trail2[1], state.trail2[2]);
    gl.uniform3f(u.uTrailW, state.trailW[0], state.trailW[1], state.trailW[2]);
    gl.uniform1f(u.uQuality, this.tier);
    gl.uniform3f(u.uLookAt, state.lookAt[0], state.lookAt[1], state.lookAt[2]);
    gl.uniform1f(u.uAffection, state.affection);
    gl.uniform1f(u.uSleep, state.sleep);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
