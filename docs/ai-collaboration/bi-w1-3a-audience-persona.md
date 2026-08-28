# BI-W1.3A — Audience Persona execution

Baseline: `884eed094706f091d5de494d1b72bcf36754a1cd`.
Frozen Audience authority: `a6bed1f28564c002f7d76931de0b4dd960ea5ae1`.

## Bounded implementation

`audience_persona_synthesis@1.0` owns only `audience_personas` and the already-frozen
item/field paths. It uses W1.0D claim, heartbeat, retry and transactional finalization;
the existing structured provider service; canonical Brand state and durable DE
Evidence readers; frozen structural/semantic validation; W1.0B current/candidate
transitions; and the W1.0F projection. The persistence router adds one dispatch case.
No schema, migration, shared execution primitive, DE writer, or consumer endpoint is
introduced. Existing Brand consumer projection exposes active Personas progressively.

The Communication, Meaning and Character implementations and generated bundles
remain unchanged, pinned respectively to `017dbceac494f0861ec9a6bea7af3129b70fa5cb`,
`2e13fa40235094d127f72b38f43c510232e38be4`, and
`56b52c1106feff2a92f23a7c49674fd116bf8c63`.

## Evidence and readiness

The existing DE messaging, company-context and Offering-context capabilities form
an any-of input set. No single capability, complete Offering, Preview, user-input,
Instagram or Meta input is mandatory. No new DE capability is added.

Before invoking the provider, Audience admission requires current, usable,
representative first-party Audience support, not coverage alone. The processor's
conservative signal recognizer operates on existing normalized text, distinguishing
explicit customer/use context from generic marketing, incidental/campaign text and
ungeneralized single-Offering clues. This recognizer is not a semantic-ID matcher.
The frozen reasoning contract still governs whether any particular Persona is
defensible. Missing support enters W1.0D dependency waiting without provider calls.

Zero, one and multiple results are valid. An active Persona needs the frozen core
and at least one meaningful decision-context dimension. Missing dimensions remain
partial; the two-to-three-Persona target is not a readiness gate. Demographics are
omitted/null because no explicit demographic policy is configured. Audience
geography never establishes commercial serviceability or Offering availability.

## Identity and reconciliation representation

- Exact `semantic_id` is durable identity. Wording, case and order do not define it.
  There is no fuzzy/numeric/label similarity threshold. The semantic reasoning and
  supplied current context reconcile meaning. Duplicate IDs are rejected.
- Root/list generations are structural anchors, not collection replacements.
  Persona/nested item membership is individually materialized. Omitted or null
  previous membership is retained, never implicitly deleted.
- `ACTIVE`, `INACTIVE` and `SUPERSEDED` are frozen semantic lifecycle field values,
  separate from the generic persistence-row lifecycle. Historical Persona paths and
  immutable generations remain available. The consumer filters inactive/superseded
  Personas without deleting their history.
- `SAME_PERSONA` requires the exact persisted ID. `POSSIBLE_MATCH` produces immutable
  non-current reconciliation context and cannot silently admit or merge a Persona.
  Material conflict does not overwrite unprotected current; exact protected paths
  use W1.0B candidates. Protected parent items also prevent child writes.
- Merge/split creates new IDs. The frozen shared supersession metadata is encoded
  under lifecycle metadata as reciprocal `supersedes_ref` / `superseded_by_ref`
  arrays of same-Brand Persona semantic IDs. New sources/successors must be in the
  complete authorized scope. Existing supersession links cannot be rewritten.
  Cross-Persona edges are semantic metadata, not the same-path generation FK.
- Protected source state holds the connected supersession proposal as non-current
  reconciliation context. No active successor can bypass that protection.
- The immutable object generation also records reconciliation, exact current basis,
  and held paths. Each generated field/item carries its own Evidence references.
  Preview origin is rejected unless Preview context was actually supplied; this
  implementation supplies none and has no Preview read or identity-reuse path.
- Current paths are locked in canonical order and the complete Audience basis is
  rechecked inside W1.0D finalization. A concurrent edit/protection change retries
  against a new basis. Failed refresh and replay preserve existing current state.

## Validation

Final validation on 2026-08-26:

- All **48 existing migrations** applied to disposable PostgreSQL 16 and reset/reapplied.
  The baseline includes the accepted Brand Centre migration beyond the earlier 47.
- W1.0A SQL constraints: passed.
- Audience: **45 tests passed**, including **23 PostgreSQL vertical-slice cases**,
  14 identity/semantic tests, five provider-boundary tests and three architecture tests.
- Full suite: **627 tests / 94 files passed; zero failures and zero skips**. This
  includes Communication, Meaning, Character, DE A–F, BI W1.0, Preview, canonical
  Brand state, authenticated consumer HTTP, retry, concurrency and protection tests.
- Prisma generate/validate, production build, isolated Audience test type-check,
  scoped ESLint, and `git diff --check`: passed.
- Pinned bundle verification with `--source ../brand_centre_auth --commit
  a6bed1f28564c002f7d76931de0b4dd960ea5ae1`: passed. Frozen current-read contract
  verification also passed without regenerating its accepted content.
- Fresh built-`dist` Nest startup, copied-bundle integrity, all four pins, and exactly
  the four real executor bindings: passed. The existing synthetic test binding remains.

The final suite used one worker with every repository PostgreSQL opt-in enabled.
An earlier resource-contended run was discarded and rerun; production timeout,
lease and retry rules were not relaxed. Only external acquisition/provider mechanics
are faked in vertical-slice tests; DE persistence/readers and W1 execution,
transactions, validators, candidates, projection and authenticated HTTP are real.
No live provider calls or non-disposable database migrations were performed.

No Prisma/schema/migration or DE implementation changed. Communication, Meaning and
Character implementation/bundle directories are byte-for-byte unchanged from baseline.
Their architecture tests only extend the explicit expected executor/registry set.
Development is not merged as part of this feature assignment.
