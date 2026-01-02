param(
  [string]$Registry = "astrozone",
  [string]$ResourceGroup = "rg-astrozone",
  [string]$BackendImage = "horos-backend",
  [string]$BackendTag = "latest",
  [string]$BackendDockerfile = "backend/Dockerfile",
  [string]$BackendContext = "backend",
  [string]$FrontendImage = "horos-frontend",
  [string]$FrontendTag = "latest",
  [string]$FrontendDockerfile = "frontend/Dockerfile",
  [string]$FrontendContext = "frontend"
)

$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Error "$Name is required but was not found in PATH."
    exit 1
  }
}

Require-Command "az"
Require-Command "docker"

Write-Host "Validating Azure Container Registry '$Registry' in resource group '$ResourceGroup'..."
az acr show --name $Registry --resource-group $ResourceGroup --only-show-errors | Out-Null

Write-Host "Signing in to ACR '$Registry'..."
az acr login --name $Registry --only-show-errors | Out-Null

function Build-And-Push {
  param(
    [string]$ImageName,
    [string]$Tag,
    [string]$Dockerfile,
    [string]$Context
  )
  $full = "${Registry}.azurecr.io/${ImageName}:${Tag}"
  Write-Host "`nBuilding $full (Dockerfile=$Dockerfile, Context=$Context)..."
  docker build --file $Dockerfile --tag $full $Context
  Write-Host "Pushing $full..."
  docker push $full
}

Build-And-Push -ImageName $BackendImage -Tag $BackendTag -Dockerfile $BackendDockerfile -Context $BackendContext
Build-And-Push -ImageName $FrontendImage -Tag $FrontendTag -Dockerfile $FrontendDockerfile -Context $FrontendContext

Write-Host "`nDone."
