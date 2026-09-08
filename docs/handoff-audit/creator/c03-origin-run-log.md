# C-03 origin run log (2026-09-08)

Chronological evidence for `integration/c03-campaign-participation`.  
Full tees live under `docs/handoff-audit/.logs/`. Paste new command tails below.

## Already recorded (backend)

| Batch | Log | Result |
|-------|-----|--------|
| Unit / architecture scoped | `c03-be-unit.log` | 4959 passed / 9 files |
| P5 | `c03-be-pg-p5.log` | 6 passed |
| P11A | `c03-be-pg-p11a.log` | 5 passed |
| P11B (final) | `c03-be-p11b-rerun2.log` | 5 passed |
| P11C (clean DB) | `c03-be-p11c-rerun.log` | 6 passed |
| P11D | `c03-be-pg-p11d.log` | 6 passed |
| P11E (final) | `c03-be-pg-p11e-rerun.log` | 21 passed |
| P12 | `c03-be-pg-p12.log` | 15 passed |
| P13 (final) | `c03-be-pg-p13-rerun.log` | 57 passed |
| P14 legacy (final) | `c03-be-p14-legacy-rerun2.log` | 4 passed |
| Nest build | (session) | PASS |
| prettier-off ESLint | `c03-be-lint-prettier-off.log` | VERIFIED exit 0 / no findings (operator 2026-09-08) |

Interim fails (dirty DB / tip-guard mismatch / missing notification wire) are in earlier `*-rerun` / `c03-be-pg-p11*.log` files — do not treat those as current gate.

## Frontend (user 2026-09-08)

| Batch | Log | Result |
|-------|-----|--------|
| `npx tsc -b` | (no tee file; empty/success) | VERIFIED clean — also covered by build |
| creator-campaigns vitest | `c03-fe-creator-campaigns.log` | **10 passed / 116 passed** |
| `npm run build` | `c03-fe-build.log` | VERIFIED built in 30.86s; chunk >500kB warning only |
| `npm run lint` | `c03-fe-lint.log` | VERIFIED **0 errors / 0 warnings** |

Notes: React Router v7 future-flag stderr in component tests is noise, not a fail.

## Gate status

Automated scoped gate + local C-03 UI smoke are **closed** for origin integration.  
Next when you ask: commit → push → PR to `origin/development`. No AWS/prod deploy from this packet.
