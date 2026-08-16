import { isSteamDeck } from "./quality";

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

let active: InstanceType<SpeechCtor> | null = null;

export function canListen(): boolean {
  return Boolean(speechCtor());
}

function speechCtor(): SpeechCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function stopListen(): void {
  try {
    active?.abort();
  } catch {
    /* already stopped */
  }
  active = null;
}

/** One-shot speech to text. Empty string if cancelled or unavailable. */
export function listenOnce(): Promise<string> {
  const Ctor = speechCtor();
  if (!Ctor) return Promise.resolve("");
  stopListen();
  return new Promise((resolve) => {
    const rec = new Ctor();
    active = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let done = false;
    const finish = (text: string) => {
      if (done) return;
      done = true;
      active = null;
      resolve(text);
    };
    rec.onresult = (ev) => {
      const said = ev.results[0]?.[0]?.transcript?.trim() ?? "";
      finish(said);
    };
    rec.onerror = () => finish("");
    rec.onend = () => finish("");
    try {
      rec.start();
    } catch {
      finish("");
    }
  });
}

export function wakeKeyboard(input: HTMLInputElement): void {
  input.focus({ preventScroll: true });
  try {
    input.click();
  } catch {
    /* ignore */
  }
  const vk = (
    navigator as Navigator & { virtualKeyboard?: { show?: () => void } }
  ).virtualKeyboard;
  try {
    vk?.show?.();
  } catch {
    /* ignore */
  }
  if (isSteamDeck()) {
    void fetch("/osk", { method: "POST" }).catch(() => {
      try {
        window.open("steam://open/keyboard", "_blank");
      } catch {
        /* ignore */
      }
    });
  }
}
