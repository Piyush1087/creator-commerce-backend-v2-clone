$ErrorActionPreference = "Stop"

param(
  [string]$InstanceId = "i-03447f2aba0c94173",
  [int]$LocalPort = 5435
)

$env:AWS_PROFILE = "creator-dev"
$Region = "ap-south-1"
$RdsHost = "creator-dev-postgres-small.czo4e2u0wc9y.ap-south-1.rds.amazonaws.com"
$RemotePort = 5432

Write-Host "Starting SSM tunnel to Dev DB (t4g.small)..."
Write-Host "  Instance (Jumpbox): $InstanceId"
Write-Host "  localhost:$LocalPort -> $RdsHost`:$RemotePort"
Write-Host ""
Write-Host "Keep this terminal open. Use another terminal for Prisma/app."
Write-Host ""

aws ssm start-session `
  --target $InstanceId `
  --document-name AWS-StartPortForwardingSessionToRemoteHost `
  --parameters "host=$RdsHost,portNumber=$RemotePort,localPortNumber=$LocalPort" `
  --profile creator-dev `
  --region $Region
