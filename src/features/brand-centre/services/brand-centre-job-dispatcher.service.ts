import { Injectable, Logger } from "@nestjs/common";
import { BrandCentreJobType } from "@prisma/client";

import { DeepScanWorker } from "../workers/deep-scan.worker";
import { IntelligenceRefreshWorker } from "../workers/intelligence-refresh.worker";
import { PlannerAggregateWorker } from "../workers/planner-aggregate.worker";

@Injectable()
export class BrandCentreJobDispatcherService {
  private readonly logger = new Logger(BrandCentreJobDispatcherService.name);

  constructor(
    private readonly deepScan: DeepScanWorker,
    private readonly intelligenceRefresh: IntelligenceRefreshWorker,
    private readonly plannerAggregate: PlannerAggregateWorker,
  ) {}

  dispatchInBackground(jobId: string, type: BrandCentreJobType): void {
    setImmediate(() => {
      void this.run(jobId, type);
    });
  }

  private async run(jobId: string, type: BrandCentreJobType): Promise<void> {
    this.logger.log(`brand-centre.job.dispatch jobId=${jobId} type=${type}`);
    try {
      switch (type) {
        case BrandCentreJobType.DEEP_SCAN:
          await this.deepScan.run(jobId);
          break;
        case BrandCentreJobType.INTELLIGENCE_REFRESH:
          await this.intelligenceRefresh.run(jobId);
          break;
        case BrandCentreJobType.PLANNER_AGGREGATE:
          await this.plannerAggregate.run(jobId);
          break;
        default:
          this.logger.warn(`Unknown job type for jobId=${jobId}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown";
      this.logger.error(`job.dispatch_error jobId=${jobId} error=${message}`);
    }
  }
}
