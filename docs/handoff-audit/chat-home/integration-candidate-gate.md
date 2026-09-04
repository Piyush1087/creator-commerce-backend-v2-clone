# CHAT_HOME_V1_INTEGRATION_CANDIDATE — Gate Packet

**Authority:** `CHAT_HOME_V1_DEVELOPER_INTEGRATION_RELEASE_AUTHORITY_V1`  
**Handoffs (source of truth):** Developer Handoff + AI Worker Integration & Production Initiation (`c00aacaf…`)  
**Date:** 2026-09-04  
**Status vocabulary:** `PASS` / `FIXED` / `GENUINE_AUTHORITY_CONFLICT` / `ENVIRONMENT_BLOCKED`

This packet is the handoff §10 gate **before** merging into `development` or deploying.  
Production remains **blocked** until `PRODUCTION_RELEASE_AUTHORIZED` + exact SHAs.

---

## Canonical authority (unchanged)

| Role | SHA |
|------|-----|
| Product | `d69ba6b8cb331bfa36b450307d9defcd26d09c6e` |
| Backend runtime (accepted) | `00e1299ec2e97497bc6d81aeda808d6edd3b482a` |
| Frontend runtime (accepted) | `1cf2e3bd93425f60fb3d40692320078aea567794` |
| Handoff docs | `c00aacafb617e4d67643137359fd64bd9fc9424f` |

---

## Integration candidate SHAs

| Field | Value |
|-------|-------|
| `backend_integration_sha` | `695cc482296314b0e089f10b861ea7ca5641cfa0` |
| `frontend_integration_sha` | `251048074b46b1edf909a6d734c1f1b31ad5a040` |
| Branch (both) | `integration/chat-home-v1` |
| Base | `origin/development` (BE `2f03819` / FE `f4e6c49` at branch create) |
| `backend_development_final_sha` | **NOT_YET_MERGED** |
| `frontend_development_final_sha` | **NOT_YET_MERGED** |
| `force_push_used` | **NO** |
| `accepted_source_history_rewritten` | **NO** |

---

## Handoff §10 gate fields

| Field | Status | Notes |
|-------|--------|-------|
| `source_runtime_authority_preserved` | **PASS** / YES | Tips are descendants of `00e1299` / `1cf2e3b` |
| `product_semantics_changed` | **PASS** / NO | No EXECUTE / Creator Chat / streaming / agents / memory |
| `schema_changes_created_by_integration` | **PASS** / NO new Chat migrations | PI migrations preserved; duplicate Chat `120000` bs03/bs08 folders dropped in favor of origin `21000`/`22000` |
| `migration_history` | **PASS** | Local disposable rehearse: **74** migrations applied (`chat_home_integ` etc.) |
| `backend_build` | **PASS** | `nest build` |
| `backend_targeted` | **PASS** | Unit 152; self-seed postgres 8; workspace auth postgres 11 |
| `backend_full_suite` | **FAIL** (local) | 15 failed / 1209 passed; failures not Chat/Home suites — see test-results B8. Do **not** claim PASS |
| `frontend_targeted` | **PASS** | 105 Chat/Home scoped |
| `frontend_full_suite` | **FAIL** (local) | 23 failed / 816 passed; failing files are auth/onboarding/billing — see test-results F4 |
| `production_builds` | **PASS** | FE `npm run build`; BE nest build |
| `cross_brand_authorization` | **PASS** | Workspace auth unit + postgres |
| `p7_c1_boundary` | **PASS** | `resolveBrandProfileIdForWorkspace` vs activity-aware path |
| `breaker` | **NONE** | No Product/security authority conflict; Nest boot circular-dep **FIXED** with forwardRef |

### Named ENVIRONMENT_BLOCKED / open (not Product fails)

| Item | Class |
|------|-------|
| P5-A / P5-B postgres (no fixture dump) | **ENVIRONMENT_BLOCKED** — ran with flags ON |
| Intelligence contracts verify (dirty worktree) | **ENVIRONMENT_BLOCKED** |
| Authenticated local browser Home/Chat smoke | **ENVIRONMENT_BLOCKED** — unauth route smoke PASS; full UI needs Brand session |
| Dev/prod deploy smoke | **NOT RUN** — hold until merge + deploy auth |

Evidence detail: [`integration-part1-report.md`](./integration-part1-report.md), [`integration-part1-test-results.md`](./integration-part1-test-results.md).

---

## Operational debt from mail (Part B / release)

| Debt | Status now | Next |
|------|------------|------|
| Reconcile into divergent `development` | **Pending** — candidate ready, **not merged** | Needs `INTEGRATION_MERGE_AUTHORIZED` |
| Validate migration history vs **target** envs (dev/prod RDS) | Local disposable **PASS**; target env **not yet** | After merge: review pending set before/on ECS migrate |
| Deployed backend `GEMINI_MODEL=gemini-3.5-flash` | Local `.env` + SST default set; **dev ECS not verified** | D0/D1: confirm SST/ECS env explicitly |

Deferred Product (out of this authority): Creator Chat, EXECUTE Chat, provider actions, agents, personal/vector memory, streaming.

---

## D0 — Dev release preflight (readiness, not deploy)

| Check | Status |
|-------|--------|
| Deploy identity BE | SST `creatorshop-be`, `ap-south-1`, profile `creator-dev`, API `https://api.dev.thecreatorshop.in`, health `/health/live` |
| Deploy identity FE | SST `creatorshop-fe`, dashboard `https://dashboard.dev.thecreatorshop.in` |
| Runbook | [`docs/deployment/README.md`](../../deployment/README.md) — deploy from **WSL**, not `/mnt/c/` |
| `GEMINI_MODEL` | Must be explicit `gemini-3.5-flash` on deployed task (local `.env` already; SST fallback now `gemini-3.5-flash`) |
| `GEMINI_API_KEY` | Server-side only; not in FE/git |
| Pending migrations on tip | **74** folders; PI three preserved; C-01’s 8 migrations **not** on this branch |
| C-01/C-05 | Still on `feature/c01-c05-creator-integration` — separate; do not mix into this deploy without its own merge |

---

## Required human authorizations (stop here)

1. **`INTEGRATION_MERGE_AUTHORIZED`** — merge/PR `integration/chat-home-v1` → `development` (origin). Freeze resulting `development` SHAs as **dev release candidates**.  
2. **`DEV_DEPLOY_AUTHORIZED`** — then D1 backend `sst deploy --stage dev`, D2 smoke, D3 frontend deploy.  
3. **`PRODUCTION_RELEASE_AUTHORIZED`** + exact SHAs — Part C only; **not** implied by this packet.

Without (1)/(2), do **not** merge or deploy.
