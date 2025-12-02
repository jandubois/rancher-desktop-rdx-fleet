@echo off
setlocal enabledelayedexpansion

REM Extract GitHub token from gh CLI
REM Returns the token on stdout, or exits with error if not available

where gh >nul 2>&1
if errorlevel 1 (
    echo gh CLI not installed >&2
    exit /b 1
)

for /f "tokens=*" %%i in ('gh auth token 2^>nul') do set "TOKEN=%%i"

if "!TOKEN!"=="" (
    echo Not authenticated with gh CLI >&2
    exit /b 1
)

echo !TOKEN!
