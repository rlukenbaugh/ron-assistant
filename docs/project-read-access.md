# Project files in preview.3

Ron authorized access to C:\dev\ron-assistant and E:\Program Files\Ron Assistant. The application now offers a Project files panel for those two fixed locations. It lists supported text files, including main/lib files inside the installed app.asar archive. Users preview files locally and select up to eight files before asking a question. Sharing clears after submission; follow-up questions require selecting files again. Regeneration and retry retain the original selection, and retry rejects changed file hashes.

Every enabled assistant receives the same selected file snapshots with the question and review prompts. The response view lists the paths supplied. Only path/hash metadata is added to optional history; snapshot bodies are not independently saved. Model answers may quote source, as expected.

This is read-only access through supplied snapshots. It does not enable autonomous filesystem tools, command execution, editing, or self-updating. Windows permissions and profile locations are unchanged. The app offers only text files of at most 64KB, up to 80,000 characters in total. Common credential names, hidden files, dependency/cache/output directories and symbolic links are excluded. Inventory traversal and file counts are bounded, and files outside the fixed roots are rejected.

Tests cover traversal attempts, junction escapes, credential exclusion, binary/size limits, content hashes, local source previews, installed archive previews, metadata attached to a question and clearing sharing for the next question. The UI test for the two machine-specific roots runs locally; portable boundary tests use temporary roots.

Live verification: the packaged preview supplied source package.json and the installed app.asar/main.cjs to both Claude and Codex. Both independently reported the exact source version (0.2.0-preview.3) and the installed main process's contextIsolation:true value. Selected snapshots cleared after submission, while their paths remained attached to the question. Windows filesystem permissions were not changed.

The installed preview.3 was also checked at E:\Program Files\Ron Assistant: both roots were available, source and installed archive previews worked, an out-of-root request was rejected, and test mode was off. The previous preview was backed up, copied files were hash-verified, the settings file hash remained unchanged, and the app was reopened with its existing profile. Build/lint, 14 Node tests, 2 Python tests and 4 desktop tests passed. No new installer or release tag was created.
