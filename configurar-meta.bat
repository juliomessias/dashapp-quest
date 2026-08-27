@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Configurar integracao Meta Ads

echo.
echo ============================================================
echo   Configurar integracao Meta Ads
echo ============================================================
echo.

if not exist "scripts\configure-meta.ps1" (
  echo [ERRO] O assistente scripts\configure-meta.ps1 nao foi encontrado.
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo [ERRO] A configuracao base ainda nao existe.
  echo Execute iniciar-dashboard.bat primeiro; ele preparara o banco e oferecera este assistente.
  pause
  exit /b 1
)

where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] O Windows PowerShell nao foi encontrado.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configure-meta.ps1"
set "CONFIG_EXIT=%ERRORLEVEL%"
if not "%CONFIG_EXIT%"=="0" (
  echo.
  echo [ERRO] A configuracao Meta nao foi concluida.
  pause
  exit /b %CONFIG_EXIT%
)

echo.
echo [OK] Credenciais Meta salvas somente no arquivo .env.local.
echo Feche qualquer janela antiga do dashboard para carregar a nova configuracao.

if /I "%~1"=="--retornar" exit /b 0

choice /C SN /N /M "Deseja iniciar a aplicacao agora? [S/N] "
if errorlevel 2 exit /b 0
call "%~dp0iniciar-dashboard.bat"
exit /b %ERRORLEVEL%
