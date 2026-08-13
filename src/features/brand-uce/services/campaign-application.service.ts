import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  UceApplicationSource,
  UceApplicationStatus,
  UceCampaignCreatorIngestionMethod,
  UceCampaignCreatorSource,
  UceCollabStatus,
  UceMediaPlatform,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  approveApplicationInputSchema,
  rejectApplicationInputSchema,
} from "../validation/applicants/application.schema";
import { BrandUceAccessService } from "./brand-uce-access.service";
import { BrandUcePipelineService } from "./brand-uce-pipeline.service";

function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

@Injectable()
export class CampaignApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
    private readonly pipeline: BrandUcePipelineService,
  ) {}

  /**
   * Ensure Application + CampaignCreator rows exist for legacy Collaboration
   * applicant rows (backfill only; Applications remain decision truth).
   */
  async syncFromLegacyCollaborations(campaignId: string) {
    const applicantRows = await this.prisma.uceCampaignCollaboration.findMany({
      where: {
        campaignId,
        collabStatus: {
          in: [
            UceCollabStatus.APPLICANT_PENDING,
            UceCollabStatus.APPLICANT_SHORTLISTED,
            UceCollabStatus.APPLICANT_REJECTED,
          ],
        },
      },
      include: { brief: true },
    });

    for (const row of applicantRows) {
      const normalized = normalizeHandle(row.instagramHandle);
      const creator = await this.prisma.uceCampaignCreator.upsert({
        where: {
          campaignId_platform_normalizedSocialHandle: {
            campaignId,
            platform: UceMediaPlatform.INSTAGRAM,
            normalizedSocialHandle: normalized,
          },
        },
        create: {
          campaignId,
          creatorProfileId: row.creatorProfileId,
          platform: UceMediaPlatform.INSTAGRAM,
          socialHandle: row.instagramHandle,
          normalizedSocialHandle: normalized,
          email: row.creatorEmail,
          source: UceCampaignCreatorSource.MANUAL,
          ingestionMethod: UceCampaignCreatorIngestionMethod.MANUAL_SINGLE,
        },
        update: {
          creatorProfileId: row.creatorProfileId ?? undefined,
          email: row.creatorEmail,
        },
      });

      const assetId = row.productId ?? row.brief.productId;
      if (!assetId) continue;

      const existing = await this.prisma.uceApplication.findFirst({
        where: {
          campaignId,
          campaignCreatorId: creator.id,
          briefId: row.briefId,
          status: {
            in: [
              UceApplicationStatus.PENDING,
              UceApplicationStatus.APPROVED,
              UceApplicationStatus.REJECTED,
            ],
          },
        },
      });
      if (existing) continue;

      const status =
        row.collabStatus === UceCollabStatus.APPLICANT_REJECTED
          ? UceApplicationStatus.REJECTED
          : UceApplicationStatus.PENDING;

      await this.prisma.uceApplication.create({
        data: {
          requestId: `legacy-${row.id}`,
          campaignId,
          campaignCreatorId: creator.id,
          campaignAssetId: assetId,
          briefId: row.briefId,
          status,
          source: UceApplicationSource.DIRECT,
          rejectedAt:
            status === UceApplicationStatus.REJECTED ? new Date() : null,
          snapshot: {
            create: {
              campaignContext: { campaignId },
              campaignAssetContext: { campaignAssetId: assetId },
              briefContext: { briefId: row.briefId },
              commercialContext: {},
              creatorIdentity: {
                socialHandle: row.instagramHandle,
                email: row.creatorEmail,
              },
            },
          },
        },
      });
    }
  }

  async listApplicants(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    await this.syncFromLegacyCollaborations(campaignId);

    const rows = await this.prisma.uceApplication.findMany({
      where: {
        campaignId,
        status: {
          in: [
            UceApplicationStatus.PENDING,
            UceApplicationStatus.APPROVED,
            UceApplicationStatus.REJECTED,
            UceApplicationStatus.SUPERSEDED,
          ],
        },
      },
      include: { campaignCreator: true },
      orderBy: { appliedAt: "desc" },
      take: 50,
    });

    return {
      state: rows.length ? ("READY" as const) : ("EMPTY" as const),
      applicants: rows.map((row) => ({
        applicationId: row.id,
        campaignCreatorId: row.campaignCreatorId,
        name: row.campaignCreator.socialHandle,
        category: "Creator",
        followers: "—",
        engagement: "—",
        avatarInitials: row.campaignCreator.socialHandle
          .slice(0, 2)
          .toUpperCase(),
        applicationStatus: row.status as
          | "PENDING"
          | "APPROVED"
          | "REJECTED"
          | "SUPERSEDED"
          | "WITHDRAWN"
          | "EXPIRED",
        source: row.source,
        appliedAt: row.appliedAt.toISOString(),
        intelligenceStatus: "UNAVAILABLE" as const,
      })),
    };
  }

  async approve(
    brandProfileId: string,
    campaignId: string,
    applicationId: string,
    actorId: string,
  ) {
    const parsed = approveApplicationInputSchema.safeParse({ applicationId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const application = await this.prisma.uceApplication.findFirst({
      where: { id: applicationId, campaignId },
      include: { campaignCreator: true },
    });
    if (!application) throw new NotFoundException("Application not found");
    if (application.status !== UceApplicationStatus.PENDING) {
      throw new BadRequestException("Only PENDING applications can be approved");
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.uceApplication.update({
        where: { id: applicationId },
        data: { status: UceApplicationStatus.APPROVED, approvedAt: now },
      });
      await tx.uceApplication.updateMany({
        where: {
          campaignId,
          campaignCreatorId: application.campaignCreatorId,
          status: UceApplicationStatus.PENDING,
          id: { not: applicationId },
        },
        data: {
          status: UceApplicationStatus.SUPERSEDED,
          supersededByApplicationId: applicationId,
          supersededAt: now,
        },
      });
    });

    // Explicit Collaboration handoff (downstream), not Applicant truth.
    const collab = await this.prisma.uceCampaignCollaboration.findFirst({
      where: {
        campaignId,
        instagramHandle: {
          equals: application.campaignCreator.socialHandle,
          mode: "insensitive",
        },
      },
    });
    if (collab) {
      if (
        collab.collabStatus === UceCollabStatus.APPLICANT_PENDING ||
        collab.collabStatus === UceCollabStatus.APPLICANT_SHORTLISTED
      ) {
        await this.pipeline.approveApplicant(
          brandProfileId,
          campaignId,
          collab.id,
          {
            product_id: application.campaignAssetId,
          },
          actorId,
        );
      }
    }

    return { ok: true, applicationId, status: "APPROVED" as const };
  }

  async reject(
    brandProfileId: string,
    campaignId: string,
    applicationId: string,
    actorId: string,
    reason?: string,
  ) {
    const parsed = rejectApplicationInputSchema.safeParse({ applicationId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const application = await this.prisma.uceApplication.findFirst({
      where: { id: applicationId, campaignId },
      include: { campaignCreator: true },
    });
    if (!application) throw new NotFoundException("Application not found");
    if (application.status !== UceApplicationStatus.PENDING) {
      throw new BadRequestException("Only PENDING applications can be rejected");
    }

    await this.prisma.uceApplication.update({
      where: { id: applicationId },
      data: {
        status: UceApplicationStatus.REJECTED,
        rejectedAt: new Date(),
      },
    });

    const collab = await this.prisma.uceCampaignCollaboration.findFirst({
      where: {
        campaignId,
        instagramHandle: {
          equals: application.campaignCreator.socialHandle,
          mode: "insensitive",
        },
      },
    });
    if (
      collab &&
      (collab.collabStatus === UceCollabStatus.APPLICANT_PENDING ||
        collab.collabStatus === UceCollabStatus.APPLICANT_SHORTLISTED)
    ) {
      await this.pipeline.rejectApplicant(
        brandProfileId,
        campaignId,
        collab.id,
        { rejection_reason: reason?.trim() || "Rejected" },
        actorId,
      );
    }

    return { ok: true, applicationId, status: "REJECTED" as const };
  }
}
