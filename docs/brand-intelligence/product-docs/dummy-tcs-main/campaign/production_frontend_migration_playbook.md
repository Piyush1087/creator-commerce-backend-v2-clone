# Campaign Production Frontend Migration Playbook

**Status:** Phase 3 developer execution authority

## 1. Purpose

This playbook defines how the Campaign work in `dummy_tcs` should be reconciled with the existing Creator Shop production frontend.

`dummy_tcs` is **not** a replacement frontend package. It contains the newer Campaign contracts, backend/read/write boundaries, lifecycle and hydration architecture, and a staging reference implementation of the redesigned Campaign Page. Production already contains mature application infrastructure and several stronger frontend workflows.

Migration must therefore happen **surface by surface**, using the classifications KEEP, ADAPT, REPLACE and ADD.

## 2. Authority hierarchy

When sources disagree, use this hierarchy:

1. **Campaign canonical contracts** — Campaign domain behavior, fields, lifecycle, hydration, capabilities, DTOs, commands and read models.
2. **Design System 5.0** — current design/component authority.
3. **Approved Stitch reference** — visual authority only for the specifically approved surface/reference.
4. **Production frontend** — mature implementation-pattern/component library and real application environment.
5. **`dummy_tcs` staging visuals** — behavioral/IA reference where applicable, but not final visual authority.

Important nuance: for Campaign-specific workflow, state and information architecture, the new Campaign contracts and approved `dummy_tcs` architecture can override the old production Campaign implementation. Visually, the staging scaffold does not automatically override production.

## 3. Migration vocabulary

### KEEP
Keep the existing **production frontend implementation** substantially as-is. Change it only where integration or confirmed contract/design-system compatibility requires it.

### ADAPT
The **production frontend remains the implementation baseline**, but it must be modified for new fields, contracts, runtime behavior, information hierarchy and/or design-system alignment.

### REPLACE
The existing production surface is **not the implementation baseline**. The new Campaign architecture controls the surface. Production primitives/components may still be reused selectively.

### ADD
The surface does not exist in production. Build it from canonical contracts using production primitives and Design System 5.0.

### REUSE
`REUSE` is not a primary classification. It is guidance inside an ADD or REPLACE task: selectively reuse mature production primitives without preserving obsolete workflow.

## 4. Critical rules

Do not:

- migrate the staging application shell/navigation into production;
- treat staging CSS or staging visual quality as final design authority;
- infer canonical design merely because an old production pattern is frequent;
- replace strong production Create Campaign, Add Product or Add Brief UI with staging equivalents;
- invent Campaign Intelligence outputs that do not exist;
- move backend-owned lifecycle, capability, routing, idempotency or intelligence decisions into React;
- preserve old production Campaign behavior when canonical Campaign contracts disagree;
- rewrite an entire retained production workflow to fix one contract discrepancy;
- create parallel drawer/button/form systems when production already has reusable primitives;
- opportunistically change adjacent modules;
- combine functional migration and broad aesthetic redesign unless explicitly requested.

## 5. What was and was not built in `dummy_tcs`

### Create/Edit Campaign

Built:

- canonical field contract;
- field validation reconciliation;
- runtime contract;
- Campaign module bridge;
- executable Zod reconciliation;
- Create/Edit/View behavioral ownership and editability rules.

Not built:

- a replacement production-quality Create Campaign React frontend.

Therefore **do not search for and transplant a new Create Campaign UI from `dummy_tcs`**. Adapt the existing production implementation and connect it to the newer contracts/runtime.

### Campaign Page

Built:

- new Campaign Page information architecture;
- hydration/state behavior;
- capability projections;
- query/read boundary;
- command boundary;
- Products & Briefs summary behavior;
- Discovery/Applicants workspace behavior;
- Campaign Copilot projection boundary;
- staging reference React implementation.

The staging React/CSS proves structure and behavior; it is not final visual authority.

### Staging tooling

`frontend/staging/**` contains development/reference tooling. Scenario fixtures, staging harnesses and the staging shell must not be migrated as production application architecture.

## 6. Master surface classification

| Surface | Decision | Production baseline? | `dummy_tcs` contribution | Reuse guidance |
|---|---|---:|---|---|
| Create Campaign | ADAPT | Yes | field/runtime/validation contracts | preserve mature production form/layout |
| Edit Campaign | ADAPT | Yes | editability/runtime contracts | reuse Create Campaign field implementation |
| Add Product | ADAPT | Yes | command/read/domain contract | preserve mature production drawer/search UX |
| Add Brief | ADAPT | Yes | Brief command/read contract | preserve mature production workflow |
| Campaign Page | REPLACE | No | IA, hydration, capabilities, behavior | reuse production shell/primitives, not old workflow |
| Discovery workspace | REPLACE | No | workspace/state/action architecture | reuse filters/cards/loading primitives where suitable |
| Applicants workspace | REPLACE | No | workspace/state/terminal actions | reuse mature production internals where suitable |
| Creator Card | ADAPT | Yes | new information/action contract | retain production card baseline if structurally suitable |
| Creator Profile drawer | ADAPT | Yes | richer Campaign-context projection | reuse production drawer mechanics; restructure content |
| Campaign Details drawer | ADD | No | View/read contract | use production drawer primitive |
| Product Details drawer | ADD | No | lazy read/detail contract | reuse existing Product patterns/primitives |
| Brief Details drawer | ADD | No | lazy read/detail contract | reuse existing Brief patterns/primitives |
| Campaign Copilot | ADD | No | bounded projection/action boundary | use production primitives; likely later Stitch candidate |
| Reporting | REPLACE | No | new Campaign reporting architecture/summary concept | do not preserve legacy SaaS reporting architecture |
| Share | ADAPT | Yes | new command/tracking semantics | preserve strong production journey/layout |
| Outreach | ADAPT | Yes | service-owned execution boundary | preserve production composer UX where strong |
| Global app shell/navigation | KEEP | Yes | none | integrate Campaign into real production shell; later DS5 audit |

## 7. Surface-specific guidance

### 7.1 Create Campaign — ADAPT

Production is the frontend baseline.

Compare every production field with the canonical Campaign field/runtime contracts and classify each as KEEP, ADD, REMOVE, RENAME, DERIVE, CHANGE VALIDATION or CHANGE OPTIONS.

Preserve the mature production rendering. Reconcile field set, canonical vocabulary, derived KPI/currency behavior, progressive field validation, step completion validation and publish readiness.

Targeted design fixes such as breadcrumb placement, sticky CTA/footer, typography and spacing should be audited against Design System 5.0 rather than triggering a full rebuild.

### 7.2 Edit Campaign — ADAPT

Reuse the Create Campaign field implementation. Do not create a second independent form model.

The canonical Campaign definition is shared across Create/Edit/View; lifecycle, creation source and backend capabilities control editability. Preserve the frozen manual-vs-AI-recommended editability rules.

### 7.3 Add Product — ADAPT

Preserve the mature production drawer and useful search/selection/loading behavior. Reconcile Product source identity, Campaign Asset DTOs, active/inactive semantics, command boundary and backend identifiers.

### 7.4 Add Brief — ADAPT

Preserve the mature production implementation and reconcile it to the canonical Brief contract, command/read boundaries and current Campaign behavior.

### 7.5 Campaign Page — REPLACE

The old production Campaign Page does not define the target IA.

The new architecture controls lifecycle presentation, hydration, Products & Briefs readiness, workspace visibility, Discovery, Applicants, Reporting placement, Copilot, Share, paused/historical behavior and post-live readiness behavior.

Use `dummy_tcs` as the behavioral/IA baseline. Inspect production for stronger implementation primitives, typography, responsive containers, cards, drawers, loading/error patterns and shell integration. Do not copy staging visuals blindly.

### 7.6 Creator Card — ADAPT

Start from the production card if it can support the new information hierarchy.

Shared core can include creator identity, category, followers, engagement and Profile entry. Discovery should emphasize recommendation context/fit and Outreach state; Applicants should emphasize application context, Applicant Intelligence and Approve/Reject actions where supplied.

Same underlying creator data does not require identical Discovery and Applicant presentation.

Replace the production card only if its structure genuinely cannot support the new contract.

### 7.7 Creator Profile drawer — ADAPT heavily

Reuse production drawer mechanics where strong, but reconcile the content model substantially.

The drawer should support supplied Campaign-context information such as identity/account summary, relevant metrics, Campaign fit/recommendation projection, confidence/evidence where actually supplied, interaction/application context and appropriate actions.

Use one coherent Creator Profile shell with context-sensitive projections rather than unrelated Discovery and Applicant profile implementations.

Do not invent recommendation or intelligence data before the Intelligence Platform supplies it.

### 7.8 Discovery — REPLACE

Replace the old workflow/container/state behavior. The new Campaign architecture owns workspace visibility/instantiation, hydration prominence, acquisition behavior, card actions and Campaign Page placement.

Reuse strong production internals such as filters, pagination, cards, drawers, loaders and responsive primitives where compatible.

### 7.9 Applicants — REPLACE

Replace the old workflow/container/state behavior while reusing suitable production internals. The new architecture owns workspace behavior, Applicant terminal-state actions, supplied Applicant Intelligence and Campaign Page placement.

### 7.10 Campaign Details — ADD

Build a new read-only Campaign Details surface from the canonical View/read contract. Use production drawer primitives. Editing must route to Edit Campaign; the details surface is not a mutation path.

### 7.11 Product Details — ADD

Build the missing detail surface from the new read contract. Reuse existing production Product drawer/detail patterns rather than staging placeholders.

### 7.12 Brief Details — ADD

Build the missing detail surface from the new Brief read contract. Reuse existing production Brief patterns and primitives.

### 7.13 Campaign Copilot — ADD

Implement the presentation/integration boundary, not an independent frontend intelligence engine.

Copilot consumes supplied/accepted projections and routes actions into Campaign surfaces. Until Campaign Intelligence is implemented, represent legitimate unavailable/loading/supplied states. Do not call AI directly from React to fabricate Campaign recommendations.

Likely candidate for targeted Stitch refinement after functional integration.

### 7.14 Reporting — REPLACE

The legacy production SaaS reporting architecture is not the target and should be replaced.

Retain/reuse the new Campaign summary-card concept where useful, but the new Campaign reporting model should be Campaign-owned and fed by accepted Intelligence/calculation outputs. Detailed reporting can be a lazy-loaded surface.

Campaign Intelligence/reporting execution remains a separate intelligence implementation concern; do not recreate those calculations in frontend code.

### 7.15 Share — ADAPT heavily

Preserve the strong production Share journey/layout where useful, but reconcile the execution semantics substantially.

Supported channel must come from the authoritative projection. Execution uses the canonical Campaign command boundary, including request identity and backend-owned tracked-link/evidence behavior. Do not preserve obsolete frontend-generated tracking/business logic.

### 7.16 Outreach — ADAPT

Preserve strong production composer UX: editing, confirmation, creator context and success/error presentation.

Reconcile execution to the new service-owned boundary. Frontend must not independently decide Email vs Priority DM when that choice belongs to OutreachService. Retry, attempt, pacing, quota, provider truth and idempotency remain backend-owned.

### 7.17 Global shell/navigation — KEEP

Use the real production shell, routing, authenticated context and shared layout. Do not migrate the staging shell. Audit production patterns against Design System 5.0 later rather than regressing to staging navigation.

## 8. How Codex should use the complete production frontend

Give Codex visibility to the complete production frontend where practical. It should treat production as an **implementation-pattern library**.

Before creating a generic component, search production for an existing mature primitive. Examples include drawers, buttons, fields, cards, tabs, loaders, empty states, sticky actions, breadcrumbs and responsive containers.

Then compare the candidate against Design System 5.0. Frequency in old production does not make a pattern canonical.

Pattern:

```text
Need component
  -> inspect production shared/current implementations
  -> compare with Design System 5.0
  -> reuse if aligned
  -> adapt if useful but outdated
  -> create new only when no suitable primitive exists
```

## 9. Codex task types

Migration classification answers **what kind of surface change this is**. Codex task type answers **what Codex is allowed to do in this prompt**.

### AUDIT
Inspect and report. No implementation.

### PLAN
Propose exact change/file boundaries. No implementation.

### IMPLEMENT
Make an already-bounded/approved change.

### VERIFY
Run tests/runtime/contract checks and fix only bounded defects. Do not redesign.

### VISUAL REFINE
Compare the already-functional surface against Design System 5.0 and/or an approved Stitch reference. Do not change frozen Campaign behavior.

Preferred sequence:

```text
AUDIT -> PLAN -> IMPLEMENT -> VERIFY -> VISUAL REFINE
```

Do not routinely combine all five into one broad Codex prompt.

## 10. Standard Codex prompt patterns

### 10.1 ADAPT — audit/plan prompt

```text
Production [SURFACE] is the implementation baseline.

AUDIT ONLY. Do not modify files yet.

Inspect:
1. current production implementation;
2. relevant canonical Campaign contracts;
3. Design System 5.0;
4. relevant dummy_tcs contracts/reference implementation.

Preserve:
- strong production layout and interaction patterns;
- production shared primitives;
- production application conventions.

Identify changes required for:
- fields/data contract;
- runtime behavior;
- validation;
- actions/capabilities;
- information hierarchy;
- confirmed Design System 5.0 deviations relevant to this surface.

Do not replace this surface with the dummy_tcs staging frontend.

Return:
- production files involved;
- KEEP within surface;
- CHANGE;
- REMOVE;
- ADD;
- reusable shared primitives;
- contract conflicts/blockers;
- proposed implementation sequence.

Do not implement until the plan is reviewed.
```

### 10.2 REPLACE — audit/plan prompt

```text
The existing production [SURFACE] is NOT the target workflow/IA baseline.

AUDIT ONLY. Do not modify files yet.

Use the canonical Campaign contracts and approved dummy_tcs architecture as the behavioral/IA authority.

Inspect production for reusable:
- shared components;
- card/form primitives;
- typography implementation;
- drawer/modal primitives;
- responsive patterns;
- loading/empty/error patterns.

Do not preserve obsolete production workflow merely to reduce changes.
Do not copy staging visual implementation blindly.

Return:
- old production files that become obsolete or need isolation;
- new target component boundary;
- production primitives to REUSE;
- behavior/state that must come from the new Campaign architecture;
- exact files likely to change/add;
- contract conflicts/blockers;
- staged implementation plan.

Do not implement until reviewed.
```

### 10.3 ADD — audit/plan prompt

```text
[SURFACE] does not currently exist in production.

AUDIT/PLAN ONLY. Do not modify files yet.

Use:
- canonical Campaign contract as data/behavior authority;
- production shared components as implementation primitives;
- Design System 5.0 as design authority;
- approved Stitch reference only if one exists for this surface.

Do not create a parallel component system.
Do not invent missing backend or Intelligence data.

Return:
- proposed production location;
- reused production components/primitives;
- required DTO/read/command boundary;
- loading/empty/error/unavailable states;
- deferred/unavailable data;
- files to add/change;
- blockers.

Do not implement until reviewed.
```

### 10.4 KEEP — compatibility prompt

```text
Production [SURFACE] is classified KEEP.

Do not redesign or replace it.

Verify only its compatibility with the new Campaign module.

Change it only if required for:
- routing/integration;
- canonical Campaign contract compatibility;
- a confirmed Design System 5.0 issue directly relevant to this integration.

Return proposed changes before modifying the surface.
```

### 10.5 IMPLEMENT prompt wrapper

After an AUDIT/PLAN is approved:

```text
Proceed with the approved [SURFACE] implementation plan only.

Authority:
1. canonical Campaign contracts;
2. Design System 5.0;
3. approved Stitch reference if applicable;
4. production implementation patterns;
5. dummy_tcs staging visuals.

Preserve the approved KEEP/REUSE boundaries.
Do not expand scope into adjacent modules.
Do not redesign unrelated UI.
Do not invent missing Intelligence/business behavior.

After implementation run focused tests/typecheck/build appropriate to the changed boundary.

Return:
- files changed;
- behavior implemented;
- tests/build result;
- deviations from approved plan;
- genuine blockers;
- commit SHA if published.
```

### 10.6 VERIFY prompt wrapper

```text
VERIFY ONLY the recently implemented [SURFACE] migration.

Do not redesign.
Do not broaden product behavior.

Verify:
- canonical contract compliance;
- state/capability behavior;
- production routing/integration;
- read/write boundaries;
- loading/empty/error states;
- relevant tests;
- typecheck/build;
- runtime smoke where available.

Fix only defects directly within the approved migration scope.
Report architecture/product conflicts before changing frozen behavior.
```

### 10.7 VISUAL REFINE prompt wrapper

```text
The [SURFACE] is functionally integrated and verified.

Perform a targeted visual audit/refinement only.

Authority:
1. Design System 5.0;
2. approved Stitch reference for this surface, if supplied;
3. mature production primitives.

Do not change Campaign domain behavior, DTOs, lifecycle, hydration, capabilities or command semantics.

Audit typography, hierarchy, spacing, responsive behavior, CTA placement, breadcrumbs, cards, drawers, loading/empty/error presentation and component consistency.

Before broad changes, identify systematic issues and the smallest reusable-component fixes that resolve them.
```

## 11. Concrete scenario guidance

### Create Campaign

Use **ADAPT** prompts. Production form is baseline. Reconcile fields/runtime/validation; do not transplant staging UI.

### Campaign Page

Use **REPLACE** prompts. New Campaign IA/state architecture is baseline. Reuse production primitives. Separate functional migration from later visual refinement.

### Creator Card

Use **ADAPT** prompts. Start from production card, reconcile information hierarchy/actions. Replace only if audit proves structural incompatibility.

### Campaign Details

Use **ADD** prompts. Use production drawer primitive and canonical read contract.

### Discovery / Applicants

Use **REPLACE** prompts for workspace/container/state behavior, while explicitly asking Codex to identify production internals worth reusing.

### Share

Use **ADAPT** prompts. Preserve production journey/layout; replace obsolete execution/tracking semantics.

### Outreach

Use **ADAPT** prompts. Preserve composer UX; reconcile service-owned routing, identity, retry/idempotency and provider boundaries.

### Reporting

Use **REPLACE** prompts. Do not preserve the legacy SaaS reporting architecture. Preserve/reuse the new Campaign summary concept where appropriate; intelligence calculation remains outside frontend.

## 12. Production migration sequence

### Step 0 — Prepare references

Developer has access to:

- current production repository;
- current `dummy_tcs`;
- Design System 5.0 docs;
- AI engineering docs;
- relevant Campaign canonical contracts;
- approved Stitch references when introduced.

### Step 1 — Production reconnaissance

No code changes.

Codex audits production and confirms/corrects this playbook's surface matrix with evidence: production paths, `dummy_tcs` references, reusable primitives, contract gaps and KEEP/ADAPT/REPLACE/ADD classification.

### Step 2 — Backend/contracts/runtime reconciliation

Integrate the new Campaign contracts and executable boundaries into production using production infrastructure conventions.

Do not perform broad visual replacement here.

### Step 3 — ADAPT retained production workflows

Reconcile:

- Create Campaign;
- Edit Campaign;
- Add Product;
- Add Brief.

Preserve mature production UI while conforming to new contracts.

### Step 4 — REPLACE Campaign Page architecture

Bring the new Campaign Page IA/state/capability behavior into production. Reuse production shell and mature primitives. Do not perform final aesthetic redesign yet.

### Step 5 — Supporting surfaces

ADD/ADAPT:

- Campaign Details;
- Product Details;
- Brief Details;
- Creator Card;
- Creator Profile;
- Share;
- Outreach;
- Campaign Copilot shell/boundary.

### Step 6 — REPLACE operational workspaces/reporting

Reconcile:

- Discovery;
- Applicants;
- Reporting.

Preserve reusable production internals but not obsolete workflow/state architecture.

### Step 7 — End-to-end functional verification

Verify the complete supported Campaign journey against production infrastructure, including Create, Publish, Product/Brief readiness, LIVE Campaign Page, Discovery, Outreach, Applicants, Campaign actions, Reporting boundary and Edit/View, plus lifecycle/hydration variants.

### Step 8 — Design System 5.0 audit

Audit the integrated Campaign module for systematic DS5 deviations. Prefer reusable-component corrections over pixel-by-pixel patches.

### Step 9 — Targeted Stitch refinement

Only after functional integration and DS5 reconciliation, identify critical visually weak surfaces and create/import targeted Stitch references. Likely candidates include Campaign Page shell, Copilot, Creator Cards, Creator Profile and Campaign Details.

### Step 10 — Final regression / production readiness

Run final typecheck, tests, build, responsive/runtime verification and Campaign workflow regression before release.

## 13. Stop-and-escalate rules

Codex should stop and report before changing product architecture if:

- a canonical Campaign contract contradicts current production domain behavior in a way that is not a clear stale implementation;
- Prisma/storage genuinely cannot represent the canonical contract through an explicit mapping;
- a required Intelligence projection does not exist;
- ownership between Campaign and another module is genuinely unclear;
- the migration requires changing another module's business behavior;
- production exposes a materially different business workflow that conflicts with frozen Campaign architecture;
- a required business decision is missing from the canonical contracts.

Codex should **not** treat these as architecture blockers:

- different file names or folder decomposition;
- normal production-vs-staging component differences;
- minor Design System drift;
- stale field names with clear canonical replacements;
- ordinary TypeScript/refactoring work required for integration;
- absence of staging-only fixtures in production.

## 14. Design System and Stitch strategy

Do not use Stitch to redesign the entire Campaign module before production integration.

First achieve functional correctness in the real production environment. Then run a targeted Design System 5.0 audit. Only after that should Stitch be used for high-value surfaces that still require stronger visual direction.

An approved Stitch reference controls visual direction for that surface only. It does not override canonical Campaign behavior or create new business fields.

## 15. Existing developer handoff artifacts

This playbook sits above the lower-level Phase 1 and Phase 2 handoff lists:

- `campaign/phase_1_developer_handoff_files.md`
- `campaign/phase_2_developer_handoff_files.md`

Use those files for concrete ADD/REPLACE/reference file transfer guidance.

Phase 1 contains the Campaign module contract/runtime completion artifacts.

Phase 2 contains Bucket A logic/state correctness changes, staging-boundary guidance and deferred staging-toolchain notes.

## 16. Expected end state

The final Campaign module should neither look like the current staging scaffold nor simply preserve the old production Campaign module.

Target:

```text
Canonical Campaign contracts and behavior
+ new Campaign lifecycle/hydration/IA architecture
+ mature production implementation and infrastructure
+ Design System 5.0
+ targeted approved Stitch references
= production Campaign module
```

The migration is successful when production preserves its strongest mature frontend implementation where appropriate, replaces obsolete Campaign architecture where required, and no longer relies on staging visuals or old production behavior as accidental authority.