import {
  CollaborationActorClass,
  CollaborationIndustryType,
  CollaborationLifecycle,
  CollaborationMessageKind,
  CollaborationPayoutMode,
  CollaborationStage,
  CollaborationStageStatus,
  UceMilestoneStage,
} from "@prisma/client";

export type CollaborationViewerRole = "BRAND" | "CREATOR";
export type CollaborationProjectionSource =
  "CANONICAL" | "LEGACY_COMPATIBILITY";

export type CollaborationAvailableAction =
  | "PostCollaborationMessage"
  | "AcceptProposedFee"
  | "CounterOffer"
  | "AcceptCounterOffer"
  | "DeclineNegotiation"
  | "RequestEscrowFunding"
  | "SubmitManualPaymentEvidence"
  | "ConfirmManualPaymentReceipt"
  | "DisputeManualPayment"
  | "ProvideFulfillment"
  | "ConfirmFulfillment"
  | "ReportFulfillmentIssue"
  | "ProvideFulfillmentRemediation"
  | "SubmitDeliverable"
  | "ApproveDeliverable"
  | "RequestDeliverableRevision"
  | "RejectFinalDeliverable"
  | "AuthorizePublishing"
  | "DeclinePublishing"
  | "SubmitPublishingEvidence"
  | "VerifyPublishing"
  | "RequestPublishingCorrection"
  | "SubmitCorrectedPublishingEvidence";

export type CollaborationWorkflowProjection = {
  stage: CollaborationStage;
  status: CollaborationStageStatus;
  actionRequiredBy: CollaborationActorClass | "NONE";
  availableActions: CollaborationAvailableAction[];
  aggregateVersion: number;
};

export type CanonicalCollaborationThreadRow = {
  collaborationId: string;
  projectionSource: CollaborationProjectionSource;
  counterpart: {
    id: string;
    kind: CollaborationViewerRole;
    displayName: string | null;
    handle: string | null;
  };
  sourceContext: {
    campaign: { id: string; name: string };
    campaignAsset: {
      id: string;
      name: string;
      type: string;
      imageUrl: string | null;
    } | null;
    brief: { id: string; title: string };
  };
  lifecycle: CollaborationLifecycle;
  workflow: CollaborationWorkflowProjection;
  blocking: { reason: string | null; category: string } | null;
  resolution: null;
  inbox: {
    unreadCount: number;
    lastMessageSnippet: string | null;
    lastMessageAt: string | null;
  };
  progress: { stageIndex: number; stageCount: 5 };
  updatedAt: string;
  legacyCompatibility: {
    applied: true;
    reason: "MISSING_SOURCE_APPLICATION";
    fields: Array<"lifecycle" | "workflow">;
  } | null;
};

// Retained internal compatibility shape for Co-Pilot and Brand UCE consumers.
// Canonical Collaboration HTTP reads do not return this type.
export type CollaborationThreadRow = {
  collaboration_id: string;
  brand_profile_id: string;
  creator_user_id: string;
  campaign_id: string;
  campaign_name: string;
  brief_id: string;
  brief_title: string;
  creator_display_name: string | null;
  creator_handle: string | null;
  brand_name: string;
  current_stage: UceMilestoneStage;
  payout_mode: CollaborationPayoutMode;
  industry: CollaborationIndustryType;
  negotiation_round: number;
  fulfillment_issue_count: number;
  revision_count: number;
  unread_count: number;
  last_message_snippet: string | null;
  last_message_at: string | null;
  is_paused: boolean;
  is_terminated: boolean;
};

export type CollaborationMessageRow = {
  message_id: string;
  kind: CollaborationMessageKind;
  body: string;
  sender_user_id: string | null;
  system_event_tag: string | null;
  created_at: string;
};
