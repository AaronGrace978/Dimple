@echo off
title Dimple
cd /d "%~dp0"

if exist "%~dp0release\Dimple.exe" (
  start "" "%~dp0release\Dimple.exe"
  exit /b 0
)

if exist "%~dp0release\win-unpacked\Dimple.exe" (
  start "" "%~dp0release\win-unpacked\Dimple.exe"
  exit /b 0
)

where node >nul 2>&1
if errorlevel 1 (
  echo No packaged Dimple.exe here, and Node.js is not installed.
  echo.
  echo Download Dimple-0.1.0-windows-portable.exe from:
  echo https://github.com/AaronGrace978/RayMarchPrime/releases/tag/v0.1.0
  echo.
  pause
  exit /b 1
)

echo Building the desktop window…
if not exist "%~dp0node_modules\" call npm install
call npm run desktop
if errorlevel 1 pause
