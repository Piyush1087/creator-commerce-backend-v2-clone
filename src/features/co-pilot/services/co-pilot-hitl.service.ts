import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BrandCentreJobStatus, IndustryVertical, PlannerWorkflowStatus, UserRole, type UceMilestoneStage } from "@prisma/client";

import { BrandCentreDnaService } from "../../brand-centre/services/brand-centre-dna.service";
import { BrandCentreIntelligenceService } from "../../brand-centre/services/brand-centre-intelligence.service";
import { BrandCentrePlannerService } from "../../brand-centre/services/brand-centre-planner.service";
import { BrandCentreUceBridgeService } from "../../brand-centre-uce-bridge/services/brand-centre-uce-bridge.service";
import { BrandSettingsService } from "../../brand-settings/services/brand-settings.service";
import { BrandUceCampaignService } from "../../brand-uce/services/brand-uce-campaign.service";
import { CollaborationService } from "../../collaboration/services/collaboration.service";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
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
import type { WriteIntentKind } from "../core/write-intent.types";
import type { ValidationChecklistData } from "../schemas/copilot-payload.schema";
import {
  mapBulkLifecyclePartialFailures,
  mapCampaignListValidationError,
  validationChecklistToPayloadFields,
  type CampaignListValidationAction,
} from "../modules/uce-campaign-list/campaign-list-validation";
import {
  mapCollaborationValidationError,
  validationChecklistToPayloadFields as collabValidationChecklistToPayloadFields,
  type CollaborationValidationAction,
} from "../modules/collaboration/collaboration-validation";
import {
  isBrandWriteAllowedAtStage,
} from "../modules/collaboration/collaboration.stages";
import {
  mapBrandSettingsValidationError,
  validationChecklistToPayloadFields as settingsValidationChecklistToPayloadFields,
  type BrandSettingsValidationAction,
} from "../modules/brand-settings/brand-settings-validation";
import {
  BrandBillingProfileSchema,
  BrandWithdrawalAccountSchema,
  UpdateBrandGeneralProfileSchema,
} from "../../brand-settings/schemas/brand-settings.schema";
import { CoPilotSlotSessionService } from "./co-pilot-slot-session.service";
import { CoPilotThreadService } from "./co-pilot-thread.service";
import { CoPilotConversationMemoryService } from "./co-pilot-conversation-memory.service";

export type HitlConfirmResult = {
  intent: WriteIntentKind;
  message?: string;
  campaignId?: string;
  campaignName?: string;
  plannerCardId?: string;
  pendingBrandCentreJobId?: string;
  /** Present on success. Absent when validationBlocked. */
  hitlResolution?: {
    status: "CONFIRMED";
    resolvedAt: string;
    summary: string;
    campaignId?: string;
    campaignName?: string;
    plannerCardId?: string;
    brandCentreJobId?: string;
  };
  /** Part 5 — action paused; session kept for retry. */
  validationBlocked?: true;
  validationChecklist?: ValidationChecklistData;
  /** Optional follow-up checklist after a successful confirm (e.g. bulk partial failures). */
  followUpChecklist?: ValidationChecklistData;
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
    private readonly collaboration: CollaborationService,
    private readonly brandSettings: BrandSettingsService,
    private readonly conversationMemory: CoPilotConversationMemoryService,
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
      case "PAUSE_CAMPAIGN":
        return this.confirmPauseCampaign(args, staged);
      case "RESUME_CAMPAIGN":
        return this.confirmResumeCampaign(args, staged);
      case "GO_LIVE_CAMPAIGN":
        return this.confirmGoLiveCampaign(args, staged);
      case "ARCHIVE_CAMPAIGN":
        return this.confirmArchiveCampaign(args, staged);
      case "DUPLICATE_CAMPAIGN":
        return this.confirmDuplicateCampaign(args, staged);
      case "BULK_CAMPAIGN_ACTION":
        return this.confirmBulkCampaignAction(args, staged);
      case "COLLAB_COUNTER_OFFER":
        return this.confirmCollabCounterOffer(args, staged);
      case "COLLAB_ACCEPT_TERMS":
        return this.confirmCollabAcceptTerms(args, staged);
      case "COLLAB_FUND_ESCROW":
        return this.confirmCollabFundEscrow(args, staged);
      case "COLLAB_DISPATCH":
        return this.confirmCollabDispatch(args, staged);
      case "COLLAB_APPROVE_CONTENT":
        return this.confirmCollabApproveContent(args, staged);
      case "COLLAB_REQUEST_REVISION":
        return this.confirmCollabRequestRevision(args, staged);
      case "COLLAB_VERIFY_COMPLIANCE":
        return this.confirmCollabVerifyCompliance(args, staged);
      case "SETTINGS_UPDATE_GENERAL":
        return this.confirmSettingsUpdateGeneral(args, staged);
      case "SETTINGS_UPDATE_BILLING":
        return this.confirmSettingsUpdateBilling(args, staged);
      case "SETTINGS_LINK_WITHDRAWAL":
        return this.confirmSettingsLinkWithdrawal(args, staged);
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
    const campaignId = this.parseSelectId(staged.campaign_id);
    if (!campaignId) {
      throw new BadRequestException("Draft campaign id is required.");
    }

    const campaignName =
      typeof staged.campaign_name === "string"
        ? staged.campaign_name
        : typeof staged.source_campaign_name === "string"
          ? staged.source_campaign_name
          : undefined;

    // Defense in depth: only DRAFT campaigns may be edited from co-pilot.
    try {
      const shell = await this.uceCampaigns.getCampaignShell(
        args.brandProfileId,
        campaignId,
      );
      if (shell.current_status !== "DRAFT") {
        throw new BadRequestException(
          "Only DRAFT campaigns can be edited from co-pilot.",
        );
      }
    } catch (err) {
      const mapped = mapCampaignListValidationError({
        err,
        action: "UNKNOWN",
        campaignId,
        campaignName,
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: "CAMPAIGN_EDIT_DRAFT",
        message: fields.narrativeText,
        campaignId: mapped.campaignId,
        campaignName: mapped.campaignName,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof staged.idempotencyKey === "string"
              ? staged.idempotencyKey
              : undefined,
        },
      };
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

    try {
      const campaign = await this.uceCampaigns.updateDraftWizard(
        args.brandProfileId,
        campaignId,
        {
          campaign_name: staged.campaign_name
            ? String(staged.campaign_name)
            : undefined,
          budget_allocation:
            budget !== undefined && Number.isFinite(budget)
              ? budget
              : undefined,
          marketing_objective: objective,
        },
      );

      await this.slotSessions.clearSession(args.threadId);
      const resolvedAt = new Date().toISOString();
      const summary = `Draft campaign "${campaign.campaign_name}" updated.`;
      await this.threads.persistHitlResolution(
        args.threadId,
        String(staged.idempotencyKey),
        {
          status: "CONFIRMED",
          resolvedAt,
          summary,
          campaignId: campaign.campaign_id,
          campaignName: campaign.campaign_name,
        },
      );

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
    } catch (err) {
      const mapped = mapCampaignListValidationError({
        err,
        action: "UNKNOWN",
        campaignId,
        campaignName,
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: "CAMPAIGN_EDIT_DRAFT",
        message: fields.narrativeText,
        campaignId: mapped.campaignId,
        campaignName: mapped.campaignName,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof staged.idempotencyKey === "string"
              ? staged.idempotencyKey
              : undefined,
        },
      };
    }
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

  private parseSelectLabel(raw: unknown): string | undefined {
    const value = String(raw ?? "").trim();
    if (!value.includes("::")) {
      return undefined;
    }
    return value.split("::").slice(1).join("::").trim() || undefined;
  }

  private parseCampaignIdList(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.map((v) => this.parseSelectId(v)).filter(Boolean);
    }
    const text = String(raw ?? "").trim();
    if (!text) {
      return [];
    }
    return text
      .split(/[,;\s]+/)
      .map((part) => this.parseSelectId(part))
      .filter(Boolean);
  }

  private async confirmLifecycleWithValidation(args: {
    brandProfileId: string;
    threadId: string;
    intent: Extract<
      WriteIntentKind,
      | "PAUSE_CAMPAIGN"
      | "RESUME_CAMPAIGN"
      | "GO_LIVE_CAMPAIGN"
      | "ARCHIVE_CAMPAIGN"
      | "DUPLICATE_CAMPAIGN"
    >;
    action: CampaignListValidationAction;
    staged: Record<string, unknown>;
    run: () => Promise<{
      campaign_id: string;
      campaign_name: string;
      current_status?: string;
    }>;
    successSummary: (result: {
      campaign_id: string;
      campaign_name: string;
      current_status?: string;
    }) => string;
  }): Promise<HitlConfirmResult> {
    const campaignId = this.parseSelectId(args.staged.campaign_id);
    const campaignName =
      typeof args.staged.campaign_name === "string"
        ? args.staged.campaign_name
        : undefined;

    try {
      const result = await args.run();
      await this.slotSessions.clearSession(args.threadId);
      const resolvedAt = new Date().toISOString();
      const summary = args.successSummary(result);
      await this.threads.persistHitlResolution(
        args.threadId,
        String(args.staged.idempotencyKey),
        {
          status: "CONFIRMED",
          resolvedAt,
          summary,
          campaignId: result.campaign_id,
          campaignName: result.campaign_name,
        },
      );
      return {
        intent: args.intent,
        campaignId: result.campaign_id,
        campaignName: result.campaign_name,
        message: summary,
        hitlResolution: {
          status: "CONFIRMED",
          resolvedAt,
          summary,
          campaignId: result.campaign_id,
          campaignName: result.campaign_name,
        },
      };
    } catch (err) {
      const mapped = mapCampaignListValidationError({
        err,
        action: args.action,
        campaignId: campaignId ?? undefined,
        campaignName,
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: args.intent,
        message: fields.narrativeText,
        campaignId: mapped.campaignId,
        campaignName: mapped.campaignName,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof args.staged.idempotencyKey === "string"
              ? args.staged.idempotencyKey
              : undefined,
        },
      };
    }
  }

  private async confirmPauseCampaign(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const campaignId = this.parseSelectId(staged.campaign_id);
    if (!campaignId) {
      throw new BadRequestException("Campaign id is required.");
    }

    const shell = await this.uceCampaigns.getCampaignShell(
      args.brandProfileId,
      campaignId,
    );
    if (shell.current_status !== "LIVE") {
      const mapped = mapCampaignListValidationError({
        err: new BadRequestException("Only LIVE campaigns can be paused."),
        action: "PAUSE",
        campaignId,
        campaignName:
          typeof staged.campaign_name === "string"
            ? staged.campaign_name
            : shell.campaign_name,
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: "PAUSE_CAMPAIGN",
        message: fields.narrativeText,
        campaignId: mapped.campaignId,
        campaignName: mapped.campaignName,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof staged.idempotencyKey === "string"
              ? staged.idempotencyKey
              : undefined,
        },
      };
    }

    return this.confirmLifecycleWithValidation({
      brandProfileId: args.brandProfileId,
      threadId: args.threadId,
      intent: "PAUSE_CAMPAIGN",
      action: "PAUSE",
      staged,
      run: () => this.uceCampaigns.pauseCampaign(args.brandProfileId, campaignId),
      successSummary: (result) =>
        `Campaign paused (${result.current_status}).`,
    });
  }

  private async confirmResumeCampaign(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const campaignId = this.parseSelectId(staged.campaign_id);
    if (!campaignId) {
      throw new BadRequestException("Campaign id is required.");
    }

    const campaignName =
      typeof staged.campaign_name === "string"
        ? staged.campaign_name
        : undefined;

    // Defense in depth: re-check status + activation checklist before mutating.
    const shell = await this.uceCampaigns.getCampaignShell(
      args.brandProfileId,
      campaignId,
    );
    if (shell.current_status !== "PAUSED") {
      const mapped = mapCampaignListValidationError({
        err: new BadRequestException(
          "Only PAUSED campaigns can be resumed. Use go live for DRAFT campaigns.",
        ),
        action: "RESUME",
        campaignId,
        campaignName: campaignName ?? shell.campaign_name,
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: "RESUME_CAMPAIGN",
        message: fields.narrativeText,
        campaignId: mapped.campaignId,
        campaignName: mapped.campaignName,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof staged.idempotencyKey === "string"
              ? staged.idempotencyKey
              : undefined,
        },
      };
    }

    const checklist = await this.uceCampaigns.getActivationChecklist(
      args.brandProfileId,
      campaignId,
    );
    const blockers = checklist.filter((c) => !c.satisfied);
    if (blockers.length > 0) {
      const mapped = mapCampaignListValidationError({
        err: {
          response: {
            message: "Campaign cannot be activated until checklist criteria are met",
            checklist,
          },
          status: 400,
        },
        action: "RESUME",
        campaignId,
        campaignName: campaignName ?? shell.campaign_name,
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: "RESUME_CAMPAIGN",
        message: fields.narrativeText,
        campaignId: mapped.campaignId,
        campaignName: mapped.campaignName,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof staged.idempotencyKey === "string"
              ? staged.idempotencyKey
              : undefined,
        },
      };
    }

    return this.confirmLifecycleWithValidation({
      brandProfileId: args.brandProfileId,
      threadId: args.threadId,
      intent: "RESUME_CAMPAIGN",
      action: "RESUME",
      staged,
      run: () => this.uceCampaigns.resumeCampaign(args.brandProfileId, campaignId),
      successSummary: (result) =>
        `Campaign resumed (${result.current_status}).`,
    });
  }

  private async confirmGoLiveCampaign(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const campaignId = this.parseSelectId(staged.campaign_id);
    if (!campaignId) {
      throw new BadRequestException("Campaign id is required.");
    }

    const campaignName =
      typeof staged.campaign_name === "string"
        ? staged.campaign_name
        : undefined;

    // Defense in depth: re-check status + activation checklist before mutating.
    const shell = await this.uceCampaigns.getCampaignShell(
      args.brandProfileId,
      campaignId,
    );
    if (shell.current_status !== "DRAFT") {
      const mapped = mapCampaignListValidationError({
        err: new BadRequestException(
          "Only DRAFT campaigns can go live. Use resume for PAUSED campaigns.",
        ),
        action: "GO_LIVE",
        campaignId,
        campaignName: campaignName ?? shell.campaign_name,
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: "GO_LIVE_CAMPAIGN",
        message: fields.narrativeText,
        campaignId: mapped.campaignId,
        campaignName: mapped.campaignName,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof staged.idempotencyKey === "string"
              ? staged.idempotencyKey
              : undefined,
        },
      };
    }

    const checklist = await this.uceCampaigns.getActivationChecklist(
      args.brandProfileId,
      campaignId,
    );
    const blockers = checklist.filter((c) => !c.satisfied);
    if (blockers.length > 0) {
      const mapped = mapCampaignListValidationError({
        err: {
          response: {
            message: "Campaign cannot be activated until checklist criteria are met",
            checklist,
          },
          status: 400,
        },
        action: "GO_LIVE",
        campaignId,
        campaignName: campaignName ?? shell.campaign_name,
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: "GO_LIVE_CAMPAIGN",
        message: fields.narrativeText,
        campaignId: mapped.campaignId,
        campaignName: mapped.campaignName,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof staged.idempotencyKey === "string"
              ? staged.idempotencyKey
              : undefined,
        },
      };
    }

    return this.confirmLifecycleWithValidation({
      brandProfileId: args.brandProfileId,
      threadId: args.threadId,
      intent: "GO_LIVE_CAMPAIGN",
      action: "GO_LIVE",
      staged,
      run: () => this.uceCampaigns.goLiveCampaign(args.brandProfileId, campaignId),
      successSummary: (result) =>
        `Campaign is live (${result.current_status}).`,
    });
  }

  private async confirmArchiveCampaign(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const campaignId = this.parseSelectId(staged.campaign_id);
    if (!campaignId) {
      throw new BadRequestException("Campaign id is required.");
    }

    const shell = await this.uceCampaigns.getCampaignShell(
      args.brandProfileId,
      campaignId,
    );
    const status = shell.current_status;
    const archivable =
      status === "LIVE" || status === "PAUSED" || status === "COMPLETED";
    if (!archivable) {
      const mapped = mapCampaignListValidationError({
        err: new BadRequestException(
          "Only LIVE, PAUSED, or COMPLETED campaigns can be archived.",
        ),
        action: "ARCHIVE",
        campaignId,
        campaignName:
          typeof staged.campaign_name === "string"
            ? staged.campaign_name
            : shell.campaign_name,
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: "ARCHIVE_CAMPAIGN",
        message: fields.narrativeText,
        campaignId: mapped.campaignId,
        campaignName: mapped.campaignName,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof staged.idempotencyKey === "string"
              ? staged.idempotencyKey
              : undefined,
        },
      };
    }

    return this.confirmLifecycleWithValidation({
      brandProfileId: args.brandProfileId,
      threadId: args.threadId,
      intent: "ARCHIVE_CAMPAIGN",
      action: "ARCHIVE",
      staged,
      run: () =>
        this.uceCampaigns.archiveCampaign(args.brandProfileId, campaignId),
      successSummary: (result) =>
        `Campaign archived (status ${result.current_status}).`,
    });
  }

  private async confirmDuplicateCampaign(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const campaignId = this.parseSelectId(staged.campaign_id);
    const newName = String(staged.new_campaign_name ?? "").trim();
    if (!campaignId) {
      throw new BadRequestException("Campaign id is required.");
    }
    if (!newName) {
      throw new BadRequestException("New campaign name is required.");
    }
    return this.confirmLifecycleWithValidation({
      brandProfileId: args.brandProfileId,
      threadId: args.threadId,
      intent: "DUPLICATE_CAMPAIGN",
      action: "DUPLICATE",
      staged,
      run: async () => {
        const shell = await this.uceCampaigns.duplicateCampaign(
          args.brandProfileId,
          campaignId,
          newName,
        );
        return {
          campaign_id: shell.campaign_id,
          campaign_name: shell.campaign_name,
          current_status: shell.current_status,
        };
      },
      successSummary: (result) =>
        `Draft campaign "${result.campaign_name}" created by duplicating source.`,
    });
  }

  private async confirmBulkCampaignAction(
    args: { brandProfileId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const action = String(staged.bulk_action ?? "")
      .toUpperCase()
      .trim() as "PAUSE" | "RESUME" | "ARCHIVE";
    if (action !== "PAUSE" && action !== "RESUME" && action !== "ARCHIVE") {
      const mapped = mapCampaignListValidationError({
        err: new BadRequestException(
          "bulk_action must be PAUSE, RESUME, or ARCHIVE.",
        ),
        action: "BULK",
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: "BULK_CAMPAIGN_ACTION",
        message: fields.narrativeText,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof staged.idempotencyKey === "string"
              ? staged.idempotencyKey
              : undefined,
        },
      };
    }

    let campaignIds = this.parseCampaignIdList(staged.campaign_ids);
    if (campaignIds.length === 0 && staged.campaign_id) {
      campaignIds = [this.parseSelectId(staged.campaign_id)];
    }
    if (campaignIds.length === 0) {
      const mapped = mapCampaignListValidationError({
        err: new BadRequestException("At least one campaign id is required."),
        action: "BULK",
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: "BULK_CAMPAIGN_ACTION",
        message: fields.narrativeText,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof staged.idempotencyKey === "string"
              ? staged.idempotencyKey
              : undefined,
        },
      };
    }

    try {
      const result = await this.uceCampaigns.bulkLifecycleAction(
        args.brandProfileId,
        action,
        campaignIds,
      );

      const nameMap: Record<string, string> = {};
      if (typeof staged.campaign_name === "string" && campaignIds.length === 1) {
        nameMap[campaignIds[0]] = staged.campaign_name;
      }

      const partial = mapBulkLifecyclePartialFailures({
        action,
        results: result.results,
        campaignNames: nameMap,
      });

      if (partial && result.success_count === 0) {
        const fields = validationChecklistToPayloadFields(partial);
        return {
          intent: "BULK_CAMPAIGN_ACTION",
          message: fields.narrativeText,
          validationBlocked: true,
          validationChecklist: {
            ...fields.validationChecklistData,
            idempotencyKey:
              typeof staged.idempotencyKey === "string"
                ? staged.idempotencyKey
                : undefined,
          },
        };
      }

      await this.slotSessions.clearSession(args.threadId);
      const resolvedAt = new Date().toISOString();
      let summary = `Bulk ${action}: ${result.success_count} succeeded, ${result.failure_count} failed.`;
      if (partial) {
        summary = `${summary} Some campaigns need attention — see the checklist.`;
      }
      await this.threads.persistHitlResolution(
        args.threadId,
        String(staged.idempotencyKey),
        {
          status: "CONFIRMED",
          resolvedAt,
          summary,
        },
      );

      if (partial) {
        const fields = validationChecklistToPayloadFields(partial);
        return {
          intent: "BULK_CAMPAIGN_ACTION",
          message: summary,
          hitlResolution: { status: "CONFIRMED", resolvedAt, summary },
          followUpChecklist: {
            ...fields.validationChecklistData,
            primaryActionLabel: "Dismiss",
          },
        };
      }

      return {
        intent: "BULK_CAMPAIGN_ACTION",
        message: summary,
        hitlResolution: { status: "CONFIRMED", resolvedAt, summary },
      };
    } catch (err) {
      const mapped = mapCampaignListValidationError({
        err,
        action: "BULK",
      });
      const fields = validationChecklistToPayloadFields(mapped);
      return {
        intent: "BULK_CAMPAIGN_ACTION",
        message: fields.narrativeText,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof staged.idempotencyKey === "string"
              ? staged.idempotencyKey
              : undefined,
        },
      };
    }
  }

  private async resolveAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found.");
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  private async confirmCollabAction(args: {
    userId: string;
    threadId: string;
    intent: Extract<
      WriteIntentKind,
      | "COLLAB_COUNTER_OFFER"
      | "COLLAB_ACCEPT_TERMS"
      | "COLLAB_FUND_ESCROW"
      | "COLLAB_DISPATCH"
      | "COLLAB_APPROVE_CONTENT"
      | "COLLAB_REQUEST_REVISION"
      | "COLLAB_VERIFY_COMPLIANCE"
    >;
    action: CollaborationValidationAction;
    staged: Record<string, unknown>;
    run: (authUser: AuthUser, collaborationId: string) => Promise<{
      stage?: string;
      campaignName?: string;
      creatorLabel?: string;
    }>;
    successSummary: (meta: {
      stage?: string;
      campaignName?: string;
      creatorLabel?: string;
    }) => string;
  }): Promise<HitlConfirmResult> {
    const collaborationId = this.parseSelectId(args.staged.collaboration_id);
    const creatorLabel =
      typeof args.staged.creator_label === "string"
        ? args.staged.creator_label
        : undefined;
    const campaignName =
      typeof args.staged.campaign_name === "string"
        ? args.staged.campaign_name
        : undefined;

    if (!collaborationId) {
      throw new BadRequestException("Collaboration id is required.");
    }

    try {
      const authUser = await this.resolveAuthUser(args.userId);
      if (authUser.role !== UserRole.BRAND) {
        throw new BadRequestException("Brand access required.");
      }

      // Defense in depth: re-check stage before mutating (stage can change
      // between HITL staging and confirm).
      const detail = await this.collaboration.getThread(
        authUser,
        collaborationId,
      );
      const currentStage = detail.thread.currentStage as UceMilestoneStage;
      if (!isBrandWriteAllowedAtStage(args.intent, currentStage)) {
        throw new BadRequestException(
          `Cannot complete this action at the current stage ${currentStage}.`,
        );
      }

      const meta = await args.run(authUser, collaborationId);
      await this.slotSessions.clearSession(args.threadId);
      const resolvedAt = new Date().toISOString();
      const summary = args.successSummary({
        stage: meta.stage,
        campaignName: meta.campaignName ?? campaignName,
        creatorLabel: meta.creatorLabel ?? creatorLabel,
      });
      this.conversationMemory.rememberSelectedCollaboration(args.threadId, {
        id: collaborationId,
        name: `${meta.creatorLabel ?? creatorLabel ?? "Creator"} · ${meta.campaignName ?? campaignName ?? ""}`,
        stage: meta.stage,
        campaignName: meta.campaignName ?? campaignName,
      });
      await this.threads.persistHitlResolution(
        args.threadId,
        String(args.staged.idempotencyKey),
        {
          status: "CONFIRMED",
          resolvedAt,
          summary,
        },
      );
      return {
        intent: args.intent,
        message: summary,
        hitlResolution: {
          status: "CONFIRMED",
          resolvedAt,
          summary,
        },
      };
    } catch (err) {
      if (
        err instanceof BadRequestException &&
        String(err.message).includes("Collaboration id is required")
      ) {
        throw err;
      }
      const mapped = mapCollaborationValidationError({
        err,
        action: args.action,
        collaborationId,
        creatorLabel,
        campaignName,
      });
      const fields = collabValidationChecklistToPayloadFields(mapped);
      return {
        intent: args.intent,
        message: fields.narrativeText,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof args.staged.idempotencyKey === "string"
              ? args.staged.idempotencyKey
              : undefined,
        },
      };
    }
  }

  private stageFromDetail(detail: Awaited<
    ReturnType<CollaborationService["getThread"]>
  >): string {
    return detail.thread.currentStage;
  }

  private async confirmCollabCounterOffer(
    args: { userId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const amount = Number(staged.counter_offer);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException("Counter-offer amount is required.");
    }
    return this.confirmCollabAction({
      ...args,
      intent: "COLLAB_COUNTER_OFFER",
      action: "COUNTER_OFFER",
      staged,
      run: async (authUser, collaborationId) => {
        const detail = await this.collaboration.brandCounterOffer(
          authUser,
          collaborationId,
          { counter_offer: amount },
        );
        return {
          stage: this.stageFromDetail(detail),
          campaignName: detail.thread.campaign.name,
          creatorLabel:
            detail.thread.creatorUser.creatorProfile?.displayName ??
            detail.thread.creatorUser.name ??
            detail.thread.creatorHandle,
        };
      },
      successSummary: (meta) =>
        `Counter-offer ₹${amount} sent for ${meta.creatorLabel ?? "creator"} (${meta.stage ?? "negotiation"}).`,
    });
  }

  private async confirmCollabAcceptTerms(
    args: { userId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    return this.confirmCollabAction({
      ...args,
      intent: "COLLAB_ACCEPT_TERMS",
      action: "ACCEPT_TERMS",
      staged,
      run: async (authUser, collaborationId) => {
        const detail = await this.collaboration.acceptCommercials(
          authUser,
          collaborationId,
          {},
        );
        return {
          stage: this.stageFromDetail(detail),
          campaignName: detail.thread.campaign.name,
          creatorLabel:
            detail.thread.creatorUser.creatorProfile?.displayName ??
            detail.thread.creatorUser.name ??
            detail.thread.creatorHandle,
        };
      },
      successSummary: (meta) =>
        `Terms accepted. Workflow advanced to ${meta.stage ?? "next stage"}.`,
    });
  }

  private async confirmCollabFundEscrow(
    args: { userId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    return this.confirmCollabAction({
      ...args,
      intent: "COLLAB_FUND_ESCROW",
      action: "FUND_ESCROW",
      staged,
      run: async (authUser, collaborationId) => {
        const detail = await this.collaboration.fundEscrow(
          authUser,
          collaborationId,
          {},
        );
        return {
          stage: this.stageFromDetail(detail),
          campaignName: detail.thread.campaign.name,
          creatorLabel:
            detail.thread.creatorUser.creatorProfile?.displayName ??
            detail.thread.creatorUser.name ??
            detail.thread.creatorHandle,
        };
      },
      successSummary: (meta) =>
        `Escrow funded. Now in ${meta.stage ?? "logistics"}.`,
    });
  }

  private async confirmCollabDispatch(
    args: { userId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const trackingId =
      typeof staged.tracking_id === "string" ? staged.tracking_id.trim() : "";
    const courierName =
      typeof staged.courier_name === "string"
        ? staged.courier_name.trim()
        : undefined;
    return this.confirmCollabAction({
      ...args,
      intent: "COLLAB_DISPATCH",
      action: "DISPATCH",
      staged,
      run: async (authUser, collaborationId) => {
        const detail = await this.collaboration.dispatchLogistics(
          authUser,
          collaborationId,
          {
            tracking_id: trackingId || undefined,
            courier_name: courierName,
          },
        );
        return {
          stage: this.stageFromDetail(detail),
          campaignName: detail.thread.campaign.name,
          creatorLabel:
            detail.thread.creatorUser.creatorProfile?.displayName ??
            detail.thread.creatorUser.name ??
            detail.thread.creatorHandle,
        };
      },
      successSummary: (meta) =>
        `Dispatch recorded${trackingId ? ` (${trackingId})` : ""}. Stage: ${meta.stage ?? "logistics"}.`,
    });
  }

  private async confirmCollabApproveContent(
    args: { userId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    return this.confirmCollabAction({
      ...args,
      intent: "COLLAB_APPROVE_CONTENT",
      action: "APPROVE_CONTENT",
      staged,
      run: async (authUser, collaborationId) => {
        const detail = await this.collaboration.reviewMedia(
          authUser,
          collaborationId,
          { decision: "APPROVED" },
        );
        return {
          stage: this.stageFromDetail(detail),
          campaignName: detail.thread.campaign.name,
          creatorLabel:
            detail.thread.creatorUser.creatorProfile?.displayName ??
            detail.thread.creatorUser.name ??
            detail.thread.creatorHandle,
        };
      },
      successSummary: (meta) =>
        `Content approved. Advanced to ${meta.stage ?? "publishing"}.`,
    });
  }

  private async confirmCollabRequestRevision(
    args: { userId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    const feedback =
      typeof staged.brand_feedback === "string"
        ? staged.brand_feedback.trim()
        : "";
    return this.confirmCollabAction({
      ...args,
      intent: "COLLAB_REQUEST_REVISION",
      action: "REQUEST_REVISION",
      staged,
      run: async (authUser, collaborationId) => {
        const detail = await this.collaboration.reviewMedia(
          authUser,
          collaborationId,
          {
            decision: "REJECTED",
            brand_feedback: feedback || undefined,
          },
        );
        return {
          stage: this.stageFromDetail(detail),
          campaignName: detail.thread.campaign.name,
          creatorLabel:
            detail.thread.creatorUser.creatorProfile?.displayName ??
            detail.thread.creatorUser.name ??
            detail.thread.creatorHandle,
        };
      },
      successSummary: () =>
        `Revision requested${feedback ? `: ${feedback}` : "."}`,
    });
  }

  private async confirmCollabVerifyCompliance(
    args: { userId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    return this.confirmCollabAction({
      ...args,
      intent: "COLLAB_VERIFY_COMPLIANCE",
      action: "VERIFY_COMPLIANCE",
      staged,
      run: async (authUser, collaborationId) => {
        const detail = await this.collaboration.verifyCompliance(
          authUser,
          collaborationId,
        );
        return {
          stage: this.stageFromDetail(detail),
          campaignName: detail.thread.campaign.name,
          creatorLabel:
            detail.thread.creatorUser.creatorProfile?.displayName ??
            detail.thread.creatorUser.name ??
            detail.thread.creatorHandle,
        };
      },
      successSummary: (meta) =>
        `Compliance verified. Advanced to ${meta.stage ?? "feedback"}.`,
    });
  }

  private async confirmSettingsUpdateGeneral(
    args: { userId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    return this.confirmSettingsAction({
      ...args,
      intent: "SETTINGS_UPDATE_GENERAL",
      action: "UPDATE_GENERAL",
      staged,
      run: async (authUser) => {
        const input = UpdateBrandGeneralProfileSchema.parse({
          organizationLegalName: this.optionalString(
            staged.organizationLegalName,
          ),
          countryCode: this.optionalString(staged.countryCode),
          currencyCode: this.optionalString(staged.currencyCode),
          firstName: this.optionalString(staged.firstName),
          lastName: this.optionalString(staged.lastName),
          organizationAddress: this.optionalString(staged.organizationAddress),
          taxId: this.optionalString(staged.taxId) ?? null,
        });
        await this.brandSettings.updateGeneral(authUser, input);
        return "General settings updated.";
      },
    });
  }

  private async confirmSettingsUpdateBilling(
    args: { userId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    return this.confirmSettingsAction({
      ...args,
      intent: "SETTINGS_UPDATE_BILLING",
      action: "UPDATE_BILLING",
      staged,
      run: async (authUser) => {
        const input = BrandBillingProfileSchema.parse({
          registeredCompanyName: staged.registeredCompanyName,
          corporateBillingAddress: staged.corporateBillingAddress,
          gstin: this.optionalString(staged.gstin),
          pan: this.optionalString(staged.pan),
          defaultTdsPercentage:
            typeof staged.defaultTdsPercentage === "number"
              ? staged.defaultTdsPercentage
              : Number(staged.defaultTdsPercentage ?? 2),
          currencyPreference:
            this.optionalString(staged.currencyPreference) ?? "INR",
        });
        await this.brandSettings.upsertBillingProfile(authUser, input);
        return "Billing profile saved.";
      },
    });
  }

  private async confirmSettingsLinkWithdrawal(
    args: { userId: string; threadId: string },
    staged: Record<string, unknown>,
  ): Promise<HitlConfirmResult> {
    return this.confirmSettingsAction({
      ...args,
      intent: "SETTINGS_LINK_WITHDRAWAL",
      action: "LINK_WITHDRAWAL",
      staged,
      run: async (authUser) => {
        const input = BrandWithdrawalAccountSchema.parse({
          beneficiaryName: staged.beneficiaryName,
          bankName: staged.bankName,
          accountNumber: staged.accountNumber,
          confirmAccountNumber: staged.confirmAccountNumber,
          ifscCode: staged.ifscCode,
        });
        await this.brandSettings.linkWithdrawalAccount(authUser, input);
        return "Withdrawal bank account linked.";
      },
    });
  }

  private async confirmSettingsAction(args: {
    userId: string;
    threadId: string;
    intent: Extract<
      WriteIntentKind,
      | "SETTINGS_UPDATE_GENERAL"
      | "SETTINGS_UPDATE_BILLING"
      | "SETTINGS_LINK_WITHDRAWAL"
    >;
    action: BrandSettingsValidationAction;
    staged: Record<string, unknown>;
    run: (authUser: AuthUser) => Promise<string>;
  }): Promise<HitlConfirmResult> {
    try {
      const authUser = await this.resolveAuthUser(args.userId);
      if (authUser.role !== UserRole.BRAND) {
        throw new BadRequestException("Brand access required.");
      }
      const summary = await args.run(authUser);
      await this.slotSessions.clearSession(args.threadId);
      const resolvedAt = new Date().toISOString();
      await this.threads.persistHitlResolution(
        args.threadId,
        String(args.staged.idempotencyKey),
        {
          status: "CONFIRMED",
          resolvedAt,
          summary,
        },
      );
      return {
        intent: args.intent,
        message: summary,
        hitlResolution: {
          status: "CONFIRMED",
          resolvedAt,
          summary,
        },
      };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      const mapped = mapBrandSettingsValidationError({
        err,
        action: args.action,
      });
      const fields = settingsValidationChecklistToPayloadFields(mapped);
      return {
        intent: args.intent,
        message: fields.narrativeText,
        validationBlocked: true,
        validationChecklist: {
          ...fields.validationChecklistData,
          idempotencyKey:
            typeof args.staged.idempotencyKey === "string"
              ? args.staged.idempotencyKey
              : undefined,
        },
      };
    }
  }

  private optionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
