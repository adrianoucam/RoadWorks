@echo off
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python3.exe" (
  ".venv\Scripts\python3.exe" tools\launch.py
) else if exist "roadworks_swept_path\.venv\Scripts\python.exe" (
  "roadworks_swept_path\.venv\Scripts\python3.exe" tools\launch.py
) else (
  python tools\launch.py
)
if errorlevel 1 pause
