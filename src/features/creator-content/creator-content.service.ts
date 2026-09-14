import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { CreatorAudienceCredentialFenceService } from "../creator-audience/creator-audience-credential-fence.service";
import {
  CREATOR_CONTENT_V0_CONTRACT_VERSION,
  CreatorContentConsumerSchema,
  type CreatorContentConsumer,
} from "./contracts/creator-content-v0.contract";
import { CreatorContentRepository } from "./creator-content.repository";

@Injectable()
export class CreatorContentService {
  constructor(
    private readonly actors: CreatorWorkspaceActorService,
    private readonly fence: CreatorAudienceCredentialFenceService,
    private readonly repository: CreatorContentRepository,
  ) {}
  read(user: AuthUser) {
    return this.readAt(user, new Date());
  }
  async readAt(user: AuthUser, now: Date): Promise<CreatorContentConsumer> {
    const actor = await this.actors.resolveReadOnly(user);
    if (!actor.allowedActions.includes("INSIGHTS_CONTENT_READ"))
      throw new ForbiddenException("Creator Content read access required");
    const source = await this.fence.project(actor);
    const identity =
      source.integrationId &&
      source.providerAccountId &&
      source.authorizationGeneration !== null
        ? {
            creatorProfileId: actor.subjectCreatorProfileId,
            creatorWorkspaceId: actor.workspaceId,
            integrationId: source.integrationId,
            providerAccountId: source.providerAccountId,
            authorizationGeneration: source.authorizationGeneration,
          }
        : null;
    const current = identity
      ? await this.repository.readLatestCurrentSameAccount(identity)
      : null;
    const processingState = identity
      ? await this.repository.readProcessingTruth(identity)
      : "IDLE";
    if (current) {
      const capturedAt = current.value.freshness.capturedAt
        ? new Date(current.value.freshness.capturedAt)
        : current.generatedAt;
      const stale = now.getTime() - capturedAt.getTime() >= 48 * 3_600_000;
      const awaitingReplacement =
        source.authorizationGeneration !== current.authorizationGeneration;
      const projectedProcessing =
        processingState === "FAILED"
          ? "FAILED"
          : awaitingReplacement && source.authorized
            ? "PROCESSING"
            : processingState;
      return CreatorContentConsumerSchema.parse({
        ...current.value,
        context: { role: actor.actorRole },
        freshness: {
          state: stale ? "STALE" : "CURRENT",
          staleAfterHours: 48,
          capturedAt: capturedAt.toISOString(),
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
    const end = now.toISOString(),
      start = new Date(now.getTime() - 90 * 86_400_000).toISOString();
    return CreatorContentConsumerSchema.parse({
      contractVersion: CREATOR_CONTENT_V0_CONTRACT_VERSION,
      generatedAt: new Date(0).toISOString(),
      status: "UNAVAILABLE",
      context: { role: actor.actorRole },
      source: "INSTAGRAM",
      sourceStatus: source.sourceStatus,
      snapshot: {
        windowDays: 90,
        windowStart: start,
        windowEnd: end,
        eligibleCount: 0,
        providerRowsReturned: 0,
        cap: 24,
        coverage: 0,
        media: [],
      },
      highlights: [],
      whatYouCreate: { themes: [], formats: [] },
      performance: { comparisonProfile: "v0.1", claims: [] },
      representatives: [],
      freshness: { state: "UNKNOWN", staleAfterHours: 48, capturedAt: null },
      processingState:
        processingState === "FAILED"
          ? "FAILED"
          : source.authorized
            ? "PROCESSING"
            : "IDLE",
      currentPreserved: false,
      limitations: ["CONTENT_DATA_NOT_YET_AVAILABLE"],
      settingsRecoveryRoute: "/creator/settings/instagram",
    });
  }
}
