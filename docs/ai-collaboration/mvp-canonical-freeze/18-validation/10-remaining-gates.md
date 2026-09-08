# 10 — Remaining §18 gates (not this checkpoint)

| Gate | Status | Classification |
| --- | --- | --- |
| fresh checkout / `npm ci` | NOT_RUN | working copies used |
| full unit/contract `npm test` | NOT_RUN | hang risk; targeted tests only |
| module acceptance suites | NOT_RE_RUN | PREEXISTING_ACCEPTED_DEBT until reconfirmed |
| cross-module invariant suite execution | PARTIAL | INV-05/INV-03 targeted; suite not fully executed |
| frontend ↔ backend smoke | NOT_RUN | no browser/login smoke this run |
| auth/session regression | PARTIAL | BS-12 static PASS; postgres auth tests not run |
| RBAC / actor-subject / cross-tenant | NOT_RUN | |
| responsive shell/navigation smoke | NOT_RUN in browser | hide is unit-tested |
| provider-unavailable recovery | NOT_RUN | |
| lint | NOT_RUN | |
| clean worktrees | NOT_CLAIMED | BE `tmp-*` / logs must not be committed |
| local/remote checkpoint equality | local only | do not push unless Parent asks |

`PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` is still forbidden.
