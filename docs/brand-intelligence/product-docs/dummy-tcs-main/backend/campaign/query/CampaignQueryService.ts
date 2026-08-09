import type { CampaignReadRepository } from "./stagingRepository";

export type SurfaceState = "READY"|"EMPTY"|"UNAVAILABLE"|"ERROR";
const enabled={available:true,presentation:"ENABLED" as const};
const disabled={available:false,presentation:"DISABLED" as const,reasonCategory:"CAPABILITY_UNAVAILABLE"};

/** Read-only composition boundary. It resolves presentation capabilities; it never exposes persistence records. */
export class CampaignQueryService {
  constructor(private readonly repository: CampaignReadRepository) {}

  async getCampaignPage(id:string) {
    const campaign=await this.requireCampaign(id);
    const isLive=campaign.status==="LIVE";
    const operational=isLive&&campaign.executionReady;
    const paused=campaign.status==="PAUSED";
    const historical=campaign.status==="COMPLETED"||campaign.status==="ARCHIVED";
    const postLiveReadinessBlocked=isLive&&!campaign.executionReady;
    const activeProducts=campaign.products.filter(product=>product.status==="ACTIVE");
    const products=campaign.products.map(product=>({campaignAssetId:product.id,name:product.name,status:product.status,briefs:product.briefs.map(brief=>({briefId:brief.id,name:brief.name,status:brief.status}))}));
    const activeBriefCount=activeProducts.reduce((n,product)=>n+product.briefs.filter(brief=>brief.status==="PUBLISHED").length,0);

    const hydration=historical
      ?"STATE_9_HISTORICAL_CAMPAIGN"
      :paused
        ?"STATE_8_PAUSED_CAMPAIGN"
        :campaign.status==="PUBLISHED"&&activeProducts.length===0
          ?"STATE_1_PRODUCT_SETUP"
          :campaign.status==="PUBLISHED"&&!campaign.executionReady
            ?"STATE_2_BRIEF_SETUP"
            :isLive
              ?"STATE_4_DISCOVERY_ACTIVE"
              :"DRAFT";

    const share=operational?enabled:disabled;
    const supportedChannels: Array<"COPY_LINK" | "WHATSAPP" | "INSTAGRAM"> = operational?["COPY_LINK","WHATSAPP","INSTAGRAM"]:[];
    const applicantsInstantiated=Object.keys(campaign.applicationStatuses).length>0;
    const discoveryInstantiated=campaign.discovery!=="UNAVAILABLE";
    const preserveOperationalWorkspaces=isLive||paused||historical;
    const discoveryVisible=preserveOperationalWorkspaces&&discoveryInstantiated;
    const applicantsVisible=preserveOperationalWorkspaces&&applicantsInstantiated;
    const reportingAvailable=isLive||paused||historical;
    const intelligenceAvailable=(operational||paused)&&campaign.discovery!=="UNAVAILABLE";

    return {
      campaign:{
        id:campaign.id,
        name:campaign.name,
        lifecycleStatus:campaign.status,
        creationSource:"MANUAL" as const,
        productCount:activeProducts.length,
        briefCount:activeBriefCount,
        capabilities:{
          view:enabled,
          edit:historical?disabled:enabled,
          share,
          pause:campaign.status==="LIVE"?enabled:disabled,
          resume:paused?enabled:disabled,
          complete:(campaign.status==="LIVE"||paused)?enabled:disabled,
          archive:campaign.status==="COMPLETED"?enabled:disabled,
        },
      },
      hydration:{
        outcome:hydration,
        executionReady:campaign.executionReady,
        primaryFocus:postLiveReadinessBlocked?"RESTORE_CAMPAIGN_READINESS":operational?"DISCOVERY":historical?"REVIEW_AND_REPORTING":paused?"RESUME_OR_EXISTING_EXECUTION":"PRODUCT",
        postLiveReadinessBlocked,
      },
      productsBriefsSummary:{state:products.length?"READY":"EMPTY" as SurfaceState,label:"Products & Briefs",capability:historical?disabled:enabled,products},
      copilotSummary:{state:intelligenceAvailable?"READY":"UNAVAILABLE" as SurfaceState,label:"Campaign Copilot",summary:intelligenceAvailable?"Strong creator interest this week. Prioritize the highest-match prospects and pending applicants.":undefined,actions:operational?[{id:"new-creators",label:"Review",context:"8 new creators found for the campaign",action:"DISCOVERY"}]:[]},
      performanceSummary:{state:reportingAvailable?"READY":"UNAVAILABLE" as SurfaceState,label:"Performance",capability:reportingAvailable?enabled:disabled,metrics:reportingAvailable?[{metricId:"reach",label:"Reach",value:"124K",tone:"success" as const},{metricId:"engagement",label:"Engagement",value:"5.8%",tone:"neutral" as const}]:[]},
      workspaces:[
        {workspace:"DISCOVERY" as const,state:campaign.discovery,instantiated:discoveryInstantiated,visible:discoveryVisible,count:8,expand:discoveryVisible?enabled:disabled},
        {workspace:"APPLICANTS" as const,state:campaign.applicants,instantiated:applicantsInstantiated,visible:applicantsVisible,count:applicantsInstantiated?2:0,expand:applicantsVisible?enabled:disabled},
        {workspace:"COLLABORATIONS" as const,state:"UNAVAILABLE" as SurfaceState,instantiated:false,visible:false,expand:{available:false,presentation:"HIDDEN" as const}},
      ],
      share:{capability:share,supportedChannels},
    };
  }

  async getDiscovery(id:string) { await this.requireCampaign(id); return {state:"READY" as SurfaceState,creators:[{campaignCreatorId:"creator-anya",name:"Anya Kapoor",category:"Beauty & Skincare",followers:"128K",engagement:"6.4%",avatarInitials:"AK",contextLabel:"High match"}]}; }
  async getApplicants(id:string) { const campaign=await this.requireCampaign(id); return {state:"READY" as SurfaceState,applicants:[{applicationId:"application-anya",campaignCreatorId:"creator-anya",name:"Anya Kapoor",category:"Beauty & Skincare",followers:"128K",engagement:"6.4%",avatarInitials:"AK",applicationStatus:campaign.applicationStatuses["application-anya"],intelligenceStatus:"READY" as const,intelligenceLabel:"Strong audience fit"}]}; }
  async getDetails(id:string) { await this.requireCampaign(id); return {state:"READY" as SurfaceState}; }
  private async requireCampaign(id:string) { const campaign=await this.repository.findCampaign(id); if(!campaign) throw new Error("NOT_FOUND"); return campaign; }
}
