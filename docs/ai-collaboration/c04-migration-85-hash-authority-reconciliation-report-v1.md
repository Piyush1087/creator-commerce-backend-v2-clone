# C04 Migration 85 Hash Authority Reconciliation Report V1

`C04_MIGRATION_85_HASH_AUTHORITY_RECONCILIATION_REPORT_V1`

## Result

```text
RESULT = PASS
CLASSIFICATION = HANDOFF_HASH_METADATA_ERROR
```

## Immutable source

- accepted C04 commit:
  `ec395bf5760b295dddd9c3f7e9c2f05485b6b743`
- accepted C04 tree:
  `69381dd46e05ce3cf9823ccd6754e6b303dbaa2d`
- migration:
  `20260911125000_c04_brand_payouts_reserve_entitlement_lineage`
- Git blob SHA-1:
  `686259750247e0ae0a27ec8f569a285dec1945ce`
- raw Git-blob byte length: `17561`
- Git-canonical raw-byte SHA-256:
  `6e384abdaf7cf9fa35973ca31e1a5cb541f60bd328937ff3d27844b9dfdb4d72`

The blob identity is unchanged at the implementation commit
`5a4f70075da13f9e49bdc501097fe0f571c3f405`, initial handoff commit
`11a3a456333d6b678d850fd3d3affd08e0909499`, and accepted C04 commit
`ec395bf5760b295dddd9c3f7e9c2f05485b6b743`.

## Verification

The file was fetched as the exact base64-encoded Git contents object at the
accepted commit and decoded without working-tree checkout. SHA-256 of those raw
bytes is:

```text
6e384abdaf7cf9fa35973ca31e1a5cb541f60bd328937ff3d27844b9dfdb4d72
```

Converting the same LF blob to Windows CRLF produces:

```text
f2ce5e49be5e377330867beb2fdde48334b6343122ad8b298ae14feb743a1ee1
```

This independently reproduces the downstream report and proves the downstream
hash method is correct.

## Previous hash origin

The previously reported value:

```text
aa5c1900d06a1c240413be547f8ebe23b933085f93c766b51fdd2933bf91da0f
```

does not identify the migration Git blob at any of the three durable C04
commits. It also does not match the canonical LF blob, CRLF checkout
representation, UTF-8 BOM variants, UTF-16LE variants, final-newline removal,
or header/comment removal.

No durable repository object or committed evidence copy exists from which
`aa5c…` can be reproduced. Its exact durable origin is therefore:

```text
UNTRACEABLE_TRANSIENT_PRE_COMMIT_OR_TEMP_REPRESENTATION
NOT_A_GIT_OBJECT_AUTHORITY
```

The implementation runner recorded that transient/stale value in the handoff,
decision register and proof summary without recomputing it from the final Git
object. This is a handoff metadata error, not a migration-content conflict.

## Correction

The handoff, decision register and proof summary now use:

```text
MIGRATION_85_GIT_CANONICAL_SHA256 =
6e384abdaf7cf9fa35973ca31e1a5cb541f60bd328937ff3d27844b9dfdb4d72

SUPERSEDED_REPORTED_SHA256 =
aa5c1900d06a1c240413be547f8ebe23b933085f93c766b51fdd2933bf91da0f

MIGRATION_SOURCE_BYTES_CHANGED =
NO
```

C04 runtime, migration identity, migration count, implementation evidence and
PostgreSQL proof results remain unchanged.

## Terminal return

```text
C04_MIGRATION_85_HASH_AUTHORITY_RECONCILIATION_REPORT_V1

RESULT =
PASS

C04_FINAL_BACKEND_SHA =
ec395bf5760b295dddd9c3f7e9c2f05485b6b743

MIGRATION_85_ID =
20260911125000_c04_brand_payouts_reserve_entitlement_lineage

GIT_CANONICAL_SHA256 =
6e384abdaf7cf9fa35973ca31e1a5cb541f60bd328937ff3d27844b9dfdb4d72

PREVIOUS_REPORTED_SHA256 =
aa5c1900d06a1c240413be547f8ebe23b933085f93c766b51fdd2933bf91da0f

PREVIOUS_HASH_ORIGIN =
UNTRACEABLE_TRANSIENT_PRE_COMMIT_OR_TEMP_REPRESENTATION_NOT_A_GIT_OBJECT_AUTHORITY

CLASSIFICATION =
HANDOFF_HASH_METADATA_ERROR

MIGRATION_BYTES_CHANGED =
NO

C04_RUNTIME_CHANGE =
NONE

NEW_MIGRATION =
NONE

DOWNSTREAM_CANONICAL_HASH =
6e384abdaf7cf9fa35973ca31e1a5cb541f60bd328937ff3d27844b9dfdb4d72

C02A_FORWARD_CONVERGENCE_MAY_RESUME =
YES
```
