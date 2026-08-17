import "./style.css";
import { Presence } from "./agent";
import { OrbitCamera } from "./camera";
import { add, rayHitsSphere, scale, type Vec3 } from "./math";
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
const minBtn = document.querySelector("#min-chat")!;
const talkBtn = document.querySelector("#talk-chat")!;
const openTalk = document.querySelector("#open-talk")!;
const qualitySelect = document.querySelector<HTMLSelectElement>("#quality")!;
const helpKeys = document.querySelector("#help-keys")!;

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
const homecoming = markSeen();
presence.affection = homecoming.affection;
let welcomePending = homecoming.hoursAway > 2;

function sense(): FieldSense {
  return {
    visitor,
    cam: camera.pos,
    chatting: !chatWindow.classList.contains("hidden"),
  };
}

function agentRadius(): number {
  return 0.3 + presence.morph * 0.1 + presence.iso * 0.08;
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
  const intent = mind.tick(presence, time, sense(), true);
  presence.applyIntent(intent);
  if (waking) chirp("wake");
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

camera.attach(canvas, onFieldClick);

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
  muteBtn.textContent = ttsEnabled() ? "voice" : "muted";
}

function speakDimple(text: string, fromField = false): void {
  if (fromField && !ttsFieldLines()) return;
  void speak(text);
}

function fillTts(): void {
  ttsEngineSelect.value = ttsEngine();
  ttsOn.checked = ttsEnabled();
  ttsField.checked = ttsFieldLines();
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
    ? "HOLD X / L1 / L2 talk · D-pad up pet · A chat · Y follow"
    : "drag orbit · click Dimple to pet · HOLD T talk · C chat · P pet";
}

function toggleSettings(): void {
  settings.classList.toggle("hidden");
  if (!settings.classList.contains("hidden") && !isSteamDeck()) {
    companionInput.focus();
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
  chatWindow.classList.add("hidden");
  chatInput.blur();
  stopListen();
  talkBtn.classList.remove("hot");
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
bindPtt(openTalk as HTMLElement);
bindPtt(talkBtn as HTMLElement);
qualitySelect.addEventListener("change", () => {
  saveQuality(qualitySelect.value as QualityId);
  renderer.applyQuality();
  applyChrome();
  keyStatus.textContent = `quality · ${resolvedQuality()}`;
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
muteBtn.addEventListener("click", () => {
  setTtsEnabled(!ttsEnabled());
  ttsOn.checked = ttsEnabled();
  syncMute();
  if (!ttsEnabled()) stopSpeak();
});

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
  if (ttsEnabled()) void speak("hey. i'm dimple. this field is home.");
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
  void speak("hey. i'm dimple. this field is home.");
});

ttsOn.addEventListener("change", () => {
  setTtsEnabled(ttsOn.checked);
  syncMute();
});
ttsField.addEventListener("change", () => setTtsFieldLines(ttsField.checked));
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
      chatWindow.classList.add("hidden");
      chatInput.blur();
    }
    return;
  }
  if (e.key === "f" || e.key === "F") camera.follow = !camera.follow;
  if (e.key === "s" || e.key === "S" || e.key === "k" || e.key === "K") toggleSettings();
  if (e.key === "c" || e.key === "C") toggleChat();
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
  }, dt);

  const snap = presence.snapshot();
  const visitorPos: Vec3 = visitor?.pos ?? [0, 0, 0];

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
  statsEl.textContent = `dimple · iso ${snap.iso.toFixed(2)} · ${snap.mood} · ${remote} · ${Math.round(renderer.fps)}fps${qualityTier() === 0 ? " · deck" : ""}`;
  if (snap.speech) {
    speechEl.textContent = snap.speech;
    caption.classList.add("on");
    if (snap.speech !== lastSpoken) {
      lastSpoken = snap.speech;
      appendChat("dimple", snap.speech);
      if (!chatWindow.classList.contains("hidden")) renderChat();
      speakDimple(snap.speech, true);
    }
  } else {
    caption.classList.remove("on");
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
