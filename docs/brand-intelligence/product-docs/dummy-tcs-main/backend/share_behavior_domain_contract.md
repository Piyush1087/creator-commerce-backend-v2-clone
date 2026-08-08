# Creator Shop — Share Behaviour / Domain Contract

**Status:** FROZEN  
**Scope:** Campaign Share — Step 1  
**Schema implementation:** `campaign_schema.prisma` v1.8

## 1. Domain purpose

Campaign Share is Campaign-level distribution of a public Campaign opportunity.

It is not Creator Outreach.

Canonical grain:

```text
Campaign
   ↓
Campaign Share
```

Share does not require a known Creator/recipient and does not create a `CampaignCreator`.

A Brand may share a Campaign with one creator, a group, an unknown recipient or through another external distribution surface.

## 2. Relationship to Outreach

Share and Outreach may reuse common engineering primitives for:

- deterministic/channel-aware composition;
- tracked Campaign URL generation;
- click tracking;
- attribution plumbing.

Their domain semantics remain separate.

```text
Campaign communication/distribution
├── Outreach
│   └── CampaignCreator-scoped
└── Share
    └── Campaign-scoped
```

Share must not be represented as an Outreach attempt or require an Outreach record.

## 3. MVP Share channels

MVP supports:

```text
COPY_LINK
WHATSAPP
INSTAGRAM
NATIVE_SHARE
```

`NATIVE_SHARE` is capability-dependent and may be surfaced as a generic `More...` action. If the device/browser does not support native sharing, that option does not need to be exposed.

Email is not duplicated as a Share channel because creator Email is already handled by the Outreach workflow.

Additional explicit channels such as SMS, Facebook, LinkedIn, X or Telegram are outside MVP. They may be reachable indirectly through native sharing where supported.

## 4. Canonical interaction behaviour

The functional behaviour is:

```text
Brand clicks Share
        ↓
Share surface opens
        ↓
Brand selects Share channel
        ↓
channel-specific message is composed where applicable
        +
tracked Campaign URL
        ↓
Brand may freely edit the message
        ↓
Brand initiates the Share action
        ↓
external channel handoff / link copy
        ↓
Share surface closes
```

This contract freezes behaviour only. It does not freeze the visual design of the modal/popup or Campaign frontend.

## 5. Persistence boundary

Opening the Share surface is not a Share event.

Selecting a channel is not a Share event.

Editing a generated message is not a Share event.

A canonical Share action exists only when the Brand executes the controlled Share action, such as copying the tracked link or initiating the supported external-channel handoff.

Abandoned Share surfaces must not create persistent Share evidence.

## 6. Copy Link behaviour

`COPY_LINK` does not require message composition.

```text
Brand selects Copy Link
        ↓
tracked Campaign URL is generated/resolved
        ↓
URL is copied through the controlled product action
```

The system knows that the tracked URL was copied. It does not know where the Brand subsequently pasted or distributed it.

Therefore its canonical attribution remains:

```text
source = SHARE
channel = COPY_LINK
```

The downstream distribution channel must not be inferred.

## 7. Share composition

For channels where a message is relevant, Share uses deterministic/channel-aware composition from authoritative Brand + Campaign context.

The initial generated message is freely editable by the Brand in MVP.

The same exact body must not be assumed to be optimal for every channel. WhatsApp, Instagram and other supported surfaces may use different composition rules while drawing from the same canonical Campaign facts.

## 8. No recipient personalization dependency

Share composition must not require creator-specific context such as:

- creator name;
- creator handle;
- Recommendation Score;
- Applicant Match Score;
- creator archetype.

There may be no known recipient.

A Brand may manually personalize the free-form message before sharing if desired.

## 9. Composer persistence

Share composer state is ephemeral for MVP.

The Campaign Share domain does not require persistence of:

- initial composed body;
- Brand-edited final body;
- composer version;
- recipient personalization.

Share persistence is distribution/tracking evidence, not a message audit trail.

## 10. Mandatory tracked Campaign URL

Every canonical Share action uses a tracked Campaign URL rather than an untracked raw Campaign URL.

Conceptually:

```text
Campaign
   ↓
Share action
   ↓
opaque tracked Campaign URL
   ↓
public Campaign Page
```

The tracking identity must resolve at least:

- Campaign;
- Share source;
- Share channel;
- individual Share action.

Raw internal database IDs must not be exposed as public tracking identifiers.

## 11. Per-action tracking identity

Each executed Share action receives its own tracking identity.

Example:

```text
Campaign X
├── Share A / WhatsApp / token A
├── Share B / WhatsApp / token B
└── Share C / Copy Link / token C
```

A permanent Campaign+channel tracking token must not be reused for every future Share action because that would collapse separate distribution actions into indistinguishable evidence.

## 12. Attribution semantics

Canonical acquisition source:

```text
source = SHARE
```

Canonical Share channels:

```text
COPY_LINK
WHATSAPP
INSTAGRAM
NATIVE_SHARE
```

This keeps Campaign Share analytically distinct from direct acquisition and Creator Outreach.

Where the broader attribution infrastructure can preserve richer Share-action/channel evidence through the Campaign visit/application journey, it may do so. Exact Share-to-Application persistence is governed by the backend reconciliation contract rather than being forced into this behavioural contract.

## 13. Click semantics

A tracked Share-link click proves only:

> the tracked Campaign URL associated with that Share action was opened.

It does not prove:

- message delivery;
- message read;
- recipient identity;
- creator interest;
- Application creation.

Application remains a separate domain event.

## 14. External-channel truthfulness

For WhatsApp, Instagram and Native Share, Creator Shop generally controls the handoff to an external sharing surface, not actual recipient delivery.

Therefore the canonical evidence is equivalent to:

```text
SHARE_INITIATED
```

not:

```text
SENT
DELIVERED
READ
```

For Copy Link, Creator Shop can truthfully know that the controlled copy action occurred.

## 15. Instagram boundary

Campaign Share through Instagram is distinct from Meta Priority DM Outreach.

```text
SHARE / INSTAGRAM
≠
OUTREACH / PRIORITY_DM
```

The Share contract means initiating the supported Instagram sharing/handoff flow. It does not imply that Creator Shop can programmatically send an arbitrary Instagram Priority DM through the Share button.

## 16. Native Share boundary

When `NATIVE_SHARE` is used, the Brand may choose the actual destination application after entering the device/browser share sheet.

Unless the platform reliably exposes that destination, attribution remains:

```text
channel = NATIVE_SHARE
```

The system must not guess whether the Brand ultimately selected WhatsApp, Telegram, Messages, LinkedIn or another application.

## 17. Repeated Share actions

There is no MVP maximum number of Share actions per Campaign or per Brand.

Repeated Share actions are valid and independent:

```text
WhatsApp Share
WhatsApp Share
Copy Link
Instagram Share
Copy Link
...
```

Share does not use the Outreach Email max-click model and does not require a Share-attempt lifecycle.

## 18. Outreach quota isolation

Campaign Share does not consume the frozen Outreach capacity/quota.

Share is not subject to:

- Campaign Outreach daily capacity;
- Priority DM scheduler capacity;
- Email Outreach click limits.

Generic infrastructure-level abuse/rate protection may still exist independently and is not a Campaign Share domain quota.

## 19. Recipient identity and deduplication

Share has no canonical recipient identity in MVP.

Therefore the system cannot and must not enforce recipient-level deduplication such as:

> Campaign already shared with Creator X.

A person receiving or clicking a Campaign Share link does not automatically become a `CampaignCreator` or enter Discovery.

## 20. Campaign shareability

A Campaign can be shared only when it is externally accessible according to the Campaign's authoritative public-access/lifecycle rules.

At execution time:

```text
Campaign currently shareable/publicly accessible?
        ↓
YES → allow Share action
NO  → block Share action
```

Share does not create a second Campaign lifecycle or independent `shareEnabled` state.

## 21. Existing shared links and lifecycle

A tracked Share URL does not create an immortal snapshot of Campaign availability.

Conceptually:

```text
tracked Share URL
        ↓
resolve Campaign
        ↓
apply current Campaign public-access rules
```

Campaign pause/completion/archive behaviour therefore follows the authoritative Campaign access contract.

Historical Share and click evidence remains historical evidence and is not deleted merely because Campaign lifecycle changes.

## 22. Campaign link preview

Campaign Share should support link-preview metadata so receiving platforms may render a Campaign preview.

The preview is link metadata, not a message attachment.

Deterministic image fallback:

```text
Campaign-specific hero/share image, if available
        ↓
Primary Campaign Product image
        ↓
Brand logo
        ↓
Creator Shop default Campaign image
```

MVP does not introduce a new mandatory Campaign-image upload solely for Share.

## 23. Preview ownership

The preview represents the Campaign, not the individual Share action.

Multiple tracked URLs for the same Campaign generally resolve to the same Campaign-level preview metadata.

Do not generate or persist duplicate preview assets for every Share action.

Receiving platforms ultimately control whether and how link-preview metadata is rendered; Creator Shop must not promise identical previews across WhatsApp, Instagram or other surfaces.

## 24. Reporting / Intelligence boundary

Share creates canonical distribution and click evidence that may later be consumed by the Intelligence Engine for Campaign reporting/analysis.

Share itself does not calculate Reporting metrics.

Potential analytical questions such as Share-generated Campaign visits or Applications remain Intelligence-owned derivations from canonical evidence.

## 25. Explicit MVP exclusions

Campaign Share does not introduce:

- a known recipient requirement;
- recipient-level deduplication;
- CampaignCreator creation;
- Outreach quota consumption;
- Share delivery/read receipts;
- persisted Share composer drafts/content;
- Share composer audit/version history;
- per-recipient Share lifecycle;
- Share-specific Campaign lifecycle state;
- guaranteed external-platform preview rendering;
- full Campaign Share UI/frontend specification.

---

## Frozen domain statement

> **Campaign Share is Campaign-scoped distribution using channel-specific, freely editable composition and a mandatory tracked Campaign URL. MVP supports `COPY_LINK`, `WHATSAPP`, `INSTAGRAM`, and capability-dependent `NATIVE_SHARE`. Each executed Share action receives its own tracking identity. Share is not Outreach, creates no CampaignCreator, consumes no Outreach quota, has no recipient deduplication, and does not claim external delivery. Composer drafts remain ephemeral. Campaign link previews are resolved from Campaign/Product/Brand/default metadata rather than sent as attachments. Share reuses common composer/tracking/attribution infrastructure with Outreach while retaining separate persistence semantics.**

---

**Share Step 1 — Behaviour / Domain Contract is FROZEN.**

**Implemented by:** `campaign_schema.prisma` v1.8 together with the frozen `share_backend_schema_reconciliation.md` Step 2 contract.