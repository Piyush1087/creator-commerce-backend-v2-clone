import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Injectable()
export class CampaignLifecycleLockService {
  async lockCampaign(
    tx: Prisma.TransactionClient,
    campaignId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT id
        FROM uce_campaigns
        WHERE id = ${campaignId}
        FOR UPDATE
      `,
    );
    if (rows.length !== 1) {
      throw new NotFoundException("Campaign not found");
    }
  }
}
