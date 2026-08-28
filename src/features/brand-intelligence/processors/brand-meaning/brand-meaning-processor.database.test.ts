import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import {
  PrismaClient,
  type Prisma,
  type IntelligenceProtectionState,
} from "@prisma/client";
import type { CreateIntelligenceExecutionCommand } from "../../execution/domain/intelligence-execution.types";
import type { ZodType } from "zod";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../../prisma/prisma.service";
import {
  ExistingOwnedWebsiteAcquisitionMechanics,
  OwnedWebsiteWave1AcquisitionService,
  type OwnedWebsitePageAcquisition,
} from "../../../data-extraction/evidence/acquisition/owned-website-wave1-acquisition.service";
import { asBrandId } from "../../../data-extraction/evidence/domain/evidence-identities";
import { DataExtractionPersistenceService } from "../../../data-extraction/evidence/persistence/prisma-evidence-repositories";
import { OwnedWebsiteWave1NormalizationService } from "../../../data-extraction/evidence/normalization/owned-website-wave1-normalization.service";
import { DataExtractionEvidenceQueryService } from "../../../data-extraction/evidence/query/data-extraction-evidence-query.service";
import { DataExtractionIntelligenceEvidenceAdapter } from "../../../data-extraction/evidence/intelligence/data-extraction-intelligence-evidence.adapter";
import {
  StructuredEvidenceExecutionService,
  StructuredEvidenceExecutionError,
} from "../../../data-extraction/services/structured-evidence-execution.service";
import { BundlePathOwnershipRegistry } from "../../contracts/registry/bundle-path-ownership.registry";
import { PersistenceTransitionValidator } from "../../contracts/validation/persistence-transition.validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { ExecutionAggregationService } from "../../execution/execution-aggregation.service";
import { RetryBackoffPolicy } from "../../execution/policy/retry-backoff.policy";
import { ProcessorExecutionRepository } from "../../execution/processor-execution.repository";
import { ProcessorFinalizationService } from "../../execution/processor-finalization.service";
import { ProcessorWorkerService } from "../../execution/processor-worker.service";
import { IntelligenceExecutionService } from "../../execution/intelligence-execution.service";
import { ExecutionContractGate } from "../../execution/registry/execution-contract.gate";
import { ProcessorExecutorRegistry } from "../../execution/executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "../../execution/executor/synthetic-processor.executor";
import { ProcessorPersistenceRouter } from "../../execution/processor-persistence.router";
import { M1CanonicalBrandStateAdapter } from "../../input/canonical-state/m1-canonical-brand-state.adapter";
import { CanonicalStateManifestBuilder } from "../../input/canonical-state/canonical-state-manifest";
import { EvidenceManifestBuilder } from "../../input/evidence/evidence-manifest";
import { ProcessorDependencyPreparationService } from "../../input/dependency/processor-dependency-preparation.service";
import { ProcessorDependencyProfileRegistry } from "../../input/dependency/processor-dependency-profile.registry";
import { ProcessorDependencyReadinessEvaluator } from "../../input/dependency/processor-dependency-readiness.evaluator";
import { IntelligenceGenerationRepository } from "../../persistence/intelligence-generation.repository";
import { IntelligenceCurrentStateRepository } from "../../persistence/intelligence-current-state.repository";
import { IntelligenceCandidateRepository } from "../../persistence/intelligence-candidate.repository";
import { IntelligenceActionRepository } from "../../persistence/intelligence-action.repository";
import { IntelligenceTransitionService } from "../../transitions/intelligence-transition.service";
import { IntelligenceCurrentProjectionService } from "../../projection/intelligence-current-projection.service";
import { IntelligenceCurrentProjectionRepository } from "../../projection/intelligence-current-projection.repository";
import { IntelligenceCurrentContractScopeService } from "../../projection/intelligence-current-contract-scope.service";
import { IntelligenceObjectAssembler } from "../../projection/intelligence-object-assembler";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import { BrandCommunicationPersistenceHook } from "../brand-communication/brand-communication-persistence.hook";
import { BrandMeaningPersistenceHook } from "./brand-meaning-persistence.hook";
import { StructuredBrandMeaningModelProvider } from "./brand-meaning-model.provider";
import {
  BRAND_MEANING_OBJECTS,
  BrandMeaningProcessorExecutor,
  type BrandMeaningObject,
  type BrandMeaningOutput,
} from "./brand-meaning-processor.executor";
import {
  capabilities,
  contracts,
  meaningOutput,
  registryKey,
  scope,
} from "./brand-meaning.test-fixtures";

const enabled = process.env.BRAND_MEANING_DATABASE_TEST === "true";
describe.skipIf(!enabled)(
  "brand_meaning real PostgreSQL vertical slice",
  () => {
    const prisma = new PrismaClient();
    const service = prisma as unknown as PrismaService;
    afterAll(async () => {
      await prisma.$disconnect();
    });

    async function fixture(acquire = true) {
      const brandId = randomUUID();
      await prisma.brandProfile.create({
        data: {
          id: brandId,
          domain: `meaning-${brandId}.example`,
          name: "Creator partnership tools",
          industry: "D2C",
          subIndustry: null,
          brandValues: [],
          policyFlags: [],
          targetAudience: {},
        },
      });
      const mechanics = {
        acquire: vi.fn(
          async (url: string): Promise<OwnedWebsitePageAcquisition> => {
            const pathname = new URL(url).pathname;
            const text =
              pathname === "/about"
                ? "We are a creator commerce platform serving independent brands. Our mission is to support creators with transparent partnerships."
                : pathname === "/products"
                  ? "Starter plan for small teams. Pro plan for growing teams. Enterprise plan for larger organizations."
                  : "We help creators grow with better brand partnerships. Our platform helps independent brands coordinate transparent partnerships.";
            const links =
              pathname === "/"
                ? [
                    new URL("/about", url).toString(),
                    new URL("/products", url).toString(),
                  ]
                : [];
            return {
              url,
              html: `<html lang="en"><body><main>${text}</main>${links.map((link) => `<a href="${link}">${link}</a>`).join("")}</body></html>`,
              cleanText: text,
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
      // Only the external page mechanic is replaced; D/E/F are production services.
      const acquisition = new OwnedWebsiteWave1AcquisitionService(
        de,
        mechanics as unknown as ExistingOwnedWebsiteAcquisitionMechanics,
      );
      const normalization = new OwnedWebsiteWave1NormalizationService(
        de,
        service,
      );
      if (acquire)
        for (const capabilityId of capabilities) {
          const request = await acquisition.request({
            brandId: asBrandId(brandId),
            capabilityId,
            freshnessIntent: "REUSE_ALLOWED",
            normalizationContractVersion: "1.0",
            requestKey: randomUUID(),
            ownedWebsiteRoot: `https://meaning-${brandId}.example/`,
          });
          await normalization.normalize({
            brandId: asBrandId(brandId),
            capabilityExecutionRef: request.capabilityExecutionRef,
          });
        }
      const registry = contracts();
      const paths = new ComponentPathCodec();
      const ownership = new BundlePathOwnershipRegistry(registry, paths);
      const canonical = new M1CanonicalBrandStateAdapter(service);
      const adapter = new DataExtractionIntelligenceEvidenceAdapter(
        new DataExtractionEvidenceQueryService(de),
      );
      const dependencies = new ProcessorDependencyPreparationService(
        registry,
        new ProcessorDependencyProfileRegistry(),
        canonical,
        adapter,
        new CanonicalStateManifestBuilder(),
        new EvidenceManifestBuilder(),
        new ProcessorDependencyReadinessEvaluator(),
      );
      const prepared = await dependencies.prepare({
        brandId,
        registryKey,
        activeScope: scope(brandId),
      });
      let output: unknown = acquire ? meaningOutput(prepared.evidence) : null;
      let nextError: Error | undefined;
      const dispatch = vi.fn(
        async (args: { outputSchema: ZodType<unknown> }) => {
          if (nextError) {
            const error = nextError;
            nextError = undefined;
            throw error;
          }
          const parsed = args.outputSchema.safeParse(output);
          if (!parsed.success)
            throw new StructuredEvidenceExecutionError(
              "STRUCTURED_OUTPUT_INVALID",
              1,
            );
          return { payload: parsed.data, telemetry: { attemptCount: 1 } };
        },
      );
      // Fake is behind the real processor-owned provider adapter; it applies the
      // actual provider schema, including nullable referenced metadata.
      const model = new StructuredBrandMeaningModelProvider(
        { execute: dispatch } as unknown as StructuredEvidenceExecutionService,
        new ConfigService(),
      );
      const executor = new BrandMeaningProcessorExecutor(
        dependencies,
        registry,
        new StructuralValidator(),
        new SemanticValidator(),
        model,
      );
      const executors = new ProcessorExecutorRegistry(
        new SyntheticProcessorExecutor(),
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
        new ExecutionContractGate(registry, executors),
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
      const validator = new PersistenceTransitionValidator(registry, ownership);
      const meaning = new BrandMeaningPersistenceHook(
        generations,
        current,
        transitions,
        validator,
      );
      const communication = new BrandCommunicationPersistenceHook(
        generations,
        current,
        transitions,
        validator,
        paths,
      );
      const router = new ProcessorPersistenceRouter(communication, meaning);
      const worker = new ProcessorWorkerService(
        repository,
        finalization,
        executors,
        router,
      );
      const projection = new IntelligenceCurrentProjectionService(
        new IntelligenceCurrentProjectionRepository(service),
        new IntelligenceCurrentContractScopeService(registry, ownership, paths),
        new IntelligenceObjectAssembler(paths),
      );
      async function run(
        value: unknown,
        maxAttempts = 1,
        error?: Error,
        only: readonly BrandMeaningObject[] = BRAND_MEANING_OBJECTS,
      ) {
        output = value;
        nextError = error;
        const activeScope = scope(brandId).filter((address) =>
          only.includes(address.objectSemanticId),
        );
        const input = await dependencies.prepare({
          brandId,
          registryKey,
          activeScope,
        });
        const key = randomUUID();
        const command: CreateIntelligenceExecutionCommand = {
          brandId,
          triggerType: "MEANING_TEST",
          triggerRef: key,
          triggerIdempotencyKey: key,
          correlationRef: key,
          requestedImpact: { objects: [...only] },
          processors: [
            {
              registryKey,
              activeScope,
              // Builders already enforce canonical JSON at this typed DB boundary.
              dependencyManifest:
                input.dependencyManifest as unknown as Prisma.InputJsonValue,
              evidenceManifest:
                input.evidenceManifest as unknown as Prisma.InputJsonValue,
              executionIntentKey: key,
              maxAttempts,
              dependencyEligible: input.dependencyEligible,
            },
          ],
        };
        const created = await executions.createOrReturn(command);
        const result = input.dependencyEligible
          ? await worker.runOnce("meaning-test", 60_000)
          : null;
        return { created, result, command };
      }
      const currents = () =>
        prisma.intelligenceCurrentComponent.findMany({
          where: { brandId },
          orderBy: { objectSemanticId: "asc" },
        });
      async function protect(
        objectId: BrandMeaningObject,
        protection:
          | "BRAND_CONFIRMED"
          | "SUPPORT_CONTROLLED" = "BRAND_CONFIRMED",
      ) {
        const current =
          await prisma.intelligenceCurrentComponent.findFirstOrThrow({
            where: { brandId, objectSemanticId: objectId },
          });
        // Fixture seeding of an already-authorized protected state, not processor code.
        await prisma.intelligenceComponentGeneration.update({
          where: { id: current.currentComponentGenerationId },
          data: { authority: protection, sourceClass: "BRAND_USER_INPUT" },
        });
        await prisma.intelligenceCurrentComponent.update({
          where: { id: current.id },
          data: {
            currentAuthority: protection,
            currentSourceClass: "BRAND_USER_INPUT",
            protectionState: protection as IntelligenceProtectionState,
          },
        });
        return current.currentComponentGenerationId;
      }
      return {
        brandId,
        prepared,
        executor,
        dispatch,
        mechanics,
        run,
        projection,
        currents,
        protect,
        generations,
        worker,
        executions,
        retryAtNow: async (id: string) => {
          await prisma.intelligenceProcessorExecution.update({
            where: { id },
            data: { eligibleAt: new Date() },
          });
        },
      };
    }

    it("runs D → E → F → real canonical/preparation → W1.0D → three projections with optional user input absent", async () => {
      const f = await fixture();
      expect(f.prepared.readiness.readiness).toBe("READY_TO_RUN");
      expect(
        f.prepared.canonicalState.entries.map((entry) => entry.semantic).sort(),
      ).toEqual(["brand_name", "industry", "sub_industry", "website_url"]);
      expect(
        f.prepared.canonicalState.entries.find(
          (entry) => entry.semantic === "sub_industry",
        )?.value,
      ).toBeNull();
      expect(
        f.prepared.evidence.capabilityResults
          .map((cap) => cap.capabilityId)
          .sort(),
      ).toEqual([...capabilities].sort());
      const acquisitionCalls = f.mechanics.acquire.mock.calls.length;
      const partial = meaningOutput(f.prepared.evidence, "", true);
      const first = await f.run(partial);
      expect(first.result?.processorExecution).toMatchObject({
        status: "COMPLETED",
        resultReadiness: "PARTIAL",
      });
      expect(f.mechanics.acquire).toHaveBeenCalledTimes(acquisitionCalls);
      expect(
        await prisma.intelligenceProcessorExecution.count({
          where: { brandId: f.brandId, processorId: "brand_communication" },
        }),
      ).toBe(0);
      for (const id of BRAND_MEANING_OBJECTS) {
        const projection = await f.projection.readObject({
          brandId: f.brandId,
          objectSemanticId: id,
        });
        expect(projection.objectState).toBe("CURRENT");
        expect(projection.resultReadiness).toBe(
          id === "positioning" ? "NOT_READY" : "READY",
        );
        expect(projection.components[0]).toMatchObject({
          valueState: id === "positioning" ? "EXPLICIT_NULL" : "VALUE",
          value: partial[id],
        });
        expect(
          projection.components[0].businessStateReferenceSummary,
        ).toHaveLength(4);
        expect(
          projection.components[0].evidenceReferenceSummary.map(
            (ref) => ref.evidenceRef,
          ),
        ).toEqual(partial.output_metadata[id]?.evidence_refs ?? []);
      }
      const rows = await prisma.intelligenceObjectGeneration.findMany({
        where: { brandId: f.brandId },
        orderBy: { objectSemanticId: "asc" },
      });
      expect(rows.map((row) => row.objectSemanticId)).toEqual(
        [...BRAND_MEANING_OBJECTS].sort(),
      );
      expect(
        rows.every((row) => row.objectSemanticId !== "brand_meaning"),
      ).toBe(true);
      const actionCount = await prisma.intelligenceAction.count({
        where: { brandId: f.brandId },
      });
      expect((await f.executions.createOrReturn(first.command)).replayed).toBe(
        true,
      );
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(3);
      expect(
        await prisma.intelligenceAction.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(actionCount);
    });

    it("waits for representative Evidence without a user-input capability or provider call", async () => {
      const f = await fixture(false);
      expect(f.prepared.readiness.readiness).toBe("WAITING_FOR_EVIDENCE");
      expect(
        f.prepared.evidence.capabilityResults.every(
          (cap) =>
            cap.status === "NOT_REQUESTED" &&
            cap.capabilityExecutionRef === null &&
            cap.evidence.length === 0,
        ),
      ).toBe(true);
      const waiting = await f.run(null);
      expect(waiting.created.processorExecutions[0].status).toBe(
        "WAITING_FOR_DEPENDENCY",
      );
      expect(f.dispatch).not.toHaveBeenCalled();
      // Keep the disposable shared test queue clean.
      await prisma.intelligenceProcessorExecution.update({
        where: { id: waiting.created.processorExecutions[0].id },
        data: { status: "CANCELLED" },
      });
    });

    it("advances description, candidates protected positioning, and persists explicit-null value in one transaction", async () => {
      const f = await fixture();
      await f.run(meaningOutput(f.prepared.evidence));
      const protectedId = await f.protect("positioning");
      const before = await f.currents();
      const changed = meaningOutput(f.prepared.evidence, " updated");
      const mixed = {
        ...changed,
        value_proposition: null,
        output_metadata: {
          ...changed.output_metadata,
          value_proposition: null,
        },
      };
      expect((await f.run(mixed)).result?.processorExecution.status).toBe(
        "COMPLETED",
      );
      const after = await f.currents();
      expect(
        after.find((row) => row.objectSemanticId === "brand_description")
          ?.currentComponentGenerationId,
      ).not.toBe(
        before.find((row) => row.objectSemanticId === "brand_description")
          ?.currentComponentGenerationId,
      );
      expect(
        after.find((row) => row.objectSemanticId === "positioning")
          ?.currentComponentGenerationId,
      ).toBe(protectedId);
      expect(
        (
          await f.projection.readObject({
            brandId: f.brandId,
            objectSemanticId: "value_proposition",
          })
        ).components[0].valueState,
      ).toBe("EXPLICIT_NULL");
      expect(
        (
          await f.projection.readObject({
            brandId: f.brandId,
            objectSemanticId: "positioning",
          })
        ).candidateSummary,
      ).toMatchObject({
        status: "CONFLICT",
        pendingCount: 1,
        rawCandidateVisible: false,
      });
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(6);
    });

    it.each(["brand_description", "value_proposition"] as const)(
      "protects %s independently",
      async (objectId) => {
        const f = await fixture();
        await f.run(meaningOutput(f.prepared.evidence));
        const id = await f.protect(objectId);
        expect(
          (await f.run(meaningOutput(f.prepared.evidence, " changed"))).result
            ?.processorExecution.status,
        ).toBe("COMPLETED");
        expect(
          (await f.currents()).find((row) => row.objectSemanticId === objectId)
            ?.currentComponentGenerationId,
        ).toBe(id);
        expect(
          await prisma.intelligenceComponentCandidate.count({
            where: {
              brandId: f.brandId,
              objectSemanticId: objectId,
              status: "PENDING",
            },
          }),
        ).toBe(1);
      },
    );

    it("preserves Support-controlled current and avoids candidates for equivalent protected values", async () => {
      const f = await fixture();
      const output = meaningOutput(f.prepared.evidence);
      await f.run(output);
      const id = await f.protect("brand_description", "SUPPORT_CONTROLLED");
      await f.run(output);
      expect(
        await prisma.intelligenceComponentCandidate.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(0);
      await f.run(meaningOutput(f.prepared.evidence, " differing"));
      expect(
        (await f.currents()).find(
          (row) => row.objectSemanticId === "brand_description",
        )?.currentComponentGenerationId,
      ).toBe(id);
      expect(
        await prisma.intelligenceComponentCandidate.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(1);
    });

    it.each(["provider", "structured", "semantic"] as const)(
      "preserves all three current Objects on %s refresh failure",
      async (mode) => {
        const f = await fixture();
        await f.run(meaningOutput(f.prepared.evidence));
        const before = await f.currents();
        const output = meaningOutput(f.prepared.evidence, " changed");
        const bad =
          mode === "structured"
            ? { wrong: true }
            : mode === "semantic"
              ? { ...output, positioning: output.brand_description }
              : output;
        const failed = await f.run(
          bad,
          1,
          mode === "provider"
            ? new StructuredEvidenceExecutionError("REQUEST_TIMEOUT", 1)
            : undefined,
        );
        expect(failed.result?.processorExecution.status).toBe(
          "FAILED_TERMINAL",
        );
        expect(failed.result?.processorExecution.lastErrorCategory).toBe(
          mode === "provider" ? "RETRYABLE_TECHNICAL" : "VALIDATION_FAILURE",
        );
        expect(await f.currents()).toEqual(before);
        expect(
          await prisma.intelligenceObjectGeneration.count({
            where: { brandId: f.brandId },
          }),
        ).toBe(3);
      },
    );

    it("retries once without duplicating the successful three-Object generation set", async () => {
      const f = await fixture();
      const first = await f.run(
        meaningOutput(f.prepared.evidence),
        2,
        new StructuredEvidenceExecutionError("RATE_LIMITED", 1),
      );
      expect(first.result?.processorExecution.status).toBe("QUEUED");
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(0);
      await f.retryAtNow(first.created.processorExecutions[0].id);
      expect(
        (await f.worker.runOnce("meaning-retry", 60000)).processorExecution
          .status,
      ).toBe("COMPLETED");
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(3);
      expect(
        await prisma.intelligenceProcessorAttempt.count({
          where: {
            processorExecutionId: first.created.processorExecutions[0].id,
          },
        }),
      ).toBe(2);
      expect((await f.executions.createOrReturn(first.command)).replayed).toBe(
        true,
      );
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(3);
    });

    it("rolls back earlier Object writes when the second persistence write fails", async () => {
      const f = await fixture();
      const original = f.generations.persistInTransaction.bind(f.generations);
      let calls = 0;
      const spy = vi
        .spyOn(f.generations, "persistInTransaction")
        .mockImplementation(async (tx, command) => {
          if (++calls === 2) throw new Error("injected transaction failure");
          return original(tx, command);
        });
      const first = await f.run(meaningOutput(f.prepared.evidence), 2);
      spy.mockRestore();
      expect(first.result?.processorExecution.status).toBe("QUEUED");
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(0);
      expect(await f.currents()).toEqual([]);
      await f.retryAtNow(first.created.processorExecutions[0].id);
      expect(
        (await f.worker.runOnce("meaning-transaction-retry", 60000))
          .processorExecution.status,
      ).toBe("COMPLETED");
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(3);
    });

    it("persists only an owned directed root without touching sibling Objects", async () => {
      const f = await fixture();
      await f.run(meaningOutput(f.prepared.evidence));
      const before = await f.currents();
      const second = await f.run(
        meaningOutput(f.prepared.evidence, " new"),
        1,
        undefined,
        ["positioning"],
      );
      expect(second.result?.processorExecution.status).toBe("COMPLETED");
      const after = await f.currents();
      for (const id of ["brand_description", "value_proposition"])
        expect(after.find((row) => row.objectSemanticId === id)).toEqual(
          before.find((row) => row.objectSemanticId === id),
        );
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(4);
    });
  },
);
