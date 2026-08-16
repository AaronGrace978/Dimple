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

## Dev

```bash
npm install
npm start
```

Or double-click `Launch Dimple.cmd` on Windows. `npm run desktop` opens the packaged-style Electron window after a web build.
