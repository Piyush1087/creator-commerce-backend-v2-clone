import { ForbiddenException, Injectable } from "@nestjs/common";

import type { AuthUser } from "../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { CreatorAudienceCredentialFenceService } from "./creator-audience-credential-fence.service";
import {
  CREATOR_AUDIENCE_V0_CONTRACT_VERSION,
  CreatorAudienceConsumerSchema,
  type CreatorAudienceConsumer,
} from "./contracts/creator-audience-v0.contract";
import { CreatorAudienceRepository } from "./creator-audience.repository";

@Injectable()
export class CreatorAudienceService {
  constructor(
    private readonly actors: CreatorWorkspaceActorService,
    private readonly fence: CreatorAudienceCredentialFenceService,
    private readonly repository: CreatorAudienceRepository,
  ) {}

  async read(user: AuthUser): Promise<CreatorAudienceConsumer> {
    return this.readAt(user, new Date());
  }

  async readAt(user: AuthUser, now: Date): Promise<CreatorAudienceConsumer> {
    const actor = await this.actors.resolveReadOnly(user);
    if (!actor.allowedActions.includes("INSIGHTS_AUDIENCE_READ")) {
      throw new ForbiddenException("Creator Audience read access required");
    }
    const source = await this.fence.project(actor);
    const current =
      source.integrationId &&
      source.providerAccountId &&
      source.authorizationGeneration !== null
        ? await this.repository.readLatestCurrentSameAccount({
            creatorProfileId: actor.subjectCreatorProfileId,
            creatorWorkspaceId: actor.workspaceId,
            integrationId: source.integrationId,
            providerAccountId: source.providerAccountId,
            authorizationGeneration: source.authorizationGeneration,
          })
        : null;
    const processingState =
      source.integrationId && source.providerAccountId
        ? await this.repository.readProcessingTruth({
            creatorProfileId: actor.subjectCreatorProfileId,
            creatorWorkspaceId: actor.workspaceId,
            integrationId: source.integrationId,
            providerAccountId: source.providerAccountId,
          })
        : "IDLE";
    if (current) {
      const capturedAt = current.value.snapshotBasis.capturedAt
        ? new Date(current.value.snapshotBasis.capturedAt)
        : current.generatedAt;
      const stale =
        now.getTime() - capturedAt.getTime() >= 192 * 60 * 60 * 1000;
      const awaitingReplacement =
        source.authorizationGeneration !== current.authorizationGeneration;
      const projectedProcessing =
        processingState === "FAILED"
          ? "FAILED"
          : awaitingReplacement && source.authorized
            ? "PROCESSING"
            : processingState;
      return CreatorAudienceConsumerSchema.parse({
        ...current.value,
        context: { role: actor.actorRole },
        freshness: {
          state: stale ? "STALE" : "CURRENT",
          staleAfterHours: 192,
        },
        processingState: projectedProcessing,
        sourceStatus:
          projectedProcessing === "FAILED"
            ? "PROVIDER_FAILURE"
            : source.sourceStatus,
        currentPreserved:
          current.value.currentPreserved ||
          source.sourceStatus !== "CONNECTED" ||
          awaitingReplacement ||
          projectedProcessing === "FAILED",
      });
    }
    return CreatorAudienceConsumerSchema.parse({
      contractVersion: CREATOR_AUDIENCE_V0_CONTRACT_VERSION,
      generatedAt: new Date(0).toISOString(),
      status: "UNAVAILABLE",
      context: { role: actor.actorRole },
      source: "INSTAGRAM",
      sourceStatus: source.sourceStatus,
      snapshotBasis: {
        period: "lifetime",
        timeframe: "this_month",
        capturedAt: null,
      },
      defaultCohort: null,
      highlights: [],
      cohorts: [],
      freshness: { state: "UNKNOWN", staleAfterHours: 192 },
      processingState:
        processingState === "FAILED"
          ? "FAILED"
          : source.authorized
            ? "PROCESSING"
            : "IDLE",
      currentPreserved: false,
      limitations: ["AUDIENCE_DATA_NOT_YET_AVAILABLE"],
      settingsRecoveryRoute: "/creator/settings/instagram",
    });
  }
}
