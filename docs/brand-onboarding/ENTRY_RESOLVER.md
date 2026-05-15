# Entry resolver (`POST /api/v1/discovery/resolve`)

## Purpose

Give the **marketing shell** and future authenticated app a **cheap, read-only**
decision point before running heavier work (Parallel/Gemini) or persisting
triage rows.

## Behaviour (current)

| Condition | Response `outcome` | DB writes |
|-----------|-------------------|-----------|
| URL fails gate (syntax, social host, private host, bad TLD) | `blocked` | **None** (unlike `validate`, which records gate failures in `market_intelligence_logs`) |
| `BrandProfile` exists for domain, verified, org has user | `org_claimed` + `adminEmail` | None |
| Supported stub + existing `DiscoveryLead` for `normalizedUrl` | `resume` + `leadId` | None |
| Otherwise (needs full triage / new lead) | `proceed` | None |

## Client flow

1. Call **`resolve`** first.
2. If `resume` → continue onboarding UI with stored `leadId` / `normalizedUrl`
   (no `validate` call required for the lead row).
3. If `proceed` → call **`validate`** to persist `discovery_leads` / market
   intel as today.
4. If `org_claimed` → show invitation modal (no `validate`).
5. If `blocked` → show inline error.

## Notes

- **No cookies:** continuity is keyed off DB entities and auth, not browser
  storage (see `IMPLEMENTATION_TRACKING.md`).
- Gate-failure **intel** is intentionally **skipped** on `resolve` to avoid
  noisy rows from speculative URL checks; `validate` remains the persistence
  path for those failures.
