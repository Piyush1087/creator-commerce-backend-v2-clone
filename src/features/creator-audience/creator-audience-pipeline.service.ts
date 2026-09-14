import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import {
  INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
  type InstagramAudienceBreakdown,
  type InstagramAudienceInsightsTruth,
  type InstagramAudiencePopulation,
  type InstagramIntelligenceProviderReadClient,
} from "../instagram/instagram-intelligence-provider.types";
import { CreatorAudienceCredentialFenceService } from "./creator-audience-credential-fence.service";
import {
  normalizeCreatorAudience,
  type CreatorAudienceAcquisition,
} from "./creator-audience-normalizer";
import {
  CreatorAudienceRepository,
  type CreatorAudiencePersistenceIdentity,
} from "./creator-audience.repository";

const POPULATIONS: readonly InstagramAudiencePopulation[] = [
  "FOLLOWERS",
  "ENGAGED_AUDIENCE",
];
const BREAKDOWNS: readonly InstagramAudienceBreakdown[] = [
  "AGE",
  "GENDER",
  "COUNTRY",
  "CITY",
];

@Injectable()
export class CreatorAudiencePipelineService {
  constructor(
    private readonly fence: CreatorAudienceCredentialFenceService,
    private readonly repository: CreatorAudienceRepository,
    @Inject(INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT)
    private readonly provider: InstagramIntelligenceProviderReadClient,
  ) {}

  async execute(input: {
    actor: CreatorWorkspaceActorContext;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    capturedAt?: Date;
    requestIdentity?: string;
  }) {
    const capturedAt = input.capturedAt ?? new Date();
    const identity: CreatorAudiencePersistenceIdentity = {
      creatorProfileId: input.actor.subjectCreatorProfileId,
      creatorWorkspaceId: input.actor.workspaceId,
      integrationId: input.integrationId,
      providerAccountId: input.providerAccountId,
      authorizationGeneration: input.authorizationGeneration,
      requestIdentity:
        input.requestIdentity ??
        creatorAudienceRequestIdentity({
          ...input,
          capturedAt,
        }),
    };
    const projected = await this.fence.project(input.actor);
    if (
      !projected.authorized ||
      projected.integrationId !== identity.integrationId ||
      projected.providerAccountId !== identity.providerAccountId ||
      projected.authorizationGeneration !== identity.authorizationGeneration
    ) {
      throw new Error("CREATOR_AUDIENCE_AUTHORIZATION_FENCE_REJECTED");
    }
    const replay = await this.repository.replay(identity);
    if (replay) return { value: replay, reused: true, generationIds: [] };
    const credential = await this.fence.acquire(input.actor, identity);
    await this.repository.begin(identity);
    const profile = await this.provider.readProfile(credential);
    const results: InstagramAudienceInsightsTruth[] = [];
    for (const population of POPULATIONS) {
      for (const breakdown of BREAKDOWNS) {
        results.push(
          await this.provider.readAudienceInsights(
            credential,
            population,
            breakdown,
            "THIS_MONTH",
          ),
        );
      }
    }
    const acquisition: CreatorAudienceAcquisition = {
      capturedAt: capturedAt.toISOString(),
      followerCount: profile.followersCount,
      results,
    };
    const value = normalizeCreatorAudience({
      acquisition,
      role: "OWNER",
      now: capturedAt,
    });
    if (value.status === "UNAVAILABLE") {
      await this.repository.fail(identity);
      const previous = await this.repository.readCurrent(identity);
      return {
        value: previous
          ? {
              ...previous,
              sourceStatus: "PROVIDER_FAILURE" as const,
              processingState: "FAILED" as const,
              currentPreserved: true,
            }
          : value,
        reused: false,
        generationIds: [],
      };
    }
    const persisted = await this.repository.publish({
      identity,
      acquisition,
      value,
    });
    return {
      value,
      reused: false,
      generationIds: [persisted.objectGenerationId],
    };
  }
}

export function creatorAudienceRequestIdentity(input: {
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  capturedAt: Date;
}): string {
  const week = new Date(input.capturedAt);
  week.setUTCHours(0, 0, 0, 0);
  week.setUTCDate(week.getUTCDate() - week.getUTCDay());
  return `creator-audience:${createHash("sha256")
    .update(
      `${input.integrationId}:${input.providerAccountId}:${input.authorizationGeneration}:${week.toISOString()}:creator-audience-v0.1`,
    )
    .digest("hex")}`;
}
