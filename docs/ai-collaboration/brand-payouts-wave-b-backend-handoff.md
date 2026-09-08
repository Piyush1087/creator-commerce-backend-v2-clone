# Brand Payouts Wave B backend implementation handoff

Status: `COMPLETE`

This handoff records the bounded local execution of `BRAND_PAYOUTS_WAVE_B_COHERENT_BACKEND_EXECUTION_RUNNER_V1`. It does not authorize or perform a canonical merge, deployment, provider action, production/AWS action, frontend Wave C, P3S, P4R/P5R, or provider-enabled P6.

## Immutable binding

- Branch: `brand-payouts/wave-b-backend-v1`
- Accepted C04 base: `ec395bf5760b295dddd9c3f7e9c2f05485b6b743`
- Accepted C04 tree: `69381dd46e05ce3cf9823ccd6754e6b303dbaa2d`
- Reconverged P4 Base: `a49e24e150d679ced65adea5a8ffe9b5245fb4cc`
- Reconverged P4 Base tree: `271f59d099f31694c04f300c341a3b75654969d6`
- Wave B source checkpoint: `e9af2a5a45dda68fa3ea3498855d1438d8c717aa`
- Wave B source checkpoint tree: `c0fbf69a395eedfd27738590b567fdfed1634241`
- Migration identity: `20260912100000_brand_payouts_wave_b_normal_path`
- Migration SQL SHA-256: `887e5bb6bd262a4dd02e42a798db55bd136d97bf6a923df7e6466573f11d1f84`
- Migration count: 86

C04 is an ancestor of both the reconverged marker and Wave B source checkpoint. The first 85 migration paths are unchanged relative to C04; migration 86 is the only migration delta.

## Delivered normal path

P4A consumes an exact current C04 reserve instruction. Owner and Finance Admin are admitted through the canonical Brand membership boundary; Campaign Manager remains read-only. Approval and execution preserve immutable requester/approver tuples and server-owned amounts. PostgreSQL advisory locks, serializable transactions, unique identities, and bounded serialization retry enforce one reserve effect. A shortfall records `AWAITING_FUNDS` without a lock, ledger row, or funding allocation.

P4B accepts only a current C04 `CREATOR_ENTITLEMENT` with canonical protected-funding confirmation. It persists exact authority hashes/versions, derives NET_7/15/30/45/60 due instants using the Asia/Kolkata calendar rule, rejects all other terms including IMMEDIATE, and allocates exact proven-source funding lineage. Legacy rows remain explicitly unreconciled; no inferred financial backfill exists.

P5A separates obligation intake, transfer creation, provider observation, and settlement. Claiming fences the current Creator-owned C05 destination ID/version/provider mapping and supports only India/INR/bank. Production dependency injection selects a fail-closed provider which exposes no SDK/client and cannot create, read, or reverse a provider transfer. The deterministic provider exists only inside the PostgreSQL test. Settlement consumes the exact Creator funding allocation, writes one canonical ledger effect, and appends immutable receipts.

No TDS calculation, display, or export was introduced.

## Terminal proof

- Focused contract/security suite: 7 files passed, 65 tests passed, 5 existing environment-gated tests skipped.
- Wave B disposable PostgreSQL suite: 3 tests passed. It covers concurrent same-command replay, changed-command conflict, one reserve/approval/effect, shortfall rollback, Campaign Manager denial, cross-Brand non-enumeration, exact C04 obligation intake/replay, provider-disabled acceptance, exact C05 snapshot, deterministic create/replay/settlement, one settlement ledger effect, and immutable transfer/receipt guards.
- Full backend suite on final runtime composition: 207 files passed; 6,302 tests passed; 57 files and 779 tests skipped by their existing opt-in database flags; zero failures.
- Prisma format, validate, and generate passed.
- Scoped ESLint over all Wave B/touched runtime files passed. Repository-wide ESLint remains red on 1,065 inherited Prettier/CRLF findings outside this change; no Wave B lint finding remains.
- TypeScript/Nest build passed.
- Built `dist/main.js` AppModule started with provider credentials absent against disposable loopback PostgreSQL, mapped `POST /api/v1/brand/payouts/reserve-approvals`, returned HTTP 200 from `/`, returned database `up` from `/health`, and stopped through Ctrl+C.
- Fresh 0→86 deploy passed.
- Populated 0→85 C04 deploy plus accepted C04 runtime population, followed by 85→86 deploy, passed; eight populated collaborations remained and migration status reported 86/86.
- Production provider-disabled PostgreSQL path called capability inspection once, created zero transfer attempts, and called create/read/reversal zero times.
- Static scan found no provider SDK/client import in the new Brand Payouts services and no credential material in the migration/runtime delta.

## Runtime lifecycle and safety

All database work used the owned `postgres:16-alpine` container `wave-b-backend-v1-postgres`, bound only to `127.0.0.1:55489`, with UTC and disposable databases. The container and volumes were deleted at terminal cleanup. No provider, production, AWS, shared, or non-disposable database mutation occurred.

## Residual and deferred scope

There is no Wave B blocker. Provider availability remains intentionally unavailable in production until provider-enabled P6 receives separate authority. Frontend Wave C, support/P3S, generalized P4R/P5R recovery, provider-enabled P6, canonical merge, and deployment remain deferred.

The compact decision register and machine-readable proof summary are in `docs/ai-collaboration/evidence/brand-payouts-wave-b-backend-v1/`.
