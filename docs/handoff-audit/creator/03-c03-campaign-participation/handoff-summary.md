# C-03 — Creator Campaign Participation / Apply (origin integration)

**Primary authority (mail + clone tip):**  
Backend `aebeb85fd6bba37f88c3805c213c61e7f63b2f5f` · Frontend `82ed3c9ef849be8353565a1901b6f5fb065c37e1`

**Reference handoff (clone docs):**  
`https://github.com/Piyush1087/dummy_tcs/blob/5e23582318cd7bbf637d184d36412cc3f8fe70a4/docs/ai-collaboration/c03-developer-code-integration-handoff-v1.md`

**Status:** CODE MERGED ON ORIGIN INTEGRATION BRANCHES / BE+FE SCOPED GATES VERIFIED / AUDIT PACKET RECORDED / UNCOMMITTED WORKING TREE / NO PR / NO AWS

## Origin integration branches

| Repo | Branch | Merge commit | Parents |
|------|--------|--------------|---------|
| Backend | `integration/c03-campaign-participation` | `9397a10` | `f274bad` (origin Chat Home + C-01/C-05 tip) + `aebeb85` (C-03) |
| Frontend | `integration/c03-campaign-participation` | `26e1a0d` | `fac47f2` (origin tip) + `82ed3c9` (C-03) |

Working trees still have **uncommitted** migration/schema/Nest reconcile fixes and P11B/P14 test/service patches. Not pushed. No PR.

## Handoff claim vs reality

Mail said existing `development` was an ancestor of accepted C-03. On growth-verse that was **false**: origin already had Chat Home + C-01/C-05. Integration used merge + surgical reconcile (clone = C-03 Apply/handoff authority; origin = Brand Home / Chat / full collaboration surface).

## Product summary (frozen from handoff mail)

```text
Opportunity discovery / entitlement
→ eligible-only / invite-only access
→ Application submit + idempotency
→ history / withdrawal
→ immutable snapshots
→ invitation / ingress
→ notifications
→ Creator Brief Pack + PDF
→ Collaboration handoff after approval
→ legacy Apply retirement
→ auth / privacy / concurrency protections
```

## Out of scope (mail)

AWS/production deploy, live Meta/provider validation, Marketplace, payout/KYC, C-04 workflow.

## Gate before merge (this module)

1. Finish remaining commands in [`../c03-commands-to-run.md`](../c03-commands-to-run.md) (FE + any BE leftovers).
2. Paste / tee into [`../c03-origin-run-log.md`](../c03-origin-run-log.md) and `../.logs/`.
3. Update [`automated-test-results.md`](./automated-test-results.md) with **origin** counts.
4. Local UI smoke only if Product asks (`../ui-verification.md` C-03 rows — still TBD).
5. Commit + push + PR to **`origin/development` only** when you ask.
6. AWS / production migrate remains a **later, separately authorized** step — not implied by green tests.
