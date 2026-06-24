# Onboarding

What happens from **website URL** through **social sync**, before Brand Centre is the main workspace.

---

## Screens in order

| # | Screen name (nav) | What the user does |
| --- | --- | --- |
| 1 | **Start** | Enters brand website URL |
| 2 | *(modals)* | Confirms “2 minute setup” process |
| 3 | **Scan** | Waits while brand is analyzed (progress labels are cosmetic; one API does the work) |
| 4 | **Brand DNA** | Reviews identity, tone, colours, audience |
| 5 | **Product catalogue** | Reviews products from scan |
| 6 | **Competitor intelligence** | Reviews competitors |
| 7 | **Verification** | Enters work email + OTP |
| 8 | **Pricing** | Accepts Founder’s Beta trial |
| 9 | **Social sync** | Connect Meta or skip → **Brand Centre** |

---

## Step-by-step: data in and out

### Start — URL entry

**User enters:** website URL (e.g. `https://mybrand.com`)

**System checks:**

- URL is valid and allowed (not blocked social-only host, etc.)
- Domain not already owned by a verified brand
- Industry bucket (D2C, SaaS, Healthcare, Offline Services, or unsupported)

**Saved:** a **discovery lead** row (URL, industry hint, “identified” status)

**Side note:** If this domain was scanned recently (unverified, within 7 days), user may see **Resume your scan** instead of a full new flow.

---

### Scan — surface scan

**What Parallel does (web fetch, not AI):**

Reads markdown from pages on the **same domain** only, in three bundles:

| Bundle | Typical pages |
| --- | --- |
| Identity & about | Home, about, our story |
| Inventory / catalogue | Shop, collections, products, services |
| Homepage metadata | Home (for competitor hints) |

Optional **competitor web search:** finds 4–6 similar brands with websites (separate Parallel search call).

**What Gemini does:**

Reads all that markdown and returns structured JSON: brand name, tagline, description, colours, fonts, tone tags, up to **6 products**, up to **5 competitors**, up to **12 locations**, audience persona sketch, active offers.

Prompt file: `surface-scan-synthesis.prompt.md`

**Fixed rules after Gemini:**

- Default audience age 25–54 if missing
- Price on products: first number found in price label text
- Currency on products: platform default (usually USD at this stage)

**What gets saved:**

| Data | Where |
| --- | --- |
| Brand name, tagline, description, visuals, audience | Brand profile |
| Full scrape text (for later deep scan) | Brand profile (bundles field) |
| Products | Offerings table (replaces previous) |
| Competitors | Competitors table |
| Locations | Locations table |
| Scan complete flag | Brand profile status = surface complete |
| **Phase 1 cold start budget** | Budget configuration (see formulae below) |

**Side note — cached scan:** If this domain already has a completed surface scan, API returns **cached** — same data loaded, **no new Parallel/Gemini** unless forced.

---

### Brand DNA — review

**Loaded on screen:** everything saved from scan (name, tagline, description, colours, fonts, persona, etc.)

**User can:** edit name (required), tagline, description (max 500 characters on form), visuals, audience — then save.

**“I’ll change later”:** skips save; data unchanged.

---

### Product catalogue & competitors

**Loaded:** products and competitors from scan.

**Side note:** “Manual add” buttons in UI are **not persisted** in the current build — testers should not expect new rows in the database from those actions.

---

### Verification

**User enters:** work email on brand domain + 6-digit OTP.

**Rules:**

- Email domain must match brand website domain (including subdomains in allowed cases)
- OTP expires in 10 minutes; limited wrong attempts in production

**On success:**

| Saved | Meaning |
| --- | --- |
| Verified flag + email on brand profile | Brand ownership confirmed |
| Deep scan job queued | Brand Centre Event 2 starts in background |
| Scan status → deep scan in progress | Tab 1 will show banner until done |

**Side note:** In some environments OTP is stubbed (`123456`) for testing without real email delivery.

---

### Pricing

**Creates:** organization, brand user account, login session.

**Starts:** 30-day Founder’s Beta trial on subscription record.

**User continues to** social sync.

---

### Social sync

**Skip for now** → navigates to **Brand Centre**.

No additional data writes on this screen.

---

## Formulae and fixed rules (onboarding)

### Industry → routing type (for budget templates)

Used when seeding Brand Centre cold start after scan:

| Onboarding industry | Brand Centre routing type |
| --- | --- |
| D2C | D2C skincare template |
| SaaS / AI | SaaS product template |
| Healthcare | Healthcare treatment template |
| Offline services | Offline experience template |

### Phase 1 cold start budget (no AI)

| Currency | Monthly placeholder |
| --- | --- |
| INR | ₹85,000 |
| USD (and default) | $5,000 |

Plus **fixed percentage splits** for three donut charts (asset type, creator tier, objective) — values depend on routing type. Each group sums to **100%**.

Example (D2C): assets 45% product / 30% collection / 25% sale; tiers spread across nano→celebrity; objectives across pulse/proof/push/production.

### Domain handling

- One brand profile per apex domain (e.g. `mybrand.com`)
- Duplicate URL on validate reuses existing discovery lead

---

## Surface scan — Gemini output limits (testing)

| Item | Max count / limit |
| --- | --- |
| Products | 6 |
| Competitors | 5 |
| Locations | 12 |
| Social links | 8 |
| Primary colours | 5 |
| Tone tags | 3 |
| Aesthetic tags | 2 |
| Brand name | 200 characters |
| Short description | 500 characters |
| Tagline | 300 characters |

Full table: [DATA_AND_PROMPTS_REFERENCE.md](./DATA_AND_PROMPTS_REFERENCE.md)

---

## Screen ↔ data quick reference

| Screen | Main data shown | Source |
| --- | --- | --- |
| Scan | Progress only | — |
| Brand DNA | Name, tagline, description, colours, fonts, persona | Brand profile |
| Catalogue | Product names, images, prices | Offerings |
| Competitors | Names, websites, why competitor | Competitors |
| Verification | Email field | — |
| Pricing | Trial copy | — |

---

## What to verify in QA

1. Scan populates at least brand name + some products for a real brand URL.
2. DNA matches what you’d expect from the website roughly.
3. Verify triggers deep scan (Tab 1 banner after login to Brand Centre).
4. Catalogue/competitor counts match API response counts from scan.
5. Cached second scan on same domain does not re-call vendors (faster response, `cached` mode).
