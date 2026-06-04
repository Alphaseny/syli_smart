@echo off
title Smart Bureau - Demarrage
echo ================================================
echo    Smart Bureau - Demarrage du systeme
echo ================================================
echo.

REM Chemins
set MOSQUITTO=%ProgramFiles%\mosquitto\mosquitto.exe
set CONF=%~dp0backend\mosquitto.conf
set VENV=%~dp0backend\.venv\Scripts\uvicorn.exe

REM Verification Mosquitto
if not exist "%MOSQUITTO%" (
    echo ERREUR: Mosquitto introuvable dans %MOSQUITTO%
    pause
    exit /b 1
)

REM Verification venv
if not exist "%VENV%" (
    echo ERREUR: uvicorn introuvable. Verifiez que le venv est cree.
    pause
    exit /b 1
)

echo [1/2] Demarrage Broker MQTT...
start "MQTT Broker" "%MOSQUITTO%" -c "%CONF%" -v
ping -n 3 127.0.0.1 >nul

echo [2/2] Demarrage API FastAPI...
cd /d "%~dp0backend"
start "FastAPI Backend" "%~dp0backend\.venv\Scripts\uvicorn.exe" main:app --reload

echo.
echo ================================================
echo  MQTT   : localhost:1883
echo  API    : http://localhost:8000
echo  Swagger: http://localhost:8000/docs
echo ================================================
echo.
pause
