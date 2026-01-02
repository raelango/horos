$ErrorActionPreference = "Stop"

param(
  [string]$ImageName = "horos-backend",
  [string]$Tag = "latest",
  [string]$Dockerfile = "Dockerfile",
  [string]$Context = ".",
  [string]$Registry = "astrozone",
  [string]$ResourceGroup = "rg-astrozone"
)

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Error "$Name is required but was not found in PATH."
    exit 1
  }
}

Require-Command "az"
Require-Command "docker"

$fullImage = "$Registry.azurecr.io/$ImageName:$Tag"

Write-Host "Validating Azure Container Registry '$Registry' in resource group '$ResourceGroup'..."
az acr show --name $Registry --resource-group $ResourceGroup --only-show-errors | Out-Null

Write-Host "Signing in to ACR '$Registry'..."
az acr login --name $Registry --only-show-errors | Out-Null

Write-Host "Building image: $fullImage"
docker build --file $Dockerfile --tag $fullImage $Context

Write-Host "Pushing image: $fullImage"
docker push $fullImage

Write-Host "Done."
