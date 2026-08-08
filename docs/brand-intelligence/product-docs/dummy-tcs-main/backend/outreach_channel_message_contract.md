# Creator Shop — Outreach Channel + Message Contract

**Status:** FROZEN  
**Canonical step:** Outreach Step 3

## 1. One resolved channel

Each CampaignCreator exposes exactly one resolved Outreach channel:

```text
Marketplace creator → PRIORITY_DM
Manual/CSV + Marketplace capability available before Outreach → PRIORITY_DM
Manual/CSV + Marketplace capability unavailable/not yet resolved → EMAIL
```

Once Outreach begins, the channel is frozen.

## 2. Channel-specific composer

Priority DM and Email use separate composition styles. They may share authoritative Campaign/Brand/Creator facts, but the rendered copy should not simply be the same body placed into two channels.

- Priority DM should be concise and conversational.
- Email can provide more context and includes Subject + Body.
- Outreach copy remains Campaign-level and must not target or prescribe a Product/Brief.
- Recommendation Score/band is not exposed to the creator and must not appear as creator-facing AI-match language.

## 3. MVP free-form Brand editing

The composer creates the initial draft, but in MVP the Brand may freely edit the message before confirming Outreach.

This is intentional product-learning behavior: preserve both the system-composed draft and the Brand-approved final copy so future composer versions can learn what Brands expect.

For Email, preserve composed/final Subject as well as composed/final Body. Priority DM has no Email subject requirement.

Composer preview/edit state may remain ephemeral until the Brand actually initiates Outreach.

## 4. Controlled initial composition

The initial composer should use authoritative Campaign/Brand/Creator context and controlled composition rather than invent unsupported claims.

Priority-DM initial drafts should support controlled variation so the system is not repeatedly producing one fixed message structure across creator outreach. The Brand remains free to edit the draft in MVP.

The composer must not fabricate claims such as a Brand having followed a creator unless evidence supports that statement.

## 5. Tracked Campaign URL

Every Outreach contains a stable tracked Campaign URL attributable to the CampaignCreator-level Outreach.

The tracking identity resolves at least:

```text
Campaign
CampaignCreator
Outreach
Channel
```

The creator-facing token/slug must be opaque and must not expose raw internal IDs.

The destination is the Campaign, not Product/Brief. Creator evaluates the Campaign and selects Product/Brief when applying.

## 6. Email reuse

Email compose initiations #2/#3 reuse the same Outreach content and stable tracking URL. They are recovery/re-entry actions because Creator Shop cannot confirm the external Gmail send; no separate follow-up content orchestration is required.

## 7. Tracking semantics

A tracked-link click means only that the Campaign URL associated with that Outreach was opened. It does not prove:

- DM/email delivery;
- email open;
- DM read;
- creator interest;
- eventual Application.

Raw click events may be preserved; `hasClicked`, `firstClickedAt`, `lastClickedAt` and `clickCount` are projections.

Application remains a separate domain event.

## 8. Priority DM confirmation

For Priority DM:

```text
resolve channel
→ compose initial draft
→ Brand freely edits
→ Brand confirms Send
→ final eligibility/quota validation
→ freeze approved payload
→ scheduler acceptance
```

The scheduler must execute the frozen Brand-approved payload; it must not regenerate the DM later because the Campaign or composer version changed.

## 9. Email confirmation

For Email:

```text
resolve channel
→ compose Subject + Body
→ Brand freely edits
→ Brand continues to Gmail
→ prefilled external Gmail compose opens
```

Creator Shop records compose initiation, not actual email send/delivery. The Brand may technically modify content again once inside Gmail; that external behavior is outside Creator Shop's MVP integration boundary.

## 10. Message provenance

Persist enough evidence to reconstruct what Creator Shop proposed and what the Brand approved, including composer version, composed/final message content, stable tracking identity and confirmation/execution evidence.

This contract is **FROZEN**.