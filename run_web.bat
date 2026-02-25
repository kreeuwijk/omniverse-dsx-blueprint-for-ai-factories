@echo off
REM Run the web frontend for local development
REM
REM Usage:
REM   run_web.bat

setlocal

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"

cd /d "%SCRIPT_DIR%web"

echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo npm install failed!
    exit /b 1
)

echo.
echo Starting web development server...
call npm run dev
