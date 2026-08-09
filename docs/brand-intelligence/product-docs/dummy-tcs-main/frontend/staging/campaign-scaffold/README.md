# Creator Shop Campaign staging implementation

This directory contains the runnable staging implementation of the Campaign experience. It is intended for validation, state coverage and production handoff. It is **not** the production application.

## Current scope

The staging app now includes:

- React + TypeScript + Vite application scaffold;
- Campaign rendered inside the platform-owned Application Shell boundary;
- desktop shell chrome and mobile shell behavior adapted from `frontend/layout/app_shell/` references;
- Campaign Header;
- Campaign Copilot presentation;
- Performance summary;
- Products & Briefs;
- Discovery workspace;
- Applicants workspace;
- Collaboration placeholder/reference only;
- typed Campaign Page read projections;
- deterministic UI scenario fixtures;
- typed frontend action model;
- frontend read adapter;
- frontend command adapter;
- shared staging Campaign state used by read and command paths;
- staging-only command harness for exercising already-frozen command DTOs.

Campaign Intelligence execution and Collaboration domain behavior are intentionally not implemented here.

## Architecture

Normal executable staging flow:

```text
Campaign UI / staging command harness
        ↓
frontend command adapter
        ↓
CampaignCommandService
        ↓
owning Campaign service
        ↓
shared staging Campaign store
        ↓
CampaignQueryService
        ↓
frontend CampaignReadAdapter
        ↓
refreshed Campaign projection
```

The React feature must not access Prisma, repositories or backend services directly.

## Application Shell

The canonical shell source/reference is under:

```text
frontend/layout/app_shell/
```

The staging implementation keeps Campaign content inside the shell Content Area. Campaign does not own global navigation.

The staging shell visibly represents:

- desktop sidebar;
- desktop/global header;
- mobile header;
- mobile navigation drawer;
- fixed mobile bottom navigation.

These are staging adaptations of platform-owned shell references, not a new Campaign-owned shell architecture.

## Campaign feature source

```text
src/features/campaign/
```

Important boundaries include:

- `CampaignPage.tsx` — Campaign composition root;
- `types.ts` — frontend-facing Campaign projections;
- `readAdapter.ts` — frontend read boundary;
- `commandAdapter.ts` — frontend command boundary;
- `actionModel.ts` — typed UI actions preserving canonical IDs;
- `scenarios.ts` — deterministic visual/state scenarios;
- `components/` — Campaign feature presentation components.

Canonical implementation contracts remain under:

```text
campaign/frontend/
frontend/campaign/design/
```

## Scenario preview

The staging app includes a scenario selector for representative Campaign states. Current scenarios include:

- Live — Discovery active;
- Draft;
- Published — Product setup;
- Published — Brief setup;
- Live — Creator acquisition;
- Live — Applications active;
- Live — Readiness blocked;
- Paused;
- Completed;
- Archived;
- local loading;
- local no-results;
- local unavailable/error.

Scenario mode is deterministic and does not mutate normal staging Campaign state.

## Staging command harness

The development-only command harness lives under:

```text
src/staging/
```

It is deliberately outside the approved Campaign product UI and navigation. It exists only to exercise already-defined command contracts before full production workflows are built.

It currently exercises, where supported by canonical contracts:

- Campaign lifecycle commands;
- Product / Brief commands;
- Campaign Creator commands;
- Outreach commands;
- Share commands.

Applicant Approve/Reject is wired through the approved Applicant UI.

The harness must **not** be copied into production UX.

## Known staging limitations

The following are intentionally incomplete or pending:

- production transport/auth integration;
- production database/repository integration;
- real provider execution;
- Campaign Intelligence execution;
- Collaboration internals;
- production Add Product / Brief / Outreach / Share workflow UI where staging harness inputs are currently used;
- Campaign/Product/Brief/Creator/Reporting drawers and other focused modal/detail surfaces that remain production UI work;
- runtime and visual QA in an authoritative local environment.

The current normal staging read path uses a shared in-memory staging Campaign store, not production persistence.

## Runtime verification status

Runtime verification has **not yet been completed** because the Codex environment used during implementation could not obtain an authoritative current local checkout and could not access the npm registry.

Do not treat static source validation as proof that build, lint, tests or responsive rendering pass at runtime.

## Run locally

Requires a current Node.js LTS installation and npm registry access.

From this directory:

```sh
npm install
npm run lint
npm run test
npm run build
npm run dev
```

Open the local Vite URL printed by the dev server.

## Required local QA before production merge

Verify at minimum:

1. desktop shell + Campaign layout;
2. mobile shell + fixed bottom-nav clearance;
3. Discovery Active;
4. Applications Active;
5. Product Setup;
6. Brief Setup;
7. Paused;
8. Completed / Archived;
9. loading / empty / unavailable states;
10. one-expanded-workspace behavior on mobile;
11. internal workspace scrolling;
12. Applicant Approve/Reject read-after-write;
13. representative lifecycle/Product/Brief/Creator/Outreach/Share command flows through the staging harness.

Compare the rendered implementation against:

```text
frontend/campaign/stitch/references/phase-7/
frontend/campaign/design/campaign_page_design_spec_v2.md
frontend/campaign/design/component_inventory.md
campaign/frontend/state_map.md
```

## Production handoff

Before merging into the production repository, use:

```text
campaign/frontend/campaign_implementation_finalization_handoff.md
```

as the gap-audit and handoff authority.

The staging package is a reference implementation and integration test bed. Production code should reuse the production app's existing routing, auth, persistence, shared components and shell rather than mechanically copying staging infrastructure.
