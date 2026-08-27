@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Dashboard de Performance Meta Ads
set "PNPM_COMMAND=pnpm"

echo.
echo ============================================================
echo   Dashboard de Performance Meta Ads
echo ============================================================
echo.

if not exist "package.json" (
  echo [ERRO] O arquivo package.json nao foi encontrado nesta pasta.
  echo Coloque este iniciador na pasta raiz do projeto.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js 22.13 ou superior nao esta instalado ou nao esta no PATH.
  echo Baixe a versao LTS em https://nodejs.org/
  pause
  exit /b 1
)

node -e "const v=process.versions.node.split('.').map(Number);process.exit(Math.sign(Math.max(0,2213-v[0]*100-v[1])))" >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Esta aplicacao requer Node.js 22.13 ou superior.
  echo Versao encontrada:
  node --version
  pause
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  where corepack >nul 2>&1
  if errorlevel 1 (
    echo [ERRO] pnpm nao esta instalado e o Corepack nao foi encontrado.
    echo Instale com: npm install -g pnpm@11.19.0
    pause
    exit /b 1
  )
  set "PNPM_COMMAND=corepack pnpm"
)

if /I "%~1"=="--verificar" (
  if not exist "scripts\prepare-local.ps1" (
    echo [ERRO] O assistente scripts\prepare-local.ps1 nao foi encontrado.
    pause
    exit /b 1
  )
  if not exist "scripts\configure-meta.ps1" (
    echo [ERRO] O assistente scripts\configure-meta.ps1 nao foi encontrado.
    pause
    exit /b 1
  )
  echo [OK] Node.js, pnpm e arquivos do projeto foram encontrados.
  if exist ".env.local" (
    echo [OK] Configuracao local encontrada.
    powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configure-meta.ps1" -CheckOnly
    if errorlevel 1 echo [INFO] Execute configurar-meta.bat para habilitar a conexao oficial com a Meta.
  ) else (
    echo [INFO] A configuracao local sera criada na primeira inicializacao.
    echo [INFO] O iniciador oferecera a configuracao Meta depois de preparar o administrador.
  )
  exit /b 0
)

if not defined DASHBOARD_PORT set "DASHBOARD_PORT=3000"
node -e "const p=Number(process.argv[1]);process.exit(Number.isInteger(p)?Math.sign(Math.max(0,1-p)+Math.max(0,p-65535)):1)" "%DASHBOARD_PORT%" >nul 2>&1
if errorlevel 1 (
  echo [ERRO] DASHBOARD_PORT deve ser um numero entre 1 e 65535.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/3] Instalando dependencias da primeira execucao...
  call %PNPM_COMMAND% install --frozen-lockfile
  if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
) else (
  echo [1/3] Dependencias ja instaladas.
)

if not exist "scripts\prepare-local.ps1" (
  echo [ERRO] O assistente scripts\prepare-local.ps1 nao foi encontrado.
  pause
  exit /b 1
)

echo [2/3] Verificando a configuracao local...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\prepare-local.ps1" -Port %DASHBOARD_PORT%
if errorlevel 1 (
  echo.
  echo [ERRO] A configuracao inicial nao foi concluida.
  echo Execute este arquivo novamente para continuar do ponto em que parou.
  pause
  exit /b 1
)

if not exist "scripts\configure-meta.ps1" (
  echo [ERRO] O assistente scripts\configure-meta.ps1 nao foi encontrado.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configure-meta.ps1" -CheckOnly
if errorlevel 1 (
  echo.
  echo [AVISO] A conexao Meta ainda precisa do App ID e do App Secret reais.
  choice /C SN /N /M "Deseja configurar a Meta agora? [S/N] "
  if not errorlevel 2 (
    call "%~dp0configurar-meta.bat" --retornar
    if errorlevel 1 (
      echo [ERRO] A configuracao Meta nao foi concluida.
      pause
      exit /b 1
    )
  )
)

if /I "%~1"=="--preparar" (
  echo.
  echo [OK] Aplicacao preparada. Execute iniciar-dashboard.bat para iniciar.
  exit /b 0
)

powershell.exe -NoLogo -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort %DASHBOARD_PORT% -ErrorAction SilentlyContinue) { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERRO] A porta %DASHBOARD_PORT% ja esta em uso.
  echo Se o dashboard ja estiver aberto, acesse http://127.0.0.1:%DASHBOARD_PORT%
  echo Caso contrario, feche o programa que usa a porta ou defina DASHBOARD_PORT.
  pause
  exit /b 1
)

echo [3/3] Iniciando a aplicacao com a configuracao de .env.local...
echo.
echo Endereco: http://127.0.0.1:%DASHBOARD_PORT%
echo Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.
echo.

call %PNPM_COMMAND% dev --hostname 127.0.0.1 --port %DASHBOARD_PORT%
set "APP_EXIT=%ERRORLEVEL%"

if not "%APP_EXIT%"=="0" (
  echo.
  echo [ERRO] A aplicacao foi encerrada com o codigo %APP_EXIT%.
  pause
)

exit /b %APP_EXIT%
