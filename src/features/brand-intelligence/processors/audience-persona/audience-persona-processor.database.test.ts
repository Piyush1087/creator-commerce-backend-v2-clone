import "reflect-metadata";
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
import { AudiencePersonaPersistenceHook } from "./audience-persona-persistence.hook";
import { StructuredAudiencePersonaModelProvider } from "./audience-persona-model.provider";
import { AUDIENCE_OBJECT, type AudienceOutput } from "./audience-persona.types";
import { AudiencePersonaProcessorExecutor } from "./audience-persona-processor.executor";
import { AudiencePersonaStateRepository } from "./audience-persona-state.repository";
import { personaPath } from "./audience-persona-identity";
import {
  capabilities,
  contracts,
  audienceOutput,
  persona,
  supersession,
  registryKey,
  scope,
} from "./audience-persona.test-fixtures";

const enabled = process.env.AUDIENCE_PERSONA_DATABASE_TEST === "true";
describe.skipIf(!enabled)(
  "audience_persona_synthesis real PostgreSQL vertical slice",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { maxWait: 10_000 },
    });
    const service = prisma as unknown as PrismaService;
    afterAll(async () => {
      await prisma.$disconnect();
    });

    async function fixture(
      selected: readonly (typeof capabilities)[number][] = [capabilities[0]],
      generic = false,
    ) {
      const acquire = selected.length > 0;
      const brandId = randomUUID();
      await prisma.brandProfile.create({
        data: {
          id: brandId,
          domain: `audience-${brandId}.example`,
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
              ? "We are an innovative company with premium quality."
              : pathname === "/products"
                ? "Solutions for small teams evaluating reliable creator partnership workflows."
                : pathname === "/about"
                  ? "We are a platform for small teams evaluating reliable creator partnership workflows."
                  : "We help small teams build reliable creator partnership workflows.";
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
        for (const capabilityId of selected) {
          const request = await acquisition.request({
            brandId: asBrandId(brandId),
            capabilityId,
            freshnessIntent: "REUSE_ALLOWED",
            normalizationContractVersion: "1.0",
            requestKey: randomUUID(),
            ownedWebsiteRoot: `https://audience-${brandId}.example/`,
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
      let output: unknown = acquire ? audienceOutput(prepared.evidence) : null;
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
      const model = new StructuredAudiencePersonaModelProvider(
        { execute: dispatch } as unknown as StructuredEvidenceExecutionService,
        new ConfigService(),
      );
      const catalogue = new AudiencePersonaStateRepository(service);
      const executor = new AudiencePersonaProcessorExecutor(
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
      const audience = new AudiencePersonaPersistenceHook(
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
        audience,
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
        only: readonly string[] = [AUDIENCE_OBJECT],
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
          triggerType: "AUDIENCE_TEST",
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
          ? await worker.runOnce("audience-test", 60_000)
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
              objectSemanticId: AUDIENCE_OBJECT,
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
        objectSemanticId: AUDIENCE_OBJECT,
      });
    const complete = (
      result: Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>["run"]>>,
    ) => expect(result.result?.processorExecution.status).toBe("COMPLETED");

    it.each(capabilities)(
      "one defensible Persona from only %s; no user input, Preview, or other capability required",
      async (capability) => {
        const f = await fixture([capability]);
        const output = audienceOutput(f.prepared.evidence, [persona()]);
        const calls = f.mechanics.acquire.mock.calls.length;
        complete(await f.run(output));
        expect((await project(f)).assembledValue.value).toEqual(
          output.audience_personas,
        );
        expect(f.dispatch).toHaveBeenCalledOnce();
        expect(f.mechanics.acquire).toHaveBeenCalledTimes(calls);
        expect(
          f.prepared.evidence.capabilityResults.filter(
            (c) => c.status === "NOT_REQUESTED",
          ),
        ).toHaveLength(2);
      },
    );
    it("partial Persona succeeds and complete optional dimensions can mature one Persona without a 2–3 gate", async () => {
      const f = await fixture();
      const partial = await f.run(audienceOutput(f.prepared.evidence));
      complete(partial);
      expect(partial.result?.processorExecution.resultReadiness).toBe(
        "PARTIAL",
      );
      const mature = await f.run(
        audienceOutput(
          f.prepared.evidence,
          [persona(undefined, true)],
          [persona().semantic_id],
        ),
      );
      complete(mature);
      expect(mature.result?.processorExecution.resultReadiness).toBe("READY");
    });
    it.each([null, []] as const)(
      "zero-Persona output %j is a valid completed evaluation",
      async (personas) => {
        const f = await fixture();
        const out: AudienceOutput =
          personas === null
            ? {
                audience_personas: null,
                output_metadata: null,
                reconciliation: [],
              }
            : audienceOutput(f.prepared.evidence, []);
        const result = await f.run(out);
        complete(result);
        expect(result.result?.processorExecution.resultReadiness).toBe(
          "NOT_READY",
        );
        expect((await project(f)).assembledValue).toEqual(
          personas === null
            ? { state: "EXPLICIT_NULL", value: null }
            : { state: "VALUE", value: [] },
        );
      },
    );
    it("insufficient generic Evidence and missing Evidence never invoke provider", async () => {
      for (const f of [
        await fixture([], false),
        await fixture([capabilities[0]], true),
      ]) {
        await f.run({
          audience_personas: [],
          output_metadata: [],
          reconciliation: [],
        });
        expect(f.dispatch).not.toHaveBeenCalled();
        const rows = await prisma.intelligenceProcessorExecution.findMany({
          where: { brandId: f.brandId },
        });
        expect(rows[0].status).toBe("WAITING_FOR_DEPENDENCY");
        expect(await f.currents()).toEqual([]);
      }
    });
    it("same semantic ID survives wording/case/order changes; unchanged reorder is a no-op", async () => {
      const f = await fixture();
      const a = persona(),
        b = persona("audience_large_teams");
      complete(await f.run(audienceOutput(f.prepared.evidence, [a, b])));
      const original = await f.catalogue.read(f.brandId);
      complete(
        await f.run(
          audienceOutput(
            f.prepared.evidence,
            [b, a],
            [a.semantic_id, b.semantic_id],
          ),
        ),
      );
      expect(await f.catalogue.read(f.brandId)).toEqual(original);
      const rewritten = {
        ...a,
        label: "SMALL PARTNERSHIP TEAMS",
        summary: "Lean teams looking for reliable partnership workflows.",
      };
      complete(
        await f.run(
          audienceOutput(f.prepared.evidence, [rewritten], [a.semantic_id]),
        ),
      );
      expect((await project(f)).assembledValue.value).toEqual(
        [b, rewritten].sort((x, y) =>
          x.semantic_id.localeCompare(y.semantic_id),
        ),
      );
      expect(
        (await f.currents()).filter(
          (r) => r.componentSemanticPath === personaPath(a.semantic_id),
        ),
      ).toHaveLength(1);
    });
    it("new Persona admission preserves older IDs; omitted/null prior items are not removed", async () => {
      const f = await fixture();
      const a = persona(),
        b = persona("audience_new_group");
      complete(await f.run(audienceOutput(f.prepared.evidence, [a])));
      complete(await f.run(audienceOutput(f.prepared.evidence, [b])));
      const before = (await project(f)).assembledValue;
      complete(await f.run(audienceOutput(f.prepared.evidence, [])));
      complete(
        await f.run({
          audience_personas: null,
          output_metadata: null,
          reconciliation: [],
        }),
      );
      expect((await project(f)).assembledValue).toEqual(before);
    });
    it.each(["label", "motivations/i/motivation_reliable_workflows"])(
      "protected %s discrepancy candidates independently while unprotected summary advances",
      async (suffix) => {
        const f = await fixture();
        const a = persona();
        complete(await f.run(audienceOutput(f.prepared.evidence, [a])));
        const path = `${personaPath(a.semantic_id)}/f/${suffix}`;
        const prior = await f.protect(path);
        const changed = {
          ...a,
          label: "Renamed group",
          summary: "Changed supported summary",
          motivations: [
            {
              semantic_id: "motivation_reliable_workflows",
              value: "More reliable and understandable workflows",
            },
          ],
        };
        complete(
          await f.run(
            audienceOutput(f.prepared.evidence, [changed], [a.semantic_id]),
          ),
        );
        const candidate =
          await prisma.intelligenceComponentCandidate.findFirstOrThrow({
            where: { brandId: f.brandId, componentSemanticPath: path },
          });
        expect(candidate.basisCurrentComponentGenerationId).toBe(prior);
        expect(
          (await f.currents()).find((r) => r.componentSemanticPath === path)
            ?.currentComponentGenerationId,
        ).toBe(prior);
        const values = (await project(f)).assembledValue.value as readonly {
          summary: string;
        }[];
        expect(values[0].summary).toBe(changed.summary);
      },
    );
    it("protected whole Persona cannot be overwritten through child fields", async () => {
      const f = await fixture();
      const a = persona();
      complete(await f.run(audienceOutput(f.prepared.evidence, [a])));
      const path = personaPath(a.semantic_id);
      await f.protect(path);
      const before = (await project(f)).assembledValue;
      complete(
        await f.run(
          audienceOutput(
            f.prepared.evidence,
            [{ ...a, label: "Replacement" }],
            [a.semantic_id],
          ),
        ),
      );
      expect((await project(f)).assembledValue).toEqual(before);
      expect(
        await prisma.intelligenceComponentCandidate.count({
          where: { brandId: f.brandId, componentSemanticPath: path },
        }),
      ).toBe(1);
    });
    it("ambiguous POSSIBLE_MATCH retains context without merging or admitting a new current Persona", async () => {
      const f = await fixture();
      const a = persona();
      complete(await f.run(audienceOutput(f.prepared.evidence, [a])));
      const before = (await project(f)).assembledValue;
      const candidate = persona("audience_possible");
      const output = audienceOutput(f.prepared.evidence, [candidate]);
      complete(
        await f.run({
          ...output,
          reconciliation: [
            {
              candidate_ref: candidate.semantic_id,
              relationship: "POSSIBLE_MATCH",
              matched_persona_semantic_id: a.semantic_id,
            },
          ],
        }),
      );
      expect((await project(f)).assembledValue).toEqual(before);
      const generation =
        await prisma.intelligenceObjectGeneration.findFirstOrThrow({
          where: { brandId: f.brandId },
          orderBy: { createdAt: "desc" },
        });
      expect(JSON.stringify(generation.objectMetadataPayload)).toContain(
        "POSSIBLE_MATCH",
      );
      expect(
        (await f.currents()).some((r) =>
          r.componentSemanticPath.includes(candidate.semantic_id),
        ),
      ).toBe(false);
    });
    it.each(["merge", "split"] as const)(
      "%s uses new IDs and reciprocal supersession lineage while retaining historical Personas",
      async (kind) => {
        const f = await fixture();
        const sources =
          kind === "merge"
            ? [persona("source_a"), persona("source_b")]
            : [persona("source_a")];
        complete(await f.run(audienceOutput(f.prepared.evidence, sources)));
        const successors =
          kind === "merge"
            ? [persona("successor_unified")]
            : [persona("successor_a"), persona("successor_b")];
        const out = audienceOutput(
          f.prepared.evidence,
          [
            ...sources.map((p) => ({ ...p, lifecycle: "SUPERSEDED" as const })),
            ...successors,
          ],
          sources.map((p) => p.semantic_id),
        );
        complete(
          await f.run(
            supersession(
              out,
              Object.fromEntries(
                sources.map((p) => [
                  p.semantic_id,
                  successors.map((s) => s.semantic_id),
                ]),
              ),
            ),
          ),
        );
        const values = (await project(f)).assembledValue.value as readonly {
          semantic_id: string;
          lifecycle: string;
        }[];
        expect(
          values
            .filter((p) => p.lifecycle === "SUPERSEDED")
            .map((p) => p.semantic_id)
            .sort(),
        ).toEqual(sources.map((p) => p.semantic_id).sort());
        expect(
          values
            .filter((p) => p.lifecycle === "ACTIVE")
            .map((p) => p.semantic_id)
            .sort(),
        ).toEqual(successors.map((p) => p.semantic_id).sort());
        const history = await prisma.intelligenceComponentGeneration.findMany({
          where: {
            brandId: f.brandId,
            componentSemanticPath: `${personaPath(sources[0].semantic_id)}/f/lifecycle`,
          },
        });
        expect(history.map((g) => g.valuePayload).sort()).toEqual([
          "ACTIVE",
          "SUPERSEDED",
        ]);
        expect(JSON.stringify(history)).toContain("superseded_by_ref");
      },
    );
    it("protected-source supersession remains held; no new active successor can bypass protected semantics", async () => {
      const f = await fixture();
      const a = persona("source_a");
      complete(await f.run(audienceOutput(f.prepared.evidence, [a])));
      await f.protect(`${personaPath(a.semantic_id)}/f/label`);
      const before = (await project(f)).assembledValue;
      const out = audienceOutput(
        f.prepared.evidence,
        [{ ...a, lifecycle: "SUPERSEDED" }, persona("successor_a")],
        [a.semantic_id],
      );
      complete(await f.run(supersession(out, { source_a: ["successor_a"] })));
      expect((await project(f)).assembledValue).toEqual(before);
    });
    it("inactive Persona retains the same identity/history and can be reused without deletion", async () => {
      const f = await fixture();
      const a = persona();
      complete(await f.run(audienceOutput(f.prepared.evidence, [a])));
      complete(
        await f.run(
          audienceOutput(
            f.prepared.evidence,
            [{ ...a, lifecycle: "INACTIVE" }],
            [a.semantic_id],
          ),
        ),
      );
      expect(
        ((await project(f)).assembledValue.value as { lifecycle: string }[])[0]
          .lifecycle,
      ).toBe("INACTIVE");
      complete(
        await f.run(audienceOutput(f.prepared.evidence, [a], [a.semantic_id])),
      );
      expect(
        ((await project(f)).assembledValue.value as { lifecycle: string }[])[0]
          .lifecycle,
      ).toBe("ACTIVE");
    });
    it("failed provider/semantic refresh preserves current; replay does not duplicate generations", async () => {
      const f = await fixture();
      const output = audienceOutput(f.prepared.evidence);
      const first = await f.run(output);
      complete(first);
      const before = await f.catalogue.read(f.brandId);
      const count = await prisma.intelligenceObjectGeneration.count({
        where: { brandId: f.brandId },
      });
      await f.executions.createOrReturn(first.command);
      await expect(f.worker.runOnce("replay", 60000)).rejects.toMatchObject({
        code: "NO_ELIGIBLE_WORK",
      });
      expect(
        await prisma.intelligenceObjectGeneration.count({
          where: { brandId: f.brandId },
        }),
      ).toBe(count);
      await f.run(
        output,
        1,
        new StructuredEvidenceExecutionError("PROVIDER_UNAVAILABLE", 1),
      );
      expect(await f.catalogue.read(f.brandId)).toEqual(before);
      await f.run(
        audienceOutput(
          f.prepared.evidence,
          [{ ...persona(), demographic_context: { age: "18-24" } }],
          [persona().semantic_id],
        ),
      );
      expect(await f.catalogue.read(f.brandId)).toEqual(before);
    });
    it("non-current Evidence cannot establish a Persona even when broadly representative", async () => {
      const f = await fixture();
      vi.spyOn(f.adapter, "read").mockResolvedValue({
        ...f.prepared.evidence,
        capabilityResults: f.prepared.evidence.capabilityResults.map((c) => ({
          ...c,
          evidence: c.evidence.map((e) => ({
            ...e,
            freshness: { ...e.freshness, state: "POSSIBLY_STALE" as const },
          })),
        })),
      });
      await f.run(audienceOutput(f.prepared.evidence));
      expect(f.dispatch).not.toHaveBeenCalled();
      expect(await f.currents()).toEqual([]);
      expect(
        (
          await prisma.intelligenceProcessorExecution.findFirstOrThrow({
            where: { brandId: f.brandId },
          })
        ).status,
      ).toBe("WAITING_FOR_DEPENDENCY");
    });
    it("narrow scope updates an existing field but cannot admit a partial new identity", async () => {
      const f = await fixture();
      const a = persona();
      complete(await f.run(audienceOutput(f.prepared.evidence, [a])));
      const changed = {
        ...a,
        label: "Reworded existing Persona",
        summary: "Outside selected scope",
      };
      complete(
        await f.run(
          audienceOutput(f.prepared.evidence, [changed], [a.semantic_id]),
          1,
          undefined,
          [AUDIENCE_OBJECT],
          `${personaPath(a.semantic_id)}/f/label`,
        ),
      );
      expect((await project(f)).assembledValue.value).toEqual([
        { ...a, label: changed.label },
      ]);
      const before = await f.catalogue.read(f.brandId);
      const fresh = persona("new_partial_identity");
      await f.run(
        audienceOutput(f.prepared.evidence, [fresh]),
        1,
        undefined,
        [AUDIENCE_OBJECT],
        `${personaPath(fresh.semantic_id)}/f/label`,
      );
      expect(await f.catalogue.read(f.brandId)).toEqual(before);
    });
    it("historical supersession links survive later refresh and cannot be rewritten", async () => {
      const f = await fixture();
      const source = persona("historical_source"),
        target = persona("historical_successor");
      complete(await f.run(audienceOutput(f.prepared.evidence, [source])));
      const merged = supersession(
        audienceOutput(
          f.prepared.evidence,
          [{ ...source, lifecycle: "SUPERSEDED" }, target],
          [source.semantic_id],
        ),
        { [source.semantic_id]: [target.semantic_id] },
      );
      complete(await f.run(merged));
      const refresh = {
        ...merged,
        reconciliation: merged.reconciliation.map((r) => ({
          ...r,
          relationship: "SAME_PERSONA" as const,
          matched_persona_semantic_id: r.candidate_ref,
        })),
      };
      const before = await f.catalogue.read(f.brandId);
      complete(await f.run(refresh));
      expect(await f.catalogue.read(f.brandId)).toEqual(before);
      await f.run({
        ...refresh,
        output_metadata: refresh.output_metadata!.map((m) => ({
          ...m,
          field_metadata: {
            ...m.field_metadata,
            lifecycle: {
              ...m.field_metadata.lifecycle,
              supersedes_ref: undefined,
              superseded_by_ref: undefined,
            },
          },
        })),
      });
      expect(await f.catalogue.read(f.brandId)).toEqual(before);
    });
    it("a concurrent protection change rejects the old basis and retries through W1.0D", async () => {
      const f = await fixture();
      const a = persona();
      complete(await f.run(audienceOutput(f.prepared.evidence, [a])));
      const out = audienceOutput(
        f.prepared.evidence,
        [{ ...a, label: "Disputed revision" }],
        [a.semantic_id],
      );
      const count = await prisma.intelligenceObjectGeneration.count({
        where: { brandId: f.brandId },
      });
      f.dispatch.mockImplementationOnce(async (args) => {
        await f.protect(`${personaPath(a.semantic_id)}/f/label`);
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
      const retried = await f.worker.runOnce("audience-retry", 60000);
      expect(retried.processorExecution.status).toBe("COMPLETED");
      expect(
        await prisma.intelligenceComponentCandidate.count({
          where: {
            brandId: f.brandId,
            componentSemanticPath: `${personaPath(a.semantic_id)}/f/label`,
          },
        }),
      ).toBe(1);
      expect(
        ((await project(f)).assembledValue.value as { label: string }[])[0]
          .label,
      ).toBe(a.label);
    });
    it("Brand consumer endpoint progressively exposes active Audience without exposing inactive history", async () => {
      const f = await fixture();
      const org = await prisma.organization.create({
        data: { name: "Audience test org", kind: "BRAND" },
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
        JWT_ISSUER: "audience-test-issuer",
        JWT_AUDIENCE: "audience-test-audience",
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
            audience: {
              state: { current: { kind: string }; readiness: string };
              personas: unknown[];
            };
          }>;
        };
        expect((await read()).audience.state.current.kind).toBe("NO_CURRENT");
        const a = persona();
        complete(await f.run(audienceOutput(f.prepared.evidence, [a])));
        expect((await read()).audience.personas).toEqual([a]);
        complete(
          await f.run(
            audienceOutput(
              f.prepared.evidence,
              [{ ...a, lifecycle: "INACTIVE" }],
              [a.semantic_id],
            ),
          ),
        );
        expect((await read()).audience.personas).toEqual([]);
        expect(
          (await project(f)).assembledValue.value as unknown[],
        ).toHaveLength(1);
      } finally {
        await app.close();
      }
    });
  },
);
