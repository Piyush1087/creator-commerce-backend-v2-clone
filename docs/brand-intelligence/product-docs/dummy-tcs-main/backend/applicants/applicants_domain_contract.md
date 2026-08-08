# Applicants Domain Contract

**Creator Shop — Campaign Workspace**  
**Version:** v1.0 (MVP Frozen)  
**Status:** FROZEN  
**Step:** 1 — Reconcile + Freeze Applicants Domain Contract

## 1. Purpose

Applicants manages creators who have submitted applications to a Campaign. It is an operational decision workspace, not creator discovery or prospecting.

Its responsibilities are to receive Applications, preserve submission-time context, consume Applicant Match output from the Creator Shop Intelligence Engine, support Brand decisions, and hand an approved Application into Collaboration.

## 2. Core domain shape

The durable Campaign-level creator identity is `CampaignCreator`. The individual decision unit is `Application`.

```text
Campaign
└── CampaignCreator
    ├── Application A
    └── Application B
```

A creator may therefore have multiple Applications inside one Campaign. Applicant cards may group these Applications by CampaignCreator, but grouping does not collapse the underlying Application records.

## 3. Application identity

Each Application references one CampaignCreator, one Campaign, one CampaignAsset/Product and one Brief. The Application ID is the canonical identity for an individual submission.

An Application preserves the context that existed when the creator applied. Later edits to Campaign, CampaignAsset, Brief, commercials or creator profile do not rewrite that historical submission.

## 4. Multiple Applications — MVP rule

Multiple Applications are allowed because a creator may apply to different Product × Brief opportunities in the same Campaign, and this becomes increasingly important as additional platforms are introduced.

MVP submission allowance:

- Creator × Campaign: maximum **2 non-WITHDRAWN Applications**.
- Creator × Brand: maximum **5 non-WITHDRAWN Applications** across that Brand's Campaigns.
- `WITHDRAWN` Applications do not consume the allowance.
- `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED` and `SUPERSEDED` Applications do consume the allowance.

These are lifetime submission allowances within the applicable scope, not limits on currently pending Applications.

## 5. Withdrawal

A creator may withdraw only while the Application is still `PENDING` and the Brand has not taken an Approve/Reject action.

Withdrawal preserves the historical Application record. The card/history is not deleted.

Once the Brand has approved or rejected an Application, the creator cannot withdraw that Application.

## 6. Reapplication

For the same CampaignCreator × Brief:

- reapplication is blocked after `PENDING`, `APPROVED`, `REJECTED` or `SUPERSEDED`;
- reapplication is permitted after `WITHDRAWN` or `EXPIRED`, subject to the Campaign and Brand submission allowances and all other eligibility rules.

A fresh submission always creates a new Application ID and a new immutable submission snapshot.

## 7. Rejection does not block the creator from the Campaign

A creator rejected for one Application may still submit another valid Application in the same Campaign, provided the frozen limits and reapplication rules permit it. This supports the frequent case where a creator is a poor fit for Brief A but a strong fit for Brief B.

## 8. Applicant Match ownership

Applicant Match is calculated by the **Creator Shop Intelligence Engine**. Applicants consumes the published result; it does not calculate or independently refresh the score.

Unlike Discovery recommendation, Applicant Match is Application-specific because Product and Brief are known at application time.

The Intelligence result is decision support, not the Application lifecycle authority.

## 9. Immutable submission context

Every successfully submitted Application must have exactly one immutable submission-time snapshot containing the relevant Campaign, CampaignAsset/Product, Brief, commercial and creator identity context.

The snapshot does not become a second canonical copy of the live Campaign aggregate. It exists to preserve what the creator applied to and what the Brand later decided on.

## 10. History and alerts

Campaign History and Brand History are derived projections over authoritative platform records. Applicants does not own duplicate history tables.

Operational Alerts are likewise derived from authoritative records. A creator's prior Campaign/Brand activity remains visible even when they submit a new Application.

## 11. Collaboration boundary

Approval transitions the selected Application toward Collaboration. For MVP, a CampaignCreator may have at most one Collaboration within a Campaign.

If one Application is approved, sibling pending Applications for that CampaignCreator become `SUPERSEDED` rather than independently remaining actionable.

The Collaboration aggregate itself is outside Applicants ownership and is reconciled separately.

## 12. Domain boundaries

### Applicants owns

- Application identity and lifecycle
- Application review/decision semantics
- immutable submission snapshot
- consumption/display of published Applicant Intelligence
- supersession provenance
- handoff provenance into future Collaboration

### Applicants derives or consumes

- CampaignCreator identity
- Campaign/Product/Brief data
- creator snapshot inputs
- Applicant Match output
- Campaign History
- Brand History
- Alerts
- current Campaign/Product/Brief execution eligibility

### Applicants does not own

- Discovery
- prospecting/outreach execution
- Applicant Match computation
- creator profile synchronization
- Collaboration execution
- reporting
- payment lifecycle

## 13. Frozen invariants

1. Application is the individual decision unit.
2. CampaignCreator is the Campaign-level grouping identity.
3. Multiple Applications are allowed, subject to the 2-per-Campaign and 5-per-Brand allowances.
4. Withdrawal never deletes historical evidence.
5. Brand action prevents later withdrawal of that Application.
6. Applicant Match is Intelligence-owned and Application-specific.
7. Submission-time context is immutable.
8. Approval of one Application cannot create multiple Campaign Collaborations for the same CampaignCreator.
9. History and Alerts remain derived projections.

---

**FROZEN:** This contract is the canonical Applicants Step 1 domain authority. Persistence details are governed by the Applicants Backend Schema Reconciliation artifact and `backend/campaign_schema.prisma` v1.5.