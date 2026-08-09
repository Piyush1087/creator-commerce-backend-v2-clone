import type {
  ApplicantsWorkspaceView,
  BriefDetailsView,
  CampaignDetailsView,
  CampaignPageView,
  CollaborationReferenceView,
  CreatorProfileView,
  DiscoveryWorkspaceView,
  OutreachComposerView,
  ProductDetailsView,
  ReportingDetailView,
} from "./types";
import { CampaignQueryService } from "../../../../../../backend/campaign/query/CampaignQueryService";
import { StagingCampaignReadRepository } from "../../../../../../backend/campaign/query/stagingRepository";

export interface CampaignReadAdapter {
  getCampaignPage(campaignId: string): Promise<CampaignPageView>;
  getCampaignDetails(campaignId: string): Promise<CampaignDetailsView>;
  getProductDetails(campaignAssetId: string): Promise<ProductDetailsView>;
  getBriefDetails(briefId: string): Promise<BriefDetailsView>;
  getDiscovery(campaignId: string): Promise<DiscoveryWorkspaceView>;
  getCreatorProfile(campaignCreatorId: string): Promise<CreatorProfileView>;
  getOutreachComposer(campaignCreatorId: string): Promise<OutreachComposerView>;
  getApplicants(campaignId: string): Promise<ApplicantsWorkspaceView>;
  getReporting(campaignId: string): Promise<ReportingDetailView>;
  getCollaborationReferences(campaignId: string): Promise<CollaborationReferenceView[]>;
}

/**
 * Executable staging transport over the canonical Campaign query boundary.
 * Production should preserve this interface and replace only the repository/transport integration.
 * Visual fixtures and scenario mutation are intentionally isolated under src/staging/.
 */
export function createExecutableCampaignReadAdapter(): CampaignReadAdapter {
  const query = new CampaignQueryService(new StagingCampaignReadRepository());
  return {
    getCampaignPage: (id) => query.getCampaignPage(id),
    getDiscovery: (id) => query.getDiscovery(id),
    getApplicants: (id) => query.getApplicants(id),
    async getCampaignDetails(campaignId){ return { campaignId, ...(await query.getDetails(campaignId)) }; },
    async getProductDetails(campaignAssetId){ return { campaignAssetId,state:"READY" }; },
    async getBriefDetails(briefId){ return { briefId,state:"READY" }; },
    async getCreatorProfile(campaignCreatorId){ return { campaignCreatorId,state:"READY" }; },
    async getOutreachComposer(campaignCreatorId){ return { campaignCreatorId,state:"UNAVAILABLE",capability:{available:false,presentation:"DISABLED",reasonCategory:"CAPABILITY_UNAVAILABLE"} }; },
    async getReporting(campaignId){ return { campaignId,state:"READY" }; },
    async getCollaborationReferences(){ return []; },
  };
}
