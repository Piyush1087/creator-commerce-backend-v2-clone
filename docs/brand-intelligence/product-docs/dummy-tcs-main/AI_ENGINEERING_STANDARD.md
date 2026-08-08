# AI_ENGINEERING_STANDARD.md

**Version:** 1.0  
**Status:** APPROVED  
**Purpose:** Universal engineering governance for AI-assisted development

## 0. Purpose & Scope

This standard governs **how AI-assisted software is engineered**. AI-generated code is held to the same engineering standard as human-written production code.

The objective is the **simplest maintainable implementation that correctly satisfies approved product contracts and existing architecture**—not maximum abstraction or complexity.

This standard owns cross-cutting engineering requirements. It does not own product requirements, module-specific logic, canonical taxonomies, UI copy, prompts, Intelligence calculations, or Design System specifications.

**MUST / MUST NOT** — mandatory.  
**SHOULD / SHOULD NOT** — strong default; deviation requires a valid reason.  
**MAY** — optional and context-dependent.

A rule SHOULD have one canonical owning standard. Other standards SHOULD reference it rather than restating it unless layer-specific behavior materially changes its application.

## 1. Authority & Sources of Truth

AI MUST determine what type of decision is being made before deciding which source is authoritative.

| Source | Authority |
|---|---|
| Explicit approved human decision | Intentional product/engineering change |
| Product/domain contracts | What the product does |
| Approved UI copy | What the product says |
| `docs/design-system/AURORA_DESIGN_SYSTEM.md` | Reusable visual system |
| Approved Stitch/UI reference | Screen composition |
| Zod/API/types/Prisma | Executable implementation contracts |
| Existing code/schema | How the system currently works |
| Engineering standards | How approved behavior is implemented |

### 1.1 Product/domain authority
Canonical product definitions, module contracts, runtime contracts, field contracts, lifecycle rules and approved taxonomies define product behavior. Implementation MUST NOT silently reinterpret them.

### 1.2 Design authority
`docs/design-system/AURORA_DESIGN_SYSTEM.md` is canonical for reusable Design System decisions. Approved Stitch/reference screens generally govern screen composition. **Stitch/reference owns screen composition; Aurora owns reusable visual primitives and system behavior.** Generated Stitch code has no architectural authority.

Within Aurora itself, the repository's declared canonical/versioned source determines authority. If documentation and executable Design System implementation conflict and no version authority resolves it, surface the discrepancy.

### 1.3 Executable contracts
Executable artifacts implement higher-level product/domain decisions and MUST remain consistent with applicable canonical contracts.

### 1.4 Existing implementation
Existing code/schema are authoritative evidence of how the system currently works and MUST be inspected before material modification. A newer approved contract may supersede implementation, creating a reconciliation requirement rather than permission to replace code blindly.

### 1.5 Conflict resolution
| Conflict | Precedence |
|---|---|
| Product behavior | Approved change → canonical contract → existing implementation |
| UI copy | Approved copy → product specification → UI reference |
| Design primitive | Aurora → UI reference → existing implementation |
| Screen composition | Approved UI reference → product specification |
| Engineering approach | Engineering standard → established repository pattern → AI preference |

AI preference is always lowest authority. If equal-authority sources materially conflict and ownership does not resolve the issue, surface the conflict rather than guess.

## 2. Context & Change Discipline

### 2.1 Understand before modifying
Investigation depth MUST be proportional to the change. Identify only context that can materially affect the task. Do not retrieve a source merely because it exists.

### 2.2 Reuse before creation
Before creating a model, enum, schema, API contract, service, utility, component, Design System primitive or taxonomy, determine whether an appropriate representation exists. Reuse requires compatible semantics and ownership; do not force unrelated concepts into an existing abstraction merely to avoid creating something new.

### 2.3 Respect ownership
Logic and data MUST remain with their owning module. Consumers SHOULD interact through explicit contracts rather than reproduce another module's internal logic. A module MUST execute only lifecycle transitions it owns.

### 2.4 Smallest coherent change
Make the **smallest architecturally complete change** required. Avoid unrelated refactors, renames, dependency upgrades, abstractions, directory reorganizations and formatting churn. Do not artificially minimize a patch if that leaves duplicated logic, inconsistent contracts or incomplete behavior.

### 2.5 Product invention vs engineering inference
AI MAY make ordinary, reversible engineering decisions consistent with established architecture. Absence of a specification is not itself a conflict. Where product behavior is clear and the remaining choice is an ordinary reversible engineering decision, AI SHOULD resolve it autonomously.

AI MUST NOT silently invent or change product behavior, persisted-data meaning, canonical taxonomies, lifecycle ownership, public contracts, financial behavior, security boundaries or Intelligence ownership.

### 2.6 Governance protection
Engineering standards, agent instructions, canonical/frozen contracts and other governance artifacts MUST NOT be modified during ordinary feature implementation unless changing the governing artifact is explicitly within scope.

### 2.7 Generated code
Generated code is implementation input, not authority. Before production use it MUST be reconciled with applicable contracts, existing architecture, shared components, Aurora, type/runtime safety, accessibility and applicable standards.

## 3. Core Engineering Principles

### 3.1 Technology & dependencies
Creator Shop's currently approved core technologies include **TypeScript, React, NestJS, PostgreSQL, Prisma and Zod**. Use only those applicable to the repository/module. Actual usage and installed versions derive from the repository.

Do not perform incidental major upgrades or substitute core technologies without explicit approval. Prefer established dependencies before adding new ones. AI-generated or imported code does not justify a dependency by itself; confirm that a dependency is necessary, appropriate to the stack and not duplicating established capability.

### 3.2 Type & data integrity
Maintain meaningful type safety across system boundaries. Explicit `any` MUST NOT be used merely for convenience. Use `unknown` for genuinely unknown/untrusted values and validate or narrow it before use.

Canonical enums, taxonomies and domain concepts MUST NOT be independently redefined across layers.

Money, dates, times and other precision-sensitive values MUST use representations appropriate to their domain semantics. Do not rely on ambiguous date/time representations or floating-point arithmetic where exact monetary precision is required.

### 3.3 Contract-driven implementation
Product/domain contracts define what is valid. Executable contracts implement that truth. Equivalent executable contracts SHOULD derive from a canonical definition where the architecture supports it rather than being independently maintained.

### 3.4 Runtime boundaries
User input, external APIs, AI output, webhooks and imported data are untrusted until appropriately validated. TypeScript typing does not replace runtime validation. For client/server mutations, backend validation remains authoritative even when equivalent validation exists in the client.

### 3.5 Incomplete workflows
Where contracts permit drafts/progressive workflows, distinguish **valid to persist** from **complete enough to advance/publish/execute**.

## 4. Module, API & Data Boundaries

Modules own their applicable domain responsibilities, invariants, data behavior and lifecycle transitions. Cross-module consumers SHOULD use explicit contracts rather than implementation internals.

The owning module defines the contract for capabilities or canonical data it exposes. Consumers MUST NOT extend or reinterpret that contract locally; required changes belong in the owning contract.

Consuming data does not imply ownership. A module MUST NOT create an independently mutable copy of another module's canonical data unless an explicit synchronization, snapshot, cache, projection or read-model architecture requires it.

APIs are contracts, not incidental implementation shapes. Breaking contract changes require impact analysis.

Operations that must succeed/fail as one unit require an appropriate atomic boundary. Operations vulnerable to duplicate execution require safe behavior where relevant.

Before changing persisted structures, inspect existing schema, ownership, relationships, compatibility with existing data and migration implications. Destructive/data-transforming changes MUST be surfaced before execution.

## 5. Frontend & UI Governance

Frontend implementation MUST follow established repository architecture. Related states of one product surface SHOULD normally be implemented as states of one canonical feature/page rather than cloned screens.

Aurora is canonical for reusable visual-system decisions. Use executable Aurora components/tokens where available and do not recreate equivalent local primitives.

Approved Stitch/reference screens govern applicable composition and visual intent. Reconciliation with Aurora and repository architecture SHOULD preserve that composition and intent unless the reference conflicts with an explicit higher-authority requirement.

Production UI MUST implement applicable responsive behavior and preserve critical product functionality across supported viewports unless explicitly specified otherwise.

Approved UI copy is product truth. Do not creatively rewrite or invent final UI content when canonical copy exists.

Detailed frontend requirements are defined in `docs/engineering/frontend.md`.

## 6. Intelligence & Prompt Governance

Material Intelligence capabilities MUST have clear ownership, inputs, outputs and triggers. Consumers depend on defined contracts rather than recreate Intelligence-owned calculations.

AI/model output is untrusted. Structured outputs used by application logic MUST be validated before mutating domain state or triggering downstream actions.

Whether Intelligence blocks, falls back, requires human confirmation or acts autonomously is a product/domain decision.

Where a governed Prompt Builder owns production prompts, application modules MUST use it rather than embedding competing prompt logic.

Material derived/Intelligence outputs SHOULD preserve sufficient provenance/version identity where required to interpret, reproduce, refresh, compare or audit the result.

Detailed requirements are defined in `docs/engineering/ai-integration.md`.

## 7. Security, Reliability & Persistence Safety

Never commit secrets or credentials. Use approved secret/environment mechanisms.

Authentication and authorization are distinct. Sensitive permissions MUST be enforced at the appropriate backend boundary.

Do not unnecessarily collect, persist, transmit or log sensitive data.

Never report success for a required operation that failed. Do not swallow unexpected failures. If a failure is intentionally non-blocking, that behavior must be explicit.

Before retrying a mutation, determine whether repeating it is safe.

Destructive or irreversible changes require safeguards proportional to impact. Surface uncertainty before executing destructive database, infrastructure or production-data changes.

## 8. Validation, Testing & Quality Baseline

Testing/validation effort SHOULD be proportional to business criticality, complexity, regression risk, persistence impact and security/financial impact. Coverage percentage alone is not the quality objective.

Use relevant available checks such as typecheck, lint, unit/integration tests, build, schema/migration validation and visual/responsive verification. Never claim a check passed unless it actually ran.

Tests SHOULD verify meaningful behavior. Reproducible defects SHOULD receive regression coverage where practical.

Avoid speculative optimization that materially increases complexity without justified benefit. Production implementation MUST satisfy applicable accessibility requirements.

Detailed executable-validation requirements are defined in `docs/engineering/validation.md`.

## 9. Repository & Git Discipline

Treat the repository as a shared engineering system. Modify only files required by the requested change and architecturally necessary dependencies. Keep diffs coherent and reviewable.

Distinguish canonical source files from generated outputs; do not manually modify generated artifacts where an established generation mechanism owns them.

Where AI creates commits, commits SHOULD represent coherent engineering changes and describe the change rather than the AI tool.

Permission to create/commit code does not imply permission to deploy, execute production migrations, modify production infrastructure, rotate credentials or perform destructive production operations.

GitHub is the persistent versioned repository for approved engineering artifacts and implementation. File presence alone does not establish authority; authority follows Section 1.

## 10. AI Agent Change Protocol

For material tasks follow:

**UNDERSTAND → DISCOVER → IDENTIFY AUTHORITY → ASSESS IMPACT → IMPLEMENT → VALIDATE → REPORT**

Retrieve the minimum sufficient authoritative context. Consider only applicable effects across frontend, backend, API, database, validation, Intelligence, tests and consumers.

Resolve ordinary reversible engineering uncertainty autonomously. Surface unresolved uncertainty before proceeding when it materially affects product behavior, persisted data, public/external contracts, security, financial behavior, destructive operations, canonical taxonomy, lifecycle/module ownership or Intelligence ownership.

Do not describe work as complete when required implementation remains missing, validation failed, production placeholders remain or required authority could not be established.

## 11. Definition of Done

Apply only checks relevant to the task.

### Product & architecture
- [ ] Approved product/domain contracts are satisfied.
- [ ] No material product behavior was silently invented.
- [ ] Module/lifecycle ownership is respected.
- [ ] Existing architecture and reusable artifacts were considered.

### Engineering
- [ ] Types/runtime validation are appropriate.
- [ ] No unjustified duplication or abstraction was introduced.
- [ ] API/data implications are handled where applicable.
- [ ] Persistence/migration impact is understood where applicable.

### UI
- [ ] Aurora and approved composition/reference are respected where applicable.
- [ ] Canonical copy is used.
- [ ] Required states/responsive behavior/accessibility are implemented.

### Intelligence
- [ ] Intelligence ownership/contracts are respected.
- [ ] AI outputs are validated where consumed programmatically.
- [ ] Trigger/failure/human-confirmation behavior matches applicable contracts.

### Security & reliability
- [ ] No secrets/sensitive debug data were introduced.
- [ ] Authorization is enforced appropriately.
- [ ] Failure/retry/atomicity behavior is safe where relevant.
- [ ] Destructive implications are surfaced.

### Verification & repository
- [ ] Relevant available checks were actually run.
- [ ] Failures/unverified areas are reported.
- [ ] No unrelated changes or temporary artifacts remain.
- [ ] The diff is reviewable.
- [ ] Breaking changes, migrations and unresolved issues are clearly reported.