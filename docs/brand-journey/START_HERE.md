# Brand journey documentation package

**For:** Product, QA, and stakeholders who need to understand the live brand flow **without access to the codebase**.

This folder (`word-google-docs`) is designed to be shared as a **standalone package**. Open files in Microsoft Word or upload to Google Docs (see `HOW_TO_OPEN.txt`).

---

## Recommended reading order

| Order | File | Why read it |
| --- | --- | --- |
| 1 | **FLOW_OVERVIEW** | End-to-end story in one pass |
| 2 | **ONBOARDING** | URL → scan → verify |
| 3 | **BRAND_CENTRE** | Tabs 1–3, background jobs |
| 4 | **BRIDGE_TO_UCE** | Launch from planner |
| 5 | **UCE** | Campaign list and detail |
| 6 | **DATA_AND_PROMPTS_REFERENCE** | Limits, formulae, field trace table |
| 7 | **PARALLEL_AND_DATA_INPUTS** | What Parallel fetches; what text is sent into each AI step |
| 8 | **PROMPTS_AND_AI_INSTRUCTIONS** | **Full AI instruction text** (the actual prompts) |

**One file option:** `Brand_Journey_Complete` contains all journey chapters (overview through data reference). For prompts, use the dedicated **PROMPTS_AND_AI_INSTRUCTIONS** file — it is long and kept separate on purpose.

---

## Where AI instructions live in production

In the running product, these instructions are stored in **prompt files** on the server (one file per step). This package includes **full copies** of that text in `PROMPTS_AND_AI_INSTRUCTIONS` so you do not need the repository.

| Step | Prompt name (reference) | In this package |
| --- | --- | --- |
| Onboarding — industry gate | industry-classifier | Section 1 |
| Onboarding — surface scan | surface-scan-synthesis | Section 2 |
| Brand Centre — deep scan | deep-scan-strategy | Section 3 + contract |
| Brand Centre — intelligence | intelligence-leaks | Section 4 + contract |
| Brand Centre — planner | planner-aggregator | Section 5 + contract |

**AI model:** Google Gemini (default **gemini-2.0-flash** in production; configurable by operations).

**Parallel:** External web-fetch service used only during onboarding surface scan (not Gemini).

---

## Glossary (short)

| Term | Meaning |
| --- | --- |
| Parallel | Reads public web pages; returns markdown text |
| Gemini | Google AI; turns text into structured JSON |
| Cold start | Fixed budget templates before deep scan |
| Deep scan | Full DNA pass after email verify |
| Leak | Tab 2 marketing insight card |
| Planner card | Tab 3 draft campaign |
| Bridge | Creates UCE campaign from planner |
| UCE | Universal Campaign Engine — campaign workspace |

---

## Document index (all files in this folder)

| File | Format |
| --- | --- |
| START_HERE | This guide |
| HOW_TO_OPEN | Word / Google Docs instructions |
| README | Package index (short) |
| FLOW_OVERVIEW | Journey summary |
| ONBOARDING | Onboarding screens and data |
| BRAND_CENTRE | Three tabs and four events |
| BRIDGE_TO_UCE | Planner launch formulae |
| UCE | Campaign screens |
| DATA_AND_PROMPTS_REFERENCE | Tables and limits |
| PARALLEL_AND_DATA_INPUTS | Fetch + input bundles |
| PROMPTS_AND_AI_INSTRUCTIONS | Full prompt text |
| Brand_Journey_Complete | All journey chapters combined |
