@echo off
title Game Design - Push Changes

cd /d "E:\Projects\Game Design"

if not exist .git (
    echo [ERROR] No git repository here. Run setup-github.bat first.
    pause
    exit /b 1
)

echo.
echo Changed files:
git status --short
echo.

set /p msg="Describe what changed (or press Enter for 'Update'): "
if "%msg%"=="" set msg=Update

git add .
git commit -m "%msg%"
if errorlevel 1 (
    echo Nothing to commit, or commit failed.
    pause
    exit /b 1
)

git push
if errorlevel 1 (
    echo Push failed. Check your network or GitHub auth.
    pause
    exit /b 1
)

echo.
echo Done! GitHub Pages will redeploy in ~30 seconds.
pause
