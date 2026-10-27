# =====================================================================
#  automation.ps1 - activate target window / focus input / paste / send
#  NOTE: keep this file ASCII-only (Windows PowerShell 5.1 reads BOM-less
#        files as ANSI, which would corrupt non-ASCII literals).
#  Usage: powershell -NoProfile -Sta -ExecutionPolicy Bypass -File automation.ps1 -JobFile job.json
#  job.action: find | send | activate | cursor
#  exit: 0 ok, 1 error
# =====================================================================

param(
    [Parameter(Mandatory = $true)][string]$JobFile
)

. "$PSScriptRoot\common.ps1"

# 进度行必须直接写 stdout：函数里的 Write-Output 会被 $r = Invoke-ClickPaste 捕获，
# 那样这些 STEP 行就到不了主进程的日志里了
function Write-Step {
    param([string]$Line)
    [Console]::Out.WriteLine($Line)
}

# 点击一个点位 -> 确认能输入 -> 粘贴文本 -> 截屏比对（仅作参考）
# 返回 @{ ok; ratio; caret; skipped; error; detail }
function Invoke-ClickPaste {
    param(
        [IntPtr]$Hwnd,
        [int]$TargetPid,
        [int]$Cx,
        [int]$Cy,
        [string]$Text,
        [bool]$ClearFirst,
        [int]$RegionW,
        [int]$RegionH
    )

    $out = @{ ok = $false; ratio = 0.0; caret = $false; skipped = $false; error = ''; detail = '' }

    # confirm focus before every click
    if ([AutoWin]::GetForegroundWindow() -ne $Hwnd) {
        $out.error = 'FG_LOST'
        $out.detail = 'lost foreground before click, input cancelled'
        return $out
    }

    Write-Step ('STEP:click ' + $Cx + ',' + $Cy)
    [AutoWin]::ClickAt($Cx, $Cy)
    Start-Sleep -Milliseconds 420

    # after clicking, make sure the keyboard focus went to the target process
    $focusPid = Get-FocusProcessId
    if ($focusPid -ne 0 -and $focusPid -ne $TargetPid) {
        $out.error = 'FOCUS_WRONG_PROCESS'
        $out.detail = ('focus went to pid ' + $focusPid + ', not target pid ' + $TargetPid + ', input cancelled')
        return $out
    }

    # 先确认这个点真的能输入：粘贴一小段标记再复制回读。
    # 不能输入就直接跳过（点到了右侧预览面板 / 空白区时就走这里），
    # 这样绝不会把提示词粘到不该粘的地方，也不会误报"已输入"。
    if ($ClearFirst) {
        $marker = 'pbs' + (Get-Random -Minimum 100000 -Maximum 999999)
        $out.caret = Test-InputByPaste -Marker $marker
        if ($out.caret) {
            Write-Step 'STEP:caret-ok'
        }
        else {
            Write-Step 'STEP:caret-no'
            $out.skipped = $true
            $out.ok = $true
            return $out
        }
    }

    # 探测失败不需要再清空（探测里面已经全选删过了）
    if ($ClearFirst -and -not $out.caret) {
        # do it twice: a single Ctrl+A sometimes only selects the page body
        # (contenteditable), leaving the old draft in place
        [System.Windows.Forms.SendKeys]::SendWait('^a')
        Start-Sleep -Milliseconds 110
        [System.Windows.Forms.SendKeys]::SendWait('{DEL}')
        Start-Sleep -Milliseconds 140
        [System.Windows.Forms.SendKeys]::SendWait('^a')
        Start-Sleep -Milliseconds 90
        [System.Windows.Forms.SendKeys]::SendWait('{DEL}')
        Start-Sleep -Milliseconds 160
    }

    # 截屏区域必须落在虚拟屏幕内：窗口最大化时输入框贴着屏幕下边缘，
    # 区域越界会让 CopyFromScreen 直接抛异常，等于这次校验永远失败
    $rx = $Cx - [int]($RegionW / 2)
    $ry = $Cy - [int]($RegionH / 2)
    $vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
    if ($rx -lt $vs.Left) { $rx = $vs.Left }
    if ($ry -lt $vs.Top) { $ry = $vs.Top }
    if (($rx + $RegionW) -gt ($vs.Left + $vs.Width)) { $rx = $vs.Left + $vs.Width - $RegionW }
    if (($ry + $RegionH) -gt ($vs.Top + $vs.Height)) { $ry = $vs.Top + $vs.Height - $RegionH }

    $before = Capture-Region -X $rx -Y $ry -W $RegionW -H $RegionH

    if ([AutoWin]::GetForegroundWindow() -ne $Hwnd) {
        $out.error = 'FG_LOST'
        $out.detail = 'lost foreground before paste, input cancelled'
        return $out
    }

    Write-Step 'STEP:paste-text'
    if (-not (Set-ClipboardText -Text $Text)) {
        $out.error = 'CLIPBOARD_FAILED'
        return $out
    }
    Start-Sleep -Milliseconds 150

    # clipboard can be stolen between SetText and Ctrl+V (user copying logs,
    # clipboard manager, other automation). verify it right before pasting.
    $cbNow = Get-ClipboardText
    if (-not (Test-TextMatch -Expected $Text -Actual $cbNow)) {
        Write-Step 'STEP:clipboard-retry'
        [void](Set-ClipboardText -Text $Text)
        Start-Sleep -Milliseconds 180
        $cbNow2 = Get-ClipboardText
        if (-not (Test-TextMatch -Expected $Text -Actual $cbNow2)) {
            $out.error = 'CLIPBOARD_STOLEN'
            $out.detail = 'clipboard content is not our prompt'
            return $out
        }
    }

    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 550

    $after = Capture-Region -X $rx -Y $ry -W $RegionW -H $RegionH
    if ($null -ne $before -and $null -ne $after) {
        $out.ratio = Compare-Region -A $before -B $after -Step 3 -PixelThreshold 26
    }
    $out.ok = $true
    return $out
}

$script:ResultFile = $null
$job = $null

try {
    $job = [System.IO.File]::ReadAllText($JobFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
    $script:ResultFile = $job.resultFile
}
catch {
    Save-Result @{ ok = $false; error = 'JOB_READ_FAILED'; detail = $_.Exception.Message }
    exit 1
}

try {
    [AutoWin]::EnableDpiAwareness()

    $titleKeyword = [string]$job.titleKeyword
    $processName = [string]$job.processName

    $win = Get-TargetWindow -TitleKeyword $titleKeyword -ProcessName $processName

    if ($job.action -eq 'find') {
        if ($win.hwnd -eq [IntPtr]::Zero) {
            Save-Result @{ ok = $true; found = $false }
        }
        else {
            Save-Result @{ ok = $true; found = $true; title = $win.title; pid = $win.pid }
        }
        exit 0
    }

    if ($win.hwnd -eq [IntPtr]::Zero) {
        Save-Result @{ ok = $false; error = 'WINDOW_NOT_FOUND'; detail = $titleKeyword }
        exit 1
    }

    Write-Output 'STEP:activate'
    $fgOk = [AutoWin]::ForceForeground($win.hwnd)

    $fx = 0; $fy = 0; $fw = 0; $fh = 0
    [AutoWin]::GetFrame($win.hwnd, [ref]$fx, [ref]$fy, [ref]$fw, [ref]$fh)

    if ($job.action -eq 'activate') {
        Save-Result @{
            ok       = $fgOk
            focused  = [bool]$fgOk
            title    = $win.title
            pid      = $win.pid
            windowW  = $fw
            windowH  = $fh
        }
        exit 0
    }

    if ($job.action -eq 'cursor') {
        for ($i = 3; $i -gt 0; $i--) {
            Write-Output ('STEP:countdown ' + $i)
            Start-Sleep -Seconds 1
        }
        [int]$mx = 0
        [int]$my = 0
        [AutoWin]::GetCursor([ref]$mx, [ref]$my)
        $px = 0.0
        $py = 0.0
        if ($fw -gt 0) { $px = (($mx - $fx) / $fw) * 100.0 }
        if ($fh -gt 0) { $py = (($my - $fy) / $fh) * 100.0 }
        Save-Result @{
            ok          = $true
            screenX     = $mx
            screenY     = $my
            percentX    = [Math]::Round($px, 2)
            percentY    = [Math]::Round($py, 2)
            windowTitle = $win.title
            windowW     = $fw
            windowH     = $fh
        }
        exit 0
    }

    # ---------------------------------------------------------------
    #  1) locate input box
    # ---------------------------------------------------------------
    $verified = $false
    $verifies = @()
    $clickedX = 0.0
    $clickedY = 0.0
    $clickSource = ''
    $configIndex = -1
    # Low floor: WorkBuddy folds long pastes into a file attachment, and the
    # resulting chip is a small but real localized screen change. 0.5% is enough
    # to confirm the paste landed while still rejecting a no-op paste (input not
    # ready) whose diff is essentially 0.
    $minChange = 0.005
    if ($job.minChangeRatio) { $minChange = [double]$job.minChangeRatio }

    # hard gate: no foreground focus means no typing at all
    if (-not $fgOk -or [AutoWin]::GetForegroundWindow() -ne $win.hwnd) {
        Save-Result @{ ok = $false; error = 'FG_FAILED'; detail = 'cannot focus target window, input cancelled' }
        exit 1
    }
    Write-Output 'STEP:focused'

    # let the window settle down after being restored, then read its rect again
    Start-Sleep -Milliseconds 1200

    [AutoWin]::GetFrame($win.hwnd, [ref]$fx, [ref]$fy, [ref]$fw, [ref]$fh)
    if ($fw -lt 400 -or $fh -lt 300 -or $fx -le -30000 -or $fy -le -30000) {
        Save-Result @{
            ok     = $false
            error  = 'WINDOW_ABNORMAL'
            detail = ('bad window rect: ' + $fw + 'x' + $fh + ' @ ' + $fx + ',' + $fy)
        }
        exit 1
    }

    $text = ''
    if ($job.text) { $text = [string]$job.text }

    $clearFirst = $false
    if ($job.clearFirst) { $clearFirst = [bool]$job.clearFirst }

    # verification capture region: a patch around the click point, fixed for all attempts
    $rw = [int]([Math]::Min(620.0, [Math]::Max(240.0, $fw * 0.45)))
    $rh = [int]([Math]::Min(230.0, [Math]::Max(90.0, $fh * 0.16)))

    # 界面是不是分栏了（右侧弹出了实时预览面板）：直接从截图里找那条竖直边界。
    # 找到之后：点击只在左栏里找，不会点进预览面板；等待输出时也只需要看左栏。
    $splitPct = 100.0
    $fullFrame = Capture-WindowFrame -Hwnd $win.hwnd
    if ($null -ne $fullFrame) {
        $splitPct = Get-VerticalSplit -Frame $fullFrame
    }
    Write-Output ('STEP:split ' + $splitPct)

    # ---- build click candidates -------------------------------------
    # Order matters:
    #   1) points probed from the accessibility tree - they carry the real rect
    #      of the composer, so a right-hand preview panel (which narrows the chat
    #      column) does not matter at all, no re-sampling needed
    #   2) the points sampled in the settings (manual fallback)
    #   3) a layout sweep, only when everything above missed
    $candidates = New-Object System.Collections.ArrayList
    $sources = New-Object System.Collections.ArrayList
    $srcIdx = New-Object System.Collections.ArrayList

    $probe = @{ points = @(); count = 0; strictCount = 0; splitPercent = 100.0; best = $null }
    if ($job.focusStrategy -ne 'click') {
        Write-Output 'STEP:focus'
        $probe = Get-InputCandidates -Hwnd $win.hwnd -WinLeft $fx -WinTop $fy -WinW $fw -WinH $fh
        Write-Output ('STEP:probe ' + $probe.count + ' ' + $probe.splitPercent)
        # 只有"确实像输入框"的探测结果才值得直接 SetFocus，
        # 整页文档之类模糊目标只当点击候选，别去抢焦点
        if ($probe.best -and $probe.strictCount -gt 0) {
            try {
                $probe.best.SetFocus()
                Start-Sleep -Milliseconds 200
                if ($probe.best.Current.HasKeyboardFocus) { Write-Output 'STEP:focus-ok' }
            }
            catch { }
        }
        # 无障碍接口给出的分栏边界未必有（Electron 应用通常查不到），
        # 有的情况下比截图更准，拿来补空
        if ($splitPct -ge 96.0 -and $probe.splitPercent -ge 30.0 -and $probe.splitPercent -le 92.0) {
            $splitPct = [double]$probe.splitPercent
        }
    }

    $configPoints = New-Object System.Collections.ArrayList
    if ($job.candidates) {
        $cni = 0
        foreach ($c in $job.candidates) {
            [void]$configPoints.Add(@([double]$c.x, [double]$c.y, $cni))
            $cni++
        }
    }
    if ($configPoints.Count -eq 0) {
        $px0 = 50.0
        $py0 = 88.0
        if ($job.clickXPercent) { $px0 = [double]$job.clickXPercent }
        if ($job.clickYPercent) { $py0 = [double]$job.clickYPercent }
        [void]$configPoints.Add(@($px0, $py0, 0))
    }

    # 探测到的点只有"确实像输入框"时才排在手动定位点前面；
    # 只找到整页文档这类模糊目标时排到后面，别抢了手动取样的点
    $probeFirst = ($probe.count -gt 0) -and ($probe.strictCount -gt 0)
    if ($probeFirst) {
        foreach ($p in $probe.points) {
            [void]$candidates.Add(@([double]$p.x, [double]$p.y))
            [void]$sources.Add('uia')
            [void]$srcIdx.Add(-1)
        }
    }
    foreach ($c in $configPoints) {
        [void]$candidates.Add(@($c[0], $c[1]))
        [void]$sources.Add('config')
        [void]$srcIdx.Add([int]($c[2]))
    }
    if (-not $probeFirst) {
        foreach ($p in $probe.points) {
            [void]$candidates.Add(@([double]$p.x, [double]$p.y))
            [void]$sources.Add('uia')
            [void]$srcIdx.Add(-1)
        }
    }

    $attempts = 0
    $caretFail = 0
    if ($text.Length -gt 0) {
        for ($ci = 0; $ci -lt $candidates.Count; $ci++) {
            $cxp = [double]($candidates[$ci][0])
            $cyp = [double]($candidates[$ci][1])
            $cx = [int]($fx + ($fw * $cxp / 100.0))
            $cy = [int]($fy + ($fh * $cyp / 100.0))

            # 点在按钮 / 图标 / 链接上：直接跳过，别把提示词粘到奇怪的地方
            $kind = Get-PointControlKind -X $cx -Y $cy
            if ($kind.known -and -not $kind.editable) {
                Write-Output ('STEP:skip ' + $cxp + ',' + $cyp + ' ' + $kind.controlType)
                continue
            }

            $attempts++
            $r = Invoke-ClickPaste -Hwnd $win.hwnd -TargetPid $win.pid -Cx $cx -Cy $cy -Text $text `
                -ClearFirst $clearFirst -RegionW $rw -RegionH $rh
            if ($r.error -ne '') {
                Save-Result @{ ok = $false; error = $r.error; detail = $r.detail }
                exit 1
            }
            if ($r.skipped) {
                # 这个点根本不能输入（右侧预览面板、空白区），换下一个
                $caretFail++
                continue
            }

            $verifies += [Math]::Round($r.ratio, 4)
            Write-Output ('STEP:verify ' + [Math]::Round($r.ratio, 4))

            # 清空模式下"能不能输入"已经由回读探测确认过，那才是准的判据；
            # 只有不清空（append 模式）时才退回看画面变化。
            $accepted = $false
            if ($clearFirst) { $accepted = [bool]$r.caret }
            else { $accepted = ($r.ratio -ge $minChange) }

            if ($accepted) {
                $verified = $true
                $clickedX = $cxp
                $clickedY = $cyp
                $clickSource = [string]($sources[$ci])
                $configIndex = [int]($srcIdx[$ci])
                [System.Windows.Forms.SendKeys]::SendWait('{END}')
                Start-Sleep -Milliseconds 120
                break
            }

            # clean up possible partial input then try next candidate
            [System.Windows.Forms.SendKeys]::SendWait('^a')
            Start-Sleep -Milliseconds 80
            [System.Windows.Forms.SendKeys]::SendWait('{DEL}')
            Start-Sleep -Milliseconds 150
        }
    }

    # ---- last resort: sweep the composer band ------------------------
    # Nothing above matched. Two usual reasons: the accessibility tree exposes no
    # usable composer, or the layout changed (right side preview panel opened and
    # the chat column got narrower, so every sampled percentage now misses).
    # Rebuild a few guesses from the detected split: the composer sits centered in
    # the left column, so split/2 is the best guess.
    if (-not $verified -and $text.Length -gt 0 -and $job.focusStrategy -ne 'click') {
        $split = [double]$splitPct
        $splitKnown = ($split -ge 25.0 -and $split -le 92.0)
        $xs = New-Object System.Collections.ArrayList

        # 输入框在左栏里居中：分栏边界已知时，左栏中心约在 split*0.55 处，
        # 这是最可能命中输入框的点；不知道分栏就按经验先用 45%
        $guess = 45.0
        if ($splitKnown) { $guess = $split * 0.55 }
        [void]$xs.Add([Math]::Round($guess, 1))
        if ($splitKnown) {
            [void]$xs.Add([Math]::Round($split * 0.32, 1))
            [void]$xs.Add([Math]::Round($split * 0.78, 1))
        }
        # 再横向铺开：输入框很宽，对话区被压到多窄都会落在某个扫描点上
        foreach ($g in @(30.0, 22.0, 40.0, 50.0, 60.0, 70.0)) {
            # 分栏边界右边的点一律不点（那里是预览面板）
            if ($splitKnown -and $g -ge ($split - 3.0)) { continue }
            [void]$xs.Add($g)
        }

        # 扫描总次数上限：目标正在生成（输入框禁用）时别把界面点个遍
        $sweepMax = 9
        :sweep foreach ($gy in @(89.0, 84.0)) {
            $rowChanged = $false
            foreach ($gx in $xs) {
                if ($attempts -ge $sweepMax) { break sweep }

                $dup = $false
                foreach ($c in $candidates) {
                    if ([Math]::Abs([double]($c[0]) - $gx) -lt 3.0 -and [Math]::Abs([double]($c[1]) - $gy) -lt 2.0) {
                        $dup = $true
                        break
                    }
                }
                if ($dup) { continue }

                $cx = [int]($fx + ($fw * $gx / 100.0))
                $cy = [int]($fy + ($fh * $gy / 100.0))
                $kind = Get-PointControlKind -X $cx -Y $cy
                if ($kind.known -and -not $kind.editable) {
                    Write-Output ('STEP:skip ' + $gx + ',' + $gy + ' ' + $kind.controlType)
                    continue
                }

                $attempts++
                Write-Output ('STEP:sweep ' + $gx + ',' + $gy)
                $r = Invoke-ClickPaste -Hwnd $win.hwnd -TargetPid $win.pid -Cx $cx -Cy $cy -Text $text `
                    -ClearFirst $clearFirst -RegionW $rw -RegionH $rh
                if ($r.error -ne '') {
                    Save-Result @{ ok = $false; error = $r.error; detail = $r.detail }
                    exit 1
                }
                if ($r.skipped) {
                    $caretFail++
                    continue
                }

                $verifies += [Math]::Round($r.ratio, 4)
                Write-Output ('STEP:verify ' + [Math]::Round($r.ratio, 4))
                if ($r.ratio -gt 0.0005) { $rowChanged = $true }

                $accepted = $false
                if ($clearFirst) { $accepted = [bool]$r.caret }
                else { $accepted = ($r.ratio -ge $minChange) }

                if ($accepted) {
                    $verified = $true
                    $clickedX = $gx
                    $clickedY = $gy
                    $clickSource = 'sweep'
                    $configIndex = -1
                    [System.Windows.Forms.SendKeys]::SendWait('{END}')
                    Start-Sleep -Milliseconds 120
                    break sweep
                }

                [System.Windows.Forms.SendKeys]::SendWait('^a')
                Start-Sleep -Milliseconds 80
                [System.Windows.Forms.SendKeys]::SendWait('{DEL}')
                Start-Sleep -Milliseconds 150
            }

            # 这一排完全没有画面反应：输入框可能在更高/更低的位置，换一排再试；
            # 已经有反应却没通过校验，说明这条带已经找对了，再换一排也是白点
            if ($rowChanged) { break sweep }
        }
    }

    # no text at all: just click the best point so images can be pasted
    if (-not $verified -and $text.Length -eq 0) {
        $cxp = [double]($candidates[0][0])
        $cyp = [double]($candidates[0][1])
        $cx = [int]($fx + ($fw * $cxp / 100.0))
        $cy = [int]($fy + ($fh * $cyp / 100.0))
        Write-Output ('STEP:click ' + $cx + ',' + $cy)
        [AutoWin]::ClickAt($cx, $cy)
        Start-Sleep -Milliseconds 300
        $verified = $true
        $clickedX = $cxp
        $clickedY = $cyp
        $clickSource = [string]($sources[0])
    }

    if (-not $verified) {
        # 全部点位都"点不出可输入区域"：多半是界面根本没露出输入框
        # （预览面板占满整个窗口 / 切换到了别的页面），和"正在生成"是两回事
        $noInput = ($caretFail -gt 0 -and $caretFail -ge $attempts)
        $errCode = 'INPUT_NOT_READY'
        $errDetail = 'input box did not accept text (app may still be generating)'
        if ($noInput) {
            $errCode = 'INPUT_NOT_FOUND'
            $errDetail = 'no editable input found (composer hidden, or preview occupies the window)'
        }
        Save-Result @{
            ok           = $false
            error        = $errCode
            detail       = $errDetail
            points       = $verifies
            attempts     = $attempts
            skipped      = $caretFail
            splitPercent = $splitPct
            windowW      = $fw
            windowH      = $fh
        }
        exit 1
    }

    # ---------------------------------------------------------------
    #  2) paste images
    # ---------------------------------------------------------------
    if ($job.images) {
        $idx = 0
        foreach ($img in $job.images) {
            $idx++
            if (-not ($img -and (Test-Path -LiteralPath ([string]$img)))) { continue }
            Write-Output ('STEP:paste-image ' + $idx)
            if (Set-ClipboardImage -Path ([string]$img)) {
                Start-Sleep -Milliseconds 320
                [System.Windows.Forms.SendKeys]::SendWait('^v')
                Start-Sleep -Milliseconds 900
            }
        }
    }

    Start-Sleep -Milliseconds 250

    # ---------------------------------------------------------------
    #  3) send
    # ---------------------------------------------------------------
    $sendKey = 'enter'
    if ($job.sendKey) { $sendKey = [string]$job.sendKey }

    # last check before hitting Enter: focus must still be the target window
    if ($sendKey -ne 'none') {
        if ([AutoWin]::GetForegroundWindow() -ne $win.hwnd) {
            Save-Result @{ ok = $false; error = 'FG_LOST'; detail = 'lost foreground before send, enter not pressed' }
            exit 1
        }
        $focusPid = Get-FocusProcessId
        if ($focusPid -ne 0 -and $focusPid -ne $win.pid) {
            Save-Result @{
                ok     = $false
                error  = 'FOCUS_WRONG_PROCESS'
                detail = ('focus on pid ' + $focusPid + ' instead of ' + $win.pid + ', enter not pressed')
            }
            exit 1
        }
    }

    switch ($sendKey) {
        'enter' {
            Write-Output 'STEP:send-enter'
            [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
        }
        'ctrl+enter' {
            Write-Output 'STEP:send-ctrl-enter'
            [System.Windows.Forms.SendKeys]::SendWait('^{ENTER}')
        }
        'shift+enter' {
            Write-Output 'STEP:send-shift-enter'
            [System.Windows.Forms.SendKeys]::SendWait('+{ENTER}')
        }
        default {
            Write-Output 'STEP:no-send'
        }
    }

    # some AI clients (e.g. WorkBuddy) minimize themselves to tray right after
    # receiving a task - bring it back so frame capture keeps working
    if ($sendKey -ne 'none') {
        Start-Sleep -Milliseconds 700
        [AutoWin]::EnsureShown($win.hwnd)
    }

    Save-Result @{
        ok             = $true
        title          = $win.title
        pid            = $win.pid
        verified       = $verified
        source         = $clickSource
        configIndex    = $configIndex
        clickedXPercent = [Math]::Round($clickedX, 2)
        clickedYPercent = [Math]::Round($clickedY, 2)
        splitPercent   = $splitPct
        attempts       = $attempts
    }
    exit 0
}
catch {
    Save-Result @{ ok = $false; error = 'UNEXPECTED'; detail = $_.Exception.Message }
    exit 1
}
