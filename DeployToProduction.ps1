param(
  [string]$ResourceGroup = "rg-astrozone-web",
  [string]$Location = "centralus",
  [string]$Registry = "astrozone",
  [string]$PlanName = "asp-astrozone-web",
  [string]$PlanSku = "B1",
  [string]$BackendAppName = "astrozone-backend",
  [string]$BackendImage = "horos-backend",
  [string]$BackendTag = "latest",
  [int]$BackendPort = 7500,
  [string]$FrontendAppName = "astrozone-frontend",
  [string]$FrontendImage = "horos-frontend",
  [string]$FrontendTag = "latest",
  [int]$FrontendPort = 8500,
  [string]$BackendEnvFile = "backend/.env",
  [string]$FrontendEnvFile = "frontend/.env.prod",
  [string]$AcrUsername = "",
  [string]$AcrPassword = ""
)

$script:ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Error "$Name is required but not found in PATH."
    exit 1
  }
}

Require-Command "az"

function Read-EnvFile {
  param([string]$Path)
  $envs = @{}
  if (-not (Test-Path $Path)) {
    Write-Warning "Env file '$Path' not found; continuing without env vars."
    return $envs
  }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
  if (-not $line) { return }
  if ($line.StartsWith("#")) { return }
  $parts = $line -split "=", 2
    if ($parts.Count -eq 2) {
      $key = $parts[0].Trim()
      $val = $parts[1].Trim()
      if ($key) { $envs[$key] = $val }
    }
  }
  return $envs
}

function AppSettingsArray {
  param([hashtable]$Table)
  $arr = @()
  foreach ($k in $Table.Keys) {
    $arr += "$k=$($Table[$k])"
  }
  return $arr
}

$backendEnvTable = Read-EnvFile -Path $BackendEnvFile
$frontendEnvTable = Read-EnvFile -Path $FrontendEnvFile
$loginServer = "${Registry}.azurecr.io"

Write-Host "Ensuring resource group '$ResourceGroup' exists..."
az group create --name $ResourceGroup --location $Location --only-show-errors | Out-Null

if (-not $AcrUsername -or -not $AcrPassword) {
Write-Host "Ensuring ACR admin enabled and fetching credentials for '$Registry'..."
az acr update -n $Registry --admin-enabled true --only-show-errors | Out-Null
$acrCreds = az acr credential show --name $Registry --query "{user:username,pwd:passwords[0].value}" -o json | ConvertFrom-Json
$AcrUsername = $acrCreds.user
$AcrPassword = $acrCreds.pwd
}

# Guard: F1 does not support custom containers.
# Guard: Free (F1) does not support custom containers; default is B1, but keep check for F1.
if ($PlanSku -eq "F1") {
  Write-Error "App Service Linux custom containers are not supported on the Free (F1) tier. Use B1 or higher."
  exit 1
}

Write-Host "Ensuring Linux App Service plan '$PlanName' in '$Location'..."
$planExists = $false
try {
  $null = az appservice plan show --name $PlanName --resource-group $ResourceGroup --query name -o tsv 2>$null
  if ($LASTEXITCODE -eq 0) { $planExists = $true }
} catch {
  $planExists = $false
}
if (-not $planExists) {
  try {
    $planCreate = az appservice plan create `
    --name $PlanName `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku $PlanSku `
    --is-linux `
    --only-show-errors
    $planCreate | Out-Null
    $planExists = $true
  } catch {
    Write-Error "Plan creation failed. Check subscription quotas or choose a different SKU/region."
    exit 1
  }
} else {
  Write-Host "Plan exists; continuing."
}

function Deploy-WebApp {
  param(
    [string]$AppName,
    [string]$Image,
    [int]$Port,
    [hashtable]$EnvTable
  )

  $fullImage = "${loginServer}/${Image}"
  Write-Host "`nDeploying web app '$AppName' with image '$fullImage'..."

  $webExists = $false
  try {
    $null = az webapp show --name $AppName --resource-group $ResourceGroup --query name -o tsv 2>$null
    if ($LASTEXITCODE -eq 0) { $webExists = $true }
  } catch {
    $webExists = $false
  }
  if (-not $webExists) {
    $create = az webapp create `
      --name $AppName `
      --resource-group $ResourceGroup `
      --plan $PlanName `
      --deployment-container-image-name $fullImage `
      --only-show-errors
    if ($LASTEXITCODE -ne 0) {
      Write-Error "Failed to create web app '$AppName'."
      exit 1
    }
    $create | Out-Null
  }

  $cfg = az webapp config container set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --docker-custom-image-name $fullImage `
    --docker-registry-server-url "https://${loginServer}" `
    --docker-registry-server-user $AcrUsername `
    --docker-registry-server-password $AcrPassword `
    --only-show-errors
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set container config for '$AppName'."
    exit 1
  }
  $cfg | Out-Null

  az webapp config appsettings set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --settings @("WEBSITES_PORT=$Port") `
    --only-show-errors | Out-Null

  if ($EnvTable.Count -gt 0) {
    $settings = AppSettingsArray -Table $EnvTable
    az webapp config appsettings set `
      --name $AppName `
      --resource-group $ResourceGroup `
      --settings $settings `
      --only-show-errors | Out-Null
  }

  az webapp restart --name $AppName --resource-group $ResourceGroup --only-show-errors | Out-Null
  Write-Host "Web app '$AppName' deployed."
}

Deploy-WebApp -AppName $BackendAppName -Image "${BackendImage}:${BackendTag}" -Port $BackendPort -EnvTable $backendEnvTable
Deploy-WebApp -AppName $FrontendAppName -Image "${FrontendImage}:${FrontendTag}" -Port $FrontendPort -EnvTable $frontendEnvTable

Write-Host "`nDeployment complete."
