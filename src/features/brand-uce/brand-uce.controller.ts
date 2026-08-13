import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import {
  CreateCampaignWizardDto,
  ListCampaignsQueryDto,
  PatchCampaignStatusDto,
  PatchCampaignEssentialsDto,
  PatchDraftCampaignWizardDto,
} from "./dto/brand-uce-campaign.dto";
import { UpdateCampaignBriefDto } from "./dto/brand-uce-brief.dto";
import {
  AddTrackingDto,
  ApproveApplicantDto,
  CreateProspectDto,
  InviteProspectDto,
  PipelineQueryDto,
  PublishLivePostDto,
  RecordFulfillmentIssueDto,
  RejectApplicantDto,
  ReviewContentDto,
  SubmitContentDraftDto,
} from "./dto/brand-uce-pipeline.dto";
import { UpdateCampaignProductDto } from "./dto/brand-uce-product.dto";
import { BrandUceBriefService } from "./services/brand-uce-brief.service";
import { BrandUceCampaignService } from "./services/brand-uce-campaign.service";
import { BrandUcePipelineService } from "./services/brand-uce-pipeline.service";
import { BrandUceProductService } from "./services/brand-uce-product.service";
import { BrandUceReportingService } from "./services/brand-uce-reporting.service";
import { CampaignApplicationService } from "./services/campaign-application.service";
import {
  CampaignCommandService,
  type ShareChannel,
} from "./services/campaign-command.service";
import { CampaignQueryService } from "./services/campaign-query.service";

@Controller("api/v1/brand-uce")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandUceController {
  constructor(
    private readonly auth: BrandCentreAuthService,
    private readonly campaigns: BrandUceCampaignService,
    private readonly products: BrandUceProductService,
    private readonly briefs: BrandUceBriefService,
    private readonly pipeline: BrandUcePipelineService,
    private readonly reporting: BrandUceReportingService,
    private readonly campaignQuery: CampaignQueryService,
    private readonly campaignCommands: CampaignCommandService,
    private readonly campaignApplications: CampaignApplicationService,
  ) {}

  @Get("campaigns/aggregates")
  async listAggregates(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaigns.listAggregates(brandProfileId);
  }

  @Get("campaigns")
  async listCampaigns(
    @Req() req: RequestWithAuthUser,
    @Query() query: ListCampaignsQueryDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaigns.listCampaigns(brandProfileId, query);
  }

  @Post("campaigns/wizard")
  async createWizard(
    @Req() req: RequestWithAuthUser,
    @Body() body: CreateCampaignWizardDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaigns.createFromWizard(brandProfileId, body);
  }

  @Get("campaigns/:campaignId")
  async getCampaignShell(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaigns.getCampaignShell(brandProfileId, campaignId);
  }

  @Patch("campaigns/:campaignId/wizard")
  async patchDraftWizard(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Body() body: PatchDraftCampaignWizardDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaigns.updateDraftWizard(brandProfileId, campaignId, {
      campaign_name: body.campaign_name,
      budget_allocation: body.budget_allocation,
      marketing_objective: body.marketing_objective,
    });
  }

  @Patch("campaigns/:campaignId/status")
  async patchCampaignStatus(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Body() body: PatchCampaignStatusDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaigns.patchStatus(
      brandProfileId,
      campaignId,
      body.status,
    );
  }

  @Patch("campaigns/:campaignId/essentials")
  async patchCampaignEssentials(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Body() body: PatchCampaignEssentialsDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaigns.patchCampaignEssentials(brandProfileId, campaignId, {
      campaign_name: body.campaign_name,
      budget_pool: body.budget_pool,
      product_inventories: body.product_inventories,
    });
  }

  @Get("campaigns/:campaignId/products")
  async listProducts(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.products.list(brandProfileId, campaignId);
  }

  @Post("campaigns/:campaignId/products")
  async createProduct(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Body() body: unknown,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.products.create(brandProfileId, campaignId, body);
  }

  @Patch("campaigns/:campaignId/products/:productId")
  async updateProduct(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("productId") productId: string,
    @Body() body: UpdateCampaignProductDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.products.update(brandProfileId, campaignId, productId, body);
  }

  @Delete("campaigns/:campaignId/products/:productId")
  @HttpCode(204)
  async deleteProduct(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("productId") productId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    await this.products.remove(brandProfileId, campaignId, productId);
  }

  @Get("campaigns/:campaignId/briefs")
  async listBriefs(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.briefs.list(brandProfileId, campaignId);
  }

  @Post("campaigns/:campaignId/briefs")
  async createBrief(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Body() body: unknown,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.briefs.create(brandProfileId, campaignId, body);
  }

  @Patch("campaigns/:campaignId/briefs/:briefId")
  async updateBrief(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("briefId") briefId: string,
    @Body() body: UpdateCampaignBriefDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.briefs.update(brandProfileId, campaignId, briefId, body);
  }

  @Delete("campaigns/:campaignId/briefs/:briefId")
  @HttpCode(204)
  async deleteBrief(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("briefId") briefId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    await this.briefs.remove(brandProfileId, campaignId, briefId);
  }

  @Get("campaigns/:campaignId/pipeline/prospects")
  async listProspects(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Query() query: PipelineQueryDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.listProspects(brandProfileId, campaignId, query);
  }

  @Get("campaigns/:campaignId/pipeline/applicants")
  async listApplicants(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Query() query: PipelineQueryDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.listApplicants(brandProfileId, campaignId, query);
  }

  @Get("campaigns/:campaignId/pipeline/active-collabs")
  async listActiveCollabs(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Query() query: PipelineQueryDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.listActiveCollabs(brandProfileId, campaignId, query);
  }

  @Get("campaigns/:campaignId/pipeline/collaborations/:collaborationId")
  async getCollaboration(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("collaborationId") collaborationId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.getCollaborationDetail(
      brandProfileId,
      campaignId,
      collaborationId,
    );
  }

  @Post("campaigns/:campaignId/pipeline/applicants")
  async createApplicant(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Body() body: CreateProspectDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.createApplicant(
      brandProfileId,
      campaignId,
      body,
      req.user.id,
    );
  }

  @Post("campaigns/:campaignId/pipeline/prospects")
  async createProspect(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Body() body: CreateProspectDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.createProspect(
      brandProfileId,
      campaignId,
      body,
      req.user.id,
    );
  }

  @Post("campaigns/:campaignId/pipeline/collaborations/:collaborationId/invite")
  @HttpCode(200)
  async inviteProspect(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("collaborationId") collaborationId: string,
    @Body() body: InviteProspectDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.inviteProspect(
      brandProfileId,
      campaignId,
      collaborationId,
      req.user.id,
      body.outreach_message,
    );
  }

  @Post("campaigns/:campaignId/pipeline/collaborations/:collaborationId/approve")
  @HttpCode(200)
  async approveApplicant(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("collaborationId") collaborationId: string,
    @Body() body: ApproveApplicantDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.approveApplicant(
      brandProfileId,
      campaignId,
      collaborationId,
      body,
      req.user.id,
    );
  }

  @Post("campaigns/:campaignId/pipeline/collaborations/:collaborationId/reject")
  @HttpCode(200)
  async rejectApplicant(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("collaborationId") collaborationId: string,
    @Body() body: RejectApplicantDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.rejectApplicant(
      brandProfileId,
      campaignId,
      collaborationId,
      body,
      req.user.id,
    );
  }

  @Post("campaigns/:campaignId/pipeline/collaborations/:collaborationId/tracking")
  @HttpCode(200)
  async addTracking(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("collaborationId") collaborationId: string,
    @Body() body: AddTrackingDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.addTracking(
      brandProfileId,
      campaignId,
      collaborationId,
      body,
      req.user.id,
    );
  }

  @Post("campaigns/:campaignId/pipeline/collaborations/:collaborationId/content-draft")
  @HttpCode(200)
  async submitContentDraft(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("collaborationId") collaborationId: string,
    @Body() body: SubmitContentDraftDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.submitContentDraft(
      brandProfileId,
      campaignId,
      collaborationId,
      body,
      req.user.id,
    );
  }

  @Post("campaigns/:campaignId/pipeline/collaborations/:collaborationId/review-content")
  @HttpCode(200)
  async reviewContent(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("collaborationId") collaborationId: string,
    @Body() body: ReviewContentDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.reviewContent(
      brandProfileId,
      campaignId,
      collaborationId,
      body,
      req.user.id,
    );
  }

  @Post("campaigns/:campaignId/pipeline/collaborations/:collaborationId/publish")
  @HttpCode(200)
  async publishLive(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("collaborationId") collaborationId: string,
    @Body() body: PublishLivePostDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.publishLivePost(
      brandProfileId,
      campaignId,
      collaborationId,
      body,
      req.user.id,
    );
  }

  @Post("campaigns/:campaignId/pipeline/collaborations/:collaborationId/fulfillment-issue")
  @HttpCode(200)
  async fulfillmentIssue(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("collaborationId") collaborationId: string,
    @Body() body: RecordFulfillmentIssueDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.pipeline.recordFulfillmentIssue(
      brandProfileId,
      campaignId,
      collaborationId,
      body,
      req.user.id,
    );
  }

  @Get("campaigns/:campaignId/reporting")
  async getReporting(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.reporting.getDashboard(brandProfileId, campaignId);
  }

  @Post("campaigns/:campaignId/reporting/refresh-sync")
  @HttpCode(200)
  async refreshReporting(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.reporting.forceRefreshSync(brandProfileId, campaignId);
  }

  @Get("campaigns/:campaignId/page")
  async getCampaignPage(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaignQuery.getCampaignPage(brandProfileId, campaignId);
  }

  @Get("campaigns/:campaignId/discovery")
  async getDiscoveryWorkspace(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaignQuery.getDiscovery(brandProfileId, campaignId);
  }

  @Get("campaigns/:campaignId/applications")
  async getApplicationsWorkspace(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaignQuery.getApplicants(brandProfileId, campaignId);
  }

  @Post("campaigns/:campaignId/applications/:applicationId/approve")
  @HttpCode(200)
  async approveApplication(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("applicationId") applicationId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaignApplications.approve(
      brandProfileId,
      campaignId,
      applicationId,
      req.user.id,
    );
  }

  @Post("campaigns/:campaignId/applications/:applicationId/reject")
  @HttpCode(200)
  async rejectApplication(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: { reason?: string },
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaignApplications.reject(
      brandProfileId,
      campaignId,
      applicationId,
      req.user.id,
      body?.reason,
    );
  }

  @Get("campaigns/:campaignId/products/:campaignAssetId/details")
  async getProductDetails(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("campaignAssetId") campaignAssetId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaignQuery.getProductDetails(
      brandProfileId,
      campaignId,
      campaignAssetId,
    );
  }

  @Get("campaigns/:campaignId/briefs/:briefId/details")
  async getBriefDetails(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("briefId") briefId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaignQuery.getBriefDetails(
      brandProfileId,
      campaignId,
      briefId,
    );
  }

  @Get("campaigns/:campaignId/creators/:campaignCreatorId/profile")
  async getCreatorProfile(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Param("campaignCreatorId") campaignCreatorId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaignQuery.getCreatorProfile(
      brandProfileId,
      campaignId,
      campaignCreatorId,
    );
  }

  @Post("campaigns/:campaignId/publish")
  @HttpCode(200)
  async publishCampaign(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaigns.publishCampaign(brandProfileId, campaignId);
  }

  @Post("campaigns/:campaignId/go-live")
  @HttpCode(200)
  async goLiveCampaign(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaigns.goLiveCampaign(brandProfileId, campaignId);
  }

  @Post("campaigns/:campaignId/share")
  @HttpCode(200)
  async shareCampaign(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Body() body: { channel: ShareChannel; requestId: string },
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaignCommands.executeShare(
      brandProfileId,
      campaignId,
      body.channel,
      body.requestId,
    );
  }

  @Post("campaigns/:campaignId/outreach/compose")
  @HttpCode(200)
  async composeOutreach(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Body()
    body: {
      campaignCreatorId: string;
      /** @deprecated Prefer campaignCreatorId; kept for transitional clients. */
      collaborationId?: string;
      brandInstruction?: string;
    },
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.campaignCommands.composeOutreach(
      brandProfileId,
      campaignId,
      body.campaignCreatorId ?? body.collaborationId ?? "",
      body.brandInstruction,
    );
  }
}
