# Chat Home V1 — Integration Part 1 Report

**Date:** 2026-09-04  
**Branch:** `integration/chat-home-v1` (BE + FE)  
**Authority:** Developer Handoff + AI Worker Integration docs (`c00aaca…`); runtime SHAs below.  
**Status vocabulary:** `PASS` / `FIXED` / `GENUINE_AUTHORITY_CONFLICT` / `ENVIRONMENT_BLOCKED`

This is **Part 1 only** (integrate + validate candidate). Part B (dev deploy) is separate.  
Does **not** reopen Product P0–P7. Deferred: Creator Chat, EXECUTE, streaming, agents, memory.

---

## Canonical authority

| Role | SHA | Checked |
|------|-----|---------|
| Product (`dummy_tcs`) | `d69ba6b8cb331bfa36b450307d9defcd26d09c6e` | **PASS** — register read after fetch |
| Backend runtime | `00e1299ec2e97497bc6d81aeda808d6edd3b482a` | **PASS** — ancestor of BE tip |
| Frontend runtime | `1cf2e3bd93425f60fb3d40692320078aea567794` | **PASS** — ancestor of FE tip |
| Systems ledger | `c42a2cc44b922f8631c1e93606415407542869ce` | **PASS** — object present; ledger on branch |
| Handoff docs | `c00aacafb617e4d67643137359fd64bd9fc9424f` | **PASS** — used as integration authority |

---

## What Part 1 changed (integration only)

1. Created `integration/chat-home-v1` from `origin/development`.  
2. Merged accepted BE runtime `00e1299` and FE runtime `1cf2e3b` (no rebase of accepted history).  
3. Conflict policy: keep origin for unrelated modules; Chat/Home for Home/Chat/P7-C1 consumer paths; union `app.module` / routes / SST (`GEMINI_MODEL` default `gemini-3.5-flash`).  
4. Dropped duplicate Chat `120000` bs03/bs08 migration folders (same SQL as origin `21000`/`22000`).  
5. FE merge hygiene: restored origin files dropped by merge (`verification-otp.config`, `creator-onboarding.contracts`) + duplicate `aria-current` — **not** OTP Product work.  
6. Harness: postgres migration count `>= 66` (handoff: do not require exact 66).

**Not touched as Product work:** Gatekeeper, pricing, DE, Collaboration, C-01/C-05.

---

## Architecture gate

| Check | Status | Evidence |
|-------|--------|----------|
| Chat + Brand Home + Intelligence consumer wired | **PASS** | `app.module.ts` imports `ChatModule`, `BrandHomeModule`, `IntelligenceConsumerModule` |
| Brand Home UI + permanent Chat on dashboard | **PASS** | `brand-dashboard-page.tsx` briefing + chat panel |
| P7-C1 workspace auth split | **PASS** | `resolveBrandProfileIdForWorkspace` vs `resolveBrandProfileId` |
| PI migrations preserved (blob IDs) | **PASS** | Match handoff `9718a592…` / `e00ea913…` / `e9b4252f…` |
| No EXECUTE / Creator Chat / streaming added | **PASS** | Scope respected |
| Migration rehearsal (empty disposable DB) | **PASS** | `chat_home_integ` — 74 migrations applied |

---

## Validation matrix (Part 1)

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | Source runtime preserved in history | **PASS** | Merge parents include `00e1299` / `1cf2e3b` |
| 2 | Product semantics unchanged by inventing EXECUTE etc. | **PASS** | No new EXECUTE capability |
| 3 | Schema: no Chat-only rewrite of origin migrations | **PASS** | PI preserved; duplicate bs03/bs08 120000 removed |
| 4 | BE nest build | **PASS** | exit 0 |
| 5 | BE Chat/Home unit + architecture | **PASS** | 152 passed (postgres skipped in that run) |
| 6 | BE self-seeding postgres (conversation + HTTP) | **PASS** | 8/8, skip 0 |
| 7 | BE workspace auth postgres (P7-C1) | **PASS** | 11/11, skip 0 |
| 8 | BE P5-A / P5-B fixture postgres | **ENVIRONMENT_BLOCKED** | Flags ON; no fixture dump / rows |
| 9 | FE typecheck | **FIXED** | Merge-dropped files restored |
| 10 | FE Chat/Home scoped vitest | **PASS** | 105/105 |
| 11 | FE production build | **PASS** | exit 0 |
| 12 | Intelligence contracts verify CLI | **ENVIRONMENT_BLOCKED** | Dirty worktree rejects `--verify` |
| 13 | Local unauth API + FE shell smoke | **PASS** | health 200; Home/Chat 401; FE 200. Authenticated UI **ENVIRONMENT_BLOCKED** |
| 14 | Full BE `npm test` | **FAIL** | 15 failed / 1209 passed — not Chat suite; see test-results |
| 15 | Full FE `npm test` | **FAIL** | 23 failed / 816 passed — auth/onboarding/billing |
| 16 | Nest local boot (Notifications cycle) | **FIXED** | forwardRef BI↔Notifications↔BrandCentre |

**`GENUINE_AUTHORITY_CONFLICT`:** none.

---

## Exact SHAs (fill after Part 1 commit)

See `integration-part1-test-results.md`.

---

## Next (not Part 1)

- Restore P5 fixture dump **or** accept blocked until available.  
- Human approve → merge to `development`.  
- Part B: dev deploy + `GEMINI_MODEL=gemini-3.5-flash` + smoke.
