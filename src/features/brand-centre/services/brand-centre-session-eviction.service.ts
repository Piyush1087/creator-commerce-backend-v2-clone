import { Injectable } from "@nestjs/common";
import { LeakPlannerStatus } from "@prisma/client";
import { subMinutes } from "date-fns";

import { PrismaService } from "../../../prisma/prisma.service";

const INACTIVITY_MINUTES = 30;

@Injectable()
export class BrandCentreSessionEvictionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * REQ-EVT-004: archive session-scoped leak cards on logout.
   */
  async evictForBrandProfile(brandProfileId: string): Promise<{ archived: number }> {
    const result = await this.prisma.brandPerformanceLeak.updateMany({
      where: {
        brandProfileId,
        isArchived: false,
        plannerStatus: {
          in: [
            LeakPlannerStatus.PUSHED_TO_PLANNER,
            LeakPlannerStatus.DISCARDED,
          ],
        },
      },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });
    return { archived: result.count };
  }

  /**
   * REQ-EVT-004: after 30 minutes without Brand Centre API activity, run the same
   * archive rules as logout (pushed-to-planner / discarded leaks).
   */
  async evictIfInactive(brandProfileId: string): Promise<{ archived: number }> {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { brandCentreLastActiveAt: true },
    });
    if (!profile?.brandCentreLastActiveAt) {
      return { archived: 0 };
    }
    const cutoff = subMinutes(new Date(), INACTIVITY_MINUTES);
    if (profile.brandCentreLastActiveAt > cutoff) {
      return { archived: 0 };
    }
    return this.evictForBrandProfile(brandProfileId);
  }

  async touchActivity(brandProfileId: string): Promise<void> {
    await this.prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: { brandCentreLastActiveAt: new Date() },
    });
  }
}
