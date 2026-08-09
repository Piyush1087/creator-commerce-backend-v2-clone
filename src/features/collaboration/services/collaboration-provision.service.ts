import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  CollaborationEscrowStatus,
  CollaborationMessageKind,
  CollaborationPayoutMode,
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
  productId?: string | null;
  ucePipelineCollaborationId?: string;
  payoutMode?: CollaborationPayoutMode;
  initialQuote?: number;
  productRetailValue?: number;
  advancePercent?: number;
  welcomeMessage?: string;
};

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
    const existing = await this.prisma.collaboration.findUnique({
      where: {
        campaignId_creatorUserId: {
          campaignId: input.campaignId,
          creatorUserId: input.creatorUserId,
        },
      },
    });
    if (existing) {
      const row = await this.prisma.collaboration.findUniqueOrThrow({
        where: { id: existing.id },
        include: COLLABORATION_THREAD_INCLUDE,
      });
      return mapCollaborationThreadRow(row, "BRAND");
    }

    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: input.campaignId, brandProfileId: input.brandProfileId },
      include: {
        brandProfile: {
          select: { industry: true, brandRoutingType: true },
        },
        commercials: true,
      },
    });
    if (!campaign) {
      throw new BadRequestException("Campaign not found for brand");
    }

    const brief = await this.prisma.uceCampaignBrief.findFirst({
      where: { id: input.briefId, campaignId: input.campaignId },
    });
    if (!brief) {
      throw new BadRequestException("Brief not found for campaign");
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: input.creatorUserId },
    });
    if (!creator) {
      throw new BadRequestException("Creator user not found");
    }

    const payoutMode =
      input.payoutMode ??
      (campaign.commercials?.compensationType === "FIXED_FEE"
        ? CollaborationPayoutMode.ESCROW
        : CollaborationPayoutMode.ESCROW);

    const advancePercent =
      input.advancePercent ?? campaign.commercials?.advancePaymentPercentage ?? 30;
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

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const thread = await tx.collaboration.create({
          data: {
            brandProfileId: input.brandProfileId,
            creatorUserId: input.creatorUserId,
            campaignId: input.campaignId,
            briefId: input.briefId,
            productId: input.productId ?? undefined,
            ucePipelineCollaborationId: input.ucePipelineCollaborationId,
            currentStage: UceMilestoneStage.STAGE_1_NEGOTIATION,
            payoutMode,
            industry,
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

        return thread;
      });

      void this.realtime.broadcast(created.id, "thread.updated");
      return mapCollaborationThreadRow(created, "BRAND");
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          "Collaboration thread already exists for this campaign and creator",
        );
      }
      throw err;
    }
  }
}
