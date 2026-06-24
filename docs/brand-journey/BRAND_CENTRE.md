# Brand Centre

What happens in **Tab 1 (Brand DNA)**, **Tab 2 (Intelligence & Gaps)**, and **Tab 3 (Campaign Planner)** — including background jobs and AI steps.

**Prerequisite:** Onboarding surface scan complete. **Deep scan** (Event 2) starts after email verification.

---

## Four events (timeline)

```text
Event 1 — Cold start     →  right after surface scan (instant, no AI)
Event 2 — Deep scan      →  after email verify (background, Gemini)
Event 3 — Intelligence   →  when Tab 2 opened / stale (background, Gemini)
Event 4 — Planner        →  user moves leak to planner (background, Gemini)
```

---

## Tab 1 — Brand DNA

### What you see

| Section | Content |
| --- | --- |
| **Brand identity** | Logo, name, website, market, industry, social handles, tagline, description, tone, colours, fonts |
| **Catalog** | Products/collections and promo offers (layout depends on industry routing) |
| **Strategic budget** | Monthly ceiling, utilization %, three donut charts (asset / tier / objective) |
| **Account & setup** | Placeholder escrow/Meta, subscription tier, outreach quota |
| **Banner** | “Deep scan in progress” while Event 2 runs |

### When deep scan is running

- Screen polls status every ~8 seconds.
- When complete, DNA sections refresh with richer data (personas, enriched products with selling points, Tab 2 baseline seeded).

### Event 2 — Deep scan (Gemini Prompt 1)

**Input (not a new web crawl):** stored surface scrape text + product/competitor JSON + brand URL + routing type + country/currency.

**Parallel:** not used in the worker today (scrape already in database from onboarding).

**Gemini output (simplified):**

- Richer brand narrative and strategic DNA
- Visual identity refinements
- Up to 3 audience personas
- Products with up to **3 selling points** each
- Promo offers ledger
- Financial suggestion: monthly budget + strategy mixes
- Tab 2 seed: growth levers, baseline health metrics, share-of-voice snapshot

Prompt: `deep-scan-strategy.prompt.md`

**Saved:**

- Brand profile updated; scan status → **Ready**
- Personas replaced
- Offerings/offers updated
- Budget row upgraded to **Phase 2 self-healing** with AI budget and mixes
- Intelligence baseline row created

**Side note:** If deep scan fails, status reverts to surface-complete; user can retry from API.

### Budget phases

| Phase | When | Monthly amount | Mixes |
| --- | --- | --- | --- |
| **Phase 1 — Cold start** | After surface scan | Fixed: ₹85k or $5k | Fixed templates by routing type |
| **Phase 2 — Self-healing** | After deep scan | AI-suggested (or user-edited) | AI-suggested or user-edited |

**Budget rules (when user edits ceiling or mixes):**

| Rule | INR | USD |
| --- | --- | --- |
| Minimum monthly budget | ₹50,000 | $1,000 |
| Minimum per active mix slice | ₹30,000 implied | $500 implied |
| Mix groups | Asset, tier, objective each must total **100%** | |
| Ceiling edits | Max **2 per 30 days**; cannot go below already “booked” amount | |

**Utilization shown:** (booked + spent) ÷ monthly ceiling × 100%.

---

## Tab 2 — Intelligence & Gaps

### Gate

Tab 2 data is **blocked** until deep scan status is **Ready**.

### What you see

**Zone 1 — Dashboard (from deep scan baseline):**

- Growth opportunities (revenue lift %, levers: PDP, creator roster, paid ads)
- Baseline health (reach, engagement, overlap, content quality, brand safety)
- Competitive intelligence (share of voice, themes, archetype matrix)

**Zone 2 — Actionable cards (“leaks”):**

- Title, short description, priority, funnel bucket, estimated lift %
- **View details** drawer with deeper copy
- **Approve & move to planner** → starts Event 4

Footer shows how many cards were already moved to planner.

### Event 3 — Intelligence refresh (Gemini Prompt 2)

**When it runs automatically:**

- First time Tab 2 loads after ready, or
- No active leak cards, or
- Last refresh older than **24 hours**

**Input:** baseline health JSON, share of voice JSON, strategy mix JSON.

**Gemini output:** list of leak cards (title, bucket, lift %, drawer content, etc.).

Prompt: `intelligence-leaks.prompt.md`

**Fixed rules after Gemini:**

- Cards with projected lift **under 1%** are dropped
- If nothing left, system adds up to **3 fallback** deterministic cards

**Saved:**

- Replaces leak cards still in “pending review” state
- Does **not** delete cards already moved to planner or discarded
- Updates “last refreshed” timestamp on baseline

**While job runs:** Tab 2 polls every ~2 seconds.

### Session / archive behavior

**Side note:** On logout or 30 minutes inactive, leaks that were **moved or discarded** may be archived. Pending review cards stay.

Archived list only shows last **30 days**.

---

## Tab 3 — Campaign Planner

### What you see

| Card colour / type | Meaning |
| --- | --- |
| **Green — New campaign** | New draft to launch in UCE |
| **Amber — Suggested update** | Add assets to an existing campaign |
| **Auto-pause log** | System notice (acknowledge only; not launchable) |

Each card shows: hook text, objective, creator tier, asset/brief summary, budget range, deadline, workflow status.

**Empty state:** Complete Tab 2 refresh and move at least one leak to planner first.

### Event 4 — Planner aggregate (Gemini Prompt 3)

**Trigger:** User clicks **Approve & move to planner** on a Tab 2 leak.

**Input:** brand DNA subset, that leak’s details, existing active planner cards.

**Gemini rules (from prompt):**

- One campaign base per **objective × creator tier** pair
- If matching card exists → **suggested update** with target campaign id
- Else → **new campaign** card
- Outputs campaign metadata (audience, budget min/max, deadline) and assets/briefs matrix

Prompt: `planner-aggregator.prompt.md`

**Saved:**

- New planner card row
- Leak marked as pushed to planner

**While job runs:** Tab 3 polls every ~2 seconds.

### Launch (handoff to bridge)

**Green card — Launch:**

1. Approve card (budget **circuit breaker**: sum of max allocations must fit monthly budget)
2. Bridge creates UCE campaign + injects each asset
3. Navigate to UCE detail

**Amber card — Update:** inject only, into existing campaign id.

**Side note:** Discard on planner cards is **disabled** in UI today.

→ Bridge detail: [BRIDGE_TO_UCE.md](./BRIDGE_TO_UCE.md)

---

## Screen ↔ data quick reference

| Tab | Primary database areas |
| --- | --- |
| Tab 1 | Brand profile, personas, offerings, offers, competitors, budget configuration |
| Tab 2 | Intelligence baseline, performance leaks |
| Tab 3 | Planner cards |

---

## QA focus

| Check | Expected |
| --- | --- |
| Tab 1 before verify | May lack deep-scan richness; banner after verify |
| Tab 2 too early | Error or empty until Ready |
| Move to planner | Tab 3 gains card within polling window |
| Launch | UCE campaign id in URL; planner card approved |
| Budget breaker | Launch fails if card allocations exceed monthly ceiling |

---

## Polling summary

| Job | Tab | Interval | Stops when |
| --- | --- | --- | --- |
| Deep scan | 1 | ~8s | Job complete or failed |
| Intelligence refresh | 2 | ~2s | Job complete |
| Planner aggregate | 3 | ~2s | Job complete |
