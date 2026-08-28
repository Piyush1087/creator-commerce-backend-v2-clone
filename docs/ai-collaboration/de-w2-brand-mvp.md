# DE-W2 Brand Workspace Evidence MVP

The Systems Architect approved DE_W2_SEVEN_CONSTRAINT_MIGRATION_APPROVED.
The single additive migration 20260826180000_data_extraction_wave2_supported_capabilities
expands only the seven historical capability-ID checks to the explicit nine-ID
allow-list. Historical migrations and prisma/schema.prisma remain unchanged.

Backend baseline: development@892d86efb414aeb34674b86df53cb35bf56cb261.
Authority reviewed: Piyush1087/dummy_tcs@a6bed1f28564c002f7d76931de0b4dd960ea5ae1.

This implements the approved DE-W2 assignment, not a revision of the frozen DE
platform. Canonical sources are the normalized Evidence envelope, DE Wave-1
capability/runtime persistence contracts, and the frozen differentiation, visual
style and serviceability Evidence contracts. The latest canonical visual/Location
state contract supplies the observation-versus-application-state boundary.
The assignment's CURRENT/POSSIBLY_STALE/UNKNOWN vocabulary and the shared DE
envelope take precedence over older consumer YAML examples of STALE.

## Capability contracts

Exactly four additive IDs are accepted by acquisition, DE queries and the existing
Intelligence Evidence reader. Payloads are runtime-validated by the DE-owned
schemas in normalization/wave2/wave2-evidence-contracts.ts; the shared envelope
and all five Wave-1 IDs are unchanged.

| Capability | Bounded payload and meaning |
| --- | --- |
| explicit_factual_proof_or_claim_evidence | Statement, canonical proof_strength, explicit scope, authorship, source locator, claim sensitivity, and the assignment's proof_class distinction. All items remain NOT_EXTERNALLY_VERIFIED. VERIFIED_BUSINESS_FACT is never emitted from acquired copy. |
| owned_website.visual_evidence | Matched DOM style declarations (colour, typography, layout), logo/mark or image-presence observations, selectors/locators and limitations. Never computed style, rendered appearance, approved palette/font/logo, imagery analysis or hard visual constraints. |
| owned_website.serviceability_evidence | Explicit availability/shipping/service-area/remote/booking statements, supported versus excluded geography assertions, modality and subject scope. Unknown geography remains absent; raw statements remain available. |
| owned_website.location_evidence | Separate address/structured business-location observations, optional explicit name/address/city/region/postal/country/coordinates/contact/source identifier, and capture-local source locator. No generated canonical Location ID or fuzzy reconciliation. |

The proof_class values requested in the assignment supplement, rather than
replace, frozen proof_strength. Marketing remains GENERIC_MARKETING_ASSERTION;
testimonials remain TESTIMONIAL_OR_SOCIAL_PROOF; sensitive efficacy, accuracy,
superiority, safety, success-rate and guaranteed-outcome statements remain
FIRST_PARTY_CLAIM. Credential occurrence is not credential verification.
Offering-specific units and product/service-detail URLs remain Offering-scoped.
No Offering IDs are invented.

## Acquisition and normalization

The existing owned-site acquisition service and direct/Zyte mechanics remain the
only acquisition path. A Wave-2 request first examines up to 30 retained same-Brand,
same-site resources. A retained root plus relevant material is reused with at most
four selected resources. Otherwise the existing root-first plan selects at most
three relevant secondary pages, including credentials, shipping/coverage/policy,
contact/location surfaces where appropriate. This is a coverage hint, not semantic
completion. There is no public search, social, competitor, Similarweb or new browser
provider.

New captures additionally retain a provider-neutral STRUCTURED_SOURCE_FRAGMENT
using the existing ContentArtifact model. It extracts at most 250,000 source
characters, 80 bounded statement units, 32 visual descriptors and 24 location
observations. Statement/property values are at most 600 characters. This allows
descriptors beyond the existing 60,000-character retained HTML boundary to survive
with the same capture/provider lineage. Full provider payloads are not retained.
Older compatible retained HTML can be normalized without recapture.

Visual observations inspect matched ordinary top-level rules and inline styles.
Conditional/pseudo-state/unmatched rules, hidden elements and external stylesheets
are not treated as computed visual usage. External stylesheet/non-rendered
limitations are explicit. Visual output is PARTIAL when usable, UNAVAILABLE when
no usable visual observation exists. No separate imagery or graphic-treatment
capability is needed or enabled.

Location inputs include bounded JSON-LD business/PostalAddress records and visible
address blocks; arbitrary JSON/product delivery destinations are excluded.
Duplicate-looking entries retain distinct capture-local locators and Evidence
identities. Source IDs are observations, not application IDs. An internal caller may
supply an exact capture/locator-to-canonical-Location mapping; the normalizer checks
the Location's Brand ownership before carrying the reference. It does not resolve,
create, update or delete Locations. Absence emits no closure/removal event.

All normalizers are deterministic observations, not Intelligence synthesis.
Independent contradictory proof/serviceability items remain persisted; bounded
contradiction detection adds symmetric conflict relations, never a winner. This is
not an exhaustive semantic contradiction classifier. Cross-resource repetition
groups support without collapsing evidence history or Offering scope.

## Lifecycle and persistence

Acquisition and normalization reuse the original CapabilityExecution. Semantic
completion attaches immutable Evidence and support/conflict records transactionally.
Existing terminal acquisition failures remain durable UNAVAILABLE as in Wave 1.
The read adapter never acquires or normalizes; pending executions remain invisible
and NOT_REQUESTED has a null capabilityExecutionRef. Successful proof/serviceability/
location inspection may persist AVAILABLE + [] without implying negative evidence.

Re-normalizing an already-emitted item reuses its immutable historical snapshot;
new execution membership and aggregate support do not rewrite that item. Resource,
capture, content, Evidence, execution and provider refs remain distinct. Freshness
and quality remain independent; no TTL or global status vocabulary is added.

No Prisma model/field, repository interface, package, provider framework, frontend,
Preview or canonical state writes are added. The only BI code change is the reader's
additive capability allow-list. Executable real processors remain exactly
brand_communication, brand_meaning, brand_character, audience_persona_synthesis.

## Verification

No external provider credentials or production database are required.

From the backend root, with the existing local disposable PostgreSQL container:

    npm run prisma:generate
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-de-wave2.ps1 -FullSuite
    npm run build

The script creates an isolated randomly named role/database, applies the 48
historical migrations, populates Wave-1 rows, upgrades to migration 49 and proves
the rows and composite foreign keys unchanged. It resets/reapplies all 49,
rechecks acceptance/rejection, enables all DE/BI/Brand Centre/Gatekeeper database
test gates, and runs the full suite serially. It cleans up only its exact created
database/role and restores process environment variables. Without -FullSuite it
runs just Wave-2 tests. DE_W2_DATABASE_URL is a test-only gate, not production
configuration. Scoped ESLint and git diff --check are separate required checks.

The dedicated verification configuration clears fixture rows before each database
test file, retaining the migrations and constraints. Existing BI test files leave
globally claimable queued executions; file isolation prevents a later test's worker
from claiming another processor's fixture. It does not clear rows between tests
within a file or change production worker/repository behavior. The isolation helper
fails closed unless URL, role and actual database all match the locally-created
disposable target. Immutable freshness-at-emission remains the adapter contract;
the stale-capture test assesses the capture before normalization, not by rewriting
an already-emitted item's freshness snapshot.

## Verification record — 2026-08-26

The complete isolated run passed 98 test files: 697 tests passed, with only the
populated-upgrade assertion skipped in the reset phase (it passed in the separate
20-test 48-to-49 upgrade phase). A final-file migration/Wave-2 rerun passed all 20
upgrade tests and 70 reset-phase tests, with the same one intentional skip.

DE A–F regressions: 98 tests passed. The four existing real BI PostgreSQL suites
passed 6 Communication, 12 Meaning, 21 Character and 23 Audience tests. Wave-2
passed 36 semantic, 12 durable PostgreSQL and 3 boundary tests. Preview passed
35 tests; canonical state passed 15 PostgreSQL and 16 existing service tests;
Brand Centre consumer/deep-scan boundaries passed 12 tests. The shared Evidence
input/manifest suite passed all 14 tests.

Prisma generate/validate, Nest build, scoped ESLint and staged/unstaged diff checks
passed. A supplementary TypeScript diagnostic scan found no errors in the 24
changed TypeScript files; 57 unrelated diagnostics elsewhere remain outside this
bounded change and are not a full-project type-check pass. No production database
or live acquisition provider was used. Disposable fixtures, roles and databases
were removed by the verification harness.
