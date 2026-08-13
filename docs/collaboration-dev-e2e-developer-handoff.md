# Collaboration Dev E2E Developer Handoff

## 1. Purpose

Prepare the private dev PostgreSQL database and developer-controlled deployment repositories for a reviewed Collaboration E2E release. Codex did not connect to PostgreSQL, run migrations, deploy, seed, start EC2, or mutate AWS.

No PostgreSQL listener or existing tunnel was active on local ports 5432 or 5435. The private database therefore could not be inspected without the developer starting the stopped jumpbox, which is outside Codex authority.

## 2. Frozen source commits

- Backend: `8fcbd75228023a0ee5b41a084959fd10c71f3568`
- Frontend: `88fbfb10db7a0e94035f36d65d50722a1b88158c`

Development GitHub does not deploy to AWS. Review and reconcile these commits into the appropriate production/deployment repositories, preserving commit traceability.

## 3. Database prerequisites

After establishing developer-authorized access, begin with a read-only transaction:

```sql
BEGIN TRANSACTION READ ONLY;

SELECT migration_name, started_at, finished_at, rolled_back_at,
       logs IS NOT NULL AS has_logs
FROM _prisma_migrations
WHERE migration_name IN (
  '20260810180000_collaboration_phase_1_foundation',
  '20260810193000_collaboration_phase_3_commercial_commands',
  '20260810213000_collaboration_phase_3_1_financial_boundary',
  '20260810233000_collaboration_phase_4_1_fulfillment',
  '20260811013000_collaboration_phase_4_2_production',
  '20260811143000_collaboration_phase_4_4_publishing',
  '20260811180000_collaboration_phase_4_6_settlement',
  '20260812190000_collaboration_phase_4_7_feedback'
)
ORDER BY migration_name;

COMMIT;
```

Classify absent rows as pending, rows with `finished_at` as applied, and unfinished/non-rolled-back rows as failed or partial.

If `collaboration_events` exists, check the proposed Phase 3 unique index:

```sql
BEGIN TRANSACTION READ ONLY;

SELECT COUNT(*) AS duplicate_group_count,
       COUNT(DISTINCT collaboration_id) AS affected_collaboration_count
FROM (
  SELECT collaboration_id, aggregate_version
  FROM collaboration_events
  GROUP BY collaboration_id, aggregate_version
  HAVING COUNT(*) > 1
) conflicts;

COMMIT;
```

Check Phase 1 index and campaign/creator semantics:

```sql
BEGIN TRANSACTION READ ONLY;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'collaborations'
  AND indexname = 'collaborations_campaign_id_creator_id_key';

SELECT COUNT(*) AS duplicate_group_count,
       COALESCE(SUM(row_count - 1), 0) AS duplicate_rows_beyond_first
FROM (
  SELECT campaign_id, creator_id, COUNT(*) AS row_count
  FROM collaborations
  GROUP BY campaign_id, creator_id
  HAVING COUNT(*) > 1
) duplicates;

COMMIT;
```

After confirming relevant tables/columns exist, collect aggregate inventory only:

```sql
BEGIN TRANSACTION READ ONLY;

SELECT COUNT(*) AS total_collaborations,
       COUNT(*) FILTER (WHERE source_application_id IS NOT NULL) AS application_origin_rows,
       COUNT(*) FILTER (WHERE source_application_id IS NULL) AS legacy_rows
FROM collaborations;

SELECT COUNT(*) AS collaboration_event_count FROM collaboration_events;

SELECT (SELECT COUNT(*) FROM collaboration_execution_snapshots) AS execution_snapshot_count,
       (SELECT COUNT(*) FROM collaboration_commercial_agreements) AS commercial_agreement_count,
       (SELECT COUNT(*) FROM collaboration_fulfillments) AS fulfillment_count;

SELECT COUNT(*) AS normalized_deliverable_count FROM uce_brief_deliverables;

COMMIT;
```

Identify briefs/campaigns with legacy JSON deliverables but no normalized `uce_brief_deliverables`. Reconcile those through a separately reviewed backfill before canonical flows. Do not infer `publishing_required` automatically.

## 4. AWS actions

Codex must not execute these actions. The developer must:

1. Confirm profile `creator-dev` resolves to account `841162679642`.
2. Start `temp-dev-db-ssm-jump` (`i-03447f2aba0c94173`) through the approved process.
3. Open the documented SSM tunnel from local port 5435 to the RDS endpoint on 5432.
4. Run the read-only checks above without exposing credentials or user-level data.
5. Close the tunnel and stop the jumpbox when finished.
6. Confirm an approved recovery point before migration. Snapshot creation is a separately authorized AWS mutation.

No VPC, RDS, security-group, ALB, DNS, IAM, certificate, or other infrastructure change is expected. Review `npx sst diff --stage dev` and stop on unexpected changes.

## 5. Backend deployment

The current dev task has `RUN_MIGRATIONS_ON_START=true`; a new task runs `npx prisma migrate deploy` before application startup.

Developer sequence:

1. Reconcile the frozen backend into the deployment repository.
2. Verify the exact deployment commit and clean worktree.
3. Run dependency installation, Prisma generation, build, lint, and Collaboration tests.
4. Review all eight migrations and `npx sst diff --stage dev`.
5. Choose explicitly between automatic migration-on-start and a separately controlled migration. Do not allow both.
6. Confirm the recovery point.
7. Deploy through the developer-controlled workflow.
8. Wait for migration completion, ECS steady state, and healthy ALB targets.

Normal command after authorization:

```bash
export AWS_PROFILE=creator-dev
export SST_SKIP_DEPENDENCY_CHECK=1
npx sst deploy --stage dev --print-logs
```

## 6. Frontend deployment

After the compatible backend is healthy:

1. Reconcile the frozen frontend into the deployment repository.
2. Verify environment configuration, build, typecheck, lint, and exact commit.
3. Review `npx sst diff --stage dev`.
4. Deploy using the developer-controlled workflow.
5. Confirm S3 asset update, CloudFront deployment/invalidation, and the public dev dashboard.

## 7. Verification

```powershell
aws sts get-caller-identity --profile creator-dev

aws ecs describe-services --profile creator-dev --region ap-south-1 `
  --cluster creatorshop-be-dev-apiclusterCluster --services api

aws elbv2 describe-target-health --profile creator-dev --region ap-south-1 `
  --target-group-arn arn:aws:elasticloadbalancing:ap-south-1:841162679642:targetgroup/HTTP2025040912071865310000000a/21fff32859398d1a

aws logs filter-log-events --profile creator-dev --region ap-south-1 `
  --log-group-name "/sst/cluster/creatorshop-be-dev-apiclusterCluster/api/api" `
  --filter-pattern '"prisma migrate deploy complete"'

curl.exe https://api.dev.thecreatorshop.in/health/live

aws cloudfront get-distribution --profile creator-dev --id ERY7ZCWYGFI7B

aws s3api head-object --profile creator-dev `
  --bucket creatorshop-fe-dev-reactappassets-caztffes --key index.html
```

Re-run `prisma migrate status` through the approved tunnel, then verify Collaboration flows using isolated test identities.

## 8. Rollback considerations

- ECS application rollback does not roll back database migrations.
- Phase 1 intentionally removes campaign/creator uniqueness; restoring it requires a new reviewed migration.
- Never delete migration rows or edit `_prisma_migrations` manually.
- Use `prisma migrate resolve` only after diagnosis and explicit approval.
- Frontend rollback requires redeploying a known prior artifact; do not assume S3 versioning.

## 9. E2E fixture preparation

1. Confirm all eight migrations are applied successfully.
2. Confirm no aggregate-version conflicts.
3. Normalize the brief deliverables required by the test flow.
4. Exclude unreconciled legacy rows from fixtures.
5. Create isolated Brand, Creator, campaign, application, brief, deliverable, commercial, and execution fixtures through an approved workflow.
6. Use unique identifiers and a documented cleanup procedure.
7. Confirm payment, email, and external integrations are safely stubbed or approved for dev.
8. Record backend/frontend deployment lineage before acceptance starts.

## 10. STOP conditions

Stop if:

- the AWS account is not `841162679642`;
- SST proposes unexpected infrastructure changes;
- a migration is failed/partial or ordered differently;
- aggregate-version duplicates exist;
- migration needs unreviewed repair/destructive SQL;
- required legacy or JSON-only records are unreconciled;
- no approved recovery point exists;
- backend migration/startup or health checks fail;
- secrets appear in logs, diffs, commits, or handoff material.
