import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { BrandSettingsIntegrationsService } from "../services/brand-settings-integrations.service";

@Injectable()
export class BrandIntegrationTokenExpiryScheduler {
  private readonly logger = new Logger(
    BrandIntegrationTokenExpiryScheduler.name,
  );

  constructor(
    private readonly integrations: BrandSettingsIntegrationsService,
  ) {}

  /** Daily midnight sweep: flip expired active tokens to TOKEN_EXPIRED. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: "brand-instagram-token-expiry",
  })
  async handleMidnightTokenExpiry(): Promise<void> {
    try {
      const result = await this.integrations.markExpiredTokens();
      this.logger.log(
        `token expiry sweep complete scanned=${result.scanned} expired=${result.expired}`,
      );
    } catch (err) {
      // Never rethrow — a failed sweep must not take down the process.
      this.logger.error(`token expiry sweep failed err=${String(err)}`);
    }
  }
}
