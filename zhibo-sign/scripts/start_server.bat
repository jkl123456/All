@echo off
setlocal EnableExtensions
chcp 437 >nul 2>&1
rem ============================================================
rem  Start the zhibo-sign server (http://127.0.0.1:8850/).
rem  Double-click this file and leave the window open while
rem  streaming. Ctrl+C or closing the window stops the server.
rem
rem  Any extra argument is passed straight to run.py, e.g.
rem      start_server.bat --provider local
rem      start_server.bat --source external
rem
rem  KEEP THIS FILE CRLF + PURE ASCII, same reason as
rem  overlay_window.bat: cmd mis-parses LF-only / CJK .bat.
rem ============================================================

cd /d "%~dp0.."
title zhibo-sign server  :8850

set "PY=D:\miniconda\python.exe"
if not exist "%PY%" set "PY=python"

echo ============================================
echo  zhibo-sign server
echo  live   : http://127.0.0.1:8850/
echo  admin  : http://127.0.0.1:8850/admin/
echo  python : %PY%
echo ============================================
echo.

"%PY%" run.py %*

echo.
echo [zhibo-sign] server exited.
pause >nul
