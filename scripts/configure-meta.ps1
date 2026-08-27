[CmdletBinding()]
param(
  [switch]$CheckOnly,
  [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) { $EnvFile = Join-Path $projectRoot '.env.local' }
$requiredKeys = @('META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI', 'META_GRAPH_API_VERSION', 'META_TOKEN_ENCRYPTION_KEY')

function Read-DotEnv([string]$Path) {
  $result = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $result }
  Get-Content -LiteralPath $Path | ForEach-Object {
    if ($_ -match '^\s*([A-Z0-9_]+)\s*=(.*)$') {
      $value = $matches[2].Trim()
      if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      $result[$matches[1]] = $value
    }
  }
  return $result
}

function Get-EffectiveValue([string]$Key, [hashtable]$FileValues) {
  $processValue = [Environment]::GetEnvironmentVariable($Key, 'Process')
  if ($null -ne $processValue) { return $processValue.Trim() }
  if ($FileValues.ContainsKey($Key)) { return ([string]$FileValues[$Key]).Trim() }
  return ''
}

function Test-EncryptionKey([string]$Value) {
  if ($Value -match '^[a-fA-F0-9]{64}$') { return $true }
  try { return [Convert]::FromBase64String($Value).Length -eq 32 } catch { return $false }
}

function Assert-Callback([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { throw 'META_REDIRECT_URI e obrigatoria.' }
  if ($Value -match '\s') { throw 'META_REDIRECT_URI nao pode conter espacos.' }
  try { $uri = [Uri]$Value } catch { throw 'META_REDIRECT_URI deve ser uma URL absoluta.' }
  if (-not $uri.IsAbsoluteUri) { throw 'META_REDIRECT_URI deve ser uma URL absoluta.' }
  if ($uri.Scheme -ne 'https') {
    throw 'Nao foi possivel iniciar a conexao com a Meta porque a URL de callback nao utiliza HTTPS. Configure META_REDIRECT_URI com uma URL publica e segura.'
  }
  if ($uri.UserInfo) { throw 'META_REDIRECT_URI nao pode conter usuario ou senha.' }
  $parsedAddress = $null
  $isIp = [Net.IPAddress]::TryParse($uri.Host, [ref]$parsedAddress)
  $host = $uri.Host.ToLowerInvariant()
  if ($isIp -or $host -eq 'localhost' -or $host.EndsWith('.localhost') -or $host.EndsWith('.local') -or $host.EndsWith('.internal') -or $host.IndexOf('.') -lt 1 -or [Uri]::CheckHostName($host) -ne [UriHostNameType]::Dns) {
    throw 'META_REDIRECT_URI deve utilizar um dominio publico valido; localhost e enderecos IP nao sao aceitos.'
  }
  if ($uri.AbsolutePath -cne '/api/meta/callback') { throw 'META_REDIRECT_URI deve terminar exatamente em /api/meta/callback, sem barra final.' }
  if ($uri.Query -or $uri.Fragment) { throw 'META_REDIRECT_URI nao pode conter query ou fragmento.' }
}

function Test-Callback([string]$Value) {
  try { Assert-Callback $Value; return $true } catch { return $false }
}

function New-RandomKey {
  $bytes = New-Object byte[] 32
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($bytes)
}

function ConvertTo-DotEnvValue([string]$Value) {
  if ($Value -notmatch '[\s#"'']') { return $Value }
  $escaped = $Value.Replace('\', '\\').Replace('"', '\"').Replace("`r", '\r').Replace("`n", '\n')
  return '"' + $escaped + '"'
}

function Set-DotEnvValue([string[]]$Lines, [string]$Key, [string]$Value) {
  $replacement = "$Key=$(ConvertTo-DotEnvValue $Value)"
  $found = $false
  $updated = foreach ($line in $Lines) {
    if ($line -match "^\s*$([Regex]::Escape($Key))\s*=") {
      if (-not $found) { $replacement; $found = $true }
    } else { $line }
  }
  if (-not $found) { $updated = @($updated) + $replacement }
  return @($updated)
}

function ConvertFrom-SecureValue([Security.SecureString]$Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

try {
  $fileValues = Read-DotEnv $EnvFile
  $effective = @{}
  foreach ($key in $requiredKeys) { $effective[$key] = Get-EffectiveValue $key $fileValues }
  $missing = @($requiredKeys | Where-Object { -not $effective[$_] })
  $invalid = @()
  if ($effective.META_REDIRECT_URI -and -not (Test-Callback $effective.META_REDIRECT_URI)) { $invalid += 'META_REDIRECT_URI' }
  if ($effective.META_GRAPH_API_VERSION -and $effective.META_GRAPH_API_VERSION -notmatch '^v\d+\.\d+$') { $invalid += 'META_GRAPH_API_VERSION' }
  if ($effective.META_TOKEN_ENCRYPTION_KEY -and -not (Test-EncryptionKey $effective.META_TOKEN_ENCRYPTION_KEY)) { $invalid += 'META_TOKEN_ENCRYPTION_KEY' }

  if ($CheckOnly) {
    if ($missing.Count -eq 0 -and $invalid.Count -eq 0) { Write-Host '[OK] Configuracao Meta encontrada no ambiente de execucao.' -ForegroundColor Green; exit 0 }
    if ($missing.Count) { Write-Host "[AVISO] Variaveis Meta ausentes: $($missing -join ', ')." -ForegroundColor Yellow }
    if ($invalid.Count) { Write-Host "[AVISO] Variaveis Meta invalidas: $($invalid -join ', ')." -ForegroundColor Yellow }
    exit 2
  }

  Write-Host 'As credenciais serao gravadas diretamente em .env.local e nao aparecerao no navegador.' -ForegroundColor Cyan
  Write-Host 'Obtenha o App ID e o App Secret em Meta for Developers > Configuracoes > Basico.'
  Write-Host ''

  $appId = if ($env:DASHBOARD_META_APP_ID) { $env:DASHBOARD_META_APP_ID.Trim() } else { (Read-Host 'Meta App ID').Trim() }
  if ($appId -notmatch '^\d{5,}$') { throw 'O Meta App ID deve conter apenas numeros.' }

  if ($env:DASHBOARD_META_APP_SECRET) { $appSecret = $env:DASHBOARD_META_APP_SECRET }
  else { $appSecret = ConvertFrom-SecureValue (Read-Host 'Meta App Secret (entrada oculta)' -AsSecureString) }
  if (-not $appSecret -or $appSecret.Trim().Length -lt 16) { throw 'O Meta App Secret informado e invalido.' }
  $appSecret = $appSecret.Trim()

  Write-Host 'Use o dominio HTTPS publicado ou a URL HTTPS de um tunel (Cloudflare Tunnel/ngrok).' -ForegroundColor Cyan
  Write-Host 'Cadastre a mesma URL, sem qualquer diferenca, em Valid OAuth Redirect URIs no painel da Meta.'
  $defaultCallback = if ($effective.META_REDIRECT_URI -and (Test-Callback $effective.META_REDIRECT_URI)) { $effective.META_REDIRECT_URI } else { '' }
  $callbackInput = if ($env:DASHBOARD_META_REDIRECT_URI) { $env:DASHBOARD_META_REDIRECT_URI.Trim() } elseif ($defaultCallback) { (Read-Host "URL publica HTTPS do callback [$defaultCallback]").Trim() } else { (Read-Host 'URL publica HTTPS do callback (termina em /api/meta/callback)').Trim() }
  $callback = if ($callbackInput) { $callbackInput } else { $defaultCallback }
  Assert-Callback $callback

  $defaultVersion = if ($effective.META_GRAPH_API_VERSION -match '^v\d+\.\d+$') { $effective.META_GRAPH_API_VERSION } else { 'v25.0' }
  $versionInput = if ($env:DASHBOARD_META_GRAPH_API_VERSION) { $env:DASHBOARD_META_GRAPH_API_VERSION.Trim() } else { (Read-Host "Versao da Graph API [$defaultVersion]").Trim() }
  $version = if ($versionInput) { $versionInput } else { $defaultVersion }
  if ($version -notmatch '^v\d+\.\d+$') { throw 'A versao deve seguir o formato v25.0.' }

  $tokenKey = if ($effective.META_TOKEN_ENCRYPTION_KEY -and (Test-EncryptionKey $effective.META_TOKEN_ENCRYPTION_KEY)) { $effective.META_TOKEN_ENCRYPTION_KEY } else { New-RandomKey }
  $lines = if (Test-Path -LiteralPath $EnvFile) { @(Get-Content -LiteralPath $EnvFile) } else { @('# Configuracao local do Dashboard de Performance Meta Ads') }
  $values = [ordered]@{ META_APP_ID=$appId; META_APP_SECRET=$appSecret; META_REDIRECT_URI=$callback; META_GRAPH_API_VERSION=$version; META_TOKEN_ENCRYPTION_KEY=$tokenKey }
  foreach ($entry in $values.GetEnumerator()) { $lines = Set-DotEnvValue $lines $entry.Key ([string]$entry.Value) }
  [IO.File]::WriteAllLines($EnvFile, $lines, (New-Object Text.UTF8Encoding($false)))
  $appSecret = $null
  $values.META_APP_SECRET = $null

  $saved = Read-DotEnv $EnvFile
  $savedMissing = @($requiredKeys | Where-Object { -not (Get-EffectiveValue $_ $saved) })
  if ($savedMissing.Count) { throw "A gravacao nao foi validada: $($savedMissing -join ', ')." }
  Write-Host ''
  Write-Host '[OK] As cinco variaveis obrigatorias foram gravadas e validadas.' -ForegroundColor Green
  Write-Host 'Reinicie completamente o dashboard para carregar as credenciais.' -ForegroundColor Yellow
  exit 0
}
catch {
  Write-Host "[ERRO] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
