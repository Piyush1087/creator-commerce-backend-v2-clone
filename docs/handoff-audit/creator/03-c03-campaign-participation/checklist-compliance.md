# C-03 checklist vs origin integration

Mapped from the developer integration handoff + acceptance mail (validate, then PR — **not** deploy).

| Handoff / mail item | Origin status |
|---------------------|---------------|
| Re-fetch latest `development` before integrate | Done at merge base `f274bad` (BE) / `fac47f2` (FE) |
| Integrate accepted tips `aebeb85` / `82ed3c9` | Done as merge commits `9397a10` / `26e1a0d` |
| Migration replay / legacy preservation on origin lineage | Done with surgical migration patches (see clone-refs) |
| Backend Nest build | VERIFIED (`npx nest build`) |
| Backend unit / architecture scoped lane | VERIFIED — 4959 passed (`c03-be-unit.log`) |
| Backend PostgreSQL concurrency / integrity lanes (P5, P11A–E, P12–P14) | VERIFIED on disposable DBs after fixes — see `automated-test-results.md` |
| Frontend tsc / scoped vitest / build / lint | VERIFIED — tsc + 116/116 vitest + build + lint 0/0 |
| Backend prettier-off lint | VERIFIED — exit 0 / no code-rule findings |
| Browser / responsive / a11y / PDF acceptance | Clone acceptance cited; **origin UI smoke not re-run** |
| Security / redaction | Covered by tip suites + P11C/E where run; no separate origin pen-test |
| FE full-lint baseline 26 errors / 13 warnings | Allowed debt per mail — do not “greenwash” |
| Intentionally pending/guarded BE tests in tip handoff | Leave unless they block scoped lanes |
| AWS / production deploy | **Not authorized** |
| Live Meta / provider validation | **Out of scope** |
| Marketplace / payout / KYC / C-04 | **Out of scope** |

## Product-visible changes to tell product before merge

- Creator Apply / Opportunity / Brief Pack / PDF / Application history on origin
- Collaboration handoff after approval continues to provision threads
- Legacy Apply retirement / notifications for media submit restored on legacy CollaborationService path
- Origin Chat Home + C-01/C-05 remain; this is additive C-03 participation

## Gate wording (docs authority)

Origin playbook + creator README: run commands → record results → UI if required → **PR to `origin/development`**.  
AWS / production migrate is a **later, separately authorized** step. Green local tests do **not** mean deploy.
