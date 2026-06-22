# Sight Reading Bridge

Modern Electron piano sight-reading trainer built around progressive staff scaffolding.

The core product goal is not to imitate falling-note piano apps. The app teaches standard notation through temporary supports: a rotated grand staff, real staff lines, note labels, color, keyboard hints, and rhythm detail that can fade independently.

## Why Electron

Electron uses Chromium, so Web MIDI works consistently for a local desktop app. This avoids the macOS WebView limitation that makes Tauri a poor fit for MIDI-first piano training.

The same React renderer can also run in a browser preview, but the production desktop shell is Electron.

## Current MVP

- React + TypeScript + Vite renderer.
- Electron desktop shell with `contextIsolation`, `sandbox`, and preload bridge.
- Shared music geometry in `packages/music-core`.
- Rotated vertical grand staff aligned to the same coordinate function as the white piano keys.
- Real treble and bass clef glyphs in horizontal notation.
- No grey “space lines”; only true staff lines are drawn.
- Web MIDI note-on handling plus virtual keyboard fallback.
- Adaptive scaffold vector:
  - `A` orientation
  - `B` note names
  - `C` color
  - `D` staff supports
  - `E` images
  - `F` key highlight
  - `G` rhythm detail

## Commands

```bash
npm ci
npm run dev
```

Renderer-only preview on a remote server:

```bash
npm run dev:renderer
```

Quality checks:

```bash
npm run lint
npm run test
npm run build
```

Linux desktop packages on Linux:

```bash
npm run dist:linux
```

Artifacts are written to `release/`.

## Cross-platform builds

Linux cannot reliably produce signed macOS `.app/.dmg` artifacts. This repo includes `.github/workflows/desktop-build.yml`, which builds the Electron app on:

- `macos-latest` for macOS `.dmg/.zip`
- `windows-latest` for Windows installer
- `ubuntu-24.04` for Linux `.AppImage/.deb/.rpm`

That means users do not need to build locally; GitHub Actions produces platform-specific artifacts on the correct operating systems.

## Method

The app trains one new problem at a time:

1. Align note positions to keyboard geography.
2. Use a vertical grand staff where pitch axis matches piano left-to-right layout.
3. Remove labels before removing visual orientation.
4. Transition toward horizontal standard notation.
5. Separate pitch, rhythm, hands, and reading-ahead load.
6. Track first-pass accuracy and latency instead of rewarding memorization.
