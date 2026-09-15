# Creator Rate Card V0 migration review

Migration `20260915210000_creator_rate_card_canonical_revision` is the independent additive slice after Work Preferences (migration 103). It creates only `creator_rate_cards` and its append-only, actor-attributed revisions. Canonical fields are relational: six independently enabled positive safe-integer minor-unit prices, optional usage availability/days and exact payment preferences. No rate JSON is hidden in Work Preferences or Intelligence current.

Rate Card binding stores non-secret country-authority source/reference/version/legal version/country/currency/fingerprint. KYC has no producer. Currency uses the accepted platform resolver, never FX. The application validates the deterministic fingerprint and strict revision snapshots before projecting monetary values. On a current-authority mismatch, GET hides all six monetary values without a write; independent rights/payment preferences remain available.

Authorized writes serialize Team identity and the existing payout destination fence. Revision CAS, Work Preferences revision, authority fingerprint and actor-bound idempotency are checked before mutation. A Work Preferences mutation uses a narrowly scoped same-transaction bridge to reconcile an existing Rate Card. Unconfirmed manual cross-currency changes reject both writes; confirmed changes clear all money, preserve independent terms and create a separate immutable audit revision. Same-currency rebinding preserves money. Settings bank changes remain Settings-owned; a Rate Card reconciliation write first preserves same-currency money or clears cross-currency money before any subsequent new-price entry.

Database constraints enforce tenant ownership, monetary consistency/bounds, exact vocabularies, monotonic initial/gap-free revisions and deferred canonical/current-audit snapshot consistency. Audit updates/direct deletes fail; only the corresponding parent-owned target purge may cascade into its own audit history. External ownership backreferences use RESTRICT. No provider operation runs inside the transaction; no Settings/C06/C04 state or accepted migration is changed.

Clean PostgreSQL 17 deployment applies all 104 migrations. Populated 103→104 compares every one of the 197 predecessor public-table counts and sorted-row digests, including accepted Work Preferences; all are identical and new Rate Card tables are empty. The preceding populated 102→103 proof preserves all 195 original tables, establishing the full ordered additive upgrade chain.

No production migration/rollback/deployment is authorized. Preserve additive migration history; never drop external data, rewrite applied files or reuse developer databases for acceptance.

LF-normalized migration SHA-256: `e14e9bfcb8c61b521da74a484794a91877ca04d42d72beb87a4ab0e81dd7d0cf`.
