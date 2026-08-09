# Campaign UI ↔ Domain Mapping

**Status:** Phase 7 reference reconciliation. This maps approved Stitch reference input to frozen Campaign contracts. It creates no product behavior, entity, service, or implementation component.

## Authority

This document is subordinate to `campaign/README.md`; `backend/campaign_schema.prisma` and `backend/validation/**`; `campaign/backend/implementation_map.md`; `campaign/frontend/implementation_map.md`; `campaign/frontend/state_map.md`; and `frontend/layout/app_shell/**`. Imported visual input is at `frontend/campaign/stitch/references/phase-7/`; it does not define permissions, lifecycle transitions, provider behavior, or navigation.

## Required application-shell boundary

Campaign is feature content inside the shell **Content Area** defined by `frontend/layout/app_shell/content_area_contract.md`. The app shell exclusively owns the global desktop sidebar/header and the mobile header, bottom navigation, hamburger/global navigation, plus global notification/account surfaces. Campaign must not recreate, replace, or alter any of them. Campaign owns only feature content, its drawers/modals, workspace expansion, local scrolling, and focused task interactions inside that Content Area.

## Surface ownership

| Visible surface/component | Canonical Campaign domain owner | Backend/service owner | Intelligence owner | Frontend presentation/state owner | Interaction boundary |
| --- | --- | --- | --- | --- | --- |
| Campaign Header | `UceCampaign`: identity, accepted values, lifecycle. | `CampaignService` commands; `CampaignQueryService` page read. | None for header. | Map supplied lifecycle, editability, readiness, permission/capability; never infer them. | **View** → Campaign Details Drawer; **Edit** → canonical full workflow; lifecycle by server capability; **Share** → Share modal. |
| Campaign Copilot | No Copilot aggregate: Campaign-facing accepted Intelligence projections, priority/action context. | `CampaignQueryService` composes; source Campaign service owns resulting command. | How calculations/generation, model/tool selection, telemetry, retries, processing/unavailable truth. Campaign owns request/acceptance of Campaign-facing projections. | Hierarchy, local open, loading/no-actions/unavailable; no invented fallback and never a gate. | **Review** → focused quick-modal route into Discovery; detailed creator facts remain Creator Profile Drawer. |
| Performance | Campaign stable `Report`, immutable `Calculation` history/latest pointer. | `ReportingService`; `CampaignQueryService` summary read. | Calculation and detailed computation lineage. | Supplied summary plus load/error/unavailable state; no client metric calculation. | Compact summary → detailed Reporting surface, not a second report model. |
| Products & Briefs | Campaign Assets, Briefs, Active Opportunity derivation; deliverables are Brief-owned. | `OpportunityService`; `CampaignQueryService`. | None required. | Layout, collapsed/expanded/local state, server-backed capability. | Product → Product Details Drawer; Brief → Brief Details Drawer; Add actions → canonical full workflow. |
| Discovery | `UceCampaignCreator`; Recommendation Context, Run, Recommendation history and accepted Campaign-facing discovery projection. | `RecommendationService`; `CampaignCreatorService` identity/manual add/import/archive; `CampaignQueryService`. | Reusable creator intelligence, scans, processors, caches, recommendation computation and detailed execution evidence. | DiscoveryWorkspace mode, filters, selection, loading/error/no-results and viewport layout; render server candidates/capabilities only. | Creator → Creator Profile Drawer. Outreach starts focused flow; no detailed creator data inline. |
| Outreach | Campaign-facing outreach attempts and accepted message/tracked-link evidence; not provider delivery truth. | `OutreachService` eligibility/channel/quota/composition/evidence; `PriorityDmScheduler` pacing; `CampaignTrackingService` URLs/attribution. | None required by canonical outreach. | Contract-supported input, transient composer/handoff and server result display. UI cannot choose Email vs Priority DM, declare sent/delivered, or enforce capacity. | Focused command from Discovery/Creator context; not a creator-detail or collaboration workflow. |
| Applicants | `Application` + immutable `UceApplicationSnapshot`; Campaign-facing application identity/snapshot. | `ApplicationService` submit/withdraw/approve/reject/supersede/expire + snapshots; `ApplicantIntelligenceService` projection acceptance; `CampaignQueryService`. | Applicant match calculation; processing/ready/unavailable state. Never gates approval/rejection. | ApplicantsWorkspace mode, review/filter UI, internal scroll, local feedback and server capability rendering. | Creator → Creator Profile Drawer. **Approve/Reject** command Application Service; UI cannot finalize locally; no collaboration created. |
| Reporting | Campaign `Report` / immutable `Calculation`; Campaign Tracking evidence. | `ReportingService`, `CampaignTrackingService`, `CampaignQueryService`. | How calculation executes; not Campaign lifecycle/UI state. | Detail navigation, density, local load/error, authoritative availability. | Reporting summary → canonical detailed Reporting surface. |
| Share | Campaign Share action/message/tracked-link evidence; Campaign Tracking attribution. | `ShareService`; `CampaignTrackingService`. | None. | Modal state, copy affordance, transient feedback, server result/capability. No delivery/tracking claim. | Header **Share** → feature Share modal. |
| Creator Profile | `UceCampaignCreator` plus composed discovery/application/outreach context; no separate inline profile aggregate. | `CampaignCreatorService`; `CampaignQueryService`; source evidence services. | Accepted match/recommendation projection only; detailed intelligence remains Intelligence-owned. | Drawer state/focus/load/error and server-composed presentation. | **Creator Profile Drawer** is detailed-info boundary; cards remain quick review/outreach. |
| Campaign Details Drawer | `UceCampaign` accepted configuration. | `CampaignQueryService`; `CampaignService`. | None unless a supplied projection is present. | Drawer state/focus/load/error. | Header **View**; edit goes to canonical full workflow. |
| Product Details Drawer | Campaign Asset/derived opportunity. | `OpportunityService`; `CampaignQueryService`. | None. | Campaign drawer presentation. | Opened by product selection. |
| Brief Details Drawer | Brief and Brief-owned deliverables. | `OpportunityService`; `CampaignQueryService`. | None. | Campaign drawer presentation. | Opened by brief selection. |
| Collaboration placeholder/boundary | Independent Collaboration domain; Campaign only composes independently instantiated references. | Future collaboration adapter/module owns handoff/commands; Query may compose references only. | None implied. | Future/placeholder workspace only; no synthesis from applications/outreach/lifecycle. | No Campaign drawer/modal substitutes for future handoff. |

## Visible action reconciliation

| Action | Authority | UI constraint |
| --- | --- | --- |
| View Campaign | `CampaignQueryService` | Open Campaign Details Drawer; UI owns drawer state only. |
| Edit/lifecycle | `CampaignService` | Full workflow and capability server-authoritative. |
| Copilot Review | Source projection/service | Quick modal into Discovery; AI state is presentation, not permission. |
| Add Product / Brief | `OpportunityService` | Full workflow; backend owns readiness/opportunity derivation. |
| Expand/collapse, filters, internal scrolling | No domain mutation / query read | Frontend-local state within shell Content Area; mobile workspace visibility follows frontend state map. |
| Select creator | `CampaignQueryService` context | Creator Profile Drawer. |
| Start outreach | `OutreachService`, Scheduler/Tracking where applicable | Supported command only; no channel/quotas/provider truth in UI. |
| Approve/Reject | `ApplicationService` | Request + render returned state; applicant intelligence non-blocking. |
| View reporting | Reporting/Query services | Detailed Reporting surface over canonical Report/Calculation. |
| Share | Share/Tracking services | Share modal; service owns message/tracked-link evidence. |

## State reconciliation

Reference boards depict state; they are not a state machine.

- Lifecycle is `DRAFT → PUBLISHED → LIVE ↔ PAUSED → COMPLETED → ARCHIVED`; `CampaignService` owns transitions.
- Product/Brief readiness gates operational surfaces per `campaign/frontend/state_map.md`; visual affordance never proves enablement.
- Discovery, Applicants, Reporting, Share and Copilot availability are independently composed. Empty/loading/error/processing/no-actions/unavailable do not alter lifecycle.
- Applicant Intelligence never gates Approve/Reject.
- Paused/completed/archived are capability-mapped historical states, not frontend policy.
- Expansion, filters, drawer/modal visibility, focus, scroll, and transient feedback are frontend-local only.

## Imported-reference coverage

| Registry entry | Reconciled surface/state |
| --- | --- |
| `mobile-campaign-shell-steady-state` | Header, Copilot, Performance, Products & Briefs, compact Discovery/Applicants. |
| `mobile-discovery-workspace` | Discovery modes, filters, creator cards, outreach entry, internal scroll. |
| `mobile-applicants-workspace` | Applicants modes, cards, Approve/Reject, internal scroll. |
| `desktop-campaign-steady-state` | Same feature content, desktop layout, still inside Content Area. |
| `campaign-lifecycle-state-board` | Draft, Published, Live, Paused, Completed, Archived variants. |
| `campaign-local-state-board` | Discovery/Applicants local states; Product/Brief absence/readiness; Copilot loading/no-actions/unavailable. |

Source IDs and input paths are in `frontend/campaign/stitch/references/phase-7/reference-registry.md`.
