@echo off
setlocal enabledelayedexpansion
title Game Design - GitHub Setup

echo ============================================
echo   Game Design - GitHub Setup
echo ============================================
echo.

cd /d "E:\Projects\Game Design"

REM Verify git is installed
where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git is not installed or not in PATH.
    echo Install from https://git-scm.com/download/win then re-run this script.
    pause
    exit /b 1
)

REM Clean up any leftover .git folder
if exist .git (
    echo Removing leftover .git folder...
    rmdir /s /q .git
    if exist .git (
        echo [ERROR] Could not delete .git folder.
        echo Right-click PowerShell, "Run as administrator", then run:
        echo    Remove-Item -Recurse -Force "E:\Projects\Game Design\.git"
        pause
        exit /b 1
    )
    echo Done.
    echo.
)

echo Initializing repository...
git init -b main
if errorlevel 1 goto :fail

git config user.email "egotave@gmail.com"
git config user.name "Boss"
git config core.autocrlf true

echo.
echo Staging files (this respects .gitignore)...
git add .
if errorlevel 1 goto :fail

echo.
echo Summary of staged files:
for /f %%C in ('git diff --cached --name-only ^| find /v /c ""') do echo   %%C files staged
echo.

echo Creating initial commit...
git commit -m "Initial commit"
if errorlevel 1 goto :fail

echo.
echo ============================================
echo   STEP: Create the GitHub repo
echo ============================================
echo.
echo 1. Open https://github.com/new in your browser
echo 2. Repository name: monster-summoners (or your choice, no spaces)
echo 3. Set it to PUBLIC (required for free GitHub Pages)
echo 4. Do NOT check "Add a README" / .gitignore / license
echo 5. Click "Create repository"
echo 6. Copy the HTTPS URL it shows (ends in .git)
echo.
set /p repoUrl="Paste your repo URL here: "

if "%repoUrl%"=="" (
    echo No URL entered. Stopping.
    pause
    exit /b 1
)

echo.
echo Connecting to GitHub...
git remote add origin %repoUrl%
if errorlevel 1 goto :fail

echo.
echo Pushing to GitHub...
echo (A browser window may pop up to authenticate - approve it.)
echo.
git push -u origin main
if errorlevel 1 goto :fail

echo.
echo ============================================
echo   SUCCESS!
echo ============================================
echo.
echo Next: turn on GitHub Pages so you can play from anywhere.
echo   1. Go to your repo on GitHub
echo   2. Settings -^> Pages (left sidebar)
echo   3. Source: "Deploy from a branch"
echo   4. Branch: main, folder: / (root), click Save
echo   5. Wait ~1 minute, then your game is live at:
echo      https://YOUR-USERNAME.github.io/REPO-NAME/
echo.
echo From now on, to push changes use push-changes.bat
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] A git command failed. Read the message above.
echo If you need help, copy the error and ask me.
pause
exit /b 1
