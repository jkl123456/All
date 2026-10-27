# =====================================================================
#  wait-idle.ps1 - detect "AI finished" by diffing window frames
#  exit codes: 0=idle(done) 2=timeout 3=stopped 4=skipped 5=window-lost 1=error
#  control file: write "pause" / "run" / "skip" / "stop" to intervene
#  NOTE: keep this file ASCII-only.
# =====================================================================

param(
    [Parameter(Mandatory = $true)][string]$JobFile
)

$script:ResultFile = $null
$job = $null

try {
    $job = [System.IO.File]::ReadAllText($JobFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
    $script:ResultFile = $job.resultFile
}
catch {
    Write-Output ('ERROR ' + $_.Exception.Message)
    exit 1
}

. "$PSScriptRoot\common.ps1"

try {
    [AutoWin]::EnableDpiAwareness()

    # 目标窗口可能刚被隐藏/重建，多重试几次再判死刑
    $hwnd = [IntPtr]::Zero
    $winTitle = ''
    for ($try = 0; $try -lt 4; $try++) {
        $win = Get-TargetWindow -TitleKeyword ([string]$job.titleKeyword) -ProcessName ([string]$job.processName)
        if ($win.hwnd -ne [IntPtr]::Zero) {
            $hwnd = $win.hwnd
            $winTitle = $win.title
            break
        }
        Start-Sleep -Milliseconds 500
    }
    if ($hwnd -eq [IntPtr]::Zero) {
        Save-Result @{ ok = $false; reason = 'window-lost' }
        exit 5
    }

    # 窗口被收进托盘时截屏是黑的，先悄悄唤回来（不抢焦点，且保持原有最大化状态）
    [AutoWin]::EnsureShown($hwnd)

    $timeoutSec = 1800.0
    if ($job.timeoutSeconds) { $timeoutSec = [double]$job.timeoutSeconds }

    $minWait = 20.0
    if ($job.minWaitSeconds) { $minWait = [double]$job.minWaitSeconds }

    $stableTarget = 20.0
    if ($job.stableSeconds) { $stableTarget = [double]$job.stableSeconds }

    # 一直没有检测到画面变化时的兜底：AI 可能秒回、或界面根本不刷新
    $noActivityLimit = 300.0
    if ($job.noActivitySeconds) { $noActivityLimit = [double]$job.noActivitySeconds }

    $intervalMs = 1200
    if ($job.intervalMs) { $intervalMs = [int]$job.intervalMs }
    if ($intervalMs -lt 400) { $intervalMs = 400 }

    $step = 12
    if ($job.sampleStep) { $step = [int]$job.sampleStep }
    if ($step -lt 4) { $step = 4 }

    $pixelThreshold = 26
    if ($job.pixelThreshold) { $pixelThreshold = [int]$job.pixelThreshold }

    $thresholdPct = 0.001
    if ($job.thresholdPercent) { $thresholdPct = [double]$job.thresholdPercent / 100.0 }

    # 变化采样点数量达到这个值就算"在动"。静止画面下通常只有 0-2 个噪点，
    # 但一小段进度文字更新就能产生好几个点，比全图占比灵敏得多。
    $minChangedPixels = 2
    if ($job.minChangedPixels) { $minChangedPixels = [int]$job.minChangedPixels }

    # 只监测左栏，忽略右侧实时预览面板（面板里的动画永不停，否则永远判不到静止）。
    # 0 = 自动：从截图里找分栏边界；给了 10-100 就按用户设定。
    $monitorWidthPercent = 0.0
    if ($null -ne $job.monitorWidthPercent) { $monitorWidthPercent = [double]$job.monitorWidthPercent }
    $monitorFixed = ($monitorWidthPercent -ge 10.0)
    if ($monitorFixed -and $monitorWidthPercent -gt 100.0) { $monitorWidthPercent = 100.0 }
    $autoSplit = 100.0

    # 底部输入框区域不参与比较：那里有光标闪烁，几秒就抖一下，
    # 会被当成"AI 还在输出"，导致永远判不到静止
    $bottomIgnorePercent = 15.0
    if ($null -ne $job.ignoreBottomPercent) { $bottomIgnorePercent = [double]$job.ignoreBottomPercent }
    if ($bottomIgnorePercent -lt 0.0) { $bottomIgnorePercent = 0.0 }
    if ($bottomIgnorePercent -gt 40.0) { $bottomIgnorePercent = 40.0 }

    $controlFile = [string]$job.controlFile
    $intervalSec = $intervalMs / 1000.0

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $pausedMs = 0
    $stable = 0.0
    $sawActivity = $false
    $prev = $null
    $lastPrint = -10.0
    $lastSplitCheck = -12.0
    $lastCropW = 0
    $lastCropH = 0

    $lostCount = 0
    Write-Output ('READY ' + $winTitle)

    while ($true) {
        # ---- control file ----
        $control = ''
        if ($controlFile -and (Test-Path -LiteralPath $controlFile)) {
            try { $control = ([System.IO.File]::ReadAllText($controlFile)).Trim() } catch { $control = '' }
        }
        if ($control -eq 'stop') {
            Save-Result @{ ok = $true; reason = 'stopped'; elapsed = [Math]::Round(($sw.ElapsedMilliseconds - $pausedMs) / 1000.0, 1) }
            exit 3
        }
        if ($control -eq 'skip') {
            Save-Result @{ ok = $true; reason = 'skipped'; elapsed = [Math]::Round(($sw.ElapsedMilliseconds - $pausedMs) / 1000.0, 1) }
            exit 4
        }
        if ($control -eq 'pause') {
            Start-Sleep -Milliseconds 400
            $pausedMs += 400
            continue
        }

        # ---- timeout ----
        $elapsed = ($sw.ElapsedMilliseconds - $pausedMs) / 1000.0
        if ($elapsed -ge $timeoutSec) {
            Write-Output ('TIMEOUT ' + [int]$elapsed)
            Save-Result @{ ok = $true; reason = 'timeout'; elapsed = [Math]::Round($elapsed, 1) }
            exit 2
        }

        # ---- window still alive? 句柄失效就重新找，找不到才认输 ----
        if (-not [AutoWin]::IsWindow($hwnd)) {
            $re = Get-TargetWindow -TitleKeyword ([string]$job.titleKeyword) -ProcessName ([string]$job.processName)
            if ($re.hwnd -ne [IntPtr]::Zero) {
                $hwnd = $re.hwnd
                $lostCount = 0
            }
            else {
                $lostCount++
                if ($lostCount -ge 3) {
                    Save-Result @{ ok = $false; reason = 'window-lost' }
                    exit 5
                }
                Start-Sleep -Milliseconds 400
                continue
            }
        }
        elseif (-not [AutoWin]::IsWindowVisible($hwnd)) {
            # 被收进托盘时截屏是黑的，静默恢复显示（保持最大化状态）
            [AutoWin]::EnsureShown($hwnd)
            Start-Sleep -Milliseconds 300
        }

        # ---- capture + diff ----
        # Prefer PrintWindow: it renders the window itself, so covering it with
        # another program does not break detection. Fall back to screen copy.
        $frame = Capture-WindowFrame -Hwnd $hwnd
        if ($null -eq $frame) {
            $wx = 0; $wy = 0; $ww = 0; $wh = 0
            [AutoWin]::GetFrame($hwnd, [ref]$wx, [ref]$wy, [ref]$ww, [ref]$wh)
            if ($ww -gt 40 -and $wh -gt 40) {
                $frame = Capture-Region -X $wx -Y $wy -W $ww -H $wh
            }
        }

        # 每十几秒重新看一眼界面有没有分栏（用户可能中途打开/关闭右侧预览面板）
        if (-not $monitorFixed -and $null -ne $frame -and ($elapsed - $lastSplitCheck) -ge 12.0) {
            $lastSplitCheck = $elapsed
            $detected = Get-VerticalSplit -Frame $frame
            if ($detected -lt 96.0 -and [Math]::Abs($detected - $autoSplit) -gt 1.0) {
                $autoSplit = $detected
                Write-Output ('SPLIT ' + $autoSplit)
            }
            elseif ($detected -ge 96.0 -and $autoSplit -lt 96.0) {
                $autoSplit = 100.0
                Write-Output 'SPLIT 100'
            }
        }

        # 裁掉右侧的实时预览面板，只看左侧对话/输出区；
        # 再裁掉底部输入框区域：那里有光标闪烁，每几秒就产生几个变化点，
        # 会被当成"还在输出"，导致永远等不到静止
        $cropPct = $monitorWidthPercent
        if (-not $monitorFixed) { $cropPct = $autoSplit }
        if ($null -ne $frame) {
            $cw = $frame.w
            $ch = [int]($frame.h * (1.0 - $bottomIgnorePercent / 100.0))
            if ($cropPct -lt 99.5) { $cw = [int]($frame.w * $cropPct / 100.0) }
            if ($cw -lt 80) { $cw = $frame.w }
            if ($ch -lt 80) { $ch = $frame.h }

            if ($cw -ne $lastCropW -or $ch -ne $lastCropH) {
                # 裁剪尺寸变了，旧帧没法和新帧比，重新开始
                $prev = $null
                $lastCropW = $cw
                $lastCropH = $ch
            }
            $frame = Crop-Frame -Frame $frame -CropW $cw -CropH $ch
        }

        $ratio = 1.0
        if ($null -ne $frame) {
            if ($null -ne $prev) {
                # block-wise diff: catches small local updates (progress %, spinner)
                # that a global percentage would miss
                $cmp = Compare-Region-Blocks -A $prev -B $frame -Step $step -PixelThreshold $pixelThreshold
                $ratio = $cmp.global

                # 三条任一成立就算"还在动"：
                # 1) 变化采样点够多（小文字/进度数字更新的主判据）
                # 2) 某一块大面积刷新
                # 3) 全图变化率超过设定百分比
                $moving = ($cmp.changedCount -ge $minChangedPixels) -or
                          ($cmp.maxBlock -ge 0.05) -or
                          ($ratio -gt $thresholdPct)
                if ($moving) {
                    $stable = 0.0
                    if (-not $sawActivity) {
                        $sawActivity = $true
                        Write-Output ('ACTIVITY ' + [int]$elapsed)
                    }
                }
                else {
                    $stable += $intervalSec
                }
            }
            $prev = $frame
        }

        if (($elapsed - $lastPrint) -ge 1.0) {
            $lastPrint = $elapsed
            Write-Output ('TICK ' + [int]$elapsed + ' ' + [Math]::Round($ratio, 4) + ' ' + [Math]::Round($stable, 1))
        }

        # Done only when: output actually started, then stayed still long enough
        if ($sawActivity -and $elapsed -ge $minWait -and $stable -ge $stableTarget) {
            Write-Output 'IDLE'
            Save-Result @{ ok = $true; reason = 'idle'; elapsed = [Math]::Round($elapsed, 1); stable = [Math]::Round($stable, 1) }
            exit 0
        }

        # Nothing ever moved on screen: treat as finished rather than hanging forever
        if (-not $sawActivity -and $elapsed -ge $noActivityLimit) {
            Write-Output 'IDLE-NO-ACTIVITY'
            Save-Result @{ ok = $true; reason = 'no-activity'; elapsed = [Math]::Round($elapsed, 1) }
            exit 0
        }

        Start-Sleep -Milliseconds $intervalMs
    }
}
catch {
    Save-Result @{ ok = $false; error = 'UNEXPECTED'; detail = $_.Exception.Message }
    Write-Output ('ERROR ' + $_.Exception.Message)
    exit 1
}
