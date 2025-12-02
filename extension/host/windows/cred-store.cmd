@echo off
setlocal enabledelayedexpansion

REM Store a credential using the Docker credential helper
REM Usage: cred-store <server> <username> <secret>

if "%~3"=="" (
    echo Usage: cred-store ^<server^> ^<username^> ^<secret^> >&2
    exit /b 1
)

set "SERVER=%~1"
set "USERNAME=%~2"
set "SECRET=%~3"

REM Find available credential helper
set "HELPER="

where docker-credential-wincred >nul 2>&1
if not errorlevel 1 (
    set "HELPER=docker-credential-wincred"
    goto :store
)

where docker-credential-desktop >nul 2>&1
if not errorlevel 1 (
    set "HELPER=docker-credential-desktop"
    goto :store
)

echo No credential helper available >&2
exit /b 1

:store
REM Store the credential using the helper
echo {"ServerURL":"%SERVER%","Username":"%USERNAME%","Secret":"%SECRET%"} | %HELPER% store

if errorlevel 1 (
    echo Failed to store credential >&2
    exit /b 1
)

echo Credential stored successfully
