# Brand Centre canonical state

Authority: `Piyush1087/dummy_tcs@a6bed1f28564c002f7d76931de0b4dd960ea5ae1`,
`backend/brand_centre_canonical_state_contract.md` (FROZEN).

Migration: `20260826140000_brand_centre_canonical_state` (48th migration).
Manual deployment after review only. No production database was used for validation.

## Additive storage

`BrandVisualState` uses the existing Brand UUID as its one-to-one aggregate identity.
`BrandVisualAsset`, `BrandVisualColor`, and `BrandVisualTypography` have independent
UUID identities, authority, origin, lifecycle, revision and timestamps. Asset roles
are LOGO, ALTERNATE_MARK and REFERENCE_IMAGE. A same-Brand composite foreign key
and active-role trigger protect the optional primary-logo pointer. Repointing it
does not delete the former asset. Editing an explicit item ID requires its exact
revision. Brand-row locking serializes canonical writes; aggregate pointer CAS
rejects competing edits.

Only explicit existing authenticated application actions establish canonical approval:
Brand Centre logo selection and identity edit. Legacy onboarding profile/logo upload
and identity-confirmation routes lack Brand ownership authorization; they remain
compatibility-only and do not call canonical approval. Internal ID-based operations are not new HTTP
permissions. No historical edit flag, scan, Preview or legacy JSON is backfilled
into approval. Existing identity edits carry no IDs, so exact unchanged palette
values/font families can be reused; changed unidentified items get new UUIDs.
Font role/order changes do not change an existing exact font's identity.

`BrandProfile.logoUrl` remains a one-way compatibility mirror when a primary logo
exists. Database guards prevent *all* legacy writers from displacing that mirror.
Without a canonical logo, legacy scan logo writes remain legacy-only. Existing
`visualIdentity` JSON is not destroyed by migration and remains a compatibility
surface. Scan updates to it do not modify canonical tables.

`Location.id` remains the canonical Location UUID. Added fields: lifecycle,
authority, observation freshness, reconciliation state, last-observed timestamp,
revision, provenance, and latest observation. Row-level BRAND_CONFIRMED or
APPLICATION_CANONICAL authority protects all canonical fields. Observation
freshness is deliberately separate from canonical lifecycle.

`BrandLocationAlias` is a same-Brand composite-FK lookup, not a replacement identity.
Alias keys are non-unique across Locations so legacy duplicates remain ambiguous.
`BrandLocationObservation` retains latest unresolved context per exact candidate
fingerprint; no unresolved observation is returned as canonical consumer truth.

Reconciliation precedence: explicit same-Brand UUID, persisted external/source
alias, exact normalized persisted postal alias, otherwise no automatic merge.
Postal aliases require address, city and postal code; normalization is trimming,
case-folding and whitespace collapsing, with a versioned SHA-256 fingerprint of
the delimiter-separated tuple (an exact matching aid, not semantic similarity).
The fixed-width key also supports long legacy addresses without B-tree key overflow.
No fuzzy/lexical threshold exists. A sufficiently identified unmatched candidate
gets a new OBSERVED Location. A stronger identity never claims a conflicting
lower-priority alias. Ambiguity preserves every existing row. Omission only changes
observation freshness to POSSIBLY_STALE; it neither deletes nor inactivates a row.

Existing Offering IDs and `locationIds` are retained. Surface scans no longer
delete/recreate the Offering catalogue or Locations. Exact unique Offering URL
matches may refresh non-user-edited observations without touching Location refs;
duplicate URL matches are not guessed. No new Offering lifecycle policy is added.

## Migration and operational safety

The SQL is transactional. It adds six tables, nine enums and Location metadata;
there are no historical migration edits, drops, deletes, deduplication, visual
approval backfills, or changes to DE/Intelligence/Preview persistence.
Existing Locations get ACTIVE lifecycle (preserving prior existence), UNKNOWN
freshness, LEGACY_UNVERIFIED authority and provenance. Existing exact postal aliases
are seeded; collisions mark reconciliation AMBIGUOUS without merging rows.
Existing IDs and Offering Location arrays are not rewritten.

Validation includes applying the 47 historical migrations, inserting two
duplicate-looking legacy Locations and an Offering reference, applying this
migration, verifying retained IDs/relations/no visual backfill, and resetting and
reapplying all 48 migrations on disposable PostgreSQL 16.

Operational rollback should disable the new consumer and revert application code
while retaining the additive tables. Do not drop approved visual state or Location
metadata after writes begin. Any destructive downgrade requires a reviewed data
export/recovery plan. New restrictive FKs intentionally prevent accidental removal
of referenced canonical state; future account-purge workflows need explicit,
ordered handling, not scan-driven cascade deletion. No purge policy is added here.
