@echo off
REM Run Kit application with streaming enabled for local web development
REM
REM Usage:
REM   run_streaming.bat
REM   run_streaming.bat --/app/auto_load_usd=/path/to/scene.usd
REM
REM Environment variables:
REM   USD_URL - Path to USD file to load (optional, has default)

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
REM Remove trailing backslash
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

cd /d "%SCRIPT_DIR%"

REM Build if not already built
if not exist "_build" (
    echo Building Kit application first...

    REM 1. Initialize the kit-cae submodule
    echo Initializing kit-cae submodule...
    git submodule update --init --recursive
    if errorlevel 1 ( echo Submodule init failed! & exit /b 1 )

    REM 2. Build kit-cae schemas
    echo Building kit-cae schemas...
    call deps\kit-cae\repo.bat schema
    if errorlevel 1 ( echo CAE schema build failed! & exit /b 1 )

    REM 3. Build kit-cae extensions
    echo Building kit-cae extensions...
    call deps\kit-cae\repo.bat build
    if errorlevel 1 ( echo CAE build failed! & exit /b 1 )

    REM 4. Precache extensions (must run after kit-cae is built)
    echo Precaching extensions...
    call repo.bat build -u
    if errorlevel 1 ( echo Precache failed! & exit /b 1 )

    REM 5. Build the DSX application
    echo Building DSX application...
    call repo.bat build -r
    if errorlevel 1 ( echo Build failed! & exit /b 1 )
)

REM Run the streaming version with no window
call repo.bat launch dsx_streaming.kit -- --no-window %*
