export type CampaignWorkspace = "DISCOVERY" | "APPLICANTS" | "COLLABORATIONS";

export type CampaignUiAction =
  | { type: "VIEW_CAMPAIGN_DETAILS"; campaignId: string }
  | { type: "EDIT_CAMPAIGN"; campaignId: string }
  | { type: "SHARE_CAMPAIGN"; campaignId: string }
  | { type: "VIEW_REPORTING"; campaignId: string }
  | { type: "ADD_PRODUCT"; campaignId: string }
  | { type: "VIEW_PRODUCT_DETAILS"; campaignId: string; campaignAssetId: string }
  | { type: "ADD_BRIEF"; campaignId: string; campaignAssetId: string }
  | { type: "VIEW_BRIEF_DETAILS"; campaignId: string; briefId: string }
  | { type: "OPEN_WORKSPACE"; campaignId: string; workspace: CampaignWorkspace }
  | { type: "VIEW_CREATOR_PROFILE"; campaignId: string; campaignCreatorId: string }
  | { type: "COMPOSE_OUTREACH"; campaignId: string; campaignCreatorId: string }
  | { type: "APPROVE_APPLICANT"; campaignId: string; applicationId: string }
  | { type: "REJECT_APPLICANT"; campaignId: string; applicationId: string };

export interface CampaignUiActionResult {
  ok: boolean;
  category?: string;
  message?: string;
}

export type CampaignUiActionHandler = (action: CampaignUiAction) => Promise<CampaignUiActionResult>;
