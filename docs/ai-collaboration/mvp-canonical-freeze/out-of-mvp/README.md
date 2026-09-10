# Out of this freeze / out of MVP

Chrome hide is allowed. It is not proof that an OUT backend API is non-competing.

| Surface | Status | Freeze-branch treatment |
| --- | --- | --- |
| C-06 Creator Payouts | Still in progress; not accepted | Hidden from nav; `/creator/payouts` redirects to Settings payouts. `GET /api/v1/creator/payouts` is authenticated read-only |
| Marketplace browse / guest marketplace | `OUT_OF_MVP` | Compatibility redirects / unavailable only; C-03 apply stays |
| Co-Pilot / Creator Co-Pilot | `OUT_OF_MVP` | Hidden from product; modules still imported. Collab HITL mutations retired this amendment |
| Creator Centre / Media Kit / Analytics | Deferred product (with C-02A) | Routes redirect to Creator Home |
| Live Razorpay money movement / Meta App Review | Provider debt | See `../16-external-providers/` |

Do not re-enter these through leftover navigation. Remaining mixed-folder code is classified, not deleted, in this checkpoint. Schema drop is still forbidden.

## OUT API proof matrix (amendment 2026-09-10)

Chain: exists → authenticated? → mutate canonical state? → another canonical API own that transition? → competing persistence?

| API | Auth | Mutates canonical state? | Canonical owner | Disposition |
| --- | --- | --- | --- | --- |
| `POST /api/v1/co-pilot/hitl/confirm` COLLAB_* intents | JWT | Would mutate `Collaboration` via leftover Brand Collab services | C-04 Collaboration APIs | **Retired** `410 OUT_OF_MVP_COMPETING_TRANSITION_RETIRED` |
| `POST /api/v1/co-pilot/hitl/confirm` campaign/planner/DNA/settings intents | JWT | Yes — Brand Centre / UCE / Settings | Chat Home + Brand Centre + Settings (IN) | **Remains** as Chat Home / Brand Centre HITL. Not treated as collab competition. Do not fail-close without breaking Chat Home |
| `POST /api/v1/creator/campaigns/invitations/claim` | JWT + Creator platform | Would mutate `UceCampaignCollaboration` | C-03 apply + C-04 Collaboration | **Retired** `410` |
| `POST /api/v1/creator/campaigns/logistics/confirm-receipt` | JWT + Creator platform | Same | C-04 fulfillment | **Retired** `410` |
| `POST /api/v1/creator/campaigns/content/submit-draft` | JWT + Creator platform | Same | C-04 production | **Retired** `410` |
| `POST /api/v1/creator/marketplace/invitations/claim` | JWT + Creator platform | Same | C-03 apply | **Retired** `410` |
| `GET /api/v1/creator/campaigns/workspace` `GET .../history` | JWT + Creator platform | No | n/a | OUT read compatibility |
| `GET /api/v1/public/marketplace/campaigns` | None (throttled) | No | n/a | OUT browse compatibility |
| `POST /api/v1/public/marketplace/campaigns/:id/apply-continuation` | None (throttled) | Continuation cookie only | C-01 / C-03 apply | Canonical continuation — **keep** |
| `PATCH /api/v1/creator-centre/media-kit` | JWT + Creator platform | Media Kit only | Creator Centre (OUT) | OUT writing OUT state; not a C-03/C-04/C-05 transition |
| `GET /api/v1/creator/payouts` | JWT + Creator platform | No | C-05 Settings payouts (canonical write) | OUT read hub; C-06 stays OUT |
| `POST /api/v1/collaboration/threads/:id/logistics/*` `production/submit` `production/review` `posting/*` | JWT | Leftover Brand Collab aggregates | C-04 fulfillment / production / publishing | **Retired** `410` |
| Brand UCE pipeline `UceCampaignCollaboration` writes | JWT (IN module) | Would mutate leftover collab identity | C-03/C-04 `Collaboration` | **Retired** `410 UCE_CAMPAIGN_COLLABORATION_WRITE_RETIRED`. Reads remain. Table not dropped |

Proof tests: `src/features/collaboration/out-of-mvp-competing-transition-retired.test.ts`  
INV-13 writer register: `../phase-d-invariants/inv-13-competing-writers.md`
