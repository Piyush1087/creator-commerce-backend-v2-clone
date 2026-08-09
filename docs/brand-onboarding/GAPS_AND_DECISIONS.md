# Brand Onboarding — Gaps and Decisions

**Last updated:** 2026-07-16  
Companion to [CURRENT_STATE.md](./CURRENT_STATE.md). Product Change Docs under `product-team-docs/` are historical; prefer this file for open engineering work.

## Locked decisions (do not re-litigate)

| Topic | Decision |
| --- | --- |
| `.ac.in` | Hard block (with `.edu`). Not waitlist. |
| Gambling / Adult / Fraud | **Blocked**, not waitlist. |
| Gate 8 parked/unreadable, Gate 9 foreign language | Waitlist-style UI; store email + **reason** + **domain**; **no mail send**. |
| Claimed brand `adminEmail` | **Mask** (e.g. `a***@domain.com`). |
| Checkpoint 1 fields | Country / currency / website **read-only**; name, logo, industry, sub-industry, tagline, socials editable. |
| Wait / DNA UX | No shimmer skeleton; post-confirm → intelligence-scan wait page → DNA when archived. |
| Prompt A | Temperature **0.1**, Flash; evidence required; **soft-fill** citations on archive path; merge **all** DNA fields including `brand_narrative`. |
| Stage 1B dispatch | **DB durable queue** (`BrandIntelligenceJob` + interval worker). |
| Checkpoint 2 | Backend scaffold only until Prompt B/C; empty offerings/competitors. |
| State H / outbound waitlist & invite mail | Deferred (docs only). |

## Open gaps

### Landing / Gatekeeper

- Waitlist and workspace-invite **email delivery** still deferred.
- Stage 0 still primarily URL/hostname evidence; no hard minimum-confidence reject for “supported but weak” classifications.
- Stage 0 vs Stage 1A industry reconciliation when later evidence conflicts.
- Hard-block lists duplicated FE + BE (BE authoritative); no shared generated policy package.
- Registrable-domain / redirect comparison is heuristic, not Public Suffix List.
- `edu.in` policy not separately decided (`.edu` and `.ac.in` are blocked).

### Stage 1A (production hardening — agreed direction)

Feasibility mode today: concurrent Zyte + Playwright, limited orchestrator timeouts. Before production scale:

1. Warm Chromium + per-scan context (not launch-per-scan).
2. Concurrency semaphore (~3–5 Playwright contexts).
3. Hedged Playwright (delay start if Zyte already complete).
4. Restore measured per-driver timeouts + AbortController on Zyte fetch.
5. Prefer fewer Playwright invocations over cutting Zyte.

### Stage 1B / Stage 2

- Prompt **B** (Offerings) and **C** (Competitors) not built; catalogue/competitors still use legacy profile APIs.
- Checkpoint 2 **UI** not wired; GET/POST scaffold returns empty offerings/competitors.
- Further Context Contract enrichment (candidate entities, deeper page types) beyond current runtime package.
- Doc/code nuance: evidence keys `page_url` / `page_type`; persona count Zod 1–6 vs prompt 2–4.
- Deep-page acquisition, Meta/Similarweb, Parallel path (still disabled/commented).
- Operational metrics, cost controls, DLQ/alerting beyond basic job status.

### Auth / claimed brand

- Full org-access request flow and invite delivery deferred.
- Masking is in place; keep verifying no raw owner PII leaks on anonymous resolve/validate.

## Recommended next order

1. Manual matrix in [MANUAL_TEST_MATRIX.md](./MANUAL_TEST_MATRIX.md) — record outcomes.
2. Prompt B/C + Checkpoint 2 FE when product prioritizes catalogue/competitors from Stage 2.
3. Stage 1A production hardening list above.
4. Confidence threshold + PSL + shared blocklist package.
5. Outbound waitlist/invite mail when State H / notifications are greenlit.

## Historical product notes

`product-team-docs/Change Doc/surface-scan/Implementation Gaps and Future Changes.md` was the prior combined test+gaps dump. Prefer this file + CURRENT_STATE going forward; leave the Change Doc as product history.
