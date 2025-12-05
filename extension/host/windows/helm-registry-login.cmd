@echo off
setlocal enabledelayedexpansion

REM Log in to a Helm OCI registry
REM Usage: helm-registry-login <registry> <username> <password>

if "%~3"=="" (
    echo {"error":"Usage: helm-registry-login <registry> <username> <password>"} >&2
    exit /b 1
)

set "REGISTRY=%~1"
set "USERNAME=%~2"
set "PASSWORD=%~3"

REM Add Rancher Desktop bin to PATH
set "PATH=%USERPROFILE%\.rd\bin;%PATH%"

REM Check if helm is available
where helm >nul 2>&1
if errorlevel 1 (
    echo {"error":"helm command not found","debug":"PATH=%PATH%"}
    exit /b 1
)

REM Run helm registry login with password via stdin
echo %PASSWORD% | helm registry login "%REGISTRY%" --username "%USERNAME%" --password-stdin >nul 2>&1

if errorlevel 1 (
    echo {"error":"helm registry login failed"}
    exit /b 1
)

echo {"success":true}
