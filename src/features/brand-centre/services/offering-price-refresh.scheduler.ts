import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";

import { OfferingPriceRefreshConfigService } from "./offering-price-refresh-config.service";
import { OfferingPriceRefreshCoordinatorService } from "./offering-price-refresh-coordinator.service";

const INTERVAL_NAME = "offering-price-refresh-scan";

@Injectable()
export class OfferingPriceRefreshScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OfferingPriceRefreshScheduler.name);
  private registered = false;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly config: OfferingPriceRefreshConfigService,
    private readonly coordinator: OfferingPriceRefreshCoordinatorService,
  ) {}

  onModuleInit(): void {
    const config = this.config.read();
    if (!config.enabled) return;
    const timer = setInterval(
      () => {
        void this.coordinator.runBatch().catch((error: unknown) => {
          this.logger.error(
            "Offering price refresh scan failed",
            error instanceof Error ? error.stack : undefined,
          );
        });
      },
      config.scanIntervalMinutes * 60 * 1000,
    );
    timer.unref();
    this.registry.addInterval(INTERVAL_NAME, timer);
    this.registered = true;
  }

  onModuleDestroy(): void {
    if (this.registered) this.registry.deleteInterval(INTERVAL_NAME);
  }
}
