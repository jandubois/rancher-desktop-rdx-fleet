@echo off
setlocal enabledelayedexpansion

REM Get a credential from the Docker credential helper
REM Usage: cred-get <server>
REM Outputs JSON: {"Username":"...","Secret":"..."} or {} if not found

if "%~1"=="" (
    echo Usage: cred-get ^<server^> >&2
    exit /b 1
)

set "SERVER=%~1"

REM Find available credential helper
set "HELPER="

where docker-credential-wincred >nul 2>&1
if not errorlevel 1 (
    set "HELPER=docker-credential-wincred"
    goto :get
)

where docker-credential-desktop >nul 2>&1
if not errorlevel 1 (
    set "HELPER=docker-credential-desktop"
    goto :get
)

echo {}
exit /b 0

:get
REM Get the credential using the helper
for /f "tokens=*" %%i in ('echo %SERVER% ^| %HELPER% get 2^>nul') do (
    echo %%i
    exit /b 0
)

echo {}
