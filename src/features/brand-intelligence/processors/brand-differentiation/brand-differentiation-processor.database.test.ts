import "reflect-metadata";
import { differentiationBusinessRef } from "./brand-differentiation-business-refs";
import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AuthSessionService } from "../../../auth/auth-session.service";
import { JwtStrategy } from "../../../auth/jwt.strategy";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { BrandConsumerController } from "../../../brand-centre/consumer/brand-consumer.controller";
import { BrandConsumerService } from "../../../brand-centre/consumer/brand-consumer.service";
import { ProcessorRuntimeProjectionService } from "../../../brand-centre/consumer/processor-runtime-projection.service";
import { BrandCentreAuthService } from "../../../brand-centre/brand-centre-auth.service";
import { BrandCentreSessionEvictionService } from "../../../brand-centre/services/brand-centre-session-eviction.service";
import { BrandVisualStateService } from "../../../brand-canonical-state/brand-visual-state.service";
import { BrandLocationService } from "../../../brand-canonical-state/brand-location.service";
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
import { BrandDifferentiationPersistenceHook } from "./brand-differentiation-persistence.hook";
import { StructuredBrandDifferentiationModelProvider } from "./brand-differentiation-model.provider";
import {
  DIFFERENTIATION_OBJECT,
  type DifferentiationOutput,
} from "./brand-differentiation.types";
import { BrandDifferentiationProcessorExecutor } from "./brand-differentiation-processor.executor";
import { BrandDifferentiationStateRepository } from "./brand-differentiation-state.repository";
import {
  differentiatorPath,
  proofPath,
} from "./brand-differentiation-identity";
import {
  capabilities,
  contracts,
  differentiationOutput,
  registryKey,
  scope,
} from "./brand-differentiation.test-fixtures";

const enabled = process.env.BRAND_DIFFERENTIATION_DATABASE_TEST === "true";
// Disposable integration setup performs real DE writes; allow slower local disks.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
describe.skipIf(!enabled)(
  "brand_differentiation real PostgreSQL vertical slice",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { maxWait: 10_000, timeout: 30_000 },
    });
    const service = prisma as unknown as PrismaService;
    afterAll(async () => {
      await prisma.$disconnect();
    });

    async function fixture(
      selected: readonly (typeof capabilities)[number][] = capabilities,
      generic = false,
    ) {
      const acquire = selected.length > 0;
      const brandId = randomUUID();
      await prisma.brandProfile.create({
        data: {
          id: brandId,
          domain: `differentiation-${brandId}.example`,
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
            const text = generic
              ? "Welcome to our company website."
              : "We are a manufacturing company with our own factory, focused on workshop teams. We manufacture tools in our own factory. We operate a tool workshop.";
            const paragraphs = text
              .split(/(?<=[.!?])\s+/u)
              .map((statement) => `<p>${statement}</p>`)
              .join("");
            const links =
              pathname === "/"
                ? [
                    new URL("/about", url).toString(),
                    new URL("/products", url).toString(),
                  ]
                : [];
            return {
              url,
              html: `<html lang="en"><body><main>${paragraphs}</main>${links.map((link) => `<a href="${link}">${link}</a>`).join("")}</body></html>`,
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
        for (const capabilityId of selected) {
          const request = await acquisition.request({
            brandId: asBrandId(brandId),
            capabilityId,
            freshnessIntent: "REUSE_ALLOWED",
            normalizationContractVersion: "1.0",
            requestKey: randomUUID(),
            ownedWebsiteRoot: `https://differentiation-${brandId}.example/`,
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
      let output: unknown = differentiationOutput(prepared.evidence);
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
      const model = new StructuredBrandDifferentiationModelProvider(
        { execute: dispatch } as unknown as StructuredEvidenceExecutionService,
        new ConfigService(),
      );
      const catalogue = new BrandDifferentiationStateRepository(service);
      const executor = new BrandDifferentiationProcessorExecutor(
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
      const differentiation = new BrandDifferentiationPersistenceHook(
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
        undefined,
        undefined,
        differentiation,
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
        only: readonly string[] = [DIFFERENTIATION_OBJECT],
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
          triggerType: "DIFFERENTIATION_TEST",
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
          ? await worker.runOnce("differentiation-test", 60_000)
          : null;
        return { created, result, command };
      }
      const currents = () =>
        prisma.intelligenceCurrentComponent.findMany({
          where: { brandId },
          orderBy: { objectSemanticId: "asc" },
        });
      async function protect(
        path: string,
        protection:
          | "BRAND_CONFIRMED"
          | "SUPPORT_CONTROLLED" = "BRAND_CONFIRMED",
      ) {
        const current =
          await prisma.intelligenceCurrentComponent.findFirstOrThrow({
            where: {
              brandId,
              objectSemanticId: DIFFERENTIATION_OBJECT,
              componentSemanticPath: path,
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
        adapter,
        executor,
        dispatch,
        mechanics,
        run,
        projection,
        currentState: current,
        transitions,
        router,
        currents,
        protect,
        generations,
        catalogue,
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

    const project = (f: Awaited<ReturnType<typeof fixture>>) =>
      f.projection.readObject({
        brandId: f.brandId,
        objectSemanticId: DIFFERENTIATION_OBJECT,
      });
    const complete = (
      result: Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>["run"]>>,
    ) =>
      expect(
        result.result?.processorExecution.status,
        result.result?.processorExecution.lastErrorCode ?? undefined,
      ).toBe("COMPLETED");

    it("all four durable lineages reach provider and persist six frozen nodes with mixed authority", async () => {
      const f = await fixture();
      expect(f.prepared.dependencyEligible).toBe(true);
      const out = differentiationOutput(f.prepared.evidence);
      const calls = f.mechanics.acquire.mock.calls.length;
      complete(await f.run(out));
      expect((await project(f)).assembledValue.value).toEqual(
        out.differentiation_and_proof,
      );
      expect(f.dispatch).toHaveBeenCalledOnce();
      expect(f.mechanics.acquire).toHaveBeenCalledTimes(calls);
      const rows = await f.catalogue.read(f.brandId);
      expect(rows).toHaveLength(6);
      expect(
        rows.find((r) => r.componentSemanticPath.endsWith("/f/differentiator"))!
          .currentAuthority,
      ).toBe("CREATOR_SHOP_DERIVED");
      expect(
        rows.find((r) => r.componentSemanticPath.endsWith("/f/statement"))!
          .currentAuthority,
      ).toBe("OBSERVED");
      const refs = await prisma.intelligenceEvidenceReference.findMany({
        where: { brandId: f.brandId },
      });
      expect(
        refs
          .filter((r) => r.componentSemanticPath.endsWith("/f/statement"))
          .map((r) => r.evidenceRef),
      ).toEqual(out.output_metadata![0].proof_point_metadata![0].evidence_refs);
    });
    it.each(capabilities)(
      "missing required %s waits and never calls provider",
      async (missing) => {
        const f = await fixture(capabilities.filter((c) => c !== missing));
        expect(f.prepared.dependencyEligible).toBe(false);
        const result = await f.run({
          differentiation_and_proof: null,
          output_metadata: null,
        });
        expect(result.result).toBeNull();
        expect(
          (
            await prisma.intelligenceProcessorExecution.findFirstOrThrow({
              where: { brandId: f.brandId },
            })
          ).status,
        ).toBe("WAITING_FOR_DEPENDENCY");
        expect(f.dispatch).not.toHaveBeenCalled();
        expect(await f.currents()).toEqual([]);
      },
    );
    it.each([null, []])(
      "available capabilities with no defensible differentiation allow %j",
      async (value) => {
        const f = await fixture(capabilities, true);
        expect(f.prepared.dependencyEligible).toBe(true);
        const result = await f.run({
          differentiation_and_proof: value,
          output_metadata: value,
        });
        complete(result);
        expect(result.result?.processorExecution.resultReadiness).toBe(
          "NOT_READY",
        );
        expect((await project(f)).assembledValue.value).toEqual(value);
      },
    );
    it("progresses from partial to ready without fixed record count", async () => {
      const f = await fixture();
      complete(await f.run(differentiationOutput(f.prepared.evidence, false)));
      expect((await project(f)).consumerReadiness).toBe("PARTIAL");
      complete(await f.run(differentiationOutput(f.prepared.evidence)));
      expect((await project(f)).consumerReadiness).toBe("READY");
    });
    it("same IDs preserve identity across case/wording/reorder; new IDs admit; omissions never delete", async () => {
      const f = await fixture();
      const first = differentiationOutput(f.prepared.evidence);
      const other = differentiationOutput(
        f.prepared.evidence,
        false,
        "portfolio_workshop",
      );
      const both: DifferentiationOutput = {
        differentiation_and_proof: [
          ...first.differentiation_and_proof!,
          ...other.differentiation_and_proof!,
        ],
        output_metadata: [...first.output_metadata!, ...other.output_metadata!],
      };
      complete(await f.run(first));
      complete(await f.run(both));
      const before = await f.catalogue.read(f.brandId);
      const changed: DifferentiationOutput = {
        ...both,
        differentiation_and_proof: [...both.differentiation_and_proof!]
          .reverse()
          .map((d) => ({
            ...d,
            differentiator: d.differentiator.toUpperCase(),
          })),
      };
      complete(await f.run(changed));
      expect(
        (await f.catalogue.read(f.brandId)).map((r) => r.componentSemanticPath),
      ).toEqual(before.map((r) => r.componentSemanticPath));
      const current = await f.catalogue.read(f.brandId);
      complete(
        await f.run({
          ...changed,
          differentiation_and_proof: [
            ...changed.differentiation_and_proof!,
          ].reverse(),
        }),
      );
      expect(await f.catalogue.read(f.brandId)).toEqual(current);
      complete(
        await f.run({ differentiation_and_proof: null, output_metadata: null }),
      );
      expect(await f.catalogue.read(f.brandId)).toEqual(current);
      complete(await f.run(differentiationOutput(f.prepared.evidence, false)));
      const projected = (await project(f)).assembledValue.value as Array<{
        semantic_id: string;
        proof_points: unknown[];
      }>;
      expect(projected).toHaveLength(2);
      expect(
        projected.find((d) => d.semantic_id === "in_house_manufacturing")!
          .proof_points,
      ).toHaveLength(1);
    });
    it.each([
      "differentiator",
      "proof_item",
      "proof_statement",
      "record",
    ] as const)(
      "protected %s creates a candidate and preserves current",
      async (level) => {
        const f = await fixture(),
          first = differentiationOutput(f.prepared.evidence);
        complete(await f.run(first));
        const parent = differentiatorPath("in_house_manufacturing"),
          child = proofPath("in_house_manufacturing", "owned_factory");
        const path =
          level === "differentiator"
            ? `${parent}/f/differentiator`
            : level === "proof_item"
              ? child
              : level === "proof_statement"
                ? `${child}/f/statement`
                : parent;
        const protectedId = await f.protect(path);
        complete(await f.run(first));
        expect(
          await prisma.intelligenceComponentCandidate.count({
            where: { brandId: f.brandId },
          }),
        ).toBe(0);
        const revised: DifferentiationOutput = {
          ...first,
          differentiation_and_proof: first.differentiation_and_proof!.map(
            (d) => ({
              ...d,
              differentiator:
                "The Brand operates its own tool manufacturing workshop.",
              proof_points: d.proof_points!.map((p) => ({
                ...p,
                statement: `Owned website states: ${p.statement}`,
              })),
            }),
          ),
        };
        complete(await f.run(revised));
        const row = (await f.catalogue.read(f.brandId)).find(
          (r) => r.componentSemanticPath === path,
        )!;
        expect(row.currentComponentGenerationId).toBe(protectedId);
        expect(
          await prisma.intelligenceComponentCandidate.count({
            where: { brandId: f.brandId, componentSemanticPath: path },
          }),
        ).toBe(1);
      },
    );
    it("unrelated proof updates do not regenerate the entire collection", async () => {
      const f = await fixture(),
        first = differentiationOutput(f.prepared.evidence);
      const a = first.differentiation_and_proof![0],
        m = first.output_metadata![0];
      const secondEvidence =
        f.prepared.evidence.capabilityResults[3].evidence.find((e) => {
          const payload = e.boundedNormalizedPayload as {
            statement?: string;
            proof_class?: string;
            scope?: string;
          };
          return (
            payload.scope === "BRAND_LEVEL" &&
            payload.proof_class === "DIRECT_FIRST_PARTY_FACTUAL_SUPPORT" &&
            payload.statement !== a.proof_points![0].statement
          );
        })!;
      expect(secondEvidence).toBeDefined();
      const both: DifferentiationOutput = {
        differentiation_and_proof: [
          {
            ...a,
            proof_points: [
              ...a.proof_points!,
              {
                semantic_id: "workshop_observation",
                statement: (
                  secondEvidence.boundedNormalizedPayload as {
                    statement: string;
                  }
                ).statement,
              },
            ],
          },
        ],
        output_metadata: [
          {
            ...m,
            proof_point_metadata: [
              ...m.proof_point_metadata!,
              {
                ...m.proof_point_metadata![0],
                semantic_id: "workshop_observation",
                evidence_refs: [secondEvidence.evidenceRef],
              },
            ],
          },
        ],
      };
      complete(await f.run(both));
      const before = await f.catalogue.read(f.brandId);
      const refreshed: DifferentiationOutput = {
        ...both,
        differentiation_and_proof: both.differentiation_and_proof!.map((d) => ({
          ...d,
          proof_points: d.proof_points!.map((p) =>
            p.semantic_id === "owned_factory"
              ? { ...p, statement: `Owned website states: ${p.statement}` }
              : p,
          ),
        })),
      };
      complete(await f.run(refreshed));
      const after = await f.catalogue.read(f.brandId);
      const changed = after.filter(
        (r) =>
          before.find(
            (p) => p.componentSemanticPath === r.componentSemanticPath,
          )?.currentComponentGenerationId !== r.currentComponentGenerationId,
      );
      expect(changed.map((r) => r.componentSemanticPath)).toEqual([
        `${proofPath(a.semantic_id, "owned_factory")}/f/statement`,
      ]);
    });
    it("failed refresh preserves current and provider errors retry via W1.0D", async () => {
      const f = await fixture(),
        first = differentiationOutput(f.prepared.evidence);
      complete(await f.run(first));
      const before = await f.catalogue.read(f.brandId);
      await f.run({ ...first, forbidden: true });
      expect(await f.catalogue.read(f.brandId)).toEqual(before);
      const retry = await f.run(
        first,
        2,
        new StructuredEvidenceExecutionError("RATE_LIMITED", 1),
      );
      expect(retry.result?.processorExecution.status).toBe("QUEUED");
      await f.retryAtNow(retry.result!.processorExecution.id);
      expect(
        (await f.worker.runOnce("differentiation-retry", 60000))
          .processorExecution.status,
      ).toBe("COMPLETED");
      expect(await f.catalogue.read(f.brandId)).toEqual(before);
    });
    it("concurrent protection rejects stale basis atomically and retries as a candidate", async () => {
      const f = await fixture(),
        first = differentiationOutput(f.prepared.evidence);
      complete(await f.run(first));
      const out: DifferentiationOutput = {
        ...first,
        differentiation_and_proof: first.differentiation_and_proof!.map(
          (d) => ({
            ...d,
            differentiator: "Brand-operated manufacturing workshop.",
          }),
        ),
      };
      const path = `${differentiatorPath("in_house_manufacturing")}/f/differentiator`;
      const count = await prisma.intelligenceObjectGeneration.count({
        where: { brandId: f.brandId },
      });
      f.dispatch.mockImplementationOnce(async (args) => {
        await f.protect(path);
        return {
          payload: args.outputSchema.parse(out),
          telemetry: { attemptCount: 1 },
        };
      });
      const raced = await f.run(out, 2);
      expect(raced.result?.processorExecution.status).toBe("QUEUED");
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(count);
      await f.retryAtNow(raced.result!.processorExecution.id);
      expect(
        (await f.worker.runOnce("differentiation-race-retry", 60000))
          .processorExecution.status,
      ).toBe("COMPLETED");
      expect(
        await prisma.intelligenceComponentCandidate.count({
          where: { brandId: f.brandId, componentSemanticPath: path },
        }),
      ).toBe(1);
    });
    it("same execution intent returns one durable execution and generation", async () => {
      const f = await fixture(),
        out = differentiationOutput(f.prepared.evidence);
      const done = await f.run(out);
      complete(done);
      const results = await Promise.all([
        f.executions.createOrReturn(done.command),
        f.executions.createOrReturn(done.command),
      ]);
      expect(results[0].execution.id).toBe(results[1].execution.id);
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(1);
    });
    it("canonical Offering refs are usable, same-Brand only, read-only and revision-manifested", async () => {
      const f = await fixture(),
        other = await fixture([]);
      const offering = await prisma.offering.create({
        data: {
          brandProfileId: f.brandId,
          name: "Workshop tools",
          type: "PRODUCT",
          url: "https://tools.example/catalogue",
          locationIds: [],
        },
      });
      await prisma.offering.create({
        data: {
          brandProfileId: other.brandId,
          name: "Foreign product",
          type: "PRODUCT",
          url: "https://foreign.example/catalogue",
          locationIds: [],
        },
      });
      const before = await prisma.offering.findMany({
        where: { brandProfileId: f.brandId },
      });
      const snapshot = await new M1CanonicalBrandStateAdapter(service).read({
        brandId: f.brandId,
        requiredSemantics: [
          "brand_name",
          "website_url",
          "industry",
          "sub_industry",
        ],
        includeOfferingFacts: true,
      });
      expect(snapshot.offeringFacts?.map((f) => f.offeringId)).toEqual([
        offering.id,
      ]);
      const fact = snapshot.offeringFacts![0];
      const ref = differentiationBusinessRef(
        `offering:${fact.offeringId}`,
        fact.businessStateReference,
      );
      const first = differentiationOutput(f.prepared.evidence);
      const out: DifferentiationOutput = {
        ...first,
        output_metadata: first.output_metadata!.map((m) => ({
          ...m,
          differentiator_metadata: {
            ...m.differentiator_metadata,
            business_state_refs: [ref],
          },
        })),
      };
      complete(await f.run(out));
      expect(
        await prisma.offering.findMany({
          where: { brandProfileId: f.brandId },
        }),
      ).toEqual(before);
      expect(
        await prisma.intelligenceBusinessStateReference.count({
          where: {
            brandId: f.brandId,
            entityType: "Offering",
            entityId: offering.id,
          },
        }),
      ).toBe(1);
      const manifest = new CanonicalStateManifestBuilder().build(snapshot);
      await prisma.offering.update({
        where: { id: offering.id },
        data: { name: "Updated canonical name" },
      });
      const next = await new M1CanonicalBrandStateAdapter(service).read({
        brandId: f.brandId,
        requiredSemantics: [
          "brand_name",
          "website_url",
          "industry",
          "sub_industry",
        ],
        includeOfferingFacts: true,
      });
      expect(new CanonicalStateManifestBuilder().build(next).hash).not.toBe(
        manifest.hash,
      );
    });
    it("cross-Brand and nonexistent proof refs fail without writes", async () => {
      const f = await fixture(),
        foreign = await fixture();
      const out = differentiationOutput(f.prepared.evidence);
      for (const ref of [
        "nonexistent",
        foreign.prepared.evidence.capabilityResults[3].evidence[0].evidenceRef,
      ]) {
        await f.run({
          ...out,
          output_metadata: out.output_metadata!.map((m) => ({
            ...m,
            proof_point_metadata: m.proof_point_metadata!.map((p) => ({
              ...p,
              evidence_refs: [ref],
            })),
          })),
        });
        expect(await f.currents()).toEqual([]);
      }
    });
    it("authenticated Brand Centre route progressively projects current and preserves it on failed refresh", async () => {
      const f = await fixture();
      const org = await prisma.organization.create({
        data: { name: "Differentiation test org" },
      });
      await prisma.brandProfile.update({
        where: { id: f.brandId },
        data: { organizationId: org.id },
      });
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          role: "BRAND",
          organizationId: org.id,
          authState: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });
      await prisma.brandTeamMember.create({
        data: {
          brandProfileId: f.brandId,
          userId: user.id,
          role: "BRAND_OWNER",
        },
      });
      const consumer = new BrandConsumerService(
        new BrandCentreAuthService(
          service,
          new BrandCentreSessionEvictionService(service),
        ),
        new M1CanonicalBrandStateAdapter(service),
        new BrandVisualStateService(service),
        new BrandLocationService(service),
        f.projection,
        new ProcessorRuntimeProjectionService(service),
      );
      const secret = randomUUID();
      const authConfig = new ConfigService({
        JWT_SECRET: secret,
        JWT_ISSUER: "differentiation-test-issuer",
        JWT_AUDIENCE: "differentiation-test-audience",
        JWT_ACCESS_TTL: "15m",
        AUTH_REFRESH_TTL: "30d",
      });
      const jwt = new JwtService();
      const sessions = new AuthSessionService(service, jwt, authConfig);
      new JwtStrategy(authConfig, sessions);
      Reflect.defineMetadata(
        "design:paramtypes",
        [BrandConsumerService],
        BrandConsumerController,
      );
      Reflect.defineMetadata("design:paramtypes", [Reflector], JwtAuthGuard);
      const module = await Test.createTestingModule({
        controllers: [BrandConsumerController],
        providers: [{ provide: BrandConsumerService, useValue: consumer }],
      })
        .overrideGuard(ThrottlerGuard)
        .useValue({ canActivate: () => true })
        .compile();
      const app = module.createNestApplication();
      await app.listen(0, "127.0.0.1");
      try {
        const token = (await sessions.create(user.id)).accessToken;
        const read = async () => {
          const response = await fetch(
            `${await app.getUrl()}/api/v1/brand-centre/brand`,
            { headers: { authorization: `Bearer ${token}` } },
          );
          expect(response.status).toBe(200);
          return response.json() as Promise<{
            brandIdentity: {
              differentiation: {
                current: { kind: string; value?: unknown };
                readiness: string;
                resultReadiness: string;
              };
            };
          }>;
        };
        expect((await read()).brandIdentity.differentiation.current.kind).toBe(
          "NO_CURRENT",
        );
        complete(
          await f.run(differentiationOutput(f.prepared.evidence, false)),
        );
        expect((await read()).brandIdentity.differentiation.readiness).toBe(
          "PARTIAL",
        );
        const out = differentiationOutput(f.prepared.evidence);
        complete(await f.run(out));
        expect((await read()).brandIdentity.differentiation.readiness).toBe(
          "READY",
        );
        expect(
          (await read()).brandIdentity.differentiation.current.value,
        ).toEqual(out.differentiation_and_proof);
        await f.run({ ...out, extra: "invalid" });
        expect(
          (await read()).brandIdentity.differentiation.current.value,
        ).toEqual(out.differentiation_and_proof);
      } finally {
        await app.close();
      }
    });
  },
);
