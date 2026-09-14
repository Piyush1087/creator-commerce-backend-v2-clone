import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { InstagramIntelligenceReadFenceError } from "../../brand-settings/services/instagram-intelligence-provider-read.service";
import { InstagramSyncCoordinatorRepository } from "./instagram-sync-coordinator.repository";
import { InstagramSyncPipelinePort } from "./instagram-sync-pipeline.port";

@Injectable()
export class InstagramSyncDispatcherService {
  private readonly logger = new Logger(InstagramSyncDispatcherService.name);

  constructor(
    private readonly coordinator: InstagramSyncCoordinatorRepository,
    private readonly pipeline: InstagramSyncPipelinePort,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: "instagram-intelligence-c1-dispatcher",
  })
  async dispatch(): Promise<{ processed: boolean }> {
    const worker = `instagram-c1:${process.pid}`;
    const lease = await this.coordinator.claimNext(worker);
    if (!lease) return { processed: false };
    const heartbeat = setInterval(() => {
      void this.coordinator.heartbeat(lease).catch((error: unknown) => {
        this.logger.warn(
          `instagram.sync_heartbeat_failed job=${lease.jobId} code=${safeReason(error)}`,
        );
      });
    }, 60_000);
    heartbeat.unref();
    try {
      const result = await this.pipeline.execute(lease);
      await this.coordinator.complete(lease, [...result.generationIds]);
    } catch (error) {
      const authorization =
        error instanceof InstagramIntelligenceReadFenceError;
      const reasonCode = safeReason(error);
      await this.coordinator.fail(
        lease,
        authorization ? "AUTHORIZATION" : "TRANSIENT",
        reasonCode,
      );
      this.logger.warn(
        `instagram.sync_failed job=${lease.jobId} class=${authorization ? "AUTHORIZATION" : "TRANSIENT"} code=${reasonCode}`,
      );
    } finally {
      clearInterval(heartbeat);
    }
    return { processed: true };
  }
}

function safeReason(error: unknown): string {
  if (error instanceof InstagramIntelligenceReadFenceError) return error.code;
  if (error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message)) {
    return error.message;
  }
  return "INSTAGRAM_SYNC_PIPELINE_FAILURE";
}
