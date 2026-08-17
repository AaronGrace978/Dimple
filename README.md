# Dimple

Dimple is a buddy who lives inside a signed distance field. The algorithm is the body.

## Releases

GitHub Releases ship **Windows**, **macOS**, and **Linux** (Steam Deck) builds.

| Platform | File | Notes |
| --- | --- | --- |
| Windows | `Dimple-*-windows-setup.exe` | Installer. Portable: `Dimple-*-windows-portable.exe` |
| macOS | `Dimple-*-mac-*.dmg` | Right-click → Open if Gatekeeper complains |
| Linux / Steam Deck | `Dimple-*-linux-*.AppImage` | Desktop Mode: mark executable, add as a non-Steam game. **F11** fullscreen |

No `.env`. Dimple **speaks locally** with Kokoro (same idea as DinoClaw) — no ElevenLabs key required. Whisper + Kokoro run on a **Web Worker** so the field keeps moving. First talk downloads the voice model (~80 MB, once, needs Wi-Fi). Bind a mind key in Settings if you want him thinking.

## Steam Deck

Download `Dimple-*-linux-x64.tar.gz`. Desktop Mode → unpack into `~/Dimple` → **Add a Non-Steam Game** pointing at `/home/deck/Dimple/Dimple`. Game Mode launches fullscreen. Settings → field quality is **auto** (Deck uses the 40 fps preset). Voice is **local Kokoro** by default so you can hear him without ElevenLabs.

| Control | What it does |
| --- | --- |
| **HOLD X** / **L1** / **L2** | Push-to-talk. Does **not** open chat (chat steals the mic / voice). Caption shows listening, then he speaks. |
| **HOLD talk** | Same PTT on screen |
| **A** | Open chat. Type with STEAM+X. Does nothing while the box is focused (fixes double-type) |
| **Y** | Follow Dimple |
| **D-pad up** | Pet Dimple |
| **B** | Close chat / settings |
| **START** | Settings |
| **SELECT** | Chat |
| **Right stick** | Look |
| **R2** | Zoom |
| **STEAM + X** | Keyboard |
| **D-pad down** or **L3/R3** | Tap the floor (he plays) |
| **Click Dimple** | Pet him (he looks at you) |
If sticks don't look, open Dimple in Steam → Controller → use a **Gamepad** layout (not mouse-only).

## Buddy

Dimple has two field-dimples for eyes. They track the cursor, the camera, or a play pebble on the floor.

- **Click him** (or **P** / D-pad up) to pet. He nuzzles and chirps.
- **Click the floor** to toss a bouncing dimple. He plays.
- Leave him alone and he **sleeps**. Talk, pet, or tap to wake him.
- After a long time away he notices you came back.
- Chat still works without a key. Try *come here*, *sleep*, *play*, *spin*, *jump*, *look at me*.

## Play

Double-click **Dimple** on your Desktop, or download a build from [Releases](https://github.com/AaronGrace978/RayMarchPrime/releases/tag/v0.1.9). That is a real window, not a browser tab.

On Windows from this folder: double-click `Launch Dimple.cmd`.

## Windows laptops (RTX + Intel)

13th-gen Intel + RTX 4060 laptops often run Electron on the **Intel iGPU** unless Windows is told to prefer NVIDIA. Dimple now:

- asks Chromium for the high-performance GPU
- writes `GpuPreference=2` for `Dimple.exe` (High performance)
- auto-picks **medium** if it detects Intel/UHD, **high** (1080p field) if it sees the RTX
- caps the raymarch so a QHD panel doesn't march 4K

The HUD shows the GPU name (`rtx 4060 laptop` vs `uhd graphics`). If it says Intel, Settings → field quality will already have dropped. You can still pick **supreme** (1440p) once the HUD shows the RTX.

## Dev

```bash
npm install
npm start
```

`npm start` is the Vite web loop. `npm run desktop` is the Electron window.
