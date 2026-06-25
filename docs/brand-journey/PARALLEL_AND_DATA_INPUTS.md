# Parallel fetch & AI input bundles

What **Parallel** pulls from the web, and what **text/JSON** is sent into each **Gemini** step. No codebase required — use with `PROMPTS_AND_AI_INSTRUCTIONS` for the full AI wording.

---

## Overview

| Stage | Parallel? | Gemini? | What Gemini receives |
| --- | --- | --- | --- |
| Industry gate (onboarding) | Optional: homepage markdown | Yes | Homepage extract + classifier prompt |
| Surface scan (onboarding) | Yes: 3 bundles + search | Yes | All markdown bundles + synthesis prompt |
| Deep scan (Brand Centre) | No | Yes | Stored scrape + products/competitors JSON + Prompt 1 |
| Intelligence (Tab 2) | No | Yes | Baseline health + SOV + strategy mix JSON + Prompt 2 |
| Planner (Tab 3) | No | Yes | DNA + approved leak + active cards JSON + Prompt 3 |
| Bridge → UCE | No | No | Fixed formulae only |

---

## Parallel — surface scan only

Parallel does **not** use Gemini. It **fetches and returns markdown** from public pages on the brand’s domain (and optional web search for competitors).

### Extract bundle 1 — Identity & about

**Pages tried (same domain):** home, about, about-us, our-story, etc. (up to 6 URLs)

**Instructions given to Parallel (summary):**

- Brand name, logo URL, social links
- Tagline and short description (max ~200 chars)
- Dominant colours and fonts
- Tone tags (3) and aesthetic tags (2)
- Audience persona name and age range from imagery

### Extract bundle 2 — Inventory list

**Pages tried:** shop, collections, services, treatments, products, catalog (up to 8 URLs)

**Instructions given to Parallel (summary):**

- First **6** products/services from **list view only** (name, image, starting price)
- 2–3 collections or categories
- Visible banner offers (name + coupon)
- Footer locations (city, name) if visible

**Constraint:** Do not open individual product detail pages.

### Extract bundle 3 — Homepage metadata

**Pages:** home (for SEO / competitor hints on page)

**Instructions:** SEO title/description, headings, any on-page competitor mentions.

### Parallel Search — competitors (optional)

**Search queries (example pattern):**

- `{brand label} competitors`
- `{brand label} similar brands`
- `brands like {brand label}`

**Goal:** Find **4–6** direct competitor brands with official websites. Industry hint adjusts wording (D2C, healthcare, SaaS, offline).

**Output:** Search result snippets with URLs — fed into Gemini as a fourth markdown bundle.

---

## Gemini input bundles (what is sent with each prompt)

### 1. Industry classifier (onboarding validate)

**When:** URL validated, before or during lead creation.

**Sent to Gemini:**

- Markdown from homepage extract (if keys configured)
- System instructions: `industry-classifier` prompt (full text in PROMPTS doc)

**Gemini returns:** `highLevelIndustry` (D2C, SAAS_AI, HEALTHCARE, OFFLINE_SERVICES, OTHER) + optional detail if OTHER.

---

### 2. Surface scan synthesis (onboarding scan)

**When:** User on scan screen; one API call.

**Sent to Gemini:**

- Concatenated markdown from all Parallel bundles (identity, inventory, competitor extract, competitor search)
- Canonical site URL and industry hint from discovery lead
- System instructions: `surface-scan-synthesis` prompt

**Gemini returns:** JSON for brand, products (≤6), competitors (≤5), locations (≤12), offers, audience — see DATA_AND_PROMPTS_REFERENCE for limits.

**After Gemini (fixed rules, not AI):**

- Cold start budget seeded (₹85k / $5k + template mixes)

---

### 3. Deep scan (Brand Centre Event 2)

**When:** After email verification; background job.

**Sent to Gemini:**

| Input field | Contents |
| --- | --- |
| BRAND_URL | Brand website |
| BRAND_ROUTING_TYPE | D2C skincare / SaaS / healthcare / offline template |
| COUNTRY, CURRENCY | Market context |
| DISCOVERED_PRODUCTS_JSON | Products from onboarding |
| DISCOVERED_COMPETITORS_JSON | Competitors from onboarding |
| RAW_SURFACE_SCRAPE_TEXT | Full Parallel markdown stored at scan time |

**System instructions:** `deep-scan-strategy` prompt + **machine JSON contract** (appendix in PROMPTS doc)

**Gemini returns:** Strategic DNA, personas, enriched inventory (3 USPs each), offers, baseline health, share of voice, **Phase 2 monthly budget**, growth matrix.

---

### 4. Intelligence refresh (Brand Centre Event 3)

**When:** Tab 2 opened or data stale (>24h); background job.

**Sent to Gemini:**

| Input field | Contents |
| --- | --- |
| GENERATED_HEALTH_METRICS_JSON | From deep scan baseline |
| GENERATED_SOV_JSON | Share of voice from baseline |
| GENERATED_STRATEGY_MIX_JSON | Budget strategy mixes |

**System instructions:** `intelligence-leaks` prompt + contract appendix

**Gemini returns:** Array of leak cards (title, bucket, lift %, drawer content).

**After Gemini (fixed rules):**

- Drop cards with lift **&lt; 1%**
- If empty, system adds up to 3 fallback cards

---

### 5. Planner aggregate (Brand Centre Event 4)

**When:** User clicks **Approve & move to planner** on a leak.

**Sent to Gemini:**

| Input field | Contents |
| --- | --- |
| BRAND_DNA_PROFILE_JSON | Subset of Tab 1 DNA |
| APPROVED_LEAKS_INPUT_JSON | The one approved leak |
| ACTIVE_RUNNING_CAMPAIGNS_JSON | Existing planner cards (objective × tier matrix) |

**System instructions:** `planner-aggregator` prompt + contract appendix

**Gemini returns:** One planner card object (new campaign, suggested update, or auto-pause log).

**Rule enforced in prompt:** One campaign base per **objective × creator tier** pair.

---

## Side notes

| Topic | Note |
| --- | --- |
| Cached scan | Second scan on same domain may skip Parallel and Gemini |
| Deep scan | Reuses scrape from onboarding — does not call Parallel again |
| Industry classifier | May use a simple hostname stub if AI keys not configured |
| v1 intelligence | Metrics are AI-inferred; live social APIs not wired in this build |

---

## Related documents in this package

- **PROMPTS_AND_AI_INSTRUCTIONS** — full text of every prompt and JSON contract
- **DATA_AND_PROMPTS_REFERENCE** — limits, formulae, end-to-end field table
- **BRAND_CENTRE** — when each event runs and what users see
