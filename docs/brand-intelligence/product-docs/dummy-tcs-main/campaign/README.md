# Creator Shop Campaign Module — Canonical Entry Point

Status: CANONICAL / FROZEN THROUGH STEP 5C
Version: 1.1

This directory contains the product/domain specifications for the Creator Shop Campaign module. This README is the navigation and authority entry point for developers and Codex.

## Scope

The Campaign module owns the campaign aggregate and the workflows around campaign definition, lifecycle, products, briefs, discovery, outreach, applicants, sharing, Campaign-facing reporting setup/projections, and the Campaign-side boundary to future Collaboration.

Collaboration itself is an independent module and is not designed or owned here. Campaign stops at the approved Application/Snapshot context that a future Collaboration module may consume; Campaign must not create a duplicate Collaboration aggregate, Collaboration workflow, or placeholder Campaign-owned Collaboration persistence.

Reporting intelligence, Marketplace section score, AI Match score, recommendation generation, and calculation logic remain Intelligence-owned. Campaign owns the application-facing persistence, accepted/resolved values, lifecycle, human actions, and the contracts/trigger points through which Intelligence is invoked or consumed.

## Canonical authority order

When artifacts overlap, use this order:

1. `backend/campaign_schema.prisma` — persisted Campaign-domain truth (current working view: v1.9).
2. `backend/validation/**/*.schema.ts` — executable boundary/input validation.
3. `campaign/backend/implementation_map.md` — service ownership, lifecycle/orchestration, transaction/concurrency and integration boundaries.
4. Focused contracts inside `campaign/**` — detailed product/domain behavior for each Campaign surface.
5. `*_schema_reconciliation.*` and other reconciliation artifacts — historical design/reconciliation evidence only; they are not current implementation authority.

If a lower-authority artifact conflicts with a higher-authority artifact, do not silently implement the lower-authority version. Treat the conflict as a reconciliation issue and resolve it against the frozen product decision before changing canonical implementation files.

## Canonical implementation

### Persistence

- `backend/campaign_schema.prisma`

Campaign persistence is intentionally separate from `backend/intelligence_schema.prisma`.

### Validation

- `backend/validation/shared/`
- `backend/validation/campaign/`
- `backend/validation/assets-briefs/`
- `backend/validation/discovery/`
- `backend/validation/outreach/`
- `backend/validation/applicants/`
- `backend/validation/share/`
- `backend/validation/intelligence/`
- `backend/validation/index.ts`

### Backend orchestration

- `campaign/backend/implementation_map.md`

The implementation map is the canonical authority for service ownership, lifecycle, transaction boundaries, concurrency, request replay, asynchronous consequences and provider/integration boundaries that are not field-level Prisma/Zod concerns.

### Canonical reference data

- `campaign/canonical/audience_affinities.yaml`
- `campaign/canonical/creator_archetypes.yaml`
- `campaign/canonical/kpi_framework.yaml`

These files are canonical taxonomies/reference data and are not reconciliation artifacts.

## Campaign aggregate principles

- Evolve the existing `UceCampaign` aggregate; do not create a parallel Campaign aggregate.
- Campaign creation source is persisted (`MANUAL` or `AI_RECOMMENDED`).
- Brand industry is inherited Brand context, not a Campaign-owned Create Campaign input.
- Campaign commercial currency is derived from Brand Centre country, restricted to INR/USD under the frozen Campaign policy, and is distinct from website/product price currency.
- Campaign audience geography uses the shared structured geography semantics defined by the Intelligence geography contract, while Campaign remains the semantic owner of campaign audience targeting.
- Deliverables belong to Brief, not Campaign.
- Campaign may contain multiple products; each product may have multiple briefs.
- Accepted/resolved Campaign values are Campaign-owned even when Intelligence recommends them.
- Intelligence lineage may be retained on Campaign records without making Intelligence the canonical Campaign value store.
- `UceCampaignCreator` is the normalized Campaign-level creator identity across Discovery, Outreach and Applicants.
- Campaign Page/workspaces are views and commands over canonical entities, not new persistence aggregates.

## Frozen lifecycle and runtime authority

Canonical Campaign lifecycle:

`DRAFT -> PUBLISHED -> LIVE <-> PAUSED -> COMPLETED -> ARCHIVED`

`PUBLISHED` and `LIVE` are distinct states. Backend services enforce legal transitions and execution readiness; frontend/UI state is never the authority boundary.

For Outreach quotas/channel resolution, Application limits/concurrency, request replay semantics, Share/tracking behavior, Reporting acceptance, Intelligence async boundaries and required transaction scopes, use `campaign/backend/implementation_map.md`. Do not infer these runtime rules from UI copy or historical reconciliation artifacts.

## Domain specifications

Focused contracts under the following directories remain valid detailed specifications and should be consulted for the relevant surface:

- `campaign/create_campaign/`
- `campaign/campaign_page/`
- `campaign/add_product/`
- `campaign/add_brief/`
- other focused Campaign workflow directories present in this repository, including Discovery, Outreach, Applicants, Share, Reporting and related Campaign surfaces.

These contracts explain product semantics that cannot be inferred from Prisma alone. They do not override the canonical persistence, executable validation, or implementation-map layers.

## Intelligence boundary

Intelligence owns generated intelligence and recommendation/report computation. Campaign should define:

- what Campaign/Brand/Application context is sent to Intelligence;
- the trigger/event that requires computation;
- the response contract Campaign expects back;
- context/version/lineage identifiers needed for traceability and stale-result protection;
- which returned recommendation/result is accepted/resolved into canonical Campaign-facing state.

Campaign must not duplicate Intelligence processor telemetry, execution/retry/failure history, reusable intelligence stores, or computation artifacts merely to make Campaign persistence self-contained.

Required asynchronous Intelligence work must ultimately have durable Intelligence-owned execution evidence. The current Intelligence schema does not yet fully implement a generic runtime persistence layer; that gap must not be solved with Campaign-owned job tables.

## Collaboration boundary

Application `APPROVED` is the Campaign-side handoff point.

Campaign preserves/exposes the approved Application and immutable submission-time Snapshot context needed by a future Collaboration module. Collaboration lifecycle, deliverable execution, product dispatch, content approval, creator payment, posting completion, and any Collaboration-specific snapshot/contract are outside the Campaign module and must not be invented here before Collaboration is designed.

Campaign Page may eventually render references to independently owned Collaboration entities, but that does not make Campaign the Collaboration owner.

## Reconciliation artifacts

Files named like `*_schema_reconciliation.*` document how the current schema was reached. They are retained for traceability/version history but are classified as **SUPERSEDED FOR IMPLEMENTATION** once their decisions are represented in the canonical Prisma/Zod/implementation-map layers.

Do not use a reconciliation file as the primary source when implementing new Campaign code.

## Change discipline

The repository is versioned. Canonical files may therefore be updated directly when a frozen decision changes, but overwrites must be deliberate:

1. read the current canonical file first;
2. preserve unrelated frozen decisions;
3. update all affected canonical layers when a change crosses persistence, validation, or orchestration boundaries;
4. avoid introducing a second store/model for a concept already owned canonically elsewhere;
5. use Git history to recover previous versions rather than creating duplicate backup files in the canonical tree.

## Step 5C freeze note

The Campaign backend package is frozen through Step 5C at the architecture/contract level represented by the canonical authority stack above. Historical reconciliation artifacts are intentionally retained rather than deleted; they are traceability evidence, not implementation authority.

A future implementation step may translate these frozen semantics into the production repository architecture. That integration must reconcile with the production schema/codebase rather than mechanically copying this dummy/reference repository.