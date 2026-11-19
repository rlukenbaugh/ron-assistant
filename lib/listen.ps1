param([switch]$Probe, [string]$AudioFile = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
function Send-Status($state, $text) {
    [Console]::WriteLine((@{ state = $state; text = $text } | ConvertTo-Json -Compress))
}
$engine = $null
try {
    Add-Type -AssemblyName System.Speech
    $recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() |
        Where-Object { $_.Culture.Name -eq 'en-US' } | Select-Object -First 1
    if (!$recognizer) { throw 'Install English (United States) speech recognition in Windows Settings > Time & language > Speech.' }
    if ($Probe) { Send-Status 'available' 'Windows English speech recognition is available.'; exit 0 }
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($recognizer)
    $wakeBuilder = New-Object System.Speech.Recognition.GrammarBuilder
    $wakeBuilder.Culture = $recognizer.Culture
    $wakeBuilder.Append('hey jarvis')
    $wake = New-Object System.Speech.Recognition.Grammar($wakeBuilder)
    $dictation = New-Object System.Speech.Recognition.DictationGrammar
    $dictation.Enabled = $false
    $engine.LoadGrammar($wake)
    $engine.LoadGrammar($dictation)
    $engine.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(1200)
    $engine.EndSilenceTimeoutAmbiguous = [TimeSpan]::FromMilliseconds(1600)
    if ($AudioFile) { $engine.SetInputToWaveFile($AudioFile) }
    else { $engine.SetInputToDefaultAudioDevice() }
    while ($true) {
        Send-Status 'wake' 'Listening for Hey JARVIS. Say the wake phrase, pause, then ask your question.'
        $heard = $engine.Recognize([TimeSpan]::FromSeconds(10))
        if (!$heard -or $heard.Confidence -lt 0.65) {
            if ($AudioFile) { break }
            continue
        }
        Send-Status 'question' 'I am listening. Ask your question now.'
        $wake.Enabled = $false
        $dictation.Enabled = $true
        $heard = $engine.Recognize([TimeSpan]::FromSeconds(15))
        if ($heard -and $heard.Confidence -ge 0.50 -and $heard.Text.Trim().Length -ge 3) {
            Send-Status 'transcript' $heard.Text.Trim()
            break
        }
        Send-Status 'missed' 'I did not catch a question. Try Hey JARVIS again.'
        $dictation.Enabled = $false
        $wake.Enabled = $true
        if ($AudioFile) { break }
    }
} catch {
    Send-Status 'error' 'Speech recognition could not start. Check the default microphone and Windows Settings > Privacy & security > Microphone > Let desktop apps access your microphone.'
    exit 1
} finally {
    if ($engine) { $engine.Dispose() }
}
