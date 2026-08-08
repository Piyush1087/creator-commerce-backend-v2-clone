# Applicants Orchestration Contract

**Version:** v1.0 (MVP Frozen)  
**Status:** FROZEN  
**Step:** 4 — Applicants Orchestration / Projection Contract

## 1. Purpose

This contract defines how persisted Applications are projected into the CampaignCreator-based Applicants workspace and how history, Applicant Intelligence and decisions interact without changing domain ownership.

## 2. Projection sequence

Canonical workspace orchestration:

```text
Queue
  ↓
Eligible Applications
  ↓
Application-level filters
  ↓
Group by CampaignCreator
  ↓
Resolve representative Application
  ↓
Sort CampaignCreator projection
  ↓
Hydrate Applicant cards
```

The grouping layer never merges or destroys underlying Applications.

## 3. Representative Application

A representative Application is selected from Applications eligible under the current queue/filter context.

Default rule: use the eligible Application with the highest Applicant Match where Match is available. Other Applications remain visible through expansion/detail.

Representative Application is derived state. It is not persisted on CampaignCreator or Application.

## 4. Application-specific Match

Each Application has its own Applicant Match because the creator is evaluated against the Campaign plus the selected Product/Brief context.

Therefore:

- Application A and Application B may have different Match results;
- the CampaignCreator card shows the Match belonging to its current representative Application;
- Match scores are not averaged;
- changing filters may change the representative Application and therefore the Match shown on the card.

## 5. Applicant Intelligence ownership

The Creator Shop Intelligence Engine calculates Applicant Match and publishes the Application-level result. Applicants consumes that output.

Applicants does not recalculate Match when Campaign/Product/Brief or creator profile data later changes. The Application snapshot and its published Match remain historical decision context.

## 6. Manual/Discovery history interaction

CampaignCreator is the shared Campaign-level creator bridge. A creator may have entered the Campaign context through Discovery/manual/outreach flows before applying.

Once an Application exists, Applicants uses that same CampaignCreator grouping identity rather than creating another creator identity for the Campaign.

## 7. Rejected Discovery creator can still apply

A Discovery rejection does not invalidate a creator's ability to submit a valid Campaign Application if the creator has access to the Campaign and passes Application rules.

The prior Discovery/rejection context is surfaced through Campaign history/Alerts as applicable rather than silently blocking the Application.

## 8. Campaign History

Campaign History is a derived projection over authoritative Campaign interactions, including Applications and other relevant CampaignCreator activity.

This allows the Brand to see, for example, that the creator previously applied to another Brief in the same Campaign and was rejected.

## 9. Brand History

Brand History is a cross-Campaign projection for the canonical creator identity across the Brand's Campaigns.

It is not copied into Applicants-owned persistence.

## 10. Alerts

Alerts are deterministic projections over authoritative events. They are independent of Applicant Match and should not be silently folded into the Match calculation by Applicants.

## 11. Approval orchestration

Approving Application A for a CampaignCreator must conceptually perform one coordinated operation:

```text
validate Application A is PENDING
validate current execution eligibility
validate no Campaign Collaboration already exists for CampaignCreator
A → APPROVED
sibling PENDING Applications → SUPERSEDED
preserve superseded-by provenance
create Collaboration from A
```

The Collaboration creation boundary is deferred to the canonical Collaboration domain, but Applicants freezes the orchestration invariant.

## 12. Supersession

`SUPERSEDED` is not equivalent to Brand rejection. It records that another Application from the same CampaignCreator was selected for the Campaign.

A superseded Application remains historical and retains its own snapshot and Match.

## 13. Campaign edits

Applications preserve submission-time context. Later Campaign/Product/Brief edits do not rewrite the Application snapshot or silently recalculate its Match.

Current execution eligibility is checked separately when a Brand attempts an operational action such as Approve.

## 14. Projection non-persistence

Do not persist merely to render the workspace:

- Applicant card
- queue membership
- queue counts
- representative Application ID
- highest Match
- application count
- Campaign History
- Brand History
- Alerts

These remain query/runtime projections unless a future domain requirement independently justifies persistence.

---

**FROZEN:** This contract is the canonical Applicants Step 4 orchestration/projection authority.