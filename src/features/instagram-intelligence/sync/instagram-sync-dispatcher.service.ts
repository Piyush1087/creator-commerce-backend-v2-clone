import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { InstagramIntelligenceReadFenceError } from "../../brand-settings/services/instagram-intelligence-provider-read.service";
import { CreatorAudiencePipelineService } from "../../creator-audience/creator-audience-pipeline.service";
import { CreatorContentPipelineService } from "../../creator-content/creator-content-pipeline.service";
import { InstagramSyncCapabilityClass } from "@prisma/client";
import { InstagramSyncCoordinatorRepository } from "./instagram-sync-coordinator.repository";
import { InstagramSyncPipelinePort } from "./instagram-sync-pipeline.port";

@Injectable()
export class InstagramSyncDispatcherService {
  private readonly logger = new Logger(InstagramSyncDispatcherService.name);

  constructor(
    private readonly coordinator: InstagramSyncCoordinatorRepository,
    private readonly pipeline: InstagramSyncPipelinePort,
    @Optional()
    private readonly creatorAudience?: CreatorAudiencePipelineService,
    @Optional()
    private readonly creatorContent?: CreatorContentPipelineService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: "instagram-intelligence-c1-dispatcher",
  })
  async dispatch(): Promise<{ processed: boolean }> {
    const worker = `instagram-c1:${process.pid}`;
    const lease = await this.coordinator.claimNext(worker);
    if (!lease) {
      if (typeof this.coordinator.claimNextCreator !== "function") {
        return { processed: false };
      }
      const creatorLease = await this.coordinator.claimNextCreator(worker);
      if (!creatorLease) return { processed: false };
      const creatorPipeline =
        creatorLease.capabilityClass ===
        InstagramSyncCapabilityClass.PROFILE_MEDIA_PERFORMANCE
          ? this.creatorContent
          : this.creatorAudience;
      if (!creatorPipeline)
        throw new Error("CREATOR_INSIGHTS_PIPELINE_UNAVAILABLE");
      const heartbeat = setInterval(() => {
        void this.coordinator
          .heartbeat(creatorLease)
          .catch((error: unknown) => {
            this.logger.warn(
              `instagram.sync_heartbeat_failed job=${creatorLease.jobId} code=${safeReason(error)}`,
            );
          });
      }, 60_000);
      heartbeat.unref();
      try {
        const result = await creatorPipeline.execute({
          actor: creatorLease.actor,
          integrationId: creatorLease.integrationId,
          providerAccountId: creatorLease.providerAccountId,
          authorizationGeneration: creatorLease.authorizationGeneration,
          capturedAt: creatorLease.windowEnd,
          requestIdentity: creatorLease.requestIdentity,
        });
        await this.coordinator.complete(creatorLease, [
          ...result.generationIds,
        ]);
      } catch (error) {
        await this.coordinator.fail(
          creatorLease,
          isCreatorAuthorizationError(error) ? "AUTHORIZATION" : "TRANSIENT",
          safeReason(error),
        );
      } finally {
        clearInterval(heartbeat);
      }
      return { processed: true };
    }
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

function isCreatorAuthorizationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "CREATOR_AUDIENCE_AUTHORIZATION_FENCE_REJECTED" ||
      error.message === "CREATOR_CONTENT_AUTHORIZATION_FENCE_REJECTED")
  );
}
