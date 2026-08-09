import { StagingCommandRepository, type ApplicationStatus, type CommandResult, type Lifecycle } from "./stagingCommandRepository";
import {
  ApplicationService,
  CampaignCreatorService,
  CampaignService,
  OpportunityService,
  OutreachService,
  ShareService,
  type ApplicantDecisionInput,
  type CampaignLifecycleInput,
  type CampaignShareInput,
  type ComposeOutreachInput,
  type InitiateEmailOutreachInput,
  type ManualCreatorInput,
  type AddCampaignAssetInput,
  type DeactivateCampaignAssetInput,
  type CreateBriefDraftInput,
  type UpdateBriefDraftInput,
  type PublishBriefInput,
  type UpdatePublishedBriefInput,
  type PauseBriefInput,
  type ImportCreatorsCsvInput,
  type ArchiveCampaignCreatorInput,
  type ConfirmPriorityDmInput,
  type RetryEmailComposeInput,
} from "./services";

/** Typed command façade. Focused services retain validation and domain/state ownership. */
export class CampaignCommandService {
  readonly campaign:CampaignService;
  readonly creators:CampaignCreatorService;
  readonly opportunities:OpportunityService;
  readonly outreach:OutreachService;
  readonly applications:ApplicationService;
  readonly share:ShareService;

  constructor(repo=new StagingCommandRepository()){this.campaign=new CampaignService(repo);this.creators=new CampaignCreatorService(repo);this.opportunities=new OpportunityService(repo);this.outreach=new OutreachService(repo);this.applications=new ApplicationService(repo);this.share=new ShareService(repo);}

  pause(input:CampaignLifecycleInput):CommandResult<{status:Lifecycle}>{return this.campaign.pause(input);}
  resume(input:CampaignLifecycleInput):CommandResult<{status:Lifecycle}>{return this.campaign.resume(input);}
  complete(input:CampaignLifecycleInput):CommandResult<{status:Lifecycle}>{return this.campaign.complete(input);}
  archive(input:CampaignLifecycleInput):CommandResult<{status:Lifecycle}>{return this.campaign.archive(input);}
  addManualCreator(input:ManualCreatorInput):CommandResult{return this.creators.addManual(input);}
  importCreatorsCsv(input:ImportCreatorsCsvInput):CommandResult<{accepted:number;duplicates:number}>{return this.creators.importCsv(input);}
  archiveCampaignCreator(input:ArchiveCampaignCreatorInput):CommandResult<{campaignCreatorId:string}>{return this.creators.archive(input);}
  addProduct(input:AddCampaignAssetInput):CommandResult<{campaignAssetId:string}>{return this.opportunities.addProduct(input);}
  deactivateProduct(input:DeactivateCampaignAssetInput):CommandResult<{campaignAssetId:string;status:"PAUSED"}>{return this.opportunities.deactivateProduct(input);}
  createBriefDraft(input:CreateBriefDraftInput):CommandResult<{briefId:string}>{return this.opportunities.createBriefDraft(input);}
  editBriefDraft(input:UpdateBriefDraftInput):CommandResult<{briefId:string}>{return this.opportunities.editBriefDraft(input);}
  publishBrief(input:PublishBriefInput):CommandResult<{briefId:string;status:"PUBLISHED"}>{return this.opportunities.publishBrief(input);}
  editPublishedBrief(input:UpdatePublishedBriefInput):CommandResult<{briefId:string}>{return this.opportunities.editPublishedBrief(input);}
  pauseBrief(input:PauseBriefInput):CommandResult<{briefId:string;status:"PAUSED"}>{return this.opportunities.pauseBrief(input);}
  composeOutreach(input:ComposeOutreachInput):CommandResult<{path:"EMAIL"|"PRIORITY_DM"}>{return this.outreach.compose(input);}
  initiateEmailOutreach(input:InitiateEmailOutreachInput):CommandResult<{status:"COMPOSE_INITIATED"}>{return this.outreach.initiate(input);}
  confirmPriorityDmOutreach(input:ConfirmPriorityDmInput):CommandResult<{status:"COMPOSE_INITIATED"}>{return this.outreach.confirmPriorityDm(input);}
  retryEmailCompose(input:RetryEmailComposeInput):CommandResult<{status:"COMPOSE_INITIATED"}>{return this.outreach.retryEmailCompose(input);}
  approveApplicant(input:ApplicantDecisionInput):CommandResult<{status:ApplicationStatus}>{return this.applications.approve(input);}
  rejectApplicant(input:ApplicantDecisionInput):CommandResult<{status:ApplicationStatus}>{return this.applications.reject(input);}
  executeShare(input:CampaignShareInput):CommandResult<{message:string;accepted:true}>{return this.share.execute(input);}
}
