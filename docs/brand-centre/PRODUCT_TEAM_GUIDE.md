# Brand Centre — product team guide

**Audience:** Product, design, QA — non-engineering readers  
**Purpose:** Explain end-to-end what happens, when, and what the user sees at each step

This guide describes the **Brand Centre** — the post-onboarding workspace where a brand manages their DNA, sees intelligence insights, and prepares campaigns. It covers all three tabs and the automated pipelines that feed them.

---

## What is Brand Centre?

After a brand finishes onboarding (domain scan, catalogue review, email verification, registration), they land in **Brand Centre**. It has three tabs:


| Tab | Name                | What it is for                                                 |
| --- | ------------------- | -------------------------------------------------------------- |
| 1   | Brand DNA           | Who the brand is — profile, story, products, budget, account   |
| 2   | Intelligence & Gaps | How the brand is performing vs competitors; AI recommendations |
| 3   | Campaign Planner    | Draft campaigns grouped from approved recommendations          |


Everything in Brand Centre is tied to one **brand workspace** (one website / one company). Data is filled automatically by AI where possible, then the brand can edit and approve.

---

## The big picture — four automated events

Before and during Brand Centre use, four **events** move data through the system:

```
ONBOARDING                         BRAND CENTRE (logged in)
──────────                         ────────────────────────

Step 1: Enter website URL
        │
        ▼
   ┌─────────────┐
   │  EVENT 1    │  Surface scan + interim budget charts
   │  (instant)  │
   └─────────────┘
        │
Step 6: Verify email
        │
        ▼
   ┌─────────────┐
   │  EVENT 2    │  Deep scan — fills Tab 1 DNA + Tab 2 baseline
   │  (background)│
   └─────────────┘
        │
User opens Tab 2
        │
        ▼
   ┌─────────────┐
   │  EVENT 3    │  Leak detection — recommendation cards
   │  (background)│
   └─────────────┘
        │
User clicks "Move to Campaign Planner"
        │
        ▼
   ┌─────────────┐
   │  EVENT 4    │  Creates draft in Tab 3
   │  (background)│
   └─────────────┘
```

---

## Event 1 — Surface scan (onboarding Step 1)

### When it happens

The moment a brand submits their website URL during onboarding and the initial scan succeeds.

### What the system does

1. Visits the website and extracts visible information: products or services, competitors, colours, offers, social links.
2. Determines **country and currency** (India → INR, US → USD, others → USD).
3. Picks an **industry routing template** (D2C, SaaS, Healthcare, or Offline) based on what type of business was detected.
4. Creates an **interim budget profile** so budget pie charts are not empty while the brand continues onboarding. This is a **placeholder phase** — not the final AI-calculated budget.

### What the user sees

- During onboarding: catalogue cards, competitors, industry confirmation.
- If they peek at Brand Centre Tab 1 before email verification: profile basics and **interim** budget charts (labeled internally as “cold start” phase).

### Outputs stored

- Brand name, logo, website, industry, products/services list, competitors
- Interim monthly budget number and three pie-chart splits (asset / influencer tier / campaign objective)
- Utilization shows **0%** (nothing booked yet)

---

## Event 2 — Deep scan (email verification)

### When it happens

Right after the brand successfully verifies their work email (Step 6 OTP). The user does **not** wait on this screen — it runs in the background.

### What the system does

1. Sends the brand’s website data, catalogue, competitors, and industry type to **AI (Gemini)** with a structured “Prompt 1”.
2. AI returns:
  - **Brand story:** tagline, description, exactly 3 USPs, tone of voice, colours, fonts, aesthetics
  - **Audience personas** (at least one)
  - **3 selling points per product/service**
  - **Compliance “do not say” list** (extra strict for healthcare brands)
  - **Real monthly budget** inferred from the brand’s context
  - **Final budget splits** for the three pie charts
  - **Tab 2 baseline:** health scores, share of voice vs competitors, archetype breakdown
3. Replaces the interim budget with this **AI-calculated budget** (“self-healing” phase).
4. Saves an **explanation text** the user can read when adjusting budget splits (“Know how the budget split is planned”).

### What the user sees

- Onboarding continues / redirects to Brand Centre.
- A loading/polling state until deep scan completes (seconds to minutes).
- Tab 1 fills in: narrative, personas, enriched product details, real budget.
- Tab 2 Zone 1 (dashboard) has baseline metrics when opened.

### Outputs stored

- Full Tab 1 DNA content
- Tab 2 baseline dashboard data
- Budget phase upgrades from interim → AI-calculated

---

## Tab 1 — Brand DNA (what the user manages)

### Zone 1 — Brand DNA

**Section 1 — Brand Profile**  
Logo, name, social handles (@instagram, @youtube, @tiktok), market (country/currency), industry chain, lifecycle stage. Website and industry are fixed after onboarding.

**Section 2 — About the Brand**  
Tagline, short description, 3 USPs, compliance do-not-say list. Editable in a drawer.

**Section 3 — Brand Identity Matrix**  
Colours, fonts, visual style tags, tone of voice, and **audience persona cards** (AI-generated names like “Urban Millennial Skintellectuals” with location, age, interests).

**Sections 4 & 5 — Products and groupings (changes by industry)**


| Industry type         | Section 4 shows                  | Section 5 shows                   |
| --------------------- | -------------------------------- | --------------------------------- |
| D2C / E-commerce      | Hero Products (max 5)            | Key Collections (max 3)           |
| SaaS                  | Core Platforms & Modules (max 5) | Subscription Plans (max 3)        |
| Healthcare            | Treatments & Programs (max 5)    | Specialties & Departments (max 3) |
| Offline / Hospitality | Experiences & Venues (max 5)     | Locations & Properties (max 3)    |


Adding an item: user pastes a URL → system checks it belongs to their website → AI fetches image and title → user confirms.

**Section 6 — Offers**  
Promo codes, validity dates, where they apply.

**Section 7 — Competitors**  
Up to 3 competitors with logos and “why we compete” notes.

### Zone 2 — Strategic Budget

**Monthly budget**  
Example display: ₹85,000/mo. User can edit, but:

- Cannot go below ₹50,000 (INR) or $1,000 (USD)
- Cannot go below what is already committed to live collaborations
- Maximum **2 edits per 30 days**

**Three pie charts**  

1. Asset mix — product vs collection vs sitewide sale
2. Influencer tier — nano through celebrity
3. Campaign objective — pulse, proof, push, production

User can open “Know how the budget split is planned” to see **AI’s reasoning** and adjust sliders. Each slice has minimum amounts (₹30k / $500 per bucket).

**Utilization bar**  
Shows (booked + spent) ÷ total budget. Starts at 0% for new brands.

### Zone 3 — Account & setup

Plan tier, outreach quota, escrow status, Meta connection, team invites.  
In the first release, connection statuses are **placeholders** — links exist but live billing/social integrations come later.

---

## Event 3 — Intelligence refresh (Tab 2)

### When it happens

- First time the user opens **Tab 2: Intelligence & Gaps**, or
- User clicks refresh, or
- (Later) automatic daily refresh

### What the system does

1. Takes Tab 2 baseline from Event 2 (health scores, share of voice, budget mixes).
2. Runs **Prompt 2** to find **funnel leaks** — places where the brand loses reach or revenue vs competitors.
3. Creates **recommendation cards**, each with:
  - Title and short description
  - Priority (high / medium / low)
  - Category: PDP, Paid ads, Creator roster, or Creative hook
  - Estimated revenue lift %
  - Deep drawer: why (data logic), competitor comparison, step-by-step fix checklist
4. **Drops** any recommendation with less than **1%** estimated lift (reduces noise).

### What the user sees

**Zone 1 — Dashboard (collapsed by default)**  

- Predictive revenue lift index  
- Lever breakdown bars (PDP, Instagram, Meta ads)  
- Reach, engagement, creator volume  
- Archetype and quality scores  
- Share-of-voice donut vs competitors  
- Competitor content themes (last 30 days)

*Note: Until live social integrations exist, these “last 30 days” metrics are **AI-estimated** from web and competitor analysis, not live Instagram/Meta API data.*

**Zone 2 — Recommendation feed (expanded)**  
Filterable list of insight cards. User can:

- **Read more** → side drawer with full analysis and checklist
- **Move to Campaign Planner** → Event 4
- **Dismiss & archive**

After moving or dismissing, cards leave the active list and go to the **Archive** (kept ~30 days).

---

## Event 4 — Move to Campaign Planner

### When it happens

User clicks **Move to Campaign Planner** on any Tab 2 card.

### What the system does

1. Marks the insight as “moved to planner”.
2. Runs **Prompt 3** to build a **campaign draft** using the rule:
  **One campaign base per Objective × Influencer tier combination.**
3. Decides card type:
  - **Green — New campaign:** brand-new objective+tier combo
  - **Yellow — Suggested update:** adds to an existing campaign with same objective+tier
  - **Red — Auto-pause:** critical negative signal; system logs immediate pause (no manual review)

### What the user sees

Button changes to “Moved ✓”, card animates away, draft appears in Tab 3.

---

## Tab 3 — Campaign Planner

### Three sections on the dashboard

**1. Ready-to-launch (green)**  
New master campaigns grouped from insights. Shows objective, tier, products attached, brief count. Actions: Discard, View details, Launch.

**2. Pipeline suggestions (yellow)**  
Adds products or briefs to a campaign that already exists for the same objective+tier.

**3. Auto-executed pauses (red, read-only)**  
System already paused a brief or product to stop waste. User acknowledges receipt.

### Strategy drawer

“View details” opens a right panel with:

- Campaign objective and target creator tier
- Audience demographics
- Budget range per creator (e.g. $2,000–$5,000)
- Deadline
- Product-by-product **production briefs** (TikTok, Reels, Stories, landing page, discount codes, Meta whitelisting flags)

### Launch / approve

**Launch Campaign** will eventually hand off to the separate **Create Campaign** module with fields pre-filled.  
In v1 backend, approve checks the draft does not exceed available monthly budget, then marks it “proceeded to pipeline” — the external campaigns app connection is **next programme**.

---

## Templates explained

Brand Centre uses **two kinds of templates**. They are easy to confuse because both run right after surface scan — but only one comes from the product spec in full.

### Overview

| Template type | Defined by | Used when | Uses Gemini? |
| --- | --- | --- | --- |
| **Industry routing** | Product (`BrandCentre-tab1.md`) | Surface scan hook + Tab 1 UI | No — picked from detected industry |
| **Budget cold-start** | Engineering (until product sets numbers) | Surface scan hook only | No — static defaults per routing type |

After **email verification**, **Prompt 1 (deep scan)** replaces interim budget numbers and mixes with **AI-calculated** values. Templates are only for the gap between surface scan and deep scan.

---

### 1. Industry routing templates (product)

**Purpose:** Tab 1 Sections **4** and **5** change labels, limits, and drawer fields depending on business type. Sections 1–3, 6, and 7 stay the same for everyone.

**When applied:** As soon as surface scan finishes, the system maps onboarding industry → one of four routing types. The API exposes this so the frontend knows which labels and limits to show (`GET /routing-template`).

**How industry is chosen:**

| Detected onboarding industry | Routing template |
| --- | --- |
| D2C / e-commerce | D2C |
| SaaS / AI | SaaS |
| Healthcare & wellness | Healthcare |
| Offline / hospitality / events / retail | Offline |
| Unknown or other supported types | D2C (default for now) |

#### Section 4 — primary offerings (max 5)

| Routing | UI header | What user adds | Key drawer fields |
| --- | --- | --- | --- |
| **D2C** | Hero Products | Product PDP URLs | Image, name, URL, price, description, 3 USPs, do-not-say, offers |
| **SaaS** | Core Platforms & Modules | Feature page URLs | Screenshot/icon, module name, feature URL, starting price, 3 capabilities, do-not-say, offers |
| **Healthcare** | Treatments & Programs | Service/booking URLs | Image, treatment name, booking URL, fee, 3 patient benefits, do-not-say (e.g. no “cures disease”), offers |
| **Offline** | Experiences & Venues | Booking/ticket URLs | Image, experience name, booking URL, price per pax/night, 3 highlights, do-not-say, offers |

#### Section 5 — groupings (max 3)

| Routing | UI header | What user adds | Key drawer fields |
| --- | --- | --- | --- |
| **D2C** | Key Collections | Category page URLs | Image, name, URL, description, 3 USPs, do-not-say, offers |
| **SaaS** | Subscription Plans & Tiers | Pricing page URLs | Icon, plan name, pricing URL, 3 value props, do-not-say, offers |
| **Healthcare** | Specialties & Departments | Department page URLs | Image, specialty name, URL, 3 pillar services, do-not-say, offers |
| **Offline** | Locations & Properties | Location/maps URLs | Image, property/city name, maps URL, 3 location perks, do-not-say, offers |

#### Universal rules (all four templates)

- **Add URL:** must belong to the brand’s verified website domain (not competitors).
- **AI assist on add:** after domain check, system fetches image + title; user confirms before save.
- **Deep scan later:** each item gets exactly **3 selling points** from Prompt 1 if not already filled.

**Healthcare extra:** Prompt 1 strips forbidden medical claims from copy and adds them to the brand-level do-not-say list automatically.

**Product reference:** `product-team-docs/BrandCentre-tab1.md` — “Dynamic Industry Routing”.

---

### 2. Budget cold-start templates (engineering)

**Purpose:** After surface scan, budget pie charts should not be empty while the user is still in onboarding (before email verify and deep scan).

**When applied:** Immediately at end of surface scan (Event 1). Stored as budget **Phase 1 — cold start**.

**What they set:**

| Field | Source |
| --- | --- |
| Monthly budget amount | Engineering default **per routing type** (interim placeholder — **not** the ₹50k / $1k validation floor) |
| Asset mix (product / collection / sale) | Engineering default percentages — sum to **100%** |
| Influencer tier mix (nano → celebrity) | Engineering default percentages — sum to **100%** |
| Campaign objective mix (pulse / proof / push / production) | Engineering default percentages — sum to **100%** |
| Utilization | **0%** (nothing booked yet) |
| AI explanation text | Empty until deep scan |

**What they do *not* set:** Final strategic budget. Product example UI shows ₹85,000/mo — that style of number comes from **Prompt 1 after email verify**, not from cold-start templates.

**Important distinction:**

| Concept | Meaning |
| --- | --- |
| **Validation floor** (₹50,000 / $1,000) | Minimum the user is **allowed to edit down to** later — not the starting amount |
| **Cold-start interim amount** | Placeholder so charts render — engineering-defined until product specifies per-industry defaults |
| **Real budget (Phase 2)** | AI-inferred from brand context at deep scan |

Product docs say “Compute Phase 1 Cold Start” but do **not** list exact interim amounts per industry. Engineering will ship sensible defaults; product can refine later without changing the two-phase model.

**Optional later:** a lightweight Gemini pass on surface-scrape text to nudge cold-start mixes — **not required for v1** and still **no second website scrape**.

---

### Template → timeline (at a glance)

```
Surface scan completes
    │
    ├─► Industry routing template applied     (product rules → UI labels/limits)
    │
    └─► Budget cold-start template applied    (engineering → Phase 1 charts)

Email verified
    │
    └─► Deep scan Prompt 1                    (Gemini → real DNA + Phase 2 budget)
```

---

## Budget rules — quick reference


| Rule                                 | Value                            |
| ------------------------------------ | -------------------------------- |
| Minimum monthly budget (user edit)   | ₹50,000 or $1,000                |
| Max budget edits                     | 2 per 30 days                    |
| Minimum per pie-chart bucket         | ₹30,000 or $500                  |
| Interim budget (before email verify) | Template-based placeholder       |
| Real budget (after email verify)     | AI-calculated from brand context |
| Pie chart percentages                | Must total 100% in each chart    |


---

## What is NOT in v1


| Feature                              | Status                                  |
| ------------------------------------ | --------------------------------------- |
| Public profile page (link in Tab 1)  | UI may show link; page not built        |
| Live Instagram / Meta / YouTube data | AI estimates only                       |
| Real escrow and billing              | Placeholder badges                      |
| Handoff to Create Campaign module    | Approve sets status only; no export yet |
| 24-hour automatic Tab 2 refresh      | Manual + first-open refresh; cron later |


---

## Glossary


| Term | Meaning |
| --- | --- |
| Cold start / Phase 1 | Interim budget before deep scan (engineering template) |
| Self-healing / Phase 2 | AI-calculated budget after deep scan |
| Industry routing template | Product rules for Tab 1 Section 4 & 5 labels and limits |
| Budget cold-start template | Engineering placeholder budget/mixes until deep scan |
| Leak card | Tab 2 recommendation |
| Aggregation | Grouping insights into one campaign by objective × tier |
| Archetype | Brand personality bucket (Everyman, Expert, Jester, Rebel) |
| SOV | Share of voice — % of market conversation |
| PDP | Product detail page |


---

## Questions for product?

See [READINESS_COMPARISON.md](./READINESS_COMPARISON.md) for open gaps between product specs and engineering plan.