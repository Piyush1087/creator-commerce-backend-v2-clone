import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BrandInstagramDeletionService } from "../services/brand-instagram-deletion.service";

@Injectable()
export class BrandInstagramDeletionScheduler {
  private readonly logger = new Logger(BrandInstagramDeletionScheduler.name);
  constructor(private readonly deletion: BrandInstagramDeletionService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: "brand-instagram-deletion-resume",
  })
  async resume(): Promise<void> {
    try {
      const processed = await this.deletion.processPending();
      if (processed)
        this.logger.log(`instagram.deletion.resumed count=${processed}`);
    } catch (error) {
      this.logger.error(
        `instagram.deletion.resume_failed type=${error instanceof Error ? error.name : "unknown"}`,
      );
    }
  }
}
