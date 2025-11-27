@echo off
setlocal enabledelayedexpansion
if "%~1"=="--apply-json" (
  set JSON=%~2
  echo !JSON! | "%USERPROFILE%\.rd\bin\kubectl.exe" apply -f - %3 %4 %5 %6 %7 %8 %9
) else (
  "%USERPROFILE%\.rd\bin\kubectl.exe" %*
)
