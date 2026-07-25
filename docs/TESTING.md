# Testing — start here

Use this file when you begin a **module testing session** with an agent or QA. It avoids repeating setup questions every time.

## Source-of-truth order

1. **Product docs** — what the product *should* do (`docs/<module>/product-team-docs/` or journey docs).
2. **Module `TESTING.md`** — UI checklist for that module (`docs/<module>/TESTING.md`).
3. **Gap log** — what you found (`docs/<module>/GAP-LOG.md`, create per batch).
4. **Deployed code** — what actually runs (optional Living Functional Spec, generated from code after first pass).

## How to start a testing conversation

Paste this into chat:

```text
Start module testing using docs/TESTING.md and docs/testing-methodology/README.md.
Module: <module-name>   (e.g. brand-onboarding)
Use the module TESTING.md checklist. UI-only pass (no network tab / CloudWatch unless I ask).
Log issues in the gap log bucket format.
```

## Module testing packs

| Module | UI checklist | Notes |
|--------|----------------|-------|
| **Brand onboarding** | [brand-onboarding/TESTING.md](./brand-onboarding/TESTING.md) | Funnel: landing → scan → DNA → catalogue → competitors → verify → pricing |
| Brand Centre | *TBD* | Deep scan, tabs 1–3 |
| Creator onboarding | [creator-onboarding/UI_TESTING.md](./creator-onboarding/UI_TESTING.md) | Existing doc |

## Full playbook (process + fix routing)

[testing-methodology/README.md](./testing-methodology/README.md) — gap buckets, happy vs chaos, which tool fixes which issue.

Research / background (long): [testing-methodology/Testing methodology.md](./testing-methodology/Testing%20methodology.md)

## Default test environment (v2 local)

| Setting | Default |
|---------|---------|
| Stage | `local` (`STAGE=local` — scan limits off) |
| API | `http://localhost:3000` |
| Frontend | `VITE_API_URL` → backend |
| AI | `GEMINI_API_KEY` required for live surface scan |
| S3 | Optional — set `S3_BUCKET_NAME` when testing image mirror |

## Gap log buckets

When you find an issue, tag it:

| Bucket | ID prefix | Examples |
|--------|-----------|----------|
| UI layout | `UI-` | Overlap, mobile broken, modal cut off |
| Validation / errors | `VAL-` | Wrong message, silent failure |
| Copy | `COPY-` | Too technical, wrong tone |
| Backend logic | `BACK-` | Data wrong but UI looks fine |
| AI output | `AI-` | Bad extraction, missing competitors |
| Schema / data model | `SQL-` | Field missing, wrong enum |
| Assets (S3 / images) | `ASSET-` | Logo broken, product image 404, deep scan vs surface mismatch |

Template: [testing-methodology/GAP-LOG-TEMPLATE.md](./testing-methodology/GAP-LOG-TEMPLATE.md)
