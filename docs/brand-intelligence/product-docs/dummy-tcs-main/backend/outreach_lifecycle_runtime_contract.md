# Creator Shop — Outreach Lifecycle + Runtime Contract

**Status:** FROZEN  
**Canonical step:** Outreach Step 4

## 1. Outreach vs Attempt

Outreach and OutreachAttempt answer different questions:

- Outreach → has this CampaignCreator entered the Campaign's Outreach lifecycle?
- OutreachAttempt → what channel execution action/evidence occurred?

Persisted Outreach begins only when the Brand successfully initiates the first Outreach action; opening a composer does not itself create the Outreach lifecycle.

## 2. No authoritative top-level status requirement

Lifecycle semantics are authoritative, but a top-level `Outreach.status` is not required. Active/Completed workspace placement and execution outcomes are derived from CampaignCreator, Outreach, Attempt and Application evidence.

The default active Outreach view means: CampaignCreators who still need their first Outreach action.

## 3. Priority DM lifecycle

```text
NO OUTREACH
   ↓ Brand confirms Send
final eligibility + quota validation
   ↓
Outreach + attempt accepted
   ↓
card leaves active view / appears in Outreach Completed
   ↓
ACCEPTED → SCHEDULED → EXECUTED
                    ↘ FAILED
                    ↘ CANCELLED
```

Semantics:

- `ACCEPTED` → Brand confirmation passed validation, quota was consumed and scheduler accepted the immutable payload.
- `SCHEDULED` → execution time was assigned.
- `EXECUTED` → Creator Shop successfully executed the Meta Priority DM action; it does not imply delivered/read/clicked.
- `FAILED` → valid execution failed operationally/provider-side.
- `CANCELLED` → current domain eligibility no longer permits execution.

Priority DM has no automatic second Outreach attempt in MVP.

## 4. Pre-execution revalidation

Immediately before actual Meta execution, revalidate current eligibility, including Campaign accessibility/operational state, active Product+Brief path, CampaignCreator suppression state, Application existence and Meta capability.

If the creator applies after scheduler acceptance but before physical execution, the pending Priority DM is cancelled rather than sent unnecessarily.

Campaign pause or other domain invalidation can likewise cancel pending execution.

Temporary provider/Meta unavailability may be handled by bounded scheduler retry/holding behavior; exact infrastructure retry windows are not frozen into the Campaign domain.

## 5. Email lifecycle

Creator Shop cannot truthfully model external Gmail send/delivery in MVP.

```text
NO OUTREACH
   ↓ Brand continues to Gmail
eligibility + quota validation
   ↓
Outreach + COMPOSE_INITIATED #1
   ↓
card leaves active view / appears in Outreach Completed
   ↓
optional Open Email Again #2
optional Open Email Again #3
```

Email attempt evidence is `COMPOSE_INITIATED`; Creator Shop does not infer `SENT`, `DELIVERED`, `OPENED` or provider failure.

Email #2/#3 are optional re-entry actions from completed history, not active-work follow-ups.

## 6. Applications and tracking are separate events

Do not model `APPLIED` or `CLICKED` as Outreach lifecycle statuses.

- Clicks are tracking events/projections.
- Application is created in the Applicants domain.
- Outreach history remains intact when the creator later applies.

## 7. Campaign changes after Outreach

- Email already handed to Gmail cannot be retracted; historical compose evidence remains.
- A later Email re-open action must pass current eligibility validation.
- A scheduled Priority DM is revalidated before execution and may be cancelled if Campaign/creator state no longer permits Outreach.
- The already Brand-approved Priority-DM body is not silently regenerated after Campaign edits.

## 8. Idempotency and concurrency

Runtime must ensure:

- Brand double-click does not create duplicate Outreach, duplicate quota consumption or duplicate scheduler jobs.
- Email browser/event duplication does not accidentally consume multiple compose attempts.
- Priority-DM worker retries do not logically execute the same DM twice.
- Daily Campaign quota enforcement is concurrency-safe.

## 9. Quota accounting

The first successful Outreach initiation consumes the CampaignCreator's one daily Campaign Outreach slot.

Later Email compose initiations consume no additional slot. Later Priority-DM failure/cancellation does not refund the original slot.

## 10. Workspace semantics

`Outreach Completed` is an operational UI projection meaning the Brand has already initiated the Campaign's Outreach action for that CampaignCreator. It must not be presented as proof that an Email/DM was delivered.

Rejected and Archived are distinct CampaignCreator operating buckets; historical Outreach evidence, if any, remains preserved.

This contract is **FROZEN**.