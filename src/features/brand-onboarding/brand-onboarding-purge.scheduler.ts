import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { BrandOnboardingPurgeService } from "./brand-onboarding-purge.service";

@Injectable()
export class BrandOnboardingPurgeScheduler {
  private readonly logger = new Logger(BrandOnboardingPurgeScheduler.name);

  constructor(private readonly purge: BrandOnboardingPurgeService) {}

  /** Daily purge of unverified drafts past the 7-day horizon. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyPurge(): Promise<void> {
    try {
      const result = await this.purge.purgeStaleUnverifiedBrandProfiles();
      this.logger.log(`scheduled purge complete count=${result.deletedProfileCount}`);
    } catch (err) {
      this.logger.error(`scheduled purge failed err=${String(err)}`);
    }
  }
}
