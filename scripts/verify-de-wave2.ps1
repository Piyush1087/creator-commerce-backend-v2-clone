param([switch]$FullSuite, [string]$ReportPath, [string[]]$TestPath)
$ErrorActionPreference = 'Stop'
$container = 'creator-shop-acceptance-postgres'
$suffix = [guid]::NewGuid().ToString('N').Substring(0, 12)
$testDatabase = "codex_de_w2_$suffix"
$testRole = "codex_de_w2_role_$suffix"
$testPassword = [guid]::NewGuid().ToString('N')
$roleCreated = $false
$databaseCreated = $false
$savedEnvironment = @{}
$historicalRoot = Join-Path ([IO.Path]::GetTempPath()) "codex-de-w2-$suffix"
$historicalCreated = $false
try {
  $containerEnvironment = docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' $container
  if ($LASTEXITCODE -ne 0) { throw 'Disposable local PostgreSQL container is unavailable' }
  $adminUser = (($containerEnvironment | Where-Object { $_ -like 'POSTGRES_USER=*' }) -replace '^POSTGRES_USER=', '')
  if (!$adminUser) { throw 'Container admin user not found' }
  if ($testDatabase -notmatch '^codex_de_w2_[a-f0-9]{12}$' -or $testRole -notmatch '^codex_de_w2_role_[a-f0-9]{12}$') { throw 'Unsafe disposable target' }
  $exists = docker exec $container psql -U $adminUser -d postgres -tAc "SELECT datname FROM pg_database WHERE datname='$testDatabase'"
  if ($LASTEXITCODE -ne 0 -or $exists) { throw 'Disposable target must not exist' }
  docker exec $container psql -U $adminUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE $testRole LOGIN PASSWORD '$testPassword'" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Cannot create disposable role' }
  $roleCreated = $true
  docker exec $container createdb -U $adminUser -O $testRole -T template0 $testDatabase
  if ($LASTEXITCODE -ne 0) { throw 'Cannot create disposable database' }
  $databaseCreated = $true
  $testUrl = "postgresql://${testRole}:${testPassword}@127.0.0.1:5432/${testDatabase}?schema=public"
  $urlVariables = @('DATABASE_URL', 'DE_W1_0B_DATABASE_URL', 'DE_W1_0C_DATABASE_URL', 'DE_W1_0D_DATABASE_URL', 'DE_W1_0E_DATABASE_URL', 'DE_W1_0F_DATABASE_URL', 'DE_W2_DATABASE_URL')
  $flags = @('BRAND_INTELLIGENCE_DATABASE_TEST', 'BRAND_INTELLIGENCE_EXECUTION_DATABASE_TEST', 'BRAND_INTELLIGENCE_PROJECTION_DATABASE_TEST', 'BRAND_COMMUNICATION_DATABASE_TEST', 'BRAND_MEANING_DATABASE_TEST', 'BRAND_CHARACTER_DATABASE_TEST', 'AUDIENCE_PERSONA_DATABASE_TEST', 'BRAND_DIFFERENTIATION_DATABASE_TEST', 'BRAND_CENTRE_DATABASE_TEST', 'GATEKEEPER_DATABASE_TEST')
  $savedEnvironment['DE_W2_MIGRATION_PHASE'] = $env:DE_W2_MIGRATION_PHASE
  foreach ($name in ($urlVariables + $flags)) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $(if ($urlVariables -contains $name) { $testUrl } else { 'true' }), 'Process')
  }
  node node_modules/prisma/build/index.js validate
  if ($LASTEXITCODE -ne 0) { throw 'Prisma validate failed' }
  $historical = @(Get-ChildItem -LiteralPath prisma/migrations -Directory | Where-Object { $_.Name -ne '20260826180000_data_extraction_wave2_supported_capabilities' })
  if ($historical.Count -ne 48 -or (Test-Path -LiteralPath $historicalRoot)) { throw 'Unexpected historical migration set or existing temporary path' }
  New-Item -ItemType Directory -Path (Join-Path $historicalRoot 'migrations') | Out-Null
  $historicalCreated = $true
  Copy-Item -LiteralPath prisma/schema.prisma -Destination (Join-Path $historicalRoot 'schema.prisma')
  Copy-Item -LiteralPath prisma/migrations/migration_lock.toml -Destination (Join-Path $historicalRoot 'migrations/migration_lock.toml')
  foreach ($directory in $historical) { Copy-Item -LiteralPath $directory.FullName -Destination (Join-Path $historicalRoot 'migrations') -Recurse }
  node node_modules/prisma/build/index.js migrate deploy --schema (Join-Path $historicalRoot 'schema.prisma')
  if ($LASTEXITCODE -ne 0) { throw 'Migration deploy failed' }
  $count = docker exec $container psql -U $adminUser -d $testDatabase -tAc 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
  if ([int]$count -ne 48) { throw "Expected all 48 existing migrations; got $count" }
  $env:DE_W2_MIGRATION_PHASE = 'UPGRADE'
  node node_modules/vitest/vitest.mjs run --config vitest.config.ts src/features/data-extraction/evidence/wave2-migration.postgres.test.ts --fileParallelism false --maxWorkers 1 --minWorkers 1 --testTimeout 30000 --hookTimeout 240000
  if ($LASTEXITCODE -ne 0) { throw 'Populated 48-to-49 upgrade/constraint verification failed' }
  $env:DE_W2_MIGRATION_PHASE = 'RESET'
  # Exact locally-created database above is the ONLY reset target.
  if ($env:DATABASE_URL -ne $testUrl -or $testDatabase -notmatch '^codex_de_w2_[a-f0-9]{12}$') { throw 'Reset target mismatch' }
  node node_modules/prisma/build/index.js migrate reset --force --skip-seed --skip-generate
  if ($LASTEXITCODE -ne 0) { throw 'Disposable reset/reapply failed' }
  $count = docker exec $container psql -U $adminUser -d $testDatabase -tAc 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
  if ([int]$count -ne 49) { throw 'Reset did not reapply all 49 migrations' }
  $testArguments = @('node_modules/vitest/vitest.mjs', 'run', '--config', 'scripts/de-wave2-vitest.config.ts', '--fileParallelism', 'false', '--maxWorkers', '1', '--minWorkers', '1', '--testTimeout', '30000', '--hookTimeout', '30000')
  if ($TestPath) { $testArguments += $TestPath }
  elseif (!$FullSuite) { $testArguments += @('src/features/data-extraction/evidence/normalization/wave2', 'src/features/data-extraction/evidence/wave2-migration.postgres.test.ts') }
  if ($ReportPath) { $testArguments += @('--reporter', 'default', '--reporter', 'json', '--outputFile', $ReportPath) }
  & node @testArguments
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
} finally {
  foreach ($name in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
  if ($databaseCreated) {
    $actual = docker exec $container psql -U $adminUser -d postgres -tAc "SELECT datname FROM pg_database WHERE datname='$testDatabase'"
    if ($actual.Trim() -eq $testDatabase -and $testDatabase -match '^codex_de_w2_[a-f0-9]{12}$') {
      docker exec $container dropdb -U $adminUser --force $testDatabase
      if ($LASTEXITCODE -ne 0) { throw 'Disposable database cleanup failed' }
      Write-Output "Removed disposable database $testDatabase (test fixtures only)."
    }
  }
  if ($roleCreated -and $testRole -match '^codex_de_w2_role_[a-f0-9]{12}$') {
    docker exec $container dropuser -U $adminUser $testRole
    if ($LASTEXITCODE -ne 0) { throw 'Disposable role cleanup failed' }
  }
  if ($historicalCreated) {
    $actualHistoricalRoot = (Resolve-Path -LiteralPath $historicalRoot).Path
    $expectedHistoricalRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) "codex-de-w2-$suffix"))
    if ($actualHistoricalRoot -ne $expectedHistoricalRoot -or (Split-Path -Leaf $actualHistoricalRoot) -notmatch '^codex-de-w2-[a-f0-9]{12}$') { throw 'Unsafe temporary migration-copy cleanup target' }
    Remove-Item -LiteralPath $actualHistoricalRoot -Recurse -Force
  }
}
