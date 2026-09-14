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

const enabled = process.env.CREATOR_CONTENT_DATABASE_TEST === "true";
describe.skipIf(!enabled)(
  "Creator Content V0 PostgreSQL vertical slice",
  () => {
    const db = new PrismaClient();
    let pipeline: CreatorContentPipelineService;
    let scopes: IntelligenceOwnerScopeRepository;
    let providerCalls = 0;
    let failProvider = false;
    const capturedAt = new Date("2026-09-15T12:00:00.000Z");
    const provider: InstagramIntelligenceProviderReadClient = {
      readProfile: async () => {
        throw new Error("UNEXPECTED_METHOD");
      },
      readAudienceInsights: async () => {
        throw new Error("UNEXPECTED_METHOD");
      },
      readCarouselChildren: async () => {
        throw new Error("UNEXPECTED_METHOD");
      },
      readMediaInventory: async () => {
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
              capturedAt.getTime() - index * 86_400_000,
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
      scopes = new IntelligenceOwnerScopeRepository(prisma);
      const semanticFixture = {
        analyze: async ({ media }: { media: { providerMediaId: string } }) => ({
          providerMediaId: media.providerMediaId,
          state: "AVAILABLE" as const,
          themes: [
            Number(media.providerMediaId.slice(-1)) < 4 ? "Tutorial" : "Story",
          ],
          captionPatterns: ["Direct"],
          creativeStructures: ["Demonstration"],
          visualExecution: ["Close framing"],
        }),
      };
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
    afterAll(async () => db.$disconnect());

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
      expect(firstCalls - before).toBe(9);
      expect(afterFirst).toEqual({
        captures: 1n,
        evidence: 8n,
        objects: 1n,
        components: 8n,
        current: 8n,
      });
      expect(afterReplay).toEqual(afterFirst);
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
