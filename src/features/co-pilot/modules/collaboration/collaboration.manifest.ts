/**
 * Collaboration Function Manifest — single contract for Parts 2–5.
 * Maps AI tools → stage → persona → backend route. No business logic here.
 */

import { UceMilestoneStage } from "@prisma/client";

import type { WriteIntentKind } from "../../core/write-intent.types";
import type { CollaborationPersona } from "./collaboration.stages";

export type CollaborationManifestEntry = {
  tool: string;
  intent?: WriteIntentKind;
  description: string;
  persona: CollaborationPersona[];
  stages: UceMilestoneStage[];
  backendRoute: string;
  serviceMethod: string;
  hitl: boolean;
  recoveryMode: "CHAT" | "REDIRECT" | "NONE";
  deepLinkPath?: string;
};

export const COLLABORATION_FUNCTION_MANIFEST: CollaborationManifestEntry[] = [
  {
    tool: "collab.listThreads",
    description: "List active collaboration threads for the brand",
    persona: ["BRAND", "CREATOR"],
    stages: [
      UceMilestoneStage.STAGE_1_NEGOTIATION,
      UceMilestoneStage.STAGE_2_SECUREMENT,
      UceMilestoneStage.STAGE_3_LOGISTICS,
      UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
      UceMilestoneStage.STAGE_5_PUBLISHING,
      UceMilestoneStage.STAGE_6_FEEDBACK_SYNC,
    ],
    backendRoute: "GET /api/v1/collaboration/threads",
    serviceMethod: "listThreads",
    hitl: false,
    recoveryMode: "NONE",
  },
  {
    tool: "collab.getThread",
    description: "Get one collaboration thread detail / status",
    persona: ["BRAND", "CREATOR"],
    stages: [
      UceMilestoneStage.STAGE_1_NEGOTIATION,
      UceMilestoneStage.STAGE_2_SECUREMENT,
      UceMilestoneStage.STAGE_3_LOGISTICS,
      UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
      UceMilestoneStage.STAGE_5_PUBLISHING,
      UceMilestoneStage.STAGE_6_FEEDBACK_SYNC,
    ],
    backendRoute: "GET /api/v1/collaboration/threads/:id",
    serviceMethod: "getThread",
    hitl: false,
    recoveryMode: "NONE",
  },
  {
    tool: "collab.counterOffer",
    intent: "COLLAB_COUNTER_OFFER",
    description: "Brand submits a negotiation counter-offer",
    persona: ["BRAND"],
    stages: [UceMilestoneStage.STAGE_1_NEGOTIATION],
    backendRoute: "POST /api/v1/collaboration/threads/:id/negotiation/counter-offer",
    serviceMethod: "brandCounterOffer",
    hitl: true,
    recoveryMode: "REDIRECT",
    deepLinkPath: "/brand/collaborations?thread=:id",
  },
  {
    tool: "collab.acceptTerms",
    intent: "COLLAB_ACCEPT_TERMS",
    description: "Accept locked commercials and advance workflow",
    persona: ["BRAND", "CREATOR"],
    stages: [UceMilestoneStage.STAGE_1_NEGOTIATION],
    backendRoute: "POST /api/v1/collaboration/threads/:id/negotiation/accept",
    serviceMethod: "acceptCommercials",
    hitl: true,
    recoveryMode: "REDIRECT",
    deepLinkPath: "/brand/collaborations?thread=:id",
  },
  {
    tool: "collab.fundEscrow",
    intent: "COLLAB_FUND_ESCROW",
    description: "Brand funds escrow / unlocks securement for ESCROW payout mode",
    persona: ["BRAND"],
    stages: [UceMilestoneStage.STAGE_2_SECUREMENT],
    backendRoute: "POST /api/v1/collaboration/threads/:id/securement/fund-escrow",
    serviceMethod: "fundEscrow",
    hitl: true,
    recoveryMode: "REDIRECT",
    deepLinkPath: "/brand/collaborations?thread=:id",
  },
  {
    tool: "collab.dispatchLogistics",
    intent: "COLLAB_DISPATCH",
    description: "Brand marks shipment / credentials dispatched",
    persona: ["BRAND"],
    stages: [UceMilestoneStage.STAGE_3_LOGISTICS],
    backendRoute: "POST /api/v1/collaboration/threads/:id/logistics/dispatch",
    serviceMethod: "dispatchLogistics",
    hitl: true,
    recoveryMode: "CHAT",
  },
  {
    tool: "collab.approveContent",
    intent: "COLLAB_APPROVE_CONTENT",
    description: "Brand approves pending media submission",
    persona: ["BRAND"],
    stages: [UceMilestoneStage.STAGE_4_CONTENT_REVIEW],
    backendRoute: "POST /api/v1/collaboration/threads/:id/production/review",
    serviceMethod: "reviewMedia",
    hitl: true,
    recoveryMode: "REDIRECT",
    deepLinkPath: "/brand/collaborations?thread=:id",
  },
  {
    tool: "collab.requestRevision",
    intent: "COLLAB_REQUEST_REVISION",
    description: "Brand rejects media and requests revision",
    persona: ["BRAND"],
    stages: [UceMilestoneStage.STAGE_4_CONTENT_REVIEW],
    backendRoute: "POST /api/v1/collaboration/threads/:id/production/review",
    serviceMethod: "reviewMedia",
    hitl: true,
    recoveryMode: "CHAT",
  },
  {
    tool: "collab.verifyCompliance",
    intent: "COLLAB_VERIFY_COMPLIANCE",
    description: "Brand verifies live post compliance and advances to feedback",
    persona: ["BRAND"],
    stages: [UceMilestoneStage.STAGE_5_PUBLISHING],
    backendRoute: "POST /api/v1/collaboration/threads/:id/posting/verify-compliance",
    serviceMethod: "verifyCompliance",
    hitl: true,
    recoveryMode: "REDIRECT",
    deepLinkPath: "/brand/collaborations?thread=:id",
  },
];

export const COLLABORATION_INTENTS = [
  "VIEW_COLLABORATION",
  "VIEW_STATUS",
  "VIEW_ISSUES",
  "COUNTER",
  "ACCEPT",
  "FUND_ESCROW",
  "MARK_SHIPPED",
  "APPROVE_CONTENT",
  "REQUEST_REVISION",
  "VERIFY_COMPLIANCE",
] as const;

export type CollaborationIntent = (typeof COLLABORATION_INTENTS)[number];
