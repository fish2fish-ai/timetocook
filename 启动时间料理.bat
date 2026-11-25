@echo off
title Time Cuisine - Starting...

echo.
echo ====================================
echo    Time Cuisine
echo ====================================
echo.

cd /d "%~dp0"

echo [1/2] Starting server (port 3000)...
start "TimeCuisine" cmd /k "node server.js"
timeout /t 2 /nobreak >nul

echo [2/2] Opening browser...
start http://localhost:3000

echo.
echo ====================================
echo    Done!
echo ====================================
echo.
echo App URL: http://localhost:3000
echo.
echo Closing this window will NOT stop the service.
echo To stop it, close the other console window.
echo.
pause
