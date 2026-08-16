# Dimple

Dimple is a buddy who lives inside a signed distance field. The algorithm is the body.

## Releases

GitHub Releases ship **Windows**, **macOS**, and **Linux** (Steam Deck) builds.

| Platform | File | Notes |
| --- | --- | --- |
| Windows | `Dimple-*-windows-setup.exe` | Installer. Portable: `Dimple-*-windows-portable.exe` |
| macOS | `Dimple-*-mac-*.dmg` | Right-click → Open if Gatekeeper complains |
| Linux / Steam Deck | `Dimple-*-linux-*.AppImage` | Desktop Mode: mark executable, add as a non-Steam game. **F11** fullscreen |

No `.env`. Open Settings in-app and bind a key if you want him thinking or speaking (ElevenLabs / browser TTS).

## Steam Deck

Download `Dimple-*-linux-x86_64.AppImage`. Desktop Mode → mark executable → **Add a Non-Steam Game**. Game Mode launches fullscreen. Settings → field quality is **auto** (Deck uses the 40 fps preset).

| Control | What it does |
| --- | --- |
| **A** | Open chat (Steam keyboard). Send if you already typed |
| **X** | Talk — hold the mic, Dimple hears you |
| **Y** | Follow Dimple |
| **B** | Close chat / settings |
| **START** | Settings |
| **SELECT** | Chat |
| **Right stick** | Look |
| **L2 / R2** | Zoom |
| **D-pad down** or **L3/R3** | Tap the floor (he notices) |
| **STEAM + X** | Keyboard if talk doesn't grab the mic |
If sticks don't look, open Dimple in Steam → Controller → use a **Gamepad** layout (not mouse-only).

## Play

Double-click **Dimple** on your Desktop, or download a build from [Releases](https://github.com/AaronGrace978/RayMarchPrime/releases/tag/v0.1.0). That is a real window, not a browser tab.

On Windows from this folder: double-click `Launch Dimple.cmd`.

## Dev

```bash
npm install
npm start
```

`npm start` is the Vite web loop. `npm run desktop` is the Electron window.
