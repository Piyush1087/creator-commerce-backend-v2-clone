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
import { BrandMeaningPersistenceHook } from "../brand-meaning/brand-meaning-persistence.hook";
import { BrandCharacterPersistenceHook } from "./brand-character-persistence.hook";
import { StructuredBrandCharacterModelProvider } from "./brand-character-model.provider";
import {
  BRAND_CHARACTER_OBJECTS,
  type BrandCharacterObject,
  type BrandCharacterOutput,
} from "./brand-character.types";
import { BrandCharacterProcessorExecutor } from "./brand-character-processor.executor";
import { BrandCharacterStateRepository } from "./brand-character-state.repository";
import { itemPath } from "./brand-character-identity";
import {
  capabilities,
  contracts,
  characterOutput,
  registryKey,
  scope,
} from "./brand-character.test-fixtures";

const enabled = process.env.BRAND_CHARACTER_DATABASE_TEST === "true";
describe.skipIf(!enabled)(
  "brand_character real PostgreSQL vertical slice",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { maxWait: 10_000 },
    });
    const service = prisma as unknown as PrismaService;
    afterAll(async () => {
      await prisma.$disconnect();
    });

    async function fixture(acquire = true) {
      const brandId = randomUUID();
      await prisma.brandProfile.create({
        data: {
          id: brandId,
          domain: `character-${brandId}.example`,
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
                ? "Our values include transparency in every partnership. Our values include fair partnerships for all creators."
                : pathname === "/products"
                  ? "Starter plan for small teams. Pro plan for growing teams. Enterprise plan for larger organizations."
                  : "We are a curious brand known for learning from creators. We are a dependable brand dedicated to creators.";
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
            ownedWebsiteRoot: `https://character-${brandId}.example/`,
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
      let output: unknown = acquire ? characterOutput(prepared.evidence) : null;
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
      const model = new StructuredBrandCharacterModelProvider(
        { execute: dispatch } as unknown as StructuredEvidenceExecutionService,
        new ConfigService(),
      );
      const catalogue = new BrandCharacterStateRepository(service);
      const executor = new BrandCharacterProcessorExecutor(
        dependencies,
        registry,
        catalogue,
        new StructuralValidator(),
        new SemanticValidator(),
        model,
      );
      const executors = new ProcessorExecutorRegistry(
        new SyntheticProcessorExecutor(),
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
      const character = new BrandCharacterPersistenceHook(
        generations,
        current,
        transitions,
        validator,
        catalogue,
      );
      const communication = new BrandCommunicationPersistenceHook(
        generations,
        current,
        transitions,
        validator,
        paths,
      );
      const router = new ProcessorPersistenceRouter(
        communication,
        new BrandMeaningPersistenceHook(
          generations,
          current,
          transitions,
          validator,
        ),
        character,
      );
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
        only: readonly BrandCharacterObject[] = BRAND_CHARACTER_OBJECTS,
        selectedPath?: string,
      ) {
        output = value;
        nextError = error;
        const activeScope = scope(brandId)
          .filter((address) => only.includes(address.objectSemanticId))
          .map((address) =>
            selectedPath
              ? { ...address, componentSemanticPath: selectedPath }
              : address,
          );
        const input = await dependencies.prepare({
          brandId,
          registryKey,
          activeScope,
        });
        const key = randomUUID();
        const command: CreateIntelligenceExecutionCommand = {
          brandId,
          triggerType: "CHARACTER_TEST",
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
          ? await worker.runOnce("character-test", 60_000)
          : null;
        return { created, result, command };
      }
      const currents = () =>
        prisma.intelligenceCurrentComponent.findMany({
          where: { brandId },
          orderBy: { objectSemanticId: "asc" },
        });
      async function protect(
        objectId: BrandCharacterObject,
        semanticId: string,
        protection:
          | "BRAND_CONFIRMED"
          | "SUPPORT_CONTROLLED" = "BRAND_CONFIRMED",
      ) {
        const current =
          await prisma.intelligenceCurrentComponent.findFirstOrThrow({
            where: {
              brandId,
              objectSemanticId: objectId,
              componentSemanticPath: itemPath(semanticId),
            },
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
        catalogue,
        worker,
        executions,
        retryAtNow: async (id: string) => {
          await prisma.intelligenceProcessorExecution.update({
            where: { id },
            // Fixture-only: force eligibility without mixing host and database clocks.
            data: { eligibleAt: new Date(0) },
          });
        },
      };
    }
    const mutable = (value: BrandCharacterOutput) =>
      JSON.parse(JSON.stringify(value)) as {
        brand_values: Array<{ semantic_id: string; value: string }>;
        brand_personality: Array<{ semantic_id: string; trait: string }>;
        output_metadata: Record<
          string,
          Array<{
            semantic_id: string;
            authority: string;
            source_class: string;
            freshness: string;
            evidence_refs: string[];
          }>
        >;
      };

    it.each([
      [true, true, "READY"],
      [true, false, "PARTIAL"],
      [false, true, "PARTIAL"],
      [false, false, "NOT_READY"],
    ] as const)(
      "D → E → F → execution → projection: values=%s personality=%s",
      async (values, personality, readiness) => {
        const f = await fixture();
        const output = characterOutput(
          f.prepared.evidence,
          values,
          personality,
        );
        expect(f.prepared.readiness.readiness).toBe("READY_TO_RUN");
        expect(
          f.prepared.evidence.capabilityResults.map((cap) => cap.capabilityId),
        ).toEqual([...capabilities]);
        expect(
          f.prepared.canonicalState.entries
            .map((entry) => entry.semantic)
            .sort(),
        ).toEqual(["brand_name", "industry", "sub_industry"]);
        const acquisitionCount = f.mechanics.acquire.mock.calls.length;
        const result = await f.run(output);
        expect(result.result?.processorExecution).toMatchObject({
          status: "COMPLETED",
          resultReadiness: readiness,
        });
        expect(f.mechanics.acquire).toHaveBeenCalledTimes(acquisitionCount);
        expect(
          await prisma.intelligenceProcessorExecution.count({
            where: {
              brandId: f.brandId,
              processorId: { in: ["brand_meaning", "brand_communication"] },
            },
          }),
        ).toBe(0);
        for (const id of BRAND_CHARACTER_OBJECTS) {
          const projection = await f.projection.readObject({
            brandId: f.brandId,
            objectSemanticId: id,
          });
          expect(projection.objectState).toBe("CURRENT");
          if (output[id] === null) {
            expect(projection.assembledValue).toEqual({
              state: "EXPLICIT_NULL",
              value: null,
            });
            expect(projection.resultReadiness).toBe("NOT_READY");
          } else {
            expect(projection.assembledValue.state).toBe("VALUE");
            expect(projection.assembledValue.value).toEqual(
              [...output[id]!].sort((a, b) =>
                a.semantic_id.localeCompare(b.semantic_id),
              ),
            );
            expect(projection.resultReadiness).toBe("READY");
            for (const item of output[id]!) {
              const component = projection.components.find(
                (entry) =>
                  entry.componentSemanticPath === itemPath(item.semantic_id),
              )!;
              expect(component).toMatchObject({
                valueState: "VALUE",
                authority: "CREATOR_SHOP_DERIVED",
                readiness: "READY",
                freshness: "CURRENT",
              });
              expect(component.businessStateReferenceSummary).toHaveLength(3);
              const meta = output.output_metadata[id]!.find(
                (entry) => entry.semantic_id === item.semantic_id,
              )!;
              expect(
                component.evidenceReferenceSummary.map(
                  (ref) => ref.evidenceRef,
                ),
              ).toEqual(meta.evidence_refs);
            }
          }
        }
        expect(
          await prisma.intelligenceObjectGeneration.count({
            where: { brandId: f.brandId, objectSemanticId: "brand_character" },
          }),
        ).toBe(0);
      },
    );

    it("reordered items and metadata retain identities, generations and current revisions", async () => {
      const f = await fixture();
      const output = characterOutput(f.prepared.evidence);
      await f.run(output);
      const before = await f.currents();
      const reversed = {
        ...output,
        brand_values: [...output.brand_values!].reverse(),
        brand_personality: [...output.brand_personality!].reverse(),
        output_metadata: {
          brand_values: [...output.output_metadata.brand_values!].reverse(),
          brand_personality: [
            ...output.output_metadata.brand_personality!,
          ].reverse(),
        },
      };
      expect((await f.run(reversed)).result?.processorExecution.status).toBe(
        "COMPLETED",
      );
      expect(await f.currents()).toEqual(before);
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(2);
    });

    it.each(["BRAND_CONFIRMED", "SUPPORT_CONTROLLED"] as const)(
      "preserves %s items and candidates a material discrepancy",
      async (protection) => {
        const f = await fixture();
        await f.run(characterOutput(f.prepared.evidence));
        const generation = await f.protect(
          "brand_values",
          "principle_transparency",
          protection,
        );
        const output = mutable(characterOutput(f.prepared.evidence));
        output.brand_values[0].value =
          "Transparency through open partnership records";
        expect((await f.run(output)).result?.processorExecution.status).toBe(
          "COMPLETED",
        );
        const projection = await f.projection.readObject({
          brandId: f.brandId,
          objectSemanticId: "brand_values",
        });
        const item = projection.components.find(
          (entry) =>
            entry.componentSemanticPath === itemPath("principle_transparency"),
        )!;
        expect(item.protectionState).toBe(protection);
        expect(item.candidateSummary.pendingCount).toBe(1);
        const current = (await f.currents()).find(
          (entry) =>
            entry.objectSemanticId === "brand_values" &&
            entry.componentSemanticPath === itemPath("principle_transparency"),
        )!;
        expect(current.currentComponentGenerationId).toBe(generation);
        expect(projection.candidateSummary.rawCandidateVisible).toBe(false);
      },
    );

    it.each(["Transparency in all creator partnerships", "TRANSPARENCY"])(
      "preserves identity across wording/case update to %s without changing unrelated items",
      async (label) => {
        const f = await fixture();
        await f.run(characterOutput(f.prepared.evidence));
        const before = await f.currents();
        const full = characterOutput(f.prepared.evidence);
        const output = {
          brand_values: [
            {
              semantic_id: "principle_transparency",
              value: label,
            },
          ],
          brand_personality: null,
          output_metadata: {
            brand_values: [full.output_metadata.brand_values![0]],
            brand_personality: null,
          },
        };
        expect(
          (
            await f.run(
              output,
              1,
              undefined,
              ["brand_values"],
              itemPath("principle_transparency"),
            )
          ).result?.processorExecution.status,
        ).toBe("COMPLETED");
        for (const current of await f.currents()) {
          const prior = before.find((row) => row.id === current.id)!;
          if (
            current.componentSemanticPath === itemPath("principle_transparency")
          ) {
            expect(current.id).toBe(prior.id);
            expect(current.componentSemanticPath).toBe(
              prior.componentSemanticPath,
            );
            expect(current.revision).toBe(prior.revision + 1n);
          } else expect(current).toEqual(prior);
        }
        const projection = await f.projection.readObject({
          brandId: f.brandId,
          objectSemanticId: "brand_values",
        });
        expect(projection.mixedGeneration).toBe(true);
        expect(projection.objectState).toBe("CURRENT");
        expect(projection.resultReadiness).toBe("READY");
        expect(projection.assembledValue.value).toHaveLength(2);
      },
    );

    it.each(["BRAND_CONFIRMED", "SUPPORT_CONTROLLED"] as const)(
      "cannot replace a directed protected %s semantic ID with another ID",
      async (protection) => {
        const f = await fixture();
        await f.run(characterOutput(f.prepared.evidence));
        await f.protect("brand_values", "principle_transparency", protection);
        const before = await f.currents();
        const full = characterOutput(f.prepared.evidence);
        const output = {
          brand_values: [
            { semantic_id: "replacement_transparency", value: "Transparency" },
          ],
          brand_personality: null,
          output_metadata: {
            brand_values: [
              {
                ...full.output_metadata.brand_values![0],
                semantic_id: "replacement_transparency",
              },
            ],
            brand_personality: null,
          },
        };
        const failed = await f.run(
          output,
          1,
          undefined,
          ["brand_values"],
          itemPath("principle_transparency"),
        );
        expect(failed.result?.processorExecution).toMatchObject({
          status: "FAILED_TERMINAL",
          lastErrorCode: "CHARACTER_OUTPUT_OUTSIDE_ACTIVE_SCOPE",
        });
        expect(await f.currents()).toEqual(before);
      },
    );

    it("admits a new semantic item without disturbing existing item identity", async () => {
      const f = await fixture();
      const initial = mutable(characterOutput(f.prepared.evidence));
      initial.brand_values.pop();
      initial.output_metadata.brand_values.pop();
      await f.run(initial);
      const before = await f.currents();
      expect(
        (await f.run(characterOutput(f.prepared.evidence))).result
          ?.processorExecution.status,
      ).toBe("COMPLETED");
      const after = await f.currents();
      for (const prior of before)
        expect(after.find((row) => row.id === prior.id)).toEqual(prior);
      expect(after).toHaveLength(before.length + 1);
      expect(
        after.some(
          (row) =>
            row.componentSemanticPath ===
            itemPath("principle_fair_partnerships"),
        ),
      ).toBe(true);
    });

    it("omitted/null refreshed collections preserve prior items rather than invent removal", async () => {
      const f = await fixture();
      await f.run(characterOutput(f.prepared.evidence));
      await f.protect("brand_values", "principle_transparency");
      const before = await f.currents();
      expect(
        (await f.run(characterOutput(f.prepared.evidence, false, false))).result
          ?.processorExecution,
      ).toMatchObject({ status: "COMPLETED", resultReadiness: "NOT_READY" });
      expect(await f.currents()).toEqual(before);
      for (const objectSemanticId of BRAND_CHARACTER_OBJECTS)
        expect(
          (
            await f.projection.readObject({
              brandId: f.brandId,
              objectSemanticId,
            })
          ).assembledValue.value,
        ).toHaveLength(2);
    });

    it("blocks missing representative Evidence before provider invocation", async () => {
      const f = await fixture(false);
      expect(f.prepared.readiness.readiness).toBe("WAITING_FOR_EVIDENCE");
      const result = await f.run({
        brand_values: null,
        brand_personality: null,
        output_metadata: { brand_values: null, brand_personality: null },
      });
      expect(result.result).toBeNull();
      expect(f.dispatch).not.toHaveBeenCalled();
    });

    it.each(["provider", "structured", "semantic"])(
      "failed %s refresh preserves all Character current state",
      async (mode) => {
        const f = await fixture();
        await f.run(characterOutput(f.prepared.evidence));
        const before = await f.currents();
        const output = mutable(characterOutput(f.prepared.evidence));
        if (mode === "structured")
          Object.assign(output, { positioning: "unowned" });
        if (mode === "semantic")
          output.output_metadata.brand_values[0].evidence_refs = [
            "unknown-evidence",
          ];
        const failed = await f.run(
          output,
          1,
          mode === "provider"
            ? new StructuredEvidenceExecutionError("REQUEST_TIMEOUT", 1)
            : undefined,
        );
        expect(failed.result?.processorExecution.status).toBe(
          "FAILED_TERMINAL",
        );
        expect(await f.currents()).toEqual(before);
      },
    );

    it("successful request replay creates no duplicate generations or transitions", async () => {
      const f = await fixture();
      const first = await f.run(characterOutput(f.prepared.evidence));
      const generations = await prisma.intelligenceObjectGeneration.count({
        where: { brandId: f.brandId },
      });
      const actions = await prisma.intelligenceAction.count({
        where: { brandId: f.brandId },
      });
      expect((await f.executions.createOrReturn(first.command)).replayed).toBe(
        true,
      );
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(generations);
      expect(
        await prisma.intelligenceAction.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(actions);
    });

    it("retries a pre-persistence provider failure into one successful generation set", async () => {
      const f = await fixture();
      const first = await f.run(
        characterOutput(f.prepared.evidence),
        2,
        new StructuredEvidenceExecutionError("REQUEST_TIMEOUT", 1),
      );
      expect(first.result?.processorExecution.status).toBe("QUEUED");
      const id = first.result!.processorExecution.id;
      await f.retryAtNow(id);
      expect(
        (await f.worker.runOnce("character-retry", 60_000))?.processorExecution
          .status,
      ).toBe("COMPLETED");
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(2);
    });

    it("rejects a changed item basis between model preparation and finalization", async () => {
      const f = await fixture();
      await f.run(characterOutput(f.prepared.evidence));
      const original = f.catalogue.read.bind(f.catalogue);
      const spy = vi
        .spyOn(f.catalogue, "read")
        .mockImplementationOnce(async (...args) => {
          const snapshot = await original(...args);
          await prisma.intelligenceCurrentComponent.updateMany({
            where: {
              brandId: f.brandId,
              componentSemanticPath: itemPath("principle_transparency"),
            },
            data: { revision: { increment: 1n } },
          });
          return snapshot;
        });
      const output = mutable(characterOutput(f.prepared.evidence));
      output.brand_values[0].value = "Transparency in creator partnerships";
      const count = await prisma.intelligenceObjectGeneration.count({
        where: { brandId: f.brandId },
      });
      const result = await f.run(output, 1);
      spy.mockRestore();
      expect(result.result?.processorExecution.status).toBe("FAILED_TERMINAL");
      expect(result.result?.processorExecution.lastErrorCode).toBe(
        "ATTEMPT_EXHAUSTED",
      );
      expect(
        await prisma.intelligenceProcessorAttempt.findFirstOrThrow({
          where: { processorExecutionId: result.result!.processorExecution.id },
        }),
      ).toMatchObject({ errorCode: "CHARACTER_CURRENT_BASIS_CHANGED" });
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(count);
    });

    it("rolls back both outputs if a later Object write fails", async () => {
      const f = await fixture();
      const original = f.generations.persistInTransaction.bind(f.generations);
      let calls = 0;
      const spy = vi
        .spyOn(f.generations, "persistInTransaction")
        .mockImplementation(async (...args) => {
          if (++calls === 2) throw new Error("injected DB write failure");
          return original(...args);
        });
      const first = await f.run(characterOutput(f.prepared.evidence), 2);
      spy.mockRestore();
      expect(first.result?.processorExecution.status).toBe("QUEUED");
      expect(await f.currents()).toHaveLength(0);
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(0);
      await f.retryAtNow(first.result!.processorExecution.id);
      expect(
        (await f.worker.runOnce("character-rollback-retry", 60_000))
          ?.processorExecution.status,
      ).toBe("COMPLETED");
    });
  },
);
