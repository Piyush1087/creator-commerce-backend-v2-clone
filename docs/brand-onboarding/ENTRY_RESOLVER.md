# Entry resolver (`POST /api/v1/discovery/resolve`)

## Purpose

Read-only Step 1 gate before `validate` or surface scan. Implements product **v2.1** early-gate rules from `changes.md` (see [STEP1_GATE_V2_1.md](./STEP1_GATE_V2_1.md)).

**Deep scan is not implemented.**

## Behaviour (priority order)

| Condition | `outcome` | DB writes on resolve |
|-----------|-----------|---------------------|
| URL gate failure | `blocked` | None |
| Verified + org + user | `org_claimed` (+ `adminEmail`) | None |
| Verified, caller not owner | `brand_active` | None |
| Domain or IP vendor scans **> 5** in 7d (limits on) | `verification_required` (+ `brandProfileId`) | None |
| Unverified surface-complete profile **&lt; 7d** + lead | `resume` (+ `brandProfileId`, no preview leak) | None |
| Else | `proceed` | None |

`validate` applies the same gate before creating/updating leads.

## Client flow

1. **`resolve`** with optional `Authorization: Bearer` (owner bypass).
2. `org_claimed` / `brand_active` / `verification_required` → modals (no scan).
3. `resume` → save session → **Brand DNA** (skip scan when surface already complete).
4. `proceed` → **`validate`** → preview/setup → **surface-scan**.

## Surface scan

Same gate on `POST /api/v1/brand/surface-scan`. Vendor runs log to `surface_scan_attempts`; cache hits do not.

## Limits

Off when `STAGE=local` (unless `BRAND_SCAN_LIMITS_ENABLED=true`). On for dev/prod.

## Related docs

- [STEP1_GATE_V2_1.md](./STEP1_GATE_V2_1.md)
- [MANUAL_TESTING_STEP1_GATE.md](./MANUAL_TESTING_STEP1_GATE.md)
