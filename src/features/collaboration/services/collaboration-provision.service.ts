import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  CollaborationEscrowStatus,
  CollaborationLifecycle,
  CollaborationMessageKind,
  CollaborationPayoutMode,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
  UceMilestoneStage,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { splitEscrowQuote } from "../../brand-uce/utils/uce-decimal.util";
import { mapBrandIndustryToCollaborationIndustry } from "../utils/map-collaboration-industry.util";
import {
  mapCollaborationThreadRow,
  toDecimal,
} from "../utils/collaboration-thread.mapper";
import { COLLABORATION_THREAD_INCLUDE } from "./collaboration-access.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";

export type ProvisionCollaborationInput = {
  brandProfileId: string;
  campaignId: string;
  briefId: string;
  creatorUserId: string;
  sourceApplicationId?: string;
  campaignCreatorId?: string;
  canonicalCampaignAssetId?: string | null;
  canonicalBriefId?: string | null;
  productId?: string | null;
  ucePipelineCollaborationId?: string;
  payoutMode?: CollaborationPayoutMode;
  initialQuote?: number;
  productRetailValue?: number;
  advancePercent?: number;
  welcomeMessage?: string;
  allowExisting?: boolean;
};

type Tx = Prisma.TransactionClient;

@Injectable()
export class CollaborationProvisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: CollaborationRealtimeService,
  ) {}

  async ensureCreatorUser(
    email: string,
    instagramHandle?: string,
  ): Promise<string> {
    return this.prisma.$transaction((tx) =>
      this.ensureCreatorUserInTransaction(tx, email, instagramHandle),
    );
  }

  async ensureCreatorUserInTransaction(
    tx: Tx,
    email: string,
    instagramHandle?: string,
  ): Promise<string> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await tx.user.findUnique({
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
        await tx.creatorProfile.create({
          data: {
            userId: existing.id,
            instagramHandle: instagramHandle.replace(/^@/, ""),
          },
        });
      }
      return existing.id;
    }

    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        role: UserRole.CREATOR,
        creatorProfile: instagramHandle
          ? {
              create: {
                instagramHandle: instagramHandle.replace(/^@/, ""),
              },
            }
          : { create: {} },
      },
    });
    return user.id;
  }

  async provisionFromUceApproval(input: ProvisionCollaborationInput) {
    const result = await this.prisma.$transaction((tx) =>
      this.provisionFromUceApprovalInTransaction(tx, input),
    );
    await this.broadcastProvisioned(result.collaboration_id);
    return result;
  }

  async provisionFromUceApprovalInTransaction(
    tx: Tx,
    input: ProvisionCollaborationInput,
  ) {
    if (input.sourceApplicationId) {
      const existingByApplication = await tx.collaboration.findUnique({
        where: { sourceApplicationId: input.sourceApplicationId },
      });
      if (existingByApplication) {
        if (input.allowExisting === false) {
          throw new ConflictException(
            "A Collaboration already exists for this Application",
          );
        }
        const row = await tx.collaboration.findUniqueOrThrow({
          where: { id: existingByApplication.id },
          include: COLLABORATION_THREAD_INCLUDE,
        });
        return mapCollaborationThreadRow(row, "BRAND");
      }
    } else {
      // Compatibility-only fallback for non-Application provisioning callers.
      const existing = await tx.collaboration.findUnique({
        where: {
          campaignId_creatorUserId: {
            campaignId: input.campaignId,
            creatorUserId: input.creatorUserId,
          },
        },
      });
      if (existing) {
        if (input.allowExisting === false) {
          throw new ConflictException(
            "A Collaboration already exists for this campaign and creator",
          );
        }
        const row = await tx.collaboration.findUniqueOrThrow({
          where: { id: existing.id },
          include: COLLABORATION_THREAD_INCLUDE,
        });
        return mapCollaborationThreadRow(row, "BRAND");
      }
    }

    const campaign = await tx.uceCampaign.findFirst({
      where: { id: input.campaignId, brandProfileId: input.brandProfileId },
      include: {
        brandProfile: {
          select: {
            id: true,
            industry: true,
            brandRoutingType: true,
            countryCode: true,
          },
        },
        commercials: true,
      },
    });
    if (!campaign) {
      throw new BadRequestException("Campaign not found for brand");
    }

    const brief = await tx.uceCampaignBrief.findFirst({
      where: { id: input.briefId, campaignId: input.campaignId },
    });
    if (!brief) {
      throw new BadRequestException("Brief not found for campaign");
    }

    const creator = await tx.user.findUnique({
      where: { id: input.creatorUserId },
      include: { creatorProfile: true },
    });
    if (!creator) {
      throw new BadRequestException("Creator user not found");
    }

    const application = input.sourceApplicationId
      ? await tx.uceApplication.findUnique({
          where: { id: input.sourceApplicationId },
          include: { snapshot: true },
        })
      : null;
    if (input.sourceApplicationId && !application) {
      throw new BadRequestException("Source Application not found");
    }
    if (application) {
      if (application.campaignId !== input.campaignId) {
        throw new BadRequestException(
          "Source Application does not belong to this Campaign",
        );
      }
      if (
        input.campaignCreatorId &&
        application.campaignCreatorId !== input.campaignCreatorId
      ) {
        throw new BadRequestException(
          "Source Application does not belong to this Campaign Creator",
        );
      }
    }

    const payoutMode = input.payoutMode ?? CollaborationPayoutMode.ESCROW;
    const advancePercent =
      input.advancePercent ?? campaign.commercials?.advancePaymentPercentage ?? 0;
    const quote = input.initialQuote ?? 0;
    const { advance30Value, balance70Value } = splitEscrowQuote(
      quote,
      advancePercent,
    );

    const industry = mapBrandIndustryToCollaborationIndustry(
      campaign.brandProfile.industry,
      campaign.brandProfile.brandRoutingType,
    );

    const welcome =
      input.welcomeMessage ??
      `Congrats! You're approved for ${campaign.name}. View your brief and secure your spot.`;

    const commercialCurrency = campaign.commercials?.currency ??
      ((campaign.brandProfile.countryCode ?? "").toUpperCase() === "IN"
        ? "INR"
        : "USD");

    const campaignContext = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status,
      creationSource: campaign.creationSource,
    } as Prisma.InputJsonValue;
    const campaignAssetContext = {
      legacyProductId: input.productId ?? null,
      canonicalCampaignAssetId: input.canonicalCampaignAssetId ?? null,
    } as Prisma.InputJsonValue;
    const briefContext = {
      legacyBriefId: input.briefId,
      canonicalBriefId: input.canonicalBriefId ?? null,
    } as Prisma.InputJsonValue;
    const applicationContext = application
      ? ({
          applicationId: application.id,
          requestId: application.requestId,
          source: application.source,
          submissionSnapshotId: application.snapshot?.id ?? null,
        } as Prisma.InputJsonValue)
      : undefined;
    const creatorContext = {
      creatorUserId: creator.id,
      creatorProfileId: creator.creatorProfile?.id ?? null,
      email: creator.email,
    } as Prisma.InputJsonValue;
    const brandContext = {
      brandProfileId: campaign.brandProfile.id,
      industry: campaign.brandProfile.industry,
      countryCode: campaign.brandProfile.countryCode ?? null,
    } as Prisma.InputJsonValue;
    const campaignCommercialContext = campaign.commercials
      ? ({
          compensationType: campaign.commercials.compensationType,
          commercialOffer: campaign.commercials.commercialOffer.toString(),
          totalCampaignBudget: campaign.commercials.totalCampaignBudget.toString(),
          currency: campaign.commercials.currency,
          advancePaymentPercentage:
            campaign.commercials.advancePaymentPercentage,
          finalBalanceTerms: campaign.commercials.finalBalanceTerms,
          receivesBrandSupport: campaign.commercials.receivesBrandSupport,
          brandSupportType: campaign.commercials.brandSupportType ?? null,
          brandSupportEstimatedValue:
            campaign.commercials.brandSupportEstimatedValue?.toString() ?? null,
        } as Prisma.InputJsonValue)
      : undefined;

    try {
      const thread = await tx.collaboration.create({
        data: {
          brandProfileId: input.brandProfileId,
          creatorUserId: input.creatorUserId,
          campaignId: input.campaignId,
          briefId: input.briefId,
          productId: input.productId ?? undefined,
          sourceApplicationId: input.sourceApplicationId,
          campaignCreatorId: input.campaignCreatorId,
          campaignAssetId: input.canonicalCampaignAssetId ?? undefined,
          canonicalBriefId: input.canonicalBriefId ?? undefined,
          lifecycle: CollaborationLifecycle.ACTIVE,
          canonicalCurrentStage: CollaborationStage.NEGOTIATION,
          currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
          aggregateVersion: 1,
          ucePipelineCollaborationId: input.ucePipelineCollaborationId,
          currentStage: UceMilestoneStage.STAGE_1_NEGOTIATION,
          payoutMode,
          industry,
          snapshot: {
            create: {
              campaignContext,
              campaignAssetContext,
              briefContext,
              applicationContext,
              creatorContext,
              brandContext,
              campaignCommercialContext,
              receivesBrandSupport:
                campaign.commercials?.receivesBrandSupport ?? false,
              brandSupportType: campaign.commercials?.brandSupportType ?? null,
              brandSupportEstimatedValue:
                campaign.commercials?.brandSupportEstimatedValue ?? null,
              advancePercentageSnapshot: advancePercent,
              commercialCurrency,
            },
          },
          commercials: {
            create: {
              initialQuote: toDecimal(quote),
              productRetailValue: toDecimal(input.productRetailValue ?? 0),
              advance30Amount: toDecimal(advance30Value),
              balance70Amount: toDecimal(balance70Value),
              escrowStatus:
                payoutMode === CollaborationPayoutMode.BARTER
                  ? null
                  : CollaborationEscrowStatus.AWAITING_FUNDS,
            },
          },
          logistics: { create: {} },
          finalization: { create: {} },
        },
        include: COLLABORATION_THREAD_INCLUDE,
      });

      await tx.collaborationMessage.create({
        data: {
          collaborationId: thread.id,
          kind: CollaborationMessageKind.SYSTEM,
          systemEventTag: "STAGE_1_STARTED",
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

      return mapCollaborationThreadRow(thread, "BRAND");
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          input.sourceApplicationId
            ? "Collaboration already exists for this Application or is blocked by a transitional uniqueness constraint"
            : "Collaboration thread already exists for this campaign and creator",
        );
      }
      throw err;
    }
  }

  async broadcastProvisioned(collaborationId: string) {
    await this.realtime.broadcast(collaborationId, "thread.updated");
  }
}
