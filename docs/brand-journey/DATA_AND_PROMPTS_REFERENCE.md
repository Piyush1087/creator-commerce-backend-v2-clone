# Data & prompts reference

Lookup for **AI prompts**, **output limits**, **formulae**, and **field tracing** across the brand journey. Plain names — not code paths.

---

## AI & fetch matrix

| Stage | Parallel (web) | Gemini model (default) | Prompt file | Purpose |
| --- | --- | --- | --- | --- |
| Onboarding — industry gate | Optional homepage extract | gemini-2.0-flash (configurable) | `industry-classifier.prompt.md` | Bucket URL into supported industry |
| Onboarding — surface scan | 3 extract bundles + competitor search | same | `surface-scan-synthesis.prompt.md` | Brand + products + competitors JSON |
| Brand Centre — deep scan | — (uses stored scrape) | same | `deep-scan-strategy.prompt.md` | Full DNA + baseline + Phase 2 budget |
| Brand Centre — intelligence | — | same | `intelligence-leaks.prompt.md` | Tab 2 leak cards |
| Brand Centre — planner | — | same | planner-aggregator | Tab 3 planner card |
| Bridge → UCE | — | — | — | Fixed formulae only |
| UCE manual wizard | — | — | — | Form validation only |

**Full prompt text** (standalone package): `PROMPTS_AND_AI_INSTRUCTIONS.html` in the `word-google-docs` folder.

**What is sent into each AI step:** `PARALLEL_AND_DATA_INPUTS.html`.

In production, instructions are stored in server prompt files; the HTML copies are for product/QA without repository access.

---

## Formulae cheat sheet

| Name | Formula / rule | Used when |
| --- | --- | --- |
| Cold start budget INR | **₹85,000** / month | After surface scan, INR brands |
| Cold start budget USD | **$5,000** / month | After surface scan, default |
| Cold start mixes | Fixed % tables per routing type; each of asset/tier/objective sums to **100%** | Event 1 |
| Phase 2 budget | From Gemini deep scan `financials` (no fixed number) | Event 2 |
| Budget floor INR / USD | ₹50k / $1k minimum monthly ceiling | User edits budget |
| Mix slice floor | Each non-zero slice ≥ ₹30k / $500 implied | User edits mixes |
| Lift eviction | Drop intelligence cards with **&lt; 1%** projected lift | Event 3 |
| Bridge budget pool | **1st number × 2nd number** in budget text | Launch signal |
| Bridge sub-ceiling | 15% of pool (computed, not stored) | Launch signal |
| Bridge timeline | evergreen / date / `N days` | Launch signal |
| Objective map | Production→sales, Pulse→traffic, Proof→awareness | Launch signal |
| Planner commitment check | Σ(max allocation × qty) ≤ monthly budget | Approve card |
| Utilization % | (booked + spent) ÷ ceiling × 100 | Tab 1 budget display |

---

## Surface scan — Gemini limits

| Field | Limit |
| --- | --- |
| Products | max **6** |
| Competitors | max **5** |
| Locations | max **12** |
| Active offers | max **8** |
| Social links | max **8** |
| Primary hex colours | max **5** |
| Tone tags | max **3** (80 chars each) |
| Aesthetic tags | max **2** |
| Brand name | 1–200 chars |
| Tagline | 300 chars |
| Short description | 500 chars |
| Persona age range | 13–99 |

---

## Deep scan — notable persisted fields

| UI area (Tab 1) | Stored as (friendly) |
| --- | --- |
| Brand story / narrative | Brand profile strategic fields |
| Personas | Audience personas table |
| Selling points (≤3 per product) | Offerings |
| Promo offers | Brand offers table |
| Monthly budget | Budget configuration — Phase 2 |
| Donut charts | Asset / tier / objective mix JSON |
| Tab 2 baseline | Intelligence baseline (growth, health, SOV) |

---

## Intelligence leak card — fields

| UI on card | Stored as (friendly) |
| --- | --- |
| Title | Insight title |
| Short text | Short description |
| Priority | Priority rank |
| Funnel bucket | Leak bucket enum |
| Lift % | Projected lift percentage |
| Drawer body | Drawer deep dive JSON |
| Status | Pending / pushed to planner / discarded |
| Archived flag | Is archived |

---

## Planner card — fields

| UI on card | Stored as (friendly) |
| --- | --- |
| Card type | New campaign / suggested update / auto-pause log |
| Hook | AI context hook |
| Objective & tier | Campaign metadata JSON |
| Budget range | Min/max in metadata |
| Deadline | Metadata |
| Assets & briefs | Assets and briefs matrix JSON |
| Source leak | Link to performance leak id |
| Workflow status | Draft / approved / etc. |

---

## Bridge → UCE field map

### Launch signal → UCE

| Bridge input | UCE campaign area | UCE field (friendly) |
| --- | --- | --- |
| campaign_name | Campaign | Name |
| assigned_macro_objective | Strategy | Core objective (mapped) |
| timeline_expression | Strategy | Timeline type, dates, dynamic days |
| industry_sector | Targeting | Industry vertical |
| raw_budget_expression → formula | Commercials | Total campaign budget pool |
| — | Campaign | Status = Draft |
| — | Commercials | Defaults: negotiable, 30% advance, Net 30 |

### Inject signal → UCE

| Bridge input | UCE area | Field (friendly) |
| --- | --- | --- |
| product_name | Product | Product name |
| estimated_base_price | Product | Cost per unit |
| (generated) | Product | SKU code |
| creative_briefs[].brief_name | Brief | Internal title |
| raw_strategic_context | Brief | Creative guidelines |
| deliverable_type (mapped) | Brief | Platform + deliverable tags |

---

## End-to-end trace table (happy path)

| Step | Screen | User-visible examples | How produced | Stored (table) |
| --- | --- | --- | --- | --- |
| 1 | Start | URL field | User input | discovery_leads |
| 2 | Scan | (spinner) | Parallel + Gemini surface | brand_profiles, offerings, competitors, locations |
| 2b | — | — | Cold start templates | brand_budget_configurations (Phase 1) |
| 3 | Brand DNA | Name, colours | Load scan | brand_profiles |
| 4 | Catalogue | Product grid | Load scan | offerings |
| 5 | Competitors | Competitor list | Load scan | competitors |
| 6 | Verify | Email OTP | User + verify API | brand_profiles (verified), brand_centre_jobs |
| 7 | Pricing | Trial | Registration API | organizations, users, brand_subscriptions |
| 8 | Tab 1 | DNA + budget | Deep scan Gemini P1 | personas, offerings, budget Phase 2, intelligence_baselines |
| 9 | Tab 2 | Leak cards | Gemini P2 | performance_leaks |
| 10 | Tab 3 | Planner card | Gemini P3 | planner_cards |
| 11 | Launch | — | Bridge formulae | uce_campaigns + children, bridge ledger |
| 12 | UCE detail | Campaign UI | Load UCE APIs | (read same tables) |

---

## Co-pilot response formats (future)

Not part of brand journey implementation today. See `docs/chat-engine/` when chat engine ships.

---

## Related engineering docs

| Topic | Location |
| --- | --- |
| Surface scan detail | `docs/brand-onboarding/SURFACE_SCAN_AND_PROMPTS.md` |
| Brand Centre prompts | `docs/brand-centre/PROMPT_ALIGNMENT.md` |
| Brand Centre requirements | `docs/brand-centre/REQUIREMENTS.md` |

This reference is the **journey-level** summary; those docs go deeper on single modules if engineers need them.
