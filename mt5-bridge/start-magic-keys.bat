@echo off
title Magic Keys On-Screen
echo ==========================================
echo   Magic Keys On-Screen for MT5
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

:: Start Magic Keys
python magic_keys.py

pause
