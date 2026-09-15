import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

const enabled = process.env.CREATOR_CONTENT_DATABASE_TEST === "true";
describe.skipIf(!enabled)(
  "Creator Content V0 PostgreSQL vertical slice",
  () => {
    const db = new PrismaClient();
    let pipeline: CreatorContentPipelineService;
    let scopes: IntelligenceOwnerScopeRepository;
    let providerCalls = 0;
    let failProvider = false;
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
        const items = Array.from({ length: 8 }, (_, index) => ({
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
        url.pathname !== "/creator_content_p2"
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
      const worker = new ProcessorWorkerService(
        processorRepository,
        new ProcessorFinalizationService(
          prisma,
          processorRepository,
          aggregation,
          retry,
        ),
        executors,
        persistence,
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
        semanticFixture,
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
      expect(externalAfterFirst).toMatchObject({
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
      const lease = await coordinator.claimNextCreator("content-test-worker");
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
