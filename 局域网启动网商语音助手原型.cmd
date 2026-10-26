@echo off
setlocal
title Wangshang Voice Assistant Prototype - LAN Server
cd /d "%~dp0"

set "PORT=5821"
set "LAN_IP="

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js or npm.cmd was not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules\.package-lock.json" (
  echo Installing project dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)

for /f "tokens=4" %%I in ('route print -4 ^| findstr /R /C:"^[ ]*0\.0\.0\.0[ ]*0\.0\.0\.0"') do if not defined LAN_IP set "LAN_IP=%%I"

echo.
echo ============================================================
echo  Wangshang Voice Assistant 8.21 Scheme B LAN Server
echo ============================================================
echo  Local URL: http://127.0.0.1:%PORT%/
if defined LAN_IP (
  echo  LAN URL:   http://%LAN_IP%:%PORT%/
) else (
  echo  LAN URL:   IP detection failed. Run ipconfig to find the WLAN IPv4 address.
)
echo.
echo  Share the LAN URL with people on the same local network.
echo  Keep this window open. Closing it will stop the website.
echo  If the URL is unreachable, allow TCP port %PORT% through Windows Firewall.
echo ============================================================
echo.

call "%~dp0node_modules\.bin\vite.cmd" --host 0.0.0.0 --port %PORT% --strictPort

echo.
echo The website has stopped.
pause
endlocal
