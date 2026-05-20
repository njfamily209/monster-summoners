@echo off
title Auto-Push Watcher - Game Design
cd /d "E:\Projects\Game Design"

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Install from https://nodejs.org then re-run.
    pause
    exit /b 1
)

if not exist .git (
    echo [ERROR] No .git folder. Run setup-github.bat first.
    pause
    exit /b 1
)

echo ============================================
echo   Auto-Push Watcher
echo ============================================
echo.
echo This window will auto-commit and push changes to GitHub
echo about 15 seconds after files in this folder change.
echo.
echo Keep this window open while you want auto-push active.
echo Press Ctrl+C to stop.
echo.

node auto-push.js
echo.
echo Watcher exited.
pause
