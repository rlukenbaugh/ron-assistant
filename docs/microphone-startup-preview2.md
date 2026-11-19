# Microphone startup improvement

The Enable Hey JARVIS button previously launched a separate Windows speech availability probe, started the recognition worker, then immediately killed and restarted that worker during UI synchronization. Repeated resume calls also restarted a worker that was already listening.

The button now starts recognition directly and reports readiness from the worker itself. Repeated enable/resume calls preserve an existing worker. Turning the microphone off still terminates it; pausing still closes audio input. No background recording or automatic microphone activation was added.

Three local ready-state measurements before: 1939, 1829, 1941 ms. After: 1032, 1033, 1247 ms. Median improved from 1939 to 1033 ms (about 47%). This includes local Windows speech initialization; microphone hardware and system load can affect timing.

Regression coverage asserts that synchronization does not create another worker and that the enable button works without an availability-probe IPC handler.

Build/lint, 13 Node tests, 2 Python tests and all 3 desktop tests passed. The updated preview was copied to E:\Program Files\Ron Assistant after backing up preview.1, with all 74 copied files verified by SHA-256. An installed-app button test reached microphone readiness in 1362 ms and switched it off afterward. The original settings file hash was unchanged, and the app was reopened using its existing profile. No installer or release tag was created.
