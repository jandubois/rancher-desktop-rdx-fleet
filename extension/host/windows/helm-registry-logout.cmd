@echo off
setlocal enabledelayedexpansion

REM Log out from a Helm OCI registry
REM Usage: helm-registry-logout <registry>

if "%~1"=="" (
    echo {"error":"Usage: helm-registry-logout <registry>"} >&2
    exit /b 1
)

set "REGISTRY=%~1"

REM Add Rancher Desktop bin to PATH
set "PATH=%USERPROFILE%\.rd\bin;%PATH%"

REM Check if helm is available
where helm >nul 2>&1
if errorlevel 1 (
    echo {"error":"helm command not found","debug":"PATH=%PATH%"}
    exit /b 1
)

REM Run helm registry logout
helm registry logout "%REGISTRY%" >nul 2>&1

REM Logout may fail if not logged in, which is fine
echo {"success":true}
