# Applicants Workspace / UI Contract

**Creator Shop — Campaign Workspace**  
**Version:** v1.0 (MVP Frozen)  
**Status:** FROZEN  
**Step:** 3 — Applicants Workspace / UI Contract

## 1. Workspace purpose

**Title:** Applicants  
**Description:** Review and approve creators who have applied to this campaign.

The workspace is decision-oriented. Applicant Intelligence is primary decision support; creator evidence, history, alerts and Application context support that decision.

## 2. Card identity and grouping

The workspace uses **CampaignCreator-based cards**, not one independent top-level card per Application.

A CampaignCreator card may contain up to the creator's permitted Applications for the Campaign. Each Application remains independently preserved and actionable according to lifecycle rules.

When multiple eligible Applications exist, the card uses a **representative Application**. The default representative is the eligible Application with the highest Applicant Match. Other Applications are accessible by expanding the card/drawer.

Applicant Match scores are never averaged across Applications.

## 3. Search, filters, sort and queue

Search supports creator name or Instagram handle.

Frozen filter dimensions:

- Product
- Brief
- Match
- Source
- Applied date

Frozen sort options:

- Newest — default
- Highest Match
- Oldest

The queue is operational. Pending is the default working queue; historical/terminal states remain accessible through queue/history views as defined by the runtime lifecycle.

## 4. Applicant card

The card surfaces the information required for the immediate decision:

- creator identity
- representative Product
- representative Brief
- Applicant Match / AI recommendation
- strengths
- weakness/risks where available
- Alerts where applicable
- Approve
- Reject

Where multiple Applications exist, the card must communicate that additional Applications exist and allow them to be inspected without creating duplicate creator cards.

## 5. Applicant drawer/modal

The detailed view uses progressive disclosure rather than internal tab navigation.

It contains, when meaningful:

- Creator header
- Applicant Intelligence / Match
- Match breakdown
- Creator Snapshot
- recent paid collaborations/evidence
- History with Your Brand
- History with This Campaign
- Alerts
- Application Details
- additional Applications belonging to the CampaignCreator
- decision actions

Empty optional sections are hidden rather than rendered as empty chrome.

## 6. Applicant Intelligence display

Applicant Intelligence is Application-specific. When the representative Application changes, the displayed Match and associated explanation must change with it.

The workspace consumes the Intelligence Engine output; it does not recompute it.

Applicant Intelligence being PROCESSING or UNAVAILABLE does not make the Application non-actionable for Brand decision.

## 7. History

**History with This Campaign** may include prior Applications and other Campaign interactions for the same creator.

**History with Your Brand** may include the creator's interactions across other Campaigns belonging to the Brand.

This history is particularly important when a creator previously applied, was rejected, collaborated, or otherwise interacted with the Brand.

History is derived from authoritative records; the UI contract does not imply Applicants-owned history persistence.

## 8. Alerts

Alerts provide operational context independent of Applicant Match. Examples already established in the Applicants design include Previous Rejection, Completed Collaboration and Payment Dispute.

Alerts are derived from authoritative records and do not alter Applicant Match.

## 9. Application details

Application context includes at least:

- Product
- Brief
- Applied
- Source

When multiple Applications exist, each Application retains its own context and Applicant Intelligence result.

## 10. Actions

Primary action: **Approve**  
Secondary action: **Reject**

Actions apply to the selected/representative Application, not indiscriminately to every Application grouped under the CampaignCreator.

If one Application is approved, sibling pending Applications become `SUPERSEDED` as part of runtime processing.

## 11. Bulk actions

Bulk operations remain contextual and appear only after selection.

Supported MVP actions:

- Approve
- Reject
- Clear Selection

Partial success is permitted for bulk operations: successful decisions are committed independently of Applications that fail validation.

## 12. Loading/error/empty behavior

The workspace preserves the previously frozen concise operational copy pattern:

- `Loading applicants...`
- `Loading applicant details...`
- `Unable to load applicant details.`
- `Unable to complete the action. Please try again.`
- `Some applications couldn't be processed.`

Default empty state:

**No applicants yet**  
Any creator applying to this campaign will appear here for your approval.

## 13. Mobile

Desktop uses Applicant cards with a right-side detail surface. Mobile uses a full-screen Applicant modal. The decision hierarchy and Application grouping semantics remain identical.

## 14. UI invariants

1. One CampaignCreator should not be duplicated into separate top-level cards merely because multiple Applications exist.
2. Every underlying Application remains inspectable.
3. Match belongs to an Application and is never averaged.
4. Representative Application is a query/UI projection, not persisted domain state.
5. History and Alerts support the decision but do not change Match.
6. Optional sections render only when meaningful data exists.
7. Approve/Reject always resolves to a specific Application.

---

**FROZEN:** This contract is the canonical Applicants Step 3 workspace/UI authority.