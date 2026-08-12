import { BadRequestException, Injectable } from "@nestjs/common";
import { UceCampaignShareChannel } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { BrandUceAccessService } from "./brand-uce-access.service";
import { CampaignQueryService } from "./campaign-query.service";

export type ShareChannel =
  | "COPY_LINK"
  | "WHATSAPP"
  | "INSTAGRAM"
  | "NATIVE_SHARE";

@Injectable()
export class CampaignCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
    private readonly query: CampaignQueryService,
  ) {}

  async executeShare(
    brandProfileId: string,
    campaignId: string,
    channel: ShareChannel,
    requestId: string,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const page = await this.query.getCampaignPage(brandProfileId, campaignId);
    if (!page.share.capability.available) {
      throw new BadRequestException(
        "Share is not available for this Campaign state.",
      );
    }
    if (
      !(page.share.supportedChannels as readonly ShareChannel[]).includes(
        channel,
      )
    ) {
      throw new BadRequestException("Unsupported share channel.");
    }
    if (!requestId?.trim()) {
      throw new BadRequestException("requestId is required.");
    }

    const existing = await this.prisma.uceCampaignShare.findUnique({
      where: { requestId: requestId.trim() },
    });
    if (existing) {
      return {
        ok: true,
        campaignId,
        channel: existing.channel,
        requestId: existing.requestId,
        trackingToken: existing.trackingToken,
        sharePath: `/c/${campaignId}?t=${existing.trackingToken}`,
        replayed: true,
      };
    }

    const token = createHash("sha256")
      .update(`${campaignId}:${requestId}:${randomBytes(8).toString("hex")}`)
      .digest("hex")
      .slice(0, 32);

    const created = await this.prisma.uceCampaignShare.create({
      data: {
        requestId: requestId.trim(),
        campaignId,
        channel: channel as UceCampaignShareChannel,
        trackingToken: token,
      },
    });

    return {
      ok: true,
      campaignId,
      channel: created.channel,
      requestId: created.requestId,
      trackingToken: created.trackingToken,
      sharePath: `/c/${campaignId}?t=${created.trackingToken}`,
      replayed: false,
    };
  }

  async recordShareClick(trackingToken: string) {
    const share = await this.prisma.uceCampaignShare.findUnique({
      where: { trackingToken },
    });
    if (!share) {
      throw new BadRequestException("Unknown share tracking token.");
    }
    await this.prisma.uceCampaignShareTrackingEvent.create({
      data: { shareId: share.id, type: "LINK_CLICKED" },
    });
    return { ok: true, campaignId: share.campaignId };
  }

  async composeOutreach(
    brandProfileId: string,
    campaignId: string,
    campaignCreatorId: string,
    brandInstruction?: string,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const creator = await this.prisma.uceCampaignCreator.findFirst({
      where: { id: campaignCreatorId, campaignId },
    });
    if (!creator) {
      throw new BadRequestException("Campaign creator not found.");
    }
    // Channel resolution remains service-owned; FE must not choose Email vs Priority DM.
    const channel = "EMAIL" as const;
    return {
      ok: true,
      campaignId,
      campaignCreatorId: creator.id,
      channel,
      subject: "Campaign invitation",
      body:
        brandInstruction?.trim() ||
        "We would like to invite you to participate in our campaign.",
    };
  }
}
