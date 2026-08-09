# Brand Onboarding (Backend)

Engineering index for discovery → surface intelligence → verification.

## Start here

1. **[CURRENT_STATE.md](./CURRENT_STATE.md)** — what is implemented today (source of truth vs stale Change Docs).
2. **[GAPS_AND_DECISIONS.md](./GAPS_AND_DECISIONS.md)** — locked product decisions and open gaps.
3. **[MANUAL_TEST_MATRIX.md](./MANUAL_TEST_MATRIX.md)** — manual QA checklist.

## Operational docs

- [ENTRY_RESOLVER.md](./ENTRY_RESOLVER.md) — `POST /discovery/resolve` before validate.
- [AI_GUARDRAILS.md](./AI_GUARDRAILS.md) — Parallel + Gemini safety / hygiene.
- [S3_ASSETS.md](./S3_ASSETS.md) — logo and asset mirroring.
- [BRAND_AUTH.md](./BRAND_AUTH.md) — brand auth notes.
- [VERIFICATION_OTP_TOGGLE.md](./VERIFICATION_OTP_TOGGLE.md) — stub OTP vs real email.

## Product history (not engineering truth)

`product-team-docs/` holds phase Change Docs and older step dumps. Use them for intent; if they conflict with CURRENT_STATE or code, prefer CURRENT_STATE + code.

## Archived

Superseded engineering dumps live in [`_archive/`](./_archive/) (tracking logs, old gate/test docs, prior schema comparison, old surface-scan cheat sheet).

## Frontend

v2 feature module: `creator-commerce-frontend-v2/src/features/brand-onboarding`.
