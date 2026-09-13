# Backup and restore

**Status:** TBD  
**Audience:** eng + product  
**Install:** procedures only until LIVE; there is little/nothing to restore on prod PLACEHOLDER

## Why this exists

Deploy and Monitor answer “is it up?” This file answers “can we get data back?” after mistake, corruption, or account incident.

## What we back up (by env)

| Env | Database | What AWS/SST typically provide | App/object data |
| --- | --- | --- | --- |
| **creator-dev** | Often manual RDS (`DEV_DATABASE_URL`) | Automated RDS backups / snapshots per instance settings — **confirm on next Auditor pass** | S3 `files-v2` / stage bucket — versioning/lifecycle TBD at harden pass |
| **creator-prod PLACEHOLDER** | None | n/a | Placeholder FE assets only — not customer DB |
| **creator-prod LIVE** | Aurora Serverless v2 (SST) | Aurora continuous backup / PITR within retention; manual snapshot before risky migrate | S3 files bucket — define versioning before real user uploads matter |

Never rely on “the laptop `.env` dump” or chat history as backup.

## RPO / RTO (design targets — Product may tighten later)

| | PLACEHOLDER | Early LIVE (design) | Later |
| --- | --- | --- | --- |
| **RPO** (how much data we can lose) | n/a | Accept up to backup/PITR window (confirm retention at go-live) | Tighten if finance/contracts require |
| **RTO** (how fast we are back) | n/a | Hours (restore + DNS + verify), not minutes | Improve with runbook drills |

Write the **actual** Aurora retention days into this file on LIVE install day.

## Allowed restore actions

| Action | Dev | Prod LIVE | Prod PLACEHOLDER |
| --- | --- | --- | --- |
| Snapshot / verify backup exists | Yes | Yes | n/a |
| Restore to **new** instance/cluster and cut over | Yes (disposable data OK) | Yes with Product | n/a |
| In-place destructive restore | Prefer avoid | **Product + written plan** | n/a |
| `prisma migrate reset` | Only if Product accepts wipe | **Forbidden** | n/a |

## Restore outline (LIVE)

1. Declare incident; freeze unrelated deploys.  
2. Prefer PITR / snapshot → **new** cluster when possible; keep broken cluster until verified.  
3. Point app `DATABASE_URL` / SST link only after connectivity + smoke (`/health/live`, login).  
4. Bastion/SSM for verification only as needed; stop bastion after.  
5. Record time, snapshot id, who approved, in `docs/aws-environments/` incident note.  
6. Email `brian@growthverse.in`.

## Pre-migrate snapshot (LIVE)

Before any reviewed `prisma migrate deploy` on prod: take/confirm a fresh usable snapshot (or rely on documented PITR coverage). Deploy charter owns migrate; this file owns the backup gate.

## Drills

- **Dev:** restore drill optional but useful once per quarter when ops workers are live.  
- **Prod:** first restore drill after LIVE has real data worth protecting (Product schedules).

## Out of scope here

- Secrets rotation (separate later if needed)  
- Cross-region replica (see `disaster-recovery.md` — currently single-region accept)
