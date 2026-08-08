# DATABASE_ENGINEERING_STANDARD.md

**Version:** 1.0  
**Status:** APPROVED

Supplements `AI_ENGINEERING_STANDARD.md`. This document owns database- and Prisma-specific engineering requirements.

## 1. Database Context
Before material persistence changes, inspect the relevant Prisma schema, models/relations, enums, constraints/indexes, migrations, ownership of affected data and code that reads/writes affected structures.

Do not design persistence from the product contract alone when an existing schema must be integrated.

## 2. Domain vs Persistence
A domain concept does not automatically require its own model/table or a one-to-one persistence representation. Persistence SHOULD represent domain requirements while respecting existing data architecture. Database structure itself is not the source of product behavior.

## 3. Existing Schema First
Before creating a model, field, enum or relation, inspect semantically relevant existing schema and ownership. Determine whether an existing representation should be reused or extended, without forcing reuse across incompatible semantics/ownership.

## 4. Models
Create a model when a concept has a meaningful independent persistence identity or lifecycle that justifies one. Avoid models created solely to mirror every UI section, DTO, Zod object or nested domain object.

## 5. Fields
Fields SHOULD have clear semantics, appropriate type, appropriate optionality/nullability and ownership consistent with the containing model. Do not add speculative fields for possible future use.

When modifying a field, identify effects on existing rows, application code, API contracts, validation and migrations.

## 6. Relations
Relations SHOULD represent actual domain/persistence relationships with appropriate cardinality, ownership, optionality and referential behavior. Do not duplicate canonical entities simply to avoid defining a relation.

Evaluate existing-data impact before changing deletion/cascade behavior.

## 7. Enums & Canonical Taxonomies
Database enums MUST NOT independently redefine canonical product taxonomies. Where a canonical taxonomy is implemented as a database enum, changes must remain aligned with the owning product/domain contract.

Consider migration implications before removing or renaming persisted enum values.

## 8. JSON
Use JSON when data is genuinely flexible, externally shaped, snapshot-oriented, structurally variable or unsuitable for relational querying. Do not use JSON merely to avoid schema design.

Data requiring frequent filtering, joining, constraints or independent mutation may warrant relational structure. JSON does not remove the need for application-level validation.

## 9. Snapshots & Derived Data
Snapshots, projections and derived records SHOULD be distinguishable from canonical mutable data. A snapshot SHOULD preserve historical state required by its product purpose rather than unintentionally remain coupled to future source changes.

Derived/Intelligence data SHOULD preserve applicable provenance/version identity according to the owning contract.

## 10. Constraints
Use database constraints where they reliably protect persistence invariants, including applicable uniqueness, foreign keys, required fields and relational constraints.

Application validation does not necessarily replace persistence-level integrity; database constraints do not replace richer domain validation.

## 11. Indexes
Indexes SHOULD correspond to actual or reasonably expected access patterns such as lookups, filtering, joins, uniqueness and ordering. Do not add indexes mechanically to every field. Consider write/storage cost and existing indexes.

## 12. Migrations
Before finalizing a migration, determine effects on existing rows, defaults/backfills, nullability transitions, relation changes, enum changes, destructive operations and deployment compatibility where relevant.

Do not assume an empty database unless the environment is explicitly disposable.

## 13. Destructive Changes
Treat dropping models/fields, removing enum values, destructive type conversions, destructive relation changes and data rewrites as high-risk where applicable. Surface destructive implications before execution and prefer safe staged evolution where context requires it.

## 14. Data Backfills & Transformations
When schema evolution requires existing data to change, define the transformation explicitly. Backfills SHOULD be deterministic where possible and safe for expected volume; make them observable/recoverable where risk warrants it.

Do not silently assign semantically incorrect defaults merely to make a migration succeed.

## 15. Prisma
Follow established repository Prisma conventions. Prefer explicit, understandable schema definitions over unnecessary cleverness. Generated Prisma artifacts SHOULD be regenerated through established mechanisms rather than manually edited.

A valid Prisma schema does not automatically represent a valid domain model.

## 16. Database Verification
In addition to the universal Definition of Done, verify where applicable:
- existing schema/migrations were inspected;
- no unintended duplicate model/field/enum was introduced;
- relations/constraints represent intended semantics;
- existing-data impact is understood;
- migration behavior is valid;
- destructive implications are surfaced;
- indexes correspond to justified access patterns;
- relevant Prisma/schema/migration checks were actually run.

Only report checks actually performed.