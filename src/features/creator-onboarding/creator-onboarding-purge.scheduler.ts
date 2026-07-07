import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { CreatorOnboardingPurgeService } from "./creator-onboarding-purge.service";

@Injectable()
export class CreatorOnboardingPurgeScheduler {
  private readonly logger = new Logger(CreatorOnboardingPurgeScheduler.name);

  constructor(private readonly purge: CreatorOnboardingPurgeService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeAbandonedTracks(): Promise<void> {
    try {
      await this.purge.purgeAbandonedTracks();
    } catch (err) {
      this.logger.error(`Creator onboarding purge failed: ${String(err)}`);
    }
  }
}
