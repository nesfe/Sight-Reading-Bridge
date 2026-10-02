## 0.4.0 · English and Russian

[Open the web app](https://bridge.82-26-151-8.sslip.io) or download an installer below. Apple Silicon Macs, including M4, use `mac-arm64.dmg`. No local compilation is required.

### Changes

- Full English interface alongside Russian: lessons, note labels, results, history, library, import errors, and MIDI diagnostics.
- A persistent **English / Русский** selector at the top of every screen. Both language names remain visible, with the active language clearly highlighted.
- Language selection is saved locally. The first launch follows the browser or system language, falling back to English when neither supported language is available.
- Switching languages preserves the active lesson, held notes, MIDI connection, imported score, and selected staff.
- Dates and note counts follow the selected language. User score titles and instrument names retain their original text.

### Verification

51 unit tests and 10 browser tests cover recognition, MIDI events, language persistence, switching while a note is held, import, and narrow-screen layout. Translation resources are bundled locally; language switching requires no network request.

### Current Limitations

Desktop installers are unsigned; macOS builds are not notarized. Gatekeeper or SmartScreen may warn or block the first launch. The web app is available without installation.

Imported scores support horizontal views and pitch following, without rhythm or pedal grading or course-history integration. Generated exercises remain single-voice. Physical key-to-screen latency on a Kawai CA701/M4 has not been measured. See the README for the current scope.
