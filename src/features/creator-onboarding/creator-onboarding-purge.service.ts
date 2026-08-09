import { Injectable, Logger } from "@nestjs/common";
import { OnboardingStatus } from "@prisma/client";
import { subDays } from "date-fns";

import { PrismaService } from "../../prisma/prisma.service";

const ABANDONED_TRACK_RETENTION_DAYS = 7;

@Injectable()
export class CreatorOnboardingPurgeService {
  private readonly logger = new Logger(CreatorOnboardingPurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async purgeAbandonedTracks(): Promise<{ deleted: number }> {
    const cutoff = subDays(new Date(), ABANDONED_TRACK_RETENTION_DAYS);
    const result = await this.prisma.creatorOnboardingTrack.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        userId: null,
        status: {
          notIn: [
            OnboardingStatus.META_OAUTH_SUCCESS,
            OnboardingStatus.AI_ENGINE_SYNCED,
          ],
        },
      },
    });
    if (result.count > 0) {
      this.logger.log(
        `Purged ${result.count} abandoned creator onboarding tracks`,
      );
    }
    return { deleted: result.count };
  }
}
