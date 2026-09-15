# Creator Work Preferences V0 migration review

Migration `20260915200000_creator_work_preferences_canonical_revision` follows the 102 accepted predecessor migrations. It adds only the Work Preferences canonical aggregate and its append-only actor-attributed revision history. Rate Card has separate ownership and is not introduced by this migration.

Canonical answers are explicit nullable YES/NO values, not inferred from shipping, payout, Instagram or Intelligence. Industries use the accepted stable vocabulary; availability/date consistency, aggregate ownership, ordered revisions and current snapshot consistency are enforced by database constraints/triggers and strict application validation. Deferred constraints allow the canonical row and its revision to commit atomically. No provider operation occurs inside these transactions.

Revision updates and direct revision deletion are rejected. Target-owner aggregate deletion permits only the corresponding foreign-key cascade into its own revisions; external Settings, Creator, Campaign, Application, Collaboration and Intelligence ownership is unchanged. Owner-scope purge is internal, explicitly fenced and has no public route.

No accepted table is rewritten or backfilled. Clean PostgreSQL 17 deployment applies all 103 migrations. The populated 102-to-103 test compares count and sorted-row digests for all 195 predecessor public tables before and after deployment and initial Work Preferences creation. Every predecessor digest is preserved.

Published LF-normalized migration SHA-256: `49627b44e53a43a792afb82a7d160f6f8b27c0e94771079904d8e1da7de07b62`. Windows working-copy line endings may differ; no predecessor migration content is changed.

Production rollback is not authorized by this packet. Preserve the reviewed additive history; do not drop tables or rewrite migration records in an existing developer/production database. Disposable acceptance databases are task-owned and isolated.
