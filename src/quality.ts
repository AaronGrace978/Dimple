export type QualityId = "auto" | "deck" | "medium" | "high" | "supreme";
export type QualityTier = 0 | 1 | 2 | 3;
export type GpuClass = "software" | "weak" | "strong" | "unknown";

const KEY = "raymarch_quality";

let gpuRenderer = "";

export function isSteamDeck(): boolean {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("deck") === "1" || q.get("steamdeck") === "1") return true;
  } catch {
    /* ignore */
  }
  if (localStorage.getItem("raymarch_deck") === "1") return true;
  if (/SteamOS|Steam Deck/i.test(navigator.userAgent)) return true;
  const w = Math.max(screen.width, screen.height);
  const h = Math.min(screen.width, screen.height);
  return w === 1280 && (h === 800 || h === 720);
}

export function setGpuRenderer(renderer: string): void {
  gpuRenderer = renderer.trim();
}

export function classifyGpu(renderer = gpuRenderer): GpuClass {
  const r = renderer;
  if (!r) return "unknown";
  if (/SwiftShader|llvmpipe|SoftGL|Microsoft Basic Render|GDI Generic|CPU/i.test(r)) {
    return "software";
  }
  if (/NVIDIA|GeForce|RTX|GTX|Quadro|TITAN/i.test(r)) return "strong";
  if (/Radeon\s+RX|AMD Radeon Pro|Radeon Pro/i.test(r)) return "strong";
  if (/Intel\s*\(?R?\)?\s*Arc/i.test(r)) return "strong";
  if (/Apple (M[1-9]|GPU)|ANGLE \(Apple/i.test(r)) return "strong";
  if (/Intel|UHD|Iris|HD Graphics/i.test(r)) return "weak";
  if (/Radeon\s+\d{3,4}M|Radeon Graphics|Vega/i.test(r)) return "weak";
  if (/Mali|Adreno|Xclipse|Apple/i.test(r)) return "weak";
  return "unknown";
}

export function shortGpu(renderer = gpuRenderer): string {
  if (!renderer) return "gpu";
  const rtx = renderer.match(/RTX\s*(\d{3,4})\s*(Laptop|Ti|SUPER)?/i);
  if (rtx) {
    const extra = rtx[2] ? ` ${rtx[2].toLowerCase()}` : "";
    return `rtx ${rtx[1]}${extra}`;
  }
  const gtx = renderer.match(/GTX\s*(\d{3,4})/i);
  if (gtx) return `gtx ${gtx[1]}`;
  if (/Intel/i.test(renderer)) {
    if (/Arc/i.test(renderer)) return "intel arc";
    const uhd = renderer.match(/UHD(?:\s*Graphics)?(?:\s*\d+)?/i);
    if (uhd) return uhd[0].toLowerCase().replace(/\s+/g, " ");
    if (/Iris/i.test(renderer)) return "iris";
    return "intel";
  }
  if (/SwiftShader|llvmpipe|SoftGL|Microsoft Basic/i.test(renderer)) return "software";
  const rx = renderer.match(/Radeon\s+RX\s+\d+\s*\w*/i);
  if (rx) return rx[0].toLowerCase();
  if (/Apple/i.test(renderer)) return "apple gpu";
  return "gpu";
}

export function usingIntegratedGpu(): boolean {
  return classifyGpu() === "weak" || classifyGpu() === "software";
}

export function loadQuality(): QualityId {
  const v = localStorage.getItem(KEY);
  if (v === "auto" || v === "deck" || v === "medium" || v === "high" || v === "supreme") {
    return v;
  }
  return "auto";
}

export function saveQuality(id: QualityId): void {
  localStorage.setItem(KEY, id);
}

function autoQuality(): Exclude<QualityId, "auto"> {
  if (isSteamDeck()) return "deck";
  const kind = classifyGpu();
  if (kind === "software") return "deck";
  if (kind === "weak") return "medium";
  if (kind === "strong") return "high";
  return "medium";
}

export function resolvedQuality(id = loadQuality()): Exclude<QualityId, "auto"> {
  if (id === "auto") return autoQuality();
  return id;
}

export function qualityTier(id = loadQuality()): QualityTier {
  const resolved = resolvedQuality(id);
  if (resolved === "deck") return 0;
  if (resolved === "medium") return 1;
  if (resolved === "supreme") return 3;
  return 2;
}

export function dprCap(tier: QualityTier): number {
  if (tier === 0) return 1;
  if (tier === 1) return 1.25;
  if (tier === 2) return 1.5;
  return 2;
}

export function startScale(tier: QualityTier): number {
  if (tier === 0) return 0.62;
  if (tier === 1) return 0.8;
  if (tier === 2) return 0.85;
  return 0.92;
}

/** Cap internal resolution so QHD/4K laptops don't raymarch 4K. */
export function pixelBudget(tier: QualityTier): number {
  if (tier === 0) return 1280 * 720;
  if (tier === 1) return 1600 * 900;
  if (tier === 2) return 1920 * 1080;
  return 2560 * 1440;
}

/** GPU budget. Deck likes ~40 Hz inside gamescope. */
export function targetFrameMs(tier: QualityTier): number {
  if (tier === 0) return 24;
  return 16.6;
}

export function readWebglRenderer(gl: WebGL2RenderingContext): string {
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  if (ext) {
    const unmasked = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    if (typeof unmasked === "string" && unmasked.trim()) return unmasked;
  }
  const fallback = gl.getParameter(gl.RENDERER);
  return typeof fallback === "string" ? fallback : "";
}
