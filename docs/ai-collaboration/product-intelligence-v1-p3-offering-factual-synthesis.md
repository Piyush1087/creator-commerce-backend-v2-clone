# Product Intelligence V1 P3 — Offering Factual Synthesis

**Status:** READY_FOR_SYSTEMS_REVIEW

**Systems gate:** Mandatory. This branch stops after P3 and does not advance to P4.

## Authority and branch reconciliation

| Authority                                      | Pin                                                       |
| ---------------------------------------------- | --------------------------------------------------------- |
| Product Authority, `Piyush1087/dummy_tcs/main` | `811d63a4f81255d9082f765b7569c8b60fcae28e`                |
| Frozen Product Intelligence contracts          | `bbb0be3345c36e9cc7c4f06ca68fb491b742b83f`                |
| Product branch before integration              | `ce46eacdc33d8d48cee96d0682d0fa30d7842a0c`                |
| Accepted DE checkpoint                         | `ff95d2f63121126a7575824a6cf10f14e1aff4a5`                |
| Product implementation branch                  | `phase-g/product-intelligence-v1`                         |
| Retained DE branch                             | `phase-g/product-intelligence-v1-de-exact-offering-scope` |

`ff95d2f…` was verified as the single clean descendant of `ce46eac…`; the Product branch had no unique commits. The local Product branch was fast-forwarded and normally pushed to the accepted DE checkpoint. No merge commit, force push, or DE branch deletion occurred.

## Implemented vertical slice

P3 registers and executes exactly `offering_factual_synthesis@1.0`, owning only `offering_factual_profile` and these six semantic families:

- `factual_summary`
- `key_facts`
- `key_benefits`
- `proof_points`
- `usage_context`
- `customer_context`

No other Product processor is executable. The existing seven Brand executors remain registered and executable.

The Product processor uses an exact `IntelligenceSubjectType.OFFERING` resolved by the accepted subject resolver. Its active scope, durable execution key, canonical state, Evidence manifest, generations, current components, candidates, and runtime projection all retain the exact Offering subject. Cross-Brand Offering selection fails closed.

## Canonical and Evidence inputs

The existing canonical reader now supports an exact same-Brand Offering read. It exposes only accepted non-price facts: identity and ownership, canonical kind/subtype/lifecycle, description and customer destination, active media references, active bundle relationships, and allowed Brand-confirmed Offering values/guidance. It computes a stable snapshot fingerprint and emits an exact `SNAPSHOT_FINGERPRINT` business-state reference. The processor never mutates canonical Offering state.

Dependency preparation passes the exact Offering selector to the accepted DE Evidence reader. Admission requires usable, non-empty, same-Offering `owned_website.offering_context` with `OFFERING_SPECIFIC` representativeness, `OFFERING_DETAIL` reconciliation, `SINGLE_OFFERING` generalization, and a matching canonical Offering ref. Null-ref, broad, sibling, unreconciled, unknown-freshness, and unavailable observations do not admit execution.

The shared Evidence manifest now retains all qualifying `capabilityExecutionRefs` at capability and Evidence-item level in addition to immutable Evidence, Resource, Capture, freshness, support, and conflict lineage. No Product-specific Evidence persistence exists.

## Execution and safety

The executable reuses the accepted shared claim, lease, heartbeat, retry, durable waiting, attempt, transactional finalization, current/candidate transition, and subject-scoped projection mechanisms. With no qualifying exact Evidence it remains `WAITING_FOR_DEPENDENCY` and the structured provider is not called.

The existing structured reasoning provider abstraction is reused. The provider receives only the exact canonical Offering and exact admitted Evidence context. A second dependency preparation after the provider call rejects canonical or Evidence basis changes before persistence.

Structural and Product semantic validation enforce:

- valid bounded partial output without filler;
- durable non-positional semantic item IDs;
- exact Evidence and business-state lineage;
- no unknown or sibling references;
- high-risk, regulated, clinical, superiority, or unsupported claims fail closed;
- proof points require direct, same-Offering first-party factual support;
- testimonials, Brand claims, credentials, and occurrences do not become external verification; and
- unsupported proof points may be omitted without rejecting an otherwise useful factual profile.

Persistence creates immutable Object/component generations and reuses shared current/candidate transitions. The Product root preserves the processor's `READY | PARTIAL | NOT_READY` result in projection metadata. Failed refreshes preserve prior current. Changed live basis and newer same-subject basis reject stale completion. Protected current values remain current and material differences become shared candidates.

## PostgreSQL proof

The P3 fixture uses real PostgreSQL and the real P2B-1 acquisition, normalization, exact Product Evidence reader, exact canonical reader, dependency preparation, subject resolution, execution creation, claim/lease/attempt/finalization, generation persistence, current/candidate transition, projection, and runtime projection. Only the external structured-model provider is faked.

It proves:

- zero Evidence waits durably and suppresses the provider;
- Offerings A and B under one Brand receive independent executions, generations, current state, candidates, and runtime state;
- A's provider context and manifest exclude B Evidence and capability executions;
- partial factual summary plus a durable key fact becomes current and projects as partial;
- exact Evidence and snapshot-fingerprint lineage are persisted;
- refresh advances current while retaining old immutable generations;
- provider failure preserves prior current;
- a provider-time Evidence change rejects stale completion without generation writes;
- a Brand-confirmed protected current produces a candidate without overwriting current; and
- cross-Brand Offering input fails closed.

Shared runtime PostgreSQL regressions additionally prove concurrent request convergence, SKIP LOCKED claims, lease expiry/reclaim, stale completion rejection, retry/attempt behavior, and generic A/B subject CAS isolation.

## Contract bundle and production artifact

The existing bundle generator/integrity verifier supports the frozen Product dialect without adding a second loader. The generated Product bundle is:

`src/features/brand-intelligence/generated/contract-bundles/offering_factual_synthesis/1.0`

It is pinned to `bbb0be3345c36e9cc7c4f06ca68fb491b742b83f`. Deterministic verification from a clean detached checkout passes. The Nest asset configuration copies the existing generated bundle tree to `dist`; all 57 source/dist bundle files matched byte-for-byte. The dist registry contained seven Brand executors and only `offering_factual_synthesis` for Product. A fresh `dist/main.js` start succeeded and `GET /health` returned HTTP 200 with database up.

## Verification summary

- Product contract/semantic/architecture/executor tests: 22 passed.
- Product PostgreSQL vertical-slice tests: 3 passed.
- Seven Brand processor PostgreSQL vertical slices: 108 passed.
- Shared execution runtime PostgreSQL: 12 passed.
- Generic subject/current projection PostgreSQL: 5 passed.
- DE non-database regressions: 108 passed.
- DE PostgreSQL regressions: 55 passed.
- Canonical Offering PostgreSQL regressions: 13 passed; one explicit historical-upgrade fixture skipped.
- Brand Centre regressions: 14 non-database and 23 database tests passed.
- Campaign regressions: 69 passed.
- Prisma validate/generate: passed; schema unchanged.
- Migration count: 51 before and after; zero migrations created.
- Production Nest build and bundle copy: passed.
- Scoped ESLint/type-check and `git diff --check`: passed.

PostgreSQL suites were run serially. Processor suites with global workers were isolated in separate disposable databases because accepted tests may intentionally leave eligible work for later assertions within their own suite.

## Explicit exclusions and residual risks

No commercial/price DE capability, capability 10, migration 52, price dependency, `offering_creator_communication`, `offering_actionability_synthesis`, Product frontend, Campaign redesign, Product Authority edit, or `dummy_tcs` edit was made.

The exact Product Evidence query retains P2B-1's bounded application-layer filtering over completed execution history because schema changes and a JSON index were not authorized. The Product processor currently has only an internal subject-scoped projection and no public Product workspace endpoint, as required for P3. A future accepted phase must decide commercial Evidence and broader Product consumer behavior; P3 does not pre-implement either.

## Gate

P3 stops here for Systems Architect review. P4 requires new explicit authorization.
