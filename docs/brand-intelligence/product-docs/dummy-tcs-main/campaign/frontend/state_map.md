# Creator Shop Campaign Frontend — State Map

**Version:** 1.0  
**Status:** CANONICAL / PHASE 6  
**Module:** Campaign

## 1. Purpose

This artifact is the implementation-facing inventory of Campaign UI/runtime states that a frontend engineer or coding agent must support.

It translates frozen Campaign domain/runtime contracts into a frontend coverage map. It does **not** create new persisted Campaign states, backend lifecycle rules, or visual design rules.

Visual implementation is governed by `docs/design-system/AURORA_DESIGN_SYSTEM.md`. Detailed domain behavior remains governed by Campaign canonical contracts.

## 2. State Dimensions

Do not treat every combination below as a separate designed screen. Campaign UI is composed from orthogonal dimensions:

1. Campaign lifecycle/hydration outcome;
2. execution readiness;
3. instantiated workspaces;
4. primary operational priority;
5. workspace-local state;
6. capability/integration state (for example Meta availability);
7. Intelligence availability;
8. transient frontend state (loading/error/modal/selection);
9. viewport presentation.

Stitch references should cover representative materially different compositions. The coding agent derives the remaining combinations from these canonical dimensions.

## 3. Canonical Campaign Page Hydration Outcomes

The frozen Campaign Page contract defines nine deterministic hydration outcomes plus a post-live readiness blocking condition.

### STATE 1 — Product Setup

- Lifecycle: `PUBLISHED`.
- Entry: no active Campaign Asset/Product path.
- Primary focus: Product.
- Primary action: Add Product.
- Product/Brief setup is prominent.
- Discovery, Applicants, Collaboration references and Reporting are hidden.
- Share is disabled.
- Exit when an active Campaign Asset exists.

**Stitch need:** materially useful reference because setup composition differs from operational Campaign Page.

### STATE 2 — Brief Setup

- Lifecycle: `PUBLISHED`.
- Entry: active Campaign Asset exists but Campaign is not execution-ready.
- Primary focus: Brief.
- Primary action: Add Brief.
- Product/Brief setup remains prominent.
- Operational workspaces remain hidden.
- Reporting hidden; Share disabled.
- Exit when execution readiness becomes true; lifecycle transitions to `LIVE`.

**Stitch need:** optional if Add Brief composition is sufficiently represented by focused Add Brief UI plus State 1; otherwise useful.

### STATE 3 — Creator Acquisition Setup

- Lifecycle: `LIVE`.
- Requires execution readiness.
- Entry: no active prospects, Applications or independently owned Collaboration references.
- Primary focus: Discovery.
- Product/Brief context moves to background/compact context.
- Discovery is prominent.
- Applicants/Collaboration references are absent until instantiated.
- Reporting available.
- Share enabled.

**Stitch need:** strong candidate for an empty operational state.

### STATE 4 — Discovery Active

- Lifecycle: `LIVE` and execution-ready.
- Candidate when active prospects exist.
- Discovery may become primary focus through the Priority Engine.
- Applicants/Collaboration references remain visible when already instantiated.
- Reporting available.

**Stitch need:** **recommended primary information-rich stable desktop reference** because it can exercise Campaign shell, Product/Brief context, workspace content, actions and Reporting simultaneously.

### STATE 5 — Applications Active

- Lifecycle: `LIVE`.
- Candidate when pending Applications exist.
- Applicants may become primary focus through the Priority Engine.
- Discovery remains normal when execution-ready.
- Collaboration references remain visible only if independently instantiated.
- Reporting available.

**Stitch need:** useful if Applicants layout materially differs from Discovery; otherwise workspace-specific reference can be supplied separately.

### STATE 6 — Collaborations Active

- Lifecycle: `LIVE`.
- Candidate when independently owned active Collaboration entities exist.
- Campaign may map the Collaboration workspace/reference into its shell.

**Phase 6 implementation restriction:** Collaboration is an independent module and is not currently being designed. Do not implement Collaboration domain logic from this state. If a visual reference exists, treat it only as future shell/workspace-placement context.

### STATE 7 — Mature Campaign

- Lifecycle: `LIVE`.
- Candidate when meaningful optimization Intelligence is available.
- Reporting/Intelligence may become the primary operational focus through the Priority Engine.

**Stitch need:** not required for initial shell if the Reporting card and its prominence rules can be derived from the stable operational reference.

### STATE 8 — Paused Campaign

- Lifecycle: `PAUSED`.
- Override state.
- Primary focus: resume/existing execution.
- New Discovery disabled.
- New Applications disabled.
- Share disabled.
- Existing instantiated Applicants/Collaboration references remain visible.
- Reporting remains available.
- Intelligence remains available when provider output exists.

**Stitch need:** useful if disabled/paused presentation materially changes hierarchy; otherwise derive from stable state plus Design System disabled/status patterns.

### STATE 9 — Historical Campaign

- Lifecycle: `COMPLETED` or `ARCHIVED`.
- Override state.
- Primary focus: review/reporting.
- Operational CTAs hidden.
- Product/Brief context is historical/compact.
- Historically instantiated workspaces may remain reviewable.
- Reporting is prominent.

**Stitch need:** useful later; not required to begin implementation.

### Post-live Readiness Block

This is **not State 10**.

- Entry: lifecycle is `LIVE` but execution readiness is lost.
- Primary focus: restore Campaign readiness.
- If no active Asset/Product path: Add/Resume Product.
- If active Asset exists but no valid active Brief path: Add/Resume Brief.
- New Discovery, new Applications and Share are disabled.
- Existing instantiated workspaces remain visible.
- Reporting remains available.
- Campaign does not automatically transition lifecycle solely because readiness was lost.

## 4. Workspace Instantiation Rules

### Discovery

Discovery is available for a live execution-ready Campaign, or may remain historically represented according to the Campaign Page contract.

Meta connection/capability modifies Discovery marketplace behavior; it does **not** create another Campaign hydration state.

### Applicants

Applicants workspace is instantiated once any Application exists for the Campaign. It remains instantiated even when pending Application count becomes zero.

Applicant Intelligence states include:

- `PROCESSING`;
- `READY`;
- `UNAVAILABLE`.

These affect Applicant presentation, not Campaign lifecycle. Applicant Intelligence must not block Brand Approve/Reject actions.

### Collaborations

Collaboration workspace/reference is instantiated only from independently owned Collaboration entities. Campaign frontend must not synthesize Collaboration state from approved Applications.

## 5. Discovery / Prospect UI State Coverage

The Discovery/Prospects surface should support, as applicable to focused contracts:

- initial/empty acquisition state;
- populated prospect list;
- manually added creator;
- duplicate manual-add rejection/error from backend;
- creator sourced through marketplace/recommendation context;
- selected creator(s) / selection mode;
- Outreach available;
- Outreach already initiated;
- backend-resolved Email path;
- backend-resolved Priority DM path;
- Meta capability connected/available;
- Meta capability unavailable/not connected;
- loading;
- recoverable error;
- no-results/empty result where distinct from first-time setup.

Do not turn Email vs Priority DM into a user-selectable canonical channel choice.

## 6. Outreach Interaction State Coverage

Composer input supports Brand free-form instruction.

Frontend states may include:

- composer closed;
- composing/loading generated content;
- composed content ready;
- Email presentation;
- Priority DM presentation;
- Email initiation attempt 1/2/3 where backend permits;
- Email attempt limit reached;
- Priority DM accepted/scheduled representation where exposed by backend;
- execution/provider failure where exposed;
- command in-flight/duplicate-click prevention;
- backend conflict/quota/pacing error presentation.

Email and Priority DM content are not required to be identical.

Daily Outreach capacity and Priority DM pacing are backend-owned; UI should not independently calculate canonical remaining eligibility unless the backend explicitly returns a projection.

## 7. Applicants UI State Coverage

Support at minimum the states represented by the frozen Applicants contracts and eventual View DTO:

- Applicants workspace not yet instantiated;
- pending Application(s);
- Applicant Intelligence `PROCESSING`;
- Applicant Intelligence `READY`;
- Applicant Intelligence `UNAVAILABLE`;
- approved Application;
- rejected Application;
- withdrawn/expired/other terminal states where present in canonical contracts;
- no pending Applications but historical Applicants remain;
- action in-flight;
- concurrency/conflict response after another terminal action already won.

Do not infer Collaboration creation/behavior after approval.

## 8. Reporting UI State Coverage

MVP Campaign Page owns one Campaign-facing Reporting card behavior.

Support:

- Reporting unavailable/hidden during pre-live setup where contract requires;
- Reporting available but no publishable calculation/result yet;
- Reporting result available;
- Reporting/Intelligence unavailable/degraded where returned by the owning capability;
- mature Campaign where Reporting becomes primary/prominent;
- historical Campaign where Reporting is prominent;
- `View full report` action opening the appropriate detail surface.

The full Reporting UI is outside current Phase 6 scope. The frontend must not calculate Reporting values.

## 9. Share UI State Coverage

Support:

- Share disabled when Campaign contract disallows it;
- Share enabled;
- Share modal/popup closed/open;
- channel selection;
- auto-composed message ready;
- tracked Campaign link ready;
- Copy Link action;
- supported external share action(s) defined by the Share contract;
- action in-flight;
- repeated intentional Share action;
- error/retry presentation.

Tracking token is server-owned. Repeated intentional Shares must not be collapsed merely because Campaign/channel match.

Link preview/image may use supplied Campaign/Product/Brand visual context; it is presentation metadata, not a new Campaign lifecycle state.

## 10. Product / Brief UI State Coverage

Support the Campaign Page setup/context distinctions:

- no Product → Add Product primary setup;
- Product exists, no execution-ready Brief path → Add Brief primary setup;
- execution-ready Product/Brief context → compact/background context;
- multiple Products;
- multiple Briefs per Product;
- active/inactive/historical context according to canonical contracts;
- manual vs AI-recommended creation-source behavior where it changes editability;
- post-live readiness restoration.

Detailed Add Product/Add Brief field behavior remains governed by focused contracts and executable validation.

## 11. Campaign Header / Lifecycle UI State Coverage

Header must be able to represent canonical lifecycle:

- `PUBLISHED`;
- `LIVE`;
- `PAUSED`;
- `COMPLETED`;
- `ARCHIVED`.

`DRAFT` primarily belongs to Campaign creation/edit flows rather than the operational Campaign Page unless a focused contract says otherwise.

Actions/capabilities may include Edit Campaign, Share, Pause/Resume, Campaign Details and Archive when applicable. Availability must be backend/domain-derived rather than inferred from viewport.

## 12. Transient Frontend States

Every materially asynchronous surface should define presentation for:

- initial loading/hydration;
- partial/loading sub-surface where architecture permits;
- success;
- empty;
- recoverable error;
- non-recoverable/permission/not-found state where relevant;
- mutation in-flight;
- backend validation/domain conflict;
- stale response/refetch where the production data layer requires it.

Do not create persisted domain statuses to represent transient UI states.

## 13. Responsive State Mapping

Desktop, tablet and mobile are presentations of the same domain state.

### Desktop

- orchestration-rich composition;
- context may coexist;
- workspace navigation may use tabs or equivalent Design System pattern;
- detail surfaces may use drawer/modal.

### Tablet

- progressive disclosure;
- normal surfaces remain accessible but need not be simultaneously visible;
- detail surfaces may use wider overlay/modal patterns.

### Mobile

- focus-first execution;
- campaign name/status/primary action remain direct;
- secondary Campaign actions may move into progressive disclosure;
- Product/Brief execution-ready context may become a summary entry;
- detail/reporting surfaces may become full-screen;
- all instantiated workspaces remain reachable.

Viewport must never change permissions, business validation, editability, Share availability, lifecycle or Intelligence meaning.

## 14. Recommended Stitch Reference Set

The frontend does **not** require a Stitch screen for every state.

Recommended starting references:

1. **Desktop — STATE 4 Discovery Active / populated stable Campaign**: primary structural reference with maximum useful shell/component coverage.
2. **Mobile — same semantic STATE 4**: establishes responsive hierarchy and component adaptation.
3. **Desktop — STATE 3 Creator Acquisition Setup / empty operational state**: establishes empty-state behavior.
4. **Desktop — STATE 1 Product Setup**: establishes pre-live setup hierarchy.
5. **Applicants populated state** if its workspace composition is materially different from Discovery.
6. **Share modal** if not already represented in another supplied screen.
7. **Paused or Historical state** only if its visual treatment cannot be reliably derived from Design System + canonical contracts.

Seven or eight high-quality Stitch states are acceptable if they represent genuinely different compositions. More screens are not inherently better; avoid near-duplicate references that can cause the coding agent to treat each screenshot as a separate architecture.

## 15. Stitch Reference Registry

Populate this section when Stitch MCP references are available.

| Canonical state/surface | Stitch reference | Desktop/Mobile | Status | Notes |
|---|---|---|---|---|
| STATE 4 Discovery Active | TBD | Desktop | REQUIRED PRIMARY | Information-rich stable reference |
| STATE 4 Discovery Active | TBD | Mobile | REQUIRED | Same semantic state as desktop |
| STATE 3 Creator Acquisition Setup | TBD | Desktop | RECOMMENDED | Empty operational state |
| STATE 1 Product Setup | TBD | Desktop | RECOMMENDED | Pre-live setup hierarchy |
| Applicants populated | TBD | TBD | OPTIONAL/RECOMMENDED | If materially distinct |
| Share modal | TBD | TBD | OPTIONAL/RECOMMENDED | If not covered elsewhere |
| Paused/Historical | TBD | TBD | OPTIONAL | Only if visual treatment needs reference |

## 16. Deferred Until Frontend ↔ Backend Wiring

The following are intentionally not frozen in this state map:

- exact API/View DTO names;
- endpoint paths;
- concrete frontend query/cache states from the production data library;
- exact machine-readable error codes;
- exact component filenames;
- exact Stitch reference IDs;
- full Reporting view states;
- Collaboration workspace internals.

These should be reconciled from the actual UI and production architecture rather than guessed in Phase 6.