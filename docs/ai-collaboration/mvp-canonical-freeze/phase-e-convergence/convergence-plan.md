# Canonical convergence plan (§12)

**Date:** 2026-09-08  
**This freeze does not pull deferred accepted modules.**

## Starting SHAs (evidence only)

```text
ORIGIN_DEVELOPMENT_FRONTEND = c83ab8bab02ace8872a53de81cc8ffe79ccda832
ORIGIN_DEVELOPMENT_BACKEND  = cd446fb4bd356fe03faf16c6c7a282a55cebcf08
```

Target branches (all three repos):

```text
freeze/mvp-canonical-application-v1
```

## Ordering for this freeze

```text
accepted modules already in origin/development
        ↓
shared-platform retain
        ↓
hide OUT/DEFERRED product chrome (RUN 1)
        ↓
coverage / invariants / prisma / security / env registers (RUN 2 docs)
        ↓
validation gate (RUN 3) — not yet
        ↓
MVP_CANONICAL_APPLICATION_FREEZE_V1 — not yet
```

## Allowed this freeze

- Registers and evidence docs in `docs/.../mvp-canonical-freeze/`
- Hide/unwire **product chrome** for OUT surfaces (already done RUN 1)
- Prisma/schema audit without dropping Co-Pilot tables
- Security/env/provider name registers
- Local validation on freeze branches

## Forbidden this freeze

- Pull C-02A, C-04, or Brand Payouts v1
- Merge freeze branches into `development`/`main`
- AWS / IAM / VPC / RDS / ECS / secret injection
- Force-push
- Destructive production migrations
- Treating old `src/features/brand-payouts` as Brand Payouts v1

## Shared files likely to collide (only if a later amendment pulls deferred modules)

- `src/app.module.ts`
- Prisma schema + migrations
- FE `app-routes.tsx` `sidebar-items.ts` `bottom-nav-items.ts`
- Collaboration workspace / C-04 creator surfaces
- Payout/escrow settings vs Brand Payouts v1

## STOP conditions

Charter §19 circuit breakers. Parent Product decision already resolved deferred/out locks; do not reopen them.

## Rollback / reset points

| Point | SHA |
| --- | --- |
| origin/development snapshot FE | `c83ab8bab02ace8872a53de81cc8ffe79ccda832` |
| origin/development snapshot BE | `cd446fb4bd356fe03faf16c6c7a282a55cebcf08` |
| RUN 1 freeze FE | `71fe273e9a4d84b868dc7511d606e1109f2d566e` |
| RUN 1 freeze BE | `13a1dedc0ead8eef24a27c48067364258119b0fc` |
| RUN 1 freeze dummy_tcs | `f6378bc1f26ed51a7cb797e3888cb1140bffbed9` |
