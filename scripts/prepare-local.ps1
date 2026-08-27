[CmdletBinding()]
param(
  [ValidateRange(1, 65535)]
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env.local'
$dataDirectory = Join-Path $projectRoot '.data'
$setupMarker = Join-Path $dataDirectory 'local-setup-complete'

function New-RandomBytes([int]$Length) {
  $bytes = New-Object byte[] $Length
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return ,$bytes
}

function ConvertFrom-SecureValue([Security.SecureString]$Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Read-AdminName {
  if ($env:DASHBOARD_ADMIN_NAME) {
    if ($env:DASHBOARD_ADMIN_NAME.Trim().Length -lt 2) { throw 'DASHBOARD_ADMIN_NAME deve ter pelo menos 2 caracteres.' }
    return $env:DASHBOARD_ADMIN_NAME.Trim()
  }
  do { $value = (Read-Host 'Nome do administrador').Trim() } while ($value.Length -lt 2)
  return $value
}

function Read-AdminEmail {
  if ($env:DASHBOARD_ADMIN_EMAIL) { $value = $env:DASHBOARD_ADMIN_EMAIL.Trim().ToLowerInvariant() }
  else { $value = (Read-Host 'E-mail do administrador').Trim().ToLowerInvariant() }
  try { $parsed = New-Object System.Net.Mail.MailAddress($value) }
  catch {
    if ($env:DASHBOARD_ADMIN_EMAIL) { throw 'DASHBOARD_ADMIN_EMAIL deve conter um e-mail valido.' }
    Write-Host '[AVISO] Informe um e-mail valido.' -ForegroundColor Yellow
    return (Read-AdminEmail)
  }
  if ($parsed.Address -ne $value) {
    if ($env:DASHBOARD_ADMIN_EMAIL) { throw 'DASHBOARD_ADMIN_EMAIL deve conter um e-mail valido.' }
    Write-Host '[AVISO] Informe um e-mail valido.' -ForegroundColor Yellow
    return (Read-AdminEmail)
  }
  return $value
}

function Read-AdminPassword {
  if ($env:DASHBOARD_ADMIN_PASSWORD) {
    if ($env:DASHBOARD_ADMIN_PASSWORD.Length -lt 12) { throw 'DASHBOARD_ADMIN_PASSWORD deve ter pelo menos 12 caracteres.' }
    return $env:DASHBOARD_ADMIN_PASSWORD
  }
  do {
    $first = ConvertFrom-SecureValue (Read-Host 'Senha do administrador (minimo 12 caracteres)' -AsSecureString)
    if ($first.Length -lt 12) {
      Write-Host '[AVISO] A senha deve ter pelo menos 12 caracteres.' -ForegroundColor Yellow
      continue
    }
    $second = ConvertFrom-SecureValue (Read-Host 'Confirme a senha' -AsSecureString)
    if ($first -ne $second) {
      Write-Host '[AVISO] As senhas nao conferem.' -ForegroundColor Yellow
      $first = $null
      $second = $null
    }
  } while (-not $first)
  $second = $null
  return $first
}

try {
  Set-Location $projectRoot

  if (-not (Test-Path -LiteralPath $envPath)) {
    $authSecret = [Convert]::ToBase64String((New-RandomBytes 48))
    $tokenKey = [Convert]::ToBase64String((New-RandomBytes 32))
    $cronSecret = [Convert]::ToBase64String((New-RandomBytes 48))
    $contents = @"
# Gerado pelo iniciar-dashboard.bat para uso somente nesta maquina.
DASHBOARD_LOCAL_SETUP=true
DATABASE_URL=
LOCAL_DATABASE_MODE=true
LOCAL_DATABASE_DIR=.data/local-postgres
DEMO_MODE=false

AUTH_SECRET=$authSecret
NEXTAUTH_URL=http://127.0.0.1:$Port

META_APP_ID=
META_APP_SECRET=
# Informe uma URL publica HTTPS, normalmente fornecida por um tunel local.
META_REDIRECT_URI=
META_GRAPH_API_VERSION=v25.0
META_TOKEN_ENCRYPTION_KEY=$tokenKey

CRON_SECRET=$cronSecret
"@
    [IO.File]::WriteAllText($envPath, $contents, (New-Object Text.UTF8Encoding($false)))
    Write-Host '[OK] Configuracao local criada com segredos aleatorios.' -ForegroundColor Green
  }

  $isManagedLocalSetup = Get-Content -LiteralPath $envPath | Where-Object { $_.Trim() -eq 'DASHBOARD_LOCAL_SETUP=true' } | Select-Object -First 1
  if (-not $isManagedLocalSetup) {
    Write-Host '[OK] Configuracao manual existente preservada.' -ForegroundColor Green
    exit 0
  }

  if (Test-Path -LiteralPath $setupMarker) {
    Write-Host '[OK] Banco local e administrador ja estao configurados.' -ForegroundColor Green
    exit 0
  }

  Write-Host ''
  Write-Host 'Primeiro acesso: crie o administrador local.' -ForegroundColor Cyan
  $adminName = Read-AdminName
  $adminEmail = Read-AdminEmail
  $adminPassword = Read-AdminPassword

  $keys = @('NODE_ENV', 'DEMO_MODE', 'LOCAL_DATABASE_MODE', 'LOCAL_DATABASE_DIR', 'DATABASE_URL', 'INITIAL_ADMIN_NAME', 'INITIAL_ADMIN_EMAIL', 'INITIAL_ADMIN_PASSWORD')
  $previous = @{}
  foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }

  try {
    $env:NODE_ENV = 'development'
    $env:DEMO_MODE = 'false'
    $env:LOCAL_DATABASE_MODE = 'true'
    $env:LOCAL_DATABASE_DIR = '.data/local-postgres'
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    $env:INITIAL_ADMIN_NAME = $adminName
    $env:INITIAL_ADMIN_EMAIL = $adminEmail
    $env:INITIAL_ADMIN_PASSWORD = $adminPassword

    $pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
    if ($pnpm) { & $pnpm.Source admin:create }
    elseif (Get-Command corepack -ErrorAction SilentlyContinue) { & corepack pnpm admin:create }
    else { throw 'pnpm e Corepack nao foram encontrados.' }
    if ($LASTEXITCODE -ne 0) { throw "O comando admin:create terminou com o codigo $LASTEXITCODE." }
  }
  finally {
    $adminPassword = $null
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
  }

  New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
  [IO.File]::WriteAllText($setupMarker, "Administrador configurado em $([DateTimeOffset]::Now.ToString('o'))`n", (New-Object Text.UTF8Encoding($false)))
  Write-Host '[OK] Administrador criado. Use o e-mail e a senha informados para entrar.' -ForegroundColor Green
  exit 0
}
catch {
  Write-Host "[ERRO] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
