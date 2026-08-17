import { loc, program } from "./gl";
import type { Vec3 } from "./math";
import {
  dprCap,
  pixelBudget,
  qualityTier,
  readWebglRenderer,
  setGpuRenderer,
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
  growth: number;
  trust: number;
  emotion: Float32Array;
  emotionN: number;
  fearMean: number;
  joyMean: number;
  guestPos: Vec3;
  guestVel: Vec3;
  guestMorph: number;
  guestHue: number;
  guestOn: number;
  guestGrowth: number;
  bead0: Vec3;
  bead1: Vec3;
  bead2: Vec3;
  bead3: Vec3;
  beadW: [number, number, number, number];
  handPos: Vec3;
  handOn: number;
  portalOpen: number;
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
  uEmotion: WebGLUniformLocation;
  uEmotionN: WebGLUniformLocation;
  uFearMean: WebGLUniformLocation;
  uJoyMean: WebGLUniformLocation;
  uGrowth: WebGLUniformLocation;
  uTrust: WebGLUniformLocation;
  uGuestPos: WebGLUniformLocation;
  uGuestVel: WebGLUniformLocation;
  uGuestMorph: WebGLUniformLocation;
  uGuestHue: WebGLUniformLocation;
  uGuestOn: WebGLUniformLocation;
  uGuestGrowth: WebGLUniformLocation;
  uBead0: WebGLUniformLocation;
  uBead1: WebGLUniformLocation;
  uBead2: WebGLUniformLocation;
  uBead3: WebGLUniformLocation;
  uBeadW: WebGLUniformLocation;
  uHandPos: WebGLUniformLocation;
  uHandOn: WebGLUniformLocation;
  uPortalOpen: WebGLUniformLocation;
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
  canvasWidth = 0;
  canvasHeight = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      desynchronized: false,
      failIfMajorPerformanceCaveat: false,
    });
    if (!gl) throw new Error("WebGL2 is required to enter the field.");
    this.gl = gl;
    setGpuRenderer(readWebglRenderer(gl));
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
      uEmotion: loc(gl, this.prog, "uEmotion[0]"),
      uEmotionN: loc(gl, this.prog, "uEmotionN"),
      uFearMean: loc(gl, this.prog, "uFearMean"),
      uJoyMean: loc(gl, this.prog, "uJoyMean"),
      uGrowth: loc(gl, this.prog, "uGrowth"),
      uTrust: loc(gl, this.prog, "uTrust"),
      uGuestPos: loc(gl, this.prog, "uGuestPos"),
      uGuestVel: loc(gl, this.prog, "uGuestVel"),
      uGuestMorph: loc(gl, this.prog, "uGuestMorph"),
      uGuestHue: loc(gl, this.prog, "uGuestHue"),
      uGuestOn: loc(gl, this.prog, "uGuestOn"),
      uGuestGrowth: loc(gl, this.prog, "uGuestGrowth"),
      uBead0: loc(gl, this.prog, "uBead0"),
      uBead1: loc(gl, this.prog, "uBead1"),
      uBead2: loc(gl, this.prog, "uBead2"),
      uBead3: loc(gl, this.prog, "uBead3"),
      uBeadW: loc(gl, this.prog, "uBeadW"),
      uHandPos: loc(gl, this.prog, "uHandPos"),
      uHandOn: loc(gl, this.prog, "uHandOn"),
      uPortalOpen: loc(gl, this.prog, "uPortalOpen"),
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
    if (this.emaMs > target * 1.12) this.scale = Math.max(0.48, this.scale * 0.94);
    else if (this.emaMs < target * 0.78) this.scale = Math.min(1, this.scale * 1.02);
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, dprCap(this.tier));
    let w = Math.max(1, Math.floor(this.canvas.clientWidth * this.dpr * this.scale));
    let h = Math.max(1, Math.floor(this.canvas.clientHeight * this.dpr * this.scale));
    const budget = pixelBudget(this.tier);
    const pixels = w * h;
    if (pixels > budget) {
      const s = Math.sqrt(budget / pixels);
      w = Math.max(1, Math.floor(w * s));
      h = Math.max(1, Math.floor(h * s));
    }
    this.canvasWidth = w;
    this.canvasHeight = h;
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
    gl.uniform4fv(u.uEmotion, state.emotion);
    gl.uniform1f(u.uEmotionN, state.emotionN);
    gl.uniform1f(u.uFearMean, state.fearMean);
    gl.uniform1f(u.uJoyMean, state.joyMean);
    gl.uniform1f(u.uGrowth, state.growth);
    gl.uniform1f(u.uTrust, state.trust);
    gl.uniform3f(u.uGuestPos, state.guestPos[0], state.guestPos[1], state.guestPos[2]);
    gl.uniform3f(u.uGuestVel, state.guestVel[0], state.guestVel[1], state.guestVel[2]);
    gl.uniform1f(u.uGuestMorph, state.guestMorph);
    gl.uniform1f(u.uGuestHue, state.guestHue);
    gl.uniform1f(u.uGuestOn, state.guestOn);
    gl.uniform1f(u.uGuestGrowth, state.guestGrowth);
    gl.uniform3f(u.uBead0, state.bead0[0], state.bead0[1], state.bead0[2]);
    gl.uniform3f(u.uBead1, state.bead1[0], state.bead1[1], state.bead1[2]);
    gl.uniform3f(u.uBead2, state.bead2[0], state.bead2[1], state.bead2[2]);
    gl.uniform3f(u.uBead3, state.bead3[0], state.bead3[1], state.bead3[2]);
    gl.uniform4f(u.uBeadW, state.beadW[0], state.beadW[1], state.beadW[2], state.beadW[3]);
    gl.uniform3f(u.uHandPos, state.handPos[0], state.handPos[1], state.handPos[2]);
    gl.uniform1f(u.uHandOn, state.handOn);
    gl.uniform1f(u.uPortalOpen, state.portalOpen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
