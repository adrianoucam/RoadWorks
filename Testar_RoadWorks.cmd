@echo off
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
 ".venv\Scripts\python.exe" tools\test_execution.py %*
) else if exist "roadworks_swept_path\.venv\Scripts\python.exe" (
 "roadworks_swept_path\.venv\Scripts\python.exe" tools\test_execution.py %*
) else (
 python tools\test_execution.py %*
)
set "qa_result=%errorlevel%"
echo.
echo Testes encerrados. Codigo de saida: %qa_result%
pause
exit /b %qa_result%
