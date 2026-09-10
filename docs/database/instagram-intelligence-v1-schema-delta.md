# Instagram Intelligence V1 — A2 schema delta draft

```text
STATUS = CONTRACT_DRAFT_ONLY
MIGRATION = NOT_CREATED
PRISMA_SCHEMA = NOT_CHANGED
RUNTIME_PIPELINE = NOT_IMPLEMENTED
```

This document records the smallest expected additive persistence seam so B1,
C1, C3, C4, D1 and F1 can review one coherent model before any migration is
created. It is not migration authority and does not reserve final column names.

## Existing models reused

- Data Extraction Resource, Capture, ContentArtifact, CapabilityExecution,
  Capability Evidence, EvidenceItem, SemanticObservation, relations,
  freshness and provider-execution links.
- Shared Intelligence ObjectGeneration, ComponentGeneration, Evidence/business
  references and current-component projection for the three Instagram-specific
  Objects.
- Existing Settings integration/account/authorization/deletion state.

## Additive DE vocabulary

- source class: `INSTAGRAM_OWNED`;
- resource types: `INSTAGRAM_ACCOUNT`, `INSTAGRAM_MEDIA`;
- capabilities: the nine `instagram.*` IDs in the additive
  `INSTAGRAM_DE_CONTRACT` registry;
- stable resource identity excludes handle, token, ephemeral media URL and
  authorization generation;
- authorization generation belongs on capture/execution fencing and request
  identity.

A2 intentionally leaves the shared runnable DE vocabulary website-only so it
does not claim Prisma can persist enum values that have not been migrated. B1
must atomically add the Prisma enum values and widen the shared DE runtime union
and adapters under migration review; it must derive those values from
`INSTAGRAM_DE_CONTRACT` without renaming them.

No raw Instagram image, video, frame, signed URL or token receives a durable
column. Carousel children remain ordered artifacts/evidence below one media
resource.

## New persisted concepts expected later

1. A versioned per-media observation record keyed by Brand/account/media,
   capture/profile version and source scope. It stores normalized semantic
   states, evidence references, inspection depth and deterministic selection
   reasons; it is not an Intelligence Object or canonical Creator/
   Collaboration record.
2. A bounded sync coordinator record keyed by Brand profile, integration,
   provider account, authorization generation and capability class. It stores
   due/success/attempt state, cursor, lease, retry/backoff and completed
   generation references; it does not duplicate Settings authorization truth.
3. Generation-only source metadata for hidden Brand semantics using exact
   `source_scope=INSTAGRAM_OWNED`. D1 must prove that no current, candidate or
   transition row is written and that latest-successful-by-source remains
   bounded before any index is proposed.

## Three Instagram Objects

Exactly these use the existing shared Object/current/history machinery:

- `instagram_content_behavior`;
- `instagram_audience_profile`;
- `instagram_organic_performance_profile`.

No fourth account-facts Object, source-as-subject model, source-scoped candidate
table or parallel Intelligence runtime is permitted.

## Delete and isolation requirements for migration review

- every new record is Brand- and provider-account-scoped;
- authorization generation fences writes after reconnect/account change;
- Settings-owned Delete Instagram Data can remove sync, DE, observations,
  three-Object state, hidden Instagram-owned Brand generations and caches;
- a fenced worker cannot resurrect deleted data;
- website-derived Brand Intelligence and canonical Offering, Campaign, Creator
  and Collaboration state remain unchanged.

The concrete Prisma delta and migration are B1/C1 work and require the normal
schema/migration review. A2 executes neither.
