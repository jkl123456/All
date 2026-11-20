# Offline TTS fallback for Windows (SAPI). No extra Python package needed.
#
# edge-tts talks to speech.platform.bing.com, which is unreachable from many
# mainland networks (TCP RST). When that happens app/voice.py falls back to
# this script: the built-in Chinese voice (Huihui on Win10/11) sounds worse
# than Xiaoxiao, but "some sound" beats "no sound" during a live stream.
#
# NOTE: this file MUST stay pure ASCII. Windows PowerShell 5.1 reads .ps1 as
# ANSI when there is no BOM, so UTF-8 Chinese comments get mangled and can
# swallow the newline before param() -- which silently breaks argument
# binding. Chinese explanation lives in app/voice.py instead.
#
# The text is passed as a file path (not as an argument) for the same reason:
# Chinese text through cmd/PowerShell code pages turns into garbage. The
# caller writes UTF-8 and we read it with -Encoding UTF8.
param([string]$TextPath, [string]$OutPath, [int]$Rate = 0)

$ErrorActionPreference = 'Stop'
$text = Get-Content -LiteralPath $TextPath -Raw -Encoding UTF8
if (-not $text) { exit 2 }

$voice = New-Object -ComObject SAPI.SpVoice
$stream = New-Object -ComObject SAPI.SpFileStream

# 3 = SSFMCreateForWrite. Output is PCM WAV, which browsers play directly.
$stream.Open($OutPath, 3, $false)
$voice.AudioOutputStream = $stream
$voice.Rate = [Math]::Max(-10, [Math]::Min(10, $Rate))
$voice.Speak($text) | Out-Null
$stream.Close()
exit 0
