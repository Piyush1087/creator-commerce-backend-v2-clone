# Collaboration Phase G — Autonomous Agent Orchestration Playbook

**Purpose:** Allow the developer’s AI agent to take over the remaining Collaboration Phase G journey without waiting for Product to manually review every result and write the next prompt.

**Scope:** Starts with the result of **G1 Consolidated Local Functional Acceptance** and governs progression through **G2 → G3 → G4 → G5 → Deployment → G6 → G7**.

**Core rule:** The agent may automatically start the next phase only when the previous phase’s explicit exit gate is satisfied. If a product-policy ambiguity, authority conflict, source regression, unsafe environment condition, or acceptance failure appears, the agent must stop and return control to Product.

---

## 1. Operating Model

The agent operates as a gated state machine:

```text
G1 Consolidated Local Functional Acceptance
        ↓ if G2 entry = AUTHORIZED
G2.1 Surface & Ownership Freeze
        ↓
G2.2 Workspace Information Architecture Freeze
        ↓
G2.3 Submodule UX Freeze
        ↓
G2.4 Cross-Cutting State & Mobile Matrix
        ↓
G2.5 Stitch-Ready Authority Matrix
        ↓ if G2 accepted
G3 Stitch Visual Design
        ↓ if Stitch designs accepted
G4 Production UI Integration
        ↓
G5 Local Product Acceptance
        ↓ if accepted
Deployment
        ↓
G6 Staging Reconciliation
        ↓ if accepted
G7 Production Handoff / Closure
```

The agent must never skip a gate.

---

## 2. Global Automatic-Progression Rules

The agent may proceed automatically when all of the following are true:

1. The previous phase returned an accepted disposition.
2. The exact final frontend/backend SHAs are known.
3. The worktree/branch is clean or only contains explicitly authorized documentation changes.
4. No `SOURCE_REGRESSION` remains unresolved.
5. No `AUTHORITY_CONFLICT` remains unresolved.
6. No material `Product decision required: YES` remains.
7. No environment safety boundary was violated.
8. Deferred-owner work remains explicitly deferred rather than silently implemented.
9. The next phase’s allowed scope is already frozen in this playbook.

The agent must **STOP** and ask Product when any of these occur:

- New lifecycle or workflow semantics are required.
- A new financial/commercial rule is required.
- Ownership between modules is unclear.
- A new backend field/read model is needed and not already authorized.
- A new AI/Intelligence rule is required.
- Stitch output conflicts with canonical product behavior.
- A source defect cannot be fixed narrowly within the current phase.
- A migration blocker is discovered.
- Staging behavior contradicts accepted local behavior for reasons not understood.
- Production deployment would require unsafe credentials or real external side effects.

---

## 3. Inputs Expected from G1 Consolidated Local Functional Acceptance

Before G2 can start, the agent must parse and record the result of:

`docs/collaboration/phase-g/10_g1_consolidated_local_functional_acceptance.md`

Minimum required output:

```text
G1 consolidated status:
Starting frontend SHA:
Final frontend SHA:
Starting backend SHA:
Final backend SHA:

Local environment:
Database:
Brand QA:
Creator QA:

Access/deep-link:
Messaging lifecycle:
Error/recovery:
Realtime:
Creator cancellation:
Fulfillment:
Counterpart context:
Bank/securement:
Production/Publishing smoke:
Completion/Feedback:
Refresh/re-entry:
Mobile:

Frontend tests:
Backend Collaboration tests:
Frontend typecheck/lint/build:
Backend typecheck/lint/build/Prisma:

Source regressions found:
Source regressions corrected:
Environment blockers:
Provider/deferred limitations:

G1R debt carried:
Deferred owners carried:
Visual debt moved to G2:

G2 entry:
AUTHORIZED / NOT AUTHORIZED

Final frontend Phase-G SHA:
Final backend Phase-G SHA:

Documentation commit SHA:
```

### G2 start condition

Proceed to **G2.1 automatically only if**:

```text
G1 consolidated status = ACCEPTED
or
G1 consolidated status = ACCEPTED WITH DEBT
```

AND:

```text
G2 entry = AUTHORIZED
```

AND:

- there is no unresolved functional `SOURCE_REGRESSION`;
- remaining debt is only engineering debt, provider limitation, deferred owner, or visual debt explicitly allowed to move into G2.

If `G2 entry = NOT AUTHORIZED`, stop and report the blocking findings.

---

# 4. G2 — UX / Information Architecture Freeze

G2 is a Product/UX-definition phase.

**No Stitch generation and no visual redesign implementation during G2.**

The agent may create/update documentation only unless a tiny documentation-supporting source inspection is needed.

## G2.1 — Collaboration Surface & Ownership Freeze

### Objective

Freeze the final surface map and ownership model.

Required surfaces:

- Collaboration Inbox/List
- Collaboration Workspace
- Collaboration Header/Summary
- Chat/Messages
- Counterpart Context
- Negotiation
- Securement
- Fulfillment
- Production
- Publishing
- Compliance
- Resolution
- Settlement
- Completion
- Feedback
- Creator Cancellation
- Realtime-Degraded State
- Legacy Compatibility
- Mobile Navigation

For every surface freeze:

- Purpose
- Canonical owner
- Read authority
- Mutation authority
- Capability authority
- Brand/Creator applicability
- What information belongs here
- What belongs elsewhere
- Deferred functionality

### Output

Create:

`docs/collaboration/phase-g/11_g2_1_surface_ownership_freeze.md`

### Exit gate

Proceed automatically to G2.2 only if:

- every surface has one explicit owner;
- no unresolved authority conflict remains;
- no new backend/product rule is required.

Otherwise stop.

---

## G2.2 — Collaboration Workspace Information Architecture Freeze

### Objective

Freeze how the full Collaboration workspace is organized.

The agent must decide and document:

- page/header hierarchy;
- Inbox vs active Collaboration relationship;
- Chat vs Execution prominence;
- progress/stage navigation;
- Campaign/Asset/Brief context placement;
- counterpart context pattern;
- active vs terminal layout;
- Brand vs Creator differences;
- desktop 3-pane / alternate layout behavior;
- mobile step navigation.

The agent must not invent new lifecycle stages.

### Output

Create:

`docs/collaboration/phase-g/12_g2_2_workspace_ia_freeze.md`

Include a final textual wireframe/hierarchy for desktop and mobile.

### Exit gate

Proceed automatically to G2.3 when:

- information hierarchy is complete;
- all major surfaces have a clear place;
- mobile navigation is defined;
- no unresolved product decision remains.

---

## G2.3 — Submodule UX Freeze

### Objective

Freeze the functional UX for each execution submodule.

Submodules:

- Negotiation
- Securement
- Fulfillment
- Production
- Publishing
- Compliance
- Resolution
- Settlement
- Completion
- Feedback

For each freeze:

- primary information;
- primary CTA;
- secondary actions;
- capability-driven disabled/read-only behavior;
- form/control types;
- confirmation patterns;
- progress/status presentation;
- drawers/modals/sheets;
- Brand variant;
- Creator variant;
- terminal variant;
- deferred functionality.

### Output

Create:

`docs/collaboration/phase-g/13_g2_3_submodule_ux_freeze.md`

### Exit gate

Proceed automatically to G2.4 only when every submodule above has a frozen functional presentation contract.

---

## G2.4 — Cross-Cutting State & Mobile Matrix

### Objective

Freeze states that cut across all submodules.

At minimum:

- initial loading;
- background refetch;
- empty Inbox;
- no messages;
- command processing;
- command failure;
- read failure;
- contract failure;
- unavailable/no-access;
- realtime degraded;
- realtime restored;
- compatibility-limited;
- action unavailable;
- paused/read-only;
- cancelled;
- terminated;
- completed;
- provider unavailable;
- settlement deferred;
- mobile narrow viewport;
- tablet/intermediate viewport;
- keyboard/composer behavior;
- drawer/sheet behavior;
- refresh/re-entry.

For each state define:

- what remains visible;
- user-facing copy intent;
- recovery action;
- primary/secondary actions;
- desktop treatment;
- mobile treatment;
- whether Stitch must design a variant.

### Output

Create:

`docs/collaboration/phase-g/14_g2_4_state_mobile_matrix.md`

### Exit gate

Proceed automatically to G2.5 when all material states are represented and no functional state is left for Stitch to invent.

---

## G2.5 — Stitch-Ready Authority Matrix

### Objective

Convert G2 into a design-execution contract.

For every Stitch target include:

| Dimension | Required |
|---|---|
| Purpose | Why it exists |
| Data authority | Canonical source |
| Information hierarchy | What is seen first |
| Primary actions | Allowed actions |
| Interaction pattern | Card/panel/drawer/sheet/etc. |
| Required states | Variants Stitch must design |
| Brand/Creator variant | Differences |
| Mobile behavior | Responsive contract |
| Deferred functionality | What Stitch must not invent |

Expected Stitch targets:

1. Collaboration Workspace shell
2. Collaboration Header
3. Inbox/Collaboration cards
4. Chat pane
5. Counterpart Context drawer
6. Execution progress/navigation
7. Negotiation panel
8. Securement panel
9. Fulfillment panel
10. Production/Deliverable cards
11. Publishing/Compliance cards
12. Resolution state
13. Settlement state
14. Completion/Feedback
15. Loading/empty/error/degraded variants
16. Mobile Collaboration workspace

### Output

Create:

`docs/collaboration/phase-g/15_g2_5_stitch_ready_authority_matrix.md`

and:

`docs/collaboration/phase-g/16_g2_acceptance_summary.md`

### G2 exit gate

G2 is accepted only if:

- no unresolved product decision remains;
- no lifecycle/ownership/financial semantics are delegated to Stitch;
- all major mobile and state variants are frozen;
- Stitch targets are explicit.

If accepted, automatically proceed to G3.

If not, stop and report `G2_NOT_ACCEPTED`.

---

# 5. G3 — Stitch Visual Design

## Objective

Generate visual designs only for the G2-approved targets.

Stitch receives:

- Aurora Design System
- current app shell
- G2.5 authority matrix
- required state variants
- existing production component boundaries
- exact “must not invent” rules

Stitch must not redefine:

- lifecycle;
- stage semantics;
- availableActions;
- financial ownership;
- bank ownership;
- Fulfillment taxonomy;
- settlement ownership;
- counterpart data ownership;
- deferred Intelligence;
- provider behavior.

## Stitch execution strategy

Prefer component families and state variants over one screen per state.

For each Stitch output, the agent must review:

1. Does it match G2 hierarchy?
2. Does it preserve canonical actions/states?
3. Does it use Aurora language?
4. Does it introduce fake data/metrics?
5. Does it create a second workflow/state model?
6. Is mobile behavior consistent with G2?

Reject and regenerate any output that violates G2.

### Output

Create:

`docs/collaboration/phase-g/17_g3_stitch_design_register.md`

Record for each design:

- target;
- Stitch prompt/version;
- generated artifact/reference;
- accepted/rejected;
- rejection reason if any;
- final approved design reference.

### G3 exit gate

Proceed to G4 only when every required Stitch target has an accepted design or is explicitly marked “reuse existing UI — no redesign required”.

---

# 6. G4 — Production UI Integration

## Objective

Integrate approved Stitch design into existing canonical production components.

Default rule:

```text
Existing canonical component
+ approved Stitch visual reference
+ Aurora primitives
→ reconciled production component
```

Do **not** wholesale replace canonical runtime components with Stitch-generated architecture.

The agent must preserve:

- G1 contracts;
- Zod/read validation;
- capability authority;
- existing API clients;
- runtime tests;
- backend ownership;
- compatibility boundaries.

### Implementation packaging

The agent may split G4 into subpackages if needed, for example:

- G4A Workspace/Header/Inbox/Chat
- G4B Execution panels
- G4C Terminal/Feedback/State variants
- G4D Mobile/responsive reconciliation

Each package must have its own tests/build/acceptance record.

### Output

Create/update production source and:

`docs/collaboration/phase-g/18_g4_ui_integration_acceptance.md`

### G4 exit gate

Proceed to G5 only if:

- source tests pass;
- typecheck/lint/build pass;
- no G1 contract regression is detected;
- approved Stitch designs are materially represented;
- no known functional source defect remains.

---

# 7. G5 — Local Product Acceptance

## Objective

Validate the complete Collaboration product locally after visual integration.

Run real Brand and Creator flows against the isolated local DB.

Verify:

- Brand route and Creator route;
- Inbox/list;
- deep links;
- Chat;
- active/read-only messaging;
- realtime degradation;
- cancellation;
- Negotiation;
- Securement;
- Fulfillment;
- Production;
- Publishing;
- Compliance;
- Resolution;
- Settlement truthfulness;
- Completion;
- Feedback;
- counterpart context;
- bank readiness;
- refresh/re-entry;
- compatibility-limited state;
- desktop;
- tablet;
- mobile;
- loading/empty/error variants.

Also perform visual comparison against accepted Stitch references.

### Output

Create:

`docs/collaboration/phase-g/19_g5_local_product_acceptance.md`

### Exit gate

Proceed to Deployment only if:

- no unresolved functional source regression;
- no high-severity visual mismatch;
- responsive/mobile acceptance passes;
- only explicitly accepted debt/deferred owners remain.

Result:

`G5_ACCEPTED_FOR_DEPLOYMENT`

or stop.

---

# 8. Deployment Gate

## Objective

Deploy the exact G5-accepted SHAs.

Before deployment record:

- frontend SHA;
- backend SHA;
- migrations;
- environment-variable requirements;
- provider configuration;
- rollback SHA.

Do not deploy a branch tip that differs from the G5-accepted SHA.

### Output

Create:

`docs/collaboration/phase-g/20_deployment_record.md`

If deployment succeeds, proceed automatically to G6.

---

# 9. G6 — Staging Reconciliation

## Objective

Compare accepted local behavior with staging.

Classify differences as:

- SOURCE_REGRESSION
- AUTH_ENVIRONMENT
- API_ROUTING
- DATABASE_MIGRATION
- DATA_BACKFILL
- PROVIDER_CONFIGURATION
- ASSET_CDN
- CORS
- SOCKET_REALTIME
- BROWSER_RESPONSIVE
- REAL_DATA_EDGE_CASE
- INFRASTRUCTURE

Do not “fix the UI” to compensate for environment defects.

For each staging issue:

1. reproduce;
2. classify;
3. identify owner;
4. fix narrowly;
5. rerun affected local/source checks;
6. redeploy if source changed;
7. reverify staging.

### Output

Create:

`docs/collaboration/phase-g/21_g6_staging_reconciliation.md`

### Exit gate

Proceed to G7 only if:

- no unresolved P0/P1 staging issue remains;
- production-like auth/API/socket behavior is correct;
- migrations/data are aligned;
- accepted product behavior is preserved.

---

# 10. G7 — Production Handoff / Closure

## Objective

Freeze Collaboration as the production baseline.

Record:

- final frontend SHA;
- final backend SHA;
- migration status;
- deployment/environment configuration;
- QA accounts used;
- G1/G2/G3/G4/G5/G6 evidence;
- deferred owners;
- known debt;
- rollback point;
- post-deployment smoke checklist;
- ownership of future enhancements.

### Output

Create:

`docs/collaboration/phase-g/22_g7_production_handoff_closure.md`

### Final result

Return:

```text
COLLABORATION PHASE G: COMPLETE
Final frontend SHA:
Final backend SHA:
Production baseline:
Outstanding debt:
Deferred owners:
Rollback point:
```

---

# 11. Required Result Format at Every Phase

Every phase/subphase must end with:

```text
Phase:
Status:

Starting frontend SHA:
Final frontend SHA:
Starting backend SHA:
Final backend SHA:

Scope completed:
Acceptance gates:
Tests:
Typecheck/lint/build:
Runtime/browser acceptance:
Environment used:

Source regressions:
Authority conflicts:
Product decisions required:
Deferred owners:
Debt carried:

Files created/changed:
Documentation file:
Commit SHA:

Next phase:
AUTO-PROCEED / STOP
Reason:
```

The `Next phase` field is the trigger for autonomous progression.

---

# 12. Autonomous Progression Logic

Pseudo-rule:

```text
if status in {ACCEPTED, ACCEPTED_WITH_DEBT}
and no unresolved SOURCE_REGRESSION
and no AUTHORITY_CONFLICT
and no Product decision required
and next_phase_gate == satisfied:
    commit current phase
    verify remote/persisted SHA
    begin next phase
else:
    STOP
    return blocker package to Product
```

The agent must not reinterpret `ACCEPTED WITH DEBT` as permission to ignore debt. Debt must be carried forward until explicitly closed or moved to a deferred-owner register.

---

# 13. Initiation Prompt

Use this prompt after G1 Consolidated Local Functional Acceptance has completed.

```text
You are now the autonomous Phase G orchestration agent for Creator Shop Collaboration.

Your job is to take over the remaining Phase G journey from the point immediately after G1 Consolidated Local Functional Acceptance.

Read first:

1. dummy_tcs/docs/engineering/PHASE_G_PRODUCT_READINESS_STANDARD.md
2. dummy_tcs/collaboration/phase_g/agent_context_manifest.md
3. the attached/mounted document:
   Collaboration Phase G — Autonomous Agent Orchestration Playbook
4. frontend docs/collaboration/phase-g/10_g1_consolidated_local_functional_acceptance.md
5. all prior accepted Collaboration Phase G records required for traceability.

FIRST TASK

Parse the G1 consolidated acceptance result.

Confirm:

- final accepted frontend SHA;
- final accepted backend SHA;
- G1 consolidated status;
- G2 entry status;
- unresolved source regressions;
- remaining environment blockers;
- G1R debt;
- deferred owners;
- visual debt explicitly moved to G2.

If:

G2 entry = AUTHORIZED

and there is no unresolved functional SOURCE_REGRESSION or AUTHORITY_CONFLICT:

begin G2.1 automatically.

From that point onward:

- follow the Autonomous Agent Orchestration Playbook exactly;
- start the next phase automatically only when the prior exit gate is satisfied;
- create the required phase document before progressing;
- commit accepted work and record exact SHAs;
- never merge automatically unless a later explicit deployment instruction authorizes it;
- never invoke Stitch before G2.5 is accepted;
- never change canonical lifecycle, ownership, financial semantics or Product policy without stopping for Product;
- never use production infrastructure for local acceptance;
- carry all accepted debt and deferred owners forward;
- stop immediately when the playbook says Product intervention is required.

At the end of every phase return the standard phase result format, including:

Next phase:
AUTO-PROCEED / STOP

If AUTO-PROCEED, continue directly into the next phase without waiting for another human prompt.

If STOP, provide the smallest Product decision/blocker package required to resume.

Do not ask for confirmation between accepted phases.

Begin by reading the G1 consolidated acceptance record and evaluating the G2 entry gate.
```

---

# 14. Expected Starting Result When the Initiation Prompt Runs

The initiation run should first return something like:

```text
G1 Consolidated Gate Review

Status:
ACCEPTED / ACCEPTED WITH DEBT / NOT ACCEPTED

Final frontend SHA:
<sha>

Final backend SHA:
<sha>

G2 entry:
AUTHORIZED / NOT AUTHORIZED

Unresolved source regressions:
None / list

Authority conflicts:
None / list

Runtime environment blockers:
None / list

G1R debt carried:
- Brand-UCE formatting debt
- missing dedicated approve integration test

Deferred owners:
- Payout/Escrow settlement adapter
- relationship-history
- richer Intelligence
- provider/scheduler dependencies previously frozen

Visual debt moving to G2:
<summary>

Next phase:
AUTO-PROCEED → G2.1
```

If that gate is satisfied, the agent should start G2.1 immediately without asking Product for another prompt.

---

# 15. Safety Principle

The agent is autonomous over **execution**, not over **Product policy**.

It may:

- inspect;
- classify;
- document;
- implement already-frozen behavior;
- design within frozen UX authority;
- test;
- commit;
- advance through accepted gates.

It may not autonomously invent:

- new lifecycle semantics;
- new domain ownership;
- new commercial/financial policy;
- new Intelligence logic;
- new provider architecture;
- new privacy policy;
- new migration policy with production impact.

When one of those is required, autonomy ends and Product review resumes.
