import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { ContractBundleIntegrityVerifier } from "../../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { BundlePathOwnershipRegistry } from "../../brand-intelligence/contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../../brand-intelligence/contracts/registry/contract-runtime.registry";
import { PersistenceTransitionValidator } from "../../brand-intelligence/contracts/validation/persistence-transition.validator";
import { SemanticValidator } from "../../brand-intelligence/contracts/validation/semantic.validator";
import { StructuralValidator } from "../../brand-intelligence/contracts/validation/structural.validator";
import { ExecutionAggregationService } from "../../brand-intelligence/execution/execution-aggregation.service";
import { ProcessorExecutorRegistry } from "../../brand-intelligence/execution/executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "../../brand-intelligence/execution/executor/synthetic-processor.executor";
import { IntelligenceExecutionService } from "../../brand-intelligence/execution/intelligence-execution.service";
import { RetryBackoffPolicy } from "../../brand-intelligence/execution/policy/retry-backoff.policy";
import { ProcessorExecutionRepository } from "../../brand-intelligence/execution/processor-execution.repository";
import { ProcessorFinalizationService } from "../../brand-intelligence/execution/processor-finalization.service";
import { ProcessorPersistenceRouter } from "../../brand-intelligence/execution/processor-persistence.router";
import { ProcessorWorkerService } from "../../brand-intelligence/execution/processor-worker.service";
import { ExecutionContractGate } from "../../brand-intelligence/execution/registry/execution-contract.gate";
import { IntelligenceActionRepository } from "../../brand-intelligence/persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "../../brand-intelligence/persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "../../brand-intelligence/persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "../../brand-intelligence/persistence/intelligence-generation.repository";
import { IntelligenceCurrentContractScopeService } from "../../brand-intelligence/projection/intelligence-current-contract-scope.service";
import { IntelligenceCurrentProjectionRepository } from "../../brand-intelligence/projection/intelligence-current-projection.repository";
import { IntelligenceCurrentProjectionService } from "../../brand-intelligence/projection/intelligence-current-projection.service";
import { IntelligenceObjectAssembler } from "../../brand-intelligence/projection/intelligence-object-assembler";
import { ComponentPathCodec } from "../../brand-intelligence/semantic-path/component-path.codec";
import { IntelligenceTransitionService } from "../../brand-intelligence/transitions/intelligence-transition.service";
import { InstagramDerivedDataPurgeService } from "../../data-extraction/evidence/instagram/instagram-derived-data-purge.service";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import { hashPasswordAsync } from "../../../shared/crypto/password.util";
import { InstagramIntelligenceConnectionReadService } from "../../brand-settings/services/instagram-intelligence-provider-read.service";
import { InstagramB4ConsumerService } from "../consumer/instagram-b4-consumer.service";
import { InstagramIntelligenceObjectSchema } from "../contracts/instagram-intelligence.schemas";
import { InstagramC2FoundationsService } from "../foundations/instagram-c2-foundations.service";
import { finalizeInstagramC3 } from "../semantics/instagram-c3-semantics";
import { INSTAGRAM_C4_PROCESSORS } from "./instagram-c4.contract";
import { InstagramC4PersistenceHook } from "./instagram-c4.persistence";
import {
  InstagramC4AudienceProfileProcessor,
  InstagramC4ContentBehaviorProcessor,
  InstagramC4OrganicPerformanceProcessor,
} from "./instagram-c4.processor";
import { InstagramC4RuntimeService } from "./instagram-c4.runtime.service";

const databaseUrl = process.env.C4_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const postgres = databaseUrl ? describe : describe.skip;

postgres("Instagram C4 shared-current round trip", () => {
  let prisma: PrismaService;
  let runtime: InstagramC4RuntimeService;
  let projection: IntelligenceCurrentProjectionService;
  let tempRoot: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    tempRoot = await mkdtemp(join(tmpdir(), "instagram-c4-"));
    const codec = new ComponentPathCodec();
    const semantic = new SemanticValidator();
    const contracts = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      semantic,
    );
    contracts.verifyAtRoot(
      join(
        __dirname,
        "..",
        "..",
        "brand-intelligence",
        "generated",
        "contract-bundles",
      ),
    );
    const ownership = new BundlePathOwnershipRegistry(contracts, codec);
    const structural = new StructuralValidator();
    const content = new InstagramC4ContentBehaviorProcessor(
      prisma,
      contracts,
      structural,
      semantic,
    );
    const audience = new InstagramC4AudienceProfileProcessor(
      prisma,
      contracts,
      structural,
      semantic,
    );
    const performance = new InstagramC4OrganicPerformanceProcessor(
      prisma,
      contracts,
      structural,
      semantic,
    );
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
      content,
      audience,
      performance,
    );
    const executions = new IntelligenceExecutionService(
      prisma,
      new ExecutionContractGate(contracts, executors),
      ownership,
      codec,
    );
    const aggregation = new ExecutionAggregationService();
    const retry = new RetryBackoffPolicy();
    const repository = new ProcessorExecutionRepository(
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
    const persistence = new InstagramC4PersistenceHook(
      new IntelligenceGenerationRepository(prisma, codec),
      current,
      transitions,
      new PersistenceTransitionValidator(contracts, ownership),
      contracts,
    );
    const router = new ProcessorPersistenceRouter(
      undefined as never,
      undefined as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      persistence,
    );
    const worker = new ProcessorWorkerService(
      repository,
      new ProcessorFinalizationService(prisma, repository, aggregation, retry),
      executors,
      router,
    );
    runtime = new InstagramC4RuntimeService(executions, worker);
    projection = new IntelligenceCurrentProjectionService(
      new IntelligenceCurrentProjectionRepository(prisma),
      new IntelligenceCurrentContractScopeService(contracts, ownership, codec),
      new IntelligenceObjectAssembler(codec),
    );
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  });

  it("persists exactly three Objects/35 paths, replays, preserves failure, isolates and deletes", async () => {
    const brand = await createBrand(prisma, "target");
    const other = await createBrand(prisma, "other");
    const organization = await prisma.organization.create({
      data: { name: `C4 Browser ${randomUUID()}`, kind: "BRAND" },
    });
    await prisma.brandProfile.update({
      where: { id: brand.id },
      data: { organizationId: organization.id },
    });
    const email = `c4-browser-${randomUUID()}@example.test`;
    const password = randomUUID();
    const user = await prisma.user.create({
      data: {
        email,
        normalizedEmail: email,
        name: "C4 Browser Owner",
        role: "BRAND",
        authState: "ACTIVE",
        emailVerifiedAt: new Date(),
        organizationId: organization.id,
        authMethods: {
          create: {
            type: "PASSWORD",
            credentialHash: await hashPasswordAsync(password),
            verifiedAt: new Date(),
          },
        },
      },
    });
    await prisma.brandTeamMember.create({
      data: {
        brandProfileId: brand.id,
        userId: user.id,
        role: "BRAND_OWNER",
        isActive: true,
      },
    });
    const providerAccountId = `account-${randomUUID()}`;
    const integration = await prisma.brandIntegration.create({
      data: {
        brandProfileId: brand.id,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        isActive: true,
        providerAccountId,
        providerAppScopedUserId: `app-${randomUUID()}`,
        currentPlatformHandle: "c4-fixture",
        authorizationGeneration: 7,
        credentialVersion: 2,
        identityVerification: "VERIFIED",
        authorizationHealth: "CONNECTED_FULL",
        firstPartyProfileCapability: "YES",
        firstPartyInsightsCapability: "YES",
      },
    });
    for (const capabilityId of [
      "instagram.media_inventory",
      "instagram.account_profile",
      "instagram.audience_followers",
    ]) {
      await createEvidence(prisma, {
        brandId: brand.id,
        integrationId: integration.id,
        providerAccountId,
        authorizationGeneration: 7,
        capabilityId,
      });
    }
    await createEvidence(prisma, {
      brandId: other.id,
      integrationId: randomUUID(),
      providerAccountId: "other-account",
      authorizationGeneration: 1,
      capabilityId: "instagram.media_inventory",
    });

    const c2 = await new InstagramC2FoundationsService(prisma).execute({
      brandId: brand.id,
      providerAccountId,
      authorizationGeneration: 7,
      executionCutoff: new Date("2026-09-12T09:00:01.000Z"),
      windowEnd: new Date("2026-09-12T09:00:00.000Z"),
    });
    expect(c2.observations).toHaveLength(3);
    const mediaId = `media-${randomUUID()}`;
    await createC3Evidence(prisma, {
      brandId: brand.id,
      integrationId: integration.id,
      providerAccountId,
      authorizationGeneration: 7,
      mediaId,
      c2EvidenceRef: c2.observations[0]!.derivedEvidenceRef,
    });

    const input = {
      kind: "INSTAGRAM_C4_INPUT_V1" as const,
      brandProfileId: brand.id,
      integrationId: integration.id,
      providerAccountId,
      authorizationGeneration: 7,
      windowEnd: "2026-09-12T09:00:00.000Z",
      triggerIdempotencyKey: `c4-${brand.id}`,
      correlationRef: `c4-${brand.id}`,
    };
    const first = await runtime.execute(input);
    expect(first.map((item) => item.status)).toEqual([
      "COMPLETED",
      "COMPLETED",
      "COMPLETED",
    ]);
    expect(
      await prisma.intelligenceObjectGeneration.count({
        where: { brandId: brand.id },
      }),
    ).toBe(3);
    expect(
      await prisma.intelligenceComponentGeneration.count({
        where: { brandId: brand.id },
      }),
    ).toBe(35);
    expect(
      await prisma.intelligenceCurrentComponent.count({
        where: { brandId: brand.id },
      }),
    ).toBe(35);
    const generationIds = (
      await prisma.intelligenceCurrentComponent.findMany({
        where: { brandId: brand.id },
        select: { currentComponentGenerationId: true },
        orderBy: [
          { objectSemanticId: "asc" },
          { componentSemanticPath: "asc" },
        ],
      })
    ).map((item) => item.currentComponentGenerationId);
    const replay = await runtime.execute(input);
    expect(replay.every((item) => item.replayed)).toBe(true);
    expect(
      await prisma.intelligenceComponentGeneration.count({
        where: { brandId: brand.id },
      }),
    ).toBe(35);
    for (const definition of INSTAGRAM_C4_PROCESSORS) {
      const object = await projection.readObject({
        brandId: brand.id,
        subject: { type: "BRAND" },
        objectSemanticId: definition.objectId,
      });
      expect(object.assembledValue.state).toBe("VALUE");
      expect(
        InstagramIntelligenceObjectSchema.safeParse(
          object.assembledValue.state === "VALUE"
            ? object.assembledValue.value
            : null,
        ).success,
      ).toBe(true);
    }
    const consumer = new InstagramB4ConsumerService(
      prisma,
      new InstagramIntelligenceConnectionReadService(prisma),
      projection,
    );
    const workspace = await consumer.read(
      brand.id,
      user.id,
      new Date("2026-09-12T09:00:00.000Z"),
    );
    expect(workspace.objects).toHaveLength(3);
    expect(workspace.representativeMedia.map((item) => item.mediaId)).toEqual([
      mediaId,
    ]);
    expect((await consumer.readMedia(brand.id, mediaId)).mediaId).toBe(mediaId);
    await expect(consumer.readMedia(other.id, mediaId)).rejects.toThrow(
      "Instagram media not found",
    );
    await prisma.brandIntegration.update({
      where: { id: integration.id },
      data: { authorizationGeneration: 8 },
    });
    const failed = await runtime.execute({
      ...input,
      triggerIdempotencyKey: `${input.triggerIdempotencyKey}:failure`,
      correlationRef: `${input.correlationRef}:failure`,
    });
    expect(failed.every((item) => item.status === "FAILED_TERMINAL")).toBe(
      true,
    );
    expect(
      (
        await prisma.intelligenceCurrentComponent.findMany({
          where: { brandId: brand.id },
          select: { currentComponentGenerationId: true },
          orderBy: [
            { objectSemanticId: "asc" },
            { componentSemanticPath: "asc" },
          ],
        })
      ).map((item) => item.currentComponentGenerationId),
    ).toEqual(generationIds);

    const browserFixturePath = process.env.C4_BROWSER_FIXTURE_PATH;
    if (browserFixturePath) {
      await prisma.brandIntegration.update({
        where: { id: integration.id },
        data: { authorizationGeneration: 7 },
      });
      await writeFile(
        browserFixturePath,
        JSON.stringify({ email, password, mediaId }),
        {
          encoding: "utf8",
          mode: 0o600,
        },
      );
      return;
    }

    const purge = new InstagramDerivedDataPurgeService(
      new InstagramImageTemporaryStore(tempRoot),
    );
    const counts = await prisma.$transaction((tx) =>
      purge.purgePersistentInTransaction(tx, brand.id),
    );
    expect(counts).toMatchObject({
      intelligenceObjectGenerations: 3,
      intelligenceComponentGenerations: 35,
      intelligenceProcessorExecutions: 6,
    });
    expect(
      await prisma.intelligenceCurrentComponent.count({
        where: { brandId: brand.id },
      }),
    ).toBe(0);
    expect(
      await prisma.dataExtractionResource.count({
        where: { brandId: brand.id },
      }),
    ).toBe(0);
    expect(
      await prisma.dataExtractionResource.count({
        where: { brandId: other.id },
      }),
    ).toBe(1);
  }, 60_000);
});

async function createBrand(prisma: PrismaService, label: string) {
  return prisma.brandProfile.create({
    data: {
      domain: `c4-${label}-${randomUUID()}.example.test`,
      name: `C4 ${label}`,
      industry: "D2C",
      brandValues: [],
      policyFlags: [],
    },
  });
}

async function createEvidence(
  prisma: PrismaService,
  input: {
    brandId: string;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    capabilityId: string;
    boundedPayload?: unknown;
    normalizationContractVersion?: string;
  },
) {
  const suffix = randomUUID();
  const resourceRef = `resource:${suffix}`;
  const captureRef = `capture:${suffix}`;
  await prisma.dataExtractionResource.create({
    data: {
      resourceRef,
      brandId: input.brandId,
      sourceClass: "INSTAGRAM_OWNED",
      resourceType:
        input.capabilityId === "instagram.account_profile"
          ? "INSTAGRAM_ACCOUNT"
          : "INSTAGRAM_MEDIA",
      providerAccountId: input.providerAccountId,
      canonicalResourceKey: `instagram:${suffix}`,
      canonicalResourceKeyHash: suffix
        .replaceAll("-", "")
        .padEnd(64, "0")
        .slice(0, 64),
      canonicalUrl: `https://example.invalid/instagram/${suffix}`,
    },
  });
  await prisma.dataExtractionCapture.create({
    data: {
      captureRef,
      brandId: input.brandId,
      resourceRef,
      providerIntegrationId: input.integrationId,
      providerAccountId: input.providerAccountId,
      authorizationGeneration: input.authorizationGeneration,
      acquisitionRequestKey: `request:${suffix}`,
      status: "COMPLETED",
      startedAt: new Date("2026-09-12T08:59:59.000Z"),
      capturedAt: new Date("2026-09-12T09:00:00.000Z"),
      acquisitionQuality: "COMPLETE",
    },
  });
  const evidenceRef = `evidence:${suffix}`;
  await prisma.dataExtractionEvidenceItem.create({
    data: {
      evidenceRef,
      brandId: input.brandId,
      capabilityId: input.capabilityId,
      normalizationContractVersion:
        input.normalizationContractVersion ?? "fixture-1.0",
      resourceRef,
      captureRef,
      boundedPayload: input.boundedPayload ?? { fixture: true },
      contentHash: suffix.replaceAll("-", "").padEnd(64, "f").slice(0, 64),
      representativeness: "CONTEXT_SPECIFIC",
      coverageSnapshot: "SINGLE_RESOURCE",
      freshnessAtEmission: "CURRENT",
      freshnessBasis: "deterministic fixture",
      freshnessEvaluatedAt: new Date("2026-09-12T09:00:00.000Z"),
      qualitySnapshot: "COMPLETE",
      itemFingerprint: `fingerprint:${suffix}`,
      captureMethodClass: "DETERMINISTIC_DERIVATION",
    },
  });
  return evidenceRef;
}

async function createC3Evidence(
  prisma: PrismaService,
  input: {
    brandId: string;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    mediaId: string;
    c2EvidenceRef: string;
  },
) {
  const captionEvidenceRef = `evidence:instagram:caption:${randomUUID()}`;
  const finalized = finalizeInstagramC3({
    brandProfileId: input.brandId,
    providerAccountId: input.providerAccountId,
    authorizationGeneration: input.authorizationGeneration,
    mediaId: input.mediaId,
    resourceRef: `resource:instagram:${input.mediaId}`,
    captureRef: `capture:instagram:${input.mediaId}`,
    capturedAt: "2026-09-12T09:00:00.000Z",
    publishedAt: {
      state: "AVAILABLE",
      value: "2026-09-11T09:00:00.000Z",
    },
    mediaType: "IMAGE",
    permalink: { state: "UNKNOWN", reasonCode: "INSUFFICIENT_EVIDENCE" },
    context: {
      caption: {
        state: "AVAILABLE",
        text: "A deterministic #launch observation",
        contentHash: "a".repeat(64),
        evidenceRef: captionEvidenceRef,
      },
      visual: { state: "UNKNOWN" },
      inspection: {
        depth: "LIGHT_ONLY",
        selectedForDeepAnalysis: false,
        selectionReasons: [],
        inspectedChildCount: 0,
        availableChildCount: 0,
        inspectedFrameCount: 0,
        reasonCodes: ["MEDIA_NOT_SELECTED_FOR_DEEP_ANALYSIS", "NOT_INSPECTED"],
      },
    },
    candidate: {
      themes: [],
      captionPatterns: [],
      creativeStructures: [],
      visualExecutions: [],
      creatorRoleSignals: [],
      creatorPresence: { state: "UNKNOWN", supportModalities: [] },
      offeringPresence: { state: "UNKNOWN", supportModalities: [] },
      offeringName: null,
      collaborationCues: [],
    },
    metrics: [],
    c2EvidenceRef: input.c2EvidenceRef,
    modelIdentity: "deterministic-c4-fixture-model",
    offerings: [],
  });
  const observation = finalized.observation;
  const executionIdentity = `c4-c3-${randomUUID()}`;
  const common = {
    resultClass: "MODEL_DERIVED_RESULT",
    contractVersion: "1.0",
    sourceScope: "INSTAGRAM_OWNED",
    brandProfileId: input.brandId,
    providerAccountId: input.providerAccountId,
    authorizationGeneration: input.authorizationGeneration,
    mediaId: input.mediaId,
    executionIdentity,
    supportingEvidenceRefs: [captionEvidenceRef, input.c2EvidenceRef],
  };
  const core = {
    ...observation,
    themes: undefined,
    captionPatterns: undefined,
    creativeStructures: undefined,
    visualExecutions: undefined,
    creatorRoleSignals: undefined,
    creatorPresence: undefined,
    offeringPresence: undefined,
    likelyCollab: undefined,
    inspection: undefined,
  };
  const payloads = {
    "instagram.caption_context": {
      observationCore: core,
      themes: observation.themes,
      captionPatterns: observation.captionPatterns,
      creativeStructures: observation.creativeStructures,
    },
    "instagram.media_visual_observations": {
      visualExecutions: observation.visualExecutions,
      inspection: observation.inspection,
    },
    "instagram.media_creator_signals": {
      creatorRoleSignals: observation.creatorRoleSignals,
      creatorPresence: observation.creatorPresence,
      likelyCollab: observation.likelyCollab,
    },
    "instagram.media_offering_signals": {
      offeringPresence: observation.offeringPresence,
    },
  } as const;
  for (const [capabilityId, semanticPayload] of Object.entries(payloads)) {
    await createEvidence(prisma, {
      brandId: input.brandId,
      integrationId: input.integrationId,
      providerAccountId: input.providerAccountId,
      authorizationGeneration: input.authorizationGeneration,
      capabilityId,
      normalizationContractVersion: "instagram.per-media-semantics.c3.v1",
      boundedPayload: { ...common, semanticPayload },
    });
  }
}
