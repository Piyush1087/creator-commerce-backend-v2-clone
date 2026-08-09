import type { z } from "zod";
import {
  addCampaignAssetInputSchema,
  approveApplicationInputSchema,
  archiveCampaignInputSchema,
  completeCampaignInputSchema,
  confirmPriorityDmOutreachInputSchema,
  composeOutreachInputSchema,
  createBriefDraftInputSchema,
  deactivateCampaignAssetInputSchema,
  executeCampaignShareInputSchema,
  initiateEmailOutreachInputSchema,
  manualCreatorInputSchema,
  importCreatorsCsvInputSchema,
  archiveCampaignCreatorInputSchema,
  pauseCampaignInputSchema,
  pauseBriefInputSchema,
  publishBriefInputSchema,
  rejectApplicationInputSchema,
  resumeCampaignInputSchema,
  retryEmailComposeInputSchema,
  updateBriefDraftInputSchema,
  updatePublishedBriefInputSchema,
} from "../../validation";
import { StagingCommandRepository, type ApplicationStatus, type CommandFailure, type CommandResult, type Lifecycle } from "./stagingCommandRepository";

export type CampaignLifecycleInput = z.input<typeof pauseCampaignInputSchema>;
export type ManualCreatorInput = z.input<typeof manualCreatorInputSchema>;
export type ComposeOutreachInput = z.input<typeof composeOutreachInputSchema>;
export type InitiateEmailOutreachInput = z.input<typeof initiateEmailOutreachInputSchema>;
export type ApplicantDecisionInput = z.input<typeof approveApplicationInputSchema>;
export type CampaignShareInput = z.input<typeof executeCampaignShareInputSchema>;
export type AddCampaignAssetInput = z.input<typeof addCampaignAssetInputSchema>;
export type DeactivateCampaignAssetInput = z.input<typeof deactivateCampaignAssetInputSchema>;
export type CreateBriefDraftInput = z.input<typeof createBriefDraftInputSchema>;
export type UpdateBriefDraftInput = z.input<typeof updateBriefDraftInputSchema>;
export type PublishBriefInput = z.input<typeof publishBriefInputSchema>;
export type UpdatePublishedBriefInput = z.input<typeof updatePublishedBriefInputSchema>;
export type PauseBriefInput = z.input<typeof pauseBriefInputSchema>;
export type ImportCreatorsCsvInput = z.input<typeof importCreatorsCsvInputSchema>;
export type ArchiveCampaignCreatorInput = z.input<typeof archiveCampaignCreatorInputSchema>;
export type ConfirmPriorityDmInput = z.input<typeof confirmPriorityDmOutreachInputSchema>;
export type RetryEmailComposeInput = z.input<typeof retryEmailComposeInputSchema>;

const transition:Record<Lifecycle,Lifecycle[]>={DRAFT:["PUBLISHED"],PUBLISHED:["LIVE"],LIVE:["PAUSED","COMPLETED"],PAUSED:["LIVE","COMPLETED"],COMPLETED:["ARCHIVED"],ARCHIVED:[]};
const validationFailure=(error:{issues:Array<{message:string}>}):CommandFailure=>({ok:false,category:"VALIDATION",message:error.issues[0]?.message??"Command input is invalid."});

export class CampaignService {
  constructor(private repo:StagingCommandRepository){}

  pause(input:CampaignLifecycleInput):CommandResult<{status:Lifecycle}>{const parsed=pauseCampaignInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);return this.lifecycle("PAUSED");}
  resume(input:CampaignLifecycleInput):CommandResult<{status:Lifecycle}>{const parsed=resumeCampaignInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);return this.lifecycle("LIVE");}
  complete(input:CampaignLifecycleInput):CommandResult<{status:Lifecycle}>{const parsed=completeCampaignInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);return this.lifecycle("COMPLETED");}
  archive(input:CampaignLifecycleInput):CommandResult<{status:Lifecycle}>{const parsed=archiveCampaignInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);return this.lifecycle("ARCHIVED");}
  lifecycle(target:Lifecycle):CommandResult<{status:Lifecycle}>{const current=this.repo.campaign.status;if(!transition[current].includes(target))return{ok:false,category:"STATE_CONFLICT",message:"Campaign transition is not allowed."};if(target==="LIVE"&&!this.repo.campaign.executionReady)return{ok:false,category:"CAPABILITY_UNAVAILABLE",message:"Campaign is not execution ready."};this.repo.campaign.status=target;return{ok:true,data:{status:target}};}
}

export class CampaignCreatorService {
  constructor(private repo:StagingCommandRepository){}

  addManual(input:ManualCreatorInput):CommandResult{const parsed=manualCreatorInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);const key=parsed.data.socialHandle.toLowerCase();if(this.repo.campaign.creators.has(key))return{ok:false,category:"DUPLICATE",message:"Creator already exists for this Campaign."};this.repo.campaign.creators.add(key);return{ok:true,data:{}};}
  archive(input:ArchiveCampaignCreatorInput):CommandResult<{campaignCreatorId:string}>{const parsed=archiveCampaignCreatorInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);const creator=this.repo.campaign.creatorRecords.get(parsed.data.campaignCreatorId);if(!creator)return{ok:false,category:"NOT_FOUND",message:"Campaign Creator was not found."};if(creator.archived)return{ok:false,category:"STATE_CONFLICT",message:"Campaign Creator is already archived."};creator.archived=true;return{ok:true,data:{campaignCreatorId:creator.id}};}
  importCsv(input:ImportCreatorsCsvInput):CommandResult<{accepted:number;duplicates:number}>{const parsed=importCreatorsCsvInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);let accepted=0,duplicates=0;for(const row of parsed.data.rows){const key=row.socialHandle.toLowerCase();if(this.repo.campaign.creators.has(key)){duplicates++;continue;}this.repo.campaign.creators.add(key);const id=`creator-${key}`;this.repo.campaign.creatorRecords.set(id,{id,platform:row.platform,socialHandle:key,email:row.email,archived:false});accepted++;}return{ok:true,data:{accepted,duplicates}};}
}

/** Campaign Asset and Brief ownership stays at the Opportunity boundary. */
export class OpportunityService {
  constructor(private repo:StagingCommandRepository){}

  addProduct(input:AddCampaignAssetInput):CommandResult<{campaignAssetId:string}>{const parsed=addCampaignAssetInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);const sourceId="brandProfileId" in parsed.data?parsed.data.brandProfileId:"offeringId" in parsed.data?parsed.data.offeringId:parsed.data.brandOfferId;const campaignAssetId=`asset-${this.repo.campaign.products.length+1}`;this.repo.campaign.products.push({id:campaignAssetId,name:sourceId,kind:parsed.data.kind,sourceId,status:"ACTIVE",briefs:[]});this.refreshReadiness();return{ok:true,data:{campaignAssetId}};}
  deactivateProduct(input:DeactivateCampaignAssetInput):CommandResult<{campaignAssetId:string;status:"PAUSED"}>{const parsed=deactivateCampaignAssetInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);const product=this.product(parsed.data.campaignAssetId);if(!product)return{ok:false,category:"NOT_FOUND",message:"Campaign Asset was not found."};if(product.status!=="ACTIVE")return{ok:false,category:"STATE_CONFLICT",message:"Campaign Asset is not active."};product.status="PAUSED";this.refreshReadiness();return{ok:true,data:{campaignAssetId:product.id,status:"PAUSED"}};}
  createBriefDraft(input:CreateBriefDraftInput):CommandResult<{briefId:string}>{const parsed=createBriefDraftInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);const product=this.product(parsed.data.campaignAssetId);if(!product)return{ok:false,category:"NOT_FOUND",message:"Campaign Asset was not found."};if(product.status!=="ACTIVE")return{ok:false,category:"CAPABILITY_UNAVAILABLE",message:"Campaign Asset is not active."};const briefId=`brief-${this.repo.campaign.products.reduce((count,item)=>count+item.briefs.length,0)+1}`;product.briefs.push({id:briefId,name:parsed.data.briefName??briefId,status:"DRAFT",fields:{...parsed.data}});this.refreshReadiness();return{ok:true,data:{briefId}};}
  editBriefDraft(input:UpdateBriefDraftInput):CommandResult<{briefId:string}>{const parsed=updateBriefDraftInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);const found=this.brief(parsed.data.briefId);if(!found)return{ok:false,category:"NOT_FOUND",message:"Brief was not found."};if(found.brief.status!=="DRAFT")return{ok:false,category:"STATE_CONFLICT",message:"Brief is not a draft."};Object.assign(found.brief.fields,parsed.data);if(parsed.data.briefName)found.brief.name=parsed.data.briefName;return{ok:true,data:{briefId:found.brief.id}};}
  publishBrief(input:PublishBriefInput):CommandResult<{briefId:string;status:"PUBLISHED"}>{const parsed=publishBriefInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);const found=this.brief(parsed.data.briefId);if(!found)return{ok:false,category:"NOT_FOUND",message:"Brief was not found."};if(found.product.status!=="ACTIVE")return{ok:false,category:"CAPABILITY_UNAVAILABLE",message:"Campaign Asset is not active."};if(found.brief.status!=="DRAFT")return{ok:false,category:"STATE_CONFLICT",message:"Brief is not a draft."};found.brief.status="PUBLISHED";found.brief.name=parsed.data.briefName;Object.assign(found.brief.fields,parsed.data);this.refreshReadiness();return{ok:true,data:{briefId:found.brief.id,status:"PUBLISHED"}};}
  editPublishedBrief(input:UpdatePublishedBriefInput):CommandResult<{briefId:string}>{const parsed=updatePublishedBriefInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);const found=this.brief(parsed.data.briefId);if(!found)return{ok:false,category:"NOT_FOUND",message:"Brief was not found."};if(found.brief.status!=="PUBLISHED")return{ok:false,category:"STATE_CONFLICT",message:"Brief is not published."};Object.assign(found.brief.fields,parsed.data);if(parsed.data.briefName)found.brief.name=parsed.data.briefName;return{ok:true,data:{briefId:found.brief.id}};}
  pauseBrief(input:PauseBriefInput):CommandResult<{briefId:string;status:"PAUSED"}>{const parsed=pauseBriefInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);const found=this.brief(parsed.data.briefId);if(!found)return{ok:false,category:"NOT_FOUND",message:"Brief was not found."};if(found.brief.status!=="PUBLISHED")return{ok:false,category:"STATE_CONFLICT",message:"Brief is not published."};found.brief.status="PAUSED";this.refreshReadiness();return{ok:true,data:{briefId:found.brief.id,status:"PAUSED"}};}
  private product(id:string){return this.repo.campaign.products.find(product=>product.id===id);}
  private brief(id:string){for(const product of this.repo.campaign.products){const brief=product.briefs.find(item=>item.id===id);if(brief)return{product,brief};}return undefined;}
  private refreshReadiness(){const ready=this.repo.campaign.products.some(product=>product.status==="ACTIVE"&&product.briefs.some(brief=>brief.status==="PUBLISHED"));this.repo.campaign.executionReady=ready;if(this.repo.campaign.status==="PUBLISHED"&&ready)this.repo.campaign.status="LIVE";}
}

export class OutreachService {
  constructor(private repo:StagingCommandRepository){}

  compose(input:ComposeOutreachInput):CommandResult<{path:"EMAIL"|"PRIORITY_DM"}>{const parsed=composeOutreachInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);return{ok:true,data:{path:"EMAIL"}};}
  initiate(input:InitiateEmailOutreachInput):CommandResult<{status:"COMPOSE_INITIATED"}>{const parsed=initiateEmailOutreachInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);const replay=this.repo.getOutreachReplay<CommandResult<{status:"COMPOSE_INITIATED"}>>(parsed.data.requestId);if(replay)return replay;const result:CommandResult<{status:"COMPOSE_INITIATED"}>={ok:true,data:{status:"COMPOSE_INITIATED"}};this.repo.saveOutreachReplay(parsed.data.requestId,result);return result;}
  confirmPriorityDm(input:ConfirmPriorityDmInput):CommandResult<{status:"COMPOSE_INITIATED"}>{const parsed=confirmPriorityDmOutreachInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);if(this.repo.campaign.outreachPaths.get(parsed.data.campaignCreatorId)!=="PRIORITY_DM")return{ok:false,category:"STATE_CONFLICT",message:"Priority DM is not available for this creator."};const replay=this.repo.getPriorityDmReplay<CommandResult<{status:"COMPOSE_INITIATED"}>>(parsed.data.requestId);if(replay)return replay;const result:CommandResult<{status:"COMPOSE_INITIATED"}>={ok:true,data:{status:"COMPOSE_INITIATED"}};this.repo.savePriorityDmReplay(parsed.data.requestId,result);return result;}
  retryEmailCompose(input:RetryEmailComposeInput):CommandResult<{status:"COMPOSE_INITIATED"}>{const parsed=retryEmailComposeInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);if(this.repo.campaign.outreachPaths.get(parsed.data.campaignCreatorId)!=="EMAIL")return{ok:false,category:"STATE_CONFLICT",message:"Email compose is not available for this creator."};const replay=this.repo.getEmailRetryReplay<CommandResult<{status:"COMPOSE_INITIATED"}>>(parsed.data.requestId);if(replay)return replay;const result:CommandResult<{status:"COMPOSE_INITIATED"}>={ok:true,data:{status:"COMPOSE_INITIATED"}};this.repo.saveEmailRetryReplay(parsed.data.requestId,result);return result;}
}

export class ApplicationService {
  constructor(private repo:StagingCommandRepository){}

  approve(input:ApplicantDecisionInput):CommandResult<{status:ApplicationStatus}>{const parsed=approveApplicationInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);return this.decide(parsed.data.applicationId,"APPROVED");}
  reject(input:ApplicantDecisionInput):CommandResult<{status:ApplicationStatus}>{const parsed=rejectApplicationInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);return this.decide(parsed.data.applicationId,"REJECTED");}
  decide(id:string,status:"APPROVED"|"REJECTED"):CommandResult<{status:ApplicationStatus}>{const current=this.repo.campaign.applications.get(id);if(!current)return{ok:false,category:"NOT_FOUND",message:"Application was not found."};if(current!=="PENDING")return{ok:false,category:"STATE_CONFLICT",message:"Application already has a terminal state."};this.repo.campaign.applications.set(id,status);return{ok:true,data:{status}};}
}

export class ShareService {
  constructor(private repo:StagingCommandRepository){}

  execute(input:CampaignShareInput):CommandResult<{message:string;accepted:true}>{const parsed=executeCampaignShareInputSchema.safeParse(input);if(!parsed.success)return validationFailure(parsed.error);const replay=this.repo.getShareReplay<CommandResult<{message:string;accepted:true}>>(parsed.data.requestId);if(replay)return replay;const result:CommandResult<{message:string;accepted:true}>={ok:true,data:{message:"Join Summer Glow Launch",accepted:true}};this.repo.campaign.shareEvidence.set(parsed.data.requestId,{campaignId:parsed.data.campaignId,channel:parsed.data.channel});this.repo.saveShareReplay(parsed.data.requestId,result);return result;}
}
