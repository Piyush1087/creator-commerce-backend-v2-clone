import { Injectable } from "@nestjs/common";
import {
  IntelligenceProcessorExecutionStatus,
  type Prisma,
} from "@prisma/client";

import { IntelligenceExecutionService } from "../../brand-intelligence/execution/intelligence-execution.service";
import { ProcessorWorkerService } from "../../brand-intelligence/execution/processor-worker.service";
import type { ComponentSemanticAddress } from "../../brand-intelligence/semantic-path/component-path.types";
import type { InstagramSyncLease } from "../sync/instagram-sync-coordinator.repository";
import { InstagramBrandSourceAdmissionService } from "./instagram-brand-source-admission.service";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  INSTAGRAM_BRAND_SOURCE_PROFILE_VERSION,
  INSTAGRAM_BRAND_SOURCE_SCOPE,
} from "./instagram-brand-source-profile";

const PROCESSORS = [
  {
    registryKey: {
      processorId: "brand_character",
      processorVersion: "1.0",
      outputContractId: "brand_character_output_contract",
      outputContractVersion: "1.0",
    },
    scopes: [
      ["brand_values", "$"],
      ["brand_personality", "$"],
    ],
  },
  {
    registryKey: {
      processorId: "brand_communication",
      processorVersion: "1.0",
      outputContractId: "brand_communication_output_contract",
      outputContractVersion: "1.0",
    },
    scopes: [
      ["communication_profile", "$"],
      ["communication_profile", "$/f/free_text_guidance"],
      ["communication_profile", "$/f/primary_language"],
    ],
  },
  {
    registryKey: {
      processorId: "visual_style_synthesis",
      processorVersion: "1.0",
      outputContractId: "visual_style_synthesis_output_contract",
      outputContractVersion: "1.0",
    },
    scopes: [["visual_style_profile", "$"]],
  },
] as const;

@Injectable()
export class InstagramHiddenBrandRuntime {
  constructor(
    private readonly admission: InstagramBrandSourceAdmissionService,
    private readonly executions: IntelligenceExecutionService,
    private readonly worker: ProcessorWorkerService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(lease: InstagramSyncLease): Promise<readonly string[]> {
    const identity = {
      sourceProfileVersion: INSTAGRAM_BRAND_SOURCE_PROFILE_VERSION,
      sourceScope: INSTAGRAM_BRAND_SOURCE_SCOPE,
      providerAccountId: lease.providerAccountId,
      authorizationGeneration: lease.authorizationGeneration,
      windowStart: new Date(
        lease.windowEnd.getTime() - 30 * 86_400_000,
      ).toISOString(),
      windowEnd: lease.windowEnd.toISOString(),
    } as const;
    const prepared = await Promise.all(
      PROCESSORS.map(async ({ registryKey, scopes }) => {
        const activeScope: readonly ComponentSemanticAddress[] = scopes.map(
          ([objectSemanticId, componentSemanticPath]) => ({
            brandId: lease.brandProfileId,
            objectSemanticId,
            pathSchemeVersion: 1,
            componentSemanticPath,
          }),
        );
        return {
          registryKey,
          activeScope,
          prepared: await this.admission.prepare({
            brandId: lease.brandProfileId,
            registryKey,
            activeScope,
            identity,
          }),
        };
      }),
    );
    const eligible = prepared.filter(
      (entry) => entry.prepared.dependencyEligible,
    );
    if (!eligible.length) return [];
    const created = await this.executions.createOrReturn({
      brandId: lease.brandProfileId,
      triggerType: "INSTAGRAM_HIDDEN_BRAND_SOURCE_REFRESH",
      triggerRef: lease.jobId,
      triggerIdempotencyKey: `instagram-hidden-brand:${lease.requestIdentity}`,
      correlationRef: `instagram-c1:${lease.jobId}`,
      requestedImpact: {
        sourceScope: INSTAGRAM_BRAND_SOURCE_SCOPE,
        mode: "GENERATION_ONLY",
        canonicalCurrentWrite: false,
        canonicalCandidateWrite: false,
      },
      processors: eligible.map(
        ({ registryKey, activeScope, prepared: snapshot }) => ({
          registryKey,
          activeScope,
          dependencyManifest:
            snapshot.dependencyManifest as unknown as Prisma.InputJsonValue,
          evidenceManifest:
            snapshot.evidenceManifest as unknown as Prisma.InputJsonValue,
          executionIntentKey: `${lease.requestIdentity}:${registryKey.processorId}:${snapshot.evidenceManifestHash}`,
          maxAttempts: 3,
          dependencyEligible: true,
        }),
      ),
    });
    for (const processor of created.processorExecutions) {
      if (processor.status !== IntelligenceProcessorExecutionStatus.COMPLETED) {
        const run = await this.worker.runExact(
          processor.id,
          `instagram-hidden-brand:${process.pid}`,
          10 * 60_000,
        );
        if (
          run.processorExecution.status !==
          IntelligenceProcessorExecutionStatus.COMPLETED
        )
          throw new Error("INSTAGRAM_HIDDEN_BRAND_EXECUTION_FAILED");
      }
    }
    const generations = await this.prisma.intelligenceObjectGeneration.findMany(
      {
        where: {
          processorExecutionId: {
            in: created.processorExecutions.map((row) => row.id),
          },
        },
        select: { id: true },
        orderBy: { id: "asc" },
      },
    );
    return generations.map((generation) => generation.id);
  }
}
