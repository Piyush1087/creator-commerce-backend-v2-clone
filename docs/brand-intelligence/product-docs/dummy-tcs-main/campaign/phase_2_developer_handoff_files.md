# Campaign Module Phase 2 — Bucket A Developer Handoff File List

**Status:** PHASE 2 BUCKET A HANDOFF  
**Scope:** Phase 2A–2C changes made in `dummy_tcs` before production reconciliation.  
**Use:** The developer already has an older repository copy. Use current `dummy_tcs/main` as the reference source for the files below. This is a selective migration list, not an instruction to copy the staging application wholesale into production.

## 1. REPLACE / ADAPT FROM CURRENT `dummy_tcs/main`

These files contain architecture/state correctness changes that should be carried into the production merge or used as the authoritative implementation reference.

### Campaign read/query logic

- `backend/campaign/query/CampaignQueryService.ts`
- `backend/campaign/query/CampaignQueryService.test.ts`

Important Phase 2A behavior carried by these files:

- Campaign header Product count is based on ACTIVE Campaign Assets.
- Campaign header Brief count is based on PUBLISHED Briefs under ACTIVE Campaign Assets.
- Published Product Setup / Brief Setup hide operational workspaces and disable Share.
- PAUSED keeps eligible existing workspace context and Reporting available while Share is disabled.
- `LIVE + executionReady=false` remains LIVE and uses the post-live readiness blocking condition rather than falling through to Draft.
- Applicant terminal status is re-read from authoritative shared state.

### Campaign frontend state/capability behavior

- `frontend/staging/campaign-scaffold/src/features/campaign/CampaignPage.tsx`
- `frontend/staging/campaign-scaffold/src/features/campaign/components/CampaignHeader.tsx`

Important Phase 2A behavior carried by these files:

- user-selected workspace is preserved across authoritative refresh while it remains valid;
- workspace rendering follows supplied `workspaces[].visible` / capability projection;
- Campaign header actions follow supplied `ENABLED`, `DISABLED`, and `HIDDEN` capability presentation instead of inferring lifecycle permissions locally.

These React files are reference implementations. During production integration, preserve their state/capability semantics while adapting them to the real production shell/components.

## 2. STAGING-ONLY FILES — KEEP AS DEV/TEST REFERENCE, DO NOT SHIP AS PRODUCT UI

Phase 2B moved deterministic scenarios out of the Campaign feature boundary and into an explicit staging-only area.

If maintaining the reference/staging package, add/use:

- `frontend/staging/campaign-scaffold/src/staging/scenarioFixtures.ts`
- `frontend/staging/campaign-scaffold/src/staging/scenarioReadAdapter.ts`
- `frontend/staging/campaign-scaffold/src/staging/scenarioReadAdapter.test.ts`

Also use the current versions of:

- `frontend/staging/campaign-scaffold/src/app/App.tsx`
- `frontend/staging/campaign-scaffold/src/features/campaign/readAdapter.ts`

Production rule:

- `src/staging/**` is development/test tooling only;
- deterministic scenario fixtures must not become production domain behavior;
- normal product execution must use the production read/command/API boundary rather than scenario adapters.

## 3. DELETE / DO NOT CARRY FORWARD

The following older staging files were removed because scenario/mock behavior no longer belongs inside the production-shaped Campaign feature folder:

- `frontend/staging/campaign-scaffold/src/features/campaign/scenarios.ts`
- `frontend/staging/campaign-scaffold/src/features/campaign/readAdapter.test.ts`

If these files exist in an intermediate developer copy of the staging scaffold, remove them rather than merging their contents back into the Campaign feature.

## 4. TEST / TOOLCHAIN FILES — REFERENCE PACKAGE ONLY

Current Phase 2C repository changes:

- `frontend/staging/campaign-scaffold/package.json`
- `frontend/staging/campaign-scaffold/vite.config.ts`

The current manifest intentionally pins:

- `typescript` = `5.9.3`
- `typescript-eslint` = `8.66.0`

It also exposes a focused Campaign schema-test command, and Vitest discovery includes Campaign backend/query and validation tests.

### Known deferred Phase 2C limitation

Do **not** treat the current staging package dependency setup as a production dependency authority.

Phase 2C could not finish a clean pnpm install inside the Codex sandbox because the install exceeded the execution timeout while recreating `node_modules`.

Therefore:

- no generated `pnpm-lock.yaml` from that interrupted run was published;
- remaining `latest` dependencies were not safely pinned from a proven clean install;
- frozen-lockfile reproduction was not completed;
- final lint/test/build verification against that finalized dependency graph remains a developer/local-environment task.

During production merge, use the production repository's existing package manager and dependency conventions. If retaining this isolated staging package, complete its reproducibility work in a normal local environment rather than transplanting its package versions into production automatically.

## 5. DO NOT REPLACE IN PRODUCTION JUST BECAUSE PHASE 2 TOUCHED THE STAGING SCAFFOLD

Do not wholesale copy or replace production versions of:

- application shell/navigation;
- shared Design System components;
- production routing;
- auth/session/API transport;
- existing good Create Campaign UI;
- existing good Add Product drawer;
- existing good Add Brief workflow;
- production persistence repositories;
- production package/dependency setup.

These are Phase 3 production-reconciliation inputs and should be classified KEEP / ADAPT / REPLACE before migration.

## 6. PHASE 2 STATUS

- **2A — Logic/state correctness:** complete with known runtime-verification limitation caused by Codex environment access; no architecture conflict found.
- **2B — Scenario/staging boundary cleanup:** complete.
- **2C — Test/toolchain merge safety:** repository/config cleanup complete enough for handoff, but dependency reproducibility finalization is deferred to a normal developer/production environment.

No Campaign product/domain blocker remains before Phase 3 production reconnaissance.

## 7. RELATION TO PHASE 1 HANDOFF

This Phase 2 file list is additive to:

- `campaign/phase_1_developer_handoff_files.md`

The developer should apply/reconcile the Phase 1 Campaign-module contract delta first, then the Phase 2 Bucket A delta above, before making production-specific KEEP / ADAPT / REPLACE decisions.
