import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CampaignApplicationStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { BrandUceAccessService } from "./brand-uce-access.service";

@Injectable()
export class CampaignApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
  ) {}

  async discovery(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    return {
      availability: "UNAVAILABLE" as const,
      message:
        "Recommendations are not available for this Campaign yet. Applications remain separate from recommendations.",
      recommendations: [],
    };
  }

  async list(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const rows = await this.prisma.campaignApplication.findMany({
      where: { campaignId },
      include: {
        creatorUser: { select: { id: true, name: true, email: true } },
        canonicalBrief: { select: { id: true, title: true } },
        collaboration: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => this.map(row));
  }

  async decide(
    brandProfileId: string,
    campaignId: string,
    applicationId: string,
    status: "ACCEPTED" | "REJECTED",
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const application = await this.prisma.campaignApplication.findFirst({
      where: { id: applicationId, campaignId },
    });
    if (!application) throw new NotFoundException("Application not found");
    if (application.status !== CampaignApplicationStatus.SUBMITTED) {
      throw new ConflictException("This Application has already been decided.");
    }
    const updated = await this.prisma.campaignApplication.update({
      where: { id: applicationId },
      data: { status },
      include: {
        creatorUser: { select: { id: true, name: true, email: true } },
        canonicalBrief: { select: { id: true, title: true } },
        collaboration: { select: { id: true } },
      },
    });
    return this.map(updated);
  }

  private map(row: {
    id: string;
    status: CampaignApplicationStatus;
    createdAt: Date;
    creatorUser: { id: string; name: string | null; email: string };
    canonicalBrief: { id: string; title: string };
    collaboration: { id: string } | null;
  }) {
    return {
      application_id: row.id,
      status: row.status,
      creator: {
        creator_user_id: row.creatorUser.id,
        name: row.creatorUser.name,
        email: row.creatorUser.email,
      },
      brief: { brief_id: row.canonicalBrief.id, title: row.canonicalBrief.title },
      collaboration_reference: row.collaboration
        ? { collaboration_id: row.collaboration.id }
        : null,
      created_at: row.createdAt.toISOString(),
    };
  }
}
