# Co-Pilot Phase 1 — manual UI test guide

**Scope:** Brand Centre Tab 1 (DNA), Tab 2 (Intelligence), Tab 3 (Campaign Planner), and **DRAFT** UCE campaigns only.  
**Out of scope:** Live/paused campaign ops, escrow/collab deep dives, Tab 3 purge, activating campaigns (brand does that manually in Campaigns).

Run on **`/brand/dashboard`** as a signed-in brand user.

See also [MANUAL_UI_TESTS.md](./MANUAL_UI_TESTS.md) for full-platform regression.

---

## Prerequisites (data setup)

| Step | Where | What to set |
| --- | --- | --- |
| P1 | Brand Centre → **Brand DNA** | Narrative, personas, offerings, budget. **Visual identity must be populated** (palette hex list, 1–2 fonts, 2+ aesthetic styles) — required for §1B–1G. |
| P2 | Brand Centre → **Intelligence & Gaps** | Deep scan **Ready**; at least **1 active leak** not yet moved to planner. |
| P3 | Optional | Move one leak via UI first to validate Tab 3 has cards before co-pilot launch tests. |
| P4 | API / env | Backend + `GEMINI_API_KEY`; `VITE_API_URL` points at API. |

---

## Two campaign-creation paths (both required)

| Path | Product alignment | Co-pilot flow |
| --- | --- | --- |
| **A — Planner-first** | Tab 2 leak → Tab 3 card → bridge → UCE **DRAFT** | HITL move leak → async job → list planner → HITL approve & launch |
| **B — Shortcut** | Direct wizard draft (UCE manual path) | Chip **Launch campaign** → slots → HITL **Create draft campaign** |

Neither path activates a campaign. Finish in **Campaigns**; activate manually when ready.

---

## 0. Welcome & conversational polish

| # | Action | Expected |
| --- | --- | --- |
| W1 | **New conversation** | Single welcome message from co-pilot (no metrics). Intent chips visible below composer. |
| W2 | Type `hello` or `test` | Friendly reply (no metric grid). Suggests picking suggested prompts. |
| W3 | Type `asdfgh` or `???` | Polite “didn’t understand” fallback with example topics — not a generic capability dump. |
| W4 | Type a real read query after W3 | Normal deterministic or grounded response (e.g. overview). |

---

## 1. Brand DNA — reads, advisory, and HITL writes

**Where to verify after writes:** Brand Centre → **Brand DNA** tab → visual identity section (palette, fonts, aesthetic styles).

**Co-pilot flow pattern (visual identity):**

```text
Read query     → narrative only (no form, no HITL)
Advisory query → colour suggestions only (nothing staged)
Write query    → slot form (only missing fields) OR straight to HITL if complete
HITL widget    → current vs proposed → Confirm / Discard
Confirm        → Brand DNA updated; widget shows saved state on reopen
```

**Axes:** co-pilot stages only what you asked to change — `palette`, `fonts`, or `aesthetics` — not all three every time.

> **Note:** DNA edit **rate limits** (e.g. budget 2 edits / 30 days) are **not** enforced in co-pilot HITL yet. Visual identity writes are unrestricted for Phase 1 manual testing.

---

### 1A. Brand DNA general reads

| # | Prompt / chip | Expected |
| --- | --- | --- |
| 1.1 | **Brand Centre overview** chip | Metric grid once + narrative; leak count matches Intelligence tab. |
| 1.2 | `List the active leaks` | Leak titles table only; **no** repeat metric grid. |
| 1.3 | `What are the core DNA blocks?` | Five foundational blocks explained; **no** metric grid. |
| 1.4 | `What is incomplete in our Brand DNA?` | Completeness / flagged gaps narrative. |
| 1.5 | `What is our do-not-say list?` | Compliance read from DNA; no write form. |

---

### 1B. Visual identity reads (Tab 1 — palette, fonts, aesthetics)

Use a brand with scan **Ready** and populated visual identity (e.g. Mamaearth-style data).

| # | Prompt | Expected |
| --- | --- | --- |
| 1.6 | `How does my brand's visual DNA look?` | Narrative: aesthetic styles, primary fonts, colour palette (hex). States visual identity is part of Brand DNA (Tab 1). **No** slot form. **No** HITL. |
| 1.7 | `Talk about our visual identity` | Same as 1.6. |
| 1.8 | `What are our current colors and fonts?` | Read narrative with palette + fonts from DNA. **No** write form. |
| 1.9 | `What are the current style and font?` | Read narrative listing aesthetic styles + fonts. **No** aesthetic/font slot form. |

**Pass criteria:** Responses cite **your** Brand Centre data (not generic placeholders). No **Continue** button unless you explicitly asked to change something.

---

### 1C. Palette advisory (suggestions only — no HITL)

| # | Prompt | Expected |
| --- | --- | --- |
| 1.10 | `I want to update the colors — can you suggest some clean pleasing colors based on green and teal palettes that pop?` | Narrative with **5 green–teal hex suggestions** (e.g. `#0D9488`, `#14B8A6`, `#059669`, …). States nothing changes until you confirm. May include example “change palette to …” phrasing. **No** slot form. **No** HITL widget. |
| 1.11 | `Recommend a colour palette for our brand` | Same advisory pattern (suggestions only). |

**Pass criteria:** Brand Centre palette **unchanged** after 1.10 / 1.11.

---

### 1D. Palette write (HITL — axis: `palette`)

| # | Prompt | Expected |
| --- | --- | --- |
| 1.12 | `Change palette to #0D9488, #14B8A6, #059669, #34D399, #F0FDFA` | Skips slot form (hex in message). **HITL widget** shows: `Update scope: palette`, **current palette**, **new palette** (the hex list). Buttons: **Confirm DNA identity update** / **Discard changes**. |
| 1.13 | Click **Confirm DNA identity update** | Green **Action saved** alert; confirm/discard hidden. Narrative confirms palette updated. |
| 1.14 | Brand Centre → Brand DNA | Colour palette matches new hex values. |
| 1.15 | Reopen co-pilot thread | HITL widget still shows **saved** state (not Create/Discard again). |

**Slot path (no hex in message):**

| # | Prompt | Expected |
| --- | --- | --- |
| 1.16 | `Update our colour palette` | Slot form with **one** field: **Colour palette (hex codes, comma-separated)**. **No** font or aesthetic fields. |
| 1.17 | Enter ` #0D9488, #14B8A6, #059669 ` → **Continue** | HITL widget with current vs new palette → confirm as 1.13–1.15. |

---

### 1E. Font-only write (HITL — axis: `fonts`)

| # | Prompt | Expected |
| --- | --- | --- |
| 1.18 | `Change font to Inter` | **No** slot form. HITL shows `Update scope: fonts`, **current fonts**, **new primary font: Inter**. **No** aesthetic style field. |
| 1.19 | Confirm | Fonts updated; secondary font preserved from previous DNA (or same as primary if none). Verify in Brand Centre. |
| 1.20 | `Can you change font to Roboto?` | Same font-only HITL path (parses `change font to …`). |

**Slot path:**

| # | Prompt | Expected |
| --- | --- | --- |
| 1.21 | `Update our primary font` | Slot form: **Primary font** only. |
| 1.22 | Enter `Inter` → **Continue** | HITL → confirm → Brand Centre fonts updated. |

---

### 1F. Aesthetic style write (HITL — axis: `aesthetics`)

| # | Prompt | Expected |
| --- | --- | --- |
| 1.23 | `Add a modern minimalist look to our aesthetic styles` | HITL or slot (if style not parsed). On confirm: new style **appended** to existing aesthetics (not a full replace). |
| 1.24 | Brand Centre → Brand DNA | Aesthetic list includes **Modern minimalist** (or entered value) plus prior styles. |

**Chip path:**

| # | Prompt / chip | Expected |
| --- | --- | --- |
| 1.25 | **More suggestions** → **Update visual DNA** | Slot form for missing fields (often aesthetic + font if chip text is generic). Fill only what you intend to change, or use typed prompts in 1.12–1.24 for axis-specific tests. |

---

### 1G. Clarification refinement (mid-conversation correction)

Simulates the “wrong form opened” recovery flow.

| # | Steps | Expected |
| --- | --- | --- |
| 1.26 | Send `Update our colour palette` → slot form appears with palette field | Palette slot only (or palette + others if message ambiguous). |
| 1.27 | Without filling, send `Not style but font` | Session **refines** to font-only: aesthetic slot removed; **Primary font** slot shown (or HITL if font already in message). |
| 1.28 | Enter `Inter` → **Continue** → confirm | Only fonts change; palette and aesthetics unchanged in Brand Centre. |

| # | Steps | Expected |
| --- | --- | --- |
| 1.29 | Send `Update visual DNA` (generic) → may open aesthetic + font slots | — |
| 1.30 | Send `Change font to Inter` in same thread | Font-only HITL; does **not** insist on aesthetic style. |

---

### 1H. Other DNA HITL writes (offering + persona)

| # | Prompt | Expected |
| --- | --- | --- |
| 1.31 | `Update the short description for our Vitamin C serum product to "Brightening daily serum with 10% vitamin C."` | Slot if product name missing → HITL **Confirm product description update** → offering updated in Brand Centre. |
| 1.32 | `Create a new persona called Eco-Conscious Moms targeting age 30-45 interested in clean beauty.` | Slots for age min/max / interests if needed → HITL **Confirm persona creation** → persona in Brand Centre. |

---

### 1I. Guardrails & negative cases

| # | Action | Expected |
| --- | --- | --- |
| 1.33 | While a HITL widget is **pending** (not confirmed) | Composer **disabled**; amber banner: “Staged action waiting”; suggestion chips disabled. User must **Confirm** or **Discard** on the widget — typing in the box does nothing. |
| 1.34 | After **Confirm** or **Discard** on the widget | Composer re-enables; user can send the next message. |
| 1.35 | `Can you update font to something more modern?` | Opens **Primary font** slot (not HITL with literal “something more modern”). Enter `Inter` → Continue → HITL → confirm. |
| 1.36 | After advisory colours, send `Can you update to this?` | Prompts you to paste the exact hex list (deterministic), not a broken write. |
| 1.37 | Stage a DNA write → click **Discard changes** | Session cleared; Brand Centre unchanged; composer re-enables. |
| 1.38 | Confirm a DNA write → click confirm again on same widget | Error or buttons already hidden — no double-apply. |

---

### 1J. Visual DNA quick smoke (~5 min)

1. **1.6** — read visual DNA  
2. **1.10** — advisory colours (verify DNA unchanged)  
3. **1.18** — font-only HITL → confirm → check Brand Centre  
4. **1.12** — palette HITL → confirm → check Brand Centre  
5. Reopen thread — HITL saved states persist  

---

## 2. Intelligence & Gaps (Tab 2) — leaks & move-to-planner

**Prerequisite:** Brand Centre → **Intelligence & Gaps** → deep scan **Ready** with **≥1 active leak** not yet pushed to planner (P1 + P2).

**Flow:** list leaks (read) → stage move-to-planner (HITL) → confirm → **live SSE job status** in feed → follow-up when planner card is ready.

| # | Prompt / chip | Expected |
| --- | --- | --- |
| 2.1 | `list leaks` or `List the active leaks` | Table of **real DB leaks** (bucket, priority, planner status). No HITL. |
| 2.2 | `can you approve and pass Refine Messaging for Shared Audience Segments` | Stages **move-to-planner** HITL for that leak (not a Gemini refusal). |
| 2.3 | After discussing a leak, `move it to planner` (typos like `plabnnber` OK) | Resolves **it** from thread context → HITL for the leak you named earlier. |
| 2.4 | `Send the leaks to Campaign Planner` (plural / vague) | **Leak picker** slot (dropdown of real leaks) — must **not** stage `Leak Title: leaks`. |
| 2.5 | Pick one leak → **Continue** → HITL | **No** “Details submitted” user bubble; widget shows **Leak** title (not `uuid::title`) → **Send to Campaign Planner** / **Cancel**. |
| 2.6 | Confirm move-to-planner | Composer locked; **streaming status card** shows Queued/Running job messages via SSE until complete. |
| 2.7 | After job completes | Follow-up suggests **Approve and launch my planner card**; new green card in Brand Centre → Tab 3 (may take ~10–30s). |
| 2.8 | Brand with **no movable leaks** | Narrative: open **Brand Centre → Intelligence & Gaps** to scan — co-pilot does **not** invent leaks. |

| # | Prompt / chip | Expected |
| --- | --- | --- |
| 2.9 | **Send leak to planner** chip | Slot or HITL as above. |
| 2.10 | `How many active leaks do we have?` | Exact count; narrative only (no table required). |
| 2.11 | While HITL move is **pending** | Composer disabled until Confirm or Discard (same as DNA §1.33). |
| 2.12 | While async job running after confirm | Composer shows “Working on your confirmed action…” until SSE completes. |

---

## 3. Campaign Planner (Tab 3)

| # | Prompt / chip | Expected |
| --- | --- | --- |
| 3.1 | **Campaign Planner** chip | Table of planner cards + narrative (pending vs approved counts). |
| 3.2 | `How many campaign blueprints are pending in my planner?` | Same as 3.1 (read). |
| 3.3 | `list campaign palnner cards` (typos OK) | Planner table in chat — **not** a Gemini refusal to list cards. |
| 3.4 | `how can I select which one to launch?` | Launch guidance in chat (suggested phrase + chip); does **not** only redirect to Brand Centre UI. |
| 3.5 | **Launch planner card** chip | Select card if needed → HITL **Approve & create draft campaign**. |
| 3.6 | HITL launch review | Shows **Planner card** title — not raw UUID. |
| 3.7 | After 3.5 confirm | **DRAFT** campaign in Campaigns with products/briefs from bridge; widget shows confirmed + link. |
| 3.8 | Reopen thread | HITL widget still shows confirmed (not Create/Discard again). |

---

## 4. Shortcut campaign create (Path B)

| # | Prompt / chip | Expected |
| --- | --- | --- |
| 4.1 | **Launch campaign** | Slots: product, budget, objective → HITL widget. |
| 4.2 | **Create draft campaign** | DRAFT row `{product} — Co-Pilot Draft` in Campaigns. |
| 4.3 | **Discard draft** (new thread) | No campaign row created. |

---

## 5. Edit DRAFT campaign only

| # | Prompt | Expected |
| --- | --- | --- |
| 5.1 | `List my draft campaigns` | Table of DRAFT campaigns only. |
| 5.2 | `Update my draft campaign budget to 200000` | Slot form → HITL **Confirm draft campaign update**. |
| 5.3 | Campaigns UI | Budget/objective updated on DRAFT row only. |
| 5.4 | Try on **ACTIVE** campaign (negative) | Co-pilot refuses or Campaigns UI only — not in Phase 1 writes. |

---

## 6. Phase 1 end-to-end smoke (~25 min)

1. **Overview** → note leak count  
2. **Visual DNA read** (1.6) → **palette advisory** (1.10) → **font-only write** (1.18) → verify Brand Centre  
3. **Send leak to planner** → watch SSE job status → follow-up message  
4. **Campaign Planner** chip → see new card  
5. **Launch planner card** → find bridge **DRAFT** in Campaigns  
6. **Launch campaign** (shortcut) → second DRAFT  
7. **List draft campaigns** → both drafts listed  
8. **Edit draft** → update budget on one DRAFT  
9. Reopen threads → HITL states persisted  

---

## 7. When something fails

Capture: thread id, exact prompt, Intelligence tab screenshot, planner board screenshot, SSE job messages, Campaigns list.

**Visual DNA writes:** Also capture HITL widget prefilled fields (`current_palette`, `new_palette`, `new_primary_font`, `update_scope`), slot form fields shown, and Brand Centre → Brand DNA screenshot before/after confirm.

**Async jobs:** Move-to-planner uses `PLANNER_AGGREGATE` (Gemini). If follow-up never arrives within 2 minutes, check Brand Centre Tab 3 and backend job logs.

---

## Doc references

- Tab 2 → Tab 3: `docs/chat-engine/product-docs/platform-use-case-matrix.md` §2–3  
- Bridge → UCE: `docs/brand-journey/BRIDGE_TO_UCE.md`, `FLOW_OVERVIEW.md` beat 6  
- Engineering contract: `docs/chat-engine/engineering/DATA_ACCESS_CONTRACT.md`
