import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import type { ZodType } from "zod";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../../prisma/prisma.service";
import {
  ExistingOwnedWebsiteAcquisitionMechanics,
  OwnedWebsiteWave1AcquisitionService,
  type OwnedWebsitePageAcquisition,
} from "../../../data-extraction/evidence/acquisition/owned-website-wave1-acquisition.service";
import { asBrandId } from "../../../data-extraction/evidence/domain/evidence-identities";
import { DataExtractionIntelligenceEvidenceAdapter } from "../../../data-extraction/evidence/intelligence/data-extraction-intelligence-evidence.adapter";
import { OwnedWebsiteWave1NormalizationService } from "../../../data-extraction/evidence/normalization/owned-website-wave1-normalization.service";
import { serviceabilityEvidenceSchema } from "../../../data-extraction/evidence/normalization/wave2/wave2-evidence-contracts";
import { DataExtractionPersistenceService } from "../../../data-extraction/evidence/persistence/prisma-evidence-repositories";
import { DataExtractionEvidenceQueryService } from "../../../data-extraction/evidence/query/data-extraction-evidence-query.service";
import {
  StructuredEvidenceExecutionError,
  type StructuredEvidenceExecutionService,
} from "../../../data-extraction/services/structured-evidence-execution.service";
import { BundlePathOwnershipRegistry } from "../../contracts/registry/bundle-path-ownership.registry";
import { PersistenceTransitionValidator } from "../../contracts/validation/persistence-transition.validator";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { ExecutionAggregationService } from "../../execution/execution-aggregation.service";
import type { CreateIntelligenceExecutionCommand } from "../../execution/domain/intelligence-execution.types";
import { ProcessorExecutorRegistry } from "../../execution/executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "../../execution/executor/synthetic-processor.executor";
import { IntelligenceExecutionService } from "../../execution/intelligence-execution.service";
import { RetryBackoffPolicy } from "../../execution/policy/retry-backoff.policy";
import { ProcessorExecutionRepository } from "../../execution/processor-execution.repository";
import { ProcessorFinalizationService } from "../../execution/processor-finalization.service";
import { ProcessorPersistenceRouter } from "../../execution/processor-persistence.router";
import { ProcessorWorkerService } from "../../execution/processor-worker.service";
import { ExecutionContractGate } from "../../execution/registry/execution-contract.gate";
import { M1CanonicalBrandStateAdapter } from "../../input/canonical-state/m1-canonical-brand-state.adapter";
import { CanonicalStateManifestBuilder } from "../../input/canonical-state/canonical-state-manifest";
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
import { IntelligenceTransitionService } from "../../transitions/intelligence-transition.service";
import { BrandCommunicationPersistenceHook } from "../brand-communication/brand-communication-persistence.hook";
import { BrandMeaningPersistenceHook } from "../brand-meaning/brand-meaning-persistence.hook";
import { contracts } from "../visual-style/visual-style.test-fixtures";
import { StructuredServiceabilityModelProvider } from "./serviceability-model.provider";
import { ServiceabilityPersistenceHook } from "./serviceability-persistence.hook";
import { ServiceabilityProcessorExecutor } from "./serviceability-processor.executor";
import { ServiceabilityStateRepository } from "./serviceability-state.repository";
import {
  SERVICEABILITY_OBJECT,
  type ServiceabilityOutput,
} from "./serviceability.types";

const enabled = process.env.SERVICEABILITY_DATABASE_TEST === "true";
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const registryKey = {
  processorId: "serviceability_synthesis",
  processorVersion: "1.0",
  outputContractId: "serviceability_synthesis_output_contract",
  outputContractVersion: "1.0",
};
const capabilities = [
  "owned_website.serviceability_evidence",
  "owned_website.location_evidence",
] as const;
const scope = (brandId: string) => [
  {
    brandId,
    objectSemanticId: SERVICEABILITY_OBJECT,
    componentSemanticPath: "$",
    pathSchemeVersion: 1,
  },
];

describe.skipIf(!enabled)(
  "serviceability_synthesis real PostgreSQL slice",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { maxWait: 10_000, timeout: 30_000 },
    });
    const service = prisma as unknown as PrismaService;
    afterAll(async () => prisma.$disconnect());

    async function fixture(selected: readonly (typeof capabilities)[number][]) {
      const brandId = randomUUID();
      await prisma.brandProfile.create({
        data: {
          id: brandId,
          domain: `serviceability-${brandId}.example`,
          name: "Bounded service brand",
          industry: "D2C",
          countryCode: "IN",
          brandValues: [],
          policyFlags: [],
          targetAudience: {},
        },
      });
      const location = await prisma.location.create({
        data: {
          brandProfileId: brandId,
          name: "Delhi office",
          address: "10 Main Street",
          city: "Delhi",
          authority: "APPLICATION_CANONICAL",
        },
      });
      const offering = await prisma.offering.create({
        data: {
          brandProfileId: brandId,
          type: "SERVICE",
          name: "Advisory",
          url: `https://serviceability-${brandId}.example/advisory`,
          locationIds: [location.id],
        },
      });
      const mechanics = {
        acquire: vi.fn(
          async (url: string): Promise<OwnedWebsitePageAcquisition> => {
            const path = new URL(url).pathname;
            const links =
              path === "/"
                ? ["/shipping", "/locations"].map((item) =>
                    new URL(item, url).toString(),
                  )
                : [];
            const body =
              path === "/shipping"
                ? "<p>We ship to India.</p>"
                : path === "/locations"
                  ? "<address>Delhi office, 10 Main Street, Delhi</address>"
                  : "<p>Official brand website.</p>";
            return {
              url,
              html: `<html><body>${body}${links.map((item) => `<a href="${item}">More</a>`).join("")}</body></html>`,
              cleanText: body.replace(/<[^>]*>/gu, " "),
              internalLinks: links,
              quality: {
                state: "COMPLETE",
                failureCategories: [],
                detailCodes: [],
              },
              attempts: [
                {
                  providerExecutionRef: `provider:${randomUUID()}`,
                  attemptRole: "PRIMARY",
                },
              ],
              reasonCodes: [],
            };
          },
        ),
      };
      const de = new DataExtractionPersistenceService(service);
      const acquisition = new OwnedWebsiteWave1AcquisitionService(
        de,
        mechanics as unknown as ExistingOwnedWebsiteAcquisitionMechanics,
      );
      const normalization = new OwnedWebsiteWave1NormalizationService(
        de,
        service,
      );
      for (const capabilityId of selected) {
        const request = await acquisition.request({
          brandId: asBrandId(brandId),
          capabilityId,
          freshnessIntent: "REUSE_ALLOWED",
          normalizationContractVersion: "1.0",
          requestKey: randomUUID(),
          ownedWebsiteRoot: `https://serviceability-${brandId}.example/`,
        });
        await normalization.normalize({
          brandId: asBrandId(brandId),
          capabilityExecutionRef: request.capabilityExecutionRef,
        });
      }
      const runtime = contracts();
      const paths = new ComponentPathCodec();
      const ownership = new BundlePathOwnershipRegistry(runtime, paths);
      const adapter = new DataExtractionIntelligenceEvidenceAdapter(
        new DataExtractionEvidenceQueryService(de),
      );
      const dependencies = new ProcessorDependencyPreparationService(
        runtime,
        new ProcessorDependencyProfileRegistry(),
        new M1CanonicalBrandStateAdapter(service),
        adapter,
        new CanonicalStateManifestBuilder(),
        new EvidenceManifestBuilder(),
        new ProcessorDependencyReadinessEvaluator(),
      );
      const activeScope = scope(brandId);
      const prepared = await dependencies.prepare({
        brandId,
        registryKey,
        activeScope,
      });
      const support = prepared.evidence.capabilityResults
        .find((item) => item.capabilityId === capabilities[0])
        ?.evidence.find((item) => {
          const parsed = serviceabilityEvidenceSchema.safeParse(
            item.boundedNormalizedPayload,
          );
          return (
            parsed.success &&
            parsed.data.geography_assertions.some(
              (assertion) =>
                assertion.polarity === "SUPPORTED" &&
                assertion.scope === "COUNTRY" &&
                assertion.country_code === "IN",
            )
          );
        });
      const metadata = (semantic_id?: string) => ({
        ...(semantic_id ? { semantic_id } : {}),
        authority: "CREATOR_SHOP_DERIVED" as const,
        source_class: "OWNED_WEBSITE" as const,
        freshness: "CURRENT" as const,
        evidence_refs: support ? [support.evidenceRef] : [],
        business_state_refs: null,
      });
      let output: ServiceabilityOutput = support
        ? {
            serviceability_profile: {
              overall_scope: "COUNTRY",
              coverage_is_heterogeneous: false,
              serviceable_markets: [
                {
                  semantic_id: "country:IN",
                  scope: "COUNTRY",
                  label: "India",
                  country_code: "IN",
                  locality: null,
                  region: null,
                  radius_km: null,
                },
              ],
              serviceability_basis: [
                {
                  semantic_id: "shipping:india",
                  basis_type: "SHIPPING_OR_DELIVERY_POLICY",
                  business_state_refs: null,
                  evidence_refs: [support.evidenceRef],
                  applies_to_market_refs: ["country:IN"],
                  offering_refs: null,
                },
              ],
              mixed_coverage_note: null,
            },
            output_metadata: {
              overall_scope: metadata(),
              coverage_is_heterogeneous: metadata(),
              serviceable_markets: [metadata("country:IN")],
              serviceability_basis: [metadata("shipping:india")],
              mixed_coverage_note: null,
            },
          }
        : {
            serviceability_profile: null,
            output_metadata: {
              overall_scope: null,
              coverage_is_heterogeneous: null,
              serviceable_markets: null,
              serviceability_basis: null,
              mixed_coverage_note: null,
            },
          };
      const dispatch = vi.fn(
        async (args: { outputSchema: ZodType<unknown> }) => {
          const parsed = args.outputSchema.safeParse(output);
          if (!parsed.success)
            throw new StructuredEvidenceExecutionError(
              "STRUCTURED_OUTPUT_INVALID",
              1,
            );
          return { payload: parsed.data, telemetry: { attemptCount: 1 } };
        },
      );
      const model = new StructuredServiceabilityModelProvider(
        { execute: dispatch } as unknown as StructuredEvidenceExecutionService,
        new ConfigService(),
      );
      const catalogue = new ServiceabilityStateRepository(service);
      const executor = new ServiceabilityProcessorExecutor(
        dependencies,
        runtime,
        catalogue,
        new StructuralValidator(),
        new SemanticValidator(),
        model,
      );
      const executors = new ProcessorExecutorRegistry(
        new SyntheticProcessorExecutor(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        executor,
      );
      const aggregation = new ExecutionAggregationService();
      const retry = new RetryBackoffPolicy();
      const repository = new ProcessorExecutionRepository(
        service,
        aggregation,
        retry,
      );
      const finalization = new ProcessorFinalizationService(
        service,
        repository,
        aggregation,
        retry,
      );
      const executions = new IntelligenceExecutionService(
        service,
        new ExecutionContractGate(runtime, executors),
        ownership,
        paths,
      );
      const current = new IntelligenceCurrentStateRepository(service);
      const generations = new IntelligenceGenerationRepository(service, paths);
      const transitions = new IntelligenceTransitionService(
        service,
        current,
        new IntelligenceCandidateRepository(service),
        new IntelligenceActionRepository(service),
        paths,
      );
      const validator = new PersistenceTransitionValidator(runtime, ownership);
      const hook = new ServiceabilityPersistenceHook(
        generations,
        current,
        transitions,
        validator,
        catalogue,
      );
      const router = new ProcessorPersistenceRouter(
        new BrandCommunicationPersistenceHook(
          generations,
          current,
          transitions,
          validator,
          paths,
        ),
        new BrandMeaningPersistenceHook(
          generations,
          current,
          transitions,
          validator,
        ),
        undefined,
        undefined,
        undefined,
        undefined,
        hook,
      );
      const worker = new ProcessorWorkerService(
        repository,
        finalization,
        executors,
        router,
      );
      const projection = new IntelligenceCurrentProjectionService(
        new IntelligenceCurrentProjectionRepository(service),
        new IntelligenceCurrentContractScopeService(runtime, ownership, paths),
        new IntelligenceObjectAssembler(paths),
      );
      async function run(next = output) {
        output = next;
        const input = await dependencies.prepare({
          brandId,
          registryKey,
          activeScope,
        });
        const key = randomUUID();
        const command: CreateIntelligenceExecutionCommand = {
          brandId,
          triggerType: "SERVICEABILITY_TEST",
          triggerRef: key,
          triggerIdempotencyKey: key,
          correlationRef: key,
          requestedImpact: { objects: [SERVICEABILITY_OBJECT] },
          processors: [
            {
              registryKey,
              activeScope,
              dependencyManifest:
                input.dependencyManifest as unknown as Prisma.InputJsonValue,
              evidenceManifest:
                input.evidenceManifest as unknown as Prisma.InputJsonValue,
              executionIntentKey: key,
              maxAttempts: 1,
              dependencyEligible: input.dependencyEligible,
            },
          ],
        };
        const created = await executions.createOrReturn(command);
        const result = input.dependencyEligible
          ? await worker.runOnce("serviceability-test", 60_000)
          : null;
        return { created, result, input };
      }
      return {
        brandId,
        location,
        offering,
        prepared,
        adapter,
        dispatch,
        run,
        projection,
      };
    }

    it("runs real DE through W1 persistence while canonical Location and Offering stay read-only", async () => {
      const f = await fixture(capabilities);
      expect(f.prepared.dependencyEligible).toBe(true);
      expect(f.prepared.canonicalState.serviceabilityState).toMatchObject({
        offeringAvailabilityReferences: [],
        offeringLocationReferences: [],
      });
      const before = {
        location: await prisma.location.findUniqueOrThrow({
          where: { id: f.location.id },
        }),
        offering: await prisma.offering.findUniqueOrThrow({
          where: { id: f.offering.id },
        }),
      };
      const completed = await f.run();
      expect(
        completed.result?.processorExecution.status,
        completed.result?.processorExecution.lastErrorCode ?? undefined,
      ).toBe("COMPLETED");
      expect(f.dispatch).toHaveBeenCalledOnce();
      expect(
        (
          await f.projection.readObject({
            brandId: f.brandId,
            objectSemanticId: SERVICEABILITY_OBJECT,
          })
        ).assembledValue.value,
      ).toMatchObject({ overall_scope: "COUNTRY" });
      expect({
        location: await prisma.location.findUniqueOrThrow({
          where: { id: f.location.id },
        }),
        offering: await prisma.offering.findUniqueOrThrow({
          where: { id: f.offering.id },
        }),
      }).toEqual(before);
      expect(
        await prisma.intelligenceBusinessStateReference.findMany({
          where: { objectGeneration: { brandId: f.brandId } },
        }),
      ).toEqual([]);
    });

    it("keeps both lineages mandatory and does not call the provider without serviceability support", async () => {
      const onlyLocation = await fixture([capabilities[1]]);
      expect(onlyLocation.prepared.dependencyEligible).toBe(false);
      expect(onlyLocation.prepared.readiness.readiness).toBe(
        "WAITING_FOR_EVIDENCE",
      );
      const result = await onlyLocation.run();
      expect(result.result).toBeNull();
      expect(onlyLocation.dispatch).not.toHaveBeenCalled();
    });
  },
);
