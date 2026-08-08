# Brand Intelligence Engine

**Version:** 1.0 (working implementation definition)  
**Parent:** Creator Shop Master Intelligence Schema

## Purpose

The Brand Intelligence Engine builds and maintains Creator Shop's reusable understanding of a brand. It transforms evidence from the brand's digital presence and confirmed platform data into structured intelligence used by downstream capabilities.

It is the authoritative owner of brand-level understanding. It does not own product catalogue intelligence, commercial offers, Instagram analytics, competitor benchmarking, creator intelligence, campaign execution or performance analytics.

## Business question

> Who is this brand, what does it stand for, who does it serve, and how should Creator Shop understand it?

## Branches

```text
Brand Intelligence
├── Identity
├── Brand Strategy
├── Audience
├── Communication
├── Trust & Authority
├── Market Position
└── Business Profile
```

Each branch owns its intelligence objects and can evolve independently where its evidence/dependencies permit.

## Inputs

The engine consumes normalized evidence and confirmed platform data. Typical sources include website pages, structured website metadata, social links and user-confirmed identity data.

The normal intelligence flow does not ask AI processors to reason over raw HTML. Acquisition/extraction prepares evidence first. A specific processor may use a different acquisition mode when required by the product flow; this must be explicit in that processor's implementation metadata.

## Outputs

Structured Brand Intelligence is shared across Brand Centre, Product Intelligence, Commercial Intelligence, Competitor Intelligence, Creator Intelligence, Campaign Intelligence, AI Match, Deep Intelligence, AI Assistant and reporting where relevant.

The engine primarily produces understanding. Recommendations/actions belong to the appropriate downstream capability.

## Lifecycle

The exact lifecycle is workflow-dependent rather than hard-coded as one universal Surface/Deep pipeline. The current onboarding flow includes:

```text
Website input
  ↓
Fast Identity gate/classification
  ↓
Evidence acquisition
  ↓
Identity generation
  ↓
One-time Identity confirmation
  ↓
Surface Intelligence
  ↓
User confirmation where applicable
  ↓
Deep Intelligence
  ↓
Continuous evolution / targeted refresh
```

The `Identity` branch is being frozen first and is the reference implementation for object metadata, processor metadata, artifacts, validation and backend mapping.

## Design principles

1. **Single responsibility** — understand the brand.
2. **Evidence first** — AI-derived intelligence must remain traceable to evidence.
3. **User authority** — confirmed/manual values follow object-specific lifecycle and protection rules.
4. **Independent evolution** — refresh only affected intelligence where practical.
5. **Shared intelligence** — downstream features consume canonical intelligence rather than regenerate it.
6. **Explainability** — retain evidence/execution lineage for AI-derived intelligence.
7. **Separation of acquisition, understanding and execution** — evidence acquisition collects/prepares signals; Brand Intelligence interprets them; downstream systems plan or act.

## Implementation model

The engine is implemented through reusable processors, execution profiles and artifacts compiled at runtime by the Intelligence Compiler. Prompt packages from the earlier architecture are not the canonical implementation boundary; their useful responsibilities are decomposed into reusable artifacts, context construction, output contracts and runtime configuration.

Processor boundaries should reflect real independent execution needs. The platform should not create a processor or document merely because a conceptual branch/object exists.

## Current Identity decisions

The following are already authoritative for the ongoing Identity implementation:

- the initial industry/sub-industry gate remains a direct Gemini website call for MVP latency/reliability reasons, but is represented as an Identity processor inside the intelligence system;
- normal website acquisition can use Zyte + deterministic cleaning/extraction to prepare evidence for subsequent Identity reasoning;
- `website_currency` is brand/website intelligence used for record/product-price context;
- platform reporting/transaction currency is a separate derived value restricted to `INR` and `USD`: India → INR; US and Rest of World → USD;
- onboarding includes a one-time Identity checkpoint before Surface Intelligence. The user may correct `brand_name`, social handles, `industry`, `sub_industry`, `country` and `website_currency`; after confirmation these become permanently locked in normal product flows.

Detailed Identity objects and processors will be frozen in the branch implementation rather than duplicated here.
