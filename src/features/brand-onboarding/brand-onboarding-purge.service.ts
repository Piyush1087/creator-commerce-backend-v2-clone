import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { BRAND_UNVERIFIED_PURGE_AFTER_DAYS } from "./brand-scan-gate.config";
import { subDays } from "date-fns";

@Injectable()
export class BrandOnboardingPurgeService {
  private readonly logger = new Logger(BrandOnboardingPurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async purgeStaleUnverifiedBrandProfiles(): Promise<{
    deletedProfileCount: number;
  }> {
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

  /**
   * Deletes expired Step 1 discovery cache rows (unsigned, past expires_at).
   * Waitlist children cascade via Prisma relations.
   */
  async purgeExpiredDiscoveryLeads(): Promise<{ deletedLeadCount: number }> {
    const now = new Date();
    const result = await this.prisma.discoveryLead.deleteMany({
      where: {
        signupCompleted: false,
        expiresAt: { lt: now },
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `purge: deleted ${result.count} expired discovery leads (unsigned, past expires_at)`,
      );
    } else {
      this.logger.log("purge: no expired discovery leads");
    }
    return { deletedLeadCount: result.count };
  }
}
