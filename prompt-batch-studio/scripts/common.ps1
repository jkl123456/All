# =====================================================================
#  common.ps1 - shared Win32 / UIAutomation / screen-capture helpers
#  Dot-sourced by automation.ps1 and wait-idle.ps1.
#  NOTE: keep this file ASCII-only (Windows PowerShell 5.1 reads BOM-less
#        files as ANSI, so non-ASCII literals would be corrupted).
# =====================================================================

$ErrorActionPreference = 'Stop'

foreach ($asm in @('UIAutomationClient', 'UIAutomationTypes', 'System.Windows.Forms', 'System.Drawing')) {
    try { Add-Type -AssemblyName $asm -ErrorAction Stop } catch { }
}

if (-not ('AutoWin' -as [type])) {
    $cs = @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class AutoWin
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr hWnd);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int cmd);
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, int after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool attach);
    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, IntPtr extra);
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra);
    [DllImport("user32.dll")]
    public static extern void SwitchToThisWindow(IntPtr hWnd, bool altTab);
    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out RECT r, int size);

    public static void EnableDpiAwareness()
    {
        try { SetProcessDPIAware(); } catch { }
    }

    public static IntPtr FindWindow(string keyword, string processName, int excludePid, out string title, out int pid)
    {
        // priority: title+process match > process match > title match
        IntPtr bestBoth = IntPtr.Zero;
        IntPtr bestProc = IntPtr.Zero;
        IntPtr bestTitle = IntPtr.Zero;
        long bestBothArea = -1;
        long bestProcArea = -1;
        long bestTitleArea = -1;
        string textBoth = "";
        string textProc = "";
        string textTitle = "";
        int pidBoth = 0;
        int pidProc = 0;
        int pidTitle = 0;

        EnumWindows(delegate(IntPtr h, IntPtr l)
        {
            int len = GetWindowTextLength(h);
            if (len <= 0) return true;

            StringBuilder sb = new StringBuilder(len + 2);
            GetWindowText(h, sb, sb.Capacity);
            string t = sb.ToString();
            if (t == null || t.Length == 0) return true;

            uint wp = 0;
            GetWindowThreadProcessId(h, out wp);
            if (excludePid > 0 && (int)wp == excludePid) return true;

            RECT r;
            GetWindowRect(h, out r);
            long area = (long)(r.Right - r.Left) * (long)(r.Bottom - r.Top);
            if (area <= 0) return true;

            bool visible = IsWindowVisible(h);
            // 隐藏窗口（Electron 收进托盘）只做兜底，且必须是有正常尺寸的主窗口
            if (!visible && area < 40000) return true;
            long score = area * (visible ? 1000L : 1L);

            bool titleHit = (keyword != null && keyword.Length > 0 &&
                             t.IndexOf(keyword, StringComparison.OrdinalIgnoreCase) >= 0);

            string pname = "";
            try
            {
                Process p = Process.GetProcessById((int)wp);
                if (p != null && p.ProcessName != null) pname = p.ProcessName.ToLowerInvariant();
            }
            catch { pname = ""; }

            bool procHit = (processName != null && processName.Length > 0 &&
                            pname.IndexOf(processName.ToLowerInvariant(), StringComparison.Ordinal) >= 0);

            // title-only fallback must never hijack a browser window
            bool isBrowser = (pname == "chrome" || pname == "msedge" || pname == "firefox" ||
                              pname == "iexplore" || pname == "brave" || pname == "opera" ||
                              pname == "vivaldi" || pname == "360se" || pname == "qqbrowser");

            if (titleHit && procHit)
            {
                if (score > bestBothArea)
                {
                    bestBothArea = score;
                    bestBoth = h;
                    textBoth = t;
                    pidBoth = (int)wp;
                }
                return true;
            }
            if (procHit)
            {
                if (score > bestProcArea)
                {
                    bestProcArea = score;
                    bestProc = h;
                    textProc = t;
                    pidProc = (int)wp;
                }
                return true;
            }
            if (titleHit && !isBrowser)
            {
                if (score > bestTitleArea)
                {
                    bestTitleArea = score;
                    bestTitle = h;
                    textTitle = t;
                    pidTitle = (int)wp;
                }
            }
            return true;
        }, IntPtr.Zero);

        if (bestBoth != IntPtr.Zero)
        {
            title = textBoth;
            pid = pidBoth;
            return bestBoth;
        }
        if (bestProc != IntPtr.Zero)
        {
            title = textProc;
            pid = pidProc;
            return bestProc;
        }
        if (bestTitle != IntPtr.Zero)
        {
            title = textTitle;
            pid = pidTitle;
            return bestTitle;
        }
        title = "";
        pid = 0;
        return IntPtr.Zero;
    }

    /// 把窗口恢复到"正常可见"的状态，并保持它原本的最大化状态。
    /// 要点：
    ///   1. 最小化窗口的 GetWindowRect 会变成 (-32000,-32000,160x28)，IsZoomed 也会变 false，
    ///      所以要靠 GWL_STYLE 里的 WS_MAXIMIZE 位判断它"本来是不是最大化"
    ///   2. SW_RESTORE(9) 会顺带取消最大化，最大化窗口必须用 SW_MAXIMIZE(3)
    public static void EnsureShown(IntPtr h)
    {
        if (!IsWindow(h)) return;

        bool visible = IsWindowVisible(h);
        bool iconic = IsIconic(h);

        RECT r;
        GetWindowRect(h, out r);
        bool offscreen = r.Left <= -30000 || r.Top <= -30000;
        bool tooSmall = (r.Right - r.Left) < 300 || (r.Bottom - r.Top) < 200;
        bool weird = offscreen || tooSmall || iconic;

        if (visible && !weird) return;   // 状态正常，不折腾

        // 用样式位判断"本应最大化"（最小化后 IsZoomed 不可靠）
        int style = GetWindowLong(h, -16);            // GWL_STYLE
        // 尺寸异常（-32000 或 160x28 这类迷你状态）不可能是用户有意设置的，直接最大化
        bool wantMax = (style & 0x01000000) != 0 || offscreen || tooSmall;

        if (offscreen)
        {
            // -32000 是最小化占位坐标，窗口待在屏幕外时 SW_MAXIMIZE 不生效，先搬回屏幕内
            SetWindowPos(h, 0, 0, 0, 1280, 800, 0x0004);   // SWP_NOZORDER
            System.Threading.Thread.Sleep(150);
        }

        ShowWindow(h, wantMax ? 3 : 9);                // SW_MAXIMIZE / SW_RESTORE
        System.Threading.Thread.Sleep(400);

        // 再兜一次，防止被应用自己弹回去
        if (!IsWindowVisible(h) || IsIconic(h))
        {
            ShowWindow(h, wantMax ? 3 : 1);            // SW_MAXIMIZE / SW_SHOWNORMAL
            System.Threading.Thread.Sleep(300);
        }
    }

    /// 等待窗口真正拿到前台焦点
    public static bool WaitForeground(IntPtr h, int tries, int intervalMs)
    {
        for (int i = 0; i < tries; i++)
        {
            if (GetForegroundWindow() == h) return true;
            System.Threading.Thread.Sleep(intervalMs);
        }
        return false;
    }

    /// 聚焦目标窗口。只做四件事，每件都等结果确认，绝不改变窗口的其他状态：
    ///   1) 需要时恢复正常显示  2) SetForegroundWindow  3) 挂接输入线程再试  4) ALT 解锁再试
    /// 不做：最小化、SwitchToThisWindow、置顶。这些都会把 Electron 窗口搞丢。
    public static bool ForceForeground(IntPtr h)
    {
        if (!IsWindow(h)) return false;

        EnsureShown(h);
        if (GetForegroundWindow() == h) return true;

        SetForegroundWindow(h);
        if (WaitForeground(h, 8, 120)) return true;

        uint dummy = 0;
        uint targetThread = GetWindowThreadProcessId(h, out dummy);
        uint fgThread = GetWindowThreadProcessId(GetForegroundWindow(), out dummy);
        uint cur = GetCurrentThreadId();

        AttachThreadInput(cur, targetThread, true);
        AttachThreadInput(cur, fgThread, true);
        BringWindowToTop(h);
        SetForegroundWindow(h);
        AttachThreadInput(cur, fgThread, false);
        AttachThreadInput(cur, targetThread, false);
        if (WaitForeground(h, 8, 120)) return true;

        keybd_event(0x12, 0, 0, IntPtr.Zero);
        System.Threading.Thread.Sleep(60);
        keybd_event(0x12, 0, 2, IntPtr.Zero);
        System.Threading.Thread.Sleep(60);
        SetForegroundWindow(h);
        return WaitForeground(h, 10, 120);
    }

    public static void ClickAt(int x, int y)
    {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(80);
        mouse_event(0x0002, 0, 0, 0, IntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        mouse_event(0x0004, 0, 0, 0, IntPtr.Zero);
    }

    public static void GetFrame(IntPtr h, out int x, out int y, out int w, out int hh)
    {
        RECT r = new RECT();
        bool ok = false;
        try
        {
            int hr = DwmGetWindowAttribute(h, 9, out r, Marshal.SizeOf(typeof(RECT)));
            ok = (hr == 0) && ((r.Right - r.Left) > 0) && ((r.Bottom - r.Top) > 0);
        }
        catch { ok = false; }
        if (!ok)
        {
            GetWindowRect(h, out r);
        }
        x = r.Left;
        y = r.Top;
        w = r.Right - r.Left;
        hh = r.Bottom - r.Top;
    }

    public static void GetCursor(out int x, out int y)
    {
        POINT p = new POINT();
        GetCursorPos(out p);
        x = p.X;
        y = p.Y;
    }
}
"@
    Add-Type -TypeDefinition $cs -Language CSharp
}

function Save-Result {
    param($Object)
    $json = $Object | ConvertTo-Json -Depth 8 -Compress
    if ($script:ResultFile) {
        [System.IO.File]::WriteAllText($script:ResultFile, $json, (New-Object System.Text.UTF8Encoding($false)))
    }
    else {
        [Console]::Out.WriteLine($json)
    }
}

function Get-TargetWindow {
    param([string]$TitleKeyword, [string]$ProcessName)
    [string]$foundTitle = ''
    [int]$foundPid = 0
    $hwnd = [AutoWin]::FindWindow($TitleKeyword, $ProcessName, $PID, [ref]$foundTitle, [ref]$foundPid)
    return @{ hwnd = $hwnd; title = $foundTitle; pid = $foundPid }
}

function Set-ClipboardText {
    param([string]$Text)
    for ($i = 0; $i -lt 6; $i++) {
        try {
            [System.Windows.Forms.Clipboard]::SetText($Text)
            return $true
        }
        catch {
            Start-Sleep -Milliseconds 150
        }
    }
    return $false
}

function Get-ClipboardText {
    for ($i = 0; $i -lt 5; $i++) {
        try { return [string][System.Windows.Forms.Clipboard]::GetText() } catch { Start-Sleep -Milliseconds 120 }
    }
    return ''
}

function Test-TextMatch {
    param([string]$Expected, [string]$Actual)
    if (-not $Actual) { return $false }
    $e = ($Expected -replace '\s+', ' ').Trim()
    $a = ($Actual -replace '\s+', ' ').Trim()
    if ($a.Length -lt 4) { return $false }
    if ($e.Contains($a)) { return $true }
    $n = [Math]::Min(24, $a.Length)
    if ($e.Contains($a.Substring(0, $n))) { return $true }
    return $false
}

function Test-ElementTextAt {
    param([int]$X, [int]$Y, [string]$Expected)
    try {
        $pt = New-Object System.Windows.Point($X, $Y)
        $el = [System.Windows.Automation.AutomationElement]::FromPoint($pt)
        if ($null -eq $el) { return $false }
        $name = [string]$el.Current.Name
        return (Test-TextMatch -Expected $Expected -Actual $name)
    }
    catch {
        return $false
    }
}

function Set-ClipboardImage {
    param([string]$Path)
    $img = $null
    $bmp = $null
    try {
        $img = [System.Drawing.Image]::FromFile($Path)
        $bmp = New-Object System.Drawing.Bitmap($img)
    }
    catch {
        if ($img) { $img.Dispose() }
        return $false
    }
    finally {
        if ($img) { $img.Dispose() }
    }
    for ($i = 0; $i -lt 6; $i++) {
        try {
            [System.Windows.Forms.Clipboard]::SetImage($bmp)
            return $true
        }
        catch {
            Start-Sleep -Milliseconds 180
        }
    }
    return $false
}

# 从无障碍树里找出"最可能是对话输入框"的控件，返回可以直接点击的位置（窗口宽高百分比）。
# 为什么不用固定百分比：目标软件右侧有时会弹出预览面板（把结果直接展示出来），
# 对话区随之被压窄，输入框中心明显左移，写死的 X 就点到面板上了。
# 无障碍树给的是控件的真实矩形，布局怎么变都跟着走，不需要重新取样。
function Get-InputCandidates {
    param(
        [IntPtr]$Hwnd,
        [int]$WinLeft = 0,
        [int]$WinTop = 0,
        [int]$WinW = 0,
        [int]$WinH = 0,
        [int]$MaxCount = 5
    )

    $res = @{ points = @(); count = 0; strictCount = 0; splitPercent = 100.0; best = $null }
    if ($Hwnd -eq [IntPtr]::Zero) { return $res }
    if ($WinW -lt 200 -or $WinH -lt 200) { return $res }

    $items = New-Object System.Collections.ArrayList
    $elements = New-Object System.Collections.ArrayList

    try {
        $root = [System.Windows.Automation.AutomationElement]::FromHandle($Hwnd)
        if ($null -eq $root) { return $res }

        foreach ($ct in @([System.Windows.Automation.ControlType]::Edit, [System.Windows.Automation.ControlType]::Document)) {
            $cond = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty, $ct)
            $found = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
            foreach ($el in $found) {
                try {
                    if (-not $el.Current.IsKeyboardFocusable) { continue }
                    if ($el.Current.IsOffscreen) { continue }
                    $r = $el.Current.BoundingRectangle
                    if ($r.IsEmpty) { continue }
                    $ew = [double]$r.Width
                    $eh = [double]$r.Height
                    if ($ew -lt 120 -or $eh -lt 16) { continue }
                    $relX = ([double]$r.X - $WinLeft) / $WinW
                    $relY = ([double]$r.Y - $WinTop) / $WinH
                    $relW = $ew / $WinW
                    $relH = $eh / $WinH
                    if ($relW -lt 0.10) { continue }
                    if ($relX -lt -0.05 -or $relY -lt -0.05) { continue }
                    if (($relY + $relH) -lt 0.15) { continue }
                    [void]$items.Add(@{ fx = $relX; fy = $relY; fw = $relW; fh = $relH })
                    [void]$elements.Add($el)
                }
                catch { }
            }
        }
    }
    catch {
        return $res
    }

    if ($items.Count -eq 0) { return $res }

    # 右侧面板的左边界：从右半区开始、高度占大半、还有点宽度的控件（通常是一整块 webview/document）
    $split = 1.0
    foreach ($it in $items) {
        if ($it.fx -ge 0.30 -and $it.fh -ge 0.45 -and $it.fw -ge 0.15) {
            if ($it.fx -lt $split) { $split = $it.fx }
        }
    }
    if ($split -lt 0.30 -or $split -gt 0.95) { $split = 1.0 }
    $res.splitPercent = [Math]::Round($split * 100.0, 1)

    $scored = New-Object System.Collections.ArrayList
    for ($i = 0; $i -lt $items.Count; $i++) {
        $it = $items[$i]
        # 整页文档（几乎和窗口一样高）不是输入框
        if ($it.fh -gt 0.55) { continue }
        # 右侧预览面板里的控件：从右半区开始，且要么贴着右边界、要么本身很窄
        $rightPane = ($it.fx -ge 0.45) -and ((($it.fx + $it.fw) -ge 0.92) -or ($it.fw -lt 0.40))
        if ($rightPane) { continue }
        # 打分：越靠下越好 + 越宽越好；宽扁的形状（输入框）加分
        $score = ($it.fy * 3.2) + ($it.fw * 2.2)
        if (($it.fw / [Math]::Max(0.01, $it.fh)) -ge 4.0) { $score += 0.5 }
        if ($it.fy -lt 0.30) { $score -= 1.2 }
        [void]$scored.Add(@{ index = $i; score = $score })
    }
    $res.strictCount = $scored.Count

    if ($scored.Count -eq 0) {
        # 严格条件一个都不满足：退一步，只排除右侧面板，其它按"靠下 + 宽"排
        for ($i = 0; $i -lt $items.Count; $i++) {
            $it = $items[$i]
            if ($it.fh -gt 0.92) { continue }
            if (($it.fx -ge 0.45) -and (($it.fx + $it.fw) -ge 0.92)) { continue }
            [void]$scored.Add(@{ index = $i; score = (($it.fy * 3.0) + ($it.fw * 2.0)) })
        }
    }
    if ($scored.Count -eq 0) { return $res }

    # 第一条最可信，留着给 UIA 直接 SetFocus 用
    $top = $scored[0]
    foreach ($s in $scored) {
        if ($s.score -gt $top.score) { $top = $s }
    }
    $res.best = $elements[$top.index]

    $sorted = @($scored | Sort-Object -Property @{ Expression = { $_.score }; Descending = $true })
    $picked = New-Object System.Collections.ArrayList
    foreach ($s in $sorted) {
        $it = $items[$s.index]
        # 点靠左一点（控件宽度的 30% 处），不打正中：文字从输入框左边缘开始排，
        # 点在左边才能让后面的"粘贴后画面变化"校验覆盖到文字本身
        $px = [Math]::Round(($it.fx + $it.fw * 0.30) * 100.0, 2)
        $py = [Math]::Round(($it.fy + $it.fh / 2.0) * 100.0, 2)
        if ($px -lt 3.0 -or $px -gt 97.0 -or $py -lt 3.0 -or $py -gt 97.0) { continue }
        $dup = $false
        foreach ($p in $picked) {
            if ([Math]::Abs($p.x - $px) -lt 2.0 -and [Math]::Abs($p.y - $py) -lt 2.0) { $dup = $true; break }
        }
        if ($dup) { continue }
        [void]$picked.Add(@{ x = $px; y = $py })
        if ($picked.Count -ge $MaxCount) { break }
    }

    $res.points = $picked
    $res.count = $picked.Count
    return $res
}

# 判断"点这个位置能不能把字粘进去"：粘贴一小段随机标记 -> 用哨兵覆盖剪贴板 ->
# 全选复制 -> 回读剪贴板，能读回标记才算真的落进了可编辑的输入框，最后清掉标记。
# 为什么不用"画面变化"：右侧预览面板点一下也会有大面积变化（面板自身响应），
# 很容易把"没粘进去"误判成"粘进去了"；而"能不能复制回自己刚粘的字"骗不了人。
function Test-InputByPaste {
    param([string]$Marker)

    if (-not $Marker) { $Marker = 'pbsprobe' }
    $sentinel = 'PBS_NO_HIT_' + (Get-Random -Minimum 100000 -Maximum 999999)

    if (-not (Set-ClipboardText -Text $Marker)) { return $false }
    Start-Sleep -Milliseconds 110
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 470

    # 粘贴后立刻用哨兵覆盖剪贴板：目标不可编辑时 Ctrl+C 复制不到东西，
    # 剪贴板里仍是哨兵，于是"没粘上"不会被误判成"粘上了"
    [void](Set-ClipboardText -Text $sentinel)
    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    Start-Sleep -Milliseconds 130
    [System.Windows.Forms.SendKeys]::SendWait('^c')
    Start-Sleep -Milliseconds 240

    $txt = Get-ClipboardText
    # 清掉标记，把输入框还原成干净的
    [System.Windows.Forms.SendKeys]::SendWait('{DEL}')
    Start-Sleep -Milliseconds 160

    if (-not $txt) { return $false }
    if ($txt.IndexOf($sentinel, [System.StringComparison]::Ordinal) -ge 0) { return $false }
    return ($txt.IndexOf($Marker, [System.StringComparison]::Ordinal) -ge 0)
}

# 从窗口截图里找出"右侧面板"的左边界（窗口宽度百分比，100 表示没分栏）。
# 原理：算每列平均亮度，找相邻列亮度突变最大的那条竖线。
# 右侧实时预览面板的动画会让"静止检测"永远判不到静止，必须把这块裁掉；
# 点击输入框时也要靠它避免点到右边面板上。
function Get-VerticalSplit {
    param(
        $Frame,
        [double]$MinPercent = 22.0,
        [double]$MaxPercent = 96.0,
        [double]$MinDelta = 55.0
    )

    if ($null -eq $Frame) { return 100.0 }
    $w = [int]$Frame.w
    $h = [int]$Frame.h
    if ($w -lt 240 -or $h -lt 240) { return 100.0 }

    $bytes = $Frame.bytes
    $stride = [int]$Frame.stride
    $y0 = [int]($h * 0.28)
    $y1 = [int]($h * 0.72)
    if ($y1 -le $y0) { return 100.0 }

    $x0 = [Math]::Max(2, [int]($w * $MinPercent / 100.0))
    $x1 = [Math]::Min(($w - 2), [int]($w * $MaxPercent / 100.0))
    if ($x1 -le $x0) { return 100.0 }

    $means = New-Object double[] ($x1 + 2)
    for ($x = $x0 - 1; $x -le $x1; $x++) {
        $sum = 0.0
        $n = 0
        for ($y = $y0; $y -lt $y1; $y += 8) {
            $i = $y * $stride + $x * 4
            $sum += ($bytes[$i] * 0.11 + $bytes[$i + 1] * 0.59 + $bytes[$i + 2] * 0.30)
            $n++
        }
        $means[$x] = $sum / [Math]::Max(1, $n)
    }

    $bestX = -1
    $bestD = 0.0
    for ($x = $x0; $x -le $x1; $x++) {
        $d = [Math]::Abs($means[$x] - $means[$x - 1])
        if ($d -gt $bestD) {
            $bestD = $d
            $bestX = $x
        }
    }

    if ($bestX -lt 0 -or $bestD -lt $MinDelta) { return 100.0 }

    # 再确认这条边是"贯穿的竖线"：沿整列大部分高度，左右都有明显色差。
    # 这样可以避免把对话里一张图片/代码块的边缘误当成面板边界。
    $hit = 0
    $tot = 0
    $ya = [int]($h * 0.18)
    $yb = [int]($h * 0.82)
    for ($y = $ya; $y -lt $yb; $y += 6) {
        $i1 = $y * $stride + ($bestX - 2) * 4
        $i2 = $y * $stride + ($bestX + 2) * 4
        $l1 = $bytes[$i1] * 0.11 + $bytes[$i1 + 1] * 0.59 + $bytes[$i1 + 2] * 0.30
        $l2 = $bytes[$i2] * 0.11 + $bytes[$i2 + 1] * 0.59 + $bytes[$i2 + 2] * 0.30
        $tot++
        if ([Math]::Abs($l1 - $l2) -ge 22) { $hit++ }
    }
    if ($tot -gt 0 -and ($hit / $tot) -lt 0.8) { return 100.0 }

    return [Math]::Round($bestX * 100.0 / $w, 1)
}

# 判断屏幕坐标上是什么控件。点在按钮 / 图标 / 链接上时不要往里粘文字。
# known=$false 表示取不到（这种情况一律按"可以试"处理，避免误判卡死流程）。
function Get-PointControlKind {
    param([int]$X, [int]$Y)
    $res = @{ known = $false; editable = $true; controlType = ''; name = '' }
    try {
        $pt = New-Object System.Windows.Point($X, $Y)
        $el = [System.Windows.Automation.AutomationElement]::FromPoint($pt)
        if ($null -eq $el) { return $res }
        $ct = [string]$el.Current.ControlType.ProgrammaticName
        $ct = $ct.Replace('ControlType.', '')
        $res.known = $true
        $res.controlType = $ct
        $res.name = [string]$el.Current.Name
        foreach ($b in @('Button', 'Hyperlink', 'Image', 'ListItem', 'MenuItem', 'CheckBox',
                         'RadioButton', 'TabItem', 'Slider', 'ScrollBar', 'MenuBar', 'ToolBar')) {
            if ($ct -eq $b) { $res.editable = $false; break }
        }
        return $res
    }
    catch {
        return $res
    }
}

# 取当前键盘焦点所在元素的进程 ID（0 表示取不到）
# 这是"绝不能把字打到别的窗口"的最后一道保险
function Get-FocusProcessId {
    try {
        $el = [System.Windows.Automation.AutomationElement]::FocusedElement
        if ($null -eq $el) { return 0 }
        return [int]$el.Current.ProcessId
    }
    catch {
        return 0
    }
}

function Capture-Region {
    param([int]$X, [int]$Y, [int]$W, [int]$H)
    if ($W -lt 8 -or $H -lt 8) { return $null }
    $bmp = $null
    try {
        $bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($X, $Y, 0, 0, (New-Object System.Drawing.Size($W, $H)))
        $g.Dispose()

        $rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
        $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $stride = $data.Stride
        $bytes = New-Object byte[] ($stride * $H)
        [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
        $bmp.UnlockBits($data)
        return @{ bytes = $bytes; stride = $stride; w = $W; h = $H }
    }
    catch {
        return $null
    }
    finally {
        if ($bmp) { $bmp.Dispose() }
    }
}

# 用 PrintWindow 直接让窗口把自己渲染到内存位图，窗口被别的程序挡住也能拿到内容。
# 返回 $null 表示这种方式拿不到有效画面（纯黑/纯白），调用方应回退到屏幕复制。
function Capture-WindowFrame {
    param([IntPtr]$Hwnd)

    $w = 0
    $h = 0
    $x = 0
    $y = 0
    try {
        [AutoWin]::GetFrame($Hwnd, [ref]$x, [ref]$y, [ref]$w, [ref]$h)
    }
    catch { return $null }
    if ($w -lt 40 -or $h -lt 40) { return $null }

    $bmp = $null
    try {
        $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $hdc = $g.GetHdc()
        $ok = [AutoWin]::PrintWindow($Hwnd, $hdc, 2)
        $g.ReleaseHdc($hdc)
        $g.Dispose()

        if (-not $ok) { return $null }

        $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
        $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $stride = $data.Stride
        $bytes = New-Object byte[] ($stride * $h)
        [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
        $bmp.UnlockBits($data)

        # 采样检查：整张图几乎是同一个颜色说明没抓到真实内容
        $sx = [Math]::Max(1, [int]($w / 32))
        $sy = [Math]::Max(1, [int]($h / 32))
        $min = 255
        $max = 0
        for ($yy = 0; $yy -lt $h; $yy += $sy) {
            $row = $yy * $stride
            for ($xx = 0; $xx -lt $w; $xx += $sx) {
                $i = $row + ($xx * 4)
                $v = ([int]$bytes[$i] + [int]$bytes[$i + 1] + [int]$bytes[$i + 2]) / 3
                if ($v -lt $min) { $min = $v }
                if ($v -gt $max) { $max = $v }
            }
        }
        if (($max - $min) -lt 8) { return $null }

        return @{ bytes = $bytes; stride = $stride; w = $w; h = $h }
    }
    catch {
        return $null
    }
    finally {
        if ($bmp) { $bmp.Dispose() }
    }
}

# 裁剪帧的左侧子区域：空闲检测时忽略右侧实时预览面板（动画永远不停会导致永远判不到静止）。
# Format32bppArgb 每像素 4 字节，逐行拷贝 CropW*4 字节到新数组，stride 重新算。
function Crop-Frame {
    param($Frame, [int]$CropW, [int]$CropH = 0)
    if ($null -eq $Frame) { return $null }
    $cw = $Frame.w
    if ($CropW -gt 0 -and $CropW -lt $Frame.w) { $cw = [Math]::Max(8, $CropW) }
    $ch = $Frame.h
    if ($CropH -gt 0 -and $CropH -lt $Frame.h) { $ch = [Math]::Max(8, $CropH) }
    if ($cw -eq $Frame.w -and $ch -eq $Frame.h) { return $Frame }
    $srcStride = $Frame.stride
    $dstStride = $cw * 4
    $dst = New-Object byte[] ($dstStride * $ch)
    for ($ry = 0; $ry -lt $ch; $ry++) {
        [System.Array]::Copy($Frame.bytes, ($ry * $srcStride), $dst, ($ry * $dstStride), $dstStride)
    }
    return @{ bytes = $dst; stride = $dstStride; w = $cw; h = $ch }
}

# 分块比较：把画面切成 GridX × GridY 格，任意一格内部变化超过 BlockThreshold 就算"还在动"。
# 这样像"生成进度 15% → 16%"这种局部小变化也能检测到，而全图占比法会漏掉。
function Compare-Region-Blocks {
    param(
        $A,
        $B,
        [int]$GridX = 6,
        [int]$GridY = 4,
        [int]$Step = 11,
        [int]$PixelThreshold = 26,
        [double]$BlockThreshold = 0.25
    )

    if ($null -eq $A -or $null -eq $B) { return @{ maxBlock = 1.0; global = 1.0; active = $true } }
    if ($A.w -ne $B.w -or $A.h -ne $B.h) { return @{ maxBlock = 1.0; global = 1.0; active = $true } }

    $w = $A.w
    $h = $A.h
    $bw = [Math]::Max(1, [int]($w / $GridX))
    $bh = [Math]::Max(1, [int]($h / $GridY))
    $pxTh = $PixelThreshold * 3

    $maxRatio = 0.0
    $totalDiff = 0
    $totalSamples = 0
    $blockHits = 0

    for ($gy = 0; $gy -lt $GridY; $gy++) {
        $y0 = $gy * $bh
        $y1 = [Math]::Min($h, $y0 + $bh)
        for ($gx = 0; $gx -lt $GridX; $gx++) {
            $x0 = $gx * $bw
            $x1 = [Math]::Min($w, $x0 + $bw)

            $diff = 0
            $cnt = 0
            for ($y = $y0; $y -lt $y1; $y += $Step) {
                $ra = $y * $A.stride
                $rb = $y * $B.stride
                for ($x = $x0; $x -lt $x1; $x += $Step) {
                    $ia = $ra + ($x * 4)
                    $ib = $rb + ($x * 4)
                    $d = [Math]::Abs([int]$A.bytes[$ia] - [int]$B.bytes[$ib]) +
                         [Math]::Abs([int]$A.bytes[$ia + 1] - [int]$B.bytes[$ib + 1]) +
                         [Math]::Abs([int]$A.bytes[$ia + 2] - [int]$B.bytes[$ib + 2])
                    if ($d -gt $pxTh) { $diff++ }
                    $cnt++
                }
            }

            $totalDiff += $diff
            $totalSamples += $cnt
            if ($diff -gt 0) { $blockHits++ }
            if ($cnt -gt 0) {
                $r = [double]$diff / [double]$cnt
                if ($r -gt $maxRatio) { $maxRatio = $r }
            }
        }
    }

    $global = 0.0
    if ($totalSamples -gt 0) { $global = [double]$totalDiff / [double]$totalSamples }

    return @{
        maxBlock     = $maxRatio
        global       = $global
        changedCount = $totalDiff
        blockHits    = $blockHits
        active       = ($maxRatio -ge $BlockThreshold)
    }
}

function Compare-Region {
    param($A, $B, [int]$Step, [int]$PixelThreshold)
    if ($null -eq $A -or $null -eq $B) { return 1.0 }
    if ($A.w -ne $B.w -or $A.h -ne $B.h) { return 1.0 }
    if ($Step -lt 1) { $Step = 1 }

    $ab = $A.bytes
    $bb = $B.bytes
    $stride = $A.stride
    $total = 0
    $changed = 0

    for ($yy = 0; $yy -lt $A.h; $yy += $Step) {
        $row = $yy * $stride
        for ($xx = 0; $xx -lt $A.w; $xx += $Step) {
            $i = $row + ($xx * 4)
            $total++
            $d = [Math]::Abs([int]$ab[$i] - [int]$bb[$i]) +
                 [Math]::Abs([int]$ab[$i + 1] - [int]$bb[$i + 1]) +
                 [Math]::Abs([int]$ab[$i + 2] - [int]$bb[$i + 2])
            if ($d -gt $PixelThreshold) { $changed++ }
        }
    }
    if ($total -eq 0) { return 1.0 }
    return ([double]$changed / [double]$total)
}
