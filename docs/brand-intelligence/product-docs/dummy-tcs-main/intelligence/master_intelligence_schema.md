# Creator Shop Master Intelligence Schema

**Version:** 1.0 (working)

## Purpose

This is the business-domain map for the Creator Shop Intelligence Platform. It is not a database schema, API contract, evidence schema or AI prompt design.

Every node represents a reusable business intelligence domain. Evidence is intentionally excluded from this map.

## Intelligence engines

```text
Creator Shop Intelligence Platform
├── Brand Intelligence
├── Product Intelligence
├── Commercial Intelligence
├── Instagram Intelligence
├── Competitor Intelligence
├── Creator Intelligence
├── Campaign Intelligence
└── Performance Intelligence
```

### 1. Brand Intelligence
**Business question:** Who is this business?

Branches:
- Identity
- Brand Strategy
- Audience
- Communication
- Trust & Authority
- Market Position
- Business Profile

### 2. Product Intelligence
**Business question:** What exactly does the business sell?

Domains include portfolio, product identity, positioning, features and benefits, customer problems, differentiation, lifecycle and product relationships.

### 3. Commercial Intelligence
**Business question:** How does the business make money?

Domains include pricing, offers, promotions, packaging, revenue strategy, purchase journey and commercial policies.

### 4. Instagram Intelligence
**Business question:** How does the brand behave on Instagram?

Domains include profile, content strategy, audience, community, creator collaborations, growth and performance.

Instagram remains platform-specific for the current product. Future social platforms should enrich existing domains or justify a new engine based on actual platform strategy.

### 5. Competitor Intelligence
**Business question:** How does the market compare?

Domains include competitor universe, positioning, products, commercial, communication, Instagram, creator strategy and competitive insights.

### 6. Creator Intelligence
**Business question:** Who are the creators and what makes them valuable?

Domains include identity, audience, content, brand affinity, commercial, performance, professionalism and trust.

### 7. Campaign Intelligence
**Business question:** How should this brand execute influencer marketing?

Campaign Intelligence primarily synthesizes intelligence from other engines into campaign strategy. Domains include objectives, audience strategy, creator strategy, content strategy, commercial strategy, deliverables, learnings and recommendations.

### 8. Performance Intelligence
**Business question:** What happened after execution?

Domains include business, campaign, creator, content, commercial, audience-growth and platform performance. Performance Intelligence closes the learning loop and can drive future intelligence refresh/evolution.

## High-level dependency model

```text
Evidence
  ↓
Brand / Product / Commercial / Instagram / Competitor / Creator Intelligence
  ↓
Campaign Intelligence
  ↓
Performance Intelligence
  ↓
Refresh & Evolution
```

## Design principles

1. **Single responsibility** — each engine answers one primary business question.
2. **Independent evolution** — intelligence refreshes only when its own evidence or dependencies require it.
3. **Shared consumption** — generate intelligence once and reuse it.
4. **Evidence traceability** — AI-derived intelligence must be explainable through supporting evidence.
5. **Extensibility** — new evidence sources should enrich existing domains before new top-level engines are introduced.
6. **Separation of understanding and execution** — foundational engines understand the business; downstream engines plan, evaluate or act on that understanding.

## Current implementation focus

Brand Intelligence is the first engine being implemented end-to-end. Its `Identity` branch is the reference vertical slice used to validate the platform architecture before replicating the pattern elsewhere.
