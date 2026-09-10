# 16 — Responsive shell / navigation viewport smoke

**Date:** 2026-09-09  
**Run:** RUN 5 remainder + RUN 8 leftover (table→cards + Creator viewport)  
**App:** Vite `http://localhost:5173/` proxying `/api` to Nest `:3000`  
**Database:** disposable `freeze_mvp_canonical_v1`. `thecreatorshop` not migrated.

Contract: `DESIGN_SYSTEM.md` Mobile Responsive Contract — ~375px and ~767px, no document-level horizontal scroll, stacked CTAs, drawer + bottom nav on authenticated pages below 768px, OUT chrome hidden.

## Method

Chrome DevTools `Emulation.setDeviceMetricsOverride` + `document.documentElement.scrollWidth` vs `clientWidth`. Interactive click-through (drawer open/close, bottom-nav Campaigns, logout → login). Screenshots stayed in the local temp dir; they are **not** committed.

At **exact width 767 with `deviceScaleFactor: 2`**, `visualViewport.width` was `767.2`, so `(max-width: 767px)` did **not** match and the shell stayed on the desktop icon rail. The mobile-edge pass was re-run at **766px, `deviceScaleFactor: 1`**, where `matchMedia('(max-width: 767px)')` is true. Desktop cutover was checked at **768px**.

## Matrix

| Viewport | Route | Document h-scroll | Shell | Notes |
| --- | --- | --- | --- | --- |
| 375 | `/brand/dashboard` | none (`scrollWidth=375`) | hamburger + bottom nav (Home, Campaigns, Brand Centre, Chat) | Drawer opens with Home, Brand Centre, Campaigns, Brand page, Collaborations, Settings, Support, Logout. No Marketplace / Co-Pilot / Creator Centre |
| 375 | `/brand/uce/campaigns` | none | same | CTAs full width (~343px). RUN 5: scoped 900px table. **RUN 8:** operations rows are labeled cards |
| 375 | `/brand-centre` | none | same | Fail-closed: “Could not load Brand information” (same fixture as RUN 4) |
| 375 | `/brand/settings/general` | none | same | Fields stacked (~294px). Settings tabs may clip (tab-list scroll allowed) |
| 375 | `/brand/collaborations` | none | same | Empty Inbox. Bottom-nav **Chat** marked current (maps to collaboration inbox) |
| 375 | `/marketplace` | none | no app chrome | “This entry is unavailable. Open a Campaign link provided by the Brand.” |
| 375 | `/login` | none | public | Email-code **Send code** matches field width (262px). Password/Email-code tabs side-by-side |
| 766 | `/brand/dashboard` | none | hamburger + bottom nav | Mobile query matches. Upgrade visible in header |
| 766 | `/brand/uce/campaigns` | none | same | CTAs full width (~734px). RUN 5 scoped table. **RUN 8:** labeled cards, no 900px min-width |
| 766 | `/brand/settings/general` | none | same | Fields ~685px stacked |
| 766 | `/login` | none | public | Sign in ~653px (form-card width) |
| 768 | `/brand/dashboard` | none | desktop sidebar; bottom nav **not** visible | `min-width: 768px` matches. Ask Creator Shop composer visible. Open Menu exists in DOM at 0×0 |

## OUT chrome

Authenticated Brand drawer and bottom nav did **not** show Marketplace, Co-Pilot, Creator Centre, or a standalone payout hub. `/marketplace` stays the unavailable entry copy.

## Classification

| Check | Result |
| --- | --- |
| Document-level horizontal scroll at 375 and 766 | **PASS** |
| Authenticated drawer + bottom nav below 768px | **PASS** (766 = CSS mobile edge) |
| Desktop ≥768 sidebar, no bottom nav | **PASS** at 768 |
| OUT chrome hidden | **PASS** |
| Stacked / full-width primary CTAs (campaigns create, settings, login send) | **PASS** |
| Tables become card stacks | **PASS** RUN 8 — UCE operations rows are labeled cards below 768px; 900px `performance-matrix` min-width removed |
| Creator authenticated viewport | **PASS** RUN 8 — Parent confirmed UI; Home / Campaigns / Collaborations / Settings. Architecture vitest 9/9 |
| Exact 767px @ DPR 2 | **ENVIRONMENT note** — visual viewport 767.2 skips `max-width: 767px`; not treated as a product fail |

**Gate status:** PASS (RUN 8 Parent confirm). RUN 5 Brand shell matrix still stands. Table→cards and Creator viewport leftovers closed.

`PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` is still forbidden.

## RUN 8 leftover (2026-09-09)

UCE `CampaignListTabs` uses `data-label` card stacks at `max-width: 767px`. Creator campaign lists keep `.cc-mobile-rows` (table `display: none` below 768px) with 24px card padding. Parent: targeted Vitest **3 files / 9 passed**; frontend UI works as expected.

Architecture files: `campaign-list-tabs.responsive.test.ts`, `creator-campaigns-viewport.architecture.test.ts`, `creator-shell-rendering.test.ts`.
