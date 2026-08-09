# Brand journey — flow overview

One readable path from **brand URL** to **UCE campaign**. Use the chapter docs for detail per module.

---

## The journey in seven beats

```text
1. Enter website URL (onboarding)
2. Surface scan — Parallel reads site, Gemini structures brand data
3. Review DNA, catalogue, competitors (mostly read-only)
4. Verify work email → deep scan job starts in background
5. Brand Centre Tab 1–3 — DNA, intelligence leaks, planner cards
6. Launch on planner card → bridge creates UCE campaign
7. UCE campaign detail — products, briefs, pipeline (still Draft until activated)
```

---

## Beat 1–4: Onboarding

| Step | Screen (app) | What runs | What gets saved |
| --- | --- | --- | --- |
| URL entry | Start / landing | Industry check on URL | Discovery lead |
| Scan | “Analyzing your brand” | Parallel + Gemini | Brand profile, products, competitors, locations, **Phase 1 budget** |
| Brand DNA | Brand DNA tabs | Load profile | Optional edits to name/tagline/description |
| Catalogue | Product catalogue | Load products | *Happy path: no save* |
| Competitors | Competitor intelligence | Load competitors | *Happy path: no save* |
| Verification | OTP email | Email matched to domain | Verified flag + **deep scan queued** |
| Pricing | Founder’s Beta | Create login + trial | Organization, user, subscription trial |
| Social sync | Connect Meta | — | Skip → Brand Centre |

**Key idea:** The heavy AI work at onboarding is the **surface scan**. Deep scan does **not** start until email is verified.

→ Detail: [ONBOARDING.md](./ONBOARDING.md)

---

## Beat 5: Brand Centre (four events)

| Event | When | AI? | Main outcome |
| --- | --- | --- | --- |
| **1 — Cold start** | Right after surface scan | No — fixed templates | Routing type + interim monthly budget + pie-chart mixes |
| **2 — Deep scan** | After email verify | Gemini Prompt 1 | Full DNA, personas, offerings enriched, Tab 2 baseline, **Phase 2 budget** |
| **3 — Intelligence refresh** | Open Tab 2 (auto if stale) | Gemini Prompt 2 | “Leak” insight cards on Tab 2 |
| **4 — Planner aggregate** | “Approve & move to planner” on a leak | Gemini Prompt 3 | Draft card on Tab 3 |

### Tabs at a glance

| Tab | Name | You see |
| --- | --- | --- |
| **1** | Brand DNA | Identity, catalogue sections, strategic budget donuts, account placeholder |
| **2** | Intelligence & Gaps | Performance baseline, competitor view, actionable leak cards |
| **3** | Campaign Planner | Orchestrated drafts (green), pipeline suggestions (amber), auto-pause log |

**Polling:** Tab 1 polls while deep scan runs (~8s). Tab 2 polls while intelligence refresh runs (~2s). Tab 3 polls while planner job runs (~2s).

→ Detail: [BRAND_CENTRE.md](./BRAND_CENTRE.md)

---

## Beat 6: Bridge (planner → UCE)

User clicks **Launch** on a green **New campaign** card on Tab 3.

1. Planner card marked approved (budget safety check).
2. **Launch signal** — creates empty UCE campaign shell (Draft) with strategy, targeting, commercials.
3. **Inject signal** (one per product asset, up to 10) — adds products and briefs under that campaign.
4. App navigates to UCE campaign detail page.

Budget on the campaign is parsed from a text string like *“$3500 per creator allocation for 4 creators”* → total pool = **3500 × 4 = 14,000**.

→ Detail: [BRIDGE_TO_UCE.md](./BRIDGE_TO_UCE.md)

---

## Beat 7: UCE

| Screen | Route | Purpose |
| --- | --- | --- |
| Campaign list | `/brand/uce/campaigns` | All campaigns, spend, pipeline counts |
| Campaign detail | `/brand/uce/campaigns/:id` | Strategy, products, briefs, prospects/applicants/collabs |

Bridge-created campaigns land as **Draft** with products/briefs pre-filled. User can activate from the detail page. They can also **create campaigns manually** from the list without using Brand Centre.

→ Detail: [UCE.md](./UCE.md)

---

## Where AI is used vs fixed rules

| Stage | Parallel (web fetch) | Gemini (AI JSON) | Fixed rules (no AI) |
| --- | --- | --- | --- |
| Onboarding validate | Optional homepage extract for industry | Industry classifier | URL gates, duplicate domain |
| Surface scan | 3 page bundles + competitor search | Surface scan synthesis | Cold start budget & mixes |
| Deep scan | — (uses stored scrape) | Prompt 1 — strategy DNA | Healthcare word filter |
| Intelligence | — | Prompt 2 — leak cards | Drop cards under 1% lift |
| Planner | — | Prompt 3 — planner card | Budget approve math |
| Bridge | — | — | Budget parse, objective maps, SKU generator |
| UCE wizard (manual) | — | — | Form validation only |

Full prompt list and field limits: [DATA_AND_PROMPTS_REFERENCE.md](./DATA_AND_PROMPTS_REFERENCE.md)

---

## Data stores (simple map)

```text
brand_profiles          ← identity, scan status, scrape text
offerings, competitors, locations   ← catalogue from scan
brand_budget_configurations         ← monthly budget & strategy mixes
brand_audience_personas             ← personas (after deep scan)
brand_intelligence_baselines        ← Tab 2 charts
brand_performance_leaks             ← Tab 2 cards
brand_planner_cards                 ← Tab 3 cards
integration_bridge_signals_ledger   ← bridge audit log
uce_campaigns (+ strategy, targeting, commercials, products, briefs)
```

---

## Happy-path testing checklist

- [ ] New domain URL completes scan and shows products on DNA / catalogue
- [ ] After verify, Tab 1 shows deep scan banner then full DNA when ready
- [ ] Tab 2 shows baseline + at least one leak card after refresh
- [ ] Move leak to planner → Tab 3 shows green card
- [ ] Launch → UCE detail with name, budget pool, products, briefs
- [ ] Campaign appears on UCE list as Draft

---

## Common side notes (not failures)

| Situation | What happens |
| --- | --- |
| Same domain scanned again within 7 days | May get **cached** scan — no new Parallel/Gemini call |
| Catalogue / competitor “manual add” in onboarding | UI only — **not saved** to database |
| Pre-production OTP | Stub code `123456` may work when real SMS/email OTP is off |
| Tab 2 before deep scan done | Blocked until scan status is **Ready** |
| Amber “Update” card vs green “Launch” | Update injects into existing campaign ID |
| Bridge inject | Deliverable type hardcoded to Reel + Barter today (not from planner card) |
