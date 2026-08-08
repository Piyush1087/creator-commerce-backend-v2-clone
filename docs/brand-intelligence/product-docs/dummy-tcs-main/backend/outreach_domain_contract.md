# Creator Shop — Outreach Domain Contract

**Status:** FROZEN  
**Scope:** Discovery → Outreach domain boundary  
**Canonical step:** Outreach Step 1

## 1. Domain purpose

Outreach is the Campaign-level contact lifecycle for a `UceCampaignCreator`. Outreach targets the Campaign, not a CampaignAsset/Product or Brief. Product and Brief are selected later when the creator applies.

`UceCampaignCreator` remains the durable Campaign↔Creator continuity identity across Discovery, Outreach and Applicants.

Canonical topology:

```text
Campaign
  └─ CampaignCreator
       ├─ Recommendation[]
       ├─ Outreach?          // max 1
       │    └─ Attempt[]
       └─ Application[]
```

## 2. Source-based channel resolution

Only one Outreach option is exposed for a CampaignCreator.

- Marketplace creator → Priority DM.
- Manual/CSV creator with Marketplace capability available before Outreach begins → Priority DM.
- Manual/CSV creator not yet resolved on Marketplace → Email.
- If a manual/CSV creator is successfully uploaded but Marketplace fetch/enrichment has not happened yet, Outreach remains available through Email.
- Once Outreach begins, the resolved channel is frozen. Later Marketplace enrichment does not switch an existing Email Outreach to Priority DM.

Manual single-add and CSV are ingestion methods of the same manual creator flow, not separate creator-source domains.

## 3. Outreach cardinality

A CampaignCreator can have at most one Campaign-level Outreach lifecycle.

- Priority DM → one Brand-confirmed Outreach action in MVP.
- Email → up to three Gmail compose initiations because Creator Shop cannot confirm whether the Brand actually completed the external Gmail send.
- Email initiations #2/#3 are retries/re-entry into the same compose action, not Creator Shop-managed follow-up emails.

## 4. Application boundary

Application is a separate domain from Outreach.

- A creator may apply without having received Outreach.
- Once a valid Application exists for the CampaignCreator, future Campaign Outreach is suppressed.
- Application suppression remains even if the Application is later rejected, withdrawn, expired or superseded.
- Product and Brief enter only through the creator's Application choice; they do not become Outreach targeting dimensions.

## 5. Active workspace semantics

The default Outreach view contains CampaignCreators who still need their first Outreach action.

After Outreach is initiated, the card leaves the default actionable view and remains available through Outreach Completed.

Rejected and Archived CampaignCreators likewise leave the default actionable view and remain available through their respective filters/buckets. These actions do not delete CampaignCreator, recommendation, application or Outreach history.

## 6. Duplicate identity

CampaignCreator identity remains:

```text
Campaign + Platform + normalized social handle
```

A duplicate manual/CSV upload must resolve the existing CampaignCreator rather than create another creator card or reset its existing state/history. Email is contact information, not the duplicate-identity key.

## 7. Frozen exclusions

Outreach does not:

- match at Product or Brief level;
- own Recommendation Score computation;
- create multiple channel choices on one creator card;
- treat Email retries as follow-up orchestration;
- delete historical CampaignCreator evidence when Outreach completes, the creator is rejected, or the creator is archived.

This contract is **FROZEN**.