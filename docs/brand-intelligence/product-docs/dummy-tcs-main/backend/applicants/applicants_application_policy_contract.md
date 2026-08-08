# Applicants Application Policy Contract

**Version:** v1.0 (MVP Frozen)  
**Status:** FROZEN  
**Step:** 2 — Application Submission, Multiplicity & Decision Policy

## 1. Purpose

This contract freezes the rules governing how many Applications a creator may submit, when withdrawal/reapplication is allowed, and how Brand decisions affect future Applications.

## 2. Submission allowances

```text
Creator × Campaign ≤ 2 non-WITHDRAWN Applications
Creator × Brand    ≤ 5 non-WITHDRAWN Applications
```

Count toward the allowance:

`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `SUPERSEDED`.

Exclude:

`WITHDRAWN`.

Rejection, expiry, approval or supersession therefore does not restore submission capacity. Withdrawal does.

## 3. Why multiple Applications are retained

The same creator can legitimately apply to different Brief/Product opportunities inside a Campaign. A rejection against one opportunity must not force the creator into a permanently rejected Campaign-level identity.

Applications remain separate because Applicant Match is Application-specific and can differ by Product × Brief.

The workspace may group Applications under one CampaignCreator card, but the underlying Applications remain independently addressable decision records.

## 4. Withdrawal policy

Only `PENDING` Applications may be withdrawn.

Once the Brand has taken an Approve or Reject action, withdrawal is not available.

A withdrawn Application remains in historical records and is not physically removed.

## 5. Same-Brief policy

For the same CampaignCreator × Brief:

| Existing Application state | New Application to same Brief |
|---|---|
| PENDING | Block |
| APPROVED | Block |
| REJECTED | Block |
| SUPERSEDED | Block |
| WITHDRAWN | Permit, subject to all other rules |
| EXPIRED | Permit, subject to all other rules |

A permitted reapplication creates a new Application; it does not reactivate the previous record.

## 6. Rejected creator scenario

A creator rejected for Brief A may apply to Brief B in the same Campaign if:

- the creator has not exhausted the Campaign allowance;
- the creator has not exhausted the Brand allowance;
- the target Brief is otherwise eligible;
- the new submission does not violate same-Brief rules.

The prior rejection remains visible through Campaign/Brand history projections.

## 7. Application source

The exact Application source taxonomy is not frozen here. Source remains provisional until Outreach / creator entry-route reconciliation is complete.

Applicants must preserve source provenance where available without prematurely defining a new canonical enum.

## 8. Decision unit

Approve/Reject applies to an Application, not directly to the CampaignCreator grouping card.

Where a card represents multiple Applications, the UI/runtime must resolve which Application is being acted upon.

## 9. Approval consequence

For MVP, one CampaignCreator can produce at most one Collaboration within a Campaign.

Approving one Application therefore makes sibling pending Applications non-actionable and transitions them to `SUPERSEDED`.

## 10. Enforcement boundary

The 2/5 allowances and predicate-aware same-Brief rules cannot be represented safely by ordinary uniqueness constraints alone. They require concurrency-safe backend/database enforcement.

The Brand-wide allowance additionally depends on canonical cross-Campaign creator identity.

---

**FROZEN:** This contract is the canonical Applicants Step 2 policy authority.