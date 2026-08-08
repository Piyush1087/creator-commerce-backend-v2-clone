# Creator Shop — Campaign Zod / Domain Validation Contract

**Status:** FROZEN  
**Scope:** Campaign backend finalization — Step 1 (A–C)  
**Persistence baseline:** `campaign_schema.prisma` v1.8

## 1. Purpose

This contract freezes validation ownership and command boundaries across the Campaign domain before implementation of the actual Zod schemas.

Zod is not a mirror of Prisma. Prisma describes persistence shape; Zod validates commands and integration payloads entering the Campaign domain.

## 2. Canonical validation ownership

### Zod
Owns:
- request/payload shape;
- primitive types;
- enums;
- required/optional fields;
- string/number limits;
- payload-local cardinality;
- simple cross-field consistency;
- discriminated unions;
- typed validation for JSON-shaped command payloads.

### Domain service
Owns:
- authorization;
- current lifecycle/state eligibility;
- cross-record limits;
- existence and ownership checks;
- relationship validation across persisted entities;
- runtime quotas;
- lifecycle transitions;
- consequences of accepted edits;
- external/provider eligibility;
- domain errors.

### Prisma / database
Owns:
- foreign-key integrity;
- uniqueness;
- structural persistence cardinality;
- durable persistence constraints.

### Intelligence Engine
Owns calculation correctness for:
- Discovery Recommendation Score/rank/band;
- Applicant AI Match Score;
- Reporting calculations and derived intelligence.

Campaign-side schemas validate Intelligence payload contracts but do not recalculate Intelligence outputs.

### External validation
Owns facts requiring external verification, such as lightweight social-handle validation.

## 3. Command-oriented schemas

Do not generate one Zod schema per Prisma model merely by translating database fields.

Schemas must represent domain commands, for example:
- Create Campaign draft;
- Update draft Campaign;
- Publish Campaign;
- Update live Campaign;
- lifecycle transitions;
- add/deactivate Campaign Asset;
- create/update/publish Brief;
- manually add/import Creator;
- Outreach commands;
- Application commands;
- Share command;
- Intelligence publication payloads.

Create, update and transition commands are distinct. Do not use `createSchema.partial()` as a universal update contract.

## 4. System-owned fields

Ordinary Brand/client write schemas must not expose system-owned fields merely because they exist in Prisma.

Examples include:
- lifecycle timestamps;
- status mutation fields where transitions have explicit commands;
- recommendation scores/ranks;
- Applicant Match Score;
- tracking tokens/events;
- Reporting calculation/provenance fields;
- audit timestamps.

## 5. Create Campaign composition

Create Campaign remains composed from the three canonical wizard domains:

```text
Campaign Strategy
+
Creator Strategy / Targeting
+
Commercial Strategy
→ Create Campaign command
```

Each step may be validated independently for frontend UX, while backend publication/readiness validation remains authoritative.

## 6. Campaign Strategy validation

Zod owns structural validation for:
- Campaign name and its frozen length limit;
- publishing schedule enum;
- scheduled/fixed date shape and ordering;
- objective/KPI payload shape;
- platform selection shape;
- visibility shape.

Rules dependent on authoritative current time or reference data receive final service validation, including deadline eligibility and KPI/taxonomy membership/compatibility.

Instagram-only MVP restrictions may be enforced through canonical configuration/schema constraints rather than duplicated ad hoc frontend rules.

## 7. Creator Strategy / Targeting validation

Zod owns:
- Creator archetype list shape and maximum 5;
- follower thresholds and min <= max;
- audience age bounds and min <= max;
- audience gender shape;
- Audience Affinity list shape and maximum 5;
- geography payload shape.

Canonical taxonomy/reference membership is service/reference-data validation. Do not duplicate evolving taxonomy libraries throughout Zod schemas.

## 8. Commercial Strategy validation

Zod owns:
- Brand-support boolean and conditional support fields;
- non-negative support value;
- compensation type;
- non-negative commercial amount, including valid zero-value barter/gifting;
- non-negative total budget;
- advance-payment percentage 0–100;
- payout-term shape;
- Campaign collaboration currency restrictions for MVP.

Simple contradictory payloads should be rejected or canonically normalized. Example: when Brand support is false, support type/value must not remain populated.

Business feasibility and persisted-state consequences remain service-owned.

## 9. Campaign Asset validation

Campaign Asset commands should use discriminated validation by asset kind so mutually exclusive references cannot be supplied together.

Zod validates command shape. Service/DB validates:
- referenced Brand/Offering/Offer existence;
- Brand ownership;
- Campaign relationship;
- duplicate addition;
- lifecycle eligibility.

After Campaign launch, removal should preserve downstream history through deactivation rather than destructive deletion.

An inactive Asset is unavailable for future opportunity selection/new Applications while historical references remain intact.

## 10. Brief validation

Draft and publication are separate command contracts.

A draft may be incomplete. `publishBrief` performs complete publishability validation.

Zod owns Brief payload structure and should recover strong typing for flexible Prisma JSON fields, especially deliverable configuration/creative guidance, preferably using format-aware discriminated schemas rather than `z.any()`.

Service validates:
- Campaign Asset existence;
- Asset belongs to Campaign;
- Asset active;
- Campaign lifecycle allows the operation.

### Published Brief editing

Before downstream Applications exist, broader edits may be permitted subject to the frozen edit contract.

Once a Brief has received an Application, material opportunity-definition fields are immutable for MVP. Materially different requirements should be represented by deactivating the old Brief and creating a new Brief.

Existing Applications and intelligence evidence must not be silently rewritten by Brief edits.

## 11. Discovery / CampaignCreator validation

Three ingestion paths remain distinct:
- Marketplace recommendation;
- Manual single add;
- Manual CSV upload.

Manual single/CSV require both email and social handle at input. Email receives syntactic validation; social handle receives canonical normalization plus lightweight external validation.

CSV row validation must reuse the same canonical creator primitives as manual single-add rather than define a second creator-validity contract.

Marketplace ingestion does not inherit a requirement that the Brand manually provide email.

Duplicate CampaignCreator detection is service/database behavior, not a malformed-Zod-input error.

## 12. Discovery Intelligence boundary

Recommendation results are Intelligence-owned outputs.

Campaign-side Intelligence schemas validate payload structure such as:
- CampaignCreator identity;
- recommendation run/context provenance;
- score range/shape;
- recommendation band;
- rank;
- explanation/provenance fields where contracted;
- evaluation timestamp.

Campaign services validate that supplied provenance belongs to the correct Campaign/context. Campaign does not recalculate the Recommendation Score.

## 13. Outreach validation

Outreach uses command-specific schemas rather than a Prisma-model mirror.

Zod validates command shape, including relevant CampaignCreator/channel/free-form composer fields.

Service owns live-state rules including:
- Campaign/Creator eligibility;
- Campaign pause/lifecycle gates;
- active Product+Brief requirements;
- daily Campaign Outreach capacity;
- resolved channel eligibility;
- Meta/Marketplace/provider state;
- Priority DM scheduler capacity;
- Email max-click semantics;
- completed/archived/rejected conditions.

Email click #2/#3 does not consume another Campaign daily Outreach quota unit under the frozen MVP contract.

## 14. Applicants validation

Use explicit commands such as:
- create Application;
- withdraw Application;
- approve Application;
- reject Application.

Zod validates payload shape/IDs. Service validates:
- Campaign acceptance state;
- Asset active and belongs to Campaign;
- Brief active/published and belongs to Asset;
- Creator eligibility;
- maximum 2 qualifying Applications per Campaign;
- maximum 5 qualifying Applications per Brand;
- frozen treatment of withdrawn Applications in those limits.

Multiple Applications by the same Creator in the same Campaign are deliberately valid within the frozen limits. Do not introduce creator+Campaign uniqueness.

Withdrawal is permitted only while the Application remains eligible for withdrawal. Once the Brand has approved or rejected it, withdrawal is prohibited.

## 15. Applicant Intelligence boundary

Applicant AI Match Score is Intelligence-owned and may differ across multiple Applications from the same Creator because Product × Brief context differs.

Campaign-side schemas validate the Intelligence payload and provenance. Service validates Application/Campaign/Product/Brief relationships. Campaign does not calculate the score.

## 16. Reporting validation

Reporting is primarily an Intelligence-output boundary, not a Brand report-form domain.

A canonical report-publication schema validates the Intelligence → Campaign payload, including contracted identifiers, availability/context, KPI references, report version/context hash, data window, metrics, optional insights/provenance, finality and calculation timestamp.

Campaign service owns persistence eligibility, current-context validation, last-known-good behavior and materialized/current report handling.

A failed calculation is an execution failure, not a valid empty report payload.

## 17. Share validation

Share input remains deliberately small:
- Campaign identity;
- `COPY_LINK | WHATSAPP | INSTAGRAM | NATIVE_SHARE`.

Campaign service validates current shareability, creates/resolves tracking identity and records canonical execution evidence according to the frozen Share contract.

Client input must not be authoritative for tracking events such as `LINK_CLICKED`.

Free-form Share composer content remains ephemeral and must not acquire persistence semantics through Zod.

## 18. Identifier validation

Zod validates identifier structure only.

Existence, ownership and cross-entity relationships are service/database responsibilities. A structurally valid `briefId` does not prove that the Brief belongs to the selected Asset/Campaign.

## 19. Payload-local vs persisted cardinality

Zod owns cardinality when the complete set exists in the request, such as maximum 5 Creator Archetypes or maximum 5 Audience Affinities.

Persisted cardinality requiring database state belongs to services, such as Application limits or Outreach capacity.

## 20. Campaign lifecycle classes

For edit validation, Campaign lifecycle is grouped into:

- `DRAFT` — broadly mutable;
- `PUBLISHED/LIVE` — controlled mutable;
- `PAUSED` — same edit restrictions as LIVE;
- `COMPLETED/ARCHIVED` — Campaign definition immutable.

PAUSE must not become an escape hatch that unlocks edits forbidden on a LIVE Campaign.

## 21. Draft Campaign editing

DRAFT allows broad editing of Brand-owned Campaign definition fields, including Strategy, Targeting, Commercials, Campaign name and permitted Product/Brief setup, subject to normal validation.

System-owned lifecycle/intelligence/tracking fields remain non-writable even in DRAFT.

## 22. Campaign publication

Publication is an explicit lifecycle command, not a generic status update.

`publishCampaign` performs whole-Campaign readiness validation using current authoritative state/time.

Campaign publication itself does not require Product+Brief because the frozen Campaign architecture permits Product addition after launch. Product+Brief availability instead gates relevant downstream operations such as Outreach/Application opportunity selection.

## 23. LIVE Campaign editing

LIVE Campaign edits are controlled and must follow the frozen Edit Campaign contract.

A structurally valid edit can still be rejected by the service because the specific field/action is not editable in the Campaign's current lifecycle/state.

Accepted Campaign edits do not automatically rewrite historical downstream evidence.

## 24. Campaign edit consequences

An accepted LIVE edit must preserve historical truth.

Campaign edits must not automatically:
- rerank existing Discovery creators;
- rewrite existing Recommendation Scores;
- mutate historical Outreach;
- mutate existing Applications;
- recalculate existing Applicant Match Scores;
- mutate Collaborations;
- rewrite historical Reporting evidence.

Future calculations/actions use the current authoritative Campaign definition according to their own trigger contracts.

Existing Recommendation evidence remains tied to its recommendation run/context. MVP does not automatically refresh already-calculated Recommendations merely because the Campaign was edited.

## 25. Product/Brief history after launch

After launch, downstream-referenced Assets/Briefs should be deactivated rather than physically destroyed or repurposed.

Historical Applications, Outreach/intelligence evidence and future Collaboration references must retain their original semantic context.

## 26. Commercial edit history

Commercial changes affect future opportunity presentation/actions and must not retroactively redefine what an existing Creator applied against.

The schema/invariant audit must verify that persistence carries enough snapshot/provenance information to guarantee this historical boundary.

## 27. PAUSED Campaign

PAUSED retains LIVE edit restrictions.

Operational actions may additionally be blocked according to their frozen module contracts.

Resumption is an explicit `resumeCampaign` lifecycle command, not a generic status write.

## 28. COMPLETED / ARCHIVED Campaigns

Completed/Archived Campaign definitions are Brand-immutable for MVP.

System-owned downstream operations that are explicitly valid after completion, such as final Reporting calculations, may continue according to their own contracts.

ARCHIVED is historical/read-only from the Brand domain perspective.

## 29. Lifecycle commands

Lifecycle transitions must be represented by explicit commands such as:
- `publishCampaign`;
- `pauseCampaign`;
- `resumeCampaign`;
- `completeCampaign`;
- `archiveCampaign`.

Do not expose arbitrary `status` mutation in generic update schemas.

The backend loads authoritative persisted lifecycle state and validates transition legality. Client-supplied current status is never authoritative.

Forbidden transitions include, absent a future explicit contract:
- COMPLETED → LIVE;
- ARCHIVED → LIVE;
- COMPLETED → DRAFT;
- LIVE → DRAFT.

## 30. Two-stage edit validation

Canonical edit execution:

```text
Request
  ↓
Zod: is the command structurally valid?
  ↓
Domain service: is this edit permitted on this Campaign now?
  ↓
Prisma transaction
```

Payload validity and edit permission are deliberately separate concerns.

## 31. Frontend sharing of schemas

Appropriate canonical Zod schemas/types may later be shared with frontend form validation for UX consistency, but backend validation remains authoritative.

Server-only Intelligence schemas, internal transition commands and privileged fields must not be exposed merely because they live in the same validation package.

## 32. Deferred audit item — Application snapshots

The Campaign domain repeatedly relies on the invariant that an existing Application preserves what the Creator applied to even if Campaign/Product/Brief/commercial definitions later change.

Step 1 does not solve this by adding Zod rules.

The upcoming cross-module invariant/schema audit must verify whether `campaign_schema.prisma` v1.8 persists sufficient snapshot/provenance information to guarantee this invariant. If not, the correction belongs in the Campaign persistence/domain schema rather than Zod.

## 33. Implementation organization (non-binding)

A likely implementation organization is command/domain-oriented, for example shared primitives, Campaign, Assets, Briefs, Discovery, Outreach, Applicants, Share and Intelligence boundary schemas.

Exact filenames/directories are not frozen by this contract. Implementation should follow the production repository architecture while preserving the command and ownership boundaries above.

---

## Frozen validation statement

> **Campaign validation is command-oriented rather than Prisma-mirroring. Zod owns payload validity and simple payload-local invariants; domain services own authorization, lifecycle, cross-record/state-dependent rules and edit consequences; Prisma owns persistence integrity; the Intelligence Engine owns intelligence calculations; external validation owns externally verifiable facts. Campaign lifecycle changes are explicit commands, not arbitrary status writes. DRAFT is broadly mutable, LIVE/PAUSED are controlled mutable, and COMPLETED/ARCHIVED Campaign definitions are immutable. Accepted edits preserve historical Recommendation, Outreach, Application, Match Score and Reporting evidence rather than silently rewriting it.**

---

**Campaign Backend Finalization — Step 1: Zod / Domain Validation Contract is FROZEN.**

**Carry-forward item:** verify Application snapshot/provenance sufficiency during the cross-module invariant/schema audit before declaring the Campaign backend/domain layer complete.