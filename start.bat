@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. Lutfen https://nodejs.org adresinden LTS surumunu kurun.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Paketler indiriliyor, bu birkac dakika surebilir...
  call npm install
)
npm start
