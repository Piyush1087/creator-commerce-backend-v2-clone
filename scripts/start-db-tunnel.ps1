param(
  [string]$Stage = "dev",
  [int]$LocalPort = 5435
)

$ErrorActionPreference = "Stop"

# Use Prod instance and host by default if Stage is prod
if ($Stage -eq "prod") {
  $env:AWS_PROFILE = "creator-prod"
  # Target Instance: Bastion for Prod (SST Managed or Manual)
  $InstanceId = "i-xxxxprod-bastion-id"
  $RdsHost = "creatorshop-be-prod-corecluster.cluster-czo4e2u0wc9y.ap-south-1.rds.amazonaws.com"
} else {
  $env:AWS_PROFILE = "creator-dev"
  # Target Instance: Custom Jumpbox for v2 Dev
  $InstanceId = "i-03447f2aba0c94173"
  $RdsHost = "creator-dev-postgres-small.czo4e2u0wc9y.ap-south-1.rds.amazonaws.com"
}

$Region = "ap-south-1"
$RemotePort = 5432

Write-Host "Starting SSM tunnel to $Stage DB..."
Write-Host "  Profile: $($env:AWS_PROFILE)"
Write-Host "  Jumpbox/Bastion: $InstanceId"
Write-Host "  localhost:$LocalPort -> $RdsHost`:$RemotePort"
Write-Host ""
Write-Host "Keep this terminal open. Connect your DB client to localhost:$LocalPort"
Write-Host ""

aws ssm start-session `
  --target $InstanceId `
  --document-name AWS-StartPortForwardingSessionToRemoteHost `
  --parameters "host=$RdsHost,portNumber=$RemotePort,localPortNumber=$LocalPort" `
  --profile $env:AWS_PROFILE `
  --region $Region
