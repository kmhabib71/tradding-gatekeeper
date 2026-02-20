@echo off
title GATEKEEPER MT5 Bridge
echo ==========================================
echo   GATEKEEPER MT5 Bridge
echo ==========================================
echo.

:: Change to the bridge directory
cd /d "%~dp0"

:: Check if dependencies are installed
python -c "import MetaTrader5" 2>nul
if errorlevel 1 (
    echo Installing dependencies for first time...
    pip install -r requirements.txt
    echo.
)

:: Set Gatekeeper URL (change this if deploying to Vercel)
set GATEKEEPER_URL=http://localhost:3000
set GATEKEEPER_PASSWORD=gatekeeper123

:: Start the bridge
python bridge.py

pause
