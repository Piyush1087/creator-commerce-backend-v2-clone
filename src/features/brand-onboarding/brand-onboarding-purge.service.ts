import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { BRAND_UNVERIFIED_PURGE_AFTER_DAYS } from "./brand-scan-gate.config";
import { subDays } from "date-fns";

@Injectable()
export class BrandOnboardingPurgeService {
  private readonly logger = new Logger(BrandOnboardingPurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deletes unverified brand drafts with no organization older than the purge horizon.
   * Children (offerings, competitors, locations) cascade via Prisma relations.
   */
  async purgeStaleUnverifiedBrandProfiles(): Promise<{ deletedProfileCount: number }> {
    const cutoff = subDays(new Date(), BRAND_UNVERIFIED_PURGE_AFTER_DAYS);

    const stale = await this.prisma.brandProfile.findMany({
      where: {
        isVerified: false,
        organizationId: null,
        createdAt: { lt: cutoff },
      },
      select: { id: true, domain: true },
    });

    if (stale.length === 0) {
      this.logger.log("purge: no stale unverified brand profiles");
      return { deletedProfileCount: 0 };
    }

    const ids = stale.map((row) => row.id);
    const result = await this.prisma.brandProfile.deleteMany({
      where: { id: { in: ids } },
    });

    this.logger.log(
      `purge: deleted ${result.count} unverified profiles older than ${BRAND_UNVERIFIED_PURGE_AFTER_DAYS}d`,
    );
    return { deletedProfileCount: result.count };
  }
}
