@echo off
title Dimple
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to wake Dimple.
  echo Install it from https://nodejs.org and double-click this again.
  pause
  exit /b 1
)

echo.
echo   DIMPLE
echo   your buddy in the field
echo.
node "%~dp0scripts\launch.mjs"
if errorlevel 1 pause
