# Creator Shop — Share Backend Schema Reconciliation

**Status:** FROZEN  
**Scope:** Campaign Share — Step 2  
**Schema baseline:** `campaign_schema.prisma` v1.7  
**Target schema:** v1.8

## 1. Purpose

This artifact reconciles the frozen Campaign Share Behaviour / Domain Contract against the actual v1.7 Campaign working schema and freezes the minimum backend persistence delta required for MVP.

Campaign Share is Campaign-scoped distribution. It is not Creator Outreach, even though it should reuse common composition, tracking and attribution infrastructure where practical.

## 2. Domain grain

Canonical relation:

```text
UceCampaign
    ↓ 1:N
UceCampaignShare
```

A Share is not scoped to `UceCampaignCreator` and does not create a CampaignCreator.

Each persisted `UceCampaignShare` represents one executed Brand Share action, not a modal open, channel selection or abandoned composition draft.

## 3. Existing Outreach model must remain separate

v1.7 `UceOutreach` is explicitly CampaignCreator-scoped and assumes:

- one Outreach lifecycle per CampaignCreator;
- a known creator destination;
- persisted composed/final content;
- channel-specific Outreach attempt semantics;
- Outreach-specific quota/scheduler behavior.

Campaign Share has none of those invariants.

Therefore:

- do not reuse `UceOutreach` for Share;
- do not add Share channels to `UceOutreachChannel`;
- do not create synthetic CampaignCreators for shared recipients;
- do not make Share consume Outreach quota.

## 4. Share channels

Add a Share-specific enum:

```prisma
enum UceCampaignShareChannel {
  COPY_LINK
  WHATSAPP
  INSTAGRAM
  NATIVE_SHARE
}
```

`NATIVE_SHARE` is capability-dependent. If the browser/device does not support the native share mechanism, the product does not need to expose that option.

A native-share handoff remains attributed as `NATIVE_SHARE`; the system must not infer which downstream app the Brand selected unless that information is reliably available.

## 5. Share action semantics

No Share status/action enum is required for MVP.

Persistence itself is the canonical action evidence:

- `COPY_LINK` row → tracked link was copied through the controlled product action;
- `WHATSAPP` row → WhatsApp sharing/handoff was initiated;
- `INSTAGRAM` row → supported Instagram sharing/handoff was initiated;
- `NATIVE_SHARE` row → native share handoff was initiated.

The system does not claim external message delivery, read status or recipient identity.

`initiatedAt` is therefore the canonical timestamp; do not name it `sentAt` or `deliveredAt`.

## 6. No Share attempt model

Do not add `UceCampaignShareAttempt`.

Repeated Share actions create separate `UceCampaignShare` rows:

```text
Campaign X
├── Share A / WHATSAPP
├── Share B / COPY_LINK
└── Share C / WHATSAPP
```

This differs from Outreach, where one CampaignCreator-level lifecycle can contain multiple channel-aware attempts.

## 7. Tracking identity

Every executed Share action receives a unique opaque tracking identity.

Add:

```prisma
trackingToken String @unique @map("tracking_token")
```

The public Campaign URL uses/resolves this token through the shared tracking infrastructure. Raw internal database IDs must not be exposed as public tracking identifiers.

One permanent Campaign+channel token must not be reused across all Share actions; per-action identity is required so separate Share actions remain distinguishable.

## 8. Share click evidence

For the v1.8 Campaign working schema, add a Share-specific append-only tracking event model rather than refactoring the already-frozen Outreach persistence contract.

Add:

```prisma
enum UceCampaignShareTrackingEventType {
  LINK_CLICKED
}
```

and `UceCampaignShareTrackingEvent`.

This is intentionally analogous to `UceOutreachTrackingEvent` while remaining a separate domain model.

Long-term production infrastructure may implement both through common tracking primitives without requiring the Campaign-domain tables to become one polymorphic entity.

## 9. Application source

v1.7 currently supports:

```prisma
enum UceApplicationSource {
  DIRECT
  OUTREACH
}
```

Extend it to:

```prisma
enum UceApplicationSource {
  DIRECT
  OUTREACH
  SHARE
}
```

This allows the canonical Application to record that its acquisition pathway was Campaign Share.

## 10. Exact Share-to-Application attribution is deferred

Do **not** add `campaignShareId` to `UceApplication` in v1.8.

Reason: existing `OUTREACH` Application attribution is currently source-level rather than carrying an explicit `outreachId`. Adding an exact Share FK now would create an inconsistent acquisition-attribution model in which Share is more precisely modeled than Outreach.

For v1.8:

```text
Application.source = SHARE
```

is sufficient at the Campaign-domain persistence boundary.

The tracking/session infrastructure may retain richer Share identity/channel evidence. A future generalized acquisition-attribution reconciliation should solve exact `OUTREACH` and `SHARE` source references together.

## 11. Composer persistence

Share composition reuses common composer infrastructure conceptually, but Share drafts/content remain ephemeral for MVP.

Do not add to `UceCampaignShare`:

- `composerVersion`;
- `composedBody`;
- `finalBody`;
- subject fields;
- recipient personalization fields.

The Share composer is Campaign/Brand-context based and freely editable before handoff, but Campaign Share persistence is not a message audit trail.

## 12. Preview image / link metadata

Do not persist preview-image fields on `UceCampaignShare`.

Campaign link-preview metadata is resolved at the public Campaign Page/link layer using the frozen deterministic fallback:

```text
Campaign-specific hero/share image, if available
        ↓
Primary Campaign Product image
        ↓
Brand logo
        ↓
Creator Shop default Campaign image
```

The preview represents the Campaign, not an individual Share action. Receiving platforms control whether/how the preview is rendered.

## 13. Campaign relation

Add to `UceCampaign`:

```prisma
shares UceCampaignShare[]
```

No Share-specific Campaign lifecycle/status fields are required.

## 14. Proposed Campaign Share model

```prisma
model UceCampaignShare {
  id String @id @default(cuid())
  campaignId String @map("campaign_id")
  channel UceCampaignShareChannel
  trackingToken String @unique @map("tracking_token")
  campaign UceCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  trackingEvents UceCampaignShareTrackingEvent[]
  initiatedAt DateTime @default(now()) @map("initiated_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([campaignId, initiatedAt])
  @@index([channel, initiatedAt])
  @@map("uce_campaign_shares")
}
```

No `updatedAt` is required because an executed Share action is immutable evidence for MVP.

## 15. Proposed Share tracking model

```prisma
model UceCampaignShareTrackingEvent {
  id String @id @default(cuid())
  shareId String @map("share_id")
  type UceCampaignShareTrackingEventType
  share UceCampaignShare @relation(fields: [shareId], references: [id], onDelete: Cascade)
  occurredAt DateTime @default(now()) @map("occurred_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([shareId, occurredAt])
  @@index([type, occurredAt])
  @@map("uce_campaign_share_tracking_events")
}
```

Click aggregates remain derived projections rather than persisted counters.

## 16. Lifecycle and deletion

Shareability derives from existing Campaign public-access/lifecycle rules. Do not persist duplicate fields such as:

- `canShare`;
- `shareEnabled`;
- `shareStatus`.

At execution time, the runtime must verify that the Campaign is currently shareable/publicly accessible.

Previously generated tracked URLs resolve against current Campaign access rules; a tracking URL must not create an immortal copy of Campaign availability.

Historical Share/click evidence remains preserved through normal Campaign lifecycle changes such as pause, completion and archive.

If the Campaign entity itself is physically deleted, Share rows and their tracking events may cascade with it according to the working schema relation.

## 17. Quota and counters

Campaign Share does not consume Outreach quota and has no MVP Campaign-domain Share quota.

Do not persist:

- `shareCount`;
- `dailyShareCount`;
- `remainingShares`;
- `lastSharedAt`.

Any future aggregates can be derived from Share actions. Generic infrastructure abuse/rate protection remains outside this domain contract.

## 18. Recipient/deduplication boundary

Share has no canonical recipient identity.

Therefore MVP does not support recipient-level Share deduplication and does not infer that a recipient is a Creator Shop Creator merely because they received or clicked a Campaign Share link.

## 19. Shared engineering infrastructure

The backend should reuse common infrastructure where practical for:

- deterministic/channel-aware composition;
- tracked Campaign URL generation/resolution;
- click capture;
- attribution plumbing.

But persistence/domain ownership remains separate:

```text
Campaign communication/distribution
├── Outreach
│   └── CampaignCreator-scoped
└── Share
    └── Campaign-scoped
```

The exact physical source-code directory should follow the production repository architecture. Share must not be embedded inside the Outreach domain merely because some primitives are reusable.

## 20. Frozen v1.7 → v1.8 schema delta

### New enums

```text
UceCampaignShareChannel
- COPY_LINK
- WHATSAPP
- INSTAGRAM
- NATIVE_SHARE

UceCampaignShareTrackingEventType
- LINK_CLICKED
```

### Modified enum

```text
UceApplicationSource
+ SHARE
```

### Modified model

```text
UceCampaign
+ shares UceCampaignShare[]
```

### New models

```text
UceCampaignShare
- id
- campaignId
- channel
- trackingToken
- campaign
- trackingEvents[]
- initiatedAt
- createdAt

UceCampaignShareTrackingEvent
- id
- shareId
- type
- share
- occurredAt
- createdAt
```

### Explicitly excluded from v1.8

- changes to `UceOutreach` or `UceOutreachChannel`;
- Share attempt table;
- Share recipient relation;
- CampaignCreator creation from Share;
- persisted Share composer content/drafts;
- Share composer-version audit fields;
- preview image fields on Share;
- Share delivery/read state;
- Share quotas/counters;
- Share-specific Campaign lifecycle state;
- exact `campaignShareId` on Application;
- generalized acquisition-attribution refactor;
- refactor of Outreach tracking tables into a polymorphic tracking table.

---

**Share Step 2 — Backend Schema Reconciliation is FROZEN.**

**Next schema target:** `campaign_schema.prisma` v1.7 → v1.8.