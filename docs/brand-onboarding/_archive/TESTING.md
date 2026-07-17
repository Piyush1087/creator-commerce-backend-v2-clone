# Brand onboarding — UI testing checklist

**UI-only.** Test in the browser as a user. No network tab or server logs unless you escalate an issue.

**Handoff to agent:**

```text
Run brand onboarding testing per docs/brand-onboarding/TESTING.md.
Defaults: docs/testing-methodology/README.md (local, happy + chaos, standard brand list).
Log failures to docs/brand-onboarding/GAP-LOG.md.
```

**Product truth:** `docs/brand-onboarding/product-team-docs/brand-onboarding/`  
**Engineer API/gates (optional):** [MANUAL_TESTING_STEP1_GATE.md](./MANUAL_TESTING_STEP1_GATE.md)

---

## Before you start

| Check | Done |
|-------|------|
| Backend running locally (`STAGE=local`) | ☐ |
| Frontend v2 running, `VITE_API_URL` points to backend | ☐ |
| `GEMINI_API_KEY` set (live scan) | ☐ |
| `S3_BUCKET_NAME` — **optional** (note yes/no in gap log) | ☐ |
| Pick **2–3 brands** from [standard list](../testing-methodology/README.md#standard-test-brands-indian-d2c--happy-path) | ☐ |
| Open **desktop**; repeat critical rows at **375px** width | ☐ |

---

## Happy path (one brand end-to-end)

Use e.g. `mamaearth.in` first. Mark **Pass / Fail / Skip** per row.

### 1 — Landing

| # | Do | Pass? | Notes |
|---|-----|-------|-------|
| H1.1 | Enter brand URL, submit | ☐ | |
| H1.2 | Brief loading / “getting to know your brand” (if shown) | ☐ | |
| H1.3 | **Modal 1** — process preview appears; copy readable | ☐ | |
| H1.4 | Continue → **Modal 2** setup expectations | ☐ | |
| H1.5 | Modal 2: **no email input** — only instructions + example `hello@yourbrand.com` | ☐ | |
| H1.6 | Modal 2: Meta + safety/compliance cards visible | ☐ | |
| H1.7 | “Verify & Continue” → scan screen | ☐ | |

### 2 — Surface scan

| # | Do | Pass? | Notes |
|---|-----|-------|-------|
| H2.1 | Brand name shown in header | ☐ | |
| H2.2 | Left steps advance in order: signals → products → audience → competitors | ☐ | Not all steps at once |
| H2.3 | Step labels match activity (not stuck on step 1 until jump to done) | ☐ | |
| H2.4 | Scan completes → auto-navigate to Brand DNA | ☐ | |
| H2.5 | On error: user sees message + way back (not blank screen) | ☐ | |

### 3 — Brand DNA

| # | Do | Pass? | Notes |
|---|-----|-------|-------|
| H3.1 | **No tabs** for Campaign History / Creative Assets | ☐ | |
| H3.2 | Scanned data visible: name, tagline, description, industry | ☐ | |
| H3.3 | **Logo** — image or letter fallback (note which) | ☐ | ASSET if broken |
| H3.4 | Colors, tones, aesthetics, persona fields populated (or empty with edit affordance) | ☐ | |
| H3.5 | Edit brand name → save in dialog → value updates on screen | ☐ | |
| H3.6 | Edit tagline / description | ☐ | |
| H3.7 | Add or remove a tone / trait tag | ☐ | |
| H3.8 | “Looks good, next” → catalogue (or clear validation error) | ☐ | |
| H3.9 | “I’ll change later” → catalogue | ☐ | |

### 4 — Product catalogue

| # | Do | Pass? | Notes |
|---|-----|-------|-------|
| H4.1 | Products from scan listed (names match brand) | ☐ | |
| H4.2 | **Product images** — photo or letter fallback per card | ☐ | ASSET |
| H4.3 | Remove a product → undo works | ☐ | |
| H4.4 | Add product: valid URL on **same domain** → appears in list | ☐ | |
| H4.5 | Edit product name / URL in dialog → saves on screen | ☐ | |
| H4.6 | Upload product image (if offered) → thumbnail updates | ☐ | Skip if no S3 |
| H4.7 | Continue → competitors | ☐ | |

### 5 — Competitors

| # | Do | Pass? | Notes |
|---|-----|-------|-------|
| H5.1 | Competitors listed with names | ☐ | |
| H5.2 | **Competitor logos** — image or fallback | ☐ | ASSET |
| H5.3 | Select competitor pill → narrative visible | ☐ | |
| H5.4 | Remove → undo | ☐ | |
| H5.5 | Add competitor: name + URL + narrative (40+ chars) | ☐ | |
| H5.6 | Edit competitor narrative | ☐ | |
| H5.7 | Continue → verification | ☐ | |

### 6 — Verification

| # | Do | Pass? | Notes |
|---|-----|-------|-------|
| H6.1 | Work email field shown (domain match messaging) | ☐ | |
| H6.2 | OTP flow completes (stub `123456` if configured) | ☐ | |
| H6.3 | Wrong OTP shows error state | ☐ | |
| H6.4 | Success → pricing / next step | ☐ | |

### 7 — Pricing & login (if in scope)

| # | Do | Pass? | Notes |
|---|-----|-------|-------|
| H7.1 | Start trial / register CTA works | ☐ | |
| H7.2 | Social sync skip → dashboard or login | ☐ | |
| H7.3 | Logout → landing | ☐ | |

### 8 — Images & S3 (second brand or after S3 enabled)

Re-run **H3.3, H4.2, H5.2** with `S3_BUCKET_NAME` set.

| # | Do | Pass? | Notes |
|---|-----|-------|-------|
| H8.1 | Logo URL looks like S3 / stable host (not hotlink only) | ☐ | |
| H8.2 | Product images load after refresh | ☐ | |
| H8.3 | After verification, open Brand Centre — images **still** OK | ☐ | deep scan parity |

---

## Chaos path

### Landing — negative URLs

| # | URL | Pass? | User-visible outcome |
|---|-----|-------|----------------------|
| C1.1 | `instagram.com/foo` | ☐ | Blocked message |
| C1.2 | `amazon.in` | ☐ | Waitlist / not supported (log actual copy) |
| C1.3 | `flipkart.com` | ☐ | Waitlist / not supported |
| C1.4 | `not a url` | ☐ | Validation error |

### Mid-funnel

| # | Do | Pass? | Notes |
|---|-----|-------|-------|
| C2.1 | Refresh during scan | ☐ | |
| C2.2 | Browser back from DNA to scan | ☐ | |
| C2.3 | Add product URL on **wrong domain** | ☐ | Clear error |
| C2.4 | Add competitor `amazon.com` | ☐ | Clear error |
| C2.5 | Competitor narrative under 40 characters | ☐ | Clear error |
| C2.6 | Description over 500 chars on DNA | ☐ | Blocked with message |

### Resume (optional — same domain within 7 days)

| # | Do | Pass? | Notes |
|---|-----|-------|-------|
| C3.1 | Complete scan, leave, return with same URL | ☐ | Resume modal? |
| C3.2 | Continue resume → DNA with prior data | ☐ | |

---

## Mobile spot-check (375px)

Repeat on one brand:

| Screen | Pass? |
|--------|-------|
| Landing + modals scrollable, CTA reachable | ☐ |
| Scan steps readable | ☐ |
| DNA cards stack, edit dialog usable | ☐ |
| Catalogue cards / competitor layout | ☐ |

---

## Deep scan & image parity (post-verify)

After **H6** success, if Brand Centre is reachable:

| # | Check | Pass? |
|---|--------|-------|
| D1 | Brand Centre loads without white screen | ☐ |
| D2 | Logo / product images **unchanged or improved**, not broken | ☐ |
| D3 | New deep-scan fields (USPs, leaks, etc.) appear when job completes | ☐ |

Log image regressions as **ASSET-xx** with `surface-only` vs `deep-scan`.

---

## Gap log

Failures → [GAP-LOG.md](./GAP-LOG.md) (create from [template](../testing-methodology/GAP-LOG-TEMPLATE.md)).

---

## Out of scope (this checklist)

- API curl smoke tests → [MANUAL_TESTING_STEP1_GATE.md](./MANUAL_TESTING_STEP1_GATE.md)
- `STAGE=dev` scan rate limits (separate pass)
- Plan assignment / billing
- Full dashboard product UI
