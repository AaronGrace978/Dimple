import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 5173;
const url = `http://localhost:${port}/`;

function run(cmd, args, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      ...extra,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

function portOpen() {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host: "127.0.0.1" }, () => {
      sock.end();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
  });
}

async function waitForServer(ms = 20000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await portOpen()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function openBrowser() {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
  } else if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" });
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
  }
}

console.log("Dimple launcher");
console.log("waking the field…");

if (!existsSync(path.join(root, "node_modules", "vite"))) {
  console.log("installing…");
  await run("npm", ["install"]);
}

if (await portOpen()) {
  console.log("Dimple is already up.");
  openBrowser();
  process.exit(0);
}

const vite = spawn("npm", ["run", "dev"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

vite.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

if (await waitForServer()) {
  openBrowser();
  console.log(`Dimple → ${url}`);
} else {
  console.error("the field did not come up in time");
  vite.kill();
  process.exit(1);
}

vite.on("exit", (code) => process.exit(code ?? 0));
