import SpeechWorker from "./speech.worker.ts?worker";

type StatusFn = (s: string) => void;

type Request =
  | { type: "init-whisper" }
  | { type: "init-kokoro" }
  | { type: "transcribe"; pcm: Float32Array; sampleRate: number }
  | { type: "speak"; text: string; voice: string };

type Reply =
  | { id?: number; type: "ok" }
  | { id?: number; type: "transcript"; text: string }
  | { id?: number; type: "audio"; pcm: Float32Array; sampleRate: number }
  | { id?: number; type: "error"; message: string }
  | { type: "status"; message: string };

type Pending = {
  resolve: (value: Reply) => void;
  reject: (err: Error) => void;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
const statusFns = new Set<StatusFn>();

export function onSpeechStatus(fn: StatusFn): () => void {
  statusFns.add(fn);
  return () => statusFns.delete(fn);
}

function emit(message: string): void {
  for (const fn of statusFns) fn(message);
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new SpeechWorker();
  worker.onmessage = (ev: MessageEvent<Reply>) => {
    const data = ev.data;
    if (data.type === "status") {
      emit(data.message);
      return;
    }
    const id = data.id;
    if (id == null) return;
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (data.type === "error") job.reject(new Error(data.message));
    else job.resolve(data);
  };
  worker.onerror = (ev) => {
    const err = new Error(ev.message || "speech worker failed");
    for (const [id, job] of pending) {
      pending.delete(id);
      job.reject(err);
    }
  };
  return worker;
}

function call(req: Request, transfer: Transferable[] = []): Promise<Reply> {
  const id = nextId++;
  const w = getWorker();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, ...req }, transfer);
  });
}

export function initWhisper(): Promise<void> {
  return call({ type: "init-whisper" }).then(() => undefined);
}

export function initKokoro(): Promise<void> {
  return call({ type: "init-kokoro" }).then(() => undefined);
}

export async function workerTranscribe(pcm: Float32Array, sampleRate: number): Promise<string> {
  const copy = pcm.slice();
  const reply = await call({ type: "transcribe", pcm: copy, sampleRate }, [copy.buffer]);
  return reply.type === "transcript" ? reply.text : "";
}

export async function workerSpeak(
  text: string,
  voice: string,
): Promise<{ pcm: Float32Array; sampleRate: number }> {
  const reply = await call({ type: "speak", text, voice });
  if (reply.type !== "audio") throw new Error("voice worker returned no audio");
  return { pcm: reply.pcm, sampleRate: reply.sampleRate };
}
