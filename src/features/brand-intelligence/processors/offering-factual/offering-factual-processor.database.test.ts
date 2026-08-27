import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import {
  IntelligenceAuthority,
  IntelligenceProtectionState,
  PrismaClient,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../../prisma/prisma.service";
import { ProcessorRuntimeProjectionService } from "../../../brand-centre/consumer/processor-runtime-projection.service";
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
import { ProcessorExecutorRegistry } from "../../execution/executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "../../execution/executor/synthetic-processor.executor";
import { IntelligenceExecutionService } from "../../execution/intelligence-execution.service";
import { RetryBackoffPolicy } from "../../execution/policy/retry-backoff.policy";
import { ProcessorExecutionRepository } from "../../execution/processor-execution.repository";
import { ProcessorFinalizationService } from "../../execution/processor-finalization.service";
import { ProcessorWorkerService } from "../../execution/processor-worker.service";
import { ExecutionContractGate } from "../../execution/registry/execution-contract.gate";
import { CanonicalStateManifestBuilder } from "../../input/canonical-state/canonical-state-manifest";
import { M1CanonicalBrandStateAdapter } from "../../input/canonical-state/m1-canonical-brand-state.adapter";
import { ProcessorDependencyPreparationService } from "../../input/dependency/processor-dependency-preparation.service";
import { ProcessorDependencyProfileRegistry } from "../../input/dependency/processor-dependency-profile.registry";
import { ProcessorDependencyReadinessEvaluator } from "../../input/dependency/processor-dependency-readiness.evaluator";
import { EvidenceManifestBuilder } from "../../input/evidence/evidence-manifest";
import { IntelligenceActionRepository } from "../../persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "../../persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "../../persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "../../persistence/intelligence-generation.repository";
import { IntelligenceCurrentContractScopeService } from "../../projection/intelligence-current-contract-scope.service";
import { IntelligenceCurrentProjectionRepository } from "../../projection/intelligence-current-projection.repository";
import { IntelligenceCurrentProjectionService } from "../../projection/intelligence-current-projection.service";
import { IntelligenceObjectAssembler } from "../../projection/intelligence-object-assembler";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import { resolveIntelligenceSubject } from "../../subject/intelligence-subject.resolver";
import { IntelligenceTransitionService } from "../../transitions/intelligence-transition.service";
import {
  OfferingFactualProviderError,
  type OfferingFactualModelProvider,
  type OfferingFactualModelRequest,
} from "./offering-factual-model.provider";
import { OfferingFactualPersistenceHook } from "./offering-factual-persistence.hook";
import { OfferingFactualProcessorExecutor } from "./offering-factual-processor.executor";

const databaseUrl = process.env.PRODUCT_INTELLIGENCE_DATABASE_TEST_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

const registryKey = {
  processorId: "offering_factual_synthesis",
  processorVersion: "1.0",
  outputContractId: "offering_factual_synthesis_output_contract",
  outputContractVersion: "1.0",
} as const;

class ProductOfferingMechanics implements OwnedWebsitePageAcquisitionMechanics {
  constructor(
    private readonly offeringAPath: string,
    private readonly offeringBPath: string,
    private readonly revisions: Readonly<Record<string, string>>,
  ) {}

  async acquire(url: string): Promise<OwnedWebsitePageAcquisition> {
    const path = new URL(url).pathname;
    const text =
      path === this.offeringAPath
        ? this.revisions.A
        : path === this.offeringBPath
          ? this.revisions.B
          : "A bounded owned product catalogue.";
    return {
      url,
      html: `<main><p>${text}</p></main>`,
      cleanText: text,
      internalLinks: [],
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

describePostgres(
  "offering_factual_synthesis real PostgreSQL vertical slice",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { maxWait: 10_000, timeout: 20_000 },
    });
    const prismaService = prisma as unknown as PrismaService;
    const brandId = randomUUID();
    const foreignBrandId = randomUUID();
    const rootUrl = `https://product-p3-${randomUUID()}.example/`;
    const offeringAPath = "/products/offering-a";
    const offeringBPath = "/products/offering-b";
    let offeringA = "";
    let offeringB = "";
    let foreignOffering = "";
    const revisions = {
      A: "Offering A is a reusable stainless-steel bottle with a 750 ml capacity.",
      B: "Offering B is a separate blue cotton tote bag with reinforced handles.",
    };
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
    const dePersistence = new DataExtractionPersistenceService(prismaService);
    const deAdapter = new DataExtractionIntelligenceEvidenceAdapter(
      new DataExtractionEvidenceQueryService(dePersistence),
    );
    const dependencies = new ProcessorDependencyPreparationService(
      contracts,
      new ProcessorDependencyProfileRegistry(),
      new M1CanonicalBrandStateAdapter(prismaService),
      deAdapter,
      new CanonicalStateManifestBuilder(),
      new EvidenceManifestBuilder(),
      new ProcessorDependencyReadinessEvaluator(),
    );
    let failNext = false;
    let staleNext = false;
    const labels = new Map<string, string>();
    const provider: OfferingFactualModelProvider = {
      generate: vi.fn(async (request: OfferingFactualModelRequest) => {
        if (failNext) {
          failNext = false;
          throw new OfferingFactualProviderError("PROVIDER_UNAVAILABLE", true);
        }
        const requestSubject = request.approvedContext.subject as Readonly<
          Record<string, unknown>
        >;
        const offeringRef = String(requestSubject.offeringRef);
        if (staleNext && offeringRef === offeringA) {
          staleNext = false;
          revisions.A = `${revisions.A} Updated during provider execution.`;
          await exactEvidence(offeringA, offeringAPath, "FORCE_RECAPTURE");
        }
        const canonicalOffering = (
          request.approvedContext.canonicalOffering as readonly Readonly<
            Record<string, unknown>
          >[]
        )[0];
        const businessRef = String(canonicalOffering.businessStateRef);
        const evidenceRef = request.evidenceRefs[0];
        const meta = {
          authority: "OBSERVED",
          source_class: "OWNED_WEBSITE",
          freshness: "CURRENT",
          evidence_refs: [evidenceRef],
          business_state_refs: [businessRef],
        };
        const label = labels.get(offeringRef) ?? "initial";
        return {
          output: {
            offering_factual_profile: {
              factual_summary: `${String(canonicalOffering.name)} grounded factual profile ${label}.`,
              key_facts: [
                {
                  semantic_id: "primary-material-and-form",
                  fact:
                    offeringRef === offeringA
                      ? "A stainless-steel bottle with 750 ml capacity."
                      : "A blue cotton tote with reinforced handles.",
                },
              ],
              key_benefits: null,
              proof_points: null,
              usage_context: null,
              customer_context: null,
            },
            output_metadata: {
              factual_summary: meta,
              key_facts: [
                { semantic_id: "primary-material-and-form", ...meta },
              ],
              key_benefits: null,
              proof_points: null,
              usage_context: null,
              customer_context: null,
            },
          },
          providerAttemptCount: 1,
        };
      }),
    };
    const executor = new OfferingFactualProcessorExecutor(
      prismaService,
      dependencies,
      contracts,
      new StructuralValidator(),
      semantic,
      provider,
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
    const hook = new OfferingFactualPersistenceHook(
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
    const runtimeProjection = new ProcessorRuntimeProjectionService(
      prismaService,
    );

    async function scope(offeringRef: string) {
      const subject = await resolveIntelligenceSubject(prismaService, brandId, {
        type: "OFFERING",
        ref: offeringRef,
      });
      return [
        "$",
        "$/f/factual_summary",
        "$/f/key_facts/i/primary-material-and-form",
      ].map((componentSemanticPath) => ({
        brandId,
        subjectId: subject.id,
        objectSemanticId: "offering_factual_profile",
        pathSchemeVersion: 1,
        componentSemanticPath,
      }));
    }

    async function exactEvidence(
      offeringRef: string,
      path: string,
      freshnessIntent: "REUSE_ALLOWED" | "FORCE_RECAPTURE" = "REUSE_ALLOWED",
    ) {
      const acquisition = new OwnedWebsiteWave1AcquisitionService(
        dePersistence,
        new ProductOfferingMechanics(offeringAPath, offeringBPath, revisions),
      );
      const normalization = new OwnedWebsiteWave1NormalizationService(
        dePersistence,
        prismaService,
      );
      const resourceUrl = new URL(path, rootUrl).toString();
      const acquired = await acquisition.request({
        brandId: asBrandId(brandId),
        capabilityId: "owned_website.offering_context",
        freshnessIntent,
        normalizationContractVersion: "1.0",
        requestKey: `p3:${offeringRef}:${randomUUID()}`,
        ownedWebsiteRoot: rootUrl,
        exactOfferingScope: {
          canonicalOfferingRef: offeringRef,
          resourceUrls: [resourceUrl],
        },
      });
      const exact = acquired.exactOfferingResources![0];
      await normalization.normalize({
        brandId: asBrandId(brandId),
        capabilityExecutionRef: acquired.capabilityExecutionRef,
        exactOfferingScope: {
          canonicalOfferingRef: offeringRef,
          captureRefs: [exact.captureRef],
        },
      });
      return acquired;
    }

    async function createExecution(offeringRef: string, maxAttempts = 1) {
      const activeScope = await scope(offeringRef);
      const prepared = await dependencies.prepare({
        brandId,
        registryKey,
        activeScope,
        subject: { type: "OFFERING", ref: offeringRef },
      });
      const trigger = randomUUID();
      const created = await executionService.createOrReturn({
        brandId,
        subject: { type: "OFFERING", ref: offeringRef },
        triggerType: "PRODUCT_P3_TEST",
        triggerRef: `product:${trigger}`,
        triggerIdempotencyKey: trigger,
        correlationRef: `correlation:${trigger}`,
        requestedImpact: { objectSemanticId: "offering_factual_profile" },
        processors: [
          {
            registryKey,
            activeScope,
            dependencyManifest: prepared.dependencyManifest,
            evidenceManifest: prepared.evidenceManifest,
            executionIntentKey: `offering-factual:${offeringRef}:${trigger}`,
            maxAttempts,
            dependencyEligible: prepared.dependencyEligible,
          },
        ],
      });
      return { created, prepared };
    }

    async function run(offeringRef: string, maxAttempts = 1) {
      const value = await createExecution(offeringRef, maxAttempts);
      if (!value.prepared.dependencyEligible) return value;
      const result = await worker.runOnce(`product-p3-${randomUUID()}`, 60_000);
      return { ...value, result };
    }

    beforeAll(async () => {
      await prisma.$connect();
      await prisma.brandProfile.createMany({
        data: [
          {
            id: brandId,
            domain: new URL(rootUrl).host,
            name: "Product P3 Brand",
            industry: "D2C",
            brandValues: [],
            policyFlags: [],
          },
          {
            id: foreignBrandId,
            domain: `foreign-${randomUUID()}.example`,
            name: "Foreign Product Brand",
            industry: "D2C",
            brandValues: [],
            policyFlags: [],
          },
        ],
      });
      const [a, b, foreign] = await Promise.all([
        prisma.offering.create({
          data: {
            brandProfileId: brandId,
            type: "PRODUCT",
            canonicalKind: "PRODUCT",
            canonicalLifecycle: "ACTIVE",
            name: "Offering A",
            description: "A reusable bottle.",
            url: new URL(offeringAPath, rootUrl).toString(),
            locationIds: [],
            sellingPoints: [],
            doNotSay: [],
          },
        }),
        prisma.offering.create({
          data: {
            brandProfileId: brandId,
            type: "PRODUCT",
            canonicalKind: "PRODUCT",
            canonicalLifecycle: "ACTIVE",
            name: "Offering B",
            description: "A cotton tote.",
            url: new URL(offeringBPath, rootUrl).toString(),
            locationIds: [],
            sellingPoints: [],
            doNotSay: [],
          },
        }),
        prisma.offering.create({
          data: {
            brandProfileId: foreignBrandId,
            type: "PRODUCT",
            canonicalKind: "PRODUCT",
            canonicalLifecycle: "ACTIVE",
            name: "Foreign Offering",
            url: `https://foreign.example/product`,
            locationIds: [],
            sellingPoints: [],
            doNotSay: [],
          },
        }),
      ]);
      offeringA = a.id;
      offeringB = b.id;
      foreignOffering = foreign.id;
    });

    afterAll(async () => prisma.$disconnect());

    it("waits without provider, then executes A/B independently with exact DE and current isolation", async () => {
      const waiting = await createExecution(offeringA);
      expect(waiting.prepared.readiness).toMatchObject({
        readiness: "WAITING_FOR_EVIDENCE",
      });
      expect(waiting.created.processorExecutions[0].status).toBe(
        "WAITING_FOR_DEPENDENCY",
      );
      expect(provider.generate).not.toHaveBeenCalled();

      // Acquisition shares one canonical owned-site root resource; serialize the
      // fixture setup, then exercise concurrency at the Product runtime boundary.
      const aEvidence = await exactEvidence(offeringA, offeringAPath);
      const bEvidence = await exactEvidence(offeringB, offeringBPath);
      const aExecution = await createExecution(offeringA);
      const bExecution = await createExecution(offeringB);
      expect(aExecution.prepared.dependencyEligible).toBe(true);
      expect(bExecution.prepared.dependencyEligible).toBe(true);
      expect(JSON.stringify(aExecution.prepared.evidence)).not.toContain(
        offeringB,
      );
      expect(JSON.stringify(bExecution.prepared.evidence)).not.toContain(
        offeringA,
      );
      const claims = [
        await worker.runOnce("product-p3-concurrent-a", 60_000),
        await worker.runOnce("product-p3-concurrent-b", 60_000),
      ];
      expect(claims.map((item) => item.processorExecution.status)).toEqual([
        "COMPLETED",
        "COMPLETED",
      ]);
      const [aProjection, bProjection] = await Promise.all([
        projection.readObject({
          brandId,
          subject: { type: "OFFERING", ref: offeringA },
          objectSemanticId: "offering_factual_profile",
        }),
        projection.readObject({
          brandId,
          subject: { type: "OFFERING", ref: offeringB },
          objectSemanticId: "offering_factual_profile",
        }),
      ]);
      expect(aProjection.subjectId).not.toBe(bProjection.subjectId);
      expect(aProjection.objectState).toBe("CURRENT");
      expect(bProjection.objectState).toBe("CURRENT");
      expect(aProjection.consumerReadiness).toBe("PARTIAL");
      expect(JSON.stringify(aProjection)).toContain("Offering A");
      expect(JSON.stringify(aProjection)).not.toContain("Offering B");
      expect(JSON.stringify(bProjection)).toContain("Offering B");
      expect(JSON.stringify(bProjection)).not.toContain("Offering A");
      const aGeneration =
        await prisma.intelligenceObjectGeneration.findFirstOrThrow({
          where: {
            brandId,
            subjectId: aProjection.subjectId,
            objectSemanticId: "offering_factual_profile",
          },
          include: { evidenceReferences: true, businessStateReferences: true },
        });
      expect(aGeneration.evidenceReferences.length).toBeGreaterThan(0);
      expect(aGeneration.businessStateReferences).toEqual([
        expect.objectContaining({
          entityType: "Offering",
          entityId: offeringA,
          revisionKind: "SNAPSHOT_FINGERPRINT",
        }),
        expect.objectContaining({
          entityType: "Offering",
          entityId: offeringA,
          revisionKind: "SNAPSHOT_FINGERPRINT",
        }),
        expect.objectContaining({
          entityType: "Offering",
          entityId: offeringA,
          revisionKind: "SNAPSHOT_FINGERPRINT",
        }),
      ]);
      const manifest = aExecution.created.processorExecutions[0]
        .evidenceManifest as Record<string, unknown>;
      expect(JSON.stringify(manifest)).toContain(
        aEvidence.capabilityExecutionRef,
      );
      expect(JSON.stringify(manifest)).not.toContain(
        bEvidence.capabilityExecutionRef,
      );
    }, 30_000);

    it("refreshes immutably, preserves current on failure, and rejects stale completion", async () => {
      const subject = await resolveIntelligenceSubject(prismaService, brandId, {
        type: "OFFERING",
        ref: offeringA,
      });
      const before = await prisma.intelligenceCurrentComponent.findFirstOrThrow(
        {
          where: {
            brandId,
            subjectId: subject.id,
            objectSemanticId: "offering_factual_profile",
            componentSemanticPath: "$/f/factual_summary",
          },
        },
      );
      labels.set(offeringA, "refresh-2");
      revisions.A = `${revisions.A} It has a leak-resistant screw cap.`;
      await exactEvidence(offeringA, offeringAPath, "FORCE_RECAPTURE");
      const refreshed = await run(offeringA);
      expect(refreshed.result!.processorExecution.status).toBe("COMPLETED");
      const after = await prisma.intelligenceCurrentComponent.findUniqueOrThrow(
        {
          where: { id: before.id },
        },
      );
      expect(after.currentComponentGenerationId).not.toBe(
        before.currentComponentGenerationId,
      );
      expect(after.revision).toBe(before.revision + 1n);
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: {
            brandId,
            subjectId: subject.id,
            objectSemanticId: "offering_factual_profile",
          },
        }),
      ).toBe(2);

      failNext = true;
      await exactEvidence(offeringA, offeringAPath, "FORCE_RECAPTURE");
      const failed = await run(offeringA);
      expect(failed.result!.processorExecution.status).toBe("FAILED_TERMINAL");
      expect(
        (
          await prisma.intelligenceCurrentComponent.findUniqueOrThrow({
            where: { id: before.id },
          })
        ).currentComponentGenerationId,
      ).toBe(after.currentComponentGenerationId);

      const generationsBeforeStale =
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId, subjectId: subject.id },
        });
      staleNext = true;
      const stale = await run(offeringA);
      expect(stale.result!.processorExecution.status).toBe("FAILED_TERMINAL");
      expect(stale.result!.processorExecution.lastErrorCode).toBe(
        "ATTEMPT_EXHAUSTED",
      );
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId, subjectId: subject.id },
        }),
      ).toBe(generationsBeforeStale);
    }, 30_000);

    it("retains protected A truth as a candidate and isolates candidate/runtime/Brand scope", async () => {
      const [subjectA, subjectB] = await Promise.all([
        resolveIntelligenceSubject(prismaService, brandId, {
          type: "OFFERING",
          ref: offeringA,
        }),
        resolveIntelligenceSubject(prismaService, brandId, {
          type: "OFFERING",
          ref: offeringB,
        }),
      ]);
      const protectedCurrent =
        await prisma.intelligenceCurrentComponent.findFirstOrThrow({
          where: {
            brandId,
            subjectId: subjectA.id,
            objectSemanticId: "offering_factual_profile",
            componentSemanticPath: "$/f/factual_summary",
          },
        });
      await prisma.intelligenceCurrentComponent.update({
        where: { id: protectedCurrent.id },
        data: {
          currentAuthority: IntelligenceAuthority.BRAND_CONFIRMED,
          protectionState: IntelligenceProtectionState.BRAND_CONFIRMED,
        },
      });
      labels.set(offeringA, "protected-conflict");
      revisions.A = `${revisions.A} Brand-confirmed comparison candidate.`;
      await exactEvidence(offeringA, offeringAPath, "FORCE_RECAPTURE");
      const candidateRun = await run(offeringA);
      expect(candidateRun.result!.processorExecution.status).toBe("COMPLETED");
      const preserved =
        await prisma.intelligenceCurrentComponent.findUniqueOrThrow({
          where: { id: protectedCurrent.id },
        });
      expect(preserved.currentComponentGenerationId).toBe(
        protectedCurrent.currentComponentGenerationId,
      );
      expect(
        await prisma.intelligenceComponentCandidate.count({
          where: {
            brandId,
            subjectId: subjectA.id,
            componentSemanticPath: "$/f/factual_summary",
            status: "PENDING",
          },
        }),
      ).toBe(1);
      expect(
        await prisma.intelligenceComponentCandidate.count({
          where: { brandId, subjectId: subjectB.id },
        }),
      ).toBe(0);
      const [runtimeA, runtimeB] = await Promise.all([
        runtimeProjection.readExact(
          brandId,
          subjectA.id,
          "offering_factual_synthesis",
          true,
        ),
        runtimeProjection.readExact(
          brandId,
          subjectB.id,
          "offering_factual_synthesis",
          true,
        ),
      ]);
      expect(runtimeA.latestExecutionStatus).toBe("COMPLETED");
      expect(runtimeB.latestExecutionStatus).toBe("COMPLETED");
      expect(runtimeA.processorId).toBe("offering_factual_synthesis");
      await expect(
        dependencies.prepare({
          brandId,
          registryKey,
          activeScope: await scope(offeringA),
          subject: { type: "OFFERING", ref: foreignOffering },
        }),
      ).rejects.toThrow();
    }, 30_000);
  },
);
