import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { CreatorInstagramTokenRefreshService } from "./creator-instagram-token-refresh.service";

export const CREATOR_INSTAGRAM_REFRESH_CRON = "0 0 3 * * *";

@Injectable()
export class CreatorInstagramTokenRefreshScheduler {
  private readonly logger = new Logger(
    CreatorInstagramTokenRefreshScheduler.name,
  );

  constructor(private readonly refresh: CreatorInstagramTokenRefreshService) {}

  /** Daily low-frequency sweep; per-row version/generation fences prevent stale writes. */
  @Cron(CREATOR_INSTAGRAM_REFRESH_CRON, {
    name: "creator-instagram-token-refresh",
    waitForCompletion: true,
  })
  async handleDailyRefresh(): Promise<void> {
    try {
      const result = await this.refresh.refreshDueTokens();
      this.logger.log(
        `creator.instagram.refresh_complete scanned=${result.scanned} refreshed=${result.refreshed} expired=${result.expired} reauthorizationRequired=${result.reauthorizationRequired} providerBlocked=${result.providerBlocked} retryableFailures=${result.retryableFailures}`,
      );
    } catch {
      this.logger.error("creator.instagram.refresh_sweep_failed");
    }
  }
}
