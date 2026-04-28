@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install Node.js (LTS) and try again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is not available. Please reinstall Node.js (LTS).
  pause
  exit /b 1
)

if not exist "dist\" (
  echo Building preview files...
  call npm install
  if errorlevel 1 goto :fail
  call npm run build
  if errorlevel 1 goto :fail
)

echo Starting local server on http://127.0.0.1:4173
start "" node server.js
timeout /t 2 >nul
start "" http://127.0.0.1:4173
exit /b 0

:fail
echo Build failed. Check the output above.
pause
exit /b 1
