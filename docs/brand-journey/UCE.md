# UCE (Universal Campaign Engine)

Campaign workspace **after** onboarding and Brand Centre — list, detail, manual create, and post-bridge management.

---

## Two ways to get a campaign

| Path | How | What you get |
| --- | --- | --- |
| **Bridge** | Brand Centre Tab 3 → Launch | Draft campaign with products/briefs pre-filled; narrower targeting defaults |
| **Manual** | UCE list → Create new campaign wizard | Draft campaign from full 3-step form; reporting snapshot created |

Both paths use the **same list and detail screens** afterward.

---

## Campaign list

**Route:** `/brand/uce/campaigns`

### What you see

| Area | Data |
| --- | --- |
| **Operations tab** | Campaign name, objective label, product count, active/paused toggle, mini pipeline (prospects / applicants / active collabs), spend vs budget pool |
| **Financial tab** | Spend-focused columns and aggregates |

**Actions:**

- Click row → detail page
- **Create new campaign** → manual wizard (not from Brand Centre)

Bridge campaigns appear here as **Draft** once Launch completes.

---

## Campaign detail

**Route:** `/brand/uce/campaigns/:id`

### Zone 1 — Header & strategy

| Block | Fields shown |
| --- | --- |
| Header | Name, status (Draft / Active / Paused / Completed), spend vs total budget pool |
| Strategy | Core objective, timeline type, fixed dates or dynamic day limit, platform deliverables |
| Targeting | Industry, creator tiers, age range, gender, geographies, archetypes |
| Commercials | Compensation style, platform fees, advance %, payout terms |

**Bridge defaults:** industry from bridge sector; age 18–65; gender all; many targeting fields empty until user edits.

### Zone 2 — Products & briefs

| Item | Fields |
| --- | --- |
| Product | Name, SKU, cost per unit, inventory count, active flag |
| Brief | Internal title, creative guidelines, required platforms, deliverable tags |

**Actions:**

- Add product (can pull from Brand Centre DNA catalogue)
- Create brief via briefing wizard drawer
- View product / brief detail drawers

### Zone 3 — Pipeline

Tabs for prospects, applicants, active collaborations, reporting — each loads pipeline-specific data.

**Side note:** After bridge, user must usually **activate** campaign (status toggle) before it behaves as live in marketplace flows.

---

## Manual create wizard (no Brand Centre)

**Steps (simplified):**

1. Strategy — objective, timeline, channels  
2. Targeting — archetypes, tiers, locations, demographics  
3. Commercials — budget pool, fees, advance, payout terms  

**Saved on submit:**

- Full campaign shell + strategy + targeting + commercials
- **Reporting snapshot** row (bridge path does **not** create this)

User lands on same detail page; products/briefs added afterward manually.

---

## Bridge vs manual — comparison

| | Bridge launch | Manual wizard |
| --- | --- | --- |
| Entry | Planner Launch | List → Create |
| Budget | Parsed from text formula | User enters |
| Targeting | Industry + defaults | User configures |
| Products/briefs | Auto-injected | Added on detail page |
| Reporting snapshot | No | Yes |
| Planner approval | Required | Not used |

---

## Screen ↔ data quick reference

| Screen | Main tables |
| --- | --- |
| List | Campaigns, performance aggregates |
| Detail shell | Campaign, strategy, targeting, commercials |
| Products zone | Campaign products |
| Briefs zone | Campaign briefs |
| Pipeline tabs | Collaborations, applicants, reporting |

---

## QA after bridge happy path

- [ ] Detail shows Draft status
- [ ] Budget pool matches bridge calculation
- [ ] Product count = inject count
- [ ] Each product has at least one brief from inject
- [ ] Objective matches planner macro mapping
- [ ] Toggle to Active works (if business rules allow)
- [ ] List row shows same counts and spend (zero initially)

---

## QA manual path

- [ ] Wizard creates campaign without planner card
- [ ] All wizard fields appear on detail
- [ ] Reporting tab has seeded snapshot
- [ ] Add product + brief from detail persists
