"""生成启动.bat（强制 CRLF，cmd 才能正确解析）。"""
BAT = r"""@echo off
setlocal
cd /d "%~dp0"

set "PY=D:\miniconda\python.exe"
if exist "%~dp0.venv\Scripts\python.exe" set "PY=%~dp0.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

echo ==========================================
echo   Auto Video-Image-Text Studio
echo   Python: %PY%
echo ==========================================

:: health check: port open does not mean the service is alive
"%PY%" -c "import urllib.request,sys;op=urllib.request.build_opener(urllib.request.ProxyHandler({}));r=op.open('http://127.0.0.1:8849/api/state',timeout=4);sys.exit(0 if b'settings' in r.read(300) else 1)" >nul 2>&1
if not errorlevel 1 goto open

echo Starting service in background ...
start "zidongtuwen-server" /min "%PY%" app.py
ping -n 7 127.0.0.1 >nul

"%PY%" -c "import urllib.request,sys;op=urllib.request.build_opener(urllib.request.ProxyHandler({}));r=op.open('http://127.0.0.1:8849/api/state',timeout=4);sys.exit(0 if b'settings' in r.read(300) else 1)" >nul 2>&1
if not errorlevel 1 goto open

echo.
echo [WARN] Service did not answer on http://127.0.0.1:8849
echo        Check _server.log in this folder.
echo.
pause
exit /b 1

:open
echo Opening http://127.0.0.1:8849
echo Close this window anytime, the service keeps running.
start "" "http://127.0.0.1:8849"
ping -n 3 127.0.0.1 >nul
exit /b 0
"""

with open("启动.bat", "w", encoding="utf-8", newline="\r\n") as fp:
    fp.write(BAT)

with open("启动.bat", "rb") as fp:
    data = fp.read()
print("bytes", len(data), "CRLF", data.count(b"\r\n"), "LF-only", data.count(b"\n") - data.count(b"\r\n"))
