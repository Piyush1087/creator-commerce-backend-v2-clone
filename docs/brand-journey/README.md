# Brand journey — implementation guide

**Audience:** Product, QA, and anyone testing the live platform who needs to understand **what happens to data** from first URL entry through to a UCE campaign.

**Source:** Written from **running code** in `creator-commerce-backend-v2` and `creator-commerce-frontend-v2`. Product PRDs in `product-team-docs/` folders are separate reference — this doc describes what is **actually built today**.

---

## What this covers

```text
Onboarding  →  Brand Centre (3 tabs)  →  Bridge  →  UCE
```

Not included here: escrow, collaboration chat, pricing internals beyond the onboarding trial step, influencer surfaces, chat engine.

---

## How to read these docs

| Doc | Read when… |
| --- | --- |
| [FLOW_OVERVIEW.md](./FLOW_OVERVIEW.md) | You want the **whole story** in one sitting (start here) |
| [ONBOARDING.md](./ONBOARDING.md) | Testing signup, scan, DNA, verify, pricing |
| [BRAND_CENTRE.md](./BRAND_CENTRE.md) | Testing Tab 1–3, deep scan, intelligence, planner |
| [BRIDGE_TO_UCE.md](./BRIDGE_TO_UCE.md) | Testing Launch from planner → campaign creation |
| [UCE.md](./UCE.md) | Testing campaign list, detail, manual create vs bridge |
| [DATA_AND_PROMPTS_REFERENCE.md](./DATA_AND_PROMPTS_REFERENCE.md) | Lookup: AI prompts, data limits, formulae, field tables |
| [PARALLEL_AND_DATA_INPUTS.md](./PARALLEL_AND_DATA_INPUTS.md) | What Parallel fetches; Gemini input bundles |
| [PROMPTS_AND_AI_INSTRUCTIONS.md](./PROMPTS_AND_AI_INSTRUCTIONS.md) | **Full text** of all AI prompts and JSON contracts |
| [START_HERE.md](./START_HERE.md) | Standalone package guide (for `word-google-docs` handoff) |

---

## Quick glossary

| Term | Meaning |
| --- | --- |
| **Parallel** | External service that reads public web pages and returns markdown text |
| **Gemini** | Google AI that turns scraped text into structured JSON |
| **Cold start** | First budget numbers shown before deep scan (fixed templates, no AI) |
| **Deep scan** | Full Brand DNA pass after email verification (Gemini Prompt 1) |
| **Leak** | Tab 2 insight card suggesting a marketing fix |
| **Planner card** | Tab 3 draft campaign suggestion |
| **Bridge** | Handoff layer that creates UCE campaign rows from planner |
| **UCE** | Universal Campaign Engine — live campaign workspace |

---

## Side notes convention

Throughout these docs, **Side note** blocks flag behavior that differs from the happy path (cached scan, stub OTP, UI not saving edits, etc.) so testers are not surprised — without turning the doc into an error catalogue.

---

## Word & Google Docs copies (standalone package)

For product and QA **without codebase access**, share the **`word-google-docs/`** folder only.

| File | Purpose |
| --- | --- |
| `START_HERE.html` | Reading order — open this first |
| `PROMPTS_AND_AI_INSTRUCTIONS.html` | **Full AI prompt text** |
| `PARALLEL_AND_DATA_INPUTS.html` | Parallel fetch + Gemini inputs |
| `Brand_Journey_Complete.html` | All chapters in one file |

See `word-google-docs/HOW_TO_OPEN.txt` for Word / Google Docs import steps.

Engineering: regenerate after editing Markdown here:

```bash
node docs/brand-journey/scripts/convert-to-office-html.mjs
```
