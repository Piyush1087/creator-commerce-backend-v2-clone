import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { encryptField } from "../../shared/crypto/field-encryption.util";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import { type InstagramIntelligenceProviderReadClient } from "../instagram/instagram-intelligence-provider.types";
import { InstagramSyncCoordinatorRepository } from "../instagram-intelligence/sync/instagram-sync-coordinator.repository";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
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
import { ExecutionContractGate } from "../brand-intelligence/execution/registry/execution-contract.gate";
import { RetryBackoffPolicy } from "../brand-intelligence/execution/policy/retry-backoff.policy";
import { ProcessorExecutionRepository } from "../brand-intelligence/execution/processor-execution.repository";
import { ProcessorFinalizationService } from "../brand-intelligence/execution/processor-finalization.service";
import { ProcessorWorkerService } from "../brand-intelligence/execution/processor-worker.service";
import { IntelligenceActionRepository } from "../brand-intelligence/persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "../brand-intelligence/persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "../brand-intelligence/persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "../brand-intelligence/persistence/intelligence-generation.repository";
import { ComponentPathCodec } from "../brand-intelligence/semantic-path/component-path.codec";
import { IntelligenceTransitionService } from "../brand-intelligence/transitions/intelligence-transition.service";
import { CreatorAudienceCredentialFenceService } from "./creator-audience-credential-fence.service";
import { CreatorAudiencePersistenceHook } from "./creator-audience-persistence.hook";
import { CreatorAudiencePipelineService } from "./creator-audience-pipeline.service";
import { CreatorAudienceProcessorExecutor } from "./creator-audience-processor.executor";
import { CreatorAudienceRepository } from "./creator-audience.repository";

const enabled = process.env.CREATOR_AUDIENCE_P2_DATABASE_TEST === "true";

describe.skipIf(!enabled)(
  "Creator Audience shared verified runtime (PostgreSQL)",
  () => {
    const db = new PrismaClient();
    let pipeline: CreatorAudiencePipelineService;
    let scopes: IntelligenceOwnerScopeRepository;
    let afterProvider: (() => Promise<void>) | null = null;
    let providerCalls = 0;
    const provider: InstagramIntelligenceProviderReadClient = {
      readProfile: async () => ({
        availability: "AVAILABLE",
        providerAccountId: "fixture-account",
        appScopedUserId: { state: "OBSERVED", value: "fixture-account" },
        username: { state: "OBSERVED", value: "creator" },
        name: { state: "OBSERVED", value: "Creator" },
        accountType: { state: "OBSERVED", value: "CREATOR" },
        followersCount: { state: "OBSERVED", value: 1000 },
        followsCount: { state: "OBSERVED", value: 5 },
        mediaCount: { state: "OBSERVED", value: 10 },
      }),
      readAudienceInsights: async (_, population, breakdown) => {
        providerCalls += 1;
        if (providerCalls % 8 === 0 && afterProvider) {
          const action = afterProvider;
          afterProvider = null;
          await action();
        }
        return {
          availability: "AVAILABLE",
          population,
          breakdown,
          timeframe: "THIS_MONTH",
          values: [
            { dimension: "A", value: 60 },
            { dimension: "B", value: 40 },
          ],
          denominator: 100,
          limitation: null,
        };
      },
      readMediaInventory: async () => {
        throw new Error("UNEXPECTED_PROVIDER_METHOD");
      },
      readMediaInsights: async () => {
        throw new Error("UNEXPECTED_PROVIDER_METHOD");
      },
      readCarouselChildren: async () => {
        throw new Error("UNEXPECTED_PROVIDER_METHOD");
      },
    };

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        url.hostname !== "localhost" ||
        url.pathname !== "/creator_audience_final_correction1"
      ) {
        throw new Error("CREATOR_AUDIENCE_FINAL_CORRECTION_DATABASE_REQUIRED");
      }
      await db.$connect();
      const prisma = db as never;
      const codec = new ComponentPathCodec();
      const semantic = new SemanticValidator();
      const contracts = new ContractRuntimeRegistry(
        new ContractBundleIntegrityVerifier(),
        semantic,
      );
      contracts.onModuleInit();
      const creatorExecutor = new CreatorAudienceProcessorExecutor();
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
        creatorExecutor,
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
      const creatorPersistence = new CreatorAudiencePersistenceHook(
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
        creatorPersistence,
      );
      scopes = new IntelligenceOwnerScopeRepository(prisma);
      pipeline = new CreatorAudiencePipelineService(
        new CreatorAudienceCredentialFenceService(prisma),
        new CreatorAudienceRepository(prisma, scopes),
        new IntelligenceExecutionService(
          prisma,
          new ExecutionContractGate(contracts, executors),
          ownership,
          codec,
        ),
        worker,
        provider,
      );
    });

    afterAll(async () => {
      await db.$disconnect();
    });

    async function owner() {
      const suffix = randomUUID();
      const organization = await db.organization.create({
        data: { kind: "CREATOR", name: `Final correction ${suffix}` },
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
        allowedActions: ["INSIGHTS_AUDIENCE_READ"],
      };
      return { profile, workspace, integration, actor, providerAccountId };
    }

    async function counts(profileId: string, workspaceId: string) {
      const scope = await db.intelligenceOwnerScope.findUniqueOrThrow({
        where: { ownerKey: `CREATOR:${profileId}:${workspaceId}` },
      });
      const rows = await db.$queryRawUnsafe<Array<Record<string, bigint>>>(
        `SELECT
          (SELECT count(*) FROM data_extraction_resources WHERE owner_scope_id=$1) resources,
          (SELECT count(*) FROM data_extraction_captures WHERE owner_scope_id=$1 AND status='COMPLETED') captures,
          (SELECT count(*) FROM data_extraction_evidence_items WHERE owner_scope_id=$1) evidence,
          (SELECT count(*) FROM intelligence_executions WHERE owner_scope_id=$1) executions,
          (SELECT count(*) FROM intelligence_processor_executions WHERE owner_scope_id=$1) processors,
          (SELECT count(*) FROM intelligence_processor_attempts WHERE owner_scope_id=$1) attempts,
          (SELECT count(*) FROM intelligence_object_generations WHERE owner_scope_id=$1) objects,
          (SELECT count(*) FROM intelligence_component_generations WHERE owner_scope_id=$1) components,
          (SELECT count(*) FROM intelligence_actions WHERE owner_scope_id=$1) actions,
          (SELECT count(*) FROM intelligence_component_transitions WHERE owner_scope_id=$1) transitions,
          (SELECT count(*) FROM intelligence_current_components WHERE owner_scope_id=$1) current`,
        scope.id,
      );
      return { scope, counts: rows[0] };
    }

    it("persists provider fixture through DE, shared execution/attempt, verified generation, transition and current with exact replay", async () => {
      const fixture = await owner();
      const input = {
        actor: fixture.actor,
        integrationId: fixture.integration.id,
        providerAccountId: fixture.providerAccountId,
        authorizationGeneration: 1,
        capturedAt: new Date("2026-09-14T10:00:00.000Z"),
        requestIdentity: `creator-audience:final:${randomUUID()}`,
      };
      const beforeCalls = providerCalls;
      const first = await pipeline.execute(input);
      const afterFirst = await counts(fixture.profile.id, fixture.workspace.id);
      expect(first.reused).toBe(false);
      expect(first.generationIds).toHaveLength(1);
      expect(afterFirst.counts).toEqual({
        resources: 1n,
        captures: 1n,
        evidence: 8n,
        executions: 1n,
        processors: 1n,
        attempts: 1n,
        objects: 1n,
        components: 6n,
        actions: 1n,
        transitions: 6n,
        current: 6n,
      });
      const second = await pipeline.execute(input);
      expect(second.reused).toBe(true);
      expect(providerCalls - beforeCalls).toBe(8);
      expect(
        (await counts(fixture.profile.id, fixture.workspace.id)).counts,
      ).toEqual(afterFirst.counts);
      const lineage = await db.$queryRawUnsafe<
        Array<{
          outcome: string;
          ownerType: string;
          processorStatus: string;
          attemptStatus: string;
        }>
      >(
        `SELECT t.outcome::text outcome, s.owner_type::text "ownerType",
          p.status::text "processorStatus", a.status::text "attemptStatus"
         FROM intelligence_component_transitions t
         JOIN intelligence_owner_scopes s ON s.owner_scope_id=t.owner_scope_id
         JOIN intelligence_processor_executions p ON p.owner_scope_id=t.owner_scope_id
         JOIN intelligence_processor_attempts a ON a.processor_execution_id=p.processor_execution_id
         WHERE t.owner_scope_id=$1`,
        afterFirst.scope.id,
      );
      expect(lineage).toHaveLength(6);
      expect(
        lineage.every(
          (row) =>
            row.outcome === "APPLIED_CURRENT" &&
            row.ownerType === "CREATOR" &&
            row.processorStatus === "COMPLETED" &&
            row.attemptStatus === "SUCCEEDED",
        ),
      ).toBe(true);
      const integrity = await db.$queryRawUnsafe<
        Array<{
          bundleHash: string;
          valueHash: string;
          revisions: bigint[];
          evidenceRefs: string[];
        }>
      >(
        `SELECT o.bundle_hash "bundleHash", o.value_hash "valueHash",
          array_agg(DISTINCT c.revision ORDER BY c.revision) revisions,
          array_agg(DISTINCT e.evidence_ref ORDER BY e.evidence_ref) "evidenceRefs"
         FROM intelligence_object_generations o
         JOIN intelligence_current_components c ON c.owner_scope_id=o.owner_scope_id
         JOIN intelligence_evidence_references e ON e.object_generation_id=o.object_generation_id
         WHERE o.owner_scope_id=$1
         GROUP BY o.bundle_hash,o.value_hash`,
        afterFirst.scope.id,
      );
      expect(integrity).toHaveLength(1);
      expect(integrity[0].bundleHash).toBe(
        "09afa9bb9370747938d79ea4fba197070359e13c9fa19fca3cfbfa75bb34ee27",
      );
      expect(integrity[0].valueHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(integrity[0].revisions).toEqual([1n]);
      expect(integrity[0].evidenceRefs).toHaveLength(8);
    }, 15_000);

    it.each([
      [
        "generation increment",
        async (id: string) =>
          db.creatorSocialIntegration.update({
            where: { id },
            data: { authorizationGeneration: { increment: 1 } },
          }),
      ],
      [
        "disconnect",
        async (id: string) =>
          db.creatorSocialIntegration.update({
            where: { id },
            data: {
              disconnectedAt: new Date(),
              authorizationHealth: "DISCONNECTED",
            },
          }),
      ],
      [
        "account substitution",
        async (id: string) =>
          db.creatorSocialIntegration.update({
            where: { id },
            data: { nativePlatformUserId: `other-${randomUUID()}` },
          }),
      ],
      [
        "capability invalidation",
        async (id: string) =>
          db.creatorSocialIntegration.update({
            where: { id },
            data: { insightsCapability: "UNAVAILABLE" },
          }),
      ],
    ] as const)(
      "rejects mid-flight %s before completed Capture/Evidence/current",
      async (_, mutate) => {
        const fixture = await owner();
        await pipeline.execute({
          actor: fixture.actor,
          integrationId: fixture.integration.id,
          providerAccountId: fixture.providerAccountId,
          authorizationGeneration: 1,
          capturedAt: new Date(),
          requestIdentity: `creator-audience:baseline:${randomUUID()}`,
        });
        const baseline = await counts(fixture.profile.id, fixture.workspace.id);
        afterProvider = () =>
          mutate(fixture.integration.id).then(() => undefined);
        await expect(
          pipeline.execute({
            actor: fixture.actor,
            integrationId: fixture.integration.id,
            providerAccountId: fixture.providerAccountId,
            authorizationGeneration: 1,
            capturedAt: new Date(),
            requestIdentity: `creator-audience:fence:${randomUUID()}`,
          }),
        ).rejects.toThrow("CREATOR_AUDIENCE_PERSISTENCE_FENCE_REJECTED");
        const state = await counts(fixture.profile.id, fixture.workspace.id);
        expect(state.counts.captures).toBe(baseline.counts.captures);
        expect(state.counts.evidence).toBe(baseline.counts.evidence);
        expect(state.counts.objects).toBe(baseline.counts.objects);
        expect(state.counts.current).toBe(baseline.counts.current);
      },
    );

    it("keeps the one shared coordinator and source-scoped purge semantics", async () => {
      const fixture = await owner();
      const coordinator = new InstagramSyncCoordinatorRepository(db as never);
      await coordinator.scheduleCreatorAudience({
        creatorProfileId: fixture.profile.id,
        creatorWorkspaceId: fixture.workspace.id,
        integrationId: fixture.integration.id,
        providerAccountId: fixture.providerAccountId,
        authorizationGeneration: 1,
        trigger: "INITIAL_CONNECT",
      });
      const lease = await coordinator.claimNextCreator("final-correction-test");
      expect(lease?.integrationId).toBe(fixture.integration.id);
      await coordinator.complete(lease!, []);
      const websiteRef = `creator-website:${randomUUID()}`;
      const scope = await db.intelligenceOwnerScope.findUniqueOrThrow({
        where: {
          ownerKey: `CREATOR:${fixture.profile.id}:${fixture.workspace.id}`,
        },
      });
      await db.$executeRawUnsafe(
        `INSERT INTO data_extraction_resources
          (id, resource_ref, owner_scope_id, brand_id, source_class,
           resource_type, canonical_resource_key, canonical_resource_key_hash,
           canonical_url)
         VALUES ($1,$2,$3,NULL,'OWNED_WEBSITE','OWNED_WEB_PAGE',$2,$4,$5)`,
        randomUUID(),
        websiteRef,
        scope.id,
        "f".repeat(64),
        "https://creator.example.test/about",
      );
      expect(await scopes.purgeCreatorInstagram(scope.id)).toBeGreaterThan(0);
      expect(
        await db.dataExtractionResource.count({
          where: { resourceRef: websiteRef },
        }),
      ).toBe(1);
      expect(
        await db.intelligenceOwnerScope.count({ where: { id: scope.id } }),
      ).toBe(1);
    });
  },
);
