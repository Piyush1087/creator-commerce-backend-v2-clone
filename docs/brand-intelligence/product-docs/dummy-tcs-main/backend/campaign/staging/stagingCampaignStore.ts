export type StagingCampaignLifecycle = "DRAFT"|"PUBLISHED"|"LIVE"|"PAUSED"|"COMPLETED"|"ARCHIVED";
export type StagingApplicationStatus = "PENDING"|"APPROVED"|"REJECTED";
export type StagingSurfaceState = "READY"|"EMPTY"|"UNAVAILABLE"|"ERROR";

export type StagingCampaignAssetStatus = "ACTIVE"|"PAUSED";
export type StagingBriefStatus = "DRAFT"|"PUBLISHED"|"PAUSED";
export type StagingCampaignProduct = {
  id: string;
  name: string;
  kind: "BRAND"|"OFFERING"|"OFFER";
  sourceId: string;
  status: StagingCampaignAssetStatus;
  briefs: Array<{ id: string; name: string; status: StagingBriefStatus; fields: Record<string, unknown> }>;
};

export type StagingCampaignState = {
  id: string;
  name: string;
  status: StagingCampaignLifecycle;
  executionReady: boolean;
  products: StagingCampaignProduct[];
  discovery: StagingSurfaceState;
  applicants: StagingSurfaceState;
  creators: Set<string>;
  creatorRecords: Map<string, { id:string; platform:"INSTAGRAM"|"TIKTOK"|"YOUTUBE"; socialHandle:string; email:string; archived:boolean }>;
  applications: Map<string, StagingApplicationStatus>;
  outreachReplays: Map<string, unknown>;
  priorityDmReplays: Map<string, unknown>;
  emailRetryReplays: Map<string, unknown>;
  outreachPaths: Map<string, "EMAIL"|"PRIORITY_DM">;
  shareReplays: Map<string, unknown>;
  shareEvidence: Map<string, { campaignId:string; channel:"COPY_LINK"|"WHATSAPP"|"INSTAGRAM"|"NATIVE_SHARE" }>;
  suppliedProjections: {
    intelligence: { discovery: StagingSurfaceState; applicants: StagingSurfaceState };
    performance: { reach: string; engagement: string };
  };
};

export type StagingCampaignStore = { campaign: StagingCampaignState };

/**
 * Staging-only shared state. It is intentionally a persistence substitute, not a domain service.
 * Create a store per test when isolation is needed; production staging uses the shared instance.
 */
export function createStagingCampaignStore(): StagingCampaignStore {
  return {
    campaign: {
      id: "campaign-staging",
      name: "Summer Glow Launch",
      status: "LIVE",
      executionReady: true,
      products: [
        { id: "asset-serum", name: "Glow Face Serum", kind:"OFFERING", sourceId:"offering-serum", status:"ACTIVE", briefs: [{ id: "brief-reel", name: "Instagram Reel", status:"PUBLISHED", fields:{} }, { id: "brief-story", name: "Story + Link", status:"PUBLISHED", fields:{} }] },
        { id: "asset-cream", name: "Night Repair Cream", kind:"OFFERING", sourceId:"offering-cream", status:"ACTIVE", briefs: [{ id: "brief-ugc", name: "UGC Video", status:"PUBLISHED", fields:{} }] },
      ],
      discovery: "READY",
      applicants: "READY",
      creators: new Set<string>(),
      creatorRecords: new Map([["creator-anya",{id:"creator-anya",platform:"INSTAGRAM",socialHandle:"anya",email:"anya@example.com",archived:false}]]),
      applications: new Map<string, StagingApplicationStatus>([["application-anya", "PENDING"]]),
      outreachReplays: new Map<string, unknown>(),
      priorityDmReplays: new Map<string, unknown>(),
      emailRetryReplays: new Map<string, unknown>(),
      outreachPaths: new Map([["creator-anya","EMAIL"],["creator-priority","PRIORITY_DM"]]),
      shareReplays: new Map<string, unknown>(),
      shareEvidence: new Map(),
      suppliedProjections: {
        intelligence: { discovery: "READY", applicants: "READY" },
        performance: { reach: "124K", engagement: "5.8%" },
      },
    },
  };
}

export const stagingCampaignStore = createStagingCampaignStore();
