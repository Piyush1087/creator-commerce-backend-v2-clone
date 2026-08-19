import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  CollaborationEventKind,
  CollaborationFulfillmentState,
  CollaborationMessageKind,
  CollaborationNegotiationState,
  CollaborationPaymentRail,
  CollaborationPayoutMode,
  CollaborationPublicationAuthorizationState,
  CollaborationPublishingState,
  CollaborationSecurementState,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
  UceApplicationStatus,
  UceMilestoneStage,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  provisionCollaborationSchema,
  type ProvisionCollaborationInput,
} from "../schemas/provision-collaboration.schema";
import { mapCollaborationThreadRow } from "../utils/collaboration-thread.mapper";
import { mapBrandIndustryToCollaborationIndustry } from "../utils/map-collaboration-industry.util";
import { resolveProvisioningNegotiationState } from "../utils/collaboration-provisioning-initialization";
import { COLLABORATION_THREAD_INCLUDE } from "./collaboration-access.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";
import { PlanCommercialPolicyService } from "../../pricing/services/plan-commercial-policy.service";
import { BusinessGeographyFinancialPolicyService } from "../../pricing/services/business-geography-financial-policy.service";
import { calculateCommercialReserve } from "../utils/collaboration-financial-calculation";

const toJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class CollaborationProvisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: CollaborationRealtimeService,
    private readonly planPolicies: PlanCommercialPolicyService,
    private readonly geographyPolicies: BusinessGeographyFinancialPolicyService,
  ) {}

  async ensureCreatorUser(email: string, instagramHandle?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { creatorProfile: true },
    });
    if (existing) {
      if (existing.role !== UserRole.CREATOR) {
        throw new BadRequestException(
          "Email is registered to a non-creator account",
        );
      }
      if (!existing.creatorProfile && instagramHandle) {
        await this.prisma.creatorProfile.create({
          data: {
            userId: existing.id,
            instagramHandle: instagramHandle.replace(/^@/, ""),
          },
        });
      }
      return existing.id;
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        role: UserRole.CREATOR,
        creatorProfile: instagramHandle
          ? { create: { instagramHandle: instagramHandle.replace(/^@/, "") } }
          : { create: {} },
      },
    });
    return user.id;
  }

  async provisionFromApprovedApplication(
    rawInput: ProvisionCollaborationInput,
  ) {
    const parsed = provisionCollaborationSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;

    const existing = await this.prisma.collaboration.findUnique({
      where: { sourceApplicationId: input.sourceApplicationId },
      include: COLLABORATION_THREAD_INCLUDE,
    });
    if (existing) return mapCollaborationThreadRow(existing, "BRAND");

    const application = await this.prisma.uceApplication.findUnique({
      where: { id: input.sourceApplicationId },
      include: {
        campaign: { include: { brandProfile: true, commercials: true } },
        campaignCreator: {
          include: {
            creatorUser: { include: { creatorProfile: true } },
            creatorProfile: true,
          },
        },
        campaignAsset: true,
        brief: {
          include: { deliverables: { orderBy: { displayOrder: "asc" } } },
        },
        snapshot: true,
        legacyPipelineCollaboration: true,
      },
    });
    if (!application || application.status !== UceApplicationStatus.APPROVED) {
      throw new BadRequestException(
        "Source Application must exist and be APPROVED",
      );
    }

    const deliverables = application.brief.deliverables;
    const applicability = new Map(
      input.deliverablePublishingApplicability.map((item) => [
        item.sourceBriefDeliverableId,
        item.publishingRequired,
      ]),
    );
    const sourceIds = new Set(deliverables.map((item) => item.id));
    if (
      deliverables.length === 0 ||
      applicability.size !== deliverables.length ||
      [...applicability.keys()].some((id) => !sourceIds.has(id))
    ) {
      throw new BadRequestException(
        "Publishing applicability must explicitly and exactly cover every source Brief Deliverable",
      );
    }

    const commercials = application.campaign.commercials;
    if (!commercials) {
      throw new BadRequestException(
        "Campaign commercial configuration is required",
      );
    }
    const advancePercentage = commercials.advancePaymentPercentage;
    if (
      !Number.isInteger(advancePercentage) ||
      advancePercentage < 0 ||
      advancePercentage > 100
    ) {
      throw new BadRequestException(
        "Campaign advance percentage must be an integer from 0 to 100",
      );
    }
    const currency = commercials.currency.toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException(
        "Campaign commercial currency must be ISO-4217 shaped",
      );
    }

    const negotiationState = resolveProvisioningNegotiationState(
      commercials.compensationType,
    );
    const negotiationRequired =
      negotiationState !== CollaborationNegotiationState.NOT_REQUIRED;
    const fixedAgreedFee = negotiationRequired
      ? null
      : (application.proposedFee ?? commercials.fixedFeeAmount);
    if (!negotiationRequired && fixedAgreedFee === null) {
      throw new BadRequestException(
        "Fixed Campaign compensation requires an authoritative fixed fee",
      );
    }
    const advanceAmount = fixedAgreedFee?.mul(advancePercentage).div(100);
    const balanceAmount = fixedAgreedFee?.minus(advanceAmount ?? 0);
    const fixedPolicy = !negotiationRequired
      ? await this.prisma.$transaction(async (tx) => {
          const plan = await this.planPolicies.resolveForBrand(
            application.campaign.brandProfileId,
            tx,
          );
          const geography = this.geographyPolicies.resolve(
            application.campaign.brandProfile.countryCode,
          );
          return {
            plan,
            geography,
            reserve: calculateCommercialReserve(
              fixedAgreedFee!,
              plan.platformCommissionRate,
              geography.platformCommissionGstRate,
            ),
          };
        })
      : null;
    const securementState = negotiationRequired
      ? null
      : fixedAgreedFee!.greaterThan(0)
        ? CollaborationSecurementState.AWAITING_ESCROW_FUNDING
        : CollaborationSecurementState.NOT_REQUIRED;
    const canonicalStage = negotiationRequired
      ? CollaborationStage.NEGOTIATION
      : securementState === CollaborationSecurementState.AWAITING_ESCROW_FUNDING
        ? CollaborationStage.SECUREMENT
        : commercials.receivesBrandSupport
          ? CollaborationStage.FULFILLMENT
          : CollaborationStage.PRODUCTION;

    const creatorUserId =
      application.campaignCreator.creatorUserId ??
      application.campaignCreator.creatorUser?.id ??
      application.campaignCreator.creatorProfile?.userId;
    if (!creatorUserId) {
      throw new BadRequestException(
        "Approved Application is missing a linked Creator user",
      );
    }

    const welcome = `Congrats! You're approved for ${application.campaign.name}. View your brief and secure your spot.`;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const thread = await tx.collaboration.create({
          data: {
            sourceApplicationId: application.id,
            campaignCreatorId: application.campaignCreatorId,
            campaignAssetId: application.campaignAssetId,
            brandProfileId: application.campaign.brandProfileId,
            creatorUserId,
            campaignId: application.campaignId,
            briefId: application.briefId,
            productId: application.campaignAssetId,
            ucePipelineCollaborationId:
              application.legacyPipelineCollaborationId ?? undefined,
            currentStage: UceMilestoneStage.STAGE_1_NEGOTIATION,
            canonicalStage,
            currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
            payoutMode: CollaborationPayoutMode.ESCROW,
            // Retained only for the legacy read model. Canonical Fulfillment is
            // initialized exclusively from the locked Campaign Brand Support fields.
            industry: mapBrandIndustryToCollaborationIndustry(
              application.campaign.brandProfile.industry,
              application.campaign.brandProfile.brandRoutingType,
            ),
            snapshot: {
              create: {
                campaignContext: toJson(application.campaign),
                campaignAssetContext: toJson(application.campaignAsset),
                briefContext: toJson(application.brief),
                applicationContext: toJson(application.snapshot ?? application),
                creatorContext: toJson(application.campaignCreator.creatorUser),
                brandContext: toJson(application.campaign.brandProfile),
                receivesBrandSupport: commercials.receivesBrandSupport,
                brandSupportType: commercials.brandSupportType,
                brandSupportEstimatedValue:
                  commercials.brandSupportEstimatedValue,
                campaignCommercialContext: toJson(commercials),
                advancePercentageSnapshot: advancePercentage,
                commercialCurrency: currency,
              },
            },
            commercialAgreement: {
              create: {
                negotiationState,
                applicationProposedFee: application.proposedFee,
                agreedCreatorFee: fixedAgreedFee,
                currency,
                advancePercentageSnapshot: advancePercentage,
                advanceAmount,
                balanceAmount,
                pricingTierSnapshot: fixedPolicy?.plan.tier,
                businessCountryCodeSnapshot: fixedPolicy?.geography.countryCode,
                financialPolicyVersionSnapshot: fixedPolicy
                  ? `${fixedPolicy.plan.policyVersion}|${fixedPolicy.geography.policyVersion}`
                  : undefined,
                platformCommissionRateSnapshot:
                  fixedPolicy?.plan.platformCommissionRate,
                platformCommissionAmount:
                  fixedPolicy?.reserve.platformCommissionAmount,
                platformCommissionGstRateSnapshot:
                  fixedPolicy?.geography.platformCommissionGstRate,
                platformCommissionGstAmount:
                  fixedPolicy?.reserve.platformCommissionGstAmount,
                paymentRail: CollaborationPaymentRail.PLATFORM_ESCROW,
                securementState,
                requiredSecuredAmount:
                  fixedPolicy?.reserve.requiredSecuredAmount,
                termsLockedAt: negotiationRequired ? null : new Date(),
              },
            },
            fulfillment: {
              create: {
                state: commercials.receivesBrandSupport
                  ? canonicalStage === CollaborationStage.FULFILLMENT
                    ? CollaborationFulfillmentState.AWAITING_BRAND_FULFILLMENT
                    : CollaborationFulfillmentState.NOT_STARTED
                  : CollaborationFulfillmentState.SKIPPED,
              },
            },
            deliverables: {
              create: deliverables.map((deliverable) => {
                const publishingRequired = applicability.get(deliverable.id);
                if (publishingRequired === undefined) {
                  throw new BadRequestException(
                    "Unresolved publishing applicability",
                  );
                }
                return {
                  sourceBriefDeliverableId: deliverable.id,
                  displayOrder: deliverable.displayOrder,
                  definitionSnapshot: toJson(deliverable),
                  publishingRequired,
                  publishing: {
                    create: publishingRequired
                      ? {
                          state:
                            CollaborationPublishingState.AWAITING_PUBLISHING,
                          authorizationState:
                            CollaborationPublicationAuthorizationState.NOT_AUTHORIZED,
                        }
                      : {
                          state:
                            CollaborationPublishingState.PUBLISHING_NOT_REQUIRED,
                          authorizationState:
                            CollaborationPublicationAuthorizationState.NOT_REQUIRED,
                        },
                  },
                };
              }),
            },
            commercials: { create: {} },
            logistics: { create: {} },
            finalization: { create: {} },
          },
          include: COLLABORATION_THREAD_INCLUDE,
        });
        await tx.collaborationEvent.create({
          data: {
            collaborationId: thread.id,
            kind: CollaborationEventKind.DOMAIN,
            eventType: "COLLABORATION_PROVISIONED",
            actorClass: "SYSTEM",
            commandId: input.commandId,
            aggregateVersion: 1,
            payload: { sourceApplicationId: application.id },
          },
        });
        await tx.collaborationMessage.create({
          data: {
            collaborationId: thread.id,
            kind: CollaborationMessageKind.SYSTEM,
            systemEventTag: "COLLABORATION_PROVISIONED",
            body: welcome,
          },
        });
        await tx.collaboration.update({
          where: { id: thread.id },
          data: {
            lastMessageSnippet: welcome.slice(0, 200),
            lastMessageAt: new Date(),
            unreadCountCreator: { increment: 1 },
          },
        });
        return thread;
      });
      void this.realtime.broadcast(created.id, "thread.updated");
      return mapCollaborationThreadRow(created, "BRAND");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Collaboration already exists for this source Application",
        );
      }
      throw error;
    }
  }
}
