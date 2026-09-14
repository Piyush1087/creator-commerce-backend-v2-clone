import { Inject, Injectable } from "@nestjs/common";
import type { IntelligenceProcessorExecution } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { ContractRegistryKey } from "../../brand-intelligence/contracts/bundle/contract-bundle.types";
import { sha256CanonicalExecution } from "../../brand-intelligence/execution/domain/execution-hash";
import {
  CANONICAL_BRAND_STATE_READER,
  type CanonicalBrandStateReader,
} from "../../brand-intelligence/input/canonical-state/canonical-brand-state.port";
import { CanonicalStateManifestBuilder } from "../../brand-intelligence/input/canonical-state/canonical-state-manifest";
import type { PreparedProcessorDependencies } from "../../brand-intelligence/input/dependency/processor-dependency-preparation.service";
import { EvidenceManifestBuilder } from "../../brand-intelligence/input/evidence/evidence-manifest";
import {
  INTELLIGENCE_EVIDENCE_READER,
  type IntelligenceEvidenceReader,
  type NormalizedEvidenceCapabilityId,
} from "../../brand-intelligence/input/evidence/intelligence-evidence.port";
import type { ComponentSemanticAddress } from "../../brand-intelligence/semantic-path/component-path.types";
import { INSTAGRAM_DE_CONTRACT } from "../contracts/instagram-intelligence.registry";
import {
  INSTAGRAM_BRAND_SOURCE_PROFILE_VERSION,
  INSTAGRAM_BRAND_SOURCE_SCOPE,
  sourceIdentityFromManifest,
  type InstagramBrandSourceIdentity,
} from "./instagram-brand-source-profile";

const CAPABILITIES: Readonly<
  Record<string, readonly NormalizedEvidenceCapabilityId[]>
> = {
  brand_character: ["instagram.caption_context"],
  brand_communication: ["instagram.caption_context"],
  visual_style_synthesis: ["instagram.media_visual_observations"],
};

@Injectable()
export class InstagramBrandSourceAdmissionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CANONICAL_BRAND_STATE_READER)
    private readonly canonicalReader: CanonicalBrandStateReader,
    @Inject(INTELLIGENCE_EVIDENCE_READER)
    private readonly evidenceReader: IntelligenceEvidenceReader,
    private readonly canonicalManifests: CanonicalStateManifestBuilder,
    private readonly evidenceManifests: EvidenceManifestBuilder,
  ) {}

  async prepareExisting(
    execution: IntelligenceProcessorExecution,
  ): Promise<PreparedProcessorDependencies | null> {
    const identity = sourceIdentityFromManifest(execution);
    if (!identity) return null;
    return this.prepare({
      brandId: execution.brandId,
      registryKey: {
        processorId: execution.processorId,
        processorVersion: execution.processorVersion,
        outputContractId: execution.outputContractId,
        outputContractVersion: execution.outputContractVersion,
      },
      activeScope:
        execution.activeScope as unknown as ComponentSemanticAddress[],
      identity,
    });
  }

  async prepare(input: {
    brandId: string;
    registryKey: ContractRegistryKey;
    activeScope: readonly ComponentSemanticAddress[];
    identity: InstagramBrandSourceIdentity;
  }): Promise<PreparedProcessorDependencies> {
    const capabilities = CAPABILITIES[input.registryKey.processorId];
    if (!capabilities)
      throw new Error("INSTAGRAM_SOURCE_PROCESSOR_NOT_ELIGIBLE");
    const canonicalState = await this.canonicalReader.read({
      brandId: input.brandId,
      requiredSemantics: ["brand_name", "industry"],
      includeVisualState:
        input.registryKey.processorId === "visual_style_synthesis",
    });
    const evidence = await this.evidenceReader.read({
      brandId: input.brandId,
      processorId: input.registryKey.processorId,
      processorVersion: input.registryKey.processorVersion,
      capabilityIds: capabilities,
    });
    await this.assertSourceFence(input.brandId, evidence, input.identity);
    const canonical = this.canonicalManifests.build(canonicalState);
    const evidenceBase = this.evidenceManifests.build(evidence, capabilities);
    const evidenceManifest = {
      ...evidenceBase.manifest,
      sourceProfile: input.identity,
    } as const;
    const hasEvidence = evidence.capabilityResults.some(
      (result) =>
        (result.status === "AVAILABLE" || result.status === "PARTIAL") &&
        result.evidence.length > 0,
    );
    return {
      brandId: input.brandId,
      registryKey: input.registryKey,
      activeScope: input.activeScope,
      canonicalState,
      canonicalStateManifest: canonical.manifest,
      dependencyManifest: canonical.manifest,
      dependencyManifestHash: canonical.hash,
      evidence,
      evidenceManifest: evidenceManifest as never,
      evidenceManifestHash: sha256CanonicalExecution(evidenceManifest),
      readiness: {
        readiness: hasEvidence ? "READY_TO_RUN" : "WAITING_FOR_EVIDENCE",
        reasonCodes: hasEvidence ? [] : ["INSTAGRAM_EVIDENCE_INSUFFICIENT"],
      },
      dependencyEligible: hasEvidence,
      wakeUpSignals: ["NEW_EVIDENCE_CAPTURE_AVAILABLE"],
    };
  }

  private async assertSourceFence(
    brandId: string,
    evidence: Awaited<ReturnType<IntelligenceEvidenceReader["read"]>>,
    identity: InstagramBrandSourceIdentity,
  ): Promise<void> {
    if (
      identity.sourceScope !== INSTAGRAM_BRAND_SOURCE_SCOPE ||
      identity.sourceProfileVersion !==
        INSTAGRAM_BRAND_SOURCE_PROFILE_VERSION ||
      new Date(identity.windowStart) >= new Date(identity.windowEnd)
    )
      throw new Error("INSTAGRAM_SOURCE_PROFILE_INVALID");
    const queue = evidence.capabilityResults.flatMap((result) =>
      result.evidence.map((item) => item.evidenceRef),
    );
    const direct = new Map(
      evidence.capabilityResults.flatMap((result) =>
        result.evidence.map(
          (item) => [item.evidenceRef, result.capabilityId] as const,
        ),
      ),
    );
    if (
      evidence.brandId !== brandId ||
      evidence.capabilityResults.some((result) =>
        result.evidence.some(
          (item) =>
            item.brandId !== brandId ||
            item.capabilityId !== result.capabilityId ||
            item.sourceClass !== INSTAGRAM_BRAND_SOURCE_SCOPE ||
            item.acquisitionQuality.state === "UNAVAILABLE" ||
            new Date(item.capturedAt) < new Date(identity.windowStart) ||
            new Date(item.capturedAt) > new Date(identity.windowEnd),
        ),
      )
    )
      throw new Error("INSTAGRAM_EVIDENCE_SOURCE_FENCE_REJECTED");
    const visited = new Set<string>();
    while (queue.length) {
      const refs = queue.splice(0, 100).filter((ref) => !visited.has(ref));
      if (!refs.length) continue;
      const rows = await this.prisma.dataExtractionEvidenceItem.findMany({
        where: { brandId, evidenceRef: { in: refs } },
        include: { capture: true, resource: true },
      });
      if (rows.length !== refs.length)
        throw new Error("INSTAGRAM_EVIDENCE_LINEAGE_INCOMPLETE");
      for (const row of rows) {
        visited.add(row.evidenceRef);
        if (
          row.brandId !== brandId ||
          (direct.has(row.evidenceRef) &&
            direct.get(row.evidenceRef) !== row.capabilityId) ||
          !(INSTAGRAM_DE_CONTRACT.capabilities as readonly string[]).includes(
            row.capabilityId,
          ) ||
          row.resource.sourceClass !== INSTAGRAM_BRAND_SOURCE_SCOPE ||
          row.resource.providerAccountId !== identity.providerAccountId ||
          !INSTAGRAM_DE_CONTRACT.resourceTypes.includes(
            row.resource
              .resourceType as (typeof INSTAGRAM_DE_CONTRACT.resourceTypes)[number],
          ) ||
          row.resourceRef !== row.resource.resourceRef ||
          row.captureRef !== row.capture.captureRef ||
          row.capture.status !== "COMPLETED" ||
          !row.capture.capturedAt ||
          row.capture.providerAccountId !== identity.providerAccountId ||
          row.capture.authorizationGeneration !==
            identity.authorizationGeneration ||
          row.capture.capturedAt < new Date(identity.windowStart) ||
          row.capture.capturedAt > new Date(identity.windowEnd)
        )
          throw new Error("INSTAGRAM_EVIDENCE_SOURCE_FENCE_REJECTED");
        queue.push(...row.parentEvidenceRefs);
      }
    }
  }
}
