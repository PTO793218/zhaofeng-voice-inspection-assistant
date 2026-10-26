@echo off
setlocal
title Wangshang Voice Assistant Prototype Launcher
cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js or npm.cmd was not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules\.package-lock.json" (
  echo Installing project dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

set "PORT=5821"
echo Starting the 8.21 Scheme B prototype at http://127.0.0.1:%PORT%/
echo The page opens only after this folder binds its dedicated port successfully.
start "Wangshang Voice Assistant 8.21 Scheme B" cmd /k "cd /d ""%~dp0"" && npm.cmd run dev -- --port %PORT% --strictPort --open"

endlocal
