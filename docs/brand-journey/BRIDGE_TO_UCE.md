# Bridge to UCE

How **Tab 3 Launch** turns a planner card into **UCE campaign rows**.

**Entry point:** Brand Centre → Campaign Planner → **Launch** on a green **New campaign** card.

---

## User action

1. User clicks **Launch** on orchestrated draft.
2. Toast: launching campaign.
3. App opens **UCE campaign detail** for the new id.

**Alternate:** **Update** on amber **Suggested update** card → injects into existing campaign (no new shell).

---

## API sequence (happy path)

| Order | What happens |
| --- | --- |
| 1 | Planner card **approved** (budget safety check) |
| 2 | Brand DNA read (brand id + industry routing) |
| 3 | **Launch signal** → creates campaign shell |
| 4 | **Inject signal** × number of assets (max 10) → products + briefs |
| 5 | Planner dashboard refreshes |
| 6 | Navigate to UCE detail page |

Each bridge call is logged in the **bridge signals ledger** (success or validation failure).

---

## Launch signal — fields sent

| Field | Plain meaning | Example |
| --- | --- | --- |
| Campaign name | Title | From planner card hook text |
| Brand id | Brand profile uuid | From DNA |
| Industry sector | Bucket for targeting | Mapped from brand routing (D2C, healthcare, SaaS, offline) |
| Macro objective | High-level goal | Production / Pulse / Proof push |
| Raw budget expression | Text with two numbers | `"$3500 per creator allocation for 4 creators"` |
| Timeline expression | Deadline or evergreen | Card deadline or `"evergreen"` |

---

## Inject signal — fields sent (per asset)

| Field | Plain meaning |
| --- | --- |
| Campaign id | From launch response |
| Product name | Asset product name from planner |
| Estimated base price | Max budget from card (fallback if missing) |
| Strategic context | Card hook text (brief guidelines) |
| Creative briefs | At least one brief name |

**Side note — current shortcuts:**

- Deliverable type sent as **Reel video** (not read from planner card enum)
- Compensation type sent as **Barter** (not stored on UCE brief from bridge)

---

## Formulae (fixed rules, no AI)

### Budget from text string

1. Find **all numbers** in the budget expression.
2. Need at least **two numbers** or launch fails.
3. **First number** = rate per creator.
4. **Second number** = number of creators.
5. **Total campaign budget pool** = rate × creators.

**Example:** `$3500 … 4 creators` → 3,500 × 4 = **14,000**

Also calculated but **not saved today:** sub-ceiling = 15% of total pool.

**How frontend builds the string:** max budget per creator from card × `max(1, assets × 2)` as creator count; fallback `$3500` if budget unparseable.

### Timeline parsing

| If expression… | Campaign timeline |
| --- | --- |
| Empty or contains “evergreen” | Open-ended milestones style |
| Valid date | Fixed end date |
| “N days” pattern | Dynamic — N days limit |
| Anything else | Treated as evergreen |

### Objective mapping

| Planner macro | UCE campaign objective |
| --- | --- |
| Production | Sales conversions |
| Pulse | Traffic / clicks |
| Proof push | Brand awareness |

### Deliverable mapping (inject)

| Type | Platform tags |
| --- | --- |
| Reel video | Instagram |
| IG stories | Instagram |
| TikTok post | TikTok |
| YouTube shorts | YouTube |
| Default | Instagram + tag name |

### Product SKU

Generated from product name: uppercase, safe characters, random suffix (for duplicate safety).

---

## What gets created in UCE

### On launch (one time)

| Record | Key values |
| --- | --- |
| Campaign | Name, status **Draft**, linked to brand |
| Performance aggregate | Counters at zero |
| Strategy | Objective, timeline type/dates from parser |
| Targeting | Industry vertical; default age 18–65, all genders; empty tiers/locations unless set elsewhere |
| Commercials | Total budget pool from formula; negotiable compensation; 30% advance; Net 30 terms; fees zeroed |

### On each inject

| Record | Key values |
| --- | --- |
| Product | Name, cost per unit, generated SKU, inventory 0, active |
| Brief(s) | Title, creative guidelines from hook, platform/deliverable tags |

Products and briefs sit under the campaign; briefs are **not** linked to a specific product row in bridge path.

---

## Validation failures

HTTP 422 with tracking id if:

- Campaign name too short
- Budget string has fewer than two numbers
- Brief array empty
- Invalid uuids

**Side note:** Inject blocked if campaign already has **active collaborations** (409).

---

## Planner approve — budget circuit breaker

Before bridge runs, approve step checks:

**Commitment total** = sum over briefs of (max allocation × deliverable quantity).

Must be ≤ remaining monthly brand budget (from Tab 1 budget config).

If it fails, Launch never reaches bridge.

---

## Screen ↔ database

| User sees | Created/updated |
| --- | --- |
| Launch success → UCE page | `uce_campaigns`, strategy, targeting, commercials, products, briefs |
| (internal) | `integration_bridge_signals_ledger` rows per signal |

---

## QA checklist

- [ ] Launch creates exactly 1 campaign + N products/briefs (N = asset count, cap 10)
- [ ] Budget pool on UCE matches rate × creators from planner budget text
- [ ] Objective on UCE matches planner macro mapping
- [ ] Ledger shows synchronized status for launch + injects
- [ ] Update path does not create new campaign id

---

## Not wired from UI today

- **Fast track interrupt** (pause product/brief) — API exists, no Brand Centre button
- Auto-pause log cards — display only
