# Brand onboarding — frontend requirements (v2)

**Repo:** `creator-commerce-frontend-v2`  
**Feature:** `src/features/brand-onboarding`  
**Status:** Requirements captured here for when API work is far enough along; implementation can be scheduled explicitly (see `IMPLEMENTATION_TRACKING.md`).

Do **not** paste secrets, OAuth client IDs, or API keys into this repo’s markdown. Reference only public variable **names** (for example `VITE_API_URL`).

---

## Configuration

- **`VITE_API_URL`** — base URL for Nest (`resolve` / `validate` and future routes). Must match deployed API per environment.
- Other `VITE_*` keys belong in local `.env` / deployment secrets management, not in tracked docs.

---

## Hardening when wiring to real APIs

When moving from mocks to production data:

1. **Remove mock modules** — delete or stop importing `mock-data/*` once each screen has an API contract.
2. **Remove fallback static data** — not only obvious fixtures, but also:
   - `useState(INITIAL_* )` defaults that mask empty API responses
   - Inline placeholder strings used when `data == null`
   - “Silent” fallbacks in render (e.g. `title ?? 'Sample product'`)
3. **Empty and error states** — explicit loading, empty, and error UI driven by API outcome (no fake rows “so the page looks full”).
4. **Single source of truth** — types and response shapes aligned with `docs/api/*.openapi.yaml` and shared contracts under the frontend feature (e.g. `contracts/`).

---

## Step 4 — Product catalogue: industry templates

Product intent: **three distinct catalogue templates** — **D2C** (default), **Healthcare**, **Offline / services** (terminology aligned with product docs: D2C, Healthcare, Offline).

### Mapping rules

- **Default template:** D2C when industry is unknown, ambiguous, or not healthcare/offline.
- **Drive the default tab / layout** from **server truth** once available: e.g. `BrandProfile.industry` or `IndustryVertical` from discovery/validate, not only from client guesses.
- **All three templates must be implemented and reachable** in the UI (e.g. tabs or equivalent) so QA and design can verify each; the **initial** selection follows industry mapping above.
- **Backend alignment:** Prisma `IndustryVertical` (or future API field) should map cleanly to the three UI templates, for example:
  - `HEALTHCARE` → Healthcare template
  - `OFFLINE_SERVICES` → Offline template
  - `D2C` and other supported retail/SaaS-style values → D2C template (unless product later splits SaaS)
- **Router state (interim):** until a session or “current brand” API exists, optional `location.state` may carry `url`, `leadId`, and **`industryVertical`** (or derived template id) between steps — document and remove once redundant.

### Per-template UX expectations (high level)

| Template | Emphasis |
|----------|-----------|
| D2C | Product grid, pricing/promo surfaces where applicable, standard PDP-style URLs |
| Healthcare | Treatments, locations/clinics, compliance-oriented copy where product specifies |
| Offline | Services, appointments, geo / studio context per product docs |

Exact copy and fields remain owned by `docs/product-team-docs/brand-onboarding` (Step 4).

---

## Already in place (reference only)

- Landing: `resolve` → `validate`, **`org_claimed`** modal, contracts under `brand-onboarding/contracts/`, client in `api/discovery-client.ts`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-14 | Initial frontend requirements doc; catalogue three-template rule; no-secrets policy. |
