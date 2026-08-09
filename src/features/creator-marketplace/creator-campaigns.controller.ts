import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../creator-onboarding/pipes/zod-validation.pipe";
import { CreatorCampaignsCommandService } from "./services/creator-campaigns-command.service";
import { CreatorCampaignsWorkspaceService } from "./services/creator-campaigns-workspace.service";
import {
  ClaimBrandInvitationSchema,
  CommandCenterQuerySchema,
  ConfirmLogisticsReceiptSchema,
  HistoryArchiveQuerySchema,
  SubmitContentDraftSchema,
} from "./schemas/command-center.schema";

/**
 * Command center + history for creator campaign collaborations.
 */
@Controller("api/v1/creator/campaigns")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorCampaignsController {
  constructor(
    private readonly workspace: CreatorCampaignsWorkspaceService,
    private readonly commands: CreatorCampaignsCommandService,
  ) {}

  @Get("workspace")
  getWorkspace(
    @Req() req: RequestWithAuthUser,
    @Query(new ZodValidationPipe(CommandCenterQuerySchema))
    query: ReturnType<typeof CommandCenterQuerySchema.parse>,
  ) {
    return this.workspace.getWorkspace(req.user, query);
  }

  @Get("history")
  getHistory(
    @Req() req: RequestWithAuthUser,
    @Query(new ZodValidationPipe(HistoryArchiveQuerySchema))
    query: ReturnType<typeof HistoryArchiveQuerySchema.parse>,
  ) {
    return this.workspace.getHistory(req.user, query);
  }

  @Post("invitations/claim")
  claimInvitation(
    @Req() req: RequestWithAuthUser,
    @Body(new ZodValidationPipe(ClaimBrandInvitationSchema)) body: unknown,
  ) {
    return this.commands.claimBrandInvitation(
      req.user,
      body as ReturnType<typeof ClaimBrandInvitationSchema.parse>,
    );
  }

  @Post("logistics/confirm-receipt")
  confirmLogisticsReceipt(
    @Req() req: RequestWithAuthUser,
    @Body(new ZodValidationPipe(ConfirmLogisticsReceiptSchema)) body: unknown,
  ) {
    return this.commands.confirmLogisticsReceipt(
      req.user,
      body as ReturnType<typeof ConfirmLogisticsReceiptSchema.parse>,
    );
  }

  @Post("content/submit-draft")
  submitContentDraft(
    @Req() req: RequestWithAuthUser,
    @Body(new ZodValidationPipe(SubmitContentDraftSchema)) body: unknown,
  ) {
    return this.commands.submitContentDraft(
      req.user,
      body as ReturnType<typeof SubmitContentDraftSchema.parse>,
    );
  }
}
