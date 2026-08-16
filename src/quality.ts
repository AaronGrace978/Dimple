export type QualityId = "auto" | "deck" | "medium" | "high";
export type QualityTier = 0 | 1 | 2;

const KEY = "raymarch_quality";

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

export function loadQuality(): QualityId {
  const v = localStorage.getItem(KEY);
  if (v === "auto" || v === "deck" || v === "medium" || v === "high") return v;
  return "auto";
}

export function saveQuality(id: QualityId): void {
  localStorage.setItem(KEY, id);
}

export function resolvedQuality(id = loadQuality()): Exclude<QualityId, "auto"> {
  if (id === "auto") return isSteamDeck() ? "deck" : "high";
  return id;
}

export function qualityTier(id = loadQuality()): QualityTier {
  const resolved = resolvedQuality(id);
  if (resolved === "deck") return 0;
  if (resolved === "medium") return 1;
  return 2;
}

export function dprCap(tier: QualityTier): number {
  if (tier === 0) return 1;
  if (tier === 1) return 1.25;
  return 1.5;
}

export function startScale(tier: QualityTier): number {
  if (tier === 0) return 0.62;
  if (tier === 1) return 0.85;
  return 1;
}

/** GPU budget. Deck likes ~40 Hz inside gamescope. */
export function targetFrameMs(tier: QualityTier): number {
  if (tier === 0) return 24;
  return 16.6;
}
