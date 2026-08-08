# Creator Shop Campaign Frontend — Agent Context Manifest

**Version:** 1.0  
**Status:** CANONICAL / PHASE 6B  
**Audience:** Human engineers, Codex, Antigravity, Cursor, and other coding agents

## 1. Purpose

This manifest tells an implementation agent what context to load for Campaign frontend work, in what order, and when to consult deeper module contracts.

It is a navigation artifact, not a new source of Campaign business truth.

Do not indiscriminately treat every file in `campaign/` as equal authority. Historical reconciliation artifacts are retained for traceability and may describe superseded implementation decisions.

## 2. Mandatory Context — Load First

For any Campaign frontend implementation task, read these first:

1. `docs/design-system/AURORA_DESIGN_SYSTEM.md`
2. Applicable standards under `docs/engineering/` for the task being performed. At minimum, load the frontend standard; also load backend, validation, database, and AI-integration standards when the task crosses those boundaries.
3. `campaign/README.md`
4. `campaign/backend/implementation_map.md`
5. `campaign/frontend/implementation_map.md`
6. `campaign/frontend/state_map.md`

These establish platform conventions, Campaign authority boundaries, frontend ownership, runtime/state semantics and implementation sequencing.

## 3. Mandatory Context for Backend Wiring

When the task connects UI to backend, also read:

- `backend/campaign_schema.prisma`
- `backend/validation/index.ts`
- the relevant executable schemas under `backend/validation/**`

Do not expose Prisma models directly to the frontend merely because they are available. Reconcile frontend read needs into View DTO/query contracts and UI actions into command/API contracts according to the production architecture.

## 4. Focused Contracts — Load on Demand

After loading the mandatory context, consult only the focused Campaign contracts relevant to the surface being implemented.

Examples:

- Create/Edit Campaign → `campaign/create_campaign/` and applicable edit/lifecycle contracts.
- Campaign Page shell/lifecycle/hydration/responsiveness → `campaign/campaign_page/`.
- Add Product → `campaign/add_product/`.
- Add Brief → `campaign/add_brief/`.
- Discovery/Prospects → the focused Discovery/Prospects contracts present under `campaign/` plus relevant Outreach contracts when Outreach is rendered.
- Applicants → focused Applicants contracts plus Intelligence boundary contracts for Applicant Intelligence.
- Outreach → focused Outreach contracts and executable Outreach Zod.
- Reporting → focused Reporting/Campaign Page Intelligence-reporting contracts plus `docs/engineering/ai-integration.md`.
- Share → focused Share contracts and executable Share Zod.
- Canonical audience/archetype/KPI values → `campaign/canonical/`.

Do not preload every focused contract for a small task if it is unrelated.

## 5. Stitch Context

Stitch references are supplied separately through MCP.

For each implementation task:

1. identify which canonical state/surface the Stitch screen represents using `campaign/frontend/state_map.md`;
2. use Stitch for visual hierarchy, composition, density and represented interaction surfaces;
3. normalize generated/imported UI to the canonical Design System and production frontend conventions;
4. derive unrepresented states from canonical Campaign contracts rather than inventing business behavior.

Stitch is not authority for lifecycle, validation, capability, permissions, editability, backend ownership, Intelligence ownership or responsive business semantics.

## 6. Authority Precedence

If sources overlap, follow the precedence defined in `campaign/frontend/implementation_map.md` and `campaign/README.md`.

In practical frontend work:

- Design System owns visual/component/responsive-system rules.
- Engineering standards own code/integration conventions.
- Prisma owns persisted Campaign-domain truth.
- Executable Zod owns implemented boundary/input validation.
- Campaign backend implementation map owns service/orchestration/concurrency/integration rules.
- Campaign frontend implementation/state maps own frontend implementation guidance and state coverage.
- Focused Campaign contracts own detailed product/domain semantics for their surface.
- Stitch owns only the visual reference for the represented state.
- Reconciliation artifacts are historical evidence only.

Never silently resolve a conflict by choosing a lower-authority source.

## 7. Files Not to Treat as Primary Implementation Authority

Files named or classified as reconciliation artifacts, including patterns such as:

- `*_schema_reconciliation.*`
- backend/schema reconciliation notes superseded by current Prisma/Zod
- temporary/staged patch artifacts if any exist in Git history

must not be used as the primary implementation source when a canonical artifact exists.

They may be consulted only to understand history or investigate an identified conflict.

## 8. Do Not Invent During Phase 6

Unless the task explicitly enters frontend ↔ backend wiring and reconciles the production architecture, do not invent:

- API endpoint paths;
- View DTO/query names or payloads;
- new persisted Campaign fields/statuses;
- frontend-owned lifecycle/readiness engines;
- client-selected Outreach channel;
- client-owned quota/application-limit calculations;
- local AI prompts/fallback engines that bypass Intelligence ownership;
- Collaboration domain logic;
- a second Design System/component library;
- production folder architecture based solely on this dummy repository.

## 9. Recommended First Implementation Task

For an initial Codex/Antigravity implementation or bake-off, use a bounded task:

> Implement the Campaign Page shell and the information-rich stable `STATE_4_DISCOVERY_ACTIVE` reference supplied through Stitch. Use the canonical Design System and Campaign contracts. Normalize Stitch-generated components/styles to the existing production frontend architecture. Use a replaceable mock/read adapter where the View DTO/API contract is not yet frozen. Do not invent backend business rules or API contracts.

Then implement the same semantic state on mobile to validate responsive discipline before proliferating additional states.

## 10. Context Expansion Rule

If implementation encounters a business question not answered by the loaded context:

1. search the relevant focused Campaign contract;
2. check the higher-authority Prisma/Zod/backend implementation map where applicable;
3. if the sources genuinely conflict or do not define the behavior, stop and surface the unresolved decision;
4. do not silently fill the gap with a plausible implementation.

## 11. Production Repository Rule

`dummy_tcs` is a specification/reference repository. Before writing production code, inspect the actual production repository and reuse its established framework, routing, state/data layer, component organization, testing conventions and backend architecture.

The contracts in this repository should be mapped into the production architecture, not mechanically copied as a parallel architecture.

## 12. Phase 6 Context Pack Summary

### Always load

- `docs/design-system/AURORA_DESIGN_SYSTEM.md`
- applicable `docs/engineering/*.md`
- `campaign/README.md`
- `campaign/backend/implementation_map.md`
- `campaign/frontend/implementation_map.md`
- `campaign/frontend/state_map.md`

### Load for backend wiring

- `backend/campaign_schema.prisma`
- `backend/validation/index.ts`
- relevant `backend/validation/**`

### Load on demand

- relevant focused contracts under `campaign/**`
- relevant canonical taxonomies under `campaign/canonical/`
- Stitch MCP reference(s) for the state/surface being implemented

### Avoid as primary authority

- historical reconciliation artifacts
- obsolete/staged patch artifacts from Git history
- arbitrary generated Stitch implementation details that conflict with the Design System or Campaign contracts
