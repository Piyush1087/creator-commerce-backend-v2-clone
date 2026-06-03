import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  UceCampaignObjective,
  UceCampaignStatus,
  UceMediaPlatform,
  type Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { UnifiedBridgeSignalPayload } from "../schemas/bridge-signal.schema";
import {
  calculateSplittingBudgets,
  parseTimelineBounds,
  safeSkuFromName,
} from "../utils/bridge-invariants.util";

function mapMacroObjectiveToUceObjective(
  macro: "PRODUCTION" | "PULSE" | "PROOF_PUSH",
): UceCampaignObjective {
  if (macro === "PRODUCTION") return UceCampaignObjective.SALES_CONVERSIONS;
  if (macro === "PULSE") return UceCampaignObjective.TRAFFIC_CLICKS;
  return UceCampaignObjective.BRAND_AWARENESS;
}

function mapDeliverableTypeToBriefDefaults(deliverableType: string): {
  requiredPlatforms: UceMediaPlatform[];
  deliverableTags: string[];
} {
  switch (deliverableType) {
    case "REEL_VIDEO":
      return {
        requiredPlatforms: [UceMediaPlatform.INSTAGRAM],
        deliverableTags: ["REEL_VIDEO"],
      };
    case "IG_STORIES":
      return {
        requiredPlatforms: [UceMediaPlatform.INSTAGRAM],
        deliverableTags: ["IG_STORIES"],
      };
    case "TIKTOK_POST":
      return {
        requiredPlatforms: [UceMediaPlatform.TIKTOK],
        deliverableTags: ["TIKTOK_POST"],
      };
    case "YOUTUBE_SHORTS":
      return {
        requiredPlatforms: [UceMediaPlatform.YOUTUBE],
        deliverableTags: ["YOUTUBE_SHORTS"],
      };
    default:
      return {
        requiredPlatforms: [UceMediaPlatform.INSTAGRAM],
        deliverableTags: [deliverableType],
      };
  }
}

@Injectable()
export class BrandCentreUceBridgeService {
  constructor(private readonly prisma: PrismaService) {}

  async logValidationFailure(
    brandProfileId: string,
    rawPayloadSnapshot: unknown,
    diagnostic: unknown,
  ) {
    const signalType =
      typeof rawPayloadSnapshot === "object" &&
      rawPayloadSnapshot !== null &&
      typeof (rawPayloadSnapshot as { signal_type?: unknown }).signal_type ===
        "string"
        ? ((rawPayloadSnapshot as { signal_type: string }).signal_type as string)
        : "LAUNCH_NEW_FRAMEWORK";

    const campaignId =
      typeof rawPayloadSnapshot === "object" &&
      rawPayloadSnapshot !== null &&
      typeof (rawPayloadSnapshot as { campaign_id?: unknown }).campaign_id ===
        "string"
        ? ((rawPayloadSnapshot as { campaign_id: string }).campaign_id as string)
        : null;

    const ledger = await this.prisma.integrationBridgeSignalLedger.create({
      data: {
        brandProfileId,
        campaignId,
        // accept unknown signal types but persist what we received for debugging
        signalType: signalType as never,
        syncStatus: "VALIDATION_FAILED",
        rawPayloadSnapshot: rawPayloadSnapshot as Prisma.InputJsonValue,
        executionErrorLogs:
          typeof diagnostic === "string"
            ? diagnostic
            : JSON.stringify(diagnostic),
      },
      select: { id: true },
    });

    throw new UnprocessableEntityException({
      success: false,
      bridge_tracking_id: ledger.id,
      error_type: "BRIDGE_VALIDATION_FAILURE",
      diagnostic_details: diagnostic,
    });
  }

  async processSignal(
    brandProfileId: string,
    payload: UnifiedBridgeSignalPayload,
    rawPayloadSnapshot: unknown,
  ) {
    // Note: docs include brand_id in payload. We trust JWT tenant scoping and
    // only persist the inbound snapshot for diagnostics.

    const ledger = await this.prisma.integrationBridgeSignalLedger.create({
      data: {
        brandProfileId,
        campaignId: "campaign_id" in payload ? payload.campaign_id : null,
        signalType: payload.signal_type,
        syncStatus: "PROCESSING",
        rawPayloadSnapshot: rawPayloadSnapshot as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (payload.signal_type === "LAUNCH_NEW_FRAMEWORK") {
          const { masterBudget } = calculateSplittingBudgets(
            payload.raw_budget_expression,
          );
          const timeline = parseTimelineBounds(payload.timeline_expression);
          const coreObjective = mapMacroObjectiveToUceObjective(
            payload.assigned_macro_objective,
          );

          const timelineType =
            timeline.type === "FIXED_DATE" ? "FIXED_DATES" : "DYNAMIC_MILESTONES";

          const created = await tx.uceCampaign.create({
            data: {
              brandProfileId,
              name: payload.campaign_name.trim(),
              status: UceCampaignStatus.DRAFT,
              performanceAggregate: { create: {} },
              strategy: {
                create: {
                  timelineType,
                  fixedStartDate: null,
                  fixedEndDate: timeline.type === "FIXED_DATE" ? timeline.date! : null,
                  dynamicDaysLimit:
                    timeline.type === "DYNAMIC" ? timeline.offset ?? null : null,
                  coreObjective,
                  platformDeliverables: [] as unknown as Prisma.InputJsonValue,
                },
              },
              targeting: {
                create: {
                  industryVertical: payload.industry_sector,
                  creatorArchetypes: [],
                  followerTiers: [],
                  audienceAgeMin: 18,
                  audienceAgeMax: 65,
                  audienceGender: "ALL",
                  targetLocations: [],
                  disqualifyingKeywords: [],
                },
              },
              commercials: {
                create: {
                  compensationType: "NEGOTIABLE",
                  fixedFeeAmount: 0,
                  negotiableMinFee: 0,
                  negotiableMaxFee: 0,
                  totalCampaignBudgetPool: masterBudget,
                  advancePaymentPercentage: 30,
                  finalBalanceTerms: "NET_30",
                },
              },
            },
            select: { id: true },
          });

          await tx.integrationBridgeSignalLedger.update({
            where: { id: ledger.id },
            data: {
              campaignId: created.id,
            },
          });

          return {
            campaign_id: created.id,
          };
        }

        if (payload.signal_type === "INJECT_ASSET_LINE") {
          const campaignId = payload.campaign_id;
          const campaign = await tx.uceCampaign.findFirst({
            where: { id: campaignId, brandProfileId },
            include: {
              collaborations: {
                where: { collabStatus: "ACTIVE_WORKFLOW" },
                select: { id: true },
              },
            },
          });
          if (!campaign) {
            throw new BadRequestException("Campaign not found");
          }

          // Error boundary 6.1 in docs (code 551).
          if (campaign.collaborations.length > 0) {
            throw new ConflictException({
              error_code: "PRODUCT_MUTATION_LOCKED_LIVE_COLLAB",
              http_status: 409,
              developer_diagnostic_message:
                "Mutation aborted. Active creator records are currently tied to this campaign. Modification is blocked to protect fulfillment logs.",
              target_lock_count: campaign.collaborations.length,
            });
          }

          const skuCode = safeSkuFromName(payload.product_name);

          const product = await tx.uceCampaignProduct.create({
            data: {
              campaignId,
              skuCode,
              productName: payload.product_name.trim(),
              inventoryCount: 0,
              costPerUnit: payload.estimated_base_price,
              imageUrl: null,
              isActive: true,
            },
            select: { id: true },
          });

          for (const brief of payload.creative_briefs) {
            const defaults = mapDeliverableTypeToBriefDefaults(
              brief.deliverable_type,
            );
            await tx.uceCampaignBrief.create({
              data: {
                campaignId,
                internalTitle: brief.brief_name.trim(),
                creativeGuidelines: payload.raw_strategic_context,
                requiredPlatforms: defaults.requiredPlatforms,
                deliverableFormatTags: defaults.deliverableTags,
                isActive: true,
              },
            });
          }

          return { campaign_id: campaignId, product_id: product.id };
        }

        // FAST_TRACK_INTERRUPT
        const campaign = await tx.uceCampaign.findFirst({
          where: { id: payload.campaign_id, brandProfileId },
          select: { id: true },
        });
        if (!campaign) {
          throw new BadRequestException("Campaign not found");
        }

        if (payload.target_entity_type === "PRODUCT") {
          const updated = await tx.uceCampaignProduct.updateMany({
            where: { id: payload.target_entity_uuid, campaignId: payload.campaign_id },
            data: { isActive: false },
          });
          if (updated.count === 0) {
            throw new BadRequestException("Product not found");
          }
          // Optional cascade rule in dev doc: freeze briefs when product paused.
          await tx.uceCampaignBrief.updateMany({
            where: { campaignId: payload.campaign_id, isActive: true },
            data: { isActive: false },
          });
          return { campaign_id: payload.campaign_id };
        }

        const updated = await tx.uceCampaignBrief.updateMany({
          where: { id: payload.target_entity_uuid, campaignId: payload.campaign_id },
          data: { isActive: false },
        });
        if (updated.count === 0) {
          throw new BadRequestException("Brief not found");
        }
        return { campaign_id: payload.campaign_id };
      });

      await this.prisma.integrationBridgeSignalLedger.update({
        where: { id: ledger.id },
        data: {
          syncStatus: "SYNCHRONIZED",
          synchronizedAt: new Date(),
        },
      });

      return {
        success: true,
        bridge_tracking_id: ledger.id,
        message:
          "Orchestration signals cleanly validated and written to workspace architectures.",
        ...result,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Bridge processing failed";

      await this.prisma.integrationBridgeSignalLedger.update({
        where: { id: ledger.id },
        data: {
          syncStatus: "VALIDATION_FAILED",
          executionErrorLogs: message,
        },
      });

      if (err instanceof ConflictException) {
        throw err;
      }
      if (err instanceof BadRequestException) {
        throw err;
      }
      if (err instanceof UnprocessableEntityException) {
        throw err;
      }

      throw new UnprocessableEntityException({
        success: false,
        bridge_tracking_id: ledger.id,
        error_type: "BRIDGE_VALIDATION_FAILURE",
        diagnostic_details: message,
      });
    }
  }
}

