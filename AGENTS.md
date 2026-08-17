# AGENTS.md

## Cursor Cloud specific instructions

Dimple is a single client-only app — there is no backend, database, `.env`, tests, or
linter. It's a TypeScript + Vite + WebGL raymarcher, optionally wrapped in Electron.
Node 22 + npm (matches CI in `.github/workflows/release.yml`). Standard commands live in
`package.json` and `README.md`; the notes below cover only the non-obvious gotchas.

### Running / building

- Dev server: `npm run dev` (Vite on `http://localhost:5173`). `npm start` / `npm run launch`
  wrap this via `scripts/launch.mjs` and try to auto-open a browser — prefer plain
  `npm run dev` in headless cloud VMs so it doesn't try to `xdg-open` a browser.
- Type-check + build: `npm run build` (runs `tsc --noEmit` then `vite build`). This is the
  closest thing to a "test" in this repo; there is no test runner and no lint script.
- Desktop: `npm run desktop` (builds, then launches Electron with a LAN "portal" on UDP/HTTP
  ports 17321/17322). Packaging installers (`npm run dist*`) needs `rpm fuse libfuse2` on
  Linux and is only for release artifacts, not dev.

### WebGL2 is mandatory (key gotcha for GUI testing)

The renderer calls `canvas.getContext("webgl2")` and throws
`"WebGL2 is required to enter the field."` if it's missing. The cloud VM has no GPU, and
Chrome disables software WebGL2 by default, so out of the box the app shows only that error
on a black canvas.

To test the app in the browser, enable software WebGL2 in Chrome once via `chrome://flags`,
then relaunch Chrome:

- `#enable-unsafe-swiftshader` → **Enabled** ("Enable unsafe SwiftShader fallback"). This is
  the flag that actually makes WebGL2 available on the software (llvmpipe) renderer.
- `#ignore-gpu-blocklist` → **Enabled** ("Override software rendering list") also helps.

After relaunch, `http://localhost:5173/` renders the 3D field. These flags persist in the
Chrome profile. Rendering is software-only, so it is slow/low-fps but fully functional.

### Interacting without keys

No API key is needed to exercise core functionality: open the **chat** panel and type
commands like `come here`, `play`, `sleep`, `spin`, `jump` — Dimple replies in text and the
field reacts. Local voice (Whisper STT + Kokoro TTS) downloads an ~80 MB model on first use
and needs one-time internet. Cloud LLM "mind" and ElevenLabs voice are optional and are
configured at runtime in Settings (keys stay in the browser; requests are reverse-proxied by
Vite under `/p/<provider>`).
