import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import {
  CreatorContentConsumerSchema,
  type CreatorContentConsumer,
} from "./contracts/creator-content-v0.contract";
import type { CreatorContentAcquiredMedia } from "./creator-content-calculator";
import type { CreatorContentEvidenceManifest } from "./creator-content-runtime.contract";

export type CreatorContentPersistenceIdentity = Readonly<{
  creatorProfileId: string;
  creatorWorkspaceId: string;
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  requestIdentity: string;
}>;
export type CreatorContentCurrentSnapshot = Readonly<{
  value: CreatorContentConsumer;
  generatedAt: Date;
  authorizationGeneration: number;
}>;

@Injectable()
export class CreatorContentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownerScopes: IntelligenceOwnerScopeRepository,
  ) {}

  async readCurrent(
    identity: Omit<CreatorContentPersistenceIdentity, "requestIdentity">,
  ): Promise<CreatorContentConsumer | null> {
    const current = await this.readLatestCurrentSameAccount(identity);
    return current?.authorizationGeneration === identity.authorizationGeneration
      ? current.value
      : null;
  }

  async readLatestCurrentSameAccount(
    identity: Omit<CreatorContentPersistenceIdentity, "requestIdentity">,
  ): Promise<CreatorContentCurrentSnapshot | null> {
    const scope = await this.resolveScope(identity);
    const rows = await this.prisma.$queryRaw<
      Array<{
        value: unknown;
        createdAt: Date;
        authorizationGeneration: string;
      }>
    >(Prisma.sql`
      SELECT og.value_payload AS value, og.created_at AS "createdAt", og.object_metadata_payload->>'authorizationGeneration' AS "authorizationGeneration"
      FROM intelligence_current_components current
      JOIN intelligence_component_generations cg ON cg.owner_scope_id=current.owner_scope_id AND cg.component_generation_id=current.current_component_generation_id
      JOIN intelligence_object_generations og ON og.owner_scope_id=current.owner_scope_id AND og.object_generation_id=cg.object_generation_id
      WHERE current.owner_scope_id=${scope.id} AND current.object_semantic_id='creator_content' AND current.component_semantic_path='$/f/source_status'
        AND og.object_metadata_payload->>'integrationId'=${identity.integrationId} AND og.object_metadata_payload->>'providerAccountId'=${identity.providerAccountId}
      ORDER BY og.created_at DESC LIMIT 1`);
    if (!rows[0]) return null;
    return {
      value: CreatorContentConsumerSchema.parse(rows[0].value),
      generatedAt: rows[0].createdAt,
      authorizationGeneration: Number(rows[0].authorizationGeneration),
    };
  }

  async replay(
    identity: CreatorContentPersistenceIdentity,
  ): Promise<CreatorContentConsumer | null> {
    const current = await this.readCurrent(identity);
    if (!current) return null;
    const scope = await this.resolveScope(identity);
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT count(*) count FROM data_extraction_captures capture WHERE capture.owner_scope_id=${scope.id} AND capture.acquisition_request_key=${identity.requestIdentity} AND capture.status='COMPLETED' AND capture.provider_integration_id=${identity.integrationId} AND capture.provider_account_id=${identity.providerAccountId} AND capture.authorization_generation=${identity.authorizationGeneration} AND EXISTS (SELECT 1 FROM intelligence_executions execution WHERE execution.owner_scope_id=${scope.id} AND execution.trigger_idempotency_key=${identity.requestIdentity} AND execution.status='COMPLETED')`,
    );
    return rows[0]?.count === 1n ? current : null;
  }

  async begin(identity: CreatorContentPersistenceIdentity) {
    const scope = await this.resolveScope(identity);
    const digest = hash(identity.requestIdentity);
    const resourceRef = `creator-instagram-content:${scope.id}:${hash(identity.providerAccountId)}`;
    const captureRef = `creator-content-capture:${digest}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO data_extraction_resources (id, resource_ref, owner_scope_id, brand_id, source_class, resource_type, canonical_resource_key, canonical_resource_key_hash, canonical_url, provider_account_id) VALUES (${randomUUID()}, ${resourceRef}, ${scope.id}, NULL, 'INSTAGRAM_OWNED', 'INSTAGRAM_ACCOUNT', ${resourceRef}, ${hash(resourceRef)}, ${`instagram://creator-content/${hash(identity.providerAccountId)}`}, ${identity.providerAccountId}) ON CONFLICT (resource_ref) DO NOTHING`,
      );
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO data_extraction_captures (id, capture_ref, owner_scope_id, brand_id, resource_ref, acquisition_request_key, status, started_at, acquisition_quality, provider_integration_id, provider_account_id, authorization_generation) VALUES (${randomUUID()}, ${captureRef}, ${scope.id}, NULL, ${resourceRef}, ${identity.requestIdentity}, 'RUNNING', CURRENT_TIMESTAMP, 'PARTIAL', ${identity.integrationId}, ${identity.providerAccountId}, ${identity.authorizationGeneration}) ON CONFLICT (capture_ref) DO NOTHING`,
      );
    });
    return { scopeId: scope.id, resourceRef, captureRef };
  }

  async fail(identity: CreatorContentPersistenceIdentity): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE data_extraction_captures SET status='FAILED', acquisition_quality='UNAVAILABLE', quality_failure_categories=ARRAY['CONTENT'], quality_detail_codes=ARRAY['PROVIDER_OR_SEMANTIC_UNAVAILABLE'] WHERE capture_ref=${`creator-content-capture:${hash(identity.requestIdentity)}`} AND status='RUNNING'`,
    );
  }

  async completeAcquisition(input: {
    identity: CreatorContentPersistenceIdentity;
    rows: readonly CreatorContentAcquiredMedia[];
    value: CreatorContentConsumer;
  }): Promise<CreatorContentEvidenceManifest> {
    const refs = await this.begin(input.identity);
    const value = CreatorContentConsumerSchema.parse(input.value);
    const evidence = input.rows.map((row) => ({
      evidenceRef: row.evidenceRef,
      providerMediaId: row.media.providerMediaId,
      capturedAt: value.generatedAt,
      contentHash: hash(
        JSON.stringify({
          media: value.snapshot.media.find(
            (item) => item.providerMediaId === row.media.providerMediaId,
          ),
          semantic: row.semantic,
        }),
      ),
    }));
    await this.prisma.$transaction(async (tx) => {
      await this.assertCurrentIntegration(tx, input.identity);
      const completed = await tx.$executeRaw(
        Prisma.sql`UPDATE data_extraction_captures SET status='COMPLETED', captured_at=${new Date(value.generatedAt)}, observed_at=${new Date(value.generatedAt)}, acquisition_quality=${value.status === "READY" ? "COMPLETE" : "PARTIAL"}::"DataExtractionAcquisitionQuality", quality_failure_categories=ARRAY[]::text[], quality_detail_codes=${value.limitations} WHERE capture_ref=${refs.captureRef} AND owner_scope_id=${refs.scopeId} AND status='RUNNING' AND provider_integration_id=${input.identity.integrationId} AND provider_account_id=${input.identity.providerAccountId} AND authorization_generation=${input.identity.authorizationGeneration}`,
      );
      if (completed !== 1) {
        const replay = await tx.$queryRaw<Array<{ count: bigint }>>(
          Prisma.sql`SELECT count(*) count FROM data_extraction_captures WHERE capture_ref=${refs.captureRef} AND owner_scope_id=${refs.scopeId} AND status='COMPLETED'`,
        );
        if (replay[0]?.count !== 1n)
          throw new Error("CREATOR_CONTENT_CAPTURE_STATE_CONFLICT");
      }
      for (const item of evidence) {
        const bounded = value.snapshot.media.find(
          (media) => media.providerMediaId === item.providerMediaId,
        )!;
        await tx.$executeRaw(
          Prisma.sql`INSERT INTO data_extraction_evidence_items (id, evidence_ref, owner_scope_id, brand_id, capability_id, normalization_contract_version, resource_ref, capture_ref, bounded_payload, content_hash, representativeness, coverage_snapshot, freshness_at_emission, freshness_basis, freshness_evaluated_at, quality_snapshot, item_fingerprint, semantic_observation_key, capture_method_class) VALUES (${randomUUID()}, ${item.evidenceRef}, ${refs.scopeId}, NULL, 'instagram.media_insights', 'creator.content.instagram.v0.1', ${refs.resourceRef}, ${refs.captureRef}, ${JSON.stringify(bounded)}::jsonb, ${item.contentHash}, 'CONTEXT_SPECIFIC', 'SINGLE_RESOURCE', 'CURRENT', 'authoritative provider publication and capture timestamps', ${new Date(item.capturedAt)}, ${bounded.semanticState === "AVAILABLE" ? "COMPLETE" : "PARTIAL"}::"DataExtractionAcquisitionQuality", ${item.contentHash}, ${`creator-content:${item.providerMediaId}`}, 'PROVIDER_MEDIATED_FETCH') ON CONFLICT (evidence_ref) DO NOTHING`,
        );
      }
    });
    return {
      kind: "CREATOR_CONTENT_EVIDENCE_MANIFEST_V1",
      identity: {
        ...input.identity,
        ownerScopeId: refs.scopeId,
        captureRef: refs.captureRef,
        resourceRef: refs.resourceRef,
      },
      evidence,
    };
  }

  async readProcessingTruth(input: {
    creatorProfileId: string;
    creatorWorkspaceId: string;
    integrationId: string;
    providerAccountId: string;
  }): Promise<"IDLE" | "PROCESSING" | "FAILED"> {
    const scope = await this.resolveScope(input);
    const rows = await this.prisma.$queryRaw<Array<{ state: string }>>(
      Prisma.sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM intelligence_executions WHERE owner_scope_id=${scope.id} AND status IN ('PENDING','RUNNING')) THEN 'PROCESSING' WHEN EXISTS (SELECT 1 FROM data_extraction_captures WHERE owner_scope_id=${scope.id} AND provider_integration_id=${input.integrationId} AND provider_account_id=${input.providerAccountId} AND status='FAILED' AND started_at>(SELECT COALESCE(max(captured_at), '-infinity'::timestamptz) FROM data_extraction_captures WHERE owner_scope_id=${scope.id} AND status='COMPLETED')) THEN 'FAILED' ELSE 'IDLE' END state`,
    );
    return (rows[0]?.state as "IDLE" | "PROCESSING" | "FAILED") ?? "IDLE";
  }
  async generationIdsForProcessorExecution(id: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT object_generation_id id FROM intelligence_object_generations WHERE processor_execution_id=${id} ORDER BY object_generation_id`,
    );
    return rows.map((row) => row.id);
  }
  private resolveScope(input: {
    creatorProfileId: string;
    creatorWorkspaceId: string;
  }) {
    return this.ownerScopes.resolve({
      kind: "CREATOR",
      creatorProfileId: input.creatorProfileId,
      creatorWorkspaceId: input.creatorWorkspaceId,
    });
  }
  private async assertCurrentIntegration(
    tx: Prisma.TransactionClient,
    identity: CreatorContentPersistenceIdentity,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ valid: boolean }>>(
      Prisma.sql`SELECT (creator_profile_id=${identity.creatorProfileId} AND native_platform_user_id=${identity.providerAccountId} AND authorization_generation=${identity.authorizationGeneration} AND disconnected_at IS NULL AND token_state_condition='ACTIVE'::"OAuthTokenStatus" AND authorization_health='USABLE'::"ProviderAuthorizationHealth" AND basic_authorization_capability='AVAILABLE'::"ProviderCapabilityState" AND insights_capability='AVAILABLE'::"ProviderCapabilityState") valid FROM creator_social_integrations WHERE id=${identity.integrationId} FOR UPDATE`,
    );
    if (rows[0]?.valid !== true)
      throw new Error("CREATOR_CONTENT_PERSISTENCE_FENCE_REJECTED");
  }
}
function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
