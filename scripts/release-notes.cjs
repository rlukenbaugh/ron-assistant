const fs = require('node:fs');
const { version } = require('../package.json');
const text = `# Ron Assistant v${version}

## Highlights

- Ask Claude, Codex and other enabled connections one question from a readable Windows desktop app.
- Compare independent answers or exchange reciprocal reviews and produce a final answer.
- Adjustable Segoe UI text, light/dark themes, clickable web links, and plain-text/Markdown copy buttons.
- Permanent saved instructions, optional local history, cancellation, retry and regeneration.

## Desktop Experience

- Windows x64 installer and portable executable, with separate settings from the existing Jarvis app.
- Windows voice for final answers and an optional playback-only avatar connection through existing Jarvis.
- Restricted answering sessions and sanitized response formatting.

## What To Configure Next

- Claude Code and Codex must already be installed and signed in on the target computer.
- Enable optional Gemini or local Ollama connections in Connections when available.
- Hermes is detected but unavailable in this version because its installed CLI cannot disable all answering tools.
- Live avatars require the existing Jarvis server and available avatar allowance. No account or plan changes are made.

## Release Assets

- Ron-Assistant-Setup-${version}-x64.exe — Windows installer
- Ron-Assistant-Portable-${version}-x64.exe — portable launcher
- SHA256SUMS.txt — artifact checksums

## Notes

- This release is unsigned unless built with CSC_LINK / CSC_KEY_PASSWORD signing secrets.
- No automatic updater. Install a newer release manually when available.
- Links from models are not automatically verified. Answering sessions do not browse the web or modify files.
- Voice narration can paraphrase; printed answers remain the authoritative on-screen record.
`;
fs.writeFileSync('work/release-notes.md', text);
console.log(`Prepared release notes for v${version}.`);
