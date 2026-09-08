# Phase C — Whole-application coverage map (§10)

**Status:** COMPLETE (read-only map of freeze-branch routes/APIs)  
**Date:** 2026-09-08  
**Evidence branches:** `freeze/mvp-canonical-application-v1`

## Files in this folder

| File | Purpose |
| --- | --- |
| `whole-application-coverage-map.md` | Charter §10 journey map + classification |
| `frontend-route-classification.md` | Every mounted frontend route vs product class |
| `backend-module-classification.md` | Every `AppModule` import + HTTP controller class |

## Rule used

A route or controller existing in code does **not** make it part of the canonical product. Marketplace / Co-Pilot / Centre / payout hubs are classified even when still wired.
