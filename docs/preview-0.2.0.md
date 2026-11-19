# Ron Assistant 0.2.0-preview.1

The installer is on hold at Ron's request while hands-free interaction is evaluated.

Implemented:

- Local Windows en-US recognition: exact Hey JARVIS wake phrase followed by a separate spoken question; no audio files are recorded by the application.
- Visible microphone on/off, recognition state and recognized question. Microphone is off at startup.
- Pause during model requests and Windows speech; resume after Windows narration. Avatar speech requires manual resume/disconnection because a reliable end event is unavailable.
- Hermes Nous text-only connector using the installed Python runtime and the Hermes upstream credential adapter. No listening HTTP proxy and no Hermes agent tools, MCP, memories or plugins are loaded.
- Preserved typed drafts, bounded recognition input, error reporting and process cleanup.

Verification:

- Build and lint pass.
- 13 Node tests, 2 Python request-boundary tests and 2 development UI tests pass.
- Packaged UI smoke test passes, including an earlier real Claude/Codex reciprocal review and final answer. The copied preview was launched separately: test mode is off, local speech probing succeeds, and Hermes correctly reports the missing Nous sign-in.
- Windows en-US recognition probe succeeds without opening the microphone.
- Synthetic audio recognized the wake phrase. Dictation recognized a test sentence with a mistake and low confidence, and the production worker correctly declined to submit it. Actual microphone recognition remains a user trial.
- Hermes installation and configured Nous model detected. Its official proxy status and the connector both report that Nous is not signed in. Live Hermes answers cannot be verified until the user signs in through Hermes.

No original Jarvis or Hermes configuration files were edited. No updated installer or release tag is created for this preview.
