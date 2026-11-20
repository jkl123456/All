param([int]$Port = 8850)
# Locate an already-open overlay Chrome window (--app=http://127.0.0.1:PORT/)
# and bring it to the foreground.
# exit 0 = found and activated, exit 1 = nothing found (caller should launch).
$ErrorActionPreference = 'SilentlyContinue'

Add-Type -Namespace Ov -Name Win -MemberDefinition @"
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
public delegate bool EnumProc(IntPtr h, IntPtr p);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
"@

$needle = '--app=http://127.0.0.1:' + $Port
$targets = @()
foreach ($p in (Get-CimInstance Win32_Process -Filter "Name='chrome.exe'")) {
  if ($p.CommandLine -and $p.CommandLine.Contains($needle)) { $targets += [uint32]$p.ProcessId }
}
if ($targets.Count -eq 0) { exit 1 }

$script:found = New-Object System.Collections.ArrayList
$cb = [Ov.Win+EnumProc]{
  param($h, $l)
  if ([Ov.Win]::IsWindowVisible($h)) {
    $owner = [uint32]0
    [void][Ov.Win]::GetWindowThreadProcessId($h, [ref]$owner)
    if ($targets -contains $owner) { [void]$script:found.Add($h) }
  }
  return $true
}
[void][Ov.Win]::EnumWindows($cb, [IntPtr]::Zero)

if ($script:found.Count -eq 0) { exit 1 }

foreach ($h in $script:found) {
  [void][Ov.Win]::ShowWindow($h, 9)   # SW_RESTORE
  [void][Ov.Win]::SetForegroundWindow($h)
}
exit 0
