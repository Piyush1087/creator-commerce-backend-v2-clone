import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { BrandOnboardingPurgeService } from "./brand-onboarding-purge.service";

@Injectable()
export class BrandOnboardingPurgeScheduler {
  private readonly logger = new Logger(BrandOnboardingPurgeScheduler.name);

  constructor(private readonly purge: BrandOnboardingPurgeService) {}

  /** Daily purge of unverified drafts and expired discovery cache rows. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyPurge(): Promise<void> {
    try {
      const profiles = await this.purge.purgeStaleUnverifiedBrandProfiles();
      const leads = await this.purge.purgeExpiredDiscoveryLeads();
      this.logger.log(
        `scheduled purge complete profiles=${profiles.deletedProfileCount} discoveryLeads=${leads.deletedLeadCount}`,
      );
    } catch (err) {
      this.logger.error(`scheduled purge failed err=${String(err)}`);
    }
  }
}
