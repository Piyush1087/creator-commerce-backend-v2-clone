import "reflect-metadata";
import { visualStyleBusinessRef } from "./visual-style-business-refs";
import { randomUUID } from "node:crypto";
import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
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
import { VisualStylePersistenceHook } from "./visual-style-persistence.hook";
import { StructuredVisualStyleModelProvider } from "./visual-style-model.provider";
import {
  VISUAL_STYLE_OBJECT,
  type VisualStyleOutput,
} from "./visual-style.types";
import { VisualStyleProcessorExecutor } from "./visual-style-processor.executor";
import { VisualStyleStateRepository } from "./visual-style-state.repository";
import { visualItemPath } from "./visual-style-identity";
import {
  capabilities,
  contracts,
  visualStyleOutput,
  registryKey,
  scope,
} from "./visual-style.test-fixtures";

const enabled = process.env.VISUAL_STYLE_DATABASE_TEST === "true";
// Disposable integration setup performs real DE writes; allow slower local disks.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
describe.skipIf(!enabled)(
  "visual_style_synthesis real PostgreSQL vertical slice",
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
          domain: `visualStyle-${brandId}.example`,
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
              html: `<html lang="en"><body style="color:#336699; font-family:Arial; border-radius:12px"><main>${paragraphs}</main>${links.map((link) => `<a href="${link}">${link}</a>`).join("")}</body></html>`,
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
            ownedWebsiteRoot: `https://visualStyle-${brandId}.example/`,
          });
          await normalization.normalize({
            brandId: asBrandId(brandId),
            capabilityExecutionRef: request.capabilityExecutionRef,
          });
        }
      const registry = contracts();
      const paths = new ComponentPathCodec();
      const ownership = new BundlePathOwnershipRegistry(registry, paths);
      const visuals = new BrandVisualStateService(service);
      const canonical = new M1CanonicalBrandStateAdapter(service, visuals);
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
      let output: unknown = visualStyleOutput(prepared.evidence);
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
      const model = new StructuredVisualStyleModelProvider(
        { execute: dispatch } as unknown as StructuredEvidenceExecutionService,
        new ConfigService(),
      );
      const catalogue = new VisualStyleStateRepository(service);
      const executor = new VisualStyleProcessorExecutor(
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
      const visualStyle = new VisualStylePersistenceHook(
        generations,
        current,
        transitions,
        validator,
        catalogue,
        visuals,
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
        undefined,
        visualStyle,
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
        only: readonly string[] = [VISUAL_STYLE_OBJECT],
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
          ? await worker.runOnce("visualStyle-test", 60_000)
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
              objectSemanticId: VISUAL_STYLE_OBJECT,
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
        canonical,
        visuals,
        dependencies,
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
            // Fixture-only: force eligibility without mixing host and database clocks.
            data: { eligibleAt: new Date(0) },
          });
        },
      };
    }

    const project = (f: Awaited<ReturnType<typeof fixture>>) =>
      f.projection.readObject({
        brandId: f.brandId,
        objectSemanticId: VISUAL_STYLE_OBJECT,
      });
    const complete = (
      result: Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>["run"]>>,
    ) =>
      expect(
        result.result?.processorExecution.status,
        result.result?.processorExecution.lastErrorCode ?? undefined,
      ).toBe("COMPLETED");

    const authority = {
      authority: "BRAND_CONFIRMED" as const,
      origin: "BRAND_EDIT" as const,
    };
    const traitPath = visualItemPath(["style_traits"], "declared_colour");
    const graphicPath = visualItemPath(
      ["graphic_treatment", "traits"],
      "declared_framing",
    );
    const revised = (
      out: ReturnType<typeof visualStyleOutput>,
    ): VisualStyleOutput => ({
      ...out,
      visual_style_profile: {
        ...out.visual_style_profile,
        summary:
          "Retained DOM declarations suggest repeated source-level patterns.",
        style_traits: out.visual_style_profile!.style_traits.map((i) => ({
          ...i,
          trait: "Source-declared colour pattern recurrence",
        })),
        graphic_treatment: {
          traits: [
            {
              semantic_id: "declared_framing",
              value: "Source-declared framing pattern recurrence",
            },
          ],
        },
      },
    });
    it("real DE lineage reaches the provider; canonical and DE state remain read-only", async () => {
      const f = await fixture(),
        out = visualStyleOutput(f.prepared.evidence);
      expect(f.prepared.dependencyEligible).toBe(true);
      const calls = f.mechanics.acquire.mock.calls.length;
      const evidenceBefore = await f.adapter.read({
        ...registryKey,
        brandId: f.brandId,
        capabilityIds: capabilities,
      });
      complete(await f.run(out));
      expect((await project(f)).assembledValue.value).toMatchObject({
        summary: out.visual_style_profile!.summary,
        style_traits: out.visual_style_profile!.style_traits,
        graphic_treatment: out.visual_style_profile!.graphic_treatment,
      });
      expect(f.dispatch).toHaveBeenCalledOnce();
      expect(f.mechanics.acquire).toHaveBeenCalledTimes(calls);
      expect(
        (
          await f.adapter.read({
            ...registryKey,
            brandId: f.brandId,
            capabilityIds: capabilities,
          })
        ).capabilityResults.map((c) => c.evidence.map((e) => e.contentHash)),
      ).toEqual(
        evidenceBefore.capabilityResults.map((c) =>
          c.evidence.map((e) => e.contentHash),
        ),
      );
      expect(await f.visuals.read(f.brandId)).toBeNull();
      expect(
        (await f.catalogue.read(f.brandId)).filter(
          (r) => r.currentAuthority === "CREATOR_SHOP_DERIVED",
        ),
      ).toHaveLength(3);
      expect(
        await prisma.intelligenceEvidenceReference.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(3);
      expect(
        (await f.catalogue.read(f.brandId)).some((r) =>
          r.componentSemanticPath.includes("visual_constraints"),
        ),
      ).toBe(false);
    });
    it.each([false, true])(
      "missing visual Evidence waits even with canonical state=%s",
      async (canonical) => {
        const f = await fixture([]);
        if (canonical)
          await f.visuals.saveColor(f.brandId, { value: "#AA3377" }, authority);
        const result = await f.run(
          visualStyleOutput(f.prepared.evidence, "null"),
        );
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
    it("absent canonical state permits PARTIAL, then READY; null preserves prior current", async () => {
      const f = await fixture();
      expect((await project(f)).assembledValue.state).toBe("NO_CURRENT");
      complete(await f.run(visualStyleOutput(f.prepared.evidence, "partial")));
      expect((await project(f)).consumerReadiness).toBe("PARTIAL");
      complete(await f.run(visualStyleOutput(f.prepared.evidence)));
      expect((await project(f)).consumerReadiness).toBe("READY");
      const before = await f.catalogue.read(f.brandId);
      complete(await f.run(visualStyleOutput(f.prepared.evidence, "null")));
      expect(await f.catalogue.read(f.brandId)).toEqual(before);
    });
    it("zero defensible components has valid null NOT_READY without filler", async () => {
      const f = await fixture(),
        result = await f.run(visualStyleOutput(f.prepared.evidence, "null"));
      complete(result);
      expect(result.result!.processorExecution.resultReadiness).toBe(
        "NOT_READY",
      );
      expect((await project(f)).assembledValue.value).toBeNull();
    });
    it("exact IDs survive wording/case/reorder; new IDs admit and omission never deletes", async () => {
      const f = await fixture(),
        first = visualStyleOutput(f.prepared.evidence);
      complete(await f.run(first));
      const both: VisualStyleOutput = {
        ...first,
        visual_style_profile: {
          ...first.visual_style_profile,
          style_traits: [
            ...first.visual_style_profile!.style_traits,
            {
              semantic_id: "distinct_exact_id",
              trait: "Source-declared colour repetition",
            },
          ],
        },
        output_metadata: {
          ...first.output_metadata,
          style_traits: [
            ...first.output_metadata.style_traits!,
            {
              ...first.output_metadata.style_traits![0],
              semantic_id: "distinct_exact_id",
            },
          ],
        },
      };
      complete(await f.run(both));
      const before = await f.catalogue.read(f.brandId);
      const changed: VisualStyleOutput = {
        ...both,
        visual_style_profile: {
          ...both.visual_style_profile,
          style_traits: [...both.visual_style_profile!.style_traits!]
            .reverse()
            .map((i) => ({ ...i, trait: i.trait.toUpperCase() })),
        },
      };
      complete(await f.run(changed));
      expect(
        (await f.catalogue.read(f.brandId)).map((r) => [
          r.id,
          r.componentSemanticPath,
        ]),
      ).toEqual(before.map((r) => [r.id, r.componentSemanticPath]));
      const current = await f.catalogue.read(f.brandId);
      complete(
        await f.run({
          ...changed,
          visual_style_profile: {
            ...changed.visual_style_profile,
            style_traits: [
              ...changed.visual_style_profile!.style_traits!,
            ].reverse(),
          },
        }),
      );
      expect(await f.catalogue.read(f.brandId)).toEqual(current);
      complete(await f.run(first));
      expect(
        ((await project(f)).assembledValue.value as { style_traits: unknown[] })
          .style_traits,
      ).toHaveLength(2);
    });
    it.each([
      "$/f/summary",
      traitPath,
      traitPath + "/f/trait",
      graphicPath,
      graphicPath + "/f/value",
      "$/f/style_traits",
      "$/f/graphic_treatment",
    ])(
      "protected %s preserves current and records conflict, no equivalent candidate",
      async (path) => {
        const f = await fixture(),
          out = visualStyleOutput(f.prepared.evidence);
        complete(await f.run(out));
        const id = await f.protect(path);
        complete(await f.run(out));
        expect(
          await prisma.intelligenceComponentCandidate.count({
            where: { brandId: f.brandId },
          }),
        ).toBe(0);
        complete(await f.run(revised(out)));
        expect(
          (await f.catalogue.read(f.brandId)).find(
            (r) => r.componentSemanticPath === path,
          )!.currentComponentGenerationId,
        ).toBe(id);
        expect(
          await prisma.intelligenceComponentCandidate.count({
            where: { brandId: f.brandId, componentSemanticPath: path },
          }),
        ).toBe(1);
        if (path === traitPath || path === graphicPath) {
          const child =
            path === traitPath ? path + "/f/trait" : path + "/f/value";
          expect(
            (await f.catalogue.read(f.brandId)).find(
              (r) => r.componentSemanticPath === child,
            )!.currentComponentGeneration.valuePayload,
          ).toBe(
            path === traitPath
              ? out.visual_style_profile!.style_traits[0].trait
              : out.visual_style_profile!.graphic_treatment!.traits[0].value,
          );
        }
      },
    );
    it.each([
      ["$/f/style_traits", traitPath + "/f/trait"],
      ["$/f/graphic_treatment", graphicPath + "/f/value"],
    ])(
      "protected parent %s rejects child-only conflict scope",
      async (parent, child) => {
        const f = await fixture(),
          out = visualStyleOutput(f.prepared.evidence);
        complete(await f.run(out));
        await f.protect(parent);
        const before = await f.catalogue.read(f.brandId);
        const result = await f.run(
          revised(out),
          1,
          undefined,
          [VISUAL_STYLE_OBJECT],
          child,
        );
        expect(result.result!.processorExecution.lastErrorCode).toBe(
          "VISUAL_PROTECTED_PARENT_OUTSIDE_SCOPE",
        );
        expect(await f.catalogue.read(f.brandId)).toEqual(before);
      },
    );
    it("protected whole object rejects root and child scope bypass atomically", async () => {
      const f = await fixture(),
        out = visualStyleOutput(f.prepared.evidence);
      complete(await f.run(out));
      await f.protect("$");
      const before = await f.catalogue.read(f.brandId);
      for (const path of ["$", "$/f/summary"]) {
        const run = await f.run(
          revised(out),
          1,
          undefined,
          [VISUAL_STYLE_OBJECT],
          path,
        );
        expect(run.result!.processorExecution.status).toBe("FAILED_TERMINAL");
        expect(await f.catalogue.read(f.brandId)).toEqual(before);
      }
    });
    it("pre-existing Brand-confirmed visual constraints are retained outside generated scope", async () => {
      const f = await fixture(),
        out = visualStyleOutput(f.prepared.evidence);
      complete(await f.run(out));
      const source = (await f.catalogue.read(f.brandId)).find(
        (r) => r.componentSemanticPath === "$/f/summary",
      )!;
      const { currentComponentGeneration: g, ...c } = source;
      const itemPath = visualItemPath(
        ["visual_constraints"],
        "approved_clearspace",
      );
      const seeds = [
        {
          path: "$/f/visual_constraints",
          kind: "COLLECTION" as const,
          value: [],
        },
        {
          path: itemPath,
          kind: "SEMANTIC_ITEM" as const,
          value: { semantic_id: "approved_clearspace" },
        },
        {
          path: itemPath + "/f/rule",
          kind: "SCALAR" as const,
          value: "Preserve the Brand-approved clear space.",
        },
      ];
      // Seed an already-authorized application action; this is not processor output.
      for (const seed of seeds) {
        const id = randomUUID();
        await prisma.intelligenceComponentGeneration.create({
          data: {
            ...g,
            id,
            componentSemanticPath: seed.path,
            nodeKind: seed.kind,
            valuePayload: seed.value,
            metadataPayload: { authority: "BRAND_CONFIRMED" },
            valueHash: sha256CanonicalExecution(seed.value),
            authority: "BRAND_CONFIRMED",
            sourceClass: "BRAND_USER_INPUT",
          },
        });
        await prisma.intelligenceCurrentComponent.create({
          data: {
            ...c,
            id: randomUUID(),
            componentSemanticPath: seed.path,
            currentComponentGenerationId: id,
            currentAuthority: "BRAND_CONFIRMED",
            currentSourceClass: "BRAND_USER_INPUT",
            protectionState: "BRAND_CONFIRMED",
          },
        });
      }
      const before = (await f.catalogue.read(f.brandId)).filter((r) =>
        r.componentSemanticPath.includes("visual_constraints"),
      );
      complete(await f.run(revised(out)));
      expect(
        (await f.catalogue.read(f.brandId)).filter((r) =>
          r.componentSemanticPath.includes("visual_constraints"),
        ),
      ).toEqual(before);
      expect(
        (
          (await project(f)).assembledValue.value as {
            visual_constraints: unknown[];
          }
        ).visual_constraints,
      ).toEqual([
        {
          semantic_id: "approved_clearspace",
          rule: "Preserve the Brand-approved clear space.",
        },
      ]);
      expect(
        await prisma.intelligenceComponentCandidate.count({
          where: {
            brandId: f.brandId,
            componentSemanticPath: { contains: "visual_constraints" },
          },
        }),
      ).toBe(0);
    });
    it("failed semantic/provider refresh preserves current; W1 retry succeeds", async () => {
      const f = await fixture(),
        out = visualStyleOutput(f.prepared.evidence);
      complete(await f.run(out));
      const before = await f.catalogue.read(f.brandId);
      await f.run({ ...out, extra: "invalid" });
      expect(await f.catalogue.read(f.brandId)).toEqual(before);
      const retry = await f.run(
        out,
        2,
        new StructuredEvidenceExecutionError("RATE_LIMITED", 1),
      );
      expect(retry.result!.processorExecution.status).toBe("QUEUED");
      expect(await f.catalogue.read(f.brandId)).toEqual(before);
      expect((await project(f)).consumerReadiness).toBe("READY");
      await f.retryAtNow(retry.result!.processorExecution.id);
      expect(
        (await f.worker.runOnce("visual-retry", 60000)).processorExecution
          .status,
      ).toBe("COMPLETED");
      expect(await f.catalogue.read(f.brandId)).toEqual(before);
    });
    it("concurrent protection rolls back stale output then retries as candidate", async () => {
      const f = await fixture(),
        first = visualStyleOutput(f.prepared.evidence);
      complete(await f.run(first));
      const out = revised(first),
        count = await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        });
      f.dispatch.mockImplementationOnce(async (args) => {
        await f.protect("$/f/summary");
        return {
          payload: args.outputSchema.parse(out),
          telemetry: { attemptCount: 1 },
        };
      });
      const raced = await f.run(out, 2);
      expect(raced.result!.processorExecution.status).toBe("QUEUED");
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(count);
      await f.retryAtNow(raced.result!.processorExecution.id);
      expect(
        (await f.worker.runOnce("visual-race-retry", 60000)).processorExecution
          .status,
      ).toBe("COMPLETED");
      expect(
        await prisma.intelligenceComponentCandidate.count({
          where: { brandId: f.brandId, componentSemanticPath: "$/f/summary" },
        }),
      ).toBe(1);
    });
    it("same execution intent creates one durable generation under concurrent requests", async () => {
      const f = await fixture(),
        done = await f.run(visualStyleOutput(f.prepared.evidence));
      complete(done);
      const pair = await Promise.all([
        f.executions.createOrReturn(done.command),
        f.executions.createOrReturn(done.command),
      ]);
      expect(pair[0].execution.id).toBe(pair[1].execution.id);
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(1);
    });
    it("same-Brand durable approved references retain authority, never copy assets or mutate application state", async () => {
      const f = await fixture();
      const logo = await f.visuals.saveAsset(
        f.brandId,
        { role: "LOGO", url: "https://assets.example/canonical-logo.svg" },
        authority,
      );
      await f.visuals.selectPrimaryLogo(
        f.brandId,
        logo.id,
        (await f.visuals.read(f.brandId))!.revision,
      );
      await f.visuals.saveAsset(
        f.brandId,
        { role: "ALTERNATE_MARK", url: "https://assets.example/mark.svg" },
        authority,
      );
      await f.visuals.saveAsset(
        f.brandId,
        {
          role: "REFERENCE_IMAGE",
          url: "https://assets.example/reference.jpg",
        },
        authority,
      );
      const color = await f.visuals.saveColor(
        f.brandId,
        { value: "#AA3377" },
        authority,
      );
      await f.visuals.saveTypography(
        f.brandId,
        { family: "Canonical Family" },
        authority,
      );
      const before = await f.visuals.read(f.brandId);
      const snapshot = await f.canonical.read({
        brandId: f.brandId,
        requiredSemantics: ["brand_name"],
        includeVisualState: true,
      });
      expect(snapshot.visualState!.items).toHaveLength(5);
      expect(
        snapshot.visualState!.items.every(
          (i) => i.authority === "BRAND_CONFIRMED",
        ),
      ).toBe(true);
      const out = visualStyleOutput(f.prepared.evidence);
      const refs = snapshot.visualState!.items.map((i) =>
        visualStyleBusinessRef("visual:" + i.itemId, i.businessStateReference),
      );
      complete(
        await f.run({
          ...out,
          output_metadata: {
            ...out.output_metadata,
            summary: {
              ...out.output_metadata.summary,
              business_state_refs: refs,
            },
          },
        }),
      );
      expect(await f.visuals.read(f.brandId)).toEqual(before);
      expect(
        await prisma.intelligenceBusinessStateReference.count({
          where: {
            brandId: f.brandId,
            entityType: {
              in: [
                "BrandVisualAsset",
                "BrandVisualColor",
                "BrandVisualTypography",
              ],
            },
          },
        }),
      ).toBe(5);
      const manifest = new CanonicalStateManifestBuilder().build(snapshot);
      await f.visuals.saveColor(
        f.brandId,
        { id: color.id, expectedRevision: color.revision, value: "#BB4477" },
        authority,
      );
      const after = await f.canonical.read({
        brandId: f.brandId,
        requiredSemantics: ["brand_name"],
        includeVisualState: true,
      });
      expect(new CanonicalStateManifestBuilder().build(after).hash).not.toBe(
        manifest.hash,
      );
      expect(JSON.stringify(manifest)).not.toContain("assets.example");
    });
    it("canonical edit during provider execution invalidates stale basis without generation writes", async () => {
      const f = await fixture(),
        out = visualStyleOutput(f.prepared.evidence);
      f.dispatch.mockImplementationOnce(async (args) => {
        await f.visuals.saveColor(f.brandId, { value: "#AA3377" }, authority);
        return {
          payload: args.outputSchema.parse(out),
          telemetry: { attemptCount: 1 },
        };
      });
      const result = await f.run(out, 2);
      expect(result.result!.processorExecution.status).toBe("QUEUED");
      expect(result.result!.processorExecution.lastErrorCode).toBe(
        "VISUAL_CANONICAL_BASIS_CHANGED",
      );
      expect(await f.currents()).toEqual([]);
      // A fresh execution with the new canonical manifest is eligible.
      await prisma.intelligenceProcessorExecution.update({
        where: { id: result.result!.processorExecution.id },
        data: { eligibleAt: new Date("2100-01-01") },
      });
      complete(await f.run(out));
    });
    it("unknown and actual foreign canonical references fail without writes; legacy visual fields do not become approval", async () => {
      const f = await fixture(),
        foreign = await fixture([]);
      await f.visuals.saveColor(
        foreign.brandId,
        { value: "#AA3377" },
        authority,
      );
      const foreignSnapshot = await foreign.canonical.read({
        brandId: foreign.brandId,
        requiredSemantics: ["brand_name"],
        includeVisualState: true,
      });
      const item = foreignSnapshot.visualState!.items[0],
        out = visualStyleOutput(f.prepared.evidence);
      for (const ref of [
        "unknown",
        visualStyleBusinessRef(
          "visual:" + item.itemId,
          item.businessStateReference,
        ),
      ]) {
        const result = await f.run({
          ...out,
          output_metadata: {
            ...out.output_metadata,
            summary: {
              ...out.output_metadata.summary,
              business_state_refs: [ref],
            },
          },
        });
        expect(result.result!.processorExecution.status).toBe(
          "FAILED_TERMINAL",
        );
        expect(await f.currents()).toEqual([]);
      }
      await prisma.brandProfile.update({
        where: { id: f.brandId },
        data: {
          logoUrl: "https://legacy.example/logo.svg",
          visualIdentity: { palette: ["#AA3377"] },
        },
      });
      const snapshot = await f.canonical.read({
        brandId: f.brandId,
        requiredSemantics: ["brand_name"],
        includeVisualState: true,
      });
      expect(snapshot.visualState!.items).toEqual([]);
      expect(snapshot.visualState!.stateReference).toBeNull();
    });
    it("authenticated Brand Centre route progressively projects current and preserves it on failed refresh", async () => {
      const f = await fixture();
      const org = await prisma.organization.create({
        data: { name: "Visual style test org", kind: "BRAND" },
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
        JWT_ISSUER: "visual-style-test-issuer",
        JWT_AUDIENCE: "visual-style-test-audience",
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
            runtimeActivity: string;
            processorRuntime: {
              visual_style_synthesis: {
                activity: string;
                failure: {
                  currentPreserved: boolean;
                  retryEligible: boolean;
                } | null;
              };
            };
            visualIdentity: {
              style: {
                current: { kind: string; value?: unknown };
                readiness: string;
                resultReadiness: string;
              };
            };
          }>;
        };
        expect((await read()).visualIdentity.style.current.kind).toBe(
          "NO_CURRENT",
        );
        complete(
          await f.run(visualStyleOutput(f.prepared.evidence, "partial")),
        );
        expect((await read()).visualIdentity.style.readiness).toBe("PARTIAL");
        const out = visualStyleOutput(f.prepared.evidence);
        complete(await f.run(out));
        expect((await read()).visualIdentity.style.readiness).toBe("READY");
        expect((await read()).visualIdentity.style.current.value).toMatchObject(
          {
            summary: out.visual_style_profile!.summary,
            style_traits: out.visual_style_profile!.style_traits,
          },
        );
        const retry = await f.run(
          out,
          2,
          new StructuredEvidenceExecutionError("RATE_LIMITED", 1),
        );
        const retryRead = await read();
        expect(retryRead.runtimeActivity).toBe("NONE");
        expect(retryRead.processorRuntime.visual_style_synthesis).toMatchObject(
          {
            activity: "RETRY_SCHEDULED",
            failure: { currentPreserved: true, retryEligible: true },
          },
        );
        await f.retryAtNow(retry.result!.processorExecution.id);
        expect(
          (await f.worker.runOnce("visual-http-retry", 60000))
            .processorExecution.status,
        ).toBe("WAITING_FOR_DEPENDENCY");
        // The unchanged authenticated read touches Brand activity/updatedAt.
        // W1 correctly rejects that old canonical manifest; prepare a fresh execution.
        complete(await f.run(out));
        await f.run({ ...out, extra: "invalid" });
        expect((await read()).visualIdentity.style.current.value).toMatchObject(
          {
            summary: out.visual_style_profile!.summary,
            style_traits: out.visual_style_profile!.style_traits,
          },
        );
      } finally {
        await app.close();
      }
    });
  },
);
