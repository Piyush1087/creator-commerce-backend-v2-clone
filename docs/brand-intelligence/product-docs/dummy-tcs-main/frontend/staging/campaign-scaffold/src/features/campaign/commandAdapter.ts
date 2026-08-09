import { CampaignCommandService } from "../../../../../../backend/campaign/commands/CampaignCommandService";
import type { CampaignUiActionResult } from "./actionModel";
import type {
  AddCampaignAssetInput, ApplicantDecisionInput, ArchiveCampaignCreatorInput, CampaignLifecycleInput,
  CampaignShareInput, ComposeOutreachInput, ConfirmPriorityDmInput, CreateBriefDraftInput,
  DeactivateCampaignAssetInput, ImportCreatorsCsvInput, InitiateEmailOutreachInput, ManualCreatorInput,
  PauseBriefInput, PublishBriefInput, RetryEmailComposeInput, UpdateBriefDraftInput, UpdatePublishedBriefInput,
} from "../../../../../../backend/campaign/commands/services";

export interface CampaignCommandAdapter {
  pause(input: CampaignLifecycleInput): Promise<CampaignUiActionResult>; resume(input: CampaignLifecycleInput): Promise<CampaignUiActionResult>; complete(input: CampaignLifecycleInput): Promise<CampaignUiActionResult>; archive(input: CampaignLifecycleInput): Promise<CampaignUiActionResult>;
  addProduct(input: AddCampaignAssetInput): Promise<CampaignUiActionResult>; deactivateProduct(input: DeactivateCampaignAssetInput): Promise<CampaignUiActionResult>;
  createBriefDraft(input: CreateBriefDraftInput): Promise<CampaignUiActionResult>; editBriefDraft(input: UpdateBriefDraftInput): Promise<CampaignUiActionResult>; publishBrief(input: PublishBriefInput): Promise<CampaignUiActionResult>; editPublishedBrief(input: UpdatePublishedBriefInput): Promise<CampaignUiActionResult>; pauseBrief(input: PauseBriefInput): Promise<CampaignUiActionResult>;
  addManualCreator(input: ManualCreatorInput): Promise<CampaignUiActionResult>; importCreatorsCsv(input: ImportCreatorsCsvInput): Promise<CampaignUiActionResult>; archiveCampaignCreator(input: ArchiveCampaignCreatorInput): Promise<CampaignUiActionResult>;
  composeOutreach(input: ComposeOutreachInput): Promise<CampaignUiActionResult>; initiateEmailOutreach(input: InitiateEmailOutreachInput): Promise<CampaignUiActionResult>; confirmPriorityDmOutreach(input: ConfirmPriorityDmInput): Promise<CampaignUiActionResult>; retryEmailCompose(input: RetryEmailComposeInput): Promise<CampaignUiActionResult>;
  approveApplicant(input: ApplicantDecisionInput): Promise<CampaignUiActionResult>; rejectApplicant(input: ApplicantDecisionInput): Promise<CampaignUiActionResult>; executeShare(input: CampaignShareInput): Promise<CampaignUiActionResult>;
}

/** Staging transport boundary. Presentation components never invoke CampaignCommandService directly. */
export function createStagingCampaignCommandAdapter(commands = new CampaignCommandService()): CampaignCommandAdapter {
  const toResult = (result: { ok: boolean; category?: string; message?: string }): CampaignUiActionResult => ({ ok: result.ok, category: result.category, message: result.message });
  return {
    async pause(input){return toResult(commands.pause(input));}, async resume(input){return toResult(commands.resume(input));}, async complete(input){return toResult(commands.complete(input));}, async archive(input){return toResult(commands.archive(input));},
    async addProduct(input){return toResult(commands.addProduct(input));}, async deactivateProduct(input){return toResult(commands.deactivateProduct(input));},
    async createBriefDraft(input){return toResult(commands.createBriefDraft(input));}, async editBriefDraft(input){return toResult(commands.editBriefDraft(input));}, async publishBrief(input){return toResult(commands.publishBrief(input));}, async editPublishedBrief(input){return toResult(commands.editPublishedBrief(input));}, async pauseBrief(input){return toResult(commands.pauseBrief(input));},
    async addManualCreator(input){return toResult(commands.addManualCreator(input));}, async importCreatorsCsv(input){return toResult(commands.importCreatorsCsv(input));}, async archiveCampaignCreator(input){return toResult(commands.archiveCampaignCreator(input));},
    async composeOutreach(input){return toResult(commands.composeOutreach(input));}, async initiateEmailOutreach(input){return toResult(commands.initiateEmailOutreach(input));}, async confirmPriorityDmOutreach(input){return toResult(commands.confirmPriorityDmOutreach(input));}, async retryEmailCompose(input){return toResult(commands.retryEmailCompose(input));},
    async approveApplicant(input){return toResult(commands.approveApplicant(input));}, async rejectApplicant(input){return toResult(commands.rejectApplicant(input));}, async executeShare(input){return toResult(commands.executeShare(input));},
  };
}
