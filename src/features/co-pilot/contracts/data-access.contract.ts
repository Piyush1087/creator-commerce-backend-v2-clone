/**

 * Co-Pilot data access contract — single source of truth for read vs write boundaries.

 * Mirror: docs/chat-engine/engineering/DATA_ACCESS_CONTRACT.md (technical)
 * Plain language: docs/chat-engine/engineering/MODULE_ACCESS_GUIDE.md

 *

 * Rules:

 * - READ: orchestrator tools may query via feature services only (no raw SQL from LLM).

 * - WRITE_VIA_HITL: mutations only after INTERACTIVE_EXECUTION_WIDGET confirm + idempotencyKey.

 * - WRITE_DENIED: co-pilot must never mutate directly in current release.

 * - CO_PILOT_OWN: tables owned by the co-pilot feature module.

 */



export type CoPilotAccessMode =

  | "READ"

  | "WRITE_VIA_HITL"

  | "WRITE_DENIED"

  | "CO_PILOT_OWN";



export type CoPilotModuleAccess = {

  module: string;

  prismaModels: Record<string, CoPilotAccessMode>;

  apiRoutesRead?: readonly string[];

  apiRoutesWriteHitl?: readonly string[];

  notes?: string;

};



export const CO_PILOT_DATA_ACCESS_CONTRACT = {

  version: "2026-06-11c",

  activeScopes: ["BRAND_CENTRE", "ESCROW", "GLOBAL"] as const,

  deferredScopes: ["ANALYTICS"] as const,

  modules: [

    {

      module: "brand-centre-tab1-dna",

      prismaModels: {

        BrandProfile: "READ",

        BrandAudiencePersona: "READ",

        Offering: "READ",

        Competitor: "READ",

        BrandOffer: "READ",

        BrandBudgetConfiguration: "READ",

        BrandBudgetModificationLog: "WRITE_DENIED",

      },

      apiRoutesRead: [

        "GET /api/v1/brand-centre/dna",

        "GET /api/v1/brand-centre/dna/personas",

        "GET /api/v1/brand-centre/dna/offerings",

      ],

      apiRoutesWriteHitl: [

        "POST /api/v1/co-pilot/hitl/confirm → PATCH /api/v1/brand-centre/dna/identity (visual aesthetics, fonts)",

        "POST /api/v1/co-pilot/hitl/confirm → PATCH /api/v1/brand-centre/dna/offerings/:id (description only)",

        "POST /api/v1/co-pilot/hitl/confirm → POST /api/v1/brand-centre/dna/personas (create persona)",

      ],

      notes:

        "Product matrix §1: identity mutation, persona create, offering description update via HITL only. No bulk DNA patch, no budget/competitor deletes via co-pilot.",

    },

    {

      module: "brand-centre-tab2-intelligence",

      prismaModels: {

        BrandIntelligenceBaseline: "READ",

        BrandPerformanceLeak: "READ",

        BrandCentreJob: "READ",

      },

      apiRoutesRead: [

        "GET /api/v1/brand-centre/intelligence",

        "GET /api/v1/brand-centre/intelligence/leaks",

      ],

      apiRoutesWriteHitl: [

        "POST /api/v1/co-pilot/hitl/confirm → POST /api/v1/brand-centre/intelligence/leaks/:id/move-to-planner",

      ],

      notes:
        "Read via Brand Centre tools. Move-to-planner HITL queues PLANNER_AGGREGATE; SSE follow-up on hitl/confirm/stream.",

    },

    {

      module: "brand-centre-tab3-planner",

      prismaModels: {

        BrandPlannerCard: "READ",

      },

      apiRoutesRead: ["GET /api/v1/brand-centre/planner"],

      apiRoutesWriteHitl: [

        "POST /api/v1/co-pilot/hitl/confirm → approve planner card + bridge process-signal",

      ],

      notes:
        "Planner read in chat (table). PLANNER_LAUNCH_DRAFT HITL creates UCE DRAFT via bridge.",

    },

    {

      module: "uce-campaigns",

      prismaModels: {

        UceCampaign: "WRITE_VIA_HITL",

        UceCampaignStrategy: "WRITE_VIA_HITL",

        UceCampaignTargeting: "WRITE_VIA_HITL",

        UceCampaignCommercials: "WRITE_VIA_HITL",

        UceCampaignProduct: "WRITE_VIA_HITL",

        UceCampaignBrief: "WRITE_VIA_HITL",

        UceCampaignPerformanceAggregate: "READ",

      },

      apiRoutesRead: [
        "GET /api/v1/brand-uce/campaigns",
        "GET /api/v1/brand-uce/campaigns/:id (summary/performance/financials via service)",
      ],

      apiRoutesWriteHitl: [

        "POST /api/v1/co-pilot/hitl/confirm → POST /api/v1/brand-uce/campaigns/wizard",

        "POST /api/v1/co-pilot/hitl/confirm → PATCH /api/v1/brand-uce/campaigns/:id/wizard (DRAFT only)",

        "POST /api/v1/co-pilot/hitl/confirm → pause/resume/archive via BrandUceCampaignService",

        "POST /api/v1/co-pilot/hitl/confirm → duplicateCampaign / bulkLifecycleAction",

      ],

      notes:
        "UCE Campaign List module (uce-campaign-list): list/search/filter/sort/summary/performance/compare/financials reads. Lifecycle HITL: pause, resume, archive→ARCHIVED, duplicate→DRAFT, bulk. Also CAMPAIGN_LAUNCH shortcut, PLANNER_LAUNCH_DRAFT via bridge, CAMPAIGN_EDIT_DRAFT.",

    },

    {

      module: "escrow",

      prismaModels: {

        BrandEscrowVault: "READ",

        EscrowTransactionLedger: "READ",

      },

      apiRoutesRead: [

        "GET /api/v1/escrow/vault (via co-pilot getEscrowReadContext)",

        "GET /api/v1/escrow/ledger (via co-pilot getEscrowReadContext)",

      ],

      apiRoutesWriteHitl: [

        "POST /api/v1/escrow/engine/lock (future HITL — product §7)",

        "POST /api/v1/escrow/engine/release (future HITL)",

      ],

      notes:

        "Read: ledger audit + TDS buffer via TABULAR_AUDIT_DATA. Escrow lock/release/refund HITL deferred (needs collaboration context).",

    },

    {

      module: "collaboration",

      prismaModels: {

        Collaboration: "WRITE_VIA_HITL",

        CollaborationCommercial: "WRITE_VIA_HITL",

        CollaborationLogistics: "WRITE_VIA_HITL",

        CollaborationMedia: "WRITE_VIA_HITL",

        CollaborationFinalization: "WRITE_VIA_HITL",

      },

      apiRoutesRead: [

        "GET /api/v1/collaboration/threads (via collab.listThreads)",

        "GET /api/v1/collaboration/threads/:id (via collab.getThread)",

      ],

      apiRoutesWriteHitl: [

        "POST /api/v1/collaboration/threads/:id/negotiation/counter-offer",

        "POST /api/v1/collaboration/threads/:id/negotiation/accept",

        "POST /api/v1/collaboration/threads/:id/securement/fund-escrow",

        "POST /api/v1/collaboration/threads/:id/logistics/dispatch",

        "POST /api/v1/collaboration/threads/:id/production/review",

        "POST /api/v1/collaboration/threads/:id/posting/verify-compliance",

      ],

      notes:

        "Collaboration AI module: pipeline/issues/status reads. Brand HITL writes: counter-offer, accept terms, fund escrow, dispatch, approve/request revision, verify compliance. Stage+persona gated. Part 5 validation checklists with deep-link resume.",

    },

    {

      module: "pricing-entitlements",

      prismaModels: {

        FeatureUsage: "READ",

        BrandSubscription: "READ",

      },

      apiRoutesRead: [

        "GET /api/v1/co-pilot/usage",

        "GET /api/v1/pricing/usage",

      ],

      notes:

        "MAX_AI_CHATS enforced on orchestrator runs. Warnings at 80% / 95% via GET /co-pilot/usage. Slot-fill billing unit pending product sign-off.",

    },

    {

      module: "co-pilot-session",

      prismaModels: {

        CoPilotThread: "CO_PILOT_OWN",

        CoPilotMessage: "CO_PILOT_OWN",

        CoPilotSlotSession: "CO_PILOT_OWN",

        CoPilotInteractionLog: "CO_PILOT_OWN",

        CoPilotMessageFeedback: "CO_PILOT_OWN",

      },

      apiRoutesRead: [

        "GET /api/v1/co-pilot/threads",

        "GET /api/v1/co-pilot/threads/:id",

      ],

      apiRoutesWriteHitl: ["POST /api/v1/co-pilot/messages/:id/feedback"],

      notes: "Conversation state + explicit feedback only. Not brand domain data.",

    },

  ] satisfies CoPilotModuleAccess[],

} as const;



export type CoPilotDataAccessContract = typeof CO_PILOT_DATA_ACCESS_CONTRACT;


