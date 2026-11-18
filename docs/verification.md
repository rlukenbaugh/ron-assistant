# Version 0.1.0 verification

Verified on Windows 11 x64, November 18, 2026.

- Build and ESLint pass.
- Eleven core tests pass: persistent instructions, opt-in history, corruption preservation, input validation, independent responses, reciprocal review ordering, compare mode, provider failure, cancellation, retry behavior, credential filtering and literal subprocess input.
- Desktop UI tests pass: sanitized Markdown, plain-text/Markdown clipboard output, safe link handling, memory/font persistence after a complete restart, model failure, cancellation and theme changes.
- The packaged EXE starts with its compiled interface and an isolated user profile. Development fixtures are disabled in packaged builds.
- The packaged EXE ran the real Claude/Codex independent-answer → reciprocal-review → final-synthesis path and displayed the expected arithmetic result. Its Copy button returned the actual final text.
- Gemini independently answered a real test using the existing Jarvis key. Automatic selection uses the current Flash alias; model metadata listing alone did not establish that older listed models could still generate, so the automatic selection was corrected during verification.
- The new app established Helena's WebRTC connection, received video frames with nonzero video width, and successfully sent the final text for narration. The avatar connection was disconnected at the end of the test. Speaker output was not independently heard or recorded.
- Original Jarvis 1.1.60 remained responsive. Its installation and configuration were not modified by this build.

The first packaged UI test exposed an early-submit race while real provider discovery was pending. The submit button now starts disabled and is enabled only when a selected connection is ready. Result events also update immediately so background timer throttling does not hide progress. The repeated packaged test passed after these changes.

Hermes is explicitly unavailable in this release because inspection showed that an empty toolset argument selects default tools. Ollama is available only if its local service has installed models. Those unavailable paths are not presented as successful integrations.

Screenshots, raw transcripts and temporary profiles remain outside Git under `work` or the temporary directory; private settings and credentials are not release assets. Installer and portable executables are unsigned unless a signing certificate is provided during release. No automatic updater is included.
