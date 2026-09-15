import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encryptField } from "../../shared/crypto/field-encryption.util";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import { ContractBundleIntegrityVerifier } from "../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { BundlePathOwnershipRegistry } from "../brand-intelligence/contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../brand-intelligence/contracts/registry/contract-runtime.registry";
import { PersistenceTransitionValidator } from "../brand-intelligence/contracts/validation/persistence-transition.validator";
import { SemanticValidator } from "../brand-intelligence/contracts/validation/semantic.validator";
import { StructuralValidator } from "../brand-intelligence/contracts/validation/structural.validator";
import { ExecutionAggregationService } from "../brand-intelligence/execution/execution-aggregation.service";
import { ProcessorExecutorRegistry } from "../brand-intelligence/execution/executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "../brand-intelligence/execution/executor/synthetic-processor.executor";
import { IntelligenceExecutionService } from "../brand-intelligence/execution/intelligence-execution.service";
import { ProcessorExecutionRepository } from "../brand-intelligence/execution/processor-execution.repository";
import { ProcessorFinalizationService } from "../brand-intelligence/execution/processor-finalization.service";
import { ProcessorWorkerService } from "../brand-intelligence/execution/processor-worker.service";
import { RetryBackoffPolicy } from "../brand-intelligence/execution/policy/retry-backoff.policy";
import { ExecutionContractGate } from "../brand-intelligence/execution/registry/execution-contract.gate";
import { IntelligenceActionRepository } from "../brand-intelligence/persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "../brand-intelligence/persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "../brand-intelligence/persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "../brand-intelligence/persistence/intelligence-generation.repository";
import { ComponentPathCodec } from "../brand-intelligence/semantic-path/component-path.codec";
import { IntelligenceTransitionService } from "../brand-intelligence/transitions/intelligence-transition.service";
import { CreatorAudienceCredentialFenceService } from "../creator-audience/creator-audience-credential-fence.service";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import type { InstagramIntelligenceProviderReadClient } from "../instagram/instagram-intelligence-provider.types";
import { InstagramSyncCoordinatorRepository } from "../instagram-intelligence/sync/instagram-sync-coordinator.repository";
import { CreatorContentPersistenceHook } from "./creator-content-persistence.hook";
import { CreatorContentPipelineService } from "./creator-content-pipeline.service";
import { CreatorContentProcessorExecutor } from "./creator-content-processor.executor";
import { CreatorContentRepository } from "./creator-content.repository";
import { ConfigService } from "@nestjs/config";
import { CreatorContentMultimodalService } from "./creator-content-multimodal.service";
import { creatorContentExternalFixture } from "./testing/creator-content-external.fixture";
import { InstagramContainedImageAcquisitionService } from "../instagram/media/instagram-contained-image-acquisition.service";
import { InstagramContainedVideoAcquisitionService } from "../instagram/media/video/instagram-contained-video-acquisition.service";
import { InstagramSecureImageDownloader } from "../instagram/media/instagram-secure-image-downloader";
import { InstagramSecureVideoDownloader } from "../instagram/media/video/instagram-secure-video-downloader";
import { rm } from "node:fs/promises";
import { dirname } from "node:path";
import { CreatorBrandContentSourceAdapter } from "../creator-brand/creator-brand-content-source.adapter";
import {
  CreatorBrandSuggestionsProcessor,
  type CreatorBrandSemanticPort,
} from "../creator-brand/creator-brand-suggestions.processor";
import { CreatorBrandSuggestionsPersistenceHook } from "../creator-brand/creator-brand-suggestions.persistence";
import { CreatorBrandSuggestionsPipeline } from "../creator-brand/creator-brand-suggestions.pipeline";
import { creatorBrandCanonicalArchetypes } from "../creator-brand/contracts/creator-brand-archetype.adapter";
import { CreatorBrandRepository } from "../creator-brand/creator-brand.repository";
import { CreatorBrandService } from "../creator-brand/creator-brand.service";
import {
  CreatorBrandSuggestionsConsumer,
  emptyCreatorBrandProfile,
} from "../creator-brand/creator-brand-suggestions.consumer";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import type { AuthUser } from "../auth/types/auth-user";

const enabled = process.env.CREATOR_CONTENT_DATABASE_TEST === "true";
describe.skipIf(!enabled)(
  "Creator Content V0 PostgreSQL vertical slice",
  () => {
    const db = new PrismaClient();
    let pipeline: CreatorContentPipelineService;
    let scopes: IntelligenceOwnerScopeRepository;
    let suggestions: CreatorBrandSuggestionsPipeline;
    let sourceAdapter: CreatorBrandContentSourceAdapter;
    let semanticCalls = 0;
    let failSuggestions = false;
    let omitLanguageSuggestion = false;
    let p2FailureMode: "NONE" | "VALIDATION" | "PERSISTENCE" = "NONE";
    const suggestionModel: CreatorBrandSemanticPort = {
      identity: () => ({
        provider: "LOCAL_FIXTURE",
        model: "grounded-fixture",
        profileVersion: "1.0",
      }),
      observe: async ({ posts }) => {
        semanticCalls += 1;
        if (failSuggestions) throw new Error("FIXTURE_SEMANTIC_UNAVAILABLE");
        if (p2FailureMode === "VALIDATION")
          return { contractVersion: "1.0", candidates: [], HIGH: true };
        const eligible = posts
          .filter((post) => post.semantic.state === "AVAILABLE" && post.caption)
          .slice(0, 5);
        const support = eligible.map((post) => ({
          providerMediaId: post.providerMediaId,
          modality: "caption",
          excerpt: post.caption!.slice(0, 200),
        }));
        const visual = posts
          .filter(
            (post) =>
              post.semantic.state === "AVAILABLE" &&
              post.semantic.visualExecution.length,
          )
          .slice(0, 5);
        return {
          contractVersion: "1.0",
          candidates: [
            { field: "primaryNicheIds", value: ["EDUCATION"], support },
            { field: "headline", value: "Tutorial creator", support },
            { field: "voiceDescriptorIds", value: ["EDUCATIONAL"], support },
            {
              field: "voiceDescription",
              value: "Source-supported tutorial delivery",
              support,
            },
            {
              field: "creatorArchetypeIds",
              value: [creatorBrandCanonicalArchetypes()[0].id],
              support,
            },
            ...(omitLanguageSuggestion
              ? []
              : [{ field: "languageTags", value: ["en"], support }]),
            ...(visual.length >= 3
              ? [
                  {
                    field: "visualStyleDescriptors",
                    value: [
                      visual[0].semantic.visualExecution[0].slice(0, 100),
                    ],
                    support: visual.map((post) => ({
                      providerMediaId: post.providerMediaId,
                      modality: "visualExecution",
                      excerpt: post.semantic.visualExecution[0],
                    })),
                  },
                ]
              : []),
          ],
        };
      },
    };
    let providerCalls = 0;
    let failProvider = false;
    let contentPostCount = 8;
    let availableMediaCount = Number.POSITIVE_INFINITY;
    let external: Awaited<ReturnType<typeof creatorContentExternalFixture>>;
    const capturedAt = new Date("2026-09-15T12:00:00.000Z");
    const provider: InstagramIntelligenceProviderReadClient = {
      readProfile: async () => {
        throw new Error("UNEXPECTED_METHOD");
      },
      readAudienceInsights: async () => {
        throw new Error("UNEXPECTED_METHOD");
      },
      readCarouselChildren: async () => {
        providerCalls += 1;
        return {
          availability: "AVAILABLE",
          stopReason: "EXHAUSTED",
          children: [0, 1].map((ordinal) => ({
            providerMediaId: `child-${ordinal}`,
            ordinal,
            mediaType: { state: "OBSERVED", value: "IMAGE" },
            mediaProductType: { state: "OBSERVED", value: "FEED" },
          })),
        };
      },
      readMediaInventory: async (_credential, end, days) => {
        expect(days).toBe(90);
        expect(end).toEqual(capturedAt);
        providerCalls += 1;
        if (failProvider) throw new Error("FIXTURE_PROVIDER_FAILURE");
        const items = Array.from({ length: contentPostCount }, (_, index) => ({
          providerMediaId: `media-${index}`,
          mediaType: {
            state: "OBSERVED" as const,
            value: index === 0 ? "CAROUSEL_ALBUM" : "IMAGE",
          },
          mediaProductType: {
            state: "OBSERVED" as const,
            value:
              index === 1 ? "REELS" : index === 0 ? "CAROUSEL_ALBUM" : "IMAGE",
          },
          permalink: {
            state: "OBSERVED" as const,
            value: `https://www.instagram.com/p/media-${index}/`,
          },
          caption: {
            state: "OBSERVED" as const,
            value: "untrusted source text",
          },
          timestamp: {
            state: "OBSERVED" as const,
            value: new Date(
              capturedAt.getTime() - (index === 7 ? 45 : index) * 86_400_000,
            ).toISOString(),
          },
        }));
        return {
          availability: "AVAILABLE" as const,
          items,
          coverage: {
            windowStart: new Date(
              capturedAt.getTime() - 90 * 86_400_000,
            ).toISOString(),
            windowEnd: capturedAt.toISOString(),
            pagesAttempted: 1,
            pagesCompleted: 1,
            rowsReturned: items.length,
            rowsEligible: items.length,
            rowsMissingTimestamp: 0,
            duplicatesDiscarded: 0,
            oldestObservedTimestamp: items.at(-1)!.timestamp.value,
            newestObservedTimestamp: items[0].timestamp.value,
            stopReason: "EXHAUSTED" as const,
          },
        };
      },
      readMediaInsights: async (_, mediaId) => {
        providerCalls += 1;
        const high = Number(mediaId.slice(-1)) < 4;
        const metric = (value: number) =>
          value === 0
            ? ({ state: "OBSERVED_ZERO", value: 0 } as const)
            : ({ state: "OBSERVED", value } as const);
        const metrics = {
          comments: metric(1),
          likes: metric(high ? 20 : 5),
          reach: metric(100),
          saved: metric(1),
          shares: metric(1),
          total_interactions: metric(high ? 20 : 5),
          views: metric(100),
        };
        const unavailable = {
          state: "UNAVAILABLE" as const,
          reason: "NO_PROVIDER_DENOMINATOR" as const,
        };
        return {
          availability: "AVAILABLE" as const,
          mediaType: "IMAGE",
          metrics,
          units: {
            comments: "COUNT" as const,
            likes: "COUNT" as const,
            reach: "COUNT" as const,
            saved: "COUNT" as const,
            shares: "COUNT" as const,
            total_interactions: "COUNT" as const,
            views: "COUNT" as const,
          },
          denominators: {
            comments: unavailable,
            likes: unavailable,
            reach: unavailable,
            saved: unavailable,
            shares: unavailable,
            total_interactions: unavailable,
            views: unavailable,
          },
          providerObservationTime: {
            state: "UNAVAILABLE" as const,
            reason: "PROVIDER_DOES_NOT_RETURN_OBSERVATION_TIME" as const,
          },
          providerLagLimitHours: 48 as const,
        };
      },
    };

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        url.hostname !== "localhost" ||
        !["/creator_content_p2", "/c05_creator_brand_upgrade_shared"].includes(
          url.pathname,
        )
      )
        throw new Error("CREATOR_CONTENT_DISPOSABLE_DATABASE_REQUIRED");
      await db.$connect();
      const prisma = db as never;
      const codec = new ComponentPathCodec();
      const semantic = new SemanticValidator();
      const contracts = new ContractRuntimeRegistry(
        new ContractBundleIntegrityVerifier(),
        semantic,
      );
      contracts.onModuleInit();
      const executor = new CreatorContentProcessorExecutor();
      const executors = new ProcessorExecutorRegistry(
        new SyntheticProcessorExecutor(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        executor,
        new CreatorBrandSuggestionsProcessor(suggestionModel),
      );
      const ownership = new BundlePathOwnershipRegistry(contracts, codec);
      const aggregation = new ExecutionAggregationService();
      const retry = new RetryBackoffPolicy();
      const processorRepository = new ProcessorExecutionRepository(
        prisma,
        aggregation,
        retry,
      );
      const current = new IntelligenceCurrentStateRepository(prisma);
      const transitions = new IntelligenceTransitionService(
        prisma,
        current,
        new IntelligenceCandidateRepository(prisma),
        new IntelligenceActionRepository(prisma),
        codec,
      );
      const persistence = new CreatorContentPersistenceHook(
        new IntelligenceGenerationRepository(prisma, codec),
        current,
        transitions,
        new PersistenceTransitionValidator(contracts, ownership),
        new StructuralValidator(),
        semantic,
        contracts,
      );
      sourceAdapter = new CreatorBrandContentSourceAdapter(prisma);
      const suggestionPersistence = new CreatorBrandSuggestionsPersistenceHook(
        new IntelligenceGenerationRepository(prisma, codec),
        current,
        transitions,
        new PersistenceTransitionValidator(contracts, ownership),
        new StructuralValidator(),
        semantic,
        contracts,
        sourceAdapter,
      );
      const worker = new ProcessorWorkerService(
        processorRepository,
        new ProcessorFinalizationService(
          prisma,
          processorRepository,
          aggregation,
          retry,
        ),
        executors,
        {
          persistBeforeCompletion: async (tx, claim, result) => {
            if (
              claim.processorExecution.processorId ===
              "creator_brand_suggestions_v0"
            ) {
              await suggestionPersistence.persistBeforeCompletion(
                tx,
                claim,
                result,
              );
              if (p2FailureMode === "PERSISTENCE")
                throw new Error("LOCAL_P2_FINALIZATION_ROLLBACK");
            } else await persistence.persistBeforeCompletion(tx, claim, result);
          },
        },
      );
      suggestions = new CreatorBrandSuggestionsPipeline(
        sourceAdapter,
        new IntelligenceExecutionService(
          prisma,
          new ExecutionContractGate(contracts, executors),
          ownership,
          codec,
        ),
        worker,
        prisma,
        suggestionModel,
      );
      external = await creatorContentExternalFixture(
        `postgres-${randomUUID()}`,
      );
      scopes = new IntelligenceOwnerScopeRepository(
        prisma,
        external.imageStore,
        external.videoStore,
      );
      const fence = new CreatorAudienceCredentialFenceService(prisma);
      const semanticFixture = new CreatorContentMultimodalService(
        new ConfigService({
          INSTAGRAM_IMAGE_VISUAL_ENABLED: "true",
          INSTAGRAM_SELECTED_VIDEO_FRAMES_ENABLED: "true",
          INSTAGRAM_SELECTED_VIDEO_SPEECH_ENABLED: "true",
        }),
        fence,
        provider,
        new InstagramContainedImageAcquisitionService(
          external.imageLocator,
          new InstagramSecureImageDownloader(
            external.resolver,
            external.transport,
            external.imageStore,
          ),
        ),
        external.imageStore,
        new InstagramContainedVideoAcquisitionService(
          external.videoLocator,
          new InstagramSecureVideoDownloader(
            external.resolver,
            external.transport,
            external.videoStore,
          ),
        ),
        external.videoStore,
        external.decoder,
        external.audio,
        external.visual,
        external.ocr,
        external.frameModel,
        external.speech,
        external.grounded,
      );
      pipeline = new CreatorContentPipelineService(
        new CreatorAudienceCredentialFenceService(prisma),
        new CreatorContentRepository(prisma, scopes),
        new IntelligenceExecutionService(
          prisma,
          new ExecutionContractGate(contracts, executors),
          ownership,
          codec,
        ),
        worker,
        provider,
        {
          replayProfileIdentity: () =>
            `${semanticFixture.replayProfileIdentity()}:creator-content-fixture-available-${availableMediaCount}`,
          analyze: async (request) =>
            Number(request.media.providerMediaId.split("-").at(-1)) <
            availableMediaCount
              ? semanticFixture.analyze(request)
              : {
                  providerMediaId: request.media.providerMediaId,
                  state: "UNKNOWN",
                  themes: [],
                  captionPatterns: [],
                  creativeStructures: [],
                  visualExecution: [],
                },
        },
      );
    }, 30_000);
    afterAll(async () => {
      await db.$disconnect();
      if (external)
        await rm(dirname(external.imageStore.getRootForDiagnostics()), {
          recursive: true,
          force: true,
        });
    });

    async function owner() {
      const suffix = randomUUID();
      const organization = await db.organization.create({
        data: { kind: "CREATOR", name: `Content ${suffix}` },
      });
      const user = await db.user.create({
        data: {
          email: `${suffix}@example.test`,
          normalizedEmail: `${suffix}@example.test`,
          role: "CREATOR",
          authState: "ACTIVE",
          organizationId: organization.id,
          emailVerifiedAt: new Date(),
        },
      });
      const profile = await db.creatorProfile.create({
        data: { userId: user.id },
      });
      const workspace = await db.creatorWorkspace.create({
        data: { ownerProfileId: profile.id, organizationId: organization.id },
      });
      const providerAccountId = `fixture-${suffix}`;
      const integration = await db.creatorSocialIntegration.create({
        data: {
          creatorProfileId: profile.id,
          platformNetwork: "INSTAGRAM",
          nativePlatformUserId: providerAccountId,
          channelHandleString: `fixture_${suffix.slice(0, 8)}`,
          oauthAccessTokenEncrypted: encryptField(`synthetic-${suffix}`),
          tokenScopePermissions: [
            "instagram_business_basic",
            "instagram_business_manage_insights",
          ],
          tokenStateCondition: "ACTIVE",
          authorizationGeneration: 1,
          authorizationHealth: "USABLE",
          basicAuthorizationCapability: "AVAILABLE",
          insightsCapability: "AVAILABLE",
          professionalAccountType: "CREATOR",
        },
      });
      const actor: CreatorWorkspaceActorContext = {
        actorUserId: user.id,
        actorMembershipId: randomUUID(),
        actorRole: "OWNER",
        workspaceId: workspace.id,
        organizationId: organization.id,
        subjectCreatorProfileId: profile.id,
        subjectOwnerUserId: user.id,
        allowedActions: ["INSIGHTS_CONTENT_READ"],
      };
      return { profile, workspace, integration, actor, providerAccountId };
    }

    it("P2 reads exact accepted Content, publishes five-path shared current, replays without acquisition, confirms explicitly and purges derived state only", async () => {
      const fixture = await owner();
      const integration = {
        integrationId: fixture.integration.id,
        providerAccountId: fixture.providerAccountId,
        authorizationGeneration: 1,
      };
      await pipeline.execute({
        actor: fixture.actor,
        ...integration,
        capturedAt,
        requestIdentity: `p2-source:${randomUUID()}`,
      });
      const source = await sourceAdapter.read(fixture.actor);
      expect(source).not.toBeNull();
      expect(source!.componentGenerations).toHaveLength(8);
      expect(source!.posts).toHaveLength(8);
      expect(JSON.stringify(source!.posts)).not.toMatch(
        /metrics|highlights|performance|oauthAccessToken|encrypted/,
      );
      const scopeId = source!.ownerScopeId;
      const count = async () => ({
        captures: await db.dataExtractionCapture.count({
          where: { ownerScopeId: scopeId },
        }),
        deEvidence: await db.dataExtractionEvidenceItem.count({
          where: { ownerScopeId: scopeId },
        }),
        executions: await db.intelligenceExecution.count({
          where: { ownerScopeId: scopeId },
        }),
        processors: await db.intelligenceProcessorExecution.count({
          where: { ownerScopeId: scopeId },
        }),
        attempts: await db.intelligenceProcessorAttempt.count({
          where: { ownerScopeId: scopeId },
        }),
        objects: await db.intelligenceObjectGeneration.count({
          where: { ownerScopeId: scopeId },
        }),
        components: await db.intelligenceComponentGeneration.count({
          where: { ownerScopeId: scopeId },
        }),
        refs: await db.intelligenceEvidenceReference.count({
          where: { ownerScopeId: scopeId },
        }),
        current: await db.intelligenceCurrentComponent.count({
          where: { ownerScopeId: scopeId },
        }),
        profiles: await db.creatorBrandProfile.count({
          where: { workspaceId: fixture.workspace.id },
        }),
        revisions: await db.creatorBrandRevision.count({
          where: { profile: { workspaceId: fixture.workspace.id } },
        }),
      });
      const before = await count();
      const acquisitionBefore = {
        provider: providerCalls,
        external: { ...external.count },
      };
      const calls = semanticCalls;
      const first = await suggestions.execute(fixture.actor);
      const after = await count();
      expect(first.reused).toBe(false);
      expect(first.generationIds).toHaveLength(1);
      expect(after).toMatchObject({
        captures: before.captures,
        deEvidence: before.deEvidence,
        executions: before.executions + 1,
        processors: before.processors + 1,
        attempts: before.attempts + 1,
        objects: before.objects + 1,
        components: before.components + 5,
        current: before.current + 5,
        profiles: 0,
        revisions: 0,
      });
      expect(semanticCalls - calls).toBe(1);
      const replay = await suggestions.execute(fixture.actor);
      expect(replay).toEqual({ ...first, reused: true });
      expect(await count()).toEqual(after);
      expect(semanticCalls - calls).toBe(1);
      expect({
        provider: providerCalls,
        external: { ...external.count },
      }).toEqual(acquisitionBefore);
      const consumer = new CreatorBrandSuggestionsConsumer(
        db as never,
        sourceAdapter,
      );
      const view = await consumer.read(fixture.actor);
      expect(view).toMatchObject({
        state: "AVAILABLE",
        freshness: "CURRENT",
        processing: "IDLE",
      });
      const pendingId = randomUUID(),
        pendingRef = `p2-pending:${randomUUID()}`;
      await db.$executeRawUnsafe(
        `INSERT INTO data_extraction_captures (id,capture_ref,brand_id,owner_scope_id,resource_ref,acquisition_request_key,status,started_at,acquisition_quality,provider_integration_id,provider_account_id,authorization_generation)
        SELECT $1,$2,brand_id,owner_scope_id,resource_ref,$2,'RUNNING',CURRENT_TIMESTAMP,acquisition_quality,provider_integration_id,provider_account_id,authorization_generation
        FROM data_extraction_captures WHERE capture_ref=$3`,
        pendingId,
        pendingRef,
        source!.captureRef,
      );
      try {
        expect(await consumer.read(fixture.actor)).toMatchObject({
          objectGenerationId: first.generationIds[0],
          state: "AVAILABLE",
          processing: "PROCESSING",
        });
        await db.dataExtractionCapture.updateMany({
          where: { id: pendingId },
          data: { status: "FAILED" },
        });
        expect(await consumer.read(fixture.actor)).toMatchObject({
          objectGenerationId: first.generationIds[0],
          state: "DEGRADED",
          processing: "FAILED",
        });
      } finally {
        await db.dataExtractionCapture.deleteMany({ where: { id: pendingId } });
      }
      const clock = vi
        .spyOn(Date, "now")
        .mockReturnValue(new Date(source!.windowEnd).getTime() + 49 * 3600_000);
      try {
        expect((await consumer.read(fixture.actor)).freshness).toBe("STALE");
      } finally {
        clock.mockRestore();
      }
      expect(view.objectGenerationId).toBe(first.generationIds[0]);
      expect(view.autoApply).toBe(false);
      const headline = view.families.positioning.candidates.find(
        (candidate) => candidate.field === "headline",
      )!;
      expect(headline).toBeDefined();
      expect(headline.confidence).toBe("MEDIUM");
      expect(headline.supportingPosts).toBe(5);
      const object = await db.intelligenceObjectGeneration.findUniqueOrThrow({
        where: { id: first.generationIds[0] },
        select: { valuePayload: true },
      });
      const persisted = object.valuePayload as unknown as {
        families: Record<
          string,
          Record<
            string,
            {
              availability: string;
              support?: {
                evidenceRefs: string[];
                sourceComponentGenerationIds: string[];
              };
            }
          >
        >;
      };
      for (const family of Object.values(persisted.families))
        for (const field of Object.values(family))
          if (field.availability === "AVAILABLE") {
            expect(
              field.support!.evidenceRefs.every((ref) =>
                source!.evidence.some((item) => item.evidenceRef === ref),
              ),
            ).toBe(true);
            expect(
              field.support!.sourceComponentGenerationIds.every((id) =>
                source!.componentGenerations.some(
                  (item) => item.generationId === id,
                ),
              ),
            ).toBe(true);
          }
      const ownerUser = await db.user.findUniqueOrThrow({
        where: { id: fixture.actor.subjectOwnerUserId },
      });
      const seat = async (role: "OWNER" | "MANAGER" | "ASSISTANT") => {
        const user =
          role === "OWNER"
            ? ownerUser
            : await db.user.create({
                data: {
                  email: `${randomUUID()}@example.test`,
                  role: "CREATOR",
                  authState: "ACTIVE",
                  organizationId: fixture.actor.organizationId,
                },
              });
        await db.creatorWorkspaceMember.create({
          data: {
            workspaceId: fixture.workspace.id,
            userId: user.id,
            assignedProfileId: role === "OWNER" ? fixture.profile.id : null,
            associatedEmail: user.email,
            securityRole: role,
            isActive: true,
          },
        });
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          name: null,
        } as AuthUser;
      };
      const ownerActor = await seat("OWNER"),
        manager = await seat("MANAGER"),
        assistant = await seat("ASSISTANT");
      const service = new CreatorBrandService(
        new CreatorBrandRepository(
          db as never,
          new CreatorWorkspaceActorService(db as never),
          consumer,
        ),
        consumer,
      );
      const manual = {
        intent: "MANUAL",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
        values: {
          ...emptyCreatorBrandProfile(),
          commercialBio: "Manual independent bio",
        },
      };
      await service.mutate(ownerActor, manual);
      const reference = {
        objectGenerationId: first.generationIds[0],
        componentGenerationId: headline.componentGenerationId,
        candidateId: headline.candidateId,
      };
      const use = {
        intent: "USE_SUGGESTION",
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
        suggestionReference: reference,
      };
      const used = await service.mutate(manager, use);
      expect(used.profile!.headline).toBe(headline.value);
      expect(used.profile!.commercialBio).toBe("Manual independent bio");
      expect(used.currentRevision).toBe(2);
      expect(await service.mutate(manager, use)).toEqual(used);
      const usedRevision = await db.creatorBrandRevision.findFirstOrThrow({
        where: { profile: { workspaceId: fixture.workspace.id }, revision: 2 },
      });
      expect(usedRevision).toMatchObject({
        origin: "SUGGESTION_USED",
        suggestionObjectGenerationId: reference.objectGenerationId,
        suggestionComponentGenerationId: reference.componentGenerationId,
        suggestionCandidateId: reference.candidateId,
      });
      await expect(
        service.mutate(assistant, {
          ...use,
          idempotencyKey: randomUUID(),
          expectedRevision: 2,
        }),
      ).rejects.toThrow();
      expect((await service.read(assistant)).currentRevision).toBe(2);
      await expect(
        service.mutate(ownerActor, {
          ...use,
          idempotencyKey: randomUUID(),
          expectedRevision: 2,
          suggestionReference: { ...reference, candidateId: "f".repeat(64) },
        }),
      ).rejects.toThrow();
      await expect(
        service.mutate(ownerActor, {
          intent: "EDIT_SUGGESTION",
          expectedRevision: 2,
          idempotencyKey: randomUUID(),
          suggestionReference: reference,
          values: {
            ...used.profile,
            headline: "Edited tutorial",
            commercialBio: "Unrelated change",
          },
        }),
      ).rejects.toMatchObject({
        response: { code: "CREATOR_BRAND_SUGGESTION_EDIT_UNRELATED_FIELDS" },
      });
      const edited = await service.mutate(ownerActor, {
        intent: "EDIT_SUGGESTION",
        expectedRevision: 2,
        idempotencyKey: randomUUID(),
        suggestionReference: reference,
        values: { ...used.profile, headline: "Creator-authored tutorial" },
      });
      expect(edited.profile!.headline).toBe("Creator-authored tutorial");
      expect(edited.profile!.commercialBio).toBe("Manual independent bio");
      expect(
        await db.creatorBrandRevision.findFirstOrThrow({
          where: {
            profile: { workspaceId: fixture.workspace.id },
            revision: 3,
          },
        }),
      ).toMatchObject({
        origin: "SUGGESTION_EDITED",
        suggestionCandidateId: reference.candidateId,
      });
      const ownerUse = await service.mutate(ownerActor, {
        ...use,
        expectedRevision: 3,
        idempotencyKey: randomUUID(),
      });
      const managerEdit = await service.mutate(manager, {
        intent: "EDIT_SUGGESTION",
        expectedRevision: 4,
        idempotencyKey: randomUUID(),
        suggestionReference: reference,
        values: { ...ownerUse.profile, headline: "Manager-authored tutorial" },
      });
      expect(managerEdit.currentRevision).toBe(5);
      const canonical = managerEdit.profile;
      const originalIntegration =
        await db.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: fixture.integration.id },
        });
      for (const data of [
        { disconnectedAt: new Date() },
        { tokenStateCondition: "EXPIRED" as const },
        { insightsCapability: "UNKNOWN" as const },
        { authorizationGeneration: 2 },
        { nativePlatformUserId: "substituted-account" },
      ]) {
        await db.creatorSocialIntegration.update({
          where: { id: fixture.integration.id },
          data,
        });
        try {
          await expect(suggestions.execute(fixture.actor)).rejects.toThrow();
          await expect(service.mutate(manager, use)).rejects.toThrow();
          const fencedView = await consumer.read(fixture.actor);
          expect(
            Object.values(fencedView.families)
              .flatMap((family) => family.candidates)
              .every((candidate) => !candidate.confirmable),
          ).toBe(true);
          expect((await service.read(ownerActor)).profile).toEqual(canonical);
        } finally {
          await db.creatorSocialIntegration.update({
            where: { id: fixture.integration.id },
            data: {
              disconnectedAt: originalIntegration.disconnectedAt,
              tokenStateCondition: originalIntegration.tokenStateCondition,
              insightsCapability: originalIntegration.insightsCapability,
              authorizationGeneration:
                originalIntegration.authorizationGeneration,
              nativePlatformUserId: originalIntegration.nativePlatformUserId,
            },
          });
        }
      }
      await expect(
        db.$transaction(async (tx) => {
          await tx.dataExtractionEvidenceItem.updateMany({
            where: {
              ownerScopeId: scopeId,
              evidenceRef: source!.evidence[0].evidenceRef,
            },
            data: { contentHash: "0".repeat(64) },
          });
          await expect(
            sourceAdapter.readInTransaction(tx, fixture.actor),
          ).rejects.toThrow();
          throw new Error("P2_ADMISSION_ROLLBACK");
        }),
      ).rejects.toThrow("P2_ADMISSION_ROLLBACK");
      expect((await sourceAdapter.read(fixture.actor))!.manifestHash).toBe(
        source!.manifestHash,
      );
      await pipeline.execute({
        actor: fixture.actor,
        ...integration,
        capturedAt,
        requestIdentity: `p2-new-source:${randomUUID()}`,
      });
      await expect(
        db.$transaction(async (tx) => {
          await tx.intelligenceCurrentComponent.updateMany({
            where: {
              ownerScopeId: scopeId,
              objectSemanticId: "creator_content",
              componentSemanticPath: source!.componentGenerations[0].path,
            },
            data: {
              currentComponentGenerationId:
                source!.componentGenerations[0].generationId,
            },
          });
          await expect(
            sourceAdapter.readInTransaction(tx, fixture.actor),
          ).rejects.toThrow();
          throw new Error("P2_NONCURRENT_SOURCE_ROLLBACK");
        }),
      ).rejects.toThrow("P2_NONCURRENT_SOURCE_ROLLBACK");
      failSuggestions = true;
      try {
        await expect(suggestions.execute(fixture.actor)).rejects.toThrow(
          "CURRENT_PRESERVED",
        );
      } finally {
        failSuggestions = false;
      }
      expect(await consumer.read(fixture.actor)).toMatchObject({
        objectGenerationId: first.generationIds[0],
        state: "DEGRADED",
        processing: "FAILED",
        freshness: "STALE",
      });
      expect((await service.read(ownerActor)).profile).toEqual(canonical);
      await expect(
        service.mutate(ownerActor, {
          ...use,
          idempotencyKey: randomUUID(),
          expectedRevision: 5,
        }),
      ).rejects.toThrow();
      await expect(suggestions.execute(fixture.actor)).rejects.toThrow();
      for (const mode of ["VALIDATION", "PERSISTENCE"] as const) {
        await pipeline.execute({
          actor: fixture.actor,
          ...integration,
          capturedAt,
          requestIdentity: `p2-${mode.toLowerCase()}-failure:${randomUUID()}`,
        });
        const failureBefore = await count();
        p2FailureMode = mode;
        try {
          await expect(suggestions.execute(fixture.actor)).rejects.toThrow(
            "CURRENT_PRESERVED",
          );
        } finally {
          p2FailureMode = "NONE";
        }
        const failureAfter = await count();
        expect(failureAfter).toEqual({
          ...failureBefore,
          executions: failureBefore.executions + 1,
          processors: failureBefore.processors + 1,
          attempts: failureBefore.attempts + 1,
        });
        expect((await consumer.read(fixture.actor)).objectGenerationId).toBe(
          first.generationIds[0],
        );
        expect((await service.read(ownerActor)).profile).toEqual(canonical);
      }
      // Failed exact execution is terminal and cannot be replayed as success; a new basis is required.
      await pipeline.execute({
        actor: fixture.actor,
        ...integration,
        capturedAt,
        requestIdentity: `p2-recovered-source:${randomUUID()}`,
      });
      omitLanguageSuggestion = true;
      let second;
      try {
        second = await suggestions.execute(fixture.actor);
        expect((await consumer.read(fixture.actor)).state).toBe("PARTIAL");
        expect(
          (await consumer.read(fixture.actor)).families.languages.candidates,
        ).toHaveLength(0);
      } finally {
        omitLanguageSuggestion = false;
      }
      expect(second.generationIds[0]).not.toBe(first.generationIds[0]);
      expect((await service.read(ownerActor)).profile).toEqual(canonical);
      contentPostCount = 9;
      availableMediaCount = 3;
      const priorCalls = semanticCalls;
      try {
        await pipeline.execute({
          actor: fixture.actor,
          ...integration,
          capturedAt,
          requestIdentity: `p2-insufficient-source:${randomUUID()}`,
        });
        const insufficient = await suggestions.execute(fixture.actor);
        expect(insufficient.generationIds[0]).not.toBe(second.generationIds[0]);
        expect(
          Object.values((await consumer.read(fixture.actor)).families).flatMap(
            (family) => family.candidates,
          ),
        ).toHaveLength(0);
        expect(semanticCalls).toBe(priorCalls);
        expect((await service.read(ownerActor)).profile).toEqual(canonical);
      } finally {
        contentPostCount = 8;
        availableMediaCount = Number.POSITIVE_INFINITY;
      }
      const other = await owner();
      await pipeline.execute({
        actor: other.actor,
        integrationId: other.integration.id,
        providerAccountId: other.providerAccountId,
        authorizationGeneration: 1,
        capturedAt,
        requestIdentity: `p2-other-source:${randomUUID()}`,
      });
      const otherSuggestions = await suggestions.execute(other.actor);
      const otherSource = await sourceAdapter.read(other.actor);
      await expect(
        service.mutate(ownerActor, {
          ...use,
          idempotencyKey: randomUUID(),
          expectedRevision: 5,
          suggestionReference: {
            ...reference,
            objectGenerationId: otherSuggestions.generationIds[0],
          },
        }),
      ).rejects.toThrow();
      await expect(
        sourceAdapter.read({
          ...fixture.actor,
          workspaceId: other.workspace.id,
        }),
      ).rejects.toThrow("SUBJECT_MISMATCH");
      await db.creatorSocialIntegration.update({
        where: { id: fixture.integration.id },
        data: { authorizationGeneration: 2 },
      });
      await expect(sourceAdapter.read(fixture.actor)).rejects.toThrow(
        "CONTENT_IDENTITY_MISMATCH",
      );
      expect(
        (await consumer.read(fixture.actor)).objectGenerationId,
      ).toBeNull();
      expect((await service.read(ownerActor)).profile).toEqual(canonical);
      await db.creatorSocialIntegration.update({
        where: { id: fixture.integration.id },
        data: { authorizationGeneration: 1 },
      });
      const otherBefore = await db.creatorSocialIntegration.findUniqueOrThrow({
        where: { id: other.integration.id },
      });
      await scopes.purgeCreatorInstagram(scopeId);
      expect(
        await db.intelligenceObjectGeneration.count({
          where: {
            ownerScopeId: scopeId,
            objectSemanticId: "creator_brand_suggestions",
          },
        }),
      ).toBe(0);
      expect(
        await db.intelligenceProcessorExecution.count({
          where: {
            ownerScopeId: scopeId,
            processorId: "creator_brand_suggestions_v0",
          },
        }),
      ).toBe(0);
      expect((await service.read(ownerActor)).profile).toEqual(canonical);
      expect(
        await db.creatorBrandRevision.count({
          where: { profile: { workspaceId: fixture.workspace.id } },
        }),
      ).toBe(5);
      expect(
        await db.intelligenceCurrentComponent.count({
          where: { ownerScopeId: otherSource!.ownerScopeId },
        }),
      ).toBe(13);
      expect(
        await db.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: other.integration.id },
        }),
      ).toEqual(otherBefore);
      expect((await consumer.read(fixture.actor)).state).toBe("UNAVAILABLE");
      console.info("P2_SANITIZED_ROW_COUNTS", {
        before,
        after,
        replay: after,
        final: await count(),
      });
    }, 120_000);

    it.each([
      [6, 3, "LOW"],
      [10, 7, "MEDIUM"],
    ] as const)(
      "P2 accepted current with %i posts/%i observed proves inclusive %s boundary",
      async (total, observed, confidence) => {
        const fixture = await owner();
        contentPostCount = total;
        availableMediaCount = observed;
        try {
          const input = {
            actor: fixture.actor,
            integrationId: fixture.integration.id,
            providerAccountId: fixture.providerAccountId,
            authorizationGeneration: 1,
            capturedAt,
            requestIdentity: `p2-boundary:${randomUUID()}`,
          };
          await pipeline.execute(input);
          const source = await sourceAdapter.read(fixture.actor);
          expect(source!.semanticCoverage).toBe(observed / total);
          await suggestions.execute(fixture.actor);
          const view = await new CreatorBrandSuggestionsConsumer(
            db as never,
            sourceAdapter,
          ).read(fixture.actor);
          expect(
            view.families.positioning.candidates.find(
              (candidate) => candidate.field === "headline",
            )!.confidence,
          ).toBe(confidence);
        } finally {
          contentPostCount = 8;
          availableMediaCount = Number.POSITIVE_INFINITY;
        }
      },
      60_000,
    );

    it("runs provider DI through Capture/Evidence and eight-path shared current, then exact-replays with stable rows", async () => {
      const fixture = await owner();
      const input = {
        actor: fixture.actor,
        integrationId: fixture.integration.id,
        providerAccountId: fixture.providerAccountId,
        authorizationGeneration: 1,
        capturedAt,
        requestIdentity: `creator-content:${randomUUID()}`,
      };
      const before = providerCalls;
      const externalBefore = { ...external.count };
      const first = await pipeline.execute(input);
      const firstCalls = providerCalls;
      const externalAfterFirst = { ...external.count };
      const scope = await db.intelligenceOwnerScope.findUniqueOrThrow({
        where: {
          ownerKey: `CREATOR:${fixture.profile.id}:${fixture.workspace.id}`,
        },
      });
      const counts = async () =>
        db.$queryRawUnsafe<Array<Record<string, bigint>>>(
          `SELECT (SELECT count(*) FROM data_extraction_captures WHERE owner_scope_id=$1 AND status='COMPLETED') captures, (SELECT count(*) FROM data_extraction_evidence_items WHERE owner_scope_id=$1) evidence, (SELECT count(*) FROM intelligence_object_generations WHERE owner_scope_id=$1 AND object_semantic_id='creator_content') objects, (SELECT count(*) FROM intelligence_component_generations WHERE owner_scope_id=$1 AND object_semantic_id='creator_content') components, (SELECT count(*) FROM intelligence_current_components WHERE owner_scope_id=$1 AND object_semantic_id='creator_content') current`,
          scope.id,
        );
      const afterFirst = (await counts())[0];
      const second = await pipeline.execute(input);
      const afterReplay = (await counts())[0];
      expect(first.reused).toBe(false);
      expect(first.generationIds).toHaveLength(1);
      expect(second.reused).toBe(true);
      expect(providerCalls).toBe(firstCalls);
      expect(external.count).toEqual(externalAfterFirst);
      expect(firstCalls - before).toBe(10);
      expect(afterFirst).toEqual({
        captures: 1n,
        evidence: 16n,
        objects: 1n,
        components: 8n,
        current: 8n,
      });
      expect(afterReplay).toEqual(afterFirst);
      const derived = await db.$queryRawUnsafe<
        Array<{ payload: unknown; parents: string[]; method: string }>
      >(
        `SELECT bounded_payload payload, parent_evidence_refs parents, capture_method_class::text method FROM data_extraction_evidence_items WHERE owner_scope_id=$1 AND capture_method_class='MODEL_DERIVATION'`,
        scope.id,
      );
      expect(derived).toHaveLength(8);
      expect(
        derived.every(
          (row) =>
            row.parents.length === 1 && row.method === "MODEL_DERIVATION",
        ),
      ).toBe(true);
      expect(
        await db.dataExtractionSemanticObservation.count({
          where: { ownerScopeId: scope.id },
        }),
      ).toBe(8);
      expect(
        await db.dataExtractionObservationSupport.count({
          where: { ownerScopeId: scope.id },
        }),
      ).toBe(8);
      expect(
        first.value.snapshot.media.some(
          (media) => media.providerMediaId === "media-7",
        ),
      ).toBe(true);
      expect(
        Object.fromEntries(
          Object.entries(externalAfterFirst).map(([key, value]) => [
            key,
            value - externalBefore[key as keyof typeof externalBefore],
          ]),
        ),
      ).toMatchObject({
        videoLocator: 1,
        probe: 1,
        extract: 1,
        frameModel: 6,
        audio: 1,
        speech: 1,
      });
      expect(
        await external.imageStore.purgeScope(`creator:${fixture.profile.id}`),
      ).toBe(0);
      expect(
        await external.videoStore.purgeScope(`creator:${fixture.profile.id}`),
      ).toBe(0);
      expect(first.value.performance.claims.length).toBeGreaterThan(0);
      expect(first.value.representatives.length).toBeLessThanOrEqual(6);
    }, 30_000);

    it("preserves another owner and prior current across failure, then target-only purge removes Content lineage", async () => {
      const left = await owner(),
        right = await owner();
      const request = (
        fixture: Awaited<ReturnType<typeof owner>>,
        id: string,
      ) => ({
        actor: fixture.actor,
        integrationId: fixture.integration.id,
        providerAccountId: fixture.providerAccountId,
        authorizationGeneration: 1,
        capturedAt,
        requestIdentity: id,
      });
      await pipeline.execute(request(left, `left:${randomUUID()}`));
      await pipeline.execute(request(right, `right:${randomUUID()}`));
      const leftScope = await scopes.resolve({
        kind: "CREATOR",
        creatorProfileId: left.profile.id,
        creatorWorkspaceId: left.workspace.id,
      });
      const rightScope = await scopes.resolve({
        kind: "CREATOR",
        creatorProfileId: right.profile.id,
        creatorWorkspaceId: right.workspace.id,
      });
      failProvider = true;
      await expect(
        pipeline.execute(request(left, `changed:${randomUUID()}`)),
      ).rejects.toThrow("FIXTURE_PROVIDER_FAILURE");
      failProvider = false;
      expect(
        await db.intelligenceCurrentComponent.count({
          where: {
            ownerScopeId: leftScope.id,
            objectSemanticId: "creator_content",
          },
        }),
      ).toBe(8);
      expect(await scopes.purgeCreatorInstagram(leftScope.id)).toBeGreaterThan(
        0,
      );
      expect(
        await db.intelligenceCurrentComponent.count({
          where: {
            ownerScopeId: leftScope.id,
            objectSemanticId: "creator_content",
          },
        }),
      ).toBe(0);
      expect(
        await db.intelligenceCurrentComponent.count({
          where: {
            ownerScopeId: rightScope.id,
            objectSemanticId: "creator_content",
          },
        }),
      ).toBe(8);
    }, 30_000);

    it("preserves exact partial modality coverage on replay and valid current after changed-model failure", async () => {
      const fixture = await owner();
      const input = {
        actor: fixture.actor,
        integrationId: fixture.integration.id,
        providerAccountId: fixture.providerAccountId,
        authorizationGeneration: 1,
        capturedAt,
        requestIdentity: `partial:${randomUUID()}`,
      };
      external.setOcrUnavailable(true);
      const first = await pipeline.execute(input);
      const scope = await scopes.resolve({
        kind: "CREATOR",
        creatorProfileId: fixture.profile.id,
        creatorWorkspaceId: fixture.workspace.id,
      });
      const before = { ...external.count };
      const beforeProvider = providerCalls;
      const refsBefore = await db.$queryRawUnsafe<
        Array<{ ref: string; payload: unknown }>
      >(
        `SELECT evidence_ref ref, bounded_payload payload FROM data_extraction_evidence_items WHERE owner_scope_id=$1 ORDER BY evidence_ref`,
        scope.id,
      );
      const replay = await pipeline.execute(input);
      expect(replay.reused).toBe(true);
      expect(replay.value).toEqual(first.value);
      expect(replay.value.snapshot.coverage).toBe(0);
      expect(
        replay.value.snapshot.media.every(
          (media) => media.semanticState === "PARTIAL",
        ),
      ).toBe(true);
      expect(external.count).toEqual(before);
      expect(providerCalls).toBe(beforeProvider);
      expect(
        await db.$queryRawUnsafe(
          `SELECT evidence_ref ref, bounded_payload payload FROM data_extraction_evidence_items WHERE owner_scope_id=$1 ORDER BY evidence_ref`,
          scope.id,
        ),
      ).toEqual(refsBefore);
      external.setOcrUnavailable(false);
      external.setGroundedUnavailable(true);
      Object.assign(external.grounded, { modelProfileVersion: "changed-v2" });
      const failed = await pipeline.execute(input);
      expect(failed.reused).toBe(false);
      expect(failed.value.currentPreserved).toBe(true);
      expect(failed.value.processingState).toBe("FAILED");
      expect(
        await db.intelligenceObjectGeneration.count({
          where: { ownerScopeId: scope.id },
        }),
      ).toBe(1);
      expect(
        await db.dataExtractionEvidenceItem.count({
          where: { ownerScopeId: scope.id },
        }),
      ).toBe(16);
      external.setGroundedUnavailable(false);
      Object.assign(external.grounded, { modelProfileVersion: "v1" });
      for (const changed of [
        { providerAccountId: "other-account" },
        { authorizationGeneration: 2 },
        { actor: { ...fixture.actor, subjectCreatorProfileId: randomUUID() } },
      ])
        await expect(
          pipeline.execute({ ...input, ...changed }),
        ).rejects.toThrow("FENCE");
      expect(
        await db.dataExtractionEvidenceItem.count({
          where: { ownerScopeId: scope.id },
        }),
      ).toBe(16);
      const websiteRef = `website:${randomUUID()}`;
      await db.$executeRawUnsafe(
        `INSERT INTO data_extraction_resources (id, resource_ref, owner_scope_id, brand_id, source_class, resource_type, canonical_resource_key, canonical_resource_key_hash, canonical_url) VALUES ($1,$2,$3,NULL,'OWNED_WEBSITE','OWNED_WEB_PAGE',$2,$4,'https://example.test/')`,
        randomUUID(),
        websiteRef,
        scope.id,
        "d".repeat(64),
      );
      const survivor = await owner();
      const targetTemporary = await external.imageStore.create(
        `creator:${fixture.profile.id}`,
      );
      await targetTemporary.handle.close();
      const targetVideoTemporary = await external.videoStore.createVideo(
        `creator:${fixture.profile.id}`,
      );
      await targetVideoTemporary.handle.close();
      const survivorTemporary = await external.imageStore.create(
        `creator:${survivor.profile.id}`,
      );
      await survivorTemporary.handle.close();
      expect(await scopes.purgeCreatorInstagram(scope.id)).toBeGreaterThan(0);
      expect(
        await external.imageStore.purgeScope(`creator:${fixture.profile.id}`),
      ).toBe(0);
      expect(
        await external.videoStore.purgeScope(`creator:${fixture.profile.id}`),
      ).toBe(0);
      expect(
        await external.imageStore.purgeScope(`creator:${survivor.profile.id}`),
      ).toBe(1);
      expect(
        await db.dataExtractionSemanticObservation.count({
          where: { ownerScopeId: scope.id },
        }),
      ).toBe(0);
      expect(
        await db.dataExtractionObservationSupport.count({
          where: { ownerScopeId: scope.id },
        }),
      ).toBe(0);
      expect(
        await db.dataExtractionResource.count({
          where: { resourceRef: websiteRef },
        }),
      ).toBe(1);
    }, 30_000);

    it("uses the existing hourly coordinator with immediate first run and daily Content cadence", async () => {
      const fixture = await owner();
      const coordinator = new InstagramSyncCoordinatorRepository(db as never);
      await coordinator.scheduleCreatorContent({
        creatorProfileId: fixture.profile.id,
        creatorWorkspaceId: fixture.workspace.id,
        integrationId: fixture.integration.id,
        providerAccountId: fixture.providerAccountId,
        authorizationGeneration: 1,
        trigger: "INITIAL_CONNECT",
      });
      // Existing coordinator eligibility is still checked against database time.
      // Observe the due gate briefly to tolerate local host/container clock skew; never alter it.
      let lease = await coordinator.claimNextCreator("content-test-worker");
      for (let retry = 0; !lease && retry < 10; retry++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        lease = await coordinator.claimNextCreator("content-test-worker");
      }
      expect(lease?.capabilityClass).toBe("PROFILE_MEDIA_PERFORMANCE");
      expect(lease?.actor.allowedActions).toContain("INSIGHTS_CONTENT_READ");
      await coordinator.complete(lease!, []);
      const jobs = await db.$queryRawUnsafe<
        Array<{ status: string; nextDueAt: Date; lastSuccessAt: Date }>
      >(
        `SELECT status::text, next_due_at AS "nextDueAt", last_success_at AS "lastSuccessAt" FROM instagram_intelligence_sync_jobs WHERE sync_job_id=$1::uuid`,
        lease!.jobId,
      );
      const job = jobs[0];
      const cadence = job.nextDueAt.getTime() - job.lastSuccessAt.getTime();
      expect(job.status).toBe("PENDING");
      expect(cadence).toBeGreaterThanOrEqual(86_400_000);
      expect(cadence).toBeLessThanOrEqual(86_400_000 + 30 * 60_000);
    }, 30_000);
  },
);
