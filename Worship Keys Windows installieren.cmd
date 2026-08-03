@echo off
setlocal
title Worship Keys - Windows Installation

set "INSTALLER=%~dp0Worship Keys Windows installieren.ps1"
if not exist "%INSTALLER%" (
  echo FEHLER: Die Datei "Worship Keys Windows installieren.ps1" fehlt.
  echo Bitte beide Windows-Installerdateien gemeinsam in denselben Ordner legen.
  echo.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%INSTALLER%"
if errorlevel 1 (
  echo.
  echo Die Installation wurde nicht abgeschlossen.
  pause
  exit /b 1
)

endlocal
