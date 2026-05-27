# Intake: Brand onboarding journey (product markdown)

**Source:** External product markdown (`Brand onboarding journey doc.md`, 2026).
**Status:** Accepted for **engineering extraction**; marketing copy is reference
only.

## What we adopted as v2 truth (backend)

- **Endpoint:** `POST /api/v1/discovery/resolve` (read-only entry) then
  `POST /api/v1/discovery/validate` when persistence is required, both with JSON
  body `{ "url": "..." }`.
- **Persistence sketch:** `discovery_leads`, `market_intelligence_logs`,
  `waitlist_leads` with enums aligned to the doc’s gatekeeper lists.
- **UI scenarios mapped to API outcomes:**
  - Resolve `resume` → continue with existing `discovery_leads` row (no validate call).
  - Resolve `proceed` → call `validate` to persist triage / create lead.
  - Success (supported industry) → `outcome: success` + `discovery_leads` row.
  - Regret (unsupported vertical) → `outcome: waitlist` + market intel row.
  - Blocked (syntax/social/private/blocked vertical) → `outcome: blocked` + market
    intel row where applicable.
  - Domain already verified with org + user → `outcome: org_claimed` + `adminEmail`
    for invitation modal (no new lead row).

## Explicitly deferred (per engineering scope)

- Meta Business Manager / OAuth wiring.
- AI classifier / crawler orchestration (Parallel, Gemini, etc.).
- Analytics event taxonomy for funnel steps.

## User / org model note from engineering

The product doc focuses on anonymous landing traffic. We still added minimal
`User` + `Organization` tables so roles (`BRAND`, `INFLUENCER`, `ADMIN`) and
**optional** org linkage are represented: brand users may attach to an org later;
influencer and admin users are typically **not** org-scoped.

## Implementation pointers

- Nest module: `src/features/brand-onboarding`
- OpenAPI: `docs/api/brand-discovery.openapi.yaml`
- DB note: `docs/database/brand-discovery-and-users.md`
