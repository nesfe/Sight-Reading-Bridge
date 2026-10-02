# Sight Reading Bridge

**From the keyboard to the score, one step at a time.**

[![Checks](https://github.com/nesfe/Sight-Reading-Bridge/actions/workflows/desktop-build.yml/badge.svg?branch=main)](https://github.com/nesfe/Sight-Reading-Bridge/actions/workflows/desktop-build.yml)
[![Latest release](https://img.shields.io/github/v/release/nesfe/Sight-Reading-Bridge?label=release&color=287d68)](https://github.com/nesfe/Sight-Reading-Bridge/releases/latest)
[![Desktop platforms](https://img.shields.io/badge/desktop-macOS%20%7C%20Windows%20%7C%20Linux-52636b)](https://github.com/nesfe/Sight-Reading-Bridge/releases/latest)
[![Web MIDI](https://img.shields.io/badge/input-USB%20%C2%B7%20Web%20MIDI-287d68)](#connect-your-piano)

Sight Reading Bridge is a piano sight-reading trainer for the web and desktop. It connects notes to keys through a visual grand staff, then gradually removes the support as you move toward conventional notation. Play on your own digital piano, receive feedback locally, and keep the sound of your instrument.

**[Open the web app](https://bridge.82-26-151-8.sslip.io)** · **[Download for desktop](https://github.com/nesfe/Sight-Reading-Bridge/releases/latest)** · **[Русская документация](README.ru.md)**

![A right-hand recognition lesson: the vertical grand staff aligns with the piano keyboard, with four practice blocks and a middle-C prompt.](docs/images/recognition-lesson.png)

*The current application, shown in on-screen keyboard demo mode. The interface is currently in Russian.*

## The Learning Approach

Reading a score combines pitch recognition, keyboard navigation, rhythm, and looking ahead. Sight Reading Bridge introduces these demands in stages, giving each skill room to develop.

| View | Visual support |
| --- | --- |
| **Vertical staff** | Note positions align with the keyboard. Staff bands and the spaces between them have equal width. |
| **Horizontal staff** | The same equal-width bands preserve familiar visual cues in the conventional reading direction. |
| **Standard notation** | A conventional grand staff, with visual support reduced as the learner progresses. |

Labels, color, staff width, and key highlights can be adjusted independently. Recognition exercises wait for a correct press and release; timed exercises introduce continuous reading and looking ahead. New attempts and repeated material are tracked separately.

## Practice With Purpose

- **A structured adult learning path.** Twelve lessons cover note recognition, melodic patterns, generated reading material, and reading ahead.
- **Complete note coverage.** Right-hand recognition includes 115 prompts; left-hand recognition includes 132. Every note in these lessons appears at least 15 times, across range practice, neighboring positions, shuffled sets, and a final check.
- **Progress you can inspect.** Review first-attempt accuracy, errors, and median reaction time for each note. Practice blocks include breaks, which are excluded from active practice time.
- **Your own sheet music.** Import MusicXML or compressed MXL, view a full score, select a part or staff, and follow it with MIDI pitch feedback, including chords and tied notes.
- **Local storage.** Lesson history and imported scores stay on your device. Export and import progress as JSON; manage scores in a local library. Web and desktop storage are separate.

## Get Started

### In Your Browser

Open the [web app](https://bridge.82-26-151-8.sslip.io) in Chrome or Edge. Connect a USB-MIDI piano and allow MIDI access when prompted. To explore without an instrument, enable the on-screen keyboard demo; demo attempts do not count toward course completion.

### On Your Desktop

Download an installer from [GitHub Releases](https://github.com/nesfe/Sight-Reading-Bridge/releases/latest). No local compilation or developer tools are required.

| System | Download |
| --- | --- |
| macOS, Apple Silicon (M1 and later) | `mac-arm64.dmg` |
| macOS, Intel | `mac-x64.dmg` |
| Windows, x64 | `win-x64.exe` |
| Linux, x64 | `.AppImage`, `.deb`, or `.rpm` |

Current desktop releases are unsigned, and macOS builds are not notarized. Gatekeeper or SmartScreen may warn or block the first launch. The web app is available without installation.

### Connect Your Piano

Use your instrument's **USB-to-host** connection. Select its MIDI input in the app, then start a lesson. The intended setup uses wired USB MIDI; Bluetooth and microphone input are outside the current scope. Audio comes from your piano, with no software synthesizer in the app.

MIDI events are processed on your computer, without a server round trip for each note. The same lesson engine powers both versions. Diagnostic timing covers software event handling and the next animation frame; it is not a measurement of physical key-to-screen latency.

## Bring Your Own Scores

The library accepts MusicXML partwise files (`.musicxml`, `.xml`) and compressed MusicXML (`.mxl`). Files are parsed locally and rendered with OpenSheetMusicDisplay. Notation retains chords, accidentals, rests, durations, and ties.

Imported scores support horizontal bands and standard notation. MIDI following checks pitch, with part and staff selection. Rhythm, note-release timing, and pedal use are not graded in this mode, and results are not yet saved to course history. Repeats are not expanded and grace notes are skipped. Arbitrary imported scores do not yet have a vertical view.

PDF, MIDI files, MusicXML timewise, and native notation-editor formats are not supported. Export MusicXML partwise from your notation editor to use a score here. See the [detailed import notes](README.ru.md#импорт-партитур) for limits and notation-specific behavior.

## Project Status

Sight Reading Bridge is in active development. The current release provides a working adult practice path; the full proposed curriculum is still being developed. Generated exercises are currently single-voice and use natural notes. Ear training, pedal assessment, and a complete rhythm curriculum are not yet included. View changes are immediate rather than animated rotations.

The project draws on the idea of gradually withdrawing visual support. Its practice thresholds are configurable training choices, not validated learning standards. The [methodology](docs/source-methodology.md) and [notation design notes](docs/notation-decisions.md), both in Russian, explain the rationale and distinguish the longer-term plan from the current implementation.

## Development

Built with **TypeScript, React, Vite, and Electron**, using **Web MIDI** for input, **VexFlow** for lesson notation, **OpenSheetMusicDisplay** for imported scores, and **IndexedDB** for local storage.

Node.js 24 is required for development. Desktop installers do not require Node.js.

```sh
npm ci
npm run dev
```

| Directory | Purpose |
| --- | --- |
| `apps/web` | Shared React interface |
| `apps/desktop` | Electron window and isolated preload |
| `packages/music-core` | Pitch mapping and shared staff/keyboard geometry |
| `packages/notation-renderer` | Teaching views and conventional notation |
| `packages/midi-io` | MIDI input, connection handling, and diagnostics |
| `packages/exercise-engine` | Reproducible exercise generation and session state |
| `packages/scoring-engine` | Performance metrics and support adjustment |
| `packages/curriculum` | Typed lessons and visual support settings |
| `packages/progress` | Local history and validated progress import |
| `packages/score-import` | MusicXML/MXL library and score following |

### Verification

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests use simulated MIDI. On Linux, the Electron smoke test runs with `xvfb-run -a npm run test:desktop` and requires access to the system MIDI sequencer. Physical instrument latency requires a separate hardware measurement.

GitHub Actions runs checks on `main`. Version tags publish macOS arm64/x64, Windows x64, and Linux x64 installers, along with SHA-256 checksums. Third-party import notices are included in [IMPORT-NOTICES.txt](public/IMPORT-NOTICES.txt).

## Feedback

Use [GitHub Issues](https://github.com/nesfe/Sight-Reading-Bridge/issues) for bugs and suggestions. For a MIDI issue, include your operating system, browser or app version, instrument model, and the steps that reproduce it.
