import "./style.css";
import { Presence } from "./agent";
import { OrbitCamera } from "./camera";
import { add, len, madd, rayHitsSphere, scale, sub, type Vec3 } from "./math";
import {
  appendChat,
  clearMemory,
  loadCompanion,
  loadMemory,
  markSeen,
  setCompanion,
  touchSeen,
} from "./memory";
import { Mind, type FieldSense, type Visitor } from "./mind";
import { clearEmotion, packEmotions, tickEmotion } from "./emotion";
import { bumpChat, bumpPlay, clearGrowth, growthLabel, loadGrowth, loadShape } from "./growth";
import { dropBead, packBeads, clearThoughts } from "./thoughts";
import { clearDreams, packDreams, tickDream } from "./dream";
import { fieldSings, setFieldSings, tickMusic } from "./fieldMusic";
import {
  beacon,
  currentGuest,
  nearPortal,
  portalOn,
  portalStatus,
  rememberEcho,
  setPortalOn,
} from "./portal";
import { mapWorld } from "./sdf";
import { drawFieldMap } from "./map";
import {
  PROVIDERS,
  clearKey,
  hasMind,
  listModels,
  loadKey,
  loadModel,
  loadProviderId,
  providerById,
  saveMindSettings,
  type ProviderId,
} from "./providers";
import {
  ELEVEN_MODELS,
  elevenKey,
  elevenModel,
  elevenVoice,
  listElevenVoices,
  parseTtsEngine,
  setElevenKey,
  setElevenModel,
  setElevenVoice,
  setTtsEnabled,
  setTtsEngine,
  setTtsFieldLines,
  speak,
  stopSpeak,
  ttsEnabled,
  ttsEngine,
  ttsFieldLines,
} from "./tts";
import { pollGamepad } from "./controls";
import { canListen, guardDoubleType, isHoldingTalk, pttStart, pttStop, stopListen, wakeKeyboard, warmMic } from "./listen";
import { chirp, unlockAudio } from "./audio";
import { LOCAL_VOICES, localVoice, onVoiceStatus, prepareLocalVoice, setLocalVoice } from "./voice";
import { onWhisperStatus, prepareWhisper } from "./whisper";
import {
  isSteamDeck,
  loadQuality,
  qualityTier,
  resolvedQuality,
  saveQuality,
  shortGpu,
  usingIntegratedGpu,
  type QualityId,
} from "./quality";
import { Renderer } from "./renderer";

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const boot = document.querySelector("#boot")!;
const fatal = document.querySelector("#fatal")!;
const speechEl = document.querySelector("#speech")!;
const caption = document.querySelector<HTMLElement>("#caption")!;
const statsEl = document.querySelector("#stats")!;
const settings = document.querySelector("#settings")!;
const chatWindow = document.querySelector<HTMLElement>("#chat-window")!;
const chatLog = document.querySelector("#chat-log")!;
const chatInput = document.querySelector<HTMLInputElement>("#chat-input")!;
const companionInput = document.querySelector<HTMLInputElement>("#companion")!;
const providerSelect = document.querySelector<HTMLSelectElement>("#provider")!;
const modelSelect = document.querySelector<HTMLSelectElement>("#model")!;
const customModel = document.querySelector<HTMLInputElement>("#custom-model")!;
const keyInput = document.querySelector<HTMLInputElement>("#api-key")!;
const keyStatus = document.querySelector("#key-status")!;
const hint = document.querySelector("#provider-hint")!;
const ttsEngineSelect = document.querySelector<HTMLSelectElement>("#tts-engine")!;
const ttsOn = document.querySelector<HTMLInputElement>("#tts-on")!;
const ttsField = document.querySelector<HTMLInputElement>("#tts-field")!;
const elevenKeyInput = document.querySelector<HTMLInputElement>("#eleven-key")!;
const elevenModelSelect = document.querySelector<HTMLSelectElement>("#eleven-model")!;
const elevenVoiceSelect = document.querySelector<HTMLSelectElement>("#eleven-voice")!;
const elevenFields = document.querySelector("#eleven-fields")!;
const localFields = document.querySelector("#local-fields")!;
const localVoiceSelect = document.querySelector<HTMLSelectElement>("#local-voice")!;
const muteBtn = document.querySelector("#mute-chat")!;
const hudMute = document.querySelector("#hud-mute")!;
const guide = document.querySelector("#guide")!;
const minBtn = document.querySelector("#min-chat")!;
const talkBtn = document.querySelector("#talk-chat")!;
const openTalk = document.querySelector("#open-talk")!;
const qualitySelect = document.querySelector<HTMLSelectElement>("#quality")!;
const helpKeys = document.querySelector("#help-keys")!;
const fieldSingsEl = document.querySelector<HTMLInputElement>("#field-sings")!;
const portalOnEl = document.querySelector<HTMLInputElement>("#portal-on")!;
const thoughtsEl = document.querySelector<HTMLElement>("#thoughts")!;
const fieldMap = document.querySelector("#field-map")!;
const minimap = document.querySelector<HTMLCanvasElement>("#minimap")!;
const expandMap = document.querySelector("#expand-map")!;

function fail(message: string): never {
  boot.classList.add("hidden");
  fatal.classList.remove("hidden");
  fatal.textContent = message;
  throw new Error(message);
}

let renderer: Renderer;
try {
  renderer = new Renderer(canvas);
} catch (err) {
  fail(err instanceof Error ? err.message : "WebGL2 failed to start.");
}

const presence = new Presence();
const camera = new OrbitCamera();
const mind = new Mind();
let visitor: Visitor = null;
let visitorAge = 0;
let lastSpoken = "";
let chatting = false;
let pointerLook: Vec3 | null = null;
let pointerLookAt = 0;
let lastMood = "";
let handPos: Vec3 = [0, 0.4, 0];
let handOn = 0;
let lastBead = "";
const homecoming = markSeen();
presence.affection = homecoming.affection;
syncGrowth();
let welcomePending = homecoming.hoursAway > 2;

function syncGrowth(): void {
  const shape = loadShape();
  presence.growth = loadGrowth();
  presence.chatGrowth = shape.chat;
  presence.playGrowth = shape.play;
}

function sense(): FieldSense {
  return {
    visitor,
    cam: camera.pos,
    chatting: !chatWindow.classList.contains("hidden"),
  };
}

function agentRadius(): number {
  return (
    0.16 +
    presence.growth * 0.14 +
    presence.playGrowth * 0.14 +
    presence.morph * 0.08 +
    presence.iso * 0.06
  );
}

function lookTarget(time: number): Vec3 {
  if (presence.mood === "sleep") {
    return [presence.pos[0], presence.pos[1] - 0.55, presence.pos[2]];
  }
  if (visitor && (presence.mood === "play" || presence.mood === "seek")) {
    return visitor.pos;
  }
  if (pointerLook && time - pointerLookAt < 1.8) return pointerLook;
  return camera.pos;
}

function noteSpeech(text: string, fromField = false): void {
  lastSpoken = text;
  appendChat("dimple", text);
  if (!chatWindow.classList.contains("hidden")) renderChat();
  speakDimple(text, fromField);
}

function petDimple(): void {
  void unlockAudio();
  const time = performance.now() / 1000;
  const waking = mind.asleep();
  const line = mind.pet(presence, time, camera.pos);
  presence.applyIntent(mind.tick(presence, time, sense()));
  presence.growth = bumpPlay(0.018);
  syncGrowth();
  noteSpeech(line);
  chirp(waking ? "wake" : "pet");
}

function placeVisitor(nx: number, ny: number): void {
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const { ro, rd } = camera.rayFromNdc(nx, ny, aspect);
  if (Math.abs(rd[1]) < 1e-4) return;
  const t = -ro[1] / rd[1];
  if (t < 0.05 || t > 40) return;
  const hit = add(ro, scale(rd, t));
  if (Math.hypot(hit[0], hit[2]) > 8.6) return;
  visitor = { pos: [hit[0], 0.12, hit[2]] };
  visitorAge = 0;
  const time = performance.now() / 1000;
  const waking = mind.asleep();
  mind.touch(time);
  presence.startle();
  bumpPlay(0.01);
  syncGrowth();
  const intent = mind.tick(presence, time, sense(), true);
  presence.applyIntent(intent);
  if (waking) {
    const dreamed = mind.takeWakeLine();
    if (dreamed) noteSpeech(dreamed);
    chirp("wake");
  }
}

function onFieldClick(nx: number, ny: number): void {
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const { ro, rd } = camera.rayFromNdc(nx, ny, aspect);
  const tAgent = rayHitsSphere(ro, rd, presence.pos, agentRadius());
  let tFloor = -1;
  if (Math.abs(rd[1]) >= 1e-4) {
    const t = -ro[1] / rd[1];
    if (t > 0.05 && t < 40) tFloor = t;
  }
  if (tAgent > 0 && (tFloor < 0 || tAgent < tFloor + 0.25)) {
    petDimple();
    return;
  }
  placeVisitor(nx, ny);
}

function applyReach(
  nx: number,
  ny: number,
  dx: number,
  dy: number,
  phase: "start" | "move" | "end",
): void {
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const { ro, rd } = camera.rayFromNdc(nx, ny, aspect);
  const hit = rayHitsSphere(ro, rd, presence.pos, agentRadius() + 0.18);
  const t = hit > 0 ? hit : 2.4;
  handPos = add(ro, scale(rd, t));
  handOn = 1;
  if (phase === "end") {
    handOn = 0.4;
    return;
  }
  const right = camera.flatRight();
  const fwd = camera.flatFwd();
  const force = madd(scale(right, dx * 0.045), fwd, -dy * 0.045);
  const strength = Math.min(3.8, len(force) * 9);
  if (strength < 0.04 && phase !== "start") return;
  presence.push(force, Math.max(0.35, strength));
  if (presence.trust > 0.4) {
    presence.push(sub(handPos, presence.pos), 0.55);
  }
  mind.feelForce(presence, performance.now() / 1000, strength, camera.pos);
  void unlockAudio();
}

camera.attach(canvas, onFieldClick, {
  mode: (nx, ny) => {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const { ro, rd } = camera.rayFromNdc(nx, ny, aspect);
    return rayHitsSphere(ro, rd, presence.pos, agentRadius() + 0.12) > 0 ? "reach" : "orbit";
  },
  onReach: applyReach,
});

function selectedProvider(): ProviderId {
  return providerById(providerSelect.value).id;
}

function fillProviders(): void {
  providerSelect.innerHTML = "";
  for (const p of PROVIDERS) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    providerSelect.append(opt);
  }
  providerSelect.value = loadProviderId();
}

function fillModels(ids: string[], selected?: string): void {
  const current = selected ?? loadModel(selectedProvider());
  modelSelect.innerHTML = "";
  const unique = [...new Set(ids.filter(Boolean))];
  if (current && !unique.includes(current)) unique.unshift(current);
  for (const id of unique) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    modelSelect.append(opt);
  }
  modelSelect.value = unique.includes(current) ? current : (unique[0] ?? "");
}

function syncPanel(): void {
  const p = providerById(selectedProvider());
  companionInput.value = loadCompanion();
  hint.textContent = `${p.hint}. Dimple is always alive. Bind a key and he thinks with the field. No .env needed.`;
  keyInput.placeholder = p.needsKey ? p.keyPlaceholder : "(none)";
  keyInput.disabled = !p.needsKey;
  fillModels(p.catalog, loadModel(p.id));
  customModel.value = "";
  const bound = hasMind(p.id);
  keyStatus.textContent = bound
    ? `bound · ${p.label} · ${loadModel(p.id)}`
    : p.needsKey
      ? "unbound — Dimple on local mind"
      : "local ollama — no key";
  mind.reload();
}

function renderChat(): void {
  const mem = loadMemory();
  chatLog.innerHTML = "";
  for (const line of mem.chat) {
    const p = document.createElement("p");
    p.className = line.role;
    p.textContent = (line.role === "dimple" ? "dimple  " : "you  ") + line.text;
    chatLog.append(p);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function seedDimple(): void {
  if (loadMemory().chat.length > 0) return;
  appendChat("dimple", "hey. i'm dimple. this field is home. click me or talk.");
}

const CHAT_UI = "raymarch_chat_ui";

function loadChatUi(): { x: number; y: number; min: boolean } | null {
  try {
    const raw = localStorage.getItem(CHAT_UI);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x?: number; y?: number; min?: boolean };
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return { x: parsed.x, y: parsed.y, min: Boolean(parsed.min) };
  } catch {
    return null;
  }
}

function saveChatUi(): void {
  const rect = chatWindow.getBoundingClientRect();
  localStorage.setItem(
    CHAT_UI,
    JSON.stringify({
      x: rect.left,
      y: rect.top,
      min: chatWindow.classList.contains("min"),
    }),
  );
}

function placeChat(x: number, y: number): void {
  const maxX = window.innerWidth - 80;
  const maxY = window.innerHeight - 40;
  chatWindow.style.left = `${Math.min(maxX, Math.max(8, x))}px`;
  chatWindow.style.top = `${Math.min(maxY, Math.max(8, y))}px`;
  chatWindow.style.bottom = "auto";
}

function restoreChat(): void {
  if (isSteamDeck() || qualityTier() === 0) return;
  const ui = loadChatUi();
  if (!ui) return;
  placeChat(ui.x, ui.y);
  chatWindow.classList.toggle("min", ui.min);
  minBtn.textContent = ui.min ? "max" : "min";
}

function syncMute(): void {
  const on = ttsEnabled();
  muteBtn.textContent = on ? "voice" : "muted";
  hudMute.textContent = on ? "mute" : "muted";
  hudMute.classList.toggle("quiet", !on);
  ttsOn.checked = on;
  if (!on) caption.classList.remove("on");
}

function toggleMute(): void {
  setTtsEnabled(!ttsEnabled());
  syncMute();
}

function toggleGuide(): void {
  const opening = guide.classList.contains("hidden");
  guide.classList.toggle("hidden");
  if (opening) {
    settings.classList.add("hidden");
    fieldMap.classList.remove("big");
    expandMap.textContent = "open";
  }
}

function speakDimple(text: string, fromField = false): void {
  if (fromField && !ttsFieldLines()) return;
  void speak(text, presence.mood);
  if (text && text !== lastBead) {
    lastBead = text;
    dropBead(presence.pos, text, presence.mood, presence.hue);
    bumpChat(0.012);
    syncGrowth();
  }
}

function fillTts(): void {
  ttsEngineSelect.value = ttsEngine();
  ttsOn.checked = ttsEnabled();
  ttsField.checked = ttsFieldLines();
  fieldSingsEl.checked = fieldSings();
  portalOnEl.checked = portalOn();
  elevenModelSelect.innerHTML = "";
  for (const id of ELEVEN_MODELS) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    elevenModelSelect.append(opt);
  }
  elevenModelSelect.value = elevenModel();
  localVoiceSelect.innerHTML = "";
  for (const v of LOCAL_VOICES) {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.name;
    localVoiceSelect.append(opt);
  }
  localVoiceSelect.value = localVoice();
  syncTtsFields();
  syncMute();
}

function syncTtsFields(): void {
  const engine = parseTtsEngine(ttsEngineSelect.value);
  elevenFields.classList.toggle("hidden", engine !== "elevenlabs");
  localFields.classList.toggle("hidden", engine === "elevenlabs");
}

function voiceLabel(): string {
  const engine = ttsEngine();
  if (engine === "elevenlabs" && elevenKey()) return "voice bound · ElevenLabs";
  if (engine === "browser") return "voice · browser TTS";
  return `voice · local ${LOCAL_VOICES.find((v) => v.id === localVoice())?.name ?? "Kokoro"}`;
}

async function fillVoices(): Promise<void> {
  const voices = await listElevenVoices(elevenKeyInput.value.trim() || elevenKey());
  const current = elevenVoice();
  elevenVoiceSelect.innerHTML = "";
  for (const v of voices) {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.name;
    elevenVoiceSelect.append(opt);
  }
  elevenVoiceSelect.value = voices.some((v) => v.id === current)
    ? current
    : (voices[0]?.id ?? "");
}

function typing(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

async function refreshModels(): Promise<void> {
  const p = providerById(selectedProvider());
  keyStatus.textContent = "pulling latest models…";
  const ids = await listModels(p.id, keyInput.value.trim() || loadKey(p.id));
  fillModels(ids);
  keyStatus.textContent = `${ids.length} models · ${p.label}`;
}

function bind(): void {
  const p = providerById(selectedProvider());
  const model = customModel.value.trim() || modelSelect.value || p.defaultModel;
  saveMindSettings(p.id, model, keyInput.value);
  if (companionInput.value.trim()) setCompanion(companionInput.value);
  keyInput.value = "";
  customModel.value = "";
  fillModels([...p.catalog, model], model);
  mind.reload();
  syncPanel();
  void refreshModels();
}

function applyChrome(): void {
  const deck = isSteamDeck() || qualityTier() === 0;
  document.body.classList.toggle("deck", deck);
  qualitySelect.value = loadQuality();
  helpKeys.textContent = deck
    ? "HOLD X/L1/L2 talk · SELECT map · D-pad left mute · A chat"
    : "M mute · N map · H guide · click pet · HOLD T talk · P pet";
}

function qualityNote(): string {
  const resolved = resolvedQuality();
  const gpu = shortGpu();
  if (usingIntegratedGpu()) {
    return `quality · ${resolved} · ${gpu} (the RTX may be asleep — pick NVIDIA high-performance for Dimple)`;
  }
  return `quality · ${resolved} · ${gpu}`;
}

function toggleSettings(): void {
  settings.classList.toggle("hidden");
  if (!settings.classList.contains("hidden")) {
    guide.classList.add("hidden");
    fieldMap.classList.remove("big");
    expandMap.textContent = "open";
    if (!isSteamDeck()) companionInput.focus();
  }
}

function toggleChat(forceOpen = false, opts?: { focus?: boolean }): void {
  if (forceOpen) chatWindow.classList.remove("hidden");
  else chatWindow.classList.toggle("hidden");
  if (!chatWindow.classList.contains("hidden")) {
    chatWindow.classList.remove("min");
    minBtn.textContent = "min";
    restoreChat();
    renderChat();
    if (opts?.focus !== false) wakeKeyboard(chatInput);
  } else {
    chatInput.blur();
  }
}

function closePanels(): void {
  settings.classList.add("hidden");
  guide.classList.add("hidden");
  fieldMap.classList.remove("big");
  expandMap.textContent = "open";
  chatWindow.classList.add("hidden");
  chatInput.blur();
  stopListen();
  talkBtn.classList.remove("hot");
}

function toggleMap(): void {
  const opening = !fieldMap.classList.contains("big");
  fieldMap.classList.toggle("big", opening);
  expandMap.textContent = opening ? "hide" : "open";
  if (opening) {
    settings.classList.add("hidden");
    guide.classList.add("hidden");
  }
}

function sendChat(text: string): void {
  const said = text.trim();
  if (!said || chatting) return;
  void unlockAudio();
  chatInput.value = "";
  appendChat("you", said);
  renderChat();
  chatting = true;
  void mind
    .converse(said, presence, performance.now() / 1000, sense())
    .then((reply) => {
      appendChat("dimple", reply);
      lastSpoken = reply;
      presence.applyIntent({
        wish: presence.wish,
        iso: presence.targetIso,
        morph: presence.targetMorph,
        speech: reply,
        mood: "seek",
      });
      renderChat();
      speakDimple(reply);
      bumpChat(0.02);
      syncGrowth();
    })
    .finally(() => {
      chatting = false;
    });
}

function sendTyped(): void {
  const text = chatInput.value.trim();
  if (text) sendChat(text);
}

function setTalkUi(label: string, hot: boolean): void {
  talkBtn.textContent = label;
  talkBtn.classList.toggle("hot", hot);
  openTalk.textContent = hot ? "…" : "talk";
}

async function beginPtt(): Promise<void> {
  if (isHoldingTalk()) return;
  chatInput.blur();
  if (!canListen()) {
    setTalkUi("no mic", false);
    keyStatus.textContent = "mic blocked — check Steam mic permission";
    return;
  }
  setTalkUi("listening", true);
  speechEl.textContent = "listening… hold X";
  caption.classList.add("on");
  await pttStart((s) => {
    keyStatus.textContent = s;
    speechEl.textContent = s;
    caption.classList.add("on");
    if (s.startsWith("hold") || s.startsWith("listening")) setTalkUi("listening", true);
  });
}

async function endPtt(): Promise<void> {
  if (!isHoldingTalk()) return;
  setTalkUi("whisper…", true);
  const said = await pttStop((s) => {
    keyStatus.textContent = s;
    speechEl.textContent = s;
    caption.classList.add("on");
  });
  setTalkUi("hold talk", false);
  if (said) sendChat(said);
}

function bindPtt(el: HTMLElement): void {
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    void beginPtt();
  });
  el.addEventListener("pointerup", () => {
    void endPtt();
  });
  el.addEventListener("pointercancel", () => {
    void endPtt();
  });
  el.addEventListener("click", (e) => e.preventDefault());
}

function attachDrag(
  windowEl: HTMLElement,
  handle: HTMLElement,
  persist: () => void,
): void {
  let dragging = false;
  let dx = 0;
  let dy = 0;
  handle.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = windowEl.getBoundingClientRect();
    dragging = true;
    dx = e.clientX - rect.left;
    dy = e.clientY - rect.top;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const maxX = window.innerWidth - 80;
    const maxY = window.innerHeight - 40;
    windowEl.style.left = `${Math.min(maxX, Math.max(8, e.clientX - dx))}px`;
    windowEl.style.top = `${Math.min(maxY, Math.max(8, e.clientY - dy))}px`;
    windowEl.style.bottom = "auto";
    windowEl.style.transform = "none";
  });
  handle.addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;
    persist();
  });
}

const CAPTION_UI = "raymarch_caption_ui";

function saveCaptionUi(): void {
  const rect = caption.getBoundingClientRect();
  localStorage.setItem(
    CAPTION_UI,
    JSON.stringify({
      x: rect.left,
      y: rect.top,
      parked: caption.classList.contains("parked"),
    }),
  );
}

function restoreCaption(): void {
  try {
    const raw = localStorage.getItem(CAPTION_UI);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { x?: number; y?: number; parked?: boolean };
    if (parsed.parked) caption.classList.add("parked");
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      caption.style.left = `${parsed.x}px`;
      caption.style.top = `${parsed.y}px`;
      caption.style.bottom = "auto";
      caption.style.transform = "none";
    }
  } catch {
    /* keep default */
  }
}

fillProviders();
syncPanel();
fillTts();
void fillVoices();
void prepareWhisper()
  .then(() => prepareLocalVoice())
  .catch(() => undefined);
window.addEventListener("pagehide", () => {
  touchSeen();
});
window.addEventListener("pointerdown", () => {
  void unlockAudio();
  warmMic();
}, { once: true });
window.addEventListener("keydown", () => {
  void unlockAudio();
  warmMic();
}, { once: true });
window.addEventListener("gamepadconnected", () => {
  warmMic();
});
seedDimple();
renderChat();
restoreChat();
restoreCaption();
applyChrome();
renderer.applyQuality();
keyStatus.textContent = qualityNote();
guardDoubleType(chatInput);
setTalkUi("hold talk", false);
onWhisperStatus((s) => {
  keyStatus.textContent = s;
});
onVoiceStatus((s) => {
  keyStatus.textContent = s;
});
attachDrag(chatWindow, document.querySelector("#chat-drag")!, saveChatUi);
attachDrag(caption, document.querySelector("#caption-drag")!, saveCaptionUi);
syncMute();

document.querySelector("#open-chat")!.addEventListener("click", () => toggleChat(true));
document.querySelector("#open-settings")!.addEventListener("click", toggleSettings);
document.querySelector("#open-guide")!.addEventListener("click", toggleGuide);
document.querySelector("#close-guide")!.addEventListener("click", () => guide.classList.add("hidden"));
document.querySelector("#open-map")!.addEventListener("click", toggleMap);
expandMap.addEventListener("click", toggleMap);
minimap.addEventListener("click", toggleMap);
hudMute.addEventListener("click", toggleMute);
bindPtt(openTalk as HTMLElement);
bindPtt(talkBtn as HTMLElement);
qualitySelect.addEventListener("change", () => {
  saveQuality(qualitySelect.value as QualityId);
  renderer.applyQuality();
  applyChrome();
  keyStatus.textContent = qualityNote();
});
document.querySelector("#close-settings")!.addEventListener("click", () => {
  settings.classList.add("hidden");
});
document.querySelector("#open-caption")!.addEventListener("click", () => {
  caption.classList.remove("parked");
  saveCaptionUi();
});
document.querySelector("#hide-caption")!.addEventListener("click", () => {
  caption.classList.add("parked");
  saveCaptionUi();
});
document.querySelector("#close-chat")!.addEventListener("click", () => {
  chatWindow.classList.add("hidden");
  stopSpeak();
});
minBtn.addEventListener("click", () => {
  chatWindow.classList.toggle("min");
  minBtn.textContent = chatWindow.classList.contains("min") ? "max" : "min";
  saveChatUi();
});
muteBtn.addEventListener("click", toggleMute);

companionInput.addEventListener("change", () => {
  setCompanion(companionInput.value);
});

providerSelect.addEventListener("change", () => {
  saveMindSettings(selectedProvider(), loadModel(selectedProvider()), "");
  syncPanel();
  mind.reload();
});

modelSelect.addEventListener("change", () => {
  saveMindSettings(selectedProvider(), modelSelect.value, "");
  mind.reload();
});

document.querySelector("#save-key")!.addEventListener("click", bind);
document.querySelector("#refresh-models")!.addEventListener("click", () => {
  void refreshModels();
});
document.querySelector("#clear-key")!.addEventListener("click", () => {
  clearKey(selectedProvider());
  mind.reload();
  syncPanel();
});
document.querySelector("#clear-memory")!.addEventListener("click", () => {
  clearMemory();
  clearEmotion();
  clearThoughts();
  clearGrowth();
  clearDreams();
  syncGrowth();
  seedDimple();
  renderChat();
  companionInput.value = "";
  keyStatus.textContent = "Dimple forgot. he's still here.";
});

document.querySelector("#save-tts")!.addEventListener("click", () => {
  setTtsEngine(parseTtsEngine(ttsEngineSelect.value));
  setTtsEnabled(ttsOn.checked);
  setTtsFieldLines(ttsField.checked);
  setLocalVoice(localVoiceSelect.value);
  setElevenKey(elevenKeyInput.value);
  setElevenModel(elevenModelSelect.value);
  setElevenVoice(elevenVoiceSelect.value);
  elevenKeyInput.value = "";
  syncMute();
  syncTtsFields();
  void fillVoices();
  keyStatus.textContent = voiceLabel();
  void unlockAudio();
  if (ttsEnabled()) void speak("hey. i'm dimple. this field is home.", presence.mood);
});

document.querySelector("#test-tts")!.addEventListener("click", () => {
  setTtsEngine(parseTtsEngine(ttsEngineSelect.value));
  setTtsEnabled(true);
  ttsOn.checked = true;
  setLocalVoice(localVoiceSelect.value);
  if (elevenKeyInput.value.trim()) setElevenKey(elevenKeyInput.value);
  setElevenModel(elevenModelSelect.value);
  setElevenVoice(elevenVoiceSelect.value);
  syncMute();
  syncTtsFields();
  void unlockAudio();
  void speak("hey. i'm dimple. this field is home.", presence.mood);
});

ttsOn.addEventListener("change", () => {
  setTtsEnabled(ttsOn.checked);
  syncMute();
});
ttsField.addEventListener("change", () => setTtsFieldLines(ttsField.checked));
fieldSingsEl.addEventListener("change", () => setFieldSings(fieldSingsEl.checked));
portalOnEl.addEventListener("change", () => setPortalOn(portalOnEl.checked));
ttsEngineSelect.addEventListener("change", () => {
  setTtsEngine(parseTtsEngine(ttsEngineSelect.value));
  syncTtsFields();
});
localVoiceSelect.addEventListener("change", () => setLocalVoice(localVoiceSelect.value));
elevenVoiceSelect.addEventListener("change", () => setElevenVoice(elevenVoiceSelect.value));
elevenModelSelect.addEventListener("change", () => setElevenModel(elevenModelSelect.value));

document.querySelector("#chat-form")!.addEventListener("submit", (e) => {
  e.preventDefault();
  sendTyped();
});

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (typing()) {
    if (e.key === "Escape") {
      settings.classList.add("hidden");
      guide.classList.add("hidden");
      fieldMap.classList.remove("big");
      expandMap.textContent = "open";
      chatWindow.classList.add("hidden");
      chatInput.blur();
    }
    return;
  }
  if (e.key === "f" || e.key === "F") camera.follow = !camera.follow;
  if (e.key === "s" || e.key === "S" || e.key === "k" || e.key === "K") toggleSettings();
  if (e.key === "c" || e.key === "C") toggleChat();
  if (e.key === "m" || e.key === "M") toggleMute();
  if (e.key === "n" || e.key === "N") toggleMap();
  if (e.key === "h" || e.key === "H" || e.key === "?") toggleGuide();
  if (e.key === "t" || e.key === "T" || e.key === "x" || e.key === "X") void beginPtt();
  if (e.key === "p" || e.key === "P") petDimple();
  if (e.key === "l" || e.key === "L") {
    mind.useLlm = !mind.useLlm && hasMind(mind.provider);
    keyStatus.textContent = mind.useLlm
      ? `bound · ${providerById(mind.provider).label} · ${mind.model}`
      : "remote mind off — Dimple local";
  }
  if (e.key === "Escape") {
    closePanels();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "t" || e.key === "T" || e.key === "x" || e.key === "X") void endPtt();
});

canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const { ro, rd } = camera.rayFromNdc(nx, ny, aspect);
  const tAgent = rayHitsSphere(ro, rd, presence.pos, agentRadius());
  canvas.style.cursor = tAgent > 0 ? "pointer" : "crosshair";
  const along = tAgent > 0 ? tAgent : Math.max(0.4, Math.hypot(presence.pos[0] - ro[0], presence.pos[1] - ro[1], presence.pos[2] - ro[2]));
  pointerLook = add(ro, scale(rd, along));
  pointerLookAt = performance.now() / 1000;
});

function paintThoughts(from: Vec3): ReturnType<typeof packBeads> {
  const packed = packBeads(from);
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const cap = qualityTier() === 0 ? 2 : 5;
  const show = packed.labels.slice(0, cap).filter((b) => {
    const d = Math.hypot(b.pos[0] - from[0], b.pos[1] - from[1], b.pos[2] - from[2]);
    return d < 3.4;
  });
  while (thoughtsEl.childNodes.length > show.length) {
    thoughtsEl.removeChild(thoughtsEl.lastChild!);
  }
  while (thoughtsEl.childNodes.length < show.length) {
    thoughtsEl.append(document.createElement("span"));
  }
  show.forEach((b, i) => {
    const el = thoughtsEl.childNodes[i] as HTMLElement;
    const p = camera.project(b.pos, aspect);
    if (!p || p.nx < -0.05 || p.nx > 1.05 || p.ny < -0.05 || p.ny > 1.05) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    el.style.left = `${p.nx * 100}%`;
    el.style.top = `${p.ny * 100}%`;
    el.textContent = b.word;
  });
  return packed;
}

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  renderer.noteFrame(now - last);
  last = now;
  const time = now / 1000;

  if (visitor) {
    visitorAge += dt;
    visitor.pos[1] = 0.12 + Math.abs(Math.sin(time * 5.4)) * 0.1;
    if (visitorAge > 14) visitor = null;
  }

  if (welcomePending && time > 1.5) {
    welcomePending = false;
    const name = loadCompanion() || "you";
    const line =
      homecoming.hoursAway > 24
        ? `${name}. the moons went around without you. hi.`
        : `you were gone. i kept the isolevel warm.`;
    mind.greet(presence, time, camera.pos, line);
    noteSpeech(line);
    chirp("wake");
  }

  const intent = mind.tick(presence, time, sense());
  presence.applyIntent(intent);
  presence.gaze(lookTarget(time));
  presence.tick(dt, time);
  tickEmotion(presence.sleep);
  tickDream(presence.sleep, dt);
  camera.tick(presence.pos, dt);
  pollGamepad(camera, {
    chatOpen: () => !chatWindow.classList.contains("hidden"),
    typing,
    openChat: () => toggleChat(true),
    closePanels,
    toggleSettings,
    toggleFollow: () => {
      camera.follow = !camera.follow;
    },
    pttStart: () => {
      void beginPtt();
    },
    pttStop: () => {
      void endPtt();
    },
    tapCenter: () => placeVisitor(0.5, 0.62),
    pet: petDimple,
    toggleMute,
    toggleGuide,
    toggleMap,
    push: (lx, ly, gx, gy) => {
      const right = camera.flatRight();
      const fwd = camera.flatFwd();
      const dir = madd(scale(right, lx + gx * 0.7), fwd, -ly + gy * 0.45);
      const strength = Math.min(3.2, 1.1 + len(dir) * 1.4);
      presence.push(dir, strength);
      handOn = 1;
      handPos = madd(presence.pos, dir, 0.32);
      mind.feelForce(presence, time, strength, camera.pos);
    },
  }, dt);

  handOn = Math.max(0, handOn - dt * 1.8);
  syncGrowth();
  const snap = presence.snapshot();
  const visitorPos: Vec3 = visitor?.pos ?? [0, 0, 0];
  const feelings = packEmotions();
  const dreams = packDreams();
  const beads = paintThoughts(snap.pos);
  const selfNear = nearPortal(snap.pos);
  const guest = currentGuest(selfNear);
  const portalOpen = guest ? 1 : selfNear ? 0.45 : 0.08;
  void beacon({
    id: "self",
    pos: snap.pos,
    vel: snap.vel,
    morph: snap.morph,
    hue: snap.hue,
    pulse: snap.pulse,
    thought: snap.thought,
    growth: snap.growth,
    chat: snap.chatGrowth,
    play: snap.playGrowth,
    sleep: snap.sleep,
    look: snap.look,
    mood: snap.mood,
    word: snap.speech || beads.labels[0]?.word || "",
    nearPortal: selfNear,
  });
  if (selfNear) {
    rememberEcho({
      pos: snap.pos,
      vel: snap.vel,
      morph: snap.morph,
      hue: snap.hue,
      pulse: snap.pulse,
      thought: snap.thought,
      growth: snap.growth,
      chat: snap.chatGrowth,
      play: snap.playGrowth,
      sleep: snap.sleep,
      look: snap.look,
      mood: snap.mood,
      word: snap.speech,
    });
  }

  tickMusic({
    field: mapWorld(snap.pos, time),
    mood: snap.mood,
    fear: feelings.fear,
    joy: feelings.joy,
    growth: snap.growth,
    iso: snap.iso,
  });

  renderer.draw({
    time,
    camPos: camera.pos,
    camTarget: camera.target,
    agentPos: snap.pos,
    agentVel: snap.vel,
    morph: snap.morph,
    hue: snap.hue,
    pulse: snap.pulse,
    thought: Math.max(snap.thought, mind.thinking ? 0.7 : 0),
    visitorPos,
    visitorOn: visitor ? 1 : 0,
    trail0: snap.trail0,
    trail1: snap.trail1,
    trail2: snap.trail2,
    trailW: snap.trailW,
    lookAt: snap.look,
    affection: snap.affection,
    sleep: snap.sleep,
    growth: snap.growth,
    chatGrowth: snap.chatGrowth,
    playGrowth: snap.playGrowth,
    trust: snap.trust,
    emotion: feelings.data,
    emotionN: feelings.count,
    fearMean: feelings.fear,
    joyMean: feelings.joy,
    guestPos: guest?.pos ?? [0, -8, 0],
    guestVel: guest?.vel ?? [0, 0, 0],
    guestMorph: guest?.morph ?? 0,
    guestHue: guest?.hue ?? 0.62,
    guestOn: guest ? 1 : 0,
    guestGrowth: guest?.growth ?? 0.3,
    guestChat: guest?.chat ?? 0.2,
    guestPlay: guest?.play ?? 0.2,
    bead0: beads.p0,
    bead1: beads.p1,
    bead2: beads.p2,
    bead3: beads.p3,
    beadW: beads.w,
    handPos,
    handOn,
    portalOpen,
    dream: dreams.data,
    dreamN: dreams.count,
  });
  boot.classList.add("hidden");

  if (snap.mood === "sleep" && lastMood !== "sleep") chirp("sleep");
  lastMood = snap.mood;

  const remote =
    hasMind(mind.provider) && mind.useLlm
      ? mind.thinking
        ? "thinking"
        : mind.provider
      : "local";
  const field =
    qualityTier() === 0 ? " · deck" : qualityTier() === 3 ? " · supreme" : "";
  const guestNote = guest ? ` · ${portalStatus(guest)}` : selfNear ? " · portal open" : "";
  statsEl.textContent = `dimple · iso ${snap.iso.toFixed(2)} · ${snap.mood} · ${growthLabel(snap.growth, loadShape())} · ${remote} · ${Math.round(renderer.fps)}fps · ${renderer.canvasWidth}x${renderer.canvasHeight} · ${shortGpu()}${field}${guestNote}`;
  drawFieldMap(minimap, {
    dimple: snap.pos,
    you: camera.pos,
    yaw: camera.yaw,
    pebble: visitor?.pos ?? null,
    guest: guest?.pos ?? null,
    asleep: snap.sleep > 0.45,
    expanded: fieldMap.classList.contains("big"),
  });
  if (snap.speech) {
    speechEl.textContent = snap.speech;
    caption.classList.toggle("on", ttsEnabled());
    if (snap.speech !== lastSpoken) {
      lastSpoken = snap.speech;
      if (ttsEnabled()) {
        appendChat("dimple", snap.speech);
        if (!chatWindow.classList.contains("hidden")) renderChat();
        speakDimple(snap.speech, true);
      }
    }
  } else {
    caption.classList.remove("on");
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
