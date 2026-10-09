## 0.6.2 · Native Mac Builds and Focused Practice

For **Apple Silicon, including M4**, download `Sight-Reading-Bridge-0.6.2-mac-arm64.dmg`. Use `mac-x64.dmg` only on Intel Macs. No compilation or developer tools are required.

### macOS

- Separate native ARM64 and Intel builds on macOS Sequoia runners.
- Explicit ad-hoc signing of the application and its nested Electron components, with the entitlements required by Electron's hardened runtime.
- Release checks verify the DMG, copy the application out of it, verify its signature, and launch that installed copy. They also check the running architecture, absence of Rosetta translation, MIDI API access, native fullscreen, a trainer lesson, imported MusicXML, and the Advanced course.

**The Mac app is ad-hoc signed, not Developer ID signed or notarized by Apple.** macOS may still require approval in System Settings → Privacy & Security → Open Anyway. Only approve a download whose origin you trust. See [Apple's guidance](https://support.apple.com/en-us/102445). Windows installers remain unsigned.

### Smoother Feedback

- Incoming MIDI notes no longer re-render the app shell or instrument connection controls.
- Static recognition lessons no longer run an unnecessary frame-by-frame session timer. Held keys and incorrect notes do not re-engrave an unchanged horizontal score.
- Advanced prepares upcoming vertical notation windows during idle time. Hidden full-score cursors no longer do layout work, and visible cursor updates are coalesced outside the synchronous MIDI callback.

### More Room to Play

- Starting practice hides navigation and lesson descriptions, giving the score and keyboard more space without changing their alignment.
- A persistent fullscreen button works in Electron and compatible browsers. A saved switch enables automatic fullscreen on practice start; it is off by default.
- Leaving the practice view or fullscreen pauses the exercise without resetting the position. Automatically entered fullscreen ends with the exercise; manually entered fullscreen remains under your control.
- English/Russian selection remains visible during practice.

The 31-piece Advanced course, lessons and local records remain available. **v0.6.0 is retained as the previous baseline**, without changes to its tag or assets. There is no public hosted preview.

The v0.6.1 tag did not produce a published release: its Mac smoke test sent the first Advanced chord before the asynchronous fullscreen transition completed. This release explicitly waits for practice readiness and retains failure diagnostics.

MIDI processing remains local, with no per-note network request or software audio. Automated checks do not measure physical Kawai CA701-to-M4 screen latency or reproduce every Gatekeeper download path; those require testing on the instrument and Mac.
