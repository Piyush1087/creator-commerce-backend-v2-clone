# Campaign Page Design Specification v2

**Status:** CANONICAL / PHASE 6
**Module:** Campaign

## 1. Purpose

This document defines the Campaign Page information architecture, responsive interaction model, visual hierarchy and presentation rules for Stitch and frontend implementation.

It governs presentation and interaction. Campaign business truth remains governed by the canonical Campaign contracts, `campaign/frontend/implementation_map.md`, `campaign/frontend/state_map.md`, and the backend/domain contracts.

## 2. Application Shell Boundary

The Creator Shop Application Shell is platform-owned and already exists under `frontend/layout/app_shell/`.

Campaign must render only inside the shell Content Area.

Campaign must not recreate or redesign:

- desktop sidebar;
- desktop header;
- mobile header;
- mobile bottom navigation;
- mobile hamburger navigation;
- global branding/navigation.

## 3. Campaign Page Information Architecture

The operational Campaign Page consists of:

1. Campaign Header
2. Campaign Copilot
3. Performance
4. Products & Briefs
5. Discovery
6. Applicants
7. Collaborations (future/independently owned)

The page is an operational command centre, not a generic analytics dashboard or CRM.

Only one operational section may be expanded at a time on mobile. Expanded operational sections use a defined viewport-height container with internal scrolling.

## 4. Campaign Header

The header remains visible and contains:

- Campaign name
- Lifecycle/status
- View action
- Edit action
- Share action
- Product count
- Brief count

Products and Briefs are represented compactly in the header, for example `2 Products · 5 Briefs` with an expand affordance.

When expanded, show only:

- product names;
- brief names grouped under their product;
- Add Brief;
- Add Product.

Do not show brief details inline. Clicking a product opens Product Details. Clicking a brief opens Brief Details.

## 5. Detail Surfaces

Detailed business information is not duplicated inline on the Campaign Page.

The following are drawer/modal surfaces:

- Campaign Details — View action
- Product Details — product interaction
- Brief Details — brief interaction
- Reporting — reporting action/card
- Creator Profile — creator card interaction
- Collaboration Card/Details — future Collaboration module

A drawer is used to understand/inspect an entity. A quick modal is used to complete a focused review/task.

## 6. Campaign Copilot

Campaign Copilot contains:

- concise AI summary;
- 3–4 campaign-level priority actions.

Campaign Copilot actions are distinct from detailed performance actions.

Priority actions should identify an actionable opportunity and provide a concise CTA.

Example:

`8 new creators found for the campaign` → `Review`

The Review action opens a quick modal containing creator cards — a micro-view of the Discovery workspace without its workspace header/navigation elements. The user can inspect creators and then open the full workspace when appropriate.

Copilot must not invent reporting calculations or duplicate the detailed Reporting surface.

## 7. Performance

Do not use a separate Campaign Health score. Performance should communicate state through semantic metric status treatment (success, attention, critical, neutral) rather than a composite health label.

The collapsed Performance summary should expose a compact set of high-value metrics, including where available:

- budget / budget status;
- primary KPI;
- completed collaborations;
- selected campaign performance metrics.

The detailed Reporting surface is opened through the Reporting interaction and is owned by the Creator Shop Intelligence/Reporting framework. Campaign frontend renders the supplied projection and does not calculate it.

## 8. Products & Briefs

The page header uses a compact summary such as:

`2 Products · 5 Briefs  <expand>`

Expanded presentation:

```text
Product A
  Brief A1
  Brief A2
  Add Brief
Product B
  Brief B1
  Brief B2
  Brief B3
  Add Brief
Add Product
```

Only names are shown inline. No brief description, deliverables or commercial details are shown inline.

## 9. Operational Workspaces

Discovery, Applicants and future Collaborations use the same workspace interaction pattern.

Collapsed:

- section name;
- one concise operational count/summary;
- expand affordance.

Expanded:

- workspace header;
- relevant filter/control;
- scrollable body;
- creator/entity cards.

Only one operational workspace is expanded at a time on mobile.

### Discovery

Used for creator discovery and outreach.

Example collapsed summary:

`Discovery · 8 New`

Expanded content may include filters and Creator Cards. Creator detail belongs in the Creator Profile drawer.

### Applicants

Used for reviewing applicants.

Example:

`Applicants · 12 Pending`

Expanded content may include filters and Applicant/Creator Cards. Creator detail belongs in the Creator Profile drawer.

### Collaborations

Future. Collaboration is independently owned and must not be invented or synthesized from Campaign approval state.

## 10. Creator Card

Creator Card is a reusable component shared across Discovery and Applicants and quick-review surfaces.

Mobile cards should be compact and optimized for scanning. Typical information includes:

- avatar;
- creator name/category;
- a small set of relevant metrics;
- match/eligibility context when supplied;
- primary and secondary action.

Detailed creator information opens in Creator Profile.

## 11. Interaction Hierarchy

Every interaction belongs to one of four levels:

### Level 1 — Stay on page

Examples:

- expand/collapse;
- filters;
- selection.

### Level 2 — Quick task

Examples:

- Review new creators;
- Review applicants;
- focused Copilot actions.

These use quick modals.

### Level 3 — Detailed inspection

Examples:

- Campaign Details;
- Product Details;
- Brief Details;
- Creator Profile;
- Reporting.

These use drawers or the appropriate detail surface.

### Level 4 — Full workflow

Examples:

- Edit Campaign;
- Add Product;
- Add Brief.

## 12. Mobile Rules

Mobile is the primary optimization focus for the operational Campaign Page.

The UI should use as little wording as possible while retaining clarity.

The global mobile footer/bottom navigation remains platform-owned.

The Campaign Page should prioritize:

1. Campaign Header
2. Copilot
3. compact Performance summary
4. Products & Briefs summary
5. one expanded operational workspace

Expanded workspace target: approximately 55–60% of the available viewport, with internal scrolling.

Do not turn the Campaign Page into tabs merely to solve density. The section model remains visible as collapsible sections; the expanded section provides the operational work surface.

## 13. Desktop Rules

Desktop has more available space but should remain clean.

The same information architecture and business interactions apply. Desktop may show more contextual information simultaneously and use horizontal space more effectively, but it must not invent new workflows or duplicate drawer content inline.

The Campaign shell should remain stable while the operational content becomes more spacious.

## 14. Scroll Model

Use three primary scroll contexts:

1. Campaign page/container scroll where required by the shell;
2. expanded workspace internal scroll;
3. drawer/detail-surface internal scroll.

Avoid unnecessary nested scrolling beyond these contexts.

## 15. Visual Hierarchy

Use Aurora Design System tokens and primitives.

Information weight:

1. Campaign identity / primary action
2. Copilot summary and priority actions
3. operational workspace
4. performance metrics
5. secondary metadata

Whitespace should separate decisions and operational groups, not decorate the interface.

## 16. Color and Status

Color communicates semantic state, not section identity.

Use design-system semantic tokens for:

- success;
- attention;
- critical;
- neutral;
- disabled.

Do not assign arbitrary colors to Discovery, Applicants, Products, etc.

State must never be communicated by color alone; pair semantic color with text/iconography.

## 17. Typography

Use the typography scale defined by Aurora.

Relative hierarchy:

- display/large: campaign name;
- heading: Copilot;
- section: Discovery, Applicants, Performance;
- card title: creator/product/brief name;
- body: concise AI summary and supporting content;
- label: metric labels;
- micro: counts, timestamps and compact metadata.

Mobile should favor concise labels and avoid verbose helper copy.

## 18. State Derivation

Do not invent Campaign lifecycle states in the frontend. Use `campaign/frontend/state_map.md` and the canonical hydration/runtime contracts.

The UI must cover loading, ready, empty, error, disabled and materially different lifecycle states without creating competing business truth.

## 19. Stitch Rules

Stitch is a visual design tool, not the source of Campaign business rules.

When generating Campaign UI:

- reuse the existing Application Shell;
- use Aurora Design System conventions;
- use the canonical Campaign copy;
- preserve the interaction hierarchy;
- preserve the drawer/modal boundary;
- do not expose brief details inline;
- do not invent Campaign Health;
- do not turn the page into a tabbed dashboard;
- use representative steady-state dummy data consistently;
- design mobile intentionally rather than simply shrinking desktop.

## 20. Dummy Steady-State Campaign

Use a consistent representative campaign for design review:

**Campaign:** Summer Glow Launch

**Products:**
- Glow Face Serum
- Night Repair Cream

**Briefs:**
- Instagram Reel
- Instagram Story
- UGC Video
- Product Review Reel
- Story + Link

Use realistic creator cards, counts and metrics consistently across generated states.

## 21. Out of Scope for This Design Specification

- Collaboration internals;
- full Reporting UI;
- backend API route design;
- View DTO implementation;
- persistence/business-rule implementation;
- provider/Intelligence calculations.
