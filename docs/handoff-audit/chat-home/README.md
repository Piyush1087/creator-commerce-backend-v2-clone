# Chat Engine + Brand Home V1 â€” origin integration audit

Origin integration of the **accepted** Brand-side Chat Engine + Brand Home V1
runtime onto current `origin/development` (isolated branch).

**Do not** reopen Product P0â€“P7. This is integration / validation / release prep only.

## Canonical authority (handoff)

| Role | SHA |
|------|-----|
| Product (`dummy_tcs`) | `d69ba6b8cb331bfa36b450307d9defcd26d09c6e` |
| Backend runtime | `00e1299ec2e97497bc6d81aeda808d6edd3b482a` |
| Frontend runtime | `1cf2e3bd93425f60fb3d40692320078aea567794` |
| Final Systems ledger | `c42a2cc44b922f8631c1e93606415407542869ce` |
| Handoff docs tip | `c00aacafb617e4d67643137359fd64bd9fc9424f` |

## Origin branches

| Repo | Branch | Notes |
|------|--------|-------|
| Backend | `integration/chat-home-v1` | From `origin/development` + merge runtime `00e1299` |
| Frontend | `integration/chat-home-v1` | From `origin/development` + merge runtime `1cf2e3b` |

Also in-flight (separate): `feature/c01-c05-creator-integration` â€” **not** merged to `development` yet. Do not base Chat/Home on it.

## Status vocabulary

Every gate / named failure uses exactly one of:

`PASS` / `FIXED` / `GENUINE_AUTHORITY_CONFLICT` / `ENVIRONMENT_BLOCKED`

## Files in this folder

| File | Purpose |
|------|---------|
| `commands-to-run.md` | Exact PowerShell + Part B deploy pointers |
| `integration-part1-report.md` | Architecture / authority / gate matrix |
| `integration-part1-test-results.md` | Suite counts, named fails, SHAs |
| `integration-candidate-gate.md` | Â§10 INTEGRATION_CANDIDATE + D0; **stop** until human auth |
| `../MODULE-AUDIT-TESTING-PLAYBOOK.md` | Reusable process (same as C-01/C-05) |

Handoff docx copies live under `docs/brand-home/product-docs/handoff-docs/` (local).
Raw tee logs: `docs/handoff-audit/.logs/` and `docs/brand-home/_*.log` (local; usually not committed).

## Gate before merge to `development`

1. Part 1 report + test-results complete with vocabulary above.
2. Commands in `commands-to-run.md` executed; postgres skip count **0** where env set.
3. No Creator Chat / EXECUTE / streaming added.
4. [`integration-candidate-gate.md`](./integration-candidate-gate.md) reviewed.
5. Human issues `INTEGRATION_MERGE_AUTHORIZED`, then `DEV_DEPLOY_AUTHORIZED` for D1â€“D3.
6. Production only with `PRODUCTION_RELEASE_AUTHORIZED` + exact SHAs.
