# Deploy dev stop/start Lambdas (RDS + ECS schedule)
#
# Prerequisites:
#   aws sso login --profile creator-dev
#
# Usage (PowerShell, from repo root):
#   .\scripts\aws-dev-scheduler\deploy.ps1

$ErrorActionPreference = "Stop"
$Profile = "creator-dev"
$Region = "ap-south-1"
$RoleName = "rds-scheduler-lambda-role"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

function Publish-Lambda {
  param(
    [string]$Name,
    [string]$SourceDir
  )

  $zipPath = Join-Path $env:TEMP "$Name.zip"
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

  Push-Location $SourceDir
  try {
    Compress-Archive -Path "index.mjs" -DestinationPath $zipPath -Force
  } finally {
    Pop-Location
  }

  aws lambda update-function-code `
    --function-name $Name `
    --zip-file "fileb://$zipPath" `
    --profile $Profile `
    --region $Region `
    --output text `
    --query "LastModified"

  aws lambda update-function-configuration `
    --function-name $Name `
    --handler index.handler `
    --runtime nodejs24.x `
    --timeout 900 `
    --memory-size 128 `
    --profile $Profile `
    --region $Region `
    --output text `
    --query "LastModified"
}

Write-Host "Attaching ECS update permissions to $RoleName..."
$policyPath = Join-Path $PSScriptRoot "dev-ecs-scheduler-policy.json"

aws iam put-role-policy `
  --role-name $RoleName `
  --policy-name dev-ecs-scheduler `
  --policy-document "file://$($policyPath -replace '\\','/')" `
  --profile $Profile

Write-Host "Updating stop-dev-db..."
Publish-Lambda -Name "stop-dev-db" -SourceDir (Join-Path $PSScriptRoot "stop-dev")

Write-Host "Updating start-dev-db..."
Publish-Lambda -Name "start-dev-db" -SourceDir (Join-Path $PSScriptRoot "start-dev")

Write-Host "Done."
