import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import {
  CREATOR_AUDIENCE_V0_OBJECT_ID,
  CreatorAudienceConsumerSchema,
  type CreatorAudienceConsumer,
} from "./contracts/creator-audience-v0.contract";
import type { CreatorAudienceAcquisition } from "./creator-audience-normalizer";
import type { CreatorAudienceEvidenceManifest } from "./creator-audience-runtime.contract";

const NORMALIZATION = "creator.audience.instagram.v0.1";

export type CreatorAudiencePersistenceIdentity = Readonly<{
  creatorProfileId: string;
  creatorWorkspaceId: string;
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  requestIdentity: string;
}>;

export type CreatorAudienceCurrentSnapshot = Readonly<{
  value: CreatorAudienceConsumer;
  generatedAt: Date;
  authorizationGeneration: number;
}>;

@Injectable()
export class CreatorAudienceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownerScopes: IntelligenceOwnerScopeRepository,
  ) {}

  async readCurrent(
    identity: Omit<CreatorAudiencePersistenceIdentity, "requestIdentity">,
  ): Promise<CreatorAudienceConsumer | null> {
    const snapshot = await this.readLatestCurrentSameAccount(identity);
    return snapshot?.authorizationGeneration ===
      identity.authorizationGeneration
      ? snapshot.value
      : null;
  }

  async readLatestCurrentSameAccount(
    identity: Omit<CreatorAudiencePersistenceIdentity, "requestIdentity">,
  ): Promise<CreatorAudienceCurrentSnapshot | null> {
    const scope = await this.resolveScope(identity);
    const rows = await this.prisma.$queryRaw<
      Array<{
        value: unknown;
        createdAt: Date;
        authorizationGeneration: string;
      }>
    >(Prisma.sql`
      SELECT og.value_payload AS value, og.created_at AS "createdAt",
        COALESCE(
          og.object_metadata_payload->>'authorizationGeneration',
          og.active_scope->>'authorizationGeneration'
        ) AS "authorizationGeneration"
      FROM intelligence_current_components current
      JOIN intelligence_component_generations cg
        ON cg.owner_scope_id=current.owner_scope_id
       AND cg.component_generation_id=current.current_component_generation_id
      JOIN intelligence_object_generations og
        ON og.owner_scope_id=current.owner_scope_id
       AND og.object_generation_id=cg.object_generation_id
      WHERE current.owner_scope_id=${scope.id}
        AND current.object_semantic_id=${CREATOR_AUDIENCE_V0_OBJECT_ID}
        AND current.component_semantic_path='$/f/source_status'
        AND COALESCE(
          og.object_metadata_payload->>'integrationId',
          og.active_scope->>'integrationId'
        )=${identity.integrationId}
        AND COALESCE(
          og.object_metadata_payload->>'providerAccountId',
          og.active_scope->>'providerAccountId'
        )=${identity.providerAccountId}
      ORDER BY og.created_at DESC LIMIT 1
    `);
    if (!rows[0]) return null;
    return {
      value: CreatorAudienceConsumerSchema.parse(rows[0].value),
      generatedAt: rows[0].createdAt,
      authorizationGeneration: Number(rows[0].authorizationGeneration),
    };
  }

  async replay(identity: CreatorAudiencePersistenceIdentity) {
    const current = await this.readCurrent(identity);
    if (!current) return null;
    const scope = await this.resolveScope(identity);
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT count(*) AS count FROM data_extraction_captures capture
        WHERE capture.owner_scope_id=${scope.id}
          AND capture.acquisition_request_key=${identity.requestIdentity}
          AND capture.status='COMPLETED'
          AND capture.provider_integration_id=${identity.integrationId}
          AND capture.provider_account_id=${identity.providerAccountId}
          AND capture.authorization_generation=${identity.authorizationGeneration}
          AND EXISTS (
            SELECT 1 FROM intelligence_executions execution
            WHERE execution.owner_scope_id=${scope.id}
              AND execution.trigger_idempotency_key=${identity.requestIdentity}
              AND execution.status='COMPLETED'
          )
      `,
    );
    return rows[0]?.count === 1n ? current : null;
  }

  async begin(identity: CreatorAudiencePersistenceIdentity) {
    const scope = await this.resolveScope(identity);
    const digest = hash(identity.requestIdentity);
    const resourceRef = `creator-instagram-account:${scope.id}:${hash(identity.providerAccountId)}`;
    const captureRef = `creator-audience-capture:${digest}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO data_extraction_resources
          (id, resource_ref, owner_scope_id, brand_id, source_class,
           resource_type, canonical_resource_key, canonical_resource_key_hash,
           canonical_url, provider_account_id)
        VALUES (${randomUUID()}, ${resourceRef}, ${scope.id}, NULL,
          'INSTAGRAM_OWNED', 'INSTAGRAM_ACCOUNT', ${resourceRef},
          ${hash(resourceRef)}, ${`instagram://creator-account/${hash(identity.providerAccountId)}`},
          ${identity.providerAccountId})
        ON CONFLICT (resource_ref) DO NOTHING
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO data_extraction_captures
          (id, capture_ref, owner_scope_id, brand_id, resource_ref,
           acquisition_request_key, status, started_at, acquisition_quality,
           provider_integration_id, provider_account_id,
           authorization_generation)
        VALUES (${randomUUID()}, ${captureRef}, ${scope.id}, NULL, ${resourceRef},
          ${identity.requestIdentity}, 'RUNNING', CURRENT_TIMESTAMP, 'PARTIAL',
          ${identity.integrationId}, ${identity.providerAccountId},
          ${identity.authorizationGeneration})
        ON CONFLICT (capture_ref) DO NOTHING
      `);
    });
    return { scopeId: scope.id, resourceRef, captureRef };
  }

  async fail(identity: CreatorAudiencePersistenceIdentity): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE data_extraction_captures
      SET status='FAILED', acquisition_quality='UNAVAILABLE',
        quality_failure_categories=ARRAY['AUDIENCE'],
        quality_detail_codes=ARRAY['PROVIDER_UNAVAILABLE']
      WHERE capture_ref=${`creator-audience-capture:${hash(identity.requestIdentity)}`}
        AND status='RUNNING'
    `);
  }

  /** Source-owned DE boundary; no shared Intelligence/current write occurs here. */
  async completeAcquisition(input: {
    identity: CreatorAudiencePersistenceIdentity;
    acquisition: CreatorAudienceAcquisition;
    value: CreatorAudienceConsumer;
  }): Promise<CreatorAudienceEvidenceManifest> {
    const refs = await this.begin(input.identity);
    const value = CreatorAudienceConsumerSchema.parse(input.value);
    const evidence = input.acquisition.results.map((result) => ({
      evidenceRef: `creator-audience-evidence:${hash(`${input.identity.requestIdentity}:${result.population}:${result.breakdown}`)}`,
      contentHash: hash(JSON.stringify(result)),
      result,
      capabilityId:
        result.population === "FOLLOWERS"
          ? ("instagram.audience_followers" as const)
          : ("instagram.audience_engaged" as const),
    }));
    await this.prisma.$transaction(async (tx) => {
      await this.assertCurrentIntegration(tx, input.identity);
      const completed = await tx.$executeRaw(Prisma.sql`
        UPDATE data_extraction_captures
        SET status='COMPLETED', captured_at=${new Date(input.acquisition.capturedAt)},
          observed_at=${new Date(input.acquisition.capturedAt)},
          acquisition_quality=${value.status === "READY" ? "COMPLETE" : "PARTIAL"}::"DataExtractionAcquisitionQuality",
          quality_failure_categories=ARRAY[]::text[],
          quality_detail_codes=${value.limitations}
        WHERE capture_ref=${refs.captureRef} AND owner_scope_id=${refs.scopeId}
          AND status='RUNNING'
          AND provider_integration_id=${input.identity.integrationId}
          AND provider_account_id=${input.identity.providerAccountId}
          AND authorization_generation=${input.identity.authorizationGeneration}
      `);
      if (completed !== 1) {
        const replay = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*) count FROM data_extraction_captures
          WHERE capture_ref=${refs.captureRef} AND owner_scope_id=${refs.scopeId}
            AND status='COMPLETED'
        `);
        if (replay[0]?.count !== 1n) {
          throw new Error("CREATOR_AUDIENCE_CAPTURE_STATE_CONFLICT");
        }
      }
      for (const item of evidence) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO data_extraction_evidence_items
            (id, evidence_ref, owner_scope_id, brand_id, capability_id,
             normalization_contract_version, resource_ref, capture_ref,
             bounded_payload, content_hash, representativeness,
             coverage_snapshot, freshness_at_emission, freshness_basis,
             freshness_evaluated_at, quality_snapshot, item_fingerprint,
             semantic_observation_key, capture_method_class)
          VALUES (${randomUUID()}, ${item.evidenceRef}, ${refs.scopeId}, NULL,
            ${item.capabilityId}, ${NORMALIZATION}, ${refs.resourceRef},
            ${refs.captureRef}, ${JSON.stringify(item.result)}::jsonb,
            ${item.contentHash}, 'PERSISTENT_BRAND_LEVEL', 'SINGLE_RESOURCE',
            'CURRENT', 'provider current-month snapshot',
            ${new Date(input.acquisition.capturedAt)},
            ${item.result.availability === "AVAILABLE" ? "COMPLETE" : "UNAVAILABLE"}::"DataExtractionAcquisitionQuality",
            ${item.contentHash},
            ${`creator-audience:${item.result.population}:${item.result.breakdown}`},
            'PROVIDER_MEDIATED_FETCH')
          ON CONFLICT (evidence_ref) DO NOTHING
        `);
      }
    });
    return {
      kind: "CREATOR_AUDIENCE_EVIDENCE_MANIFEST_V1",
      identity: {
        ...input.identity,
        ownerScopeId: refs.scopeId,
        captureRef: refs.captureRef,
        resourceRef: refs.resourceRef,
      },
      evidence: evidence.map((item) => ({
        evidenceRef: item.evidenceRef,
        capabilityId: item.capabilityId,
        population: item.result.population,
        breakdown: item.result.breakdown,
        capturedAt: input.acquisition.capturedAt,
        contentHash: item.contentHash,
      })),
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
      Prisma.sql`
        SELECT CASE
          WHEN EXISTS (
            SELECT 1 FROM instagram_intelligence_sync_jobs
            WHERE owner_scope_id=${scope.id}
              AND creator_integration_id=${input.integrationId}
              AND provider_account_id=${input.providerAccountId}
              AND status IN ('RUNNING','DUE')
          ) OR EXISTS (
            SELECT 1 FROM intelligence_executions
            WHERE owner_scope_id=${scope.id} AND status IN ('PENDING','RUNNING')
          ) THEN 'PROCESSING'
          WHEN EXISTS (
            SELECT 1 FROM instagram_intelligence_sync_jobs
            WHERE owner_scope_id=${scope.id}
              AND creator_integration_id=${input.integrationId}
              AND provider_account_id=${input.providerAccountId}
              AND status='BACKOFF'
          ) OR EXISTS (
            SELECT 1 FROM data_extraction_captures
            WHERE owner_scope_id=${scope.id}
              AND provider_integration_id=${input.integrationId}
              AND provider_account_id=${input.providerAccountId}
              AND status='FAILED'
              AND started_at>(
                SELECT COALESCE(max(captured_at), '-infinity'::timestamptz)
                FROM data_extraction_captures
                WHERE owner_scope_id=${scope.id} AND status='COMPLETED'
              )
          ) OR EXISTS (
            SELECT 1 FROM intelligence_executions
            WHERE owner_scope_id=${scope.id} AND status='FAILED'
              AND created_at>(
                SELECT COALESCE(max(created_at), '-infinity'::timestamptz)
                FROM intelligence_executions
                WHERE owner_scope_id=${scope.id} AND status='COMPLETED'
              )
          ) THEN 'FAILED' ELSE 'IDLE'
        END AS state
      `,
    );
    return (rows[0]?.state as "IDLE" | "PROCESSING" | "FAILED") ?? "IDLE";
  }

  async generationIdsForProcessorExecution(
    processorExecutionId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT object_generation_id AS id
      FROM intelligence_object_generations
      WHERE processor_execution_id=${processorExecutionId}
      ORDER BY object_generation_id
    `);
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
    identity: CreatorAudiencePersistenceIdentity,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
      SELECT (
        creator_profile_id=${identity.creatorProfileId}
        AND platform_network='INSTAGRAM'::"SocialNetworkProvider"
        AND native_platform_user_id=${identity.providerAccountId}
        AND authorization_generation=${identity.authorizationGeneration}
        AND disconnected_at IS NULL
        AND token_state_condition='ACTIVE'::"OAuthTokenStatus"
        AND (token_expires_at IS NULL OR token_expires_at>CURRENT_TIMESTAMP)
        AND authorization_health='USABLE'::"ProviderAuthorizationHealth"
        AND basic_authorization_capability='AVAILABLE'::"ProviderCapabilityState"
        AND insights_capability='AVAILABLE'::"ProviderCapabilityState"
        AND professional_account_type IN ('BUSINESS'::"InstagramProfessionalAccountType", 'CREATOR'::"InstagramProfessionalAccountType")
      ) AS valid
      FROM creator_social_integrations WHERE id=${identity.integrationId}
      FOR UPDATE
    `);
    if (rows[0]?.valid !== true) {
      throw new Error("CREATOR_AUDIENCE_PERSISTENCE_FENCE_REJECTED");
    }
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
