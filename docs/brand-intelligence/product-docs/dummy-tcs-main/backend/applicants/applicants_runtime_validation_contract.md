# Applicants Runtime + Lifecycle + Validation Contract

**Version:** v1.0 (MVP Frozen)  
**Status:** FROZEN  
**Step:** 5 — Applicants Runtime + Lifecycle + Validation Contract

## 1. Lifecycle

Canonical MVP Application states:

```text
PENDING
├── APPROVED
├── REJECTED
├── WITHDRAWN
├── EXPIRED
└── SUPERSEDED
```

All destination states are terminal for that Application. A later valid submission creates a new Application.

## 2. Valid transitions

- Brand Approve: `PENDING → APPROVED`
- Brand Reject: `PENDING → REJECTED`
- Creator Withdraw: `PENDING → WITHDRAWN`
- System expiry: `PENDING → EXPIRED`
- Sibling approval: `PENDING → SUPERSEDED`

No other MVP transition is valid.

## 3. Withdrawal validation

Withdrawal is allowed only while the Application is `PENDING`.

Once Brand action has moved the Application to `APPROVED` or `REJECTED`, withdrawal is blocked. `EXPIRED` and `SUPERSEDED` are also terminal and cannot be withdrawn.

Withdrawal preserves the record and its immutable snapshot.

## 4. Submission-limit validation

Before accepting a new Application, backend must enforce:

```text
CampaignCreator / Creator × Campaign
< 2 non-WITHDRAWN Applications
```

and:

```text
Canonical Creator × Brand
< 5 non-WITHDRAWN Applications
```

The checks must be concurrency-safe. Frontend checks are not authoritative.

## 5. Same-Brief validation

For the same CampaignCreator × Brief, block a new submission if a historical Application exists in `PENDING`, `APPROVED`, `REJECTED` or `SUPERSEDED`.

Permit reapplication after `WITHDRAWN` or `EXPIRED`, subject to all other limits and eligibility rules.

## 6. Snapshot validation

Every successfully submitted Application must receive exactly one immutable submission snapshot.

The Prisma relation may remain optional at schema mechanics level to support atomic creation flow, but the domain/runtime invariant is not optional: a successfully completed Application submission without its snapshot is invalid.

## 7. Applicant Intelligence runtime

Applicant Intelligence states are independent from Application lifecycle:

```text
PROCESSING
READY
UNAVAILABLE
```

A valid Brand Approve/Reject decision must not be blocked merely because Applicant Intelligence is `PROCESSING` or `UNAVAILABLE`.

Applicant Intelligence is decision support.

## 8. Parent execution eligibility

Application state and current execution eligibility are separate.

Examples:

- Campaign paused → Application may remain `PENDING`, but Approve is blocked while execution is ineligible.
- CampaignAsset/Product paused → Application may remain `PENDING`, but Approve is blocked.
- Brief paused → Application may remain `PENDING`, but Approve is blocked.

A valid Reject or creator Withdraw may still proceed where its own lifecycle rules permit it.

Terminal Campaign closure may expire remaining relevant pending Applications.

## 9. Approval transaction

Approval must be atomic at the business-operation level:

```text
BEGIN
  validate selected Application = PENDING
  validate Campaign/Product/Brief execution eligibility
  validate no existing Campaign Collaboration for CampaignCreator
  selected Application → APPROVED
  sibling PENDING Applications → SUPERSEDED
  record superseded-by provenance
  create exactly one Collaboration from approved Application
COMMIT
```

No partially approved/superseded state should escape the transaction.

## 10. MVP Collaboration invariant

For a CampaignCreator within a Campaign:

```text
maximum one Collaboration
```

The creator may have submitted multiple Applications, but only one can become the source Application for the Campaign Collaboration in MVP.

## 11. Concurrency cases

Runtime must protect against at least:

- Approve vs Reject on the same Application
- Approve vs Withdraw
- Approve vs Expire
- simultaneous approval of sibling Applications
- simultaneous submissions that would exceed Campaign allowance
- simultaneous cross-Campaign submissions that would exceed Brand allowance

Exactly one valid terminal transition may win for a given Application.

## 12. Bulk operations

Bulk Approve/Reject is not one all-or-nothing transaction across every selected creator. Each selected Application is validated independently.

Partial success is allowed. Successful decisions remain committed while failures are returned for review.

## 13. Historical integrity

Terminal Applications remain queryable. Rejected, Withdrawn, Expired and Superseded records are not deleted simply because they leave the Pending queue.

Their snapshots and published Applicant Intelligence remain attached as historical decision context.

## 14. Validation ownership

Backend/runtime is authoritative for lifecycle, limits, same-Brief rules, current execution eligibility, supersession and Collaboration uniqueness.

UI may pre-emptively disable or explain invalid actions, but UI validation never replaces backend enforcement.

## 15. Frozen invariants

1. Only `PENDING` can transition.
2. Withdrawal is impossible after Brand Approve/Reject.
3. 2-per-Campaign and 5-per-Brand limits exclude only `WITHDRAWN`.
4. Same-Brief reapplication follows the frozen state matrix.
5. Every successful Application has an immutable snapshot.
6. Applicant Intelligence readiness never gates Brand decision.
7. Approval atomically supersedes sibling pending Applications.
8. At most one Campaign Collaboration exists per CampaignCreator for MVP.
9. Historical Applications are retained.
10. Backend enforcement is concurrency-safe and authoritative.

---

**FROZEN:** This contract is the canonical Applicants Step 5 runtime/lifecycle/validation authority. Persistence representation is governed by the frozen Applicants Backend Schema Reconciliation artifact and validated `backend/campaign_schema.prisma` v1.5.