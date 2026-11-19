# Ron Assistant

A separate Windows desktop app for asking several assistants one question, reading each answer, exchanging peer reviews, and hearing a final answer. The original Jarvis installation stays operational.

## Use

Install the Windows Setup executable from Releases, or run the Portable executable. Open **Connections** to check the sign-ins already on this computer. Claude and Codex are enabled by default when available; Gemini, Hermes and local Ollama can be selected when connected.

- **Compare answers:** one independent answer from every enabled assistant.
- **Review together:** independent answers, one reciprocal review round, then a final synthesis by the preferred successful assistant. All participants' responses remain visible.
- **Memory & settings:** permanent saved instructions, theme, 16–26 px answer text, final-answer preference, time limits, speech and optional history.
- **Copy / Markdown:** copy any answer, the final answer, or the full discussion. Text is selectable; normal copy/paste shortcuts work. Web links open in the default browser. Models' links are not automatically verified.
- **Stop / Retry / Regenerate:** cancel current requests, retry a failed independent response while retaining successful answers, or start a fresh exchange.
- **Voice & avatar:** Windows speech for the final answer, or an optional live avatar through the existing local Jarvis server. Optional **Enable Hey JARVIS** uses local Windows English speech recognition. Say the wake phrase, pause, then ask the question. Microphone audio stays local; recognized questions are sent to enabled assistants. Listening starts off each time the app opens.

History saving starts **off**. When enabled, the last 50 exchanges are stored locally. Turning it off stops new saves without deleting old conversations. Saved instructions persist independently of history. Settings and optional history live in `%APPDATA%\Ron Assistant`; the original Jarvis profile and settings are not changed. The portable build uses the same user profile so its settings carry over to the installed app.

## Existing providers

The app starts restricted, text-only CLI sessions using the current user's saved sign-ins:

- Claude Code: `%USERPROFILE%\.local\bin\claude.exe`; safe/restricted session, no built-in tools or inherited MCP connections.
- Codex: native Windows executable installed by the global `@openai/codex` npm package; read-only mode, command execution and web search disabled, no inherited MCP connections.
- Gemini: compatible text models discovered using the existing Gemini key in `%LOCALAPPDATA%\JarvisServer\data\.env`. The key stays in the main process and is sent only to Google's API. API quota is separate from CLI subscriptions.
- Hermes: a dedicated text connector uses the installed Hermes runtime and saved Nous sign-in with its configured model. It uses the upstream credential adapter, without starting an HTTP proxy or loading the Hermes agent, plugins, tools, private memories or chats. Only the Nous provider is supported in this preview. If unavailable, sign in through Hermes (`hermes auth add nous`) and refresh Connections. A completed live Hermes answer remains unverified until a usable sign-in is available.
- Ollama: installed models discovered at loopback port 11434; requests stay local.

Antigravity was inspected. Its installed CLI supports plan/sandbox modes but does not expose the same explicit all-tools-off boundary as the primary adapters, so it is not offered as an unrestricted answering agent. Gemini text is available through the existing API key instead. The app does not install CLIs, sign into accounts, copy private settings, or synchronize existing chats. If a CLI lives in a different installation location, its adapter must be extended.

All enabled cloud assistants receive the question and saved instructions. During review they also receive the other successful assistants' answers. Their existing quotas apply. One failed provider does not discard the others. No assistant is represented as having performed browsing or tests in these text-only sessions. Credential-like environment variables are removed from CLI children, and prompts go over stdin, never through a command shell.

## Avatar

The app negotiates its own WebRTC playback view through the authenticated local Jarvis 1.1.60 server. It reads the current local server key only inside the main process. No key is exposed to the renderer or answering models, and no avatar assets are copied. A zero-volume generated audio track negotiates playback without accessing the microphone. Only final text is sent for narration. Disconnect closes the peer connection and stops its tracks.

Run only one live Jarvis avatar session at a time. The existing Jarvis Cloud allowance applies; a busy GPU, exhausted allowance, unavailable server, or failed WebRTC connection leaves printed answers and Windows speech available. Narration is model-mediated and can paraphrase. Stop speaking ends the avatar connection if one is active. Closing the voice panel alone does not disconnect it; use **Disconnect** when finished.

## Build and check

Requires Windows x64 and Node.js 22.12+ (the development machine uses Node 26).

```powershell
npm ci
node node_modules/electron/install.js
npm run build
npm run lint
npm test
npm run test:hermes
npm run test:e2e
npm run test:live
npm run dist:win
$env:RON_PACKAGED_TEST='1'
npm run test:e2e
```

`test:live` uses real Claude/Codex sign-ins and quota. UI tests use isolated temporary profiles and fixtures; mock mode is disabled in packaged builds. `RON_ASSISTANT_DATA_DIR` can select an isolated data directory for development/smoke tests. No network listener, service, account system or automatic startup is installed.

Windows artifacts follow Flight Tracker Pro naming:

- `Ron-Assistant-Setup-<version>-x64.exe`
- `Ron-Assistant-Portable-<version>-x64.exe`

Releases use semantic tags matching `package.json`. The Windows workflow supports the same `CSC_LINK` and `CSC_KEY_PASSWORD` signing secrets; without them it produces unsigned artifacts. There is no automatic updater in this initial release; download a later installer from Releases to update. Uninstalling preserves user data.

## Inspection and provenance

REA-MCP statically examined six selected files from the installed Jarvis 1.1.60 application, including agent detection/execution, work-directory handling, memory writing and avatar source selection. The evidence identifier and coverage are in `docs/inspection.json`. This was a bounded analysis, not a complete decompilation of every dependency. Earlier live tests established the signed-in Claude/Codex flow and cloud-avatar text delivery. The new app is independently implemented; it does not redistribute Jarvis code, branding or avatar media.

Security boundaries: isolated/sandboxed renderer, restrictive Content Security Policy, validated IPC senders, allowlisted IPC operations, sanitized Markdown without remote images or executable HTML, blocked in-app navigation, and HTTP(S)-only external links. The app never disables Windows security protections.

## Hands-free preview

The 0.2.0 preview adds optional local wake-phrase detection, using the installed Windows en-US desktop recognizer and default microphone. It requires Windows microphone access for desktop apps and compatible PowerShell script policy; it does not change those settings. No audio recording is saved. Listening works while minimized, pauses during model requests and Windows narration, and stops when switched off or the application closes. It does not run after closing or install a background service. A low-confidence question is rejected rather than submitted. Recognition accuracy needs a trial with the user's voice. A typed draft is preserved instead of overwritten by a voice question.

The avatar does not expose a reliable narration-finished event. After avatar narration, listening therefore stays paused. **Resume listening** disconnects the avatar and resumes microphone recognition. Fully automatic avatar turn-taking is not implemented in this preview.
