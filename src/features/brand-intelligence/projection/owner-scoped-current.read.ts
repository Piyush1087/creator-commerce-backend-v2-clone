import { Prisma } from "@prisma/client";
export type OwnerScopedIntelligenceCurrentRow = {
  componentSemanticPath: string;
  pathSchemeVersion: number;
  currentComponentGenerationId: string;
  currentComponentGeneration: {
    objectGenerationId: string;
    ownerScopeId: string;
    subjectId: string;
    componentSemanticPath: string;
    valueHash: string;
    valuePayload: Prisma.JsonValue;
    objectGeneration: {
      id: string;
      objectSemanticId: string;
      ownerScopeId: string;
      subjectId: string;
      bundleHash: string;
      bundleId: string;
      bundleVersion: string;
      producerId: string;
      producerVersion: string;
      valueHash: string;
      valuePayload: Prisma.JsonValue;
      objectMetadataPayload: Prisma.JsonValue;
      processorExecutionId: string;
      createdAt: Date;
    };
  };
};
/** Owner-scoped SQL follows the accepted Creator runtime's nullable historical Brand arm. */
export async function readOwnerScopedIntelligenceCurrent(
  tx: Prisma.TransactionClient,
  ownerScopeId: string,
  objectSemanticId: string,
): Promise<OwnerScopedIntelligenceCurrentRow[]> {
  const rows = await tx.$queryRaw<
    Array<{ row: OwnerScopedIntelligenceCurrentRow; createdAt: Date }>
  >(Prisma.sql`
    SELECT o.created_at AS "createdAt", jsonb_build_object('componentSemanticPath',c.component_semantic_path,'pathSchemeVersion',c.path_scheme_version,'currentComponentGenerationId',c.current_component_generation_id,
      'currentComponentGeneration',jsonb_build_object('objectGenerationId',g.object_generation_id,'ownerScopeId',g.owner_scope_id,'subjectId',g.subject_id,'componentSemanticPath',g.component_semantic_path,'valueHash',g.value_hash,'valuePayload',g.value_payload,
        'objectGeneration',jsonb_build_object('id',o.object_generation_id,'objectSemanticId',o.object_semantic_id,'ownerScopeId',o.owner_scope_id,'subjectId',o.subject_id,'bundleHash',o.bundle_hash,'bundleId',o.bundle_id,'bundleVersion',o.bundle_version,'producerId',o.producer_id,'producerVersion',o.producer_version,'valueHash',o.value_hash,'valuePayload',o.value_payload,'objectMetadataPayload',o.object_metadata_payload,'processorExecutionId',o.processor_execution_id,'createdAt',o.created_at))) AS row
    FROM intelligence_current_components c JOIN intelligence_component_generations g ON g.owner_scope_id=c.owner_scope_id AND g.component_generation_id=c.current_component_generation_id
      JOIN intelligence_object_generations o ON o.owner_scope_id=g.owner_scope_id AND o.object_generation_id=g.object_generation_id
    WHERE c.owner_scope_id=${ownerScopeId} AND c.object_semantic_id=${objectSemanticId} AND c.lifecycle_status='ACTIVE'
    ORDER BY c.component_semantic_path`);
  return rows.map(({ row, createdAt }) => ({
    ...row,
    currentComponentGeneration: {
      ...row.currentComponentGeneration,
      objectGeneration: {
        ...row.currentComponentGeneration.objectGeneration,
        // Read timestamp through Prisma's scalar decoder, not timezone-less JSON text.
        createdAt,
      },
    },
  }));
}
