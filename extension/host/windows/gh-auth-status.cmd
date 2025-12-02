@echo off
setlocal enabledelayedexpansion

REM Check if gh CLI is installed and authenticated
REM Outputs JSON with status information

where gh >nul 2>&1
if errorlevel 1 (
    echo {"installed":false,"authenticated":false}
    exit /b 0
)

gh auth status >nul 2>&1
if errorlevel 1 (
    echo {"installed":true,"authenticated":false}
    exit /b 0
)

REM Get the authenticated user
for /f "tokens=*" %%i in ('gh api user --jq ".login" 2^>nul') do set "USER=%%i"

echo {"installed":true,"authenticated":true,"user":"!USER!"}
