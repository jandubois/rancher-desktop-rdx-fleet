@echo off
setlocal enabledelayedexpansion

REM Delete a credential from the Docker credential helper
REM Usage: cred-delete <server>

if "%~1"=="" (
    echo Usage: cred-delete ^<server^> >&2
    exit /b 1
)

set "SERVER=%~1"

REM Find available credential helper
set "HELPER="

where docker-credential-wincred >nul 2>&1
if not errorlevel 1 (
    set "HELPER=docker-credential-wincred"
    goto :delete
)

where docker-credential-desktop >nul 2>&1
if not errorlevel 1 (
    set "HELPER=docker-credential-desktop"
    goto :delete
)

echo No credential helper available >&2
exit /b 1

:delete
REM Delete the credential using the helper
echo %SERVER% | %HELPER% erase 2>nul

echo Credential deleted
