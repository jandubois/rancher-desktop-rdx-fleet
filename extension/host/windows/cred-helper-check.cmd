@echo off
setlocal enabledelayedexpansion

REM Check if a Docker credential helper is available
REM Outputs JSON with helper information

REM Windows typically uses wincred which is bundled with Docker/Rancher Desktop
where docker-credential-wincred >nul 2>&1
if not errorlevel 1 (
    echo {"available":true,"helper":"wincred","configured":true}
    exit /b 0
)

REM Check for other helpers
where docker-credential-desktop >nul 2>&1
if not errorlevel 1 (
    echo {"available":true,"helper":"desktop","configured":true}
    exit /b 0
)

echo {"available":false,"helper":"","configured":false}
