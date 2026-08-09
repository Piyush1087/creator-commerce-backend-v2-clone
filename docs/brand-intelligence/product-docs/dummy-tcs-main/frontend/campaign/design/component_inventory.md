# Campaign Component Inventory

**Status:** CANONICAL / PHASE 6
**Purpose:** Define the reusable frontend component vocabulary for the Campaign Page. This is a design/architecture inventory, not a mandatory production file tree. Production paths must follow the actual frontend architecture.

## 1. Component Philosophy

Build fewer, reusable components.

Prefer composition and variants over duplicated components.

Do not create a new component solely because the same visual component appears in a different Campaign workspace.

Use Aurora Design System primitives/components wherever an applicable primitive already exists.

## 2. Campaign Page Composition

```text
CampaignPage
├── CampaignHeader
├── CampaignCopilot
├── PerformanceSummary
├── ProductsBriefsSection
├── ExpandableSection
│   ├── DiscoveryWorkspace
│   ├── ApplicantsWorkspace
│   └── CollaborationsWorkspace (future)
├── Drawers
└── Quick Modals
```

## 3. CampaignHeader

Purpose: persistent Campaign identity and primary Campaign actions.

Contains:

- campaign name;
- lifecycle/status;
- View;
- Edit;
- Share;
- compact Products/Briefs count;
- expandable Products & Briefs context.

It must not contain detailed Campaign, Product or Brief content.

## 4. CampaignCopilot

Purpose: concise AI summary and 3–4 campaign-level priority actions.

States:

- loading;
- summary ready;
- actions available;
- no priority actions;
- unavailable/degraded.

Priority actions use `PriorityActionCard` or the applicable Aurora equivalent.

Copilot does not calculate Reporting or Intelligence truth.

## 5. PerformanceSummary

Purpose: compact operational performance summary.

Uses reusable metric primitives such as `MetricChip` or the applicable Aurora equivalent.

Do not create a Campaign Health component.

Detailed Reporting opens separately.

## 6. ProductsBriefsSection

Purpose: compact Campaign product/brief context and setup actions.

Contains `ProductRow` and `BriefRow`.

Only product and brief names appear inline.

Detailed Product and Brief information belongs in drawers/modals.

## 7. ExpandableSection

Purpose: reusable section container for operational workspaces.

Responsibilities:

- collapsed/expanded presentation;
- section summary/count;
- expanded header;
- body container;
- internal scrolling;
- one-expanded-section behavior on mobile.

Variants should be data/configuration driven rather than separate visual systems.

## 8. DiscoveryWorkspace

Uses `ExpandableSection`.

Contains:

- workspace header;
- filter/control;
- Creator Cards;
- outreach actions.

Do not create a separate navigation system.

## 9. ApplicantsWorkspace

Uses `ExpandableSection`.

Contains:

- workspace header;
- filter/control;
- Creator Cards in applicant mode;
- Approve/Reject actions.

Do not create a separate creator-card visual system.

## 10. CollaborationsWorkspace

Future.

Collaboration is independently owned. Do not invent its domain model or lifecycle.

## 11. CreatorCard

Reusable creator representation for:

- Discovery;
- Applicants;
- quick creator-review modal.

Use a variant/mode for applicant-specific actions instead of duplicating the entire card component.

Typical content:

- avatar;
- creator name/category;
- selected creator metrics;
- match/context where supplied;
- primary action;
- secondary action.

Detailed information opens in Creator Profile.

## 12. ProductRow

Contains:

- Product name;
- associated Brief names;
- Add Brief.

Product detail is opened separately.

## 13. BriefRow

Contains only the Brief name in the Campaign Page inline context.

Brief details are never expanded inline.

## 14. PriorityActionCard

Purpose: one actionable Campaign Copilot recommendation.

Contains:

- concise action statement;
- optional concise reason/context;
- action CTA.

Example:

`8 new creators found for the campaign` → `Review`

## 15. Metric Primitive

Use Aurora's metric/chip primitive where available.

Variants should be semantic:

- neutral;
- success;
- attention;
- critical.

Do not create metric components that encode Campaign-specific business calculations.

## 16. Status Primitive

Use the Design System status/badge primitive.

Lifecycle and operational status should be represented through canonical semantic values.

## 17. Drawer Architecture

Use the platform/Aurora drawer pattern.

Campaign-specific detail surfaces:

- CampaignDrawer;
- ProductDrawer;
- BriefDrawer;
- CreatorDrawer;
- ReportingDrawer/surface when appropriate.

All drawers should share the same underlying layout primitive rather than implement independent drawer systems.

## 18. Quick Modal Architecture

Use shared modal primitives.

Campaign-specific examples:

- QuickDiscoveryModal;
- QuickApplicantsModal;
- ShareModal;
- ConfirmationModal.

A quick modal is for a focused task; a drawer is for detailed inspection.

## 19. Shared State Components

Use shared/Aurora components for:

- loading/skeleton;
- empty state;
- error/retry;
- confirmation;
- filters;
- status;
- buttons/actions.

Do not create Campaign-only variants when an existing shared component supports the requirement.

## 20. Responsive Behavior

Components represent one Campaign domain model across viewports.

Mobile may change:

- density;
- progressive disclosure;
- simultaneous visibility;
- detail surface treatment;
- control placement.

Mobile must not change:

- permissions;
- lifecycle;
- business validation;
- editability;
- Intelligence meaning;
- Reporting meaning.

## 21. Ownership

Campaign-owned:

- CampaignHeader;
- CampaignCopilot presentation;
- PerformanceSummary presentation;
- ProductsBriefsSection;
- DiscoveryWorkspace;
- ApplicantsWorkspace;
- Campaign-specific composition.

Shared/platform-owned:

- Application Shell;
- buttons;
- typography;
- status badges;
- metric primitives;
- drawer/modal primitives;
- loading/empty/error patterns.

Intelligence-owned data:

- Campaign Copilot outputs;
- Reporting projections;
- other Campaign-facing Intelligence outputs.

Collaboration-owned:

- Collaboration lifecycle and Collaboration internals.

## 22. Production Implementation Rule

This inventory does not prescribe exact production filenames or framework abstractions. Before implementation, the coding agent must inspect the real frontend architecture and reuse existing component patterns. Do not mechanically create a parallel component system simply to mirror this inventory.
