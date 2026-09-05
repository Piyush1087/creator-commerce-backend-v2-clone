import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  CollaborationEscrowStatus,
  CollaborationMessageKind,
  CollaborationPayoutMode,
  Prisma,
  UceMilestoneStage,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { normalizeEmail } from "../../../shared/identity/normalize-email";
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
    const normalizedEmail = normalizeEmail(email);
    const existing = await tx.user.findUnique({
      where: { normalizedEmail },
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
        normalizedEmail,
        role: UserRole.CREATOR,
        authState: UserAuthState.PROVISIONAL,
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
    const existing = await tx.collaboration.findFirst({
      where: {
        campaignId: input.campaignId,
        creatorUserId: input.creatorUserId,
        sourceApplicationId: null,
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

    const campaign = await tx.uceCampaign.findFirst({
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

    const brief = await tx.uceCampaignBrief.findFirst({
      where: { id: input.briefId, campaignId: input.campaignId },
    });
    if (!brief) {
      throw new BadRequestException("Brief not found for campaign");
    }

    const creator = await tx.user.findUnique({
      where: { id: input.creatorUserId },
    });
    if (!creator) {
      throw new BadRequestException("Creator user not found");
    }

    const payoutMode = input.payoutMode ?? CollaborationPayoutMode.ESCROW;

    const advancePercent =
      input.advancePercent ??
      campaign.commercials?.advancePaymentPercentage ??
      30;
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

      return mapCollaborationThreadRow(thread, "BRAND");
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

  async broadcastProvisioned(collaborationId: string) {
    await this.realtime.broadcast(collaborationId, "thread.updated");
  }
}
