import { stagingCampaignStore, type StagingCampaignStore, type StagingApplicationStatus, type StagingCampaignLifecycle } from "../staging/stagingCampaignStore";

export type Lifecycle = StagingCampaignLifecycle;
export type ApplicationStatus = StagingApplicationStatus;
export type CommandFailure = { ok:false; category:"VALIDATION"|"NOT_FOUND"|"STATE_CONFLICT"|"CAPABILITY_UNAVAILABLE"|"DUPLICATE"|"QUOTA"|"PACING"|"INTEGRATION_UNAVAILABLE"; message:string };
export type CommandSuccess<T={}> = { ok:true; data:T };
export type CommandResult<T={}> = CommandSuccess<T>|CommandFailure;

export class StagingCommandRepository {
  constructor(private readonly store: StagingCampaignStore = stagingCampaignStore) {}

  get campaign(){return this.store.campaign;}
  getOutreachReplay<T>(requestId:string):T|undefined{return this.campaign.outreachReplays.get(requestId) as T|undefined;}
  saveOutreachReplay(requestId:string,value:unknown){this.campaign.outreachReplays.set(requestId,value);}
  getShareReplay<T>(requestId:string):T|undefined{return this.campaign.shareReplays.get(requestId) as T|undefined;}
  saveShareReplay(requestId:string,value:unknown){this.campaign.shareReplays.set(requestId,value);}
  getPriorityDmReplay<T>(requestId:string):T|undefined{return this.campaign.priorityDmReplays.get(requestId) as T|undefined;}
  savePriorityDmReplay(requestId:string,value:unknown){this.campaign.priorityDmReplays.set(requestId,value);}
  getEmailRetryReplay<T>(requestId:string):T|undefined{return this.campaign.emailRetryReplays.get(requestId) as T|undefined;}
  saveEmailRetryReplay(requestId:string,value:unknown){this.campaign.emailRetryReplays.set(requestId,value);}
}
