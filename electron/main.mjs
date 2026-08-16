import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, globalShortcut, session, shell } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 17321;

const PROXY = [
  ["/p/openai", "https://api.openai.com"],
  ["/p/anthropic", "https://api.anthropic.com"],
  ["/p/google", "https://generativelanguage.googleapis.com"],
  ["/p/xai", "https://api.x.ai"],
  ["/p/groq", "https://api.groq.com"],
  ["/p/mistral", "https://api.mistral.ai"],
  ["/p/deepseek", "https://api.deepseek.com"],
  ["/p/together", "https://api.together.xyz"],
  ["/p/fireworks", "https://api.fireworks.ai"],
  ["/p/cerebras", "https://api.cerebras.ai"],
  ["/p/openrouter", "https://openrouter.ai"],
  ["/p/ollama-cloud", "https://ollama.com"],
  ["/p/elevenlabs", "https://api.elevenlabs.io"],
  ["/p/ollama-local", "http://127.0.0.1:11434"],
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function distRoot() {
  return path.join(app.getAppPath(), "dist");
}

function isSteamDeck() {
  if (process.env.STEAMDECK === "1" || process.env.SteamDeck === "1") return true;
  if (process.env.SteamGameId || process.env.SteamAppId) {
    try {
      const name = readFileSync("/sys/devices/virtual/dmi/id/board_name", "utf8");
      if (/Jupiter|Galileo/i.test(name)) return true;
    } catch {
      /* not a deck board */
    }
  }
  try {
    const name = readFileSync("/sys/devices/virtual/dmi/id/board_name", "utf8");
    if (/Jupiter|Galileo/i.test(name)) return true;
  } catch {
    /* ignore */
  }
  return process.platform === "linux" && existsSync("/home/deck");
}

function matchProxy(urlPath) {
  const sorted = [...PROXY].sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, target] of sorted) {
    if (urlPath === prefix || urlPath.startsWith(`${prefix}/`) || urlPath.startsWith(`${prefix}?`)) {
      return { prefix, target };
    }
  }
  return null;
}

async function proxyRequest(req, res, prefix, target) {
  const rest = req.url?.slice(prefix.length) || "/";
  const dest = target + rest;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];
  const upstream = await fetch(dest, {
    method: req.method,
    headers,
    body: body.length && req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  const out = { "content-length": String(buf.length) };
  upstream.headers.forEach((value, key) => {
    if (!["content-encoding", "transfer-encoding", "content-length"].includes(key)) {
      out[key] = value;
    }
  });
  res.writeHead(upstream.status, out);
  res.end(buf);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = (req.url ?? "/").split("?")[0];
        if (urlPath === "/osk") {
          void shell.openExternal("steam://open/keyboard");
          res.writeHead(204);
          res.end();
          return;
        }
        const proxied = matchProxy(urlPath);
        if (proxied) {
          await proxyRequest(req, res, proxied.prefix, proxied.target);
          return;
        }
        let file = urlPath === "/" ? "/index.html" : urlPath;
        const full = path.normalize(path.join(distRoot(), file));
        if (!full.startsWith(distRoot())) {
          res.writeHead(403);
          res.end("no");
          return;
        }
        const data = await readFile(full);
        const ext = path.extname(full);
        res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream" });
        res.end(data);
      } catch {
        try {
          const data = await readFile(path.join(distRoot(), "index.html"));
          res.writeHead(200, { "content-type": MIME[".html"] });
          res.end(data);
        } catch {
          res.writeHead(500);
          res.end("Dimple could not wake");
        }
      }
    });
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
if (process.platform === "linux") {
  app.commandLine.appendSwitch("use-gl", "angle");
  app.commandLine.appendSwitch("use-angle", "gl");
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
}

let win;
const deck = isSteamDeck();

async function createWindow() {
  await startServer();
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media" || permission === "audioCapture");
  });
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 400,
    title: "Dimple",
    backgroundColor: "#07070a",
    autoHideMenuBar: true,
    fullscreen: deck,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.removeMenu();
  const url = deck
    ? `http://127.0.0.1:${PORT}/?deck=1`
    : `http://127.0.0.1:${PORT}/`;
  await win.loadURL(url);
  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    void shell.openExternal(openUrl);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  await createWindow();
  globalShortcut.register("F11", () => {
    if (win) win.setFullScreen(!win.isFullScreen());
  });
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  app.quit();
});
