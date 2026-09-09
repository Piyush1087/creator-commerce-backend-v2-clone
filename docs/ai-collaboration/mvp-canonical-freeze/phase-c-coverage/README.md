# Phase C — Whole-application coverage map (§10)

**Status:** COMPLETE for this freeze — audited 2026-09-09 against freeze working-tree routes/`AppModule`  
**Evidence branches:** `freeze/mvp-canonical-application-v1`  
**FE freeze HEAD:** `1ee13b4c3ab93248bbe8cb79ef8d560277a4802d`  
**BE freeze HEAD:** `d684143b9dfad527c1b92d6a86fa4510296873d3`  
**Route hide SHA (RUN 1):** FE `71fe273e9a4d84b868dc7511d606e1109f2d566e` / BE `13a1dedc0ead8eef24a27c48067364258119b0fc`

## Files in this folder

| File | Purpose |
| --- | --- |
| `whole-application-coverage-map.md` | Charter §10 journey map + classification |
| `frontend-route-classification.md` | Mounted frontend routes vs product class |
| `backend-module-classification.md` | `AppModule` imports + HTTP controller prefixes |

## Rule used

A route or controller existing in code does **not** make it part of the canonical product. Marketplace / Co-Pilot / Centre / payout hubs are classified even when still wired.

## Exhaustiveness (2026-09-09)

- `src/app/App.tsx` mounts only `AppRoutes` (no second router, no temp playground).
- Every `AUTH_ROUTES` / `PUBLIC_ROUTES` / onboarding path in those route files is classified.
- `src/temp/aurora-playground` is **not** routed.
- Co-Pilot has **no FE route**. Brand Home (`/brand/dashboard`) uses Chat (`useBrandChat`), not `useBrandCoPilot`. Leftover `brand-home-assistant-panel.tsx` / `BrandCoPilotWorkspace` remain in tree unused by that page.
- **C-02A** is not partly pulled: freeze has `/creator/home` C-05 stub only; `src/features/creator-home` and `GET /api/v1/creator/home` are absent. Unmounted Creator Centre Home UI is not C-02A.
- Creator Centre **page files** remain; routes redirect Home. Brand dashboard still imports `creator-centre.css` (styling leftover, not a route).

## 2026-09-09 audit vs charter §10

Every named charter journey is classified. Gaps vs the 2026-09-08 map were **missing rows**, not missing product:

- Brand Centre offerings routes were lumped, not named.
- BE `api/v1/creator-uce`, `api/v1/public/brands`, `api/v1/public/creators`, `api/v1/s3`, `health/live` were omitted from the selected controller table.
- `/help` is mounted as an authenticated placeholder (`HelpPage`).
- Public Creator media-kit API is live while FE `/creator/media-kit` redirects Home.
- Marketplace **browse** stays hidden inbound; product CTAs no longer generate `/marketplace` destinations.

Hiding FE chrome still does **not** unwire OUT backend modules. Prisma drop remains forbidden.

Phase C is complete enough to move to Phase D.
