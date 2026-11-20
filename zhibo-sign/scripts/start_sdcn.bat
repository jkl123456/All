@echo off
REM One-click launcher for the local SD signing service (http://127.0.0.1:7863).
REM ASCII only on purpose: cmd.exe garbles non-ASCII .bat files.
REM
REM Cold start reads ~4GB of weights from disk, so it takes 1-3 minutes.
REM Leave this window open while streaming. Ctrl+C or closing the window stops it.
REM If it says the port is already in use, a service is ALREADY running - just use it.

cd /d "%~dp0.."
title sdcn signing service  :7863

echo ============================================
echo  sdcn local model service
echo  health: http://127.0.0.1:7863/health
echo ============================================
echo.

"H:\envs\sdcn\Scripts\python.exe" scripts\sdcn_server.py

echo.
echo [sdcn] process exited.
pause >nul
