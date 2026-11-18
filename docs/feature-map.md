# From Jarvis inspection to Ron Assistant

| Area | Evidence from installed Jarvis | New application |
| --- | --- | --- |
| Agent execution | Claude is launched with a prompt over stdin; Codex has a delegated execution path. | Separate restricted adapters; the same question is sent independently to every enabled connection. |
| Review exchange | The live voice tool delegates to one selected agent. The existing helper demonstrated a bounded Claude/Codex exchange. | All successful participants review other answers in one bounded round; a successful selected model writes the final synthesis. |
| Presentation | Results appear in overlays and activity/history views. | Readable answer panels, prominent final answer, expandable reviews, plain-text/Markdown copy, selectable text and safe HTTP(S) links. |
| Memory | Inspected ConversationMemory writes a rolling limit of 100 turns. Static coverage did not establish universal durable preference injection. | Permanent saved instructions in a separate validated settings file; history is opt-in, capped at 50 conversations. |
| Speech/avatar | Authenticated local routes proxy WebRTC offers and text to a local or cloud avatar. Prior live tests verified text delivery. | Optional playback-only WebRTC through the existing server, plus independent Windows speech. No microphone or camera acquisition. |
| Isolation | Jarvis agents use a home-directory or override workspace. | Dedicated profile/work directory. CLI tools/MCP customizations are disabled for answering sessions. No Jarvis settings or installed files are edited. |
| Packaging | Existing app is Electron. | Independently implemented Electron app, per-user assisted NSIS installer and portable executable. |

REA source selection and artifact identity are recorded in `inspection.json`. Static evidence is bounded; it does not establish execution of every branch. Tests cover the new implementation separately.

Antigravity and Hermes were inspected but are not exposed with broad tool permissions. Gemini is available through the existing key; local Ollama is discovered if running with installed models. Actual readiness and generation are checked separately.
