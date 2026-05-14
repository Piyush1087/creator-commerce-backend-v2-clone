param(
  [string]$InstanceId
)

$ErrorActionPreference = "Stop"

if (-not $InstanceId) {
  Write-Host "Pass the prod bastion instance id with -InstanceId."
  exit 1
}

Write-Host "This script is a placeholder for the prod database tunnel."
Write-Host "Update the host/target details after the v2 prod database path is finalized."
Write-Host "Keep using AWS profile creator-prod for prod access."
