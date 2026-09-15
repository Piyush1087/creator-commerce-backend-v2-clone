import { Injectable, Optional } from "@nestjs/common";
import { IntelligenceOwnerType, Prisma } from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import type { IntelligenceOwnerScope } from "../../../creator-audience/contracts/creator-audience-v0.contract";
import { InstagramImageTemporaryStore } from "../../../instagram/media/instagram-image-temporary-store";
import { InstagramVideoTemporaryStore } from "../../../instagram/media/video/instagram-video-temporary-store";

export type PersistedOwnerScope = Readonly<{
  id: string;
  ownerKey: string;
  scope: IntelligenceOwnerScope;
}>;

@Injectable()
export class IntelligenceOwnerScopeRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly imageStore?: InstagramImageTemporaryStore,
    @Optional() private readonly videoStore?: InstagramVideoTemporaryStore,
  ) {}

  async resolve(scope: IntelligenceOwnerScope): Promise<PersistedOwnerScope> {
    if (scope.kind === "BRAND") {
      const row = await this.prisma.intelligenceOwnerScope.upsert({
        where: { ownerKey: `BRAND:${scope.brandProfileId}` },
        create: {
          ownerType: IntelligenceOwnerType.BRAND,
          ownerKey: `BRAND:${scope.brandProfileId}`,
          brandProfileId: scope.brandProfileId,
        },
        update: {},
      });
      return { id: row.id, ownerKey: row.ownerKey, scope };
    }

    const workspace = await this.prisma.creatorWorkspace.findFirst({
      where: {
        id: scope.creatorWorkspaceId,
        ownerProfileId: scope.creatorProfileId,
      },
      select: { id: true },
    });
    if (!workspace) throw new Error("CREATOR_OWNER_SCOPE_MISMATCH");
    const ownerKey = `CREATOR:${scope.creatorProfileId}:${scope.creatorWorkspaceId}`;
    const row = await this.prisma.intelligenceOwnerScope.upsert({
      where: { ownerKey },
      create: {
        ownerType: IntelligenceOwnerType.CREATOR,
        ownerKey,
        creatorProfileId: scope.creatorProfileId,
        creatorWorkspaceId: scope.creatorWorkspaceId,
      },
      update: {},
    });
    return { id: row.id, ownerKey: row.ownerKey, scope };
  }

  /** Exact internal Creator Instagram purge; the canonical Creator scope survives. */
  async purgeCreatorInstagram(scopeId: string): Promise<number> {
    const target = await this.prisma.intelligenceOwnerScope.findUnique({
      where: { id: scopeId },
    });
    if (
      !target ||
      target.ownerType !== IntelligenceOwnerType.CREATOR ||
      !target.creatorProfileId
    )
      throw new Error("CREATOR_OWNER_SCOPE_REQUIRED");
    const deletedRows = await this.prisma.$transaction(async (tx) => {
      const scope = await tx.intelligenceOwnerScope.findUnique({
        where: { id: scopeId },
      });
      if (!scope || scope.ownerType !== IntelligenceOwnerType.CREATOR) {
        throw new Error("CREATOR_OWNER_SCOPE_REQUIRED");
      }
      const counts = await tx.$queryRaw<
        Array<{ deleted_count: bigint }>
      >(Prisma.sql`
        WITH
        target_resources AS MATERIALIZED (
          SELECT resource_ref FROM data_extraction_resources
          WHERE owner_scope_id=${scopeId} AND source_class='INSTAGRAM_OWNED'
        ),
        target_captures AS MATERIALIZED (
          SELECT capture_ref FROM data_extraction_captures
          WHERE owner_scope_id=${scopeId} AND resource_ref IN (SELECT resource_ref FROM target_resources)
        ),
        target_objects AS MATERIALIZED (
          SELECT object_generation_id, action_id FROM intelligence_object_generations
          WHERE owner_scope_id=${scopeId}
            AND object_semantic_id IN ('creator_audience','creator_content','creator_brand_suggestions')
        ),
        target_processors AS MATERIALIZED (
          SELECT processor_execution_id, execution_id
          FROM intelligence_processor_executions
          WHERE owner_scope_id=${scopeId}
            AND processor_id IN ('creator_audience_v0','creator_audience_v1','creator_content_v0','creator_brand_suggestions_v0')
        ),
        deleted_transitions AS (DELETE FROM intelligence_component_transitions WHERE owner_scope_id=${scopeId} AND object_semantic_id IN ('creator_audience','creator_content','creator_brand_suggestions') RETURNING 1),
        deleted_candidates AS (DELETE FROM intelligence_component_candidates WHERE owner_scope_id=${scopeId} AND object_semantic_id IN ('creator_audience','creator_content','creator_brand_suggestions') RETURNING 1),
        deleted_current AS (DELETE FROM intelligence_current_components WHERE owner_scope_id=${scopeId} AND object_semantic_id IN ('creator_audience','creator_content','creator_brand_suggestions') RETURNING 1),
        deleted_intel_evidence AS (DELETE FROM intelligence_evidence_references WHERE owner_scope_id=${scopeId} AND object_generation_id IN (SELECT object_generation_id FROM target_objects) RETURNING 1),
        deleted_business_refs AS (DELETE FROM intelligence_business_state_references WHERE owner_scope_id=${scopeId} AND object_generation_id IN (SELECT object_generation_id FROM target_objects) RETURNING 1),
        deleted_components AS (DELETE FROM intelligence_component_generations WHERE owner_scope_id=${scopeId} AND object_generation_id IN (SELECT object_generation_id FROM target_objects) RETURNING 1),
        deleted_objects AS (DELETE FROM intelligence_object_generations WHERE owner_scope_id=${scopeId} AND object_generation_id IN (SELECT object_generation_id FROM target_objects) RETURNING action_id),
        deleted_actions AS (DELETE FROM intelligence_actions WHERE owner_scope_id=${scopeId} AND action_id IN (SELECT action_id FROM deleted_objects WHERE action_id IS NOT NULL) RETURNING 1),
        deleted_attempts AS (
          DELETE FROM intelligence_processor_attempts
          WHERE owner_scope_id=${scopeId}
            AND processor_execution_id IN (SELECT processor_execution_id FROM target_processors)
            AND (SELECT count(*) FROM deleted_objects) >= 0
            AND (SELECT count(*) FROM deleted_actions) >= 0
          RETURNING 1
        ),
        deleted_processors AS (
          DELETE FROM intelligence_processor_executions
          WHERE owner_scope_id=${scopeId}
            AND processor_execution_id IN (SELECT processor_execution_id FROM target_processors)
            AND (SELECT count(*) FROM deleted_attempts) >= 0
          RETURNING 1
        ),
        deleted_executions AS (
          DELETE FROM intelligence_executions
          WHERE owner_scope_id=${scopeId}
            AND execution_id IN (SELECT execution_id FROM target_processors)
            AND NOT EXISTS (SELECT 1 FROM intelligence_processor_executions sibling WHERE sibling.owner_scope_id=intelligence_executions.owner_scope_id AND sibling.execution_id=intelligence_executions.execution_id AND sibling.processor_id NOT IN ('creator_audience_v0','creator_audience_v1','creator_content_v0','creator_brand_suggestions_v0'))
            AND (SELECT count(*) FROM deleted_processors) >= 0
          RETURNING 1
        ),
        target_observations AS MATERIALIZED (
          SELECT semantic_observation_key FROM data_extraction_semantic_observations o
          WHERE o.owner_scope_id=${scopeId}
            AND EXISTS (SELECT 1 FROM data_extraction_observation_support s JOIN data_extraction_evidence_items e ON e.owner_scope_id=s.owner_scope_id AND e.evidence_ref=s.evidence_ref WHERE s.owner_scope_id=o.owner_scope_id AND s.semantic_observation_key=o.semantic_observation_key AND e.capture_ref IN (SELECT capture_ref FROM target_captures))
            AND NOT EXISTS (SELECT 1 FROM data_extraction_observation_support s JOIN data_extraction_evidence_items e ON e.owner_scope_id=s.owner_scope_id AND e.evidence_ref=s.evidence_ref WHERE s.owner_scope_id=o.owner_scope_id AND s.semantic_observation_key=o.semantic_observation_key AND e.capture_ref NOT IN (SELECT capture_ref FROM target_captures))
        ),
        deleted_relations AS (DELETE FROM data_extraction_observation_relations WHERE owner_scope_id=${scopeId} AND (source_observation_key IN (SELECT semantic_observation_key FROM target_observations) OR target_observation_key IN (SELECT semantic_observation_key FROM target_observations)) RETURNING 1),
        deleted_supports AS (DELETE FROM data_extraction_observation_support WHERE owner_scope_id=${scopeId} AND evidence_ref IN (SELECT evidence_ref FROM data_extraction_evidence_items WHERE owner_scope_id=${scopeId} AND capture_ref IN (SELECT capture_ref FROM target_captures)) RETURNING 1),
        deleted_observations AS (DELETE FROM data_extraction_semantic_observations WHERE owner_scope_id=${scopeId} AND semantic_observation_key IN (SELECT semantic_observation_key FROM target_observations) AND (SELECT count(*) FROM deleted_supports)>=0 AND (SELECT count(*) FROM deleted_relations)>=0 RETURNING 1),
        deleted_evidence AS (DELETE FROM data_extraction_evidence_items WHERE owner_scope_id=${scopeId} AND capture_ref IN (SELECT capture_ref FROM target_captures) AND (SELECT count(*) FROM deleted_observations)>=0 RETURNING 1),
        deleted_captures AS (DELETE FROM data_extraction_captures WHERE owner_scope_id=${scopeId} AND capture_ref IN (SELECT capture_ref FROM target_captures) RETURNING 1),
        deleted_resources AS (DELETE FROM data_extraction_resources WHERE owner_scope_id=${scopeId} AND resource_ref IN (SELECT resource_ref FROM target_resources) RETURNING 1),
        deleted_sync AS (DELETE FROM instagram_intelligence_sync_jobs WHERE owner_scope_id=${scopeId} AND creator_integration_id IS NOT NULL RETURNING 1)
        SELECT (
          (SELECT count(*) FROM deleted_transitions) + (SELECT count(*) FROM deleted_candidates) +
          (SELECT count(*) FROM deleted_current) + (SELECT count(*) FROM deleted_intel_evidence) +
          (SELECT count(*) FROM deleted_business_refs) + (SELECT count(*) FROM deleted_components) +
          (SELECT count(*) FROM deleted_objects) + (SELECT count(*) FROM deleted_actions) +
          (SELECT count(*) FROM deleted_attempts) + (SELECT count(*) FROM deleted_processors) +
          (SELECT count(*) FROM deleted_executions) +
          (SELECT count(*) FROM deleted_relations) + (SELECT count(*) FROM deleted_supports) + (SELECT count(*) FROM deleted_observations) +
          (SELECT count(*) FROM deleted_evidence) + (SELECT count(*) FROM deleted_captures) +
          (SELECT count(*) FROM deleted_resources) +
          (SELECT count(*) FROM deleted_sync)
        ) AS deleted_count
      `);
      return Number(counts[0]?.deleted_count ?? 0n);
    });
    await this.imageStore?.purgeScope(`creator:${target.creatorProfileId}`);
    await this.videoStore?.purgeScope(`creator:${target.creatorProfileId}`);
    return deletedRows;
  }
}
