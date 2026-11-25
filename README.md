# MultiClaude

Installable Windows desktop app (Electron + Next.js) where every top tab (`Tab 1`, `Tab 2`, `Tab 3`, ...) loads `https://claude.ai/new` inside its own isolated Chromium session (`persist:tab-1`, `persist:tab-2`, `persist:tab-3`) so you can log in with a different normal Claude account in every tab.

## Build Windows Installer (`.exe`)

```bash
npm install
npm run dist:win
```

This exports the static Next.js UI (`out/`), bundles the app with `electron-builder`, and outputs the Windows setup installer inside `dist-electron/`:

- `dist-electron/MultiClaude Setup 0.1.0.exe` — Standard Windows NSIS installer (adds Start Menu and Desktop shortcuts)
- `dist-electron/win-unpacked/MultiClaude.exe` — Unpacked standalone executable

## Run Locally in Development

```bash
npm run desktop
```
