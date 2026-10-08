## 0.5.1 · Clearer Project Identity

Download an installer below. Apple Silicon Macs, including M4, use `mac-arm64.dmg`. No local compilation is required. The temporary public preview has been retired.

### Changes

- An interactive introduction before the first lesson: see the staff turn 90° clockwise, try C4–D4–E4 on the on-screen keyboard or a USB piano, and compare the same pitch across three notation views.
- The introduction is ungraded, can be skipped or revisited, and remembers completion locally. It supports English, Russian, keyboard navigation, and reduced-motion preferences.
- Documentation explains the staff-to-keyboard connection and the gradual return to conventional notation. Public Soft Mozart materials are acknowledged as a design reference, separately from the project's own description.
- Revised English/Russian documentation and introduction text clarify the project's independence. No affiliation, sponsorship, endorsement, licensed course implementation, or equivalent learning outcomes are claimed.
- Planning notes now describe this project's requirements instead of making unsupported comparisons with other products. This editorial update is not a legal clearance or a review of patent rights.
- An active-development badge and clearer project status.
- Public hosting and its autostart services are disabled. Server links have been removed from the current documentation, About, and published release descriptions. Development servers bind to loopback by default.

### Verification

Automated checks cover the introduction, note/key alignment, lesson flow, MIDI input, language switching, MusicXML import, and narrow-screen layout. All teaching and MIDI logic runs locally.

### Current Limitations

Desktop installers are unsigned; macOS builds are not notarized. Gatekeeper or SmartScreen may warn or block the first launch.

Imported scores support horizontal views and pitch following, without rhythm or pedal grading or course-history integration. Generated exercises remain single-voice. Physical key-to-screen latency on a Kawai CA701/M4 has not been measured. See the README for the current scope.
