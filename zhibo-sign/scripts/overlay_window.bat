@echo off
setlocal EnableExtensions
chcp 437 >nul 2>&1
rem ============================================================
rem  Open the overlay page as a borderless 1080x1920 window.
rem  In Douyin Live Studio: add material -> Window Capture
rem  -> pick the window, then crop/scale it into the scene.
rem
rem  Usage: overlay_window.bat [port] [force]
rem         port  : backend port, default 8850
rem         force : always open a new window, even if one exists
rem
rem  If an overlay window is already open it is just raised to
rem  the front instead of stacking a duplicate on top of it.
rem
rem  KEEP THIS FILE CRLF + PURE ASCII. LF-only line endings or
rem  CJK text make cmd mis-parse the long start line, and the
rem  console closes instantly without any browser window.
rem ============================================================

set "PORT=%~1"
if not defined PORT set "PORT=8850"
set "FORCE=%~2"
set "URL=http://127.0.0.1:%PORT%/"
set "LOG=%TEMP%\zhibo-sign-overlay.log"

rem ---- locate chrome -----------------------------------------
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" goto :nochrome

rem ---- reuse the window that is already open -----------------
if /i "%FORCE%"=="force" goto :launch
if not exist "%~dp0overlay_focus.ps1" goto :launch
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0overlay_focus.ps1" %PORT% >nul 2>&1
if errorlevel 1 goto :launch
echo.
echo  [OK] Overlay window is already open - brought it to the front.
echo       Nothing else to do. Close that window first if you
echo       really want a brand new one, then run this file again.
echo       (or run:  overlay_window.bat %PORT% force )
echo.
ping -n 4 127.0.0.1 >nul 2>&1
exit /b 0

:launch
rem ---- warn when the backend is not up -----------------------
where curl >nul 2>&1
if errorlevel 1 goto :spawn
curl -s --max-time 2 -o nul "%URL%" >nul 2>&1
if not errorlevel 1 goto :spawn
echo [WARN] %URL% is not answering.
echo        Start the backend first:  python run.py
echo        Launching anyway, the window may stay blank.

:spawn
set "PROFILE=%TEMP%\zhibo-sign-overlay"
>>"%LOG%" echo [%time%] start %CHROME% --app=%URL%

start "zhibo-sign overlay" "%CHROME%" --app=%URL% --window-size=1080,1920 --window-position=0,0 --hide-scrollbars --autoplay-policy=no-user-gesture-required --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --disable-features=CalculateNativeWinOcclusion --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling

if errorlevel 1 goto :failed
rem give the window a moment to appear, then get out of the way
ping -n 3 127.0.0.1 >nul 2>&1
exit /b 0

:nochrome
echo [ERROR] Chrome not found.
echo         Install Chrome, or hardcode its path into this file.
echo.
pause
exit /b 1

:failed
echo [ERROR] Chrome could not be started.
echo         Log: %LOG%
echo.
pause
exit /b 1
