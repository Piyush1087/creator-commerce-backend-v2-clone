import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";

import {
  IndustryVertical,
  IntelligenceAuthority,
  IntelligenceProcessorExecutionStatus,
  IntelligenceProtectionState,
  PrismaClient,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../../prisma/prisma.service";
import {
  OwnedWebsiteWave1AcquisitionService,
  type OwnedWebsitePageAcquisition,
  type OwnedWebsitePageAcquisitionMechanics,
} from "../../../data-extraction/evidence/acquisition/owned-website-wave1-acquisition.service";
import { asBrandId } from "../../../data-extraction/evidence/domain/evidence-identities";
import { DataExtractionIntelligenceEvidenceAdapter } from "../../../data-extraction/evidence/intelligence/data-extraction-intelligence-evidence.adapter";
import { OwnedWebsiteWave1NormalizationService } from "../../../data-extraction/evidence/normalization/owned-website-wave1-normalization.service";
import { DataExtractionPersistenceService } from "../../../data-extraction/evidence/persistence/prisma-evidence-repositories";
import { DataExtractionEvidenceQueryService } from "../../../data-extraction/evidence/query/data-extraction-evidence-query.service";
import { ContractBundleIntegrityVerifier } from "../../contracts/bundle/contract-bundle.integrity";
import { BundlePathOwnershipRegistry } from "../../contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { PersistenceTransitionValidator } from "../../contracts/validation/persistence-transition.validator";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { ExecutionAggregationService } from "../../execution/execution-aggregation.service";
import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import { ProcessorExecutorRegistry } from "../../execution/executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "../../execution/executor/synthetic-processor.executor";
import { IntelligenceExecutionService } from "../../execution/intelligence-execution.service";
import { RetryBackoffPolicy } from "../../execution/policy/retry-backoff.policy";
import { ProcessorExecutionRepository } from "../../execution/processor-execution.repository";
import { ProcessorFinalizationService } from "../../execution/processor-finalization.service";
import { ProcessorWorkerService } from "../../execution/processor-worker.service";
import { ExecutionContractGate } from "../../execution/registry/execution-contract.gate";
import type { PreparedProcessorDependencies } from "../../input/dependency/processor-dependency-preparation.service";
import type { ProcessorDependencyPreparationService } from "../../input/dependency/processor-dependency-preparation.service";
import type { NormalizedEvidenceSet } from "../../input/evidence/intelligence-evidence.port";
import { IntelligenceActionRepository } from "../../persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "../../persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "../../persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "../../persistence/intelligence-generation.repository";
import { IntelligenceCurrentContractScopeService } from "../../projection/intelligence-current-contract-scope.service";
import { IntelligenceCurrentProjectionRepository } from "../../projection/intelligence-current-projection.repository";
import { IntelligenceCurrentProjectionService } from "../../projection/intelligence-current-projection.service";
import { IntelligenceObjectAssembler } from "../../projection/intelligence-object-assembler";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import { IntelligenceTransitionService } from "../../transitions/intelligence-transition.service";
import type { BrandCommunicationModelProvider } from "./brand-communication-model.provider";
import { BrandCommunicationProviderError } from "./brand-communication-model.provider";
import { BrandCommunicationPersistenceHook } from "./brand-communication-persistence.hook";
import { BrandCommunicationProcessorExecutor } from "./brand-communication-processor.executor";

const databaseEnabled =
  process.env.BRAND_COMMUNICATION_DATABASE_TEST === "true";
const hash = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

const registryKey = {
  processorId: "brand_communication",
  processorVersion: "1.0",
  outputContractId: "brand_communication_output_contract",
  outputContractVersion: "1.0",
} as const;

const meta = (semanticId: string | null, evidenceRef: string) => ({
  semantic_id: semanticId,
  authority: "CREATOR_SHOP_DERIVED",
  source_class: "OWNED_WEBSITE",
  freshness: "CURRENT",
  evidence_refs: [evidenceRef],
});

let messageEvidenceRef = "ev:message:1";
let languageEvidenceRef = "ev:language:1";

function output(guidance: string) {
  return {
    communication_profile: {
      tone_traits: [{ semantic_id: "warm-direct", trait: "Warm and direct" }],
      free_text_guidance: guidance,
      communication_constraints: null,
      primary_language: "en",
    },
    output_metadata: {
      tone_traits: [meta("warm-direct", messageEvidenceRef)],
      free_text_guidance: meta(null, messageEvidenceRef),
      communication_constraints: null,
      primary_language: meta(null, languageEvidenceRef),
    },
  };
}

class VerticalSliceWebsiteMechanics implements OwnedWebsitePageAcquisitionMechanics {
  async acquire(url: string): Promise<OwnedWebsitePageAcquisition> {
    const path = new URL(url).pathname;
    const links =
      path === "/"
        ? [
            new URL("/about", url).toString(),
            new URL("/products", url).toString(),
          ]
        : [];
    const text =
      path === "/about"
        ? "We are a creator commerce platform serving independent brands. Our mission is to support creators with transparent partnerships."
        : path === "/products"
          ? "Starter plan for small teams. Pro plan for growing teams. Enterprise plan for larger organizations."
          : "We help creators grow with better brand partnerships. Our mission is to never use guaranteed outcome claims in creator copy.";
    return {
      url,
      html: `<html lang="en"><body><main>${text}</main>${links
        .map((link) => `<a href="${link}">${link}</a>`)
        .join("")}</body></html>`,
      cleanText: text,
      internalLinks: links,
      quality: { state: "COMPLETE", failureCategories: [], detailCodes: [] },
      attempts: [
        {
          providerExecutionRef: `provider-execution:${randomUUID()}`,
          attemptRole: "PRIMARY",
        },
      ],
      reasonCodes: [],
    };
  }
}

describe.skipIf(!databaseEnabled)(
  "brand_communication W1.0D persistence and projection PostgreSQL slice",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { maxWait: 10_000 },
    });
    const prismaService = prisma as unknown as PrismaService;
    const brandId = randomUUID();
    const codec = new ComponentPathCodec();
    const semantic = new SemanticValidator();
    const contracts = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      semantic,
    );
    contracts.initializeAtRoot(
      resolve(
        process.cwd(),
        "src/features/brand-intelligence/generated/contract-bundles",
      ),
    );
    const ownership = new BundlePathOwnershipRegistry(contracts, codec);
    const aggregation = new ExecutionAggregationService();
    const retry = new RetryBackoffPolicy();
    const executionRepository = new ProcessorExecutionRepository(
      prismaService,
      aggregation,
      retry,
    );
    const finalization = new ProcessorFinalizationService(
      prismaService,
      executionRepository,
      aggregation,
      retry,
    );
    let preparedInput: PreparedProcessorDependencies;
    let actualEvidence: NormalizedEvidenceSet;
    let modelOutput: unknown = output("First guidance");
    let modelError: BrandCommunicationProviderError | undefined;
    const dependencyService = {
      prepare: vi.fn(async () => preparedInput),
    } as unknown as ProcessorDependencyPreparationService;
    const model: BrandCommunicationModelProvider = {
      generate: vi.fn(async () => {
        if (modelError) {
          const error = modelError;
          modelError = undefined;
          throw error;
        }
        return { output: modelOutput, providerAttemptCount: 1 };
      }),
    };
    const executor = new BrandCommunicationProcessorExecutor(
      dependencyService,
      contracts,
      new StructuralValidator(),
      semantic,
      model,
    );
    const executors = new ProcessorExecutorRegistry(
      new SyntheticProcessorExecutor(),
      executor,
    );
    const executionService = new IntelligenceExecutionService(
      prismaService,
      new ExecutionContractGate(contracts, executors),
      ownership,
      codec,
    );
    const currentState = new IntelligenceCurrentStateRepository(prismaService);
    const transition = new IntelligenceTransitionService(
      prismaService,
      currentState,
      new IntelligenceCandidateRepository(prismaService),
      new IntelligenceActionRepository(prismaService),
      codec,
    );
    const hook = new BrandCommunicationPersistenceHook(
      new IntelligenceGenerationRepository(prismaService, codec),
      currentState,
      transition,
      new PersistenceTransitionValidator(contracts, ownership),
      codec,
    );
    const worker = new ProcessorWorkerService(
      executionRepository,
      finalization,
      executors,
      hook,
    );
    const projection = new IntelligenceCurrentProjectionService(
      new IntelligenceCurrentProjectionRepository(prismaService),
      new IntelligenceCurrentContractScopeService(contracts, ownership, codec),
      new IntelligenceObjectAssembler(codec),
    );

    const address = (path: string): ComponentSemanticAddress => ({
      brandId,
      objectSemanticId: "communication_profile",
      pathSchemeVersion: 1,
      componentSemanticPath: path,
    });

    function prepared(scope: readonly ComponentSemanticAddress[]) {
      const evidenceItem = (
        capabilityId:
          | "owned_website.brand_messaging"
          | "observed_brand_communication_language_signals",
        evidenceRef: string,
      ) => ({
        brandId,
        evidenceRef,
        capabilityId,
        resourceRef: "website:home",
        resourceType: "OWNED_WEB_PAGE" as const,
        captureRef: "capture:wave1",
        captureVersion: "1",
        sourceClass: "OWNED_WEBSITE" as const,
        capturedAt: "2026-08-26T00:00:00.000Z",
        freshness: {
          state: "CURRENT" as const,
          evaluatedAt: "2026-08-26T00:00:00.000Z",
          basis: "LATEST_CAPTURE",
        },
        representativeness: "PERSISTENT_BRAND_LEVEL" as const,
        coverage: "SINGLE_RESOURCE" as const,
        acquisitionQuality: {
          state: "COMPLETE" as const,
          failureCategories: [],
          detailCodes: [],
        },
        provenance: {
          acquisitionOrNormalizationRunRef: `capability:${capabilityId}`,
          captureMethodClass: "DIRECT_FETCH" as const,
          normalizationContractVersion: "1.0",
          parentEvidenceRefs: [],
          parentCaptureRefs: [],
        },
        deduplication: {
          itemFingerprint: hash(evidenceRef),
          repetitionCount: 1,
          supportingResourceRefs: ["website:home"],
        },
        boundedNormalizedPayload: { text: "Warm direct English messaging" },
        contentHash: hash(evidenceRef),
      });
      const capability = (
        capabilityId:
          | "owned_website.brand_messaging"
          | "owned_website.brand_company_context"
          | "observed_brand_communication_language_signals"
          | "derived_communication_constraint_evidence",
        evidence: readonly ReturnType<typeof evidenceItem>[],
      ) => ({
        capabilityExecutionRef: `capability:${capabilityId}`,
        capabilityId,
        normalizationContractVersion: "1.0",
        status: "AVAILABLE" as const,
        retryability: "NOT_APPLICABLE" as const,
        reasonCodes: [],
        coverage: "SINGLE_RESOURCE" as const,
        acquisitionQuality: {
          state: "COMPLETE" as const,
          failureCategories: [],
          detailCodes: [],
        },
        evidence,
      });
      const canonicalState = {
        brandId,
        lifecycleMode: "POST_PROFILE" as const,
        observedAt: "2026-08-26T00:00:00.000Z",
        canonicalSnapshotRef: `canonical:${brandId}`,
        entries: (["brand_name", "industry"] as const).map((semanticId) => ({
          semantic: semanticId,
          value: semanticId === "brand_name" ? "Acme" : "Retail",
          source: "BRAND_PROFILE" as const,
          authority: "APPLICATION_CANONICAL" as const,
          fallbackUsed: false,
          conflictDetected: false,
          businessStateReference: {
            entityType: "BrandProfile" as const,
            entityId: brandId,
            semanticFieldPath: semanticId,
            revisionKind: "UPDATED_AT" as const,
            revisionToken: "2026-08-26T00:00:00.000Z",
            observedAt: "2026-08-26T00:00:00.000Z",
            canonicalSnapshotRef: `canonical:${brandId}`,
          },
        })),
      };
      const syntheticEvidence = {
        brandId,
        capabilityResults: [
          capability("owned_website.brand_messaging", [
            evidenceItem("owned_website.brand_messaging", "ev:message:1"),
          ]),
          capability("owned_website.brand_company_context", []),
          capability("observed_brand_communication_language_signals", [
            evidenceItem(
              "observed_brand_communication_language_signals",
              "ev:language:1",
            ),
          ]),
          // AVAILABLE + [] is intentionally preserved and remains eligible.
          capability("derived_communication_constraint_evidence", []),
        ],
      };
      const evidence = actualEvidence ?? syntheticEvidence;
      const dependencyManifest = { canonical: "v1" };
      const evidenceManifest = { evidence: "v1" };
      preparedInput = {
        brandId,
        registryKey,
        activeScope: scope,
        canonicalState,
        canonicalStateManifest: dependencyManifest,
        dependencyManifest,
        dependencyManifestHash: sha256CanonicalExecution(dependencyManifest),
        evidence,
        evidenceManifest,
        evidenceManifestHash: sha256CanonicalExecution(evidenceManifest),
        readiness: { readiness: "READY_TO_RUN", reasonCodes: [] },
        dependencyEligible: true,
        wakeUpSignals: ["NEW_EVIDENCE_CAPTURE_AVAILABLE"],
      } as unknown as PreparedProcessorDependencies;
      return { dependencyManifest, evidenceManifest };
    }

    async function run(
      semanticOutput: unknown,
      scope: readonly ComponentSemanticAddress[],
      triggerKey = randomUUID(),
      forceError?: BrandCommunicationProviderError,
      maxAttempts = 1,
    ) {
      const manifests = prepared(scope);
      modelOutput = semanticOutput;
      modelError = forceError;
      const command = {
        brandId,
        triggerType: "BI_W1_1A_TEST",
        triggerRef: `test:${triggerKey}`,
        triggerIdempotencyKey: triggerKey,
        correlationRef: `correlation:${triggerKey}`,
        requestedImpact: { objectSemanticId: "communication_profile" },
        processors: [
          {
            registryKey,
            activeScope: scope,
            ...manifests,
            executionIntentKey: `brand-communication:${triggerKey}`,
            maxAttempts,
            dependencyEligible: true,
          },
        ],
      } as const;
      const created = await executionService.createOrReturn(command);
      if (!created.replayed) {
        const completed = await worker.runOnce("bi-w1.1a-test", 60_000);
        if (
          !forceError &&
          completed.processorExecution.status !==
            IntelligenceProcessorExecutionStatus.COMPLETED
        ) {
          const failedAttempt =
            await prisma.intelligenceProcessorAttempt.findFirst({
              where: { processorExecutionId: completed.processorExecution.id },
              orderBy: { attemptNumber: "desc" },
            });
          throw new Error(
            `UNEXPECTED_PROCESSOR_FAILURE:${completed.processorExecution.lastErrorCategory}:${completed.processorExecution.lastErrorCode}:${failedAttempt?.errorCode}`,
          );
        }
      }
      return { created, command };
    }

    beforeAll(async () => {
      await prisma.brandProfile.create({
        data: {
          id: brandId,
          domain: `bi-w1-1a-${brandId}.example`,
          name: "BI W1.1A PostgreSQL test",
          industry: IndustryVertical.D2C,
          brandValues: [],
          policyFlags: [],
          targetAudience: {},
        },
      });
      const dePersistence = new DataExtractionPersistenceService(prismaService);
      const acquisition = new OwnedWebsiteWave1AcquisitionService(
        dePersistence,
        new VerticalSliceWebsiteMechanics(),
      );
      const normalization = new OwnedWebsiteWave1NormalizationService(
        dePersistence,
        prismaService,
      );
      const deBrandId = asBrandId(brandId);
      const root = `https://bi-w1-1a-${brandId}.example/`;
      for (const capabilityId of [
        "owned_website.brand_messaging",
        "owned_website.brand_company_context",
        "observed_brand_communication_language_signals",
        "derived_communication_constraint_evidence",
      ] as const) {
        const acquired = await acquisition.request({
          brandId: deBrandId,
          capabilityId,
          freshnessIntent: "REUSE_ALLOWED",
          normalizationContractVersion: "1.0",
          requestKey: `bi-w1-1a:${capabilityId}:${randomUUID()}`,
          ownedWebsiteRoot: root,
        });
        await normalization.normalize({
          brandId: deBrandId,
          capabilityExecutionRef: acquired.capabilityExecutionRef,
        });
      }
      const adapter = new DataExtractionIntelligenceEvidenceAdapter(
        new DataExtractionEvidenceQueryService(dePersistence),
      );
      actualEvidence = await adapter.read({
        brandId,
        processorId: "brand_communication",
        processorVersion: "1.0",
        capabilityIds: [
          "owned_website.brand_messaging",
          "owned_website.brand_company_context",
          "observed_brand_communication_language_signals",
          "derived_communication_constraint_evidence",
        ],
      });
      messageEvidenceRef = actualEvidence.capabilityResults.find(
        (item) => item.capabilityId === "owned_website.brand_messaging",
      )!.evidence[0]!.evidenceRef;
      languageEvidenceRef = actualEvidence.capabilityResults.find(
        (item) =>
          item.capabilityId === "observed_brand_communication_language_signals",
      )!.evidence[0]!.evidenceRef;
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it("persists a real generation, projects lineage, and replays idempotently", async () => {
      const triggerKey = randomUUID();
      const first = await run(
        output("First guidance"),
        [address("$")],
        triggerKey,
      );
      expect(first.created.processorExecutions[0].status).toBe(
        IntelligenceProcessorExecutionStatus.QUEUED,
      );
      const projected = await projection.readObject({
        brandId,
        objectSemanticId: "communication_profile",
      });
      expect(projected).toMatchObject({
        objectState: "CURRENT",
        resultReadiness: "READY",
        consumerReadiness: "READY",
        freshness: "CURRENT",
        authority: "CREATOR_SHOP_DERIVED",
        sourceClass: "MULTI_SOURCE",
        mixedGeneration: false,
        mixedContractVersion: false,
      });
      expect(
        projected.components[0].evidenceReferenceSummary.map(
          (item) => item.evidenceRef,
        ),
      ).toEqual(
        expect.arrayContaining([languageEvidenceRef, messageEvidenceRef]),
      );
      expect(
        projected.components[0].businessStateReferenceSummary,
      ).toHaveLength(2);
      const replay = await executionService.createOrReturn(first.command);
      expect(replay.replayed).toBe(true);
      expect(
        await prisma.intelligenceObjectGeneration.count({ where: { brandId } }),
      ).toBe(1);
    });

    it("updates unprotected current immutably and supports legitimate mixed generations", async () => {
      await run(output("Second guidance"), [address("$")]);
      expect(
        await prisma.intelligenceObjectGeneration.count({ where: { brandId } }),
      ).toBe(2);
      expect(
        await prisma.intelligenceComponentGeneration.count({
          where: { brandId, componentSemanticPath: "$" },
        }),
      ).toBe(2);

      await run(output("Subfield guidance"), [
        address("$/f/free_text_guidance"),
      ]);
      const projected = await projection.readObject({
        brandId,
        objectSemanticId: "communication_profile",
      });
      expect(projected.objectState).toBe("CURRENT");
      expect(projected.mixedGeneration).toBe(true);
      expect(projected.resultReadiness).toBe("READY");
      expect(projected.assembledValue).toMatchObject({
        state: "VALUE",
        value: { free_text_guidance: "Subfield guidance" },
      });
    });

    it("preserves protected current and exposes only a conflict summary", async () => {
      const root = await prisma.intelligenceCurrentComponent.findFirstOrThrow({
        where: address("$"),
      });
      await prisma.$transaction([
        prisma.intelligenceComponentGeneration.update({
          where: { id: root.currentComponentGenerationId },
          data: {
            authority: IntelligenceAuthority.BRAND_CONFIRMED,
            sourceClass: "BRAND_USER_INPUT",
          },
        }),
        prisma.intelligenceCurrentComponent.update({
          where: { id: root.id },
          data: {
            currentAuthority: IntelligenceAuthority.BRAND_CONFIRMED,
            currentSourceClass: "BRAND_USER_INPUT",
            protectionState: IntelligenceProtectionState.BRAND_CONFIRMED,
          },
        }),
      ]);
      const protectedGenerationId = root.currentComponentGenerationId;
      await run(output("Conflicting derived guidance"), [address("$")]);
      const current =
        await prisma.intelligenceCurrentComponent.findFirstOrThrow({
          where: address("$"),
        });
      expect(current.currentComponentGenerationId).toBe(protectedGenerationId);
      expect(
        await prisma.intelligenceComponentCandidate.count({
          where: { brandId, componentSemanticPath: "$", status: "PENDING" },
        }),
      ).toBe(1);
      const projected = await projection.readObject({
        brandId,
        objectSemanticId: "communication_profile",
      });
      expect(projected.candidateSummary).toMatchObject({
        status: "CONFLICT",
        pendingCount: 1,
        rawCandidateVisible: false,
      });
    });

    it("preserves explicit-null, intentional-absence, and semantic collection identity", async () => {
      const explicitNull = output("ignored");
      explicitNull.communication_profile.free_text_guidance = null as never;
      explicitNull.output_metadata.free_text_guidance = null as never;
      await run(explicitNull, [address("$/f/free_text_guidance")]);
      const nullProjection = await projection.readComponent({
        brandId,
        objectSemanticId: "communication_profile",
        componentSemanticPath: "$/f/free_text_guidance",
      });
      expect(nullProjection).toMatchObject({
        projectionState: "CURRENT",
        valueState: "EXPLICIT_NULL",
        value: null,
      });

      await run(output("Collection identity"), [
        address("$/f/tone_traits/i/not-emitted"),
      ]);
      const absentProjection = await projection.readComponent({
        brandId,
        objectSemanticId: "communication_profile",
        componentSemanticPath: "$/f/tone_traits/i/not-emitted",
      });
      expect(absentProjection).toMatchObject({
        projectionState: "CURRENT",
        valueState: "INTENTIONALLY_ABSENT",
      });
      const absentGeneration =
        await prisma.intelligenceComponentGeneration.findFirstOrThrow({
          where: {
            brandId,
            componentSemanticPath: "$/f/tone_traits/i/not-emitted",
          },
        });
      expect(absentGeneration.presentationOrder).toBeNull();
    });

    it("keeps current projection unchanged after a transient provider failure", async () => {
      const before = await prisma.intelligenceCurrentComponent.findMany({
        where: { brandId },
        orderBy: { componentSemanticPath: "asc" },
      });
      const failed = await run(
        output("Ignored"),
        [address("$")],
        randomUUID(),
        new BrandCommunicationProviderError("REQUEST_TIMEOUT", true),
      );
      const row = await prisma.intelligenceProcessorExecution.findUniqueOrThrow(
        {
          where: { id: failed.created.processorExecutions[0].id },
        },
      );
      expect(row.status).toBe(
        IntelligenceProcessorExecutionStatus.FAILED_TERMINAL,
      );
      expect(row.lastErrorCategory).toBe("RETRYABLE_TECHNICAL");
      const after = await prisma.intelligenceCurrentComponent.findMany({
        where: { brandId },
        orderBy: { componentSemanticPath: "asc" },
      });
      expect(after.map((item) => item.currentComponentGenerationId)).toEqual(
        before.map((item) => item.currentComponentGenerationId),
      );
    });

    it("retries a pre-persistence failure without duplicating the successful generation", async () => {
      const scope = [address("$")];
      const first = await run(
        output("Retry succeeds"),
        scope,
        randomUUID(),
        new BrandCommunicationProviderError("PROVIDER_UNAVAILABLE", true),
        2,
      );
      const processorExecutionId = first.created.processorExecutions[0].id;
      expect(
        await prisma.intelligenceProcessorExecution.findUniqueOrThrow({
          where: { id: processorExecutionId },
        }),
      ).toMatchObject({
        status: IntelligenceProcessorExecutionStatus.QUEUED,
        attemptCount: 1,
      });
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { processorExecutionId },
        }),
      ).toBe(0);

      prepared(scope);
      modelOutput = output("Retry succeeds");
      await prisma.intelligenceProcessorExecution.update({
        where: { id: processorExecutionId },
        data: { eligibleAt: new Date() },
      });
      const retried = await worker.runOnce("bi-w1.1a-retry-test", 60_000);
      expect(retried.processorExecution.status).toBe(
        IntelligenceProcessorExecutionStatus.COMPLETED,
      );
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { processorExecutionId },
        }),
      ).toBe(1);
    });
  },
);
