# Product Intelligence V1 — P5 Consumer Runtime Contract

P5 adds one read-only backend consumer for one authenticated Brand-owned canonical Offering. It does not run extraction, start Intelligence, call a model provider, reconcile price, or mutate Product state.

## Endpoint and identity

`GET /api/v1/brand-centre/offerings/:offeringId/intelligence`

The request requires the existing Brand JWT. Brand identity is resolved from the authenticated organization; `brandId` is not accepted from the route, query, or body. `offeringId` must be a UUID and must identify an Offering owned by that Brand. A missing and a foreign Offering both return the existing not-found response so ownership cannot be discovered across Brands.

The consumer also exists as `ProductConsumerService.read(authUser, offeringId)` for internal backend composition.

## Response contract

`ProductConsumerResponseSchema` is the executable strict Zod boundary. Arbitrary Prisma records and unknown response keys are rejected.

```text
offering
  id, kind, subtype
  lifecycle: RESOLVED(value) | UNRESOLVED
  name, description, customerDestination
  primaryMedia
  canonicalPrice: CURRENT(tuple) | UNAVAILABLE
  offerRefs[], locationRefs[]

intelligence
  factualProfile
  creatorCommunicationProfile
  actionabilityProfile

processorRuntime
  offering_factual_synthesis
  offering_creator_communication
  offering_actionability_synthesis
```

Each Intelligence Object independently exposes its current value state, `READY | PARTIAL | NOT_READY` readiness, `CURRENT | STALE | UNKNOWN` freshness, bounded authority presentation, pending-candidate summary, contract identity, current component revisions, generation timestamps, and mixed-generation/version flags. Raw candidates, prompts, model/provider internals, Evidence payloads, and Evidence lineage are not returned.

Each processor runtime entry independently exposes Object readiness/freshness, execution activity, dependency readiness, latest execution status/reason, `hasCurrent`, refreshing, bounded failure information, candidate summary, and current lineage. Execution failure never creates a `FAILED` Object readiness.

## Progressive and mixed states

- No current Objects: all three Objects are `NOT_READY`; all runtime entries are independently `IDLE` with `hasCurrent: false`.
- Factual current only: factual may be `READY` while creator and actionability remain `NOT_READY`.
- Dependency wait: creator may be `WAITING_FOR_DEPENDENCY` while factual is `READY` and actionability is `PARTIAL`.
- Stale/current mix: factual may remain visible with `STALE` freshness while creator is `READY` and actionability is `NOT_READY`.
- Failed refresh: prior current stays visible while that processor independently reports `TEMPORARILY_UNAVAILABLE` and a bounded failure.
- Refresh: one processor may report `REFRESHING` while the other two remain idle/current.
- Candidate: current stays primary; candidate metadata reports the pending conflict without returning candidate content.

There is no whole-Offering loading/readiness collapse.

## Canonical commercial boundary

Only `OfferingPriceState.currentRevision` is exposed as canonical price. Current amounts remain decimal strings with mode, currency, canonical freshness, authority, revision ID, and evaluation time. If no canonical revision exists, the response is `canonicalPrice: { state: "UNAVAILABLE" }` even when `owned_website.offering_commercial_evidence` contains observations. P5 performs no Evidence-to-price reconciliation and never reads legacy `priceAmount` or `startingPriceLabel` as canonical truth.

Offer and Location arrays contain only exact active canonical applicability/relation IDs. Location or serviceability Evidence cannot create these references.

## Frontend constraints

Future frontend work must not infer that all Objects advance together, treat execution failure as failed readiness, hide preserved current during refresh/failure, display candidate content, convert commercial Evidence into price, infer Offer/Location availability, or initiate refresh from this GET. Refresh remains a separate explicit command path outside P5.
