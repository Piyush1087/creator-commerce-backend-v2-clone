import { stagingCampaignStore, type StagingCampaignStore } from "../staging/stagingCampaignStore";

export type CampaignRecord = { id:string; name:string; status:"DRAFT"|"PUBLISHED"|"LIVE"|"PAUSED"|"COMPLETED"|"ARCHIVED"; executionReady:boolean; products:Array<{id:string;name:string;status:"ACTIVE"|"PAUSED";briefs:Array<{id:string;name:string;status:"DRAFT"|"PUBLISHED"|"PAUSED"}>}>; discovery:"READY"|"EMPTY"|"UNAVAILABLE"|"ERROR"; applicants:"READY"|"EMPTY"|"UNAVAILABLE"|"ERROR"; applicationStatuses:Record<string,"PENDING"|"APPROVED"|"REJECTED"> };

export interface CampaignReadRepository { findCampaign(id:string): Promise<CampaignRecord | undefined>; }

/** Staging-only read repository over the shared state owned by campaign/staging. */
export class StagingCampaignReadRepository implements CampaignReadRepository {
  constructor(private readonly store: StagingCampaignStore = stagingCampaignStore) {}

  async findCampaign(id:string): Promise<CampaignRecord> {
    const campaign=this.store.campaign;
    return { id, name:campaign.name, status:campaign.status, executionReady:campaign.executionReady, products:campaign.products.map(product=>({id:product.id,name:product.name,status:product.status,briefs:product.briefs.map(brief=>({id:brief.id,name:brief.name,status:brief.status}))})), discovery:campaign.discovery, applicants:campaign.applicants, applicationStatuses:Object.fromEntries(campaign.applications) };
  }
}
