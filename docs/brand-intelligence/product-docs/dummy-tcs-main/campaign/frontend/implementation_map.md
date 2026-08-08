# Creator Shop Campaign Frontend — Implementation Map

**Version:** 1.0  
**Status:** CANONICAL / PHASE 6  
**Module:** Campaign

## 1. Purpose

This artifact is the Campaign-specific implementation bridge between the frozen Campaign domain/backend contracts, the platform engineering/design standards, Stitch visual references, and the production frontend implementation.

It is tool-neutral. Human engineers, Codex, Antigravity, Cursor, or another coding agent should implement the same contracts.

This file does **not** define new Campaign business rules and does **not** replace the Design System, Prisma, Zod, backend implementation map, or focused Campaign domain contracts.

## 2. Authority Order for Frontend Work

When implementing Campaign UI, use this precedence:

1. `docs/design-system/AURORA_DESIGN_SYSTEM.md` — visual system, tokens, reusable component contracts, interaction/accessibility patterns and responsive design authority.
2. Applicable `docs/engineering/*.md` standards — frontend/backend/validation/database/AI integration engineering rules according to the work being performed.
3. `backend/campaign_schema.prisma` — persisted Campaign-domain truth.
4. `backend/validation/**/*.schema.ts` — executable mutation/boundary validation.
5. `campaign/backend/implementation_map.md` — service ownership, lifecycle/orchestration, transactions, concurrency, replay and integration boundaries.
6. `campaign/frontend/state_map.md` — canonical Campaign UI/runtime state inventory.
7. Focused contracts under `campaign/**` — detailed Campaign product/domain semantics.
8. Stitch screens supplied through MCP — visual references for the represented state, not independent business-rule authority.
9. Historical `*_schema_reconciliation.*` artifacts — traceability only; superseded for implementation.

If two sources conflict, do not silently choose the visually convenient behavior. Resolve the conflict against the higher-authority canonical source.

## 3. Frontend Ownership Boundary

The frontend owns presentation and interaction state, including:

- layout and responsive composition;
- progressive disclosure;
- component/open/closed state;
- modal/drawer/full-screen detail presentation;
- local form state before submission;
- loading/skeleton/error/retry presentation;
- optimistic presentation only where explicitly safe;
- focus, selection and navigation presentation;
- mapping canonical backend capabilities/states to Design System components.

The frontend does **not** own or independently infer canonical business truth such as:

- Campaign lifecycle transitions;
- execution readiness;
- permissions/authorization;
- Campaign editability rules;
- Outreach channel selection;
- Outreach quota eligibility;
- Priority DM pacing;
- Application eligibility/limits;
- Intelligence calculation/result truth;
- Share tracking identity;
- Collaboration lifecycle.

These must come from canonical backend/domain contracts and eventually from backend responses/capabilities.

## 4. One Domain Model Across Viewports

Campaign uses one domain/orchestration model across desktop, tablet and mobile.

Responsive presentation may change layout, density, simultaneous visibility, navigation presentation, detail-surface presentation, progressive disclosure and control placement.

Responsive presentation must not change Campaign lifecycle, readiness, primary domain priority, workspace instantiation, permissions, editability, Share availability, Meta capability, Campaign action availability, Intelligence meaning, Reporting meaning or business validation.

Breakpoints and reusable responsive patterns are owned by the Design System rather than Campaign contracts.

## 5. Campaign Page Composition

Treat Campaign Page as a shell over canonical Campaign entities and workspaces, not as a new frontend business aggregate.

The frontend should be decomposable around concerns such as:

- Campaign header / lifecycle actions;
- Campaign strategy/details surface;
- Product + Brief context/setup;
- primary operational focus/intelligence surface;
- workspace navigation when multiple workspaces are instantiated;
- Discovery/Prospects workspace;
- Applicants workspace;
- future independently owned Collaboration references/workspace mapping;
- Reporting card + full-report trigger;
- Share action/modal;
- Add Product / Add Brief / Edit Campaign detail flows.

Exact component names and folder boundaries should follow the production frontend architecture after the agent inspects that repository. Do not create a parallel component system merely to mirror this list.

## 6. Hydration and UI State

Campaign Page hydration is deterministic from canonical backend/domain facts. The current frozen Campaign Page contract defines nine hydration outcomes plus a post-live readiness blocking condition. These are **not nine persisted Campaign statuses**.

The frontend must render the resolved state/capabilities rather than creating its own competing lifecycle engine.

Use `campaign/frontend/state_map.md` for the implementation-facing state inventory and `campaign/campaign_page/hydration_state_machine.yaml` for the detailed frozen resolver semantics.

## 7. Read Boundary — View DTOs

The production API/View DTO layer is intentionally **not frozen yet**. It must be designed during frontend ↔ backend wiring against the actual production architecture and the implemented UI needs.

Expected read surfaces may include Campaign Page shell, Campaign details, Product/Brief context, Discovery, Applicants, Reporting and Share-related presentation data, but names and endpoint shapes must not be invented solely from this document.

When View DTOs are designed, prefer frontend-consumable projections/capabilities over exposing Prisma models directly. The frontend should not need to reconstruct complex backend eligibility, lifecycle or orchestration rules from raw tables.

Mark current mock/static data adapters so they can later be replaced by the real read contract without rewriting visual components.

## 8. Command Boundary

Frontend actions should map to explicit backend commands rather than direct persistence semantics.

Examples of Campaign actions include publishing/editing/lifecycle actions, Product/Brief actions, Outreach actions, Application actions where relevant to the Brand surface, Share initiation, and Reporting navigation/trigger consumption.

Exact API route/controller names remain to be reconciled during frontend ↔ backend wiring.

For mutations:

- use the canonical executable Zod/domain contract where architecture permits;
- backend validation remains authoritative;
- surface machine-readable errors through approved UI patterns;
- do not reproduce service-only invariants as hidden frontend authority;
- generate/pass request identity where required by the frozen command contract;
- do not let duplicate-button prevention substitute for backend idempotency.

## 9. Outreach Frontend Rules

The Brand may provide free-form instruction to the composer.

The frontend must **not** choose Email vs Priority DM as canonical Outreach channel. Backend resolves the channel.

Email and Priority DM may have different composed content/presentation. Email click/re-open behavior and Priority DM execution remain governed by the backend implementation map and executable validation.

Do not encode quota/pacing calculations as frontend truth. The frontend should consume availability/capability/error semantics from the backend when the API contract is implemented.

## 10. Reporting Frontend Rules

Reporting calculation is Intelligence-owned. Campaign frontend renders the Campaign-facing Reporting projection/card.

For MVP, Campaign requires a single Reporting card behavior plus a `View full report`-type action/surface; this artifact does not prescribe the full-report UI.

Responsive presentation may change the full-report surface (for example overlay vs full-screen view) without changing Reporting semantics.

The frontend must not calculate Campaign Reporting metrics, score, recommendation logic or Intelligence conclusions.

## 11. Share Frontend Rules

Share is a Campaign action with channel selection, auto-composed message and tracked Campaign link.

MVP channels are governed by the frozen Share contracts. The UI may expose Copy Link and supported external share destinations according to those contracts.

Each intentional Share action may be independent. Frontend duplicate prevention must not collapse legitimate repeated Shares. Tracking token/identity is server-owned.

Preview image/link-preview presentation may use Campaign/Product/Brand visual context when supplied by the eventual read/share contract; the frontend must not invent canonical tracking metadata.

## 12. Intelligence Integration

Follow `docs/engineering/ai-integration.md` and the Campaign Intelligence boundaries.

The frontend consumes Campaign-facing Intelligence outputs/projections. It must not:

- create local AI fallbacks that bypass the owning Intelligence capability;
- reconstruct AI Match, Marketplace ranking, Reporting or recommendation calculations;
- rewrite provider/Intelligence meaning as a new canonical result;
- trigger Intelligence outside frozen trigger ownership merely because a screen renders.

Loading, unavailable and degraded Intelligence presentation should preserve the domain semantics returned by the owning capability.

## 13. Collaboration Boundary

Collaboration is an independent module. Campaign frontend may eventually map independently owned Collaboration entities into a Campaign workspace, but this frontend phase must not invent Collaboration persistence, lifecycle, commands or business logic.

Application `APPROVED` is the current Campaign-side boundary.

Any Stitch reference that visually contains Collaboration UI is a presentation reference only until the Collaboration module is independently specified.

## 14. Stitch Usage

Stitch screens supplied through MCP are visual references for represented states.

Use Stitch to understand hierarchy, density, visual composition, content placement and representative interaction surfaces. Normalize the imported implementation to the canonical Design System rather than preserving arbitrary generated CSS/components.

A Stitch screen must not override lifecycle, capability, editability, validation, responsive-domain invariants or backend ownership.

Prefer one information-rich stable state as the primary structural reference, supplemented by mobile and materially different states. The agent should derive unprovided states from canonical contracts rather than fabricate business behavior.

## 15. Implementation Sequence

Recommended sequence:

1. Inspect production frontend architecture and applicable engineering/design standards.
2. Load the Campaign canonical context pack.
3. Import/inspect the selected Stitch reference state(s).
4. Normalize Stitch output to existing Design System primitives/tokens.
5. Build the Campaign Page shell and one information-rich stable state using mock/static adapters where API contracts are not yet frozen.
6. Implement remaining states from `campaign/frontend/state_map.md` and focused contracts.
7. Validate desktop/mobile behavior against the responsive runtime contract.
8. Reconcile actual UI data needs into View DTO/read contracts.
9. Reconcile UI actions into command/API contracts using existing Zod/service rules.
10. Connect frontend to backend incrementally by surface/workspace.
11. Test lifecycle, capability, empty/loading/error and responsive states.
12. Remove obsolete mock adapters only after real backend wiring is verified.

## 16. Production Repository Reconciliation

This dummy repository is a specification/reference repository, not the production application repository.

Before implementation, the coding agent must inspect the production frontend/backend architecture and map these contracts into existing conventions. Do not mechanically create paths, frameworks, stores, hooks, services or component abstractions merely because this reference repository uses documentation folders.

## 17. Phase 6 Open Items

The following are intentionally deferred until the UI/reference implementation and production repository are available:

- concrete API routes;
- View DTO/query shapes;
- frontend data-fetching/cache mechanism;
- production component/file paths;
- exact loading/error component selection where not already dictated by Design System;
- exact Stitch reference IDs/links;
- Collaboration UI implementation;
- full Reporting view UI.

These are not missing business decisions unless later reconciliation proves otherwise.