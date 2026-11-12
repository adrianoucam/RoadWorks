@echo off
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" tools\launch.py
) else (
  python tools\launch.py
)
if errorlevel 1 pause
