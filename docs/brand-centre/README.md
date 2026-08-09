# Brand Centre — engineering docs

Engineering-owned documentation for Brand Centre backend (Tabs 1–3, events, APIs, schema).

**Do not edit** `product-team-docs/` — those are read-only product reference.

---

## Document index

| Doc | Audience | Purpose |
| --- | --- | --- |
| **[REQUIREMENTS.md](./REQUIREMENTS.md)** | Engineering | **Source of truth** — all requirements from product, with `REQ-*` IDs for traceability and code comparison |
| **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** | Engineering | How to build: slices, module layout, APIs, hooks, test checklist |
| **[SCHEMA_MIGRATION.md](./SCHEMA_MIGRATION.md)** | Engineering | Prisma tables, enums, product→model mapping |
| **[PRODUCT_TEAM_GUIDE.md](./PRODUCT_TEAM_GUIDE.md)** | Product, design, QA | Human-readable end-to-end |
| **[PROMPT_ALIGNMENT.md](./PROMPT_ALIGNMENT.md)** | Engineering | Product prompts ↔ `.prompt.md` files in code |
| **[READINESS_COMPARISON.md](./READINESS_COMPARISON.md)** | Engineering + product | Gate before implementation |
| **[2026-05-27-readiness-audit.md](./2026-05-27-readiness-audit.md)** | Engineering + QA | Pre test-run gap analysis (backend vs Stitch UI) |
| **`docs/ai-collaboration/2026-05-27-brand-centre-requirements-tracking.md`** | Engineering | Implementation status vs `REQ-*` |
| **`docs/ai-collaboration/2026-05-27-brand-centre-session-handoff.md`** | Engineering | Session handoff commands & file index |

---

## Workflow

```
product-team-docs/  (read-only reference)
        │
        ▼
REQUIREMENTS.md     ← source of truth for implementation & code review
        │
        ├── IMPLEMENTATION_PLAN.md
        ├── SCHEMA_MIGRATION.md
        └── READINESS_COMPARISON.md  ← gate: ready to start?
        
PRODUCT_TEAM_GUIDE.md  ← share with product for E2E understanding
```

---

## Related

- `docs - Copy/brand-onboarding/` — surface scan, verify, auth (Event 1 & 2 hooks)
- `docs - Copy/api/` — OpenAPI (add `brand-centre.openapi.yaml` in Slice 8)

---

## v1 exclusions (summary)

Public profile, campaigns module handoff, live social/marketplace APIs, real escrow/billing. See REQUIREMENTS.md §1.2.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-05-27 | Added readiness audit; backend guardrails aligned (30d budget 429, mix slot floors, scrape bundles, 30m eviction, archive retention) |
| 2026-05-27 | Restructured: REQUIREMENTS as source of truth; added PRODUCT_TEAM_GUIDE and READINESS_COMPARISON |
