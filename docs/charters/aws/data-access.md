# Data access (overview)

**Status:** TBD — **overview only**  
**Deeper follow-up:** later expand into its own file (data classes, retention, who may export, PII handling). This page is the standing access picture.

## What “data” means here

| Class (coarse) | Examples | Where it lives |
| --- | --- | --- |
| **Platform config** | SST state, cert ARNs, non-secret ids | AWS + Git docs |
| **Secrets** | DB passwords, JWT peppers, provider keys | Secrets Manager / env — **not Git** |
| **Application DB** | Users, brands, campaigns, etc. | RDS (dev) / Aurora (LIVE) |
| **Object files** | Uploads | S3 stage buckets |
| **Logs** | Request/error logs | CloudWatch (see `logging-and-tracing.md`) |

Finer classification (PII tiers, finance, etc.) waits for the deeper file.

## How humans reach the database

| Env | Path | Notes |
| --- | --- | --- |
| Local | Local Postgres / docker | Dev only |
| creator-dev | Often SSM jumpbox / tunnel scripts (`db:tunnel:dev` style) | Stop jumpbox when done |
| creator-prod PLACEHOLDER | **No DB** | Nothing to tunnel |
| creator-prod LIVE | SST **bastion** + SSM (designed) | For migrate/verify — not day-to-day app access |

**Never** expose Postgres ports to `0.0.0.0/0`. App talks to DB inside the VPC.

## Standing rules (now)

1. Production data is not for casual exploration — use dev or anonymized exports if Product allows.  
2. Bastion/jumpbox **on only while needed**, then stop (Cost alarm `BASTION-ON` when installed).  
3. Prefer `prisma migrate deploy` with review on LIVE; **`migrate reset` forbidden on prod**.  
4. Do not copy prod dumps to laptops without Product rules (deeper file will spell this out).  
5. Workers: no secret values in Markdown; TemplateIds and ARNs are OK.

## App vs human access

| Actor | Access |
| --- | --- |
| ECS task | `DATABASE_URL` / linked Aurora credentials |
| Bastion user | Temporary, audited SSO user |
| Frontend users | Only via API auth — never direct DB |

## Related

- Backups: `backup-and-restore.md`  
- IAM overview: `iam-and-sso.md`  
- Migrate flags: `sst.config.ts` + Deploy charter  
