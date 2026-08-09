# Module testing protocol

**Purpose:** One document to hand to an agent or QA so testing starts immediately — no re-explaining environment, brands, or pass style.

---

## Quick start (copy into chat)

```text
Module testing session.

Read:
- docs/TESTING.md
- docs/testing-methodology/README.md (this file)
- docs/<module>/TESTING.md

Defaults:
- Environment: local (STAGE=local)
- Pass type: happy path + chaos path
- Style: UI-only — test as a real user sees it (no DevTools network, no CloudWatch unless I ask)
- Test brands: use the standard Indian D2C list below
- Blocked URLs: use the negative list below

For each checklist row: Pass / Fail / Skip + gap ID if Fail.
Create or append docs/<module>/GAP-LOG.md for failures.
Do not fix code unless I say "implement fixes."
```

Replace `<module>` with e.g. `brand-onboarding`.

---

## Default environment

| Item | Value |
|------|--------|
| **Stage** | `local` |
| **Scan rate limits** | Off on local (unlimited rescans) |
| **Backend** | `npm run start:dev` (or your usual local command) |
| **Frontend v2** | `npm run dev` in `creator-commerce-frontend-v2` |
| **Database** | Local Postgres, migrations applied |
| **Gemini** | `GEMINI_API_KEY` set → live surface scan |
| **S3** | Optional for first passes; enable when testing logos/product images |

---

## Standard test brands (Indian D2C — happy path)

Use **root domain only** in the landing URL field (no paths required).

| # | Brand | URL to enter |
|---|--------|----------------|
| 1 | Mamaearth | `mamaearth.in` |
| 2 | Bewakoof | `bewakoof.com` |
| 3 | boAt | `boat-lifestyle.com` |
| 4 | SUGAR Cosmetics | `sugarcosmetics.com` |
| 5 | The Derma Co | `thedermaco.com` |
| 6 | Snitch | `snitch.co.in` |
| 7 | Rare Rabbit | `rarerabbit.com` |
| 8 | Plum | `plumgoodness.com` |
| 9 | Licious | `licious.in` |
| 10 | Wakefit | `wakefit.co` |

**Rotation:** For a full module pass, pick **2–3 brands** (one familiar, one mid, one niche). For regression after a fix, re-run **one brand** end-to-end.

**Cached scans:** Second run on the same domain may show `cached` scan mode and skip vendor re-run — still valid for UI testing downstream screens.

---

## Negative / chaos URLs (blocked & edge cases)

Test **what the user sees** on the landing page (and later steps where noted).

### Landing — should block or reject early

| URL | What user should see (approx.) |
|-----|--------------------------------|
| `instagram.com/nike` | Blocked — social / marketplace host |
| `facebook.com/brand` | Blocked |
| `youtube.com/@brand` | Blocked |
| `not a url` | Inline validation error |
| `localhost` | Blocked (private host) |

### Landing — unsupported / waitlist (industry gate)

Large marketplaces may **not** enter the scan funnel — expect waitlist or “not supported” messaging, not a full DNA preview.

| URL | Purpose |
|-----|---------|
| `amazon.in` | Marketplace — not a D2C brand site |
| `flipkart.com` | Marketplace |
| `myntra.com` | Marketplace / aggregator |

*Exact copy depends on classifier; log the **actual UI message** in the gap log if it differs from product docs.*

### Competitors step — blocked when adding competitor

| URL | Expected |
|-----|----------|
| `amazon.com` | Error — not a direct brand site |
| `google.com` | Error |
| `instagram.com/rival` | Error |

### Chaos behaviours (any happy-path brand)

| Action | What to watch |
|--------|----------------|
| Browser **Back** from DNA → scan | Sensible recovery or clear error |
| **Refresh** mid-scan | Progress recovers or shows error (not blank forever) |
| **Remove all products** then Continue | Validation or empty state |
| Competitor narrative **&lt; 40 chars** | Inline / alert error |
| Product URL on **wrong domain** | Domain lock error |
| Close modal mid-flow | Can resume or restart cleanly |

---

## Pass types

### Happy path

One brand, top to bottom, no intentional breakage. Mark each screen **Pass / Fail**.

### Chaos path

Same module, negative URLs + chaos table above. Mark **Pass / Fail**.

---

## UI-only testing rules

**Do:**

- Use the app in the browser as a user would
- Note exact on-screen copy for failures
- Screenshot mentally: layout, loading states, empty fallbacks (letter avatars vs images)
- Test mobile width if the checklist says so (Chrome responsive mode is fine)

**Do not** (unless explicitly asked):

- Open Network tab to debug
- Read CloudWatch / server logs
- curl APIs (see `MANUAL_TESTING_STEP1_GATE.md` for engineer smoke tests)

---

## Gap log format

Create `docs/<module>/GAP-LOG.md` per batch (e.g. `BATCH-01`).

```markdown
# <Module> — Gap log — BATCH-01

| ID | Bucket | Screen | Steps | Expected | Actual | Severity |
|----|--------|--------|-------|----------|--------|----------|
| UI-01 | UI | Scan | … | Step 3 active when backend on products | Step 3 jumps early | Medium |
```

Severity: `Low` | `Medium` | `High` | `Blocker`

Full template: [GAP-LOG-TEMPLATE.md](./GAP-LOG-TEMPLATE.md)

---

## Fix routing (after testing)

| Bucket | Typical fix path |
|--------|------------------|
| COPY, UI, VAL (frontend) | Cursor on frontend-v2 |
| BACK, AI, SQL | Cursor on backend-v2 + product doc update |
| ASSET | S3 config + mirror service (surface **and** deep scan — see below) |
| Infra timeout | AWS / env timeouts |

Details: [Testing methodology.md](./Testing%20methodology.md) — Stage 3.

---

## Images, S3, and surface vs deep scan

**Product intent:** Public images (brand logo, product thumbnails, competitor logos) should be **stable HTTPS URLs** — preferably mirrored to S3 — so the UI does not depend on hotlinking merchant CDNs.

| Phase | When | Image handling today |
|-------|------|----------------------|
| **Surface scan** (onboarding step 2) | Before verification | `BrandScanAssetMirrorService` → `brand-onboarding/v2/{domain}/{leadId}/…` when S3 configured |
| **Deep scan** (post-verification) | Brand Centre job after OTP | Updates DNA/offerings from Gemini — **verify same mirror rules apply** |
| **User edits** (onboarding catalogue) | Manual upload | `POST …/offerings/:id/image` → S3 |

**When testing ASSET issues, check:**

1. Logo on **Brand DNA** — image or letter fallback?
2. **Product catalogue** — thumbnails load or fallback?
3. **Competitors** — logos load?
4. After **verification** (deep scan), do images **change or break** vs pre-verify?
5. With **S3 off** — do external URLs still render, or all fallbacks?

Log gaps as `ASSET-xx` with note: `surface-only` | `deep-scan` | `both`.

---

## Module index

| Module | Checklist |
|--------|-----------|
| Brand onboarding | [../brand-onboarding/TESTING.md](../brand-onboarding/TESTING.md) |
| Brand onboarding (engineer API/gates) | [../brand-onboarding/MANUAL_TESTING_STEP1_GATE.md](../brand-onboarding/MANUAL_TESTING_STEP1_GATE.md) |
| Creator onboarding | [../creator-onboarding/UI_TESTING.md](../creator-onboarding/UI_TESTING.md) |

---

## Living Functional Spec (optional, after first pass)

Ask an agent to generate **production-truth** rules from code using the structure in [Testing methodology.md](./Testing%20methodology.md) § “Functional document structure”. Store as `docs/<module>/LFS.md`. Use to diff against product docs.
