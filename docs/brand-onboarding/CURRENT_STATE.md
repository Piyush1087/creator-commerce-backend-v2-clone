# Brand Onboarding — Current State

**Last updated:** 2026-07-16  
**Source of truth:** this file + code under `src/features/brand-onboarding`.  
When product Change Docs conflict with this file, treat **code + CURRENT_STATE** as engineering truth.

## Journey (what ships today)

| Stage | What happens | Primary APIs / routes |
| --- | --- | --- |
| Landing / discovery | URL normalize, hard blocklist, reachability probe, Gatekeeper classify, lead create | `POST /discovery/resolve`, `validate`, `waitlist` · FE `/` |
| Stage 1A | Homepage acquisition (Zyte + Playwright), core identity merge, scan row | `POST /brand/surface-scan`, progress + core-identity GETs · FE `/brand/onboarding/scan` → `/core-identity` |
| Checkpoint 1 | Confirm editable identity fields; enqueue Stage 1B job | `POST .../confirm-identity/:leadId` |
| Wait | Poll until Brand DNA archived (or failed) | `GET .../intelligence/:leadId` · FE `/brand/onboarding/intelligence-scan` |
| Stage 1B → Prompt A | Durable DB job → context package → Brand DNA (temp 0.1) → soft-fill validate → profile merge | Worker claims `BrandIntelligenceJob` |
| Brand DNA UI | Review merged DNA (incl. `brand_narrative`) | FE `/brand/onboarding/dna` |
| Checkpoint 2 scaffold | DNA + empty offerings/competitors; confirm persists JSON | `GET/POST .../checkpoint-2/:leadId` |
| Catalogue / competitors | Existing profile PATCH APIs (not Prompt B/C yet) | FE catalogue / competitors |
| Verification | OTP (stub or real per env toggle) | verification send/verify |
| Pricing / social | FE shells | deferred deep intel |

## Locked product decisions (implemented)

- **Hard blocks:** government/military/suspicious TLDs, marketplaces, social platforms, `.edu`, **`.ac.in`**. Gambling / Adult / Fraud → **blocked** (not waitlist).
- **Gates 8–9** (parked/unreadable, foreign language): waitlist UI; persist email with **reason + domain**; **no outbound mail**.
- **`adminEmail`:** masked (e.g. `a***@domain.com`) on claimed/resolve responses.
- **Checkpoint 1:** website / country / currency **read-only**; editable = name, logo, industry, sub-industry, tagline, socials.
- **Industry enums:** aliases normalized (e.g. `D2C_ECOMMERCE` → `D2C`).
- **Reachability** runs **before** Gatekeeper on validate path; infra failures → `infrastructure_error` + retry UX.
- **Post-confirm:** DB-backed **`BrandIntelligenceJob`** queue (not fire-and-forget only); FE waits on intelligence-scan before DNA.
- **Prompt A:** temperature **0.1**, Flash; evidence mandatory with **soft-fill** so archive does not hard-break; **all** DNA fields merged into profile; narrative shown in Additional data.
- **Checkpoint 2:** API scaffold only; offerings/competitors arrays empty until Prompt B/C.

## Deferred (do not implement unless asked)

- State H / full waitlist UX / outbound waitlist or invite email.
- Shimmer skeleton on wait page.
- Prompt B (Offerings) / Prompt C (Competitors) and Checkpoint 2 UI.
- Deep scan / Meta / Similarweb / Parallel re-enable.
- Production Stage 1A hardening (warm browser, concurrency cap, hedged Playwright, restored timeouts) — see [GAPS_AND_DECISIONS.md](./GAPS_AND_DECISIONS.md).

## Key modules

```text
src/features/brand-onboarding/
  brand-onboarding.controller.ts   # discovery resolve/validate/waitlist
  brand.controller.ts              # surface-scan, intelligence, checkpoint-2, profiles
  discovery-reachability.service.ts
  brand-intelligence-job.service.ts
  brand-intelligence-worker.service.ts
  surface-scan/stage1a/
  surface-scan/stage1b/
  surface-scan/stage2/             # Brand DNA engine, validation, merge
  surface-scan/checkpoint2/
  prompts/surface/brand_dna/
```

## Prisma models (onboarding-relevant)

- `DiscoveryLead`, `BrandProfile`, waitlist rows with `reason` / `domain`
- `BrandIntelligenceScan` (+ stages through `CHECKPOINT_2_CONFIRMED`, DNA snapshots, checkpoint2 confirmation JSON)
- `BrandIntelligenceJob` (durable Stage 1B pipeline)

Migrations: apply with `npm run db:migrate:deploy` then `npm run prisma:generate` (prefer deploy over shadow-DB `migrate dev` when the DB is already provisioned).

## Frontend (v2)

Feature: `creator-commerce-frontend-v2/src/features/brand-onboarding`  
Routes: landing → scan → core-identity → **intelligence-scan** → dna → catalogue → competitors → verification → …

## Docs map

| Doc | Role |
| --- | --- |
| [README.md](./README.md) | Index |
| **CURRENT_STATE.md** | What is live |
| [GAPS_AND_DECISIONS.md](./GAPS_AND_DECISIONS.md) | Gaps + locked decisions |
| [MANUAL_TEST_MATRIX.md](./MANUAL_TEST_MATRIX.md) | Manual QA |
| [ENTRY_RESOLVER.md](./ENTRY_RESOLVER.md), [AI_GUARDRAILS.md](./AI_GUARDRAILS.md), [S3_ASSETS.md](./S3_ASSETS.md), [BRAND_AUTH.md](./BRAND_AUTH.md), [VERIFICATION_OTP_TOGGLE.md](./VERIFICATION_OTP_TOGGLE.md) | Operational |
| `product-team-docs/` | Historical product source (phases, change docs) |
| `_archive/` | Superseded engineering dumps |
