@echo off
REM Helper script to apply JSON manifest via kubectl
REM Usage: kubectl-apply-json.cmd <json-string> [kubectl-args...]
setlocal enabledelayedexpansion
set JSON=%~1
shift
echo !JSON! | "%USERPROFILE%\.rd\bin\kubectl.exe" apply -f - %1 %2 %3 %4 %5 %6 %7 %8 %9
