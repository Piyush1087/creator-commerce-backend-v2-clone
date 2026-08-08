# Creator Shop — Discovery → Outreach Orchestration Contract

**Status:** FROZEN  
**Canonical step:** Outreach Step 5

## 1. Responsibility boundary

Discovery determines which creators are good Campaign-level candidates. Outreach determines which currently eligible CampaignCreators can be contacted from the available pipeline.

Product/CampaignAsset and Brief remain outside creator recommendation and Outreach orchestration.

```text
Intelligence Engine
→ Campaign-level recommendations
→ Discovery / CampaignCreator pool
→ Outreach eligibility
→ Outreach
→ Priority DM or Email
```

## 2. Daily demand

Each Campaign has a maximum of 50 new CampaignCreators entering Outreach per day. This is a ceiling, not an obligation.

If fewer qualified/eligible creators exist, the system does not lower recommendation quality merely to fill 50 slots.

## 3. Marketplace ordering

Marketplace-recommended CampaignCreators are ordered by the Intelligence Engine's Campaign-level Recommendation Score.

Outreach does not create a separate `outreachScore` and does not recalculate Recommendation Score. Ineligible/already-consumed creators are skipped and selection continues down the ranked pool.

The underlying score remains Intelligence-owned; creator-facing Outreach copy does not expose it.

## 4. Manual/CSV creators

Manual single-add and CSV creators participate in the same CampaignCreator/Outreach pipeline.

They are Brand-directed candidates and may be contacted without waiting for Marketplace enrichment/recommendation scoring. They still consume the same 50/Campaign/day Outreach capacity.

A manual creator added after today's quota is exhausted remains a valid CampaignCreator and becomes contactable when future capacity is available.

## 5. Marketplace enrichment merge

If a manually added creator is later found by Marketplace enrichment, enrichment attaches to the existing CampaignCreator identified by Campaign + platform + normalized social handle. It must not create a duplicate CampaignCreator.

If Outreach has not begun, newly available Marketplace capability may resolve the eventual channel to Priority DM. If Email Outreach already began, the existing Outreach remains Email.

## 6. Duplicate ingestion

Duplicate manual/CSV ingestion does not create a new CampaignCreator, reset state, reset Outreach, or erase rejection/archive/Application history.

Single-add returns contextual existing-state feedback. CSV skips/classifies the duplicate row while continuing the import.

## 7. Rolling pipeline and replenishment

Discovery maintains a rolling actionable pipeline and replenishes before supply is exhausted. It does not need to build an enormous evergreen creator pool on Day 0, and it does not automatically restart expensive Marketplace acquisition from scratch every day.

Exact ready-buffer/replenishment thresholds remain configurable and are not frozen as domain constants.

## 8. Deepest reusable Intelligence stage

When additional recommendations are needed, Intelligence should reuse the deepest still-valid available stage before returning to Marketplace acquisition:

```text
reuse valid L3 if sufficient
→ otherwise L2
→ otherwise L1
→ otherwise Marketplace acquisition
```

The exact persistence destination and implementation of reusable L1/L2/L3 pools remains Intelligence-owned and deferred from the Campaign/Outreach domain.

Outreach communicates demand; it does not instruct Intelligence which API/scan stage to run.

## 9. Actionable supply

Replenishment should reason about future actionable supply rather than raw recommendation-record count. Permanently/non-actionably suppressed CampaignCreators such as rejected, archived, already-outreached or already-applied creators do not represent future Outreach supply.

Temporary blockers such as today's Campaign quota exhaustion or a temporary Campaign pause do not destroy the underlying candidate pool.

## 10. Campaign edits

Already-published recommendations are not automatically recalculated when the Brand edits the Campaign in MVP.

Existing recommendations retain their historical recommendation context/version. Future replenishment uses the latest Campaign context. Different recommendation-context versions may therefore coexist in the remaining pool in MVP.

Current Outreach eligibility is always evaluated against current operational Campaign/creator state even when Recommendation Score came from an older recommendation context.

## 11. Daily continuation

The Campaign daily Outreach cap resets by Campaign day; the recommendation pool does not reset merely because the calendar changed.

Conceptually, after the highest eligible creators are contacted on Day 1, Day 2 continues from the next highest eligible remaining Marketplace candidates, alongside any eligible Brand-directed manual candidates.

## 12. Scheduler backlog separation

Priority-DM scheduler backlog is separate from new-Outreach quota.

A Priority DM accepted on Day N consumes Day N's Campaign Outreach slot. If execution spills into Day N+1, it does not consume another Day N+1 Outreach slot, although it consumes Day N+1 hourly scheduler capacity when executed.

Scheduler pacing remains:

```text
max 4 Priority DMs / Campaign / hour
max 12 Priority DMs / Brand Meta account / hour
```

Exact scheduler backlog ceilings remain infrastructure configuration rather than a frozen domain constant.

## 13. Fixed-date vs evergreen Campaigns

Fixed-date Campaign urgency may cause Discovery to replenish earlier/more aggressively as the usable Outreach runway shortens, but the MVP Campaign daily Outreach cap remains 50.

Evergreen Campaigns use steady rolling replenishment rather than a huge Day-0 recommendation pool.

## 14. Funnel events

Tracking clicks do not create new Discovery demand or restore Outreach capacity. Once a CampaignCreator has entered Outreach, that Outreach slot is consumed regardless of click behavior.

Applications suppress future Outreach supply. Replenishment remains threshold/demand-driven rather than launching an Intelligence run for every individual Application event.

## 15. Frozen architecture

```text
Campaign
  ↓
max 50 new Outreach / day
  ↓
Brand-directed manual candidates
+
Marketplace candidates ranked by Recommendation Score
  ↓
current Outreach eligibility
  ↓
actionable Campaign pipeline
  ↓
replenish before exhaustion
  ↓
Intelligence reuses deepest valid stage
L3 → L2 → L1 → Marketplace as needed
```

This contract is **FROZEN**.