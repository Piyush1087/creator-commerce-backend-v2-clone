import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  IndustryVertical,
  IntelligenceProcessorExecutionStatus,
  type Prisma,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { ContractBundleIntegrityVerifier } from "../../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { BundlePathOwnershipRegistry } from "../../brand-intelligence/contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../../brand-intelligence/contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../brand-intelligence/contracts/validation/semantic.validator";
import { StructuralValidator } from "../../brand-intelligence/contracts/validation/structural.validator";
import { ExecutionAggregationService } from "../../brand-intelligence/execution/execution-aggregation.service";
import { ProcessorExecutorRegistry } from "../../brand-intelligence/execution/executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "../../brand-intelligence/execution/executor/synthetic-processor.executor";
import { IntelligenceExecutionService } from "../../brand-intelligence/execution/intelligence-execution.service";
import { RetryBackoffPolicy } from "../../brand-intelligence/execution/policy/retry-backoff.policy";
import { ProcessorExecutionRepository } from "../../brand-intelligence/execution/processor-execution.repository";
import { ProcessorFinalizationService } from "../../brand-intelligence/execution/processor-finalization.service";
import { ProcessorWorkerService } from "../../brand-intelligence/execution/processor-worker.service";
import { ExecutionContractGate } from "../../brand-intelligence/execution/registry/execution-contract.gate";
import { CanonicalStateManifestBuilder } from "../../brand-intelligence/input/canonical-state/canonical-state-manifest";
import { EvidenceManifestBuilder } from "../../brand-intelligence/input/evidence/evidence-manifest";
import { IntelligenceGenerationRepository } from "../../brand-intelligence/persistence/intelligence-generation.repository";
import { BrandCommunicationProcessorExecutor } from "../../brand-intelligence/processors/brand-communication/brand-communication-processor.executor";
import type { BrandCommunicationModelProvider } from "../../brand-intelligence/processors/brand-communication/brand-communication-model.provider";
import { BrandCommunicationProviderError } from "../../brand-intelligence/processors/brand-communication/brand-communication-model.provider";
import { ComponentPathCodec } from "../../brand-intelligence/semantic-path/component-path.codec";
import type { ComponentSemanticAddress } from "../../brand-intelligence/semantic-path/component-path.types";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { DataExtractionIntelligenceEvidenceAdapter } from "../../data-extraction/evidence/intelligence/data-extraction-intelligence-evidence.adapter";
import { DataExtractionPersistenceService } from "../../data-extraction/evidence/persistence/prisma-evidence-repositories";
import { DataExtractionEvidenceQueryService } from "../../data-extraction/evidence/query/data-extraction-evidence-query.service";
import { InstagramDerivedDataPurgeService } from "../../data-extraction/evidence/instagram/instagram-derived-data-purge.service";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import { InstagramBrandSourceAdmissionService } from "./instagram-brand-source-admission.service";
import { InstagramHiddenBrandPersistenceHook } from "./instagram-hidden-brand.persistence";
import { InstagramHiddenBrandReader } from "./instagram-hidden-brand.reader";

const databaseUrl = process.env.D_COMBINED_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const postgres = databaseUrl ? describe : describe.skip;

postgres("D_COMBINED hidden Brand PostgreSQL round trip", () => {
  const prisma = new PrismaService();
  const codec = new ComponentPathCodec();
  const semantic = new SemanticValidator();
  const contracts = new ContractRuntimeRegistry(
    new ContractBundleIntegrityVerifier(),
    semantic,
  );
  const modelState: {
    evidenceRefs: string[];
    guidance: string;
    error?: BrandCommunicationProviderError;
  } = { evidenceRefs: [], guidance: "Use concise captions." };
  const model: BrandCommunicationModelProvider = {
    generate: vi.fn(async () => {
      if (modelState.error) {
        const error = modelState.error;
        modelState.error = undefined;
        throw error;
      }
      const metadata = {
        semantic_id: null,
        authority: "CREATOR_SHOP_DERIVED" as const,
        source_class: "INSTAGRAM_OWNED",
        freshness: "CURRENT" as const,
        evidence_refs: modelState.evidenceRefs,
      };
      return {
        output: {
          communication_profile: {
            tone_traits: null,
            free_text_guidance: modelState.guidance,
            communication_constraints: null,
            primary_language: null,
          },
          output_metadata: {
            tone_traits: null,
            free_text_guidance: metadata,
            communication_constraints: null,
            primary_language: null,
          },
        },
        providerAttemptCount: 1,
      };
    }),
  };
  let brandId = "";
  let peerBrandId = "";
  let admission: InstagramBrandSourceAdmissionService;
  let executions: IntelligenceExecutionService;
  let worker: ProcessorWorkerService;
  let reader: InstagramHiddenBrandReader;
  let writer: InstagramCaptureWriterService;

  beforeAll(async () => {
    await prisma.$connect();
    contracts.initializeAtRoot(
      resolve(
        process.cwd(),
        "src/features/brand-intelligence/generated/contract-bundles",
      ),
    );
    brandId = await createBrand("target", "account-target", 7);
    peerBrandId = await createBrand("peer", "account-peer", 3);
    writer = new InstagramCaptureWriterService(prisma);
    const query = new DataExtractionEvidenceQueryService(
      new DataExtractionPersistenceService(prisma),
    );
    const evidenceReader = new DataExtractionIntelligenceEvidenceAdapter(query);
    const canonicalReader = {
      read: vi.fn(async ({ brandId: id }: { brandId: string }) => ({
        brandId: id,
        lifecycleMode: "POST_PROFILE" as const,
        observedAt: "2026-09-12T00:00:00.000Z",
        canonicalSnapshotRef: `canonical:${id}`,
        entries: (["brand_name", "industry"] as const).map((name) => ({
          semantic: name,
          value: name === "brand_name" ? "Fixture Brand" : "D2C",
          source: "BRAND_PROFILE" as const,
          authority: "APPLICATION_CANONICAL" as const,
          provenanceStatus: "DIRECT" as const,
          resolutionStatus: "RESOLVED" as const,
          fallbackUsed: false,
          conflictDetected: false,
          businessStateReference: {
            entityType: "BrandProfile" as const,
            entityId: id,
            semanticFieldPath: name,
            revisionKind: "UPDATED_AT" as const,
            revisionToken: "2026-09-12T00:00:00.000Z",
            observedAt: "2026-09-12T00:00:00.000Z",
            canonicalSnapshotRef: `canonical:${id}`,
          },
        })),
      })),
    };
    admission = new InstagramBrandSourceAdmissionService(
      prisma,
      canonicalReader as never,
      evidenceReader,
      new CanonicalStateManifestBuilder(),
      new EvidenceManifestBuilder(),
    );
    const executor = new BrandCommunicationProcessorExecutor(
      { prepare: vi.fn() } as never,
      contracts,
      new StructuralValidator(),
      semantic,
      model,
      admission,
    );
    const registry = new ProcessorExecutorRegistry(
      new SyntheticProcessorExecutor(),
      executor,
    );
    const ownership = new BundlePathOwnershipRegistry(contracts, codec);
    executions = new IntelligenceExecutionService(
      prisma,
      new ExecutionContractGate(contracts, registry),
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
    worker = new ProcessorWorkerService(
      repository,
      new ProcessorFinalizationService(prisma, repository, aggregation, retry),
      registry,
      new InstagramHiddenBrandPersistenceHook(
        new IntelligenceGenerationRepository(prisma, codec),
        codec,
      ),
    );
    reader = new InstagramHiddenBrandReader(prisma);
  }, 60_000);

  afterAll(async () => {
    const purge = new InstagramDerivedDataPurgeService(
      new InstagramImageTemporaryStore("d-combined-unused"),
    );
    for (const id of [brandId, peerBrandId]) {
      if (!id) continue;
      await prisma.$transaction((tx) =>
        purge.purgePersistentInTransaction(tx, id),
      );
      await prisma.brandIntegration.deleteMany({
        where: { brandProfileId: id },
      });
      await prisma.intelligenceSubject.deleteMany({ where: { brandId: id } });
      await prisma.brandProfile.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  it("persists, replays, advances by changed Evidence, preserves failure, isolates and deletes", async () => {
    const targetFirst = await writeCaptions(
      brandId,
      "account-target",
      7,
      ["first-a", "first-b", "first-c"],
      new Date("2026-09-11T03:00:00.000Z"),
    );
    const peerFirst = await writeCaptions(
      peerBrandId,
      "account-peer",
      3,
      ["peer-a", "peer-b", "peer-c"],
      new Date("2026-09-11T03:00:00.000Z"),
    );
    modelState.evidenceRefs = targetFirst;
    const baseline = await stateCounts(brandId);
    const first = await run("first", new Date("2026-09-12T00:00:00.000Z"));
    if (first.status !== IntelligenceProcessorExecutionStatus.COMPLETED)
      throw new Error(
        `UNEXPECTED_HIDDEN_FAILURE:${first.lastErrorCategory}:${first.lastErrorCode}`,
      );
    expect(first.status).toBe(IntelligenceProcessorExecutionStatus.COMPLETED);
    const firstRead = await reader.latestSuccessful(brandId);
    expect(firstRead).toHaveLength(1);
    expect(firstRead[0]).toMatchObject({
      sourceScope: "INSTAGRAM_OWNED",
      sourceProfileVersion: "1.1",
      processorId: "brand_communication",
    });
    const firstGenerationId = firstRead[0].generationId;
    expect(await stateCounts(brandId)).toEqual({
      ...baseline,
      generations: baseline.generations + 1,
      components: baseline.components + 3,
      evidenceRefs: baseline.evidenceRefs + 6,
    });

    const replay = await run("first", new Date("2026-09-12T00:00:00.000Z"));
    expect(replay.id).toBe(first.id);
    expect((await reader.latestSuccessful(brandId))[0].generationId).toBe(
      firstGenerationId,
    );

    const targetSecond = await writeCaptions(
      brandId,
      "account-target",
      7,
      ["second-a", "second-b", "second-c"],
      new Date("2026-09-12T06:00:00.000Z"),
    );
    modelState.evidenceRefs = targetSecond;
    modelState.guidance = "Use direct, concise captions.";
    const second = await run("second", new Date("2026-09-12T12:00:00.000Z"));
    expect(second.status).toBe(IntelligenceProcessorExecutionStatus.COMPLETED);
    const secondRead = await reader.latestSuccessful(brandId);
    expect(secondRead[0].generationId).not.toBe(firstGenerationId);

    modelState.error = new BrandCommunicationProviderError(
      "REQUEST_TIMEOUT",
      true,
    );
    const failed = await run("failed", new Date("2026-09-12T18:00:00.000Z"), 1);
    expect(failed.status).toBe(
      IntelligenceProcessorExecutionStatus.FAILED_TERMINAL,
    );
    expect((await reader.latestSuccessful(brandId))[0].generationId).toBe(
      secondRead[0].generationId,
    );
    expect(await stateCounts(brandId)).toMatchObject({
      currents: baseline.currents,
      candidates: baseline.candidates,
      transitions: baseline.transitions,
    });

    modelState.evidenceRefs = peerFirst;
    await runFor(
      peerBrandId,
      "account-peer",
      3,
      "peer",
      new Date("2026-09-12T00:00:00.000Z"),
    );
    expect(await reader.latestSuccessful(peerBrandId)).toHaveLength(1);
    const purge = new InstagramDerivedDataPurgeService(
      new InstagramImageTemporaryStore("d-combined-unused"),
    );
    await prisma.$transaction((tx) =>
      purge.purgePersistentInTransaction(tx, brandId),
    );
    expect(await reader.latestSuccessful(brandId)).toEqual([]);
    expect(await reader.latestSuccessful(peerBrandId)).toHaveLength(1);
  }, 60_000);

  async function createBrand(
    label: string,
    account: string,
    generation: number,
  ) {
    const brand = await prisma.brandProfile.create({
      data: {
        domain: `d-combined-${label}-${randomUUID()}.example.test`,
        name: `D Combined ${label}`,
        industry: IndustryVertical.D2C,
        brandValues: [],
        policyFlags: [],
      },
    });
    await prisma.brandIntegration.create({
      data: {
        brandProfileId: brand.id,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        isActive: true,
        providerAccountId: account,
        providerAppScopedUserId: `app-${randomUUID()}`,
        currentPlatformHandle: label,
        authorizationGeneration: generation,
        credentialVersion: 1,
      },
    });
    return brand.id;
  }

  async function writeCaptions(
    id: string,
    account: string,
    generation: number,
    keys: readonly string[],
    capturedAt: Date,
  ) {
    const requestKey = keys.join("-");
    const result = await writer.write({
      brandId: id,
      providerAccountId: account,
      authorizationGeneration: generation,
      resourceType: "INSTAGRAM_MEDIA",
      mediaId: `media-${requestKey}-${id}`,
      capabilityId: "instagram.caption_context",
      requestKey: `d-combined:${requestKey}:${id}`,
      providerExecutionRef: `fixture:${requestKey}:${id}`,
      normalizationContractVersion: "instagram.per-media-semantics.c3.v1",
      startedAt: capturedAt,
      completedAt: capturedAt,
      capturedAt,
      availability: "AVAILABLE",
      retryability: "NOT_APPLICABLE",
      reasonCodes: ["D_COMBINED_FIXTURE"],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      artifacts: keys.map((key) => ({
        artifactKey: key,
        payload: { caption: `Caption ${key}` },
      })),
      evidence: keys.map((key) => ({
        evidenceKey: key,
        artifactKey: key,
        payload: { semanticPayload: { caption: `Caption ${key}` } },
        freshness: "CURRENT",
        representativeness: "CONTEXT_SPECIFIC",
      })),
    });
    return [...result.evidenceRefs];
  }

  async function run(key: string, windowEnd: Date, maxAttempts = 2) {
    return runFor(brandId, "account-target", 7, key, windowEnd, maxAttempts);
  }

  async function runFor(
    id: string,
    account: string,
    generation: number,
    key: string,
    windowEnd: Date,
    maxAttempts = 2,
  ) {
    const activeScope: readonly ComponentSemanticAddress[] = [
      "$",
      "$/f/free_text_guidance",
      "$/f/primary_language",
    ].map((componentSemanticPath) => ({
      brandId: id,
      objectSemanticId: "communication_profile",
      pathSchemeVersion: 1,
      componentSemanticPath,
    }));
    const identity = {
      sourceProfileVersion: "1.1",
      sourceScope: "INSTAGRAM_OWNED",
      providerAccountId: account,
      authorizationGeneration: generation,
      windowStart: new Date(
        windowEnd.getTime() - 30 * 86_400_000,
      ).toISOString(),
      windowEnd: windowEnd.toISOString(),
    } as const;
    const prepared = await admission.prepare({
      brandId: id,
      registryKey: {
        processorId: "brand_communication",
        processorVersion: "1.0",
        outputContractId: "brand_communication_output_contract",
        outputContractVersion: "1.0",
      },
      activeScope,
      identity,
    });
    const command = {
      brandId: id,
      triggerType: "INSTAGRAM_HIDDEN_BRAND_SOURCE_REFRESH",
      triggerRef: key,
      triggerIdempotencyKey: `d-combined:${key}`,
      correlationRef: `d-combined:${key}`,
      requestedImpact: {
        sourceScope: "INSTAGRAM_OWNED",
        mode: "GENERATION_ONLY",
        canonicalCurrentWrite: false,
        canonicalCandidateWrite: false,
      },
      processors: [
        {
          registryKey: prepared.registryKey,
          activeScope,
          dependencyManifest:
            prepared.dependencyManifest as unknown as Prisma.InputJsonValue,
          evidenceManifest:
            prepared.evidenceManifest as unknown as Prisma.InputJsonValue,
          executionIntentKey: `d-combined:${key}:${prepared.evidenceManifestHash}`,
          maxAttempts,
          dependencyEligible: true,
        },
      ],
    } as const;
    const created = await executions.createOrReturn(command);
    const processor = created.processorExecutions[0];
    if (processor.status === IntelligenceProcessorExecutionStatus.QUEUED) {
      return (await worker.runExact(processor.id, "d-combined-fixture", 60_000))
        .processorExecution;
    }
    return processor;
  }

  async function stateCounts(id: string) {
    return {
      generations: await prisma.intelligenceObjectGeneration.count({
        where: { brandId: id },
      }),
      components: await prisma.intelligenceComponentGeneration.count({
        where: { brandId: id },
      }),
      evidenceRefs: await prisma.intelligenceEvidenceReference.count({
        where: { brandId: id },
      }),
      currents: await prisma.intelligenceCurrentComponent.count({
        where: { brandId: id },
      }),
      candidates: await prisma.intelligenceComponentCandidate.count({
        where: { brandId: id },
      }),
      transitions: await prisma.intelligenceComponentTransition.count({
        where: { brandId: id },
      }),
    };
  }
});
