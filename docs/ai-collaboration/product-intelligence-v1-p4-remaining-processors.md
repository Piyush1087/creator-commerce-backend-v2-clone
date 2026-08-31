# Product Intelligence V1 — P4 Remaining Processors

P4 implements the two remaining frozen exact-Offering processors and stops at the mandatory Systems gate.

## Executable topology

- Product: `offering_factual_synthesis`, `offering_creator_communication`, `offering_actionability_synthesis`.
- Brand: the accepted seven processors remain unchanged in the Brand consumer topology.
- Shared registry: ten executable semantic processors total. Infrastructure jobs are excluded.

## Creator communication

`offering_creator_communication@1.0` reads the consumer-safe current `offering_factual_profile` for the same Intelligence `OFFERING` subject through the current projection service. Its immutable dependency snapshot includes a fingerprinted `IntelligenceCurrentObject` business-state reference. If no safe current factual Object exists, execution waits without calling the provider. The processor emits only grounded reusable talking-point ingredients and explicit constraints; semantic validation rejects provider-local identity, final campaign copy, descriptive-pattern escalation, and unsupported sensitive claims.

## Actionability

`offering_actionability_synthesis@1.0` consumes canonical lifecycle, customer destination, the current canonical price revision, exact canonical Offer applicability, and exact `OFFERING_AVAILABLE_AT_LOCATION` relations. Legacy `priceAmount`, `startingPriceLabel`, and `locationIds` are not admitted as canonical processor truth. Optional exact-scoped serviceability/location Evidence can enrich interpretation but cannot create canonical availability or geography. A destination-backed customer action remains valid when price is absent, with `commercial_context` null and Object readiness `PARTIAL`.

## Runtime and persistence

Both processors reuse the accepted execution, dependency waiting, lease/heartbeat, attempt/retry, manifest, structured-provider, validation, immutable generation, current/candidate, CAS, stale-basis, projection, and processor-runtime services. The accepted Product persistence hook is configuration-bounded across the three frozen Product Objects; no Product-specific persistence or runtime fork was added.

## Verification

- Frozen source and built contract-bundle registries contain ten executable bundles and are byte-identical.
- Product PostgreSQL vertical slice: five scenarios passed on a disposable PostgreSQL 16 database, including exact factual dependency reuse, A/B isolation, protected-current candidate retention for both new processors, failure preservation, canonical price/Offer/Location consumption, no-price partial output, and stale completion rejection.
- All 93 non-PostgreSQL source suites passed (640 tests).
- All seven Brand processor PostgreSQL suites passed in isolated databases. The first parallel harness attempt was stopped after host saturation caused test-only timeout failures; sequential reruns used increased Vitest timeouts only and passed without runtime changes.
- DE W1/W2/exact-Offering PostgreSQL regressions passed (74 tests, one intentional skip).
- Canonical Offering/deep-scan and Brand consumer PostgreSQL regressions passed. Campaign regressions are included in the 640-test non-PostgreSQL run.
- Prisma generate/validate, production build, scoped ESLint, contract verification, `git diff --check`, source/dist bundle verification, and fresh built-app `/health` (`200`, database up) passed.

No migration, commercial DE capability, frontend change, public Product consumer, or P5 work is included.
