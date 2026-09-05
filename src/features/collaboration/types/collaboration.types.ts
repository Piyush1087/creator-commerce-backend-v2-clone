import {
  CollaborationIndustryType,
  CollaborationMessageKind,
  CollaborationPayoutMode,
  UceMilestoneStage,
} from "@prisma/client";

export type CollaborationThreadRow = {
  collaboration_id: string;
  brand_profile_id: string;
  creator_user_id: string;
  campaign_id: string;
  campaign_name: string;
  brief_id: string | null;
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
