@echo off
setlocal enabledelayedexpansion

rem Build submodule dependencies (kit-cae, kit-usd-agents) if not already built.
rem Called by repo.toml before_pull_commands during `repo.bat build`.
rem Usage: build_submodules.bat <repo-root>

set "ROOT=%~1"
if "%ROOT%"=="" (
    echo [DSX] ERROR: build_submodules.bat requires repo root as first argument
    exit /b 1
)

rem Ensure source/apps exists (required by repo_build)
if not exist "%ROOT%\source\apps" mkdir "%ROOT%\source\apps"

rem ---- kit-cae ----
if exist "%ROOT%\deps\kit-cae" (
    if not exist "%ROOT%\deps\kit-cae\_build" (
        echo [DSX] Building kit-cae submodule ^(schema + extensions^)...
        pushd "%ROOT%\deps\kit-cae"

        rem Detect VS2022 for schema and build flags
        set "SCHEMA_CMD=schema"
        set "BUILD_CMD=build -r"
        if exist "C:\Program Files\Microsoft Visual Studio\2022" (
            set "SCHEMA_CMD=schema --vs2022"
            set "BUILD_CMD=--set-token vs_version:vs2022 build -r"
        )

        call repo.bat !SCHEMA_CMD!
        if errorlevel 1 (
            echo [DSX] ERROR: kit-cae schema step failed
            popd
            exit /b 1
        )

        call repo.bat !BUILD_CMD!
        if errorlevel 1 (
            echo [DSX] ERROR: kit-cae build failed
            popd
            exit /b 1
        )

        popd
        echo [DSX] kit-cae build complete.
    ) else (
        echo [DSX] kit-cae already built, skipping. Delete deps\kit-cae\_build to force rebuild.
    )
)

rem ---- kit-usd-agents ----
if exist "%ROOT%\deps\kit-usd-agents" (
    if not exist "%ROOT%\deps\kit-usd-agents\_build\target-deps\pip_core_prebundle" (
        echo [DSX] Building kit-usd-agents submodule...
        pushd "%ROOT%\deps\kit-usd-agents"

        call repo.bat build -r
        if errorlevel 1 (
            echo [DSX] ERROR: kit-usd-agents build failed
            popd
            exit /b 1
        )

        popd
        echo [DSX] kit-usd-agents build complete.
    ) else (
        echo [DSX] kit-usd-agents already built, skipping. Delete deps\kit-usd-agents\_build to force rebuild.
    )
)

rem ---- nvidia-nat-core + deps (needed by DSX agent, not included in kit-usd-agents prebundle) ----
set "NAT_PREBUNDLE=%ROOT%\deps\kit-usd-agents\_build\target-deps\pip_nat_prebundle"
set "KIT_PYTHON=%ROOT%\deps\kit-usd-agents\_build\target-deps\python\python.exe"
if exist "%NAT_PREBUNDLE%" (
    if not exist "%NAT_PREBUNDLE%\nat\builder" (
        echo [DSX] Installing NAT packages into pip_nat_prebundle...
        "%KIT_PYTHON%" -m pip install --no-deps --upgrade --target "%NAT_PREBUNDLE%" nvidia-nat-core==1.6.0b1 PyJWT
        if errorlevel 1 (
            echo [DSX] WARNING: nvidia-nat-core install failed, agent features may not work
        ) else (
            echo [DSX] nvidia-nat-core installed.
        )
        rem nvidia-nat-langchain shares the nat/ namespace — install to temp then copy plugin files
        set "TMP_LC=%TEMP%\nat_langchain_tmp"
        if exist "!TMP_LC!" rmdir /s /q "!TMP_LC!"
        "%KIT_PYTHON%" -m pip install --no-deps --target "!TMP_LC!" nvidia-nat-langchain==1.4.1
        if exist "!TMP_LC!\nat\plugins\langchain" (
            xcopy /s /e /y /q "!TMP_LC!\nat\plugins\langchain\*" "%NAT_PREBUNDLE%\nat\plugins\langchain\"
            echo [DSX] nvidia-nat-langchain plugin copied.
        )
        if exist "!TMP_LC!" rmdir /s /q "!TMP_LC!"
        rem Add backward-compat aliases for lc_agent_nat (AIQ* names were renamed in NAT 1.6)
        echo. >> "%NAT_PREBUNDLE%\nat\data_models\config.py"
        echo AIQConfig = Config >> "%NAT_PREBUNDLE%\nat\data_models\config.py"
        echo. >> "%NAT_PREBUNDLE%\nat\data_models\api_server.py"
        echo AIQChatRequest = ChatRequest >> "%NAT_PREBUNDLE%\nat\data_models\api_server.py"
        echo AIQChatResponseChunk = ChatResponseChunk >> "%NAT_PREBUNDLE%\nat\data_models\api_server.py"
        echo AIQChoice = ChatResponseChoice >> "%NAT_PREBUNDLE%\nat\data_models\api_server.py"
        echo AIQChoiceMessage = ChoiceMessage >> "%NAT_PREBUNDLE%\nat\data_models\api_server.py"
        echo [DSX] Added AIQ compat aliases.
    )
)

echo [DSX] Submodule builds done.
