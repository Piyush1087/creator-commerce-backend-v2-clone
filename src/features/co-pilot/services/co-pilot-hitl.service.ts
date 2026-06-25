import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BrandCentreJobStatus, IndustryVertical, PlannerWorkflowStatus } from "@prisma/client";

import { BrandCentreDnaService } from "../../brand-centre/services/brand-centre-dna.service";
import { BrandCentreIntelligenceService } from "../../brand-centre/services/brand-centre-intelligence.service";
import { BrandCentrePlannerService } from "../../brand-centre/services/brand-centre-planner.service";
import { BrandCentreUceBridgeService } from "../../brand-centre-uce-bridge/services/brand-centre-uce-bridge.service";
import { BrandUceCampaignService } from "../../brand-uce/services/brand-uce-campaign.service";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  buildBridgeInjectSignals,
  buildBridgeLaunchSignal,
} from "../utils/planner-bridge-payload.util";
import { buildPlannerReadyFollowUp } from "../utils/co-pilot-planner.util";
import {
  mergeIdentityPatch,
  parsePaletteColorsInput,
  type DnaIdentityUpdateAxis,
} from "../utils/co-pilot-dna-identity.util";
import type { WriteIntentKind } from "./co-pilot-intent.service";
import { CoPilotSlotSessionService } from "./co-pilot-slot-session.service";
import { CoPilotThreadService } from "./co-pilot-thread.service";

export type HitlConfirmResult = {
  intent: WriteIntentKind;
  message?: string;
  campaignId?: string;
  campaignName?: string;
  plannerCardId?: string;
  pendingBrandCentreJobId?: string;
  hitlResolution: {
    status: "CONFIRMED";
    resolvedAt: string;
    summary: string;
    campaignId?: string;
    campaignName?: string;
    plannerCardId?: string;
    brandCentreJobId?: string;
  };
};

@Injectable()
export class CoPilotHitlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slotSessions: CoPilotSlotSessionService,
    private readonly threads: CoPilotThreadService,
    private readonly uceCampaigns: BrandUceCampaignService,
    private readonly dna: BrandCentreDnaService,
    private readonly intelligence: BrandCentreIntelligenceService,
    private readonly planner: BrandCentrePlannerService,
    private readonly bridge: BrandCentreUceBridgeService,
  ) {}

  async confirmStaged(args: {
    brandProfileId: string;
    userId: string;
    threadId: string;
    idempotencyKey: string;
  }): Promise<HitlConfirmResult> {
    const prior = await this.threads.findHitlResolution(
      args.threadId,
      args.idempotencyKey,
    );
    if (prior?.status === "CONFIRMED") {
      throw new BadRequestException("This action was already confirmed.");
    }
    if (prior?.status === "DISCARDED") {
      throw new BadRequestException("This action was discarded.");
    }

    const session = await this.slotSessions.getActiveSession(args.threadId);
    if (!session) {
      throw new NotFoundException("No staged session for this thread.");
    }

    const staged = this.normalizeStagedPayload(
      session.stagedPayload as Record<string, unknown>,
    );
    if (staged.idempotencyKey !== args.idempotencyKey) {
      throw new BadRequestException("Idempotency key does not match staged widget.");
    }

    const intent = session.intentWorkspaceContext as WriteIntentKind;

    switch (intent) {
      case "CAMPAIGN_LAUNCH":
        return this.confirmCampaignLaunch(args, staged);
      case "CAMPAIGN_EDIT_DRAFT":
        return this.confirmCampaignEditDraft(args, staged);
      case "INTELLIGENCE_MOVE_TO_PLANNER":
        return this.confirmIntelligenceMoveToPlanner(args, staged);
      case "PLANNER_LAUNCH_DRAFT":
        return this.confirmPlannerLaunchDraft(args, staged);
      case "DNA_IDENTITY_UPDATE":
        return this.confirmDnaIdentity(args, staged);
      case "DNA_OFFERING_UPDATE":
        return this.confirmDnaOffering(args, staged);
      case "DNA_PERSONA_CREATE":
        return this.confirmDnaPersonaCreate(args, staged);
      default:
        throw new BadRequestException(`Unsupported HITL intent: ${intent}`);
    }
  }

  async discardStaged(args: { threadId: string; idempotencyKey: string }) {
    const session = await this.slotSessions.getActiveSession(args.threadId);
    if (!session) {
      return { ok: true };
    }

    const staged = session.stagedPayload as Record<string, unknown>;
    if (staged.idempotencyKey !== args.idempotencyKey) {
      throw new BadRequestException("Idempotency key does not match staged widget.");
    }

    await this.slotSessions.clearSession(args.threadId);
    const resolvedAt = new Date().toISOString();
    await this.threads.persistHitlResolution(args.threadId, args.idempotencyKey, {
      status: "DISCARDED",
      resolvedAt,
      summary: "Staged action discarded.",
    });

    return {
      ok: true,
      hitlResolution: {
        status: "DISCARDED" as const,
        resolvedAt,
        summary: "Staged action discarded.",
      },
    };
  }

  async buildAsyncFollowUpNarrative(args: {
    brandProfileId: string;
    jobId: string;
  }): Promise<string> {
    const job = await this.prisma.brandCentreJob.findUnique({
      where: { id: args.jobId },
    });
    if (!job || job.brandProfileId !== args.brandProfileId) {
      throw new NotFoundException("Planner job not found.");
    }

    if (job.status === BrandCentreJobStatus.FAILED) {
      throw new BadRequestException(
        job.errorMessage ??
          "Campaign Planner could not build a card. The leak was reset — you can try again.",
      );
    }

    const dashboard = await this.planner.getPlannerDashboard(args.brandProfileId);
    const payload = job.payload as { leakId?: string } | null;
    let card = dashboard.cards[0];

    if (payload?.leakId) {
      const plannerRow = await this.prisma.brandPlannerCard.findFirst({
        where: {
          brandProfileId: args.brandProfileId,
          sourceLeakId: payload.leakId,
        },
        orderBy: { createdAt: "desc" },
      });
      if (plannerRow) {
        card =
          dashboard.cards.find((entry) => entry.id === plannerRow.id) ?? card;
      }
    }

    if (card) {
      const label = card.aiContextHook ?? card.strategy.objective ?? "Planner card";
      return buildPlannerReadyFollowUp(label);
    }

    return "Campaign Planner finished processing. Open Brand Centre → Campaign Planner to review the new card.";
  }

  private normalizeStagedPayload(
    staged: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized = { ...staged };
    for (const key of ["leak_id", "planner_card_id", "campaign_id"] as const) {
      if (normalized[key]) {
        normalized[key] = this.parseSelectId(normalized[key]);
      }
    }
    return normalized;
  }

  private parseSelectId(value: unknown): string {
    const raw = String(value ?? "").trim();
    const separator = raw.indexOf("::");
    return separator >= 0 ? raw.slice(0, separator) : raw;
  }

  private async confirmCampaignLaunch(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: args.brandProfileId },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found.");
    }

    const productName = String(staged.product_name ?? "Co-Pilot Campaign");
    const budget = Number(staged.budget_allocation);
    const objective = staged.marketing_objective as
      | "BRAND_AWARENESS"
      | "TRAFFIC_CLICKS"
      | "SALES_CONVERSIONS";

    if (
      objective !== "BRAND_AWARENESS" &&
      objective !== "TRAFFIC_CLICKS" &&
      objective !== "SALES_CONVERSIONS"
    ) {
      throw new BadRequestException("Invalid marketing objective in staged payload.");
    }

    if (!Number.isFinite(budget) || budget <= 0) {
      throw new BadRequestException("Invalid budget in staged payload.");
    }

    const campaign = await this.uceCampaigns.createFromWizard(args.brandProfileId, {
      strategy: {
        campaign_name: `${productName} — Co-Pilot Draft`,
        timeline_type: "DYNAMIC_MILESTONES" as const,
        dynamic_days_limit: 30,
        core_objective: objective,
        platform_deliverables: [
          { platform: "INSTAGRAM" as const, formats: ["REEL", "STORY"] },
        ],
      },
      targeting: {
        industry_vertical: profile.industry,
        creator_archetypes: ["Lifestyle", "Beauty"],
        follower_tiers: ["MICRO", "MID_TIER"],
        audience_age_min: 22,
        audience_age_max: 40,
        audience_gender: "ALL",
        target_locations: [profile.countryCode ?? "IN"],
        disqualifying_keywords: [],
        visibility_scopes: ["EVERYONE"],
        application_scope: "EVERYONE",
      },
      commercials: {
        compensation_type: "NEGOTIABLE" as const,
        fixed_fee_amount: 0,
        negotiable_min_fee: Math.round(budget * 0.05),
        negotiable_max_fee: Math.round(budget * 0.15),
        total_campaign_budget_pool: budget,
        advance_payment_percentage: 50,
        final_balance_terms: "NET_15" as const,
      },
    });

    await this.slotSessions.clearSession(args.threadId);
    const resolvedAt = new Date().toISOString();
    const summary = `Draft campaign "${campaign.campaign_name}" created. Open Campaigns to continue setup.`;
    await this.threads.persistHitlResolution(args.threadId, String(staged.idempotencyKey), {
      status: "CONFIRMED",
      resolvedAt,
      summary,
      campaignId: campaign.campaign_id,
      campaignName: campaign.campaign_name,
    });

    return {
      intent: "CAMPAIGN_LAUNCH",
      campaignId: campaign.campaign_id,
      campaignName: campaign.campaign_name,
      hitlResolution: {
        status: "CONFIRMED",
        resolvedAt,
        summary,
        campaignId: campaign.campaign_id,
        campaignName: campaign.campaign_name,
      },
    };
  }

  private async confirmCampaignEditDraft(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const campaignId = String(staged.campaign_id ?? "").trim();
    if (!campaignId) {
      throw new BadRequestException("Draft campaign id is required.");
    }

    const budgetRaw = staged.budget_allocation;
    const budget =
      budgetRaw !== undefined && String(budgetRaw).trim() !== ""
        ? Number(budgetRaw)
        : undefined;
    const objective = staged.marketing_objective as
      | "BRAND_AWARENESS"
      | "TRAFFIC_CLICKS"
      | "SALES_CONVERSIONS"
      | undefined;

    const campaign = await this.uceCampaigns.updateDraftWizard(
      args.brandProfileId,
      campaignId,
      {
        campaign_name: staged.campaign_name
          ? String(staged.campaign_name)
          : undefined,
        budget_allocation:
          budget !== undefined && Number.isFinite(budget) ? budget : undefined,
        marketing_objective: objective,
      },
    );

    await this.slotSessions.clearSession(args.threadId);
    const resolvedAt = new Date().toISOString();
    const summary = `Draft campaign "${campaign.campaign_name}" updated.`;
    await this.threads.persistHitlResolution(args.threadId, String(staged.idempotencyKey), {
      status: "CONFIRMED",
      resolvedAt,
      summary,
      campaignId: campaign.campaign_id,
      campaignName: campaign.campaign_name,
    });

    return {
      intent: "CAMPAIGN_EDIT_DRAFT",
      campaignId: campaign.campaign_id,
      campaignName: campaign.campaign_name,
      message: summary,
      hitlResolution: {
        status: "CONFIRMED",
        resolvedAt,
        summary,
        campaignId: campaign.campaign_id,
        campaignName: campaign.campaign_name,
      },
    };
  }

  private async confirmIntelligenceMoveToPlanner(
    args: { brandProfileId: string; userId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const leakId = String(staged.leak_id ?? "").trim();
    if (!leakId) {
      throw new BadRequestException("Leak id is required.");
    }

    const { jobId } = await this.intelligence.moveToPlanner(
      args.brandProfileId,
      leakId,
      args.userId,
    );

    await this.slotSessions.clearSession(args.threadId);
    const resolvedAt = new Date().toISOString();
    const summary =
      "Leak sent to Campaign Planner. Building your planner card in the background…";
    await this.threads.persistHitlResolution(args.threadId, String(staged.idempotencyKey), {
      status: "CONFIRMED",
      resolvedAt,
      summary,
      brandCentreJobId: jobId,
    });

    return {
      intent: "INTELLIGENCE_MOVE_TO_PLANNER",
      pendingBrandCentreJobId: jobId,
      message: summary,
      hitlResolution: {
        status: "CONFIRMED",
        resolvedAt,
        summary,
        brandCentreJobId: jobId,
      },
    };
  }

  private async confirmPlannerLaunchDraft(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const cardId = String(staged.planner_card_id ?? "").trim();
    if (!cardId) {
      throw new BadRequestException("Planner card id is required.");
    }

    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: args.brandProfileId },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found.");
    }

    const existingCard = await this.planner.getCard(args.brandProfileId, cardId);
    if (existingCard.workflowStatus === PlannerWorkflowStatus.PROCEEDED_TO_PIPELINE) {
      throw new BadRequestException(
        "This planner card was already launched. Open Campaigns to review the existing DRAFT.",
      );
    }

    await this.planner.approveCard(args.brandProfileId, cardId);
    const card = existingCard;
    const key = (card.aggregationKey ?? {}) as Record<string, unknown>;
    const hook =
      typeof key.aiContextHook === "string"
        ? key.aiContextHook
        : "Planner campaign";

    const launchSignal = buildBridgeLaunchSignal({
      brandProfileId: args.brandProfileId,
      industry: profile.industry ?? IndustryVertical.D2C,
      card,
    });

    const launchResult = await this.bridge.processSignal(
      args.brandProfileId,
      launchSignal,
      launchSignal,
    );
    const campaignId = String(
      (launchResult as { campaign_id?: string }).campaign_id ?? "",
    );
    if (!campaignId) {
      throw new BadRequestException("Bridge did not return a campaign id.");
    }

    const injectSignals = buildBridgeInjectSignals({
      campaignId,
      card,
      hookText: hook,
    });
    for (const injectSignal of injectSignals) {
      await this.bridge.processSignal(
        args.brandProfileId,
        injectSignal,
        injectSignal,
      );
    }

    const shell = await this.uceCampaigns.getCampaignShell(
      args.brandProfileId,
      campaignId,
    );

    await this.slotSessions.clearSession(args.threadId);
    const resolvedAt = new Date().toISOString();
    const summary = `Draft campaign "${shell.campaign_name}" created from Campaign Planner. Open Campaigns to review products and briefs.`;
    await this.threads.persistHitlResolution(args.threadId, String(staged.idempotencyKey), {
      status: "CONFIRMED",
      resolvedAt,
      summary,
      campaignId,
      campaignName: shell.campaign_name,
      plannerCardId: cardId,
    });

    return {
      intent: "PLANNER_LAUNCH_DRAFT",
      campaignId,
      campaignName: shell.campaign_name,
      plannerCardId: cardId,
      message: summary,
      hitlResolution: {
        status: "CONFIRMED",
        resolvedAt,
        summary,
        campaignId,
        campaignName: shell.campaign_name,
        plannerCardId: cardId,
      },
    };
  }

  private async confirmDnaIdentity(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const axes = (staged.update_axes ?? []) as DnaIdentityUpdateAxis[];
    const aggregate = await this.dna.getDnaAggregate(args.brandProfileId);
    const current = aggregate.identity;

    const patch = mergeIdentityPatch({
      current: {
        palette: current.palette,
        fonts: current.fonts,
        aesthetics: current.aesthetics,
      },
      axes: axes.length > 0 ? axes : ["fonts", "aesthetics"],
      primaryFont: staged.primary_font ? String(staged.primary_font).trim() : undefined,
      aestheticStyle: staged.aesthetic_style
        ? String(staged.aesthetic_style).trim()
        : undefined,
      paletteColors: staged.palette_colors
        ? parsePaletteColorsInput(staged.palette_colors)
        : undefined,
    });

    if (
      !patch.palette?.length &&
      !patch.fonts?.length &&
      !patch.aesthetics?.length
    ) {
      throw new BadRequestException("No identity fields staged for update.");
    }

    await this.dna.patchIdentity(args.brandProfileId, patch);
    await this.slotSessions.clearSession(args.threadId);

    const resolvedAt = new Date().toISOString();
    const changed: string[] = [];
    if (patch.palette?.length) changed.push("colour palette");
    if (patch.fonts?.length) changed.push("fonts");
    if (patch.aesthetics?.length) changed.push("aesthetic styles");
    const summary = `Brand DNA ${changed.join(" and ")} updated.`;
    await this.threads.persistHitlResolution(args.threadId, String(staged.idempotencyKey), {
      status: "CONFIRMED",
      resolvedAt,
      summary,
    });

    return {
      intent: "DNA_IDENTITY_UPDATE",
      message: summary,
      hitlResolution: { status: "CONFIRMED", resolvedAt, summary },
    };
  }

  private async confirmDnaOffering(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const offeringName = String(staged.offering_name ?? "").trim();
    const description = String(staged.description ?? "").trim();
    if (!offeringName || !description) {
      throw new BadRequestException("Offering name and description are required.");
    }

    const offerings = await this.dna.listOfferings(args.brandProfileId, "primary");
    const match = offerings.find(
      (o) => o.name.toLowerCase() === offeringName.toLowerCase(),
    );
    if (!match) {
      throw new NotFoundException(
        `Offering "${offeringName}" not found. Use the exact product name from Brand DNA.`,
      );
    }

    await this.dna.updateOffering(args.brandProfileId, match.id, { description });
    await this.slotSessions.clearSession(args.threadId);

    const resolvedAt = new Date().toISOString();
    const summary = `Updated description for "${match.name}".`;
    await this.threads.persistHitlResolution(args.threadId, String(staged.idempotencyKey), {
      status: "CONFIRMED",
      resolvedAt,
      summary,
    });

    return {
      intent: "DNA_OFFERING_UPDATE",
      message: summary,
      hitlResolution: { status: "CONFIRMED", resolvedAt, summary },
    };
  }

  private async confirmDnaPersonaCreate(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const personaName = String(staged.persona_name ?? "").trim();
    const ageMin = Number(staged.age_min);
    const ageMax = Number(staged.age_max);
    const interests = String(staged.interests ?? "").trim();

    if (!personaName || !Number.isFinite(ageMin) || !Number.isFinite(ageMax)) {
      throw new BadRequestException("Persona name and age range are required.");
    }

    const persona = await this.dna.createPersona(args.brandProfileId, {
      personaName,
      demographicsJson: {
        ageMin,
        ageMax,
        interests: interests ? [interests] : [],
      },
      psychographicsText: interests || undefined,
    });

    await this.slotSessions.clearSession(args.threadId);
    const resolvedAt = new Date().toISOString();
    const summary = `Persona "${persona.personaName}" created.`;
    await this.threads.persistHitlResolution(args.threadId, String(staged.idempotencyKey), {
      status: "CONFIRMED",
      resolvedAt,
      summary,
    });

    return {
      intent: "DNA_PERSONA_CREATE",
      message: summary,
      hitlResolution: { status: "CONFIRMED", resolvedAt, summary },
    };
  }
}
