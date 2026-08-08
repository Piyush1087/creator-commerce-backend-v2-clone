# Creator Shop — Outreach Eligibility + Quota Contract

**Status:** FROZEN  
**Canonical step:** Outreach Step 2

## 1. First-Outreach eligibility

Before a CampaignCreator enters Outreach, runtime validates current operational eligibility. At minimum:

- Campaign is creator-accessible and operationally eligible.
- At least one active CampaignAsset/Product + active/published Brief path exists.
- Campaign remains within the applicable Outreach runway.
- CampaignCreator is not rejected or archived.
- CampaignCreator has no prior valid Application for the Campaign.
- No Outreach already exists for the CampaignCreator.
- The resolved channel is currently usable.

A paused Campaign, zero active Product+Brief path, inactive required Meta capability, exhausted daily Campaign quota, prior Application, rejection/archive or existing Outreach blocks a new first Outreach action as applicable.

## 2. Campaign daily capacity

MVP cap:

```text
maximum 50 new CampaignCreators
/ Campaign
/ day
```

The cap is Campaign-level, not Brand-level.

A CampaignCreator consumes one daily slot only when their first Outreach action is successfully initiated/accepted:

- Priority DM → Brand Send passes validation and is accepted for scheduling.
- Email → first successful Gmail compose initiation.

Opening/previewing/editing/cancelling the composer does not consume quota.

## 3. Email attempt semantics

Email permits a maximum of three Gmail compose initiations for the same Outreach.

- #1 consumes the CampaignCreator's single daily Outreach slot.
- #2 and #3 consume no additional daily Outreach quota.
- They are not follow-ups; any real follow-up is performed independently by the Brand in Gmail in MVP.
- Creator Shop does not infer whether the external email was actually sent.

## 4. Priority DM pacing

Priority DM physical execution is paced by both limits simultaneously:

```text
max 4 actual Priority DMs / Campaign / hour
max 12 actual Priority DMs / Brand Meta account / hour
```

The Campaign daily cap and Priority-DM execution pacing are separate controls:

- 50/day governs first Outreach initiation.
- 4/hour and 12/hour govern actual Meta Priority-DM execution.

Scheduler pacing is hidden from the Brand. When the Brand's Priority-DM Send action is accepted, the Brand receives the `Priority DM sent` experience even if physical execution occurs later.

## 5. Spillover and historical quota

Priority-DM scheduler work may cross midnight.

- A DM accepted against Day N's quota belongs to Day N's initiation cohort.
- If it physically executes on Day N+1, it does not consume Day N+1's Campaign Outreach quota again.
- It does consume the applicable hourly Campaign/Brand scheduler capacity at actual execution time.
- A later failed/cancelled Priority DM does not refund historical daily Outreach quota.

## 6. Manual creator quota behavior

Manual single-add and CSV creators use the same Campaign daily capacity as Marketplace creators. Manual ingestion never bypasses the 50/Campaign/day limit.

A creator may still be added after the Campaign's 50 slots are exhausted; ingestion succeeds, but first Outreach waits until capacity becomes available on a later Campaign day.

## 7. Concurrency and authority

Quota enforcement is server-authoritative and concurrency-safe. Simultaneous Brand/team actions must not exceed the 50/Campaign/day limit or create duplicate Outreach records.

Exact scheduler/job implementation remains infrastructure-owned rather than Campaign-domain persistence.

This contract is **FROZEN**.