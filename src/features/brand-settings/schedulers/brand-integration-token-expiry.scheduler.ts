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

  /** Daily sweep: proactively refresh due tokens; timestamp alone never requires reconnect. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: "brand-instagram-token-expiry",
  })
  async handleMidnightTokenExpiry(): Promise<void> {
    try {
      const result = await this.integrations.markExpiredTokens();
      this.logger.log(
        `instagram token lifecycle sweep complete scanned=${result.scanned} reauthorizationRequired=${result.expired}`,
      );
    } catch (err) {
      // Never rethrow — a failed sweep must not take down the process.
      this.logger.error(`token expiry sweep failed err=${String(err)}`);
    }
  }
}
