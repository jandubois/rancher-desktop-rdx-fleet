@echo off
REM Debug script to dump host environment information
REM This script outputs structured information about the host environment
REM as seen by a Rancher Desktop extension host binary

echo === HOST BINARY ENVIRONMENT DEBUG ===
echo.
echo --- Basic Info ---
echo Hostname: %COMPUTERNAME%
echo Username: %USERNAME%
echo Home: %USERPROFILE%
echo PWD: %CD%
echo.
echo --- System Info ---
echo OS: %OS%
echo Processor Architecture: %PROCESSOR_ARCHITECTURE%
echo.
echo --- PATH ---
echo %PATH:;=&echo.%
echo.
echo --- RD Bin Directory ---
if exist "%USERPROFILE%\.rd\bin" (
  dir "%USERPROFILE%\.rd\bin"
) else (
  echo %USERPROFILE%\.rd\bin does not exist
)
echo.
echo --- All Environment Variables ---
set
echo.
echo --- Script Arguments ---
echo Args: %*
echo.
echo === END DEBUG OUTPUT ===
