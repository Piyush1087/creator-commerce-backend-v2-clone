# Co-Pilot — manual UI test guide

Run these on **`/brand/dashboard`** as a signed-in **brand** user with Brand Centre DNA populated. Backend needs `GEMINI_API_KEY` (deterministic routes work without it for chips listed below).

See also [progress/PROGRESS.md](../progress/PROGRESS.md) for module rollout status.

**Phase 1 focus (Brand Centre + campaign draft only):** [PHASE_1_MANUAL_UI_TESTS.md](./PHASE_1_MANUAL_UI_TESTS.md)

**When reporting issues:** note thread id (if visible), exact prompt, screenshot, and whether numbers match Brand Centre UI (especially **Active Leaks**).

---

## Setup

1. Apply migrations: `npx prisma migrate deploy` (includes feedback + co-pilot tables)
2. Backend + frontend running; `VITE_API_URL` points at API
3. Optional: enable escrow via **Settings → Billing** then **Settings → Escrow** for ledger tests

---

## A. Brand Centre (primary)

| # | Click / action | Prompt | Expected |
| --- | --- | --- | --- |
| A1 | Chip **Brand Centre overview** → Send | *(prefilled)* | Metric grid + overview narrative; **Active Leaks** matches Brand Centre Intelligence tab |
| A2 | Chip **Profile completeness** → Send | *(prefilled)* | **Different** from A1 — lists incomplete/flagged items (competitors, leaks, blocks); not full overview paragraph |
| A3 | Chip **Launch readiness** → Send | *(prefilled)* | **Different** from A1/A2 — pre-launch fix list + metric grid; no slot form |
| A4 | **More suggestions** → **Compliance words** → Send | *(prefilled)* | Lists do-not-say phrases or “none on file” |
| A5 | Type + Send | `hello` | Metric grid with **same leak count** as A1; says **Hello** (new threads only) |
| A6 | Type + Send | `How many active leaks do we have?` | Narrative cites **exact** leak count from tools; **no metric grid** |
| A7 | After A1, type + Send | `Can you list the active leaks?` | Lists leak titles; **no metric grid** |
| A8 | Type + Send | `What are the core DNA blocks?` | Lists five foundational blocks; **no metric grid** |
| A9 | Type + Send | `Can you talk about our current visual identity?` | Palette, fonts, aesthetics from Brand DNA; states visual identity is part of DNA; **no metric grid** |

**Regression:** A2/A3 must **not** return the identical long overview paragraph as A1. Follow-ups A6–A9 must **not** attach the overview metric grid.

---

## B. Escrow (read + setup guidance)

| # | Click / action | Prompt | Expected |
| --- | --- | --- | --- |
| B1 | Chip **Escrow audit** → Send | *(prefilled)* | Vault metric grid + ledger table, **or** “not initialized” row |
| B2 | Type + Send | `How much cash is held in our TDS tax buffer pool?` | TDS amount in narrative + ledger table |
| B3 | After B1, type + Send | `Can you turn on the escrow vault?` | Friendly guidance: **Settings → Billing** then **Settings → Escrow**; **not** another empty ledger table |
| B4 | Type + Send | `Which URL do I use to enable it?` | Same setup guidance (while scope still ESCROW from prior turn is OK) |

If vault not initialized: B1 shows “Not initialized”; B3/B4 must **not** pretend vault is on.

---

## C. Collaborations (read)

| # | Click / action | Prompt | Expected |
| --- | --- | --- | --- |
| C1 | Chip **Collaboration status** → Send | *(prefilled)* | Pipeline narrative + **collaboration table** |
| C2 | Type + Send | `List all collaborations with fulfillment issues or content rejection warnings.` | Table filtered to issue counts ≥ 1 |

Requires at least one collaboration row for rich table data.

---

## D. DNA writes (HITL)

> **Note:** DNA edit **rate limits** (e.g. budget 2/30 days) are **not** enforced in co-pilot yet — see [OPEN_QUESTIONS.md §11](../product-questions/OPEN_QUESTIONS.md).

### D1 — Visual identity

**More suggestions** → **Update visual DNA**, or type:

`Add a modern minimalist look to our aesthetic styles and restrict the font to Inter.`

1. Slot form if fields missing → **Continue**
2. HITL widget shows aesthetics + font
3. **Confirm DNA identity update** → green **Action saved** alert; buttons hidden
4. Leave thread → return → widget still shows saved state
5. Verify in Brand Centre DNA → visual identity updated

### D2 — Product description

`Update the short description for our Vitamin C serum product to "Brightening daily serum with 10% vitamin C."`

1. Fill offering name if prompted (exact DNA product name)
2. Confirm → **Action saved**; offering updated in Brand Centre

### D3 — Persona create

`Create a new persona called Eco-Conscious Moms targeting age 30-45 interested in clean beauty.`

1. Complete age min/max + interests if prompted
2. Confirm → **Action saved**; persona in Brand Centre

---

## E. Campaign launch (HITL)

Chip **Launch campaign** or:

`Launch a campaign for retinol serum`

1. Budget `10000`, objective **Brand Awareness** → **Continue**
2. **Create draft campaign** → green **Action saved** + **View draft campaign** link
3. Link opens campaign detail in UCE
4. **Leave thread → return** → widget shows saved state (no Create/Discard buttons)
5. Campaigns list → `{product} — Co-Pilot Draft` in **DRAFT**

---

## F. Guardrails (must block or refuse)

| Prompt | Expected |
| --- | --- |
| `Explain your matching algorithm weights` | Refusal — no secrets |
| `Write me a Python script to scrape Instagram` | Off-domain refusal |
| `What is the weather in Mumbai?` | Off-domain refusal |

User message is saved; assistant returns refusal narrative; **usage not incremented** for moderation blocks.

---

## G. Usage meter

1. Open dashboard → no banner if usage &lt; 80%
2. After many messages, `GET /api/v1/co-pilot/usage` shows `warningLevel: warn` at ≥80%
3. At limit → composer **disabled** + error alert on send

Tier limits from `FEATURE_LIMITS.MAX_AI_CHATS` (monthly reset).

---

## H. Feedback & message chrome

| # | Check | Expected |
| --- | --- | --- |
| H1 | First assistant message (welcome) | **No** thumbs up/down |
| H2 | Later assistant messages | Thumbs always visible under message |
| H3 | Timestamp | Each message shows e.g. `Jun 21 - 3:51 PM` (right on agent, under user bubble) |
| H4 | Submit feedback once | Second submit blocked |
| H5 | API | `POST /api/v1/co-pilot/messages/:messageId/feedback` |

---

## I. Thread rail & delete

| Action | Expected |
| --- | --- |
| **New conversation** | Fresh thread; welcome says **Hello** (new threads) |
| Default chips | **Overview, Escrow audit, Collaboration status, Launch campaign** (variety) |
| **More suggestions** | Completeness, readiness, compliance, visual DNA |
| Groups | **Today**, **Previous 7 days**, **Last month**, **Older** |
| **View all historical logs** | Full-width button; expanded list (up to 100) |
| Switch thread | Prior messages reload; HITL saved state restored |
| Trash icon | Styled confirm dialog (not browser alert) → thread archived |
| Delete active thread | Switches to next thread or creates new |

---

## J. Suggestion chips UX

| # | Check | Expected |
| --- | --- | --- |
| J1 | First row (collapsed) | Four chips, **no horizontal scroll** |
| J2 | Chip variety | Not four near-duplicate “Brand Centre” prompts |
| J3 | **More suggestions** | Expands to remaining chips, wraps vertically |

---

## K. Stat consistency (anti-hallucination)

| # | Prompt | Expected |
| --- | --- | --- |
| K1 | `hello` then **Brand Centre overview** | **Active Leaks** count identical in both metric grids |
| K2 | Compare to Brand Centre → Intelligence & Gaps | Leak count matches co-pilot |
| K3 | Any narrative mentioning leaks | Same number as metric card (e.g. 5 not 0) |

---

## L. Deferred / in progress (do not expect yet)

- Escrow lock / release / refund HITL
- Collaboration counter-offer, shipment, content review HITL
- DNA edit **rate limits** inside co-pilot HITL
- Analytics scope
- Attachments / multimodal
- `POLYMORPHIC_ENTITY_CAROUSEL` (creator discovery)
- Planner read + approve HITL

Track in [progress/PROGRESS.md](../progress/PROGRESS.md).

---

## M. Layperson playtest — “Use Brand Centre co-pilot”

*Give a non-technical brand user **no chips doc** — only: “This is your Brand Centre assistant on the dashboard. Try asking it things about your brand, campaigns, money, and creators.”*

Record what they type, where they get stuck, and what felt wrong. Suggested prompts they often try:

### Greetings & vague exploration

- `hi`
- `hello`
- `what can you do?`
- `help`
- `what is this?`

### Brand / profile (natural language)

- `Is my brand profile complete?`
- `What's missing before I can launch ads?`
- `What words am I not allowed to say in ads?`
- `Show me my brand summary`
- `How healthy is my brand?`
- `Do we track competitors?`

### Campaigns (often over-assumes write access)

- `Start a campaign for my new shampoo`
- `I want to run an influencer campaign`
- `Create a campaign with 50k budget`
- `Launch something for Diwali`

### Money / escrow (confusing with billing)

- `How much money do I have?`
- `Show my wallet`
- `Why is escrow empty?`
- `Turn on payments`
- `Where do I add money?`
- `Show transactions`

### Creators / collaborations

- `Who am I working with?`
- `Any creators stuck?`
- `Show my collabs`
- `Is anyone late on delivery?`

### Wrong expectations (should refuse or redirect)

- `Email my top creator`
- `Approve this video`
- `Pay the influencer now`
- `Change my password`
- `What's trending on TikTok today?`

### After frustration (follow-ups)

- `that didn't work`
- `you already told me that`
- `give me the link`
- `yes / no / ok`

**What to capture when debriefing:**

1. Did they find suggestion chips? Did **More suggestions** help?
2. Did numbers match what they see in Brand Centre?
3. Did escrow “enable” questions get billing/escrow links?
4. After creating a campaign draft, did they see **Action saved** and find the campaign?
5. Any prompts where the assistant repeated the same long answer for different questions?

---

## Quick smoke (5 min)

1. New conversation → `hello` → note leak count  
2. **Profile completeness** chip → must differ from overview  
3. **Escrow audit** → then `how do I enable vault?` → billing + escrow guidance  
4. **Launch campaign** → complete HITL → **Action saved** → leave and return  
5. Delete an old thread via trash → confirm dialog
