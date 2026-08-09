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
import {
  domainToPublicSlug,
  buildPublicBrandPath,
} from "../public-brand/utils/brand-slug.util";
import { BrandCentreAuthService } from "./brand-centre-auth.service";
import {
  CreateCompetitorDto,
  CreateOfferDto,
  CreateOfferingDto,
  CreatePersonaDto,
  PatchBudgetCeilingDto,
  PatchBudgetMixesDto,
  PatchDnaIdentityDto,
  PatchDnaNarrativeDto,
  PatchDnaProfileDto,
  ScanUrlDto,
  UpdateOfferDto,
  UpdateOfferingDto,
  UpdatePersonaDto,
} from "./dto/brand-centre-dna.dto";
import { LeaksQueryDto, PatchLeakDto } from "./dto/brand-centre-intelligence.dto";
import { PatchPlannerCardDto } from "./dto/brand-centre-planner.dto";
import { BrandCentreBudgetService } from "./services/brand-centre-budget.service";
import { BrandCentreDnaService } from "./services/brand-centre-dna.service";
import { BrandCentreIntelligenceService } from "./services/brand-centre-intelligence.service";
import { BrandCentrePlannerService } from "./services/brand-centre-planner.service";
import { BrandCentreRoutingService } from "./services/brand-centre-routing.service";
import { BrandCentreScanService } from "./services/brand-centre-scan.service";
import { BrandCentreSessionEvictionService } from "./services/brand-centre-session-eviction.service";

@Controller("api/v1/brand-centre")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandCentreController {
  constructor(
    private readonly auth: BrandCentreAuthService,
    private readonly routing: BrandCentreRoutingService,
    private readonly scan: BrandCentreScanService,
    private readonly dna: BrandCentreDnaService,
    private readonly budget: BrandCentreBudgetService,
    private readonly intelligence: BrandCentreIntelligenceService,
    private readonly planner: BrandCentrePlannerService,
    private readonly sessionEviction: BrandCentreSessionEvictionService,
  ) {}

  private async profileContext(req: RequestWithAuthUser) {
    const profile = await this.auth.resolveBrandProfile(req.user);
    return {
      brandProfileId: profile.id,
      currencyCode: profile.currencyCode,
      profile,
    };
  }

  @Get("routing-template")
  async getRoutingTemplate(@Req() req: RequestWithAuthUser) {
    const profile = await this.auth.resolveBrandProfile(req.user);
    const template = this.routing.resolveTemplateForProfile(profile);
    return {
      routingType: profile.brandRoutingType,
      template,
    };
  }

  @Get("collaboration-page")
  async getCollaborationPage(@Req() req: RequestWithAuthUser) {
    const profile = await this.auth.resolveBrandProfile(req.user);
    const slug = domainToPublicSlug(profile.domain);
    return {
      brand_id: profile.id,
      slug,
      company_name: profile.name,
      public_path: buildPublicBrandPath(slug),
    };
  }

  @Get("scan-status")
  async getScanStatus(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.scan.getScanStatus(brandProfileId);
  }

  @Post("scan/retry")
  @HttpCode(200)
  async retryDeepScan(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.scan.retryDeepScan(brandProfileId);
  }

  @Get("dna")
  async getDna(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.getDnaAggregate(brandProfileId);
  }

  @Patch("dna/profile")
  async patchProfile(
    @Req() req: RequestWithAuthUser,
    @Body() body: PatchDnaProfileDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.patchProfile(brandProfileId, body);
  }

  @Patch("dna/narrative")
  async patchNarrative(
    @Req() req: RequestWithAuthUser,
    @Body() body: PatchDnaNarrativeDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.patchNarrative(brandProfileId, body);
  }

  @Patch("dna/identity")
  async patchIdentity(
    @Req() req: RequestWithAuthUser,
    @Body() body: PatchDnaIdentityDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.patchIdentity(brandProfileId, body);
  }

  @Get("dna/personas")
  async listPersonas(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.listPersonas(brandProfileId);
  }

  @Post("dna/personas")
  async createPersona(
    @Req() req: RequestWithAuthUser,
    @Body() body: CreatePersonaDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.createPersona(brandProfileId, body);
  }

  @Patch("dna/personas/:personaId")
  async updatePersona(
    @Req() req: RequestWithAuthUser,
    @Param("personaId") personaId: string,
    @Body() body: UpdatePersonaDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.updatePersona(brandProfileId, personaId, body);
  }

  @Delete("dna/personas/:personaId")
  @HttpCode(204)
  async deletePersona(
    @Req() req: RequestWithAuthUser,
    @Param("personaId") personaId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    await this.dna.deletePersona(brandProfileId, personaId);
  }

  @Get("dna/offerings")
  async listOfferings(
    @Req() req: RequestWithAuthUser,
    @Query("kind") kind?: "primary" | "collection",
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.listOfferings(brandProfileId, kind ?? "primary");
  }

  @Post("dna/offerings/scan-url")
  @HttpCode(200)
  async scanOfferingUrl(
    @Req() req: RequestWithAuthUser,
    @Body() body: ScanUrlDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.scanOfferingUrl(brandProfileId, body.url);
  }

  @Post("dna/offerings")
  async createOffering(
    @Req() req: RequestWithAuthUser,
    @Body() body: CreateOfferingDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.createOffering(brandProfileId, body);
  }

  @Patch("dna/offerings/:offeringId")
  async updateOffering(
    @Req() req: RequestWithAuthUser,
    @Param("offeringId") offeringId: string,
    @Body() body: UpdateOfferingDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.updateOffering(brandProfileId, offeringId, body);
  }

  @Delete("dna/offerings/:offeringId")
  @HttpCode(204)
  async deleteOffering(
    @Req() req: RequestWithAuthUser,
    @Param("offeringId") offeringId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    await this.dna.deleteOffering(brandProfileId, offeringId);
  }

  @Get("dna/offers")
  async listOffers(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.listOffers(brandProfileId);
  }

  @Post("dna/offers")
  async createOffer(
    @Req() req: RequestWithAuthUser,
    @Body() body: CreateOfferDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.createOffer(brandProfileId, body);
  }

  @Patch("dna/offers/:offerId")
  async updateOffer(
    @Req() req: RequestWithAuthUser,
    @Param("offerId") offerId: string,
    @Body() body: UpdateOfferDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.updateOffer(brandProfileId, offerId, body);
  }

  @Delete("dna/offers/:offerId")
  @HttpCode(204)
  async deleteOffer(
    @Req() req: RequestWithAuthUser,
    @Param("offerId") offerId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    await this.dna.deleteOffer(brandProfileId, offerId);
  }

  @Get("dna/competitors")
  async listCompetitors(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.listCompetitors(brandProfileId);
  }

  @Post("dna/competitors/scan-url")
  @HttpCode(200)
  async scanCompetitorUrl(
    @Req() req: RequestWithAuthUser,
    @Body() body: ScanUrlDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.scanCompetitorUrl(brandProfileId, body.url);
  }

  @Post("dna/competitors")
  async createCompetitor(
    @Req() req: RequestWithAuthUser,
    @Body() body: CreateCompetitorDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.dna.createCompetitor(brandProfileId, body);
  }

  @Delete("dna/competitors/:competitorId")
  @HttpCode(204)
  async deleteCompetitor(
    @Req() req: RequestWithAuthUser,
    @Param("competitorId") competitorId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    await this.dna.deleteCompetitor(brandProfileId, competitorId);
  }

  @Get("dna/budget")
  async getBudget(@Req() req: RequestWithAuthUser) {
    const { brandProfileId, currencyCode } = await this.profileContext(req);
    return this.budget.getBudget(brandProfileId, currencyCode);
  }

  @Patch("dna/budget/ceiling")
  async patchBudgetCeiling(
    @Req() req: RequestWithAuthUser,
    @Body() body: PatchBudgetCeilingDto,
  ) {
    const { brandProfileId, currencyCode } = await this.profileContext(req);
    return this.budget.updateCeiling(
      brandProfileId,
      currencyCode,
      body.masterMonthlyBudget,
    );
  }

  @Patch("dna/budget/mixes")
  async patchBudgetMixes(
    @Req() req: RequestWithAuthUser,
    @Body() body: PatchBudgetMixesDto,
  ) {
    const { brandProfileId, currencyCode } = await this.profileContext(req);
    return this.budget.updateMixes(brandProfileId, currencyCode, body);
  }

  @Get("dna/account")
  async getAccount(@Req() req: RequestWithAuthUser) {
    const profile = await this.auth.resolveBrandProfile(req.user);
    return this.dna.getAccountPlaceholder(profile);
  }

  @Post("session/evict")
  @HttpCode(200)
  async evictSession(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.sessionEviction.evictForBrandProfile(brandProfileId);
  }

  @Get("intelligence")
  async getIntelligence(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.intelligence.getIntelligence(brandProfileId);
  }

  @Post("intelligence/refresh")
  @HttpCode(200)
  async refreshIntelligence(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.intelligence.enqueueRefresh(brandProfileId);
  }

  @Get("intelligence/leaks")
  async listLeaks(
    @Req() req: RequestWithAuthUser,
    @Query() query: LeaksQueryDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.intelligence.listLeaks(
      brandProfileId,
      query.filter ?? "active",
    );
  }

  @Get("intelligence/leaks/:leakId")
  async getLeak(
    @Req() req: RequestWithAuthUser,
    @Param("leakId") leakId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.intelligence.getLeak(brandProfileId, leakId);
  }

  @Patch("intelligence/leaks/:leakId")
  async patchLeak(
    @Req() req: RequestWithAuthUser,
    @Param("leakId") leakId: string,
    @Body() body: PatchLeakDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.intelligence.patchLeak(brandProfileId, leakId, body);
  }

  @Post("intelligence/leaks/:leakId/discard")
  @HttpCode(200)
  async discardLeak(
    @Req() req: RequestWithAuthUser,
    @Param("leakId") leakId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    await this.intelligence.discardLeak(brandProfileId, leakId);
    return { ok: true };
  }

  @Post("intelligence/leaks/:leakId/move-to-planner")
  @HttpCode(200)
  async moveToPlanner(
    @Req() req: RequestWithAuthUser,
    @Param("leakId") leakId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.intelligence.moveToPlanner(
      brandProfileId,
      leakId,
      req.user.id,
    );
  }

  @Get("planner")
  async getPlanner(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.planner.getPlannerDashboard(brandProfileId);
  }

  @Get("planner/cards/:cardId")
  async getPlannerCard(
    @Req() req: RequestWithAuthUser,
    @Param("cardId") cardId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.planner.getCard(brandProfileId, cardId);
  }

  @Patch("planner/cards/:cardId")
  async patchPlannerCard(
    @Req() req: RequestWithAuthUser,
    @Param("cardId") cardId: string,
    @Body() body: PatchPlannerCardDto,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.planner.patchCard(brandProfileId, cardId, body);
  }

  @Post("planner/cards/:cardId/approve")
  @HttpCode(200)
  async approvePlannerCard(
    @Req() req: RequestWithAuthUser,
    @Param("cardId") cardId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.planner.approveCard(brandProfileId, cardId);
  }

  @Post("planner/cards/:cardId/acknowledge")
  @HttpCode(200)
  async acknowledgePlannerCard(
    @Req() req: RequestWithAuthUser,
    @Param("cardId") cardId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.planner.acknowledgeAutoPause(brandProfileId, cardId);
  }
}
