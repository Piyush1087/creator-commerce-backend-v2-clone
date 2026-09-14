import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import {
  CREATOR_AUDIENCE_V0_COMPONENTS,
  CREATOR_AUDIENCE_V0_CONTRACT_VERSION,
  CREATOR_AUDIENCE_V0_OBJECT_ID,
  CreatorAudienceConsumerSchema,
  type CreatorAudienceConsumer,
} from "./contracts/creator-audience-v0.contract";
import type { CreatorAudienceAcquisition } from "./creator-audience-normalizer";

const NORMALIZATION = "creator.audience.instagram.v0.1";

export type CreatorAudiencePersistenceIdentity = Readonly<{
  creatorProfileId: string;
  creatorWorkspaceId: string;
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  requestIdentity: string;
}>;

@Injectable()
export class CreatorAudienceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownerScopes: IntelligenceOwnerScopeRepository,
  ) {}

  async readCurrent(
    identity: Omit<CreatorAudiencePersistenceIdentity, "requestIdentity">,
  ) {
    const scope = await this.ownerScopes.resolve({
      kind: "CREATOR",
      creatorProfileId: identity.creatorProfileId,
      creatorWorkspaceId: identity.creatorWorkspaceId,
    });
    const rows = await this.prisma.$queryRaw<
      Array<{ value: unknown; createdAt: Date }>
    >(Prisma.sql`
      SELECT og.value_payload AS value, og.created_at AS "createdAt"
      FROM intelligence_current_components current
      JOIN intelligence_component_generations cg
        ON cg.owner_scope_id = current.owner_scope_id
       AND cg.component_generation_id = current.current_component_generation_id
      JOIN intelligence_object_generations og
        ON og.owner_scope_id = current.owner_scope_id
       AND og.object_generation_id = cg.object_generation_id
      WHERE current.owner_scope_id = ${scope.id}
        AND current.object_semantic_id = ${CREATOR_AUDIENCE_V0_OBJECT_ID}
        AND current.component_semantic_path = '$/f/source_status'
        AND (og.active_scope->>'integrationId') = ${identity.integrationId}
        AND (og.active_scope->>'providerAccountId') = ${identity.providerAccountId}
        AND (og.active_scope->>'authorizationGeneration') = ${String(identity.authorizationGeneration)}
      LIMIT 1
    `);
    if (!rows[0]) return null;
    return CreatorAudienceConsumerSchema.parse(rows[0].value);
  }

  async replay(identity: CreatorAudiencePersistenceIdentity) {
    const current = await this.readCurrent(identity);
    if (!current) return null;
    const scope = await this.ownerScopes.resolve({
      kind: "CREATOR",
      creatorProfileId: identity.creatorProfileId,
      creatorWorkspaceId: identity.creatorWorkspaceId,
    });
    const rows = await this.prisma.$queryRaw<
      Array<{ count: bigint }>
    >(Prisma.sql`
      SELECT count(*) AS count FROM data_extraction_captures
      WHERE owner_scope_id = ${scope.id}
        AND acquisition_request_key = ${identity.requestIdentity}
        AND status = 'COMPLETED'
        AND provider_integration_id = ${identity.integrationId}
        AND provider_account_id = ${identity.providerAccountId}
        AND authorization_generation = ${identity.authorizationGeneration}
    `);
    return rows[0]?.count === 1n ? current : null;
  }

  async begin(identity: CreatorAudiencePersistenceIdentity) {
    const scope = await this.ownerScopes.resolve({
      kind: "CREATOR",
      creatorProfileId: identity.creatorProfileId,
      creatorWorkspaceId: identity.creatorWorkspaceId,
    });
    const digest = hash(identity.requestIdentity);
    const resourceRef = `creator-instagram-account:${scope.id}:${hash(identity.providerAccountId)}`;
    const captureRef = `creator-audience-capture:${digest}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO data_extraction_resources
          (id, resource_ref, owner_scope_id, brand_id, source_class, resource_type,
           canonical_resource_key, canonical_resource_key_hash, canonical_url,
           provider_account_id)
        VALUES
          (${randomUUID()}, ${resourceRef}, ${scope.id}, NULL,
           'INSTAGRAM_OWNED', 'INSTAGRAM_ACCOUNT', ${resourceRef}, ${hash(resourceRef)},
           ${`instagram://creator-account/${hash(identity.providerAccountId)}`},
           ${identity.providerAccountId})
        ON CONFLICT (resource_ref) DO NOTHING
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO data_extraction_captures
          (id, capture_ref, owner_scope_id, brand_id, resource_ref,
           acquisition_request_key, status, started_at, acquisition_quality,
           provider_integration_id, provider_account_id, authorization_generation)
        VALUES
          (${randomUUID()}, ${captureRef}, ${scope.id}, NULL, ${resourceRef},
           ${identity.requestIdentity}, 'RUNNING', CURRENT_TIMESTAMP, 'PARTIAL',
           ${identity.integrationId}, ${identity.providerAccountId},
           ${identity.authorizationGeneration})
        ON CONFLICT (capture_ref) DO NOTHING
      `);
    });
    return { scopeId: scope.id, resourceRef, captureRef };
  }

  async fail(identity: CreatorAudiencePersistenceIdentity): Promise<void> {
    const digest = hash(identity.requestIdentity);
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE data_extraction_captures SET status = 'FAILED', acquisition_quality = 'UNAVAILABLE',
        quality_failure_categories = ARRAY['AUDIENCE'], quality_detail_codes = ARRAY['PROVIDER_UNAVAILABLE']
      WHERE capture_ref = ${`creator-audience-capture:${digest}`} AND status = 'RUNNING'
    `);
  }

  async publish(input: {
    identity: CreatorAudiencePersistenceIdentity;
    acquisition: CreatorAudienceAcquisition;
    value: CreatorAudienceConsumer;
  }): Promise<{ objectGenerationId: string; evidenceRefs: string[] }> {
    const refs = await this.begin(input.identity);
    const value = CreatorAudienceConsumerSchema.parse(input.value);
    const valueJson = JSON.stringify(value);
    const activeScope = {
      integrationId: input.identity.integrationId,
      providerAccountId: input.identity.providerAccountId,
      authorizationGeneration: input.identity.authorizationGeneration,
      requestIdentity: input.identity.requestIdentity,
    };
    const objectGenerationId = randomUUID();
    const actionId = randomUUID();
    const subjectId = randomUUID();
    const evidence = input.acquisition.results.map((result, index) => ({
      ref: `creator-audience-evidence:${hash(`${input.identity.requestIdentity}:${result.population}:${result.breakdown}`)}`,
      fingerprint: hash(JSON.stringify(result)),
      result,
      capability:
        result.population === "FOLLOWERS"
          ? "instagram.audience_followers"
          : "instagram.audience_engaged",
      index,
    }));
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${input.identity.requestIdentity}))`,
      );
      const existing = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT object_generation_id AS id FROM intelligence_object_generations
        WHERE owner_scope_id = ${refs.scopeId}
          AND active_scope->>'requestIdentity' = ${input.identity.requestIdentity}
        LIMIT 1
      `);
      if (existing[0]) return;
      await tx.$executeRaw(Prisma.sql`
        UPDATE data_extraction_captures SET status='COMPLETED', captured_at=${new Date(input.acquisition.capturedAt)},
          observed_at=${new Date(input.acquisition.capturedAt)}, acquisition_quality=${value.status === "READY" ? "COMPLETE" : "PARTIAL"}::"DataExtractionAcquisitionQuality",
          quality_failure_categories=ARRAY[]::text[], quality_detail_codes=${value.limitations}
        WHERE capture_ref=${refs.captureRef} AND owner_scope_id=${refs.scopeId}
      `);
      for (const item of evidence) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO data_extraction_evidence_items
            (id, evidence_ref, owner_scope_id, brand_id, capability_id,
             normalization_contract_version, resource_ref, capture_ref,
             bounded_payload, content_hash, representativeness, coverage_snapshot,
             freshness_at_emission, freshness_basis, freshness_evaluated_at,
             quality_snapshot, item_fingerprint, semantic_observation_key,
             capture_method_class)
          VALUES
             (${randomUUID()}, ${item.ref}, ${refs.scopeId}, NULL, ${item.capability},
             ${NORMALIZATION}, ${refs.resourceRef}, ${refs.captureRef},
             ${JSON.stringify(item.result)}::jsonb, ${item.fingerprint},
             'PERSISTENT_BRAND_LEVEL', 'SINGLE_RESOURCE', 'CURRENT',
             'provider current-month snapshot', ${new Date(input.acquisition.capturedAt)},
             ${item.result.availability === "AVAILABLE" ? "COMPLETE" : "UNAVAILABLE"}::"DataExtractionAcquisitionQuality",
             ${item.fingerprint}, ${`creator-audience:${item.result.population}:${item.result.breakdown}`},
             'PROVIDER_MEDIATED_FETCH')
          ON CONFLICT (evidence_ref) DO NOTHING
        `);
      }
      const subjects = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO intelligence_subjects
          (subject_id, owner_scope_id, brand_id, subject_type, subject_ref, updated_at)
        VALUES (${subjectId}, ${refs.scopeId}, NULL, 'CREATOR', ${input.identity.creatorProfileId}, CURRENT_TIMESTAMP)
        ON CONFLICT (owner_scope_id, subject_type, subject_ref)
        DO UPDATE SET updated_at = intelligence_subjects.updated_at
        RETURNING subject_id AS id
      `);
      const resolvedSubjectId = subjects[0].id;
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO intelligence_actions
          (action_id, owner_scope_id, brand_id, subject_id, action_type,
           actor_type, actor_ref, request_idempotency_key, correlation_ref,
           reason_code, requested_atomicity, outcome)
        VALUES
          (${actionId}, ${refs.scopeId}, NULL, ${resolvedSubjectId},
           'CREATOR_AUDIENCE_PUBLISH', 'SYSTEM', 'creator-audience-scheduler',
           ${input.identity.requestIdentity}, ${input.identity.requestIdentity},
           'DETERMINISTIC_AUDIENCE_SNAPSHOT', 'OBJECT_ATOMIC', 'APPLIED')
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO intelligence_object_generations
          (object_generation_id, owner_scope_id, brand_id, subject_id,
           object_semantic_id, object_contract_id, object_contract_version,
           output_contract_id, output_contract_version, producer_kind,
           producer_id, producer_version, bundle_id, bundle_version, bundle_hash,
           value_state, value_payload, value_hash, object_metadata_payload,
           readiness, freshness_at_generation, active_scope, active_scope_hash,
           generation_ordinal, action_id)
        VALUES
          (${objectGenerationId}, ${refs.scopeId}, NULL, ${resolvedSubjectId},
           ${CREATOR_AUDIENCE_V0_OBJECT_ID}, ${CREATOR_AUDIENCE_V0_OBJECT_ID},
           ${CREATOR_AUDIENCE_V0_CONTRACT_VERSION}, ${CREATOR_AUDIENCE_V0_OBJECT_ID},
           ${CREATOR_AUDIENCE_V0_CONTRACT_VERSION}, 'SYSTEM_TRANSITION_RESOLUTION',
           'creator-audience-deterministic', 'v0.1', 'creator-audience-v0', 'v0.1',
           ${hash("creator-audience-v0")}, 'VALUE', ${valueJson}::jsonb,
           ${hash(valueJson)}, ${JSON.stringify({ evidenceCount: evidence.length })}::jsonb,
           ${value.status === "READY" ? "READY" : "PARTIAL"}::"IntelligenceReadiness", 'CURRENT',
           ${JSON.stringify(activeScope)}::jsonb, ${hash(JSON.stringify(activeScope))}, 1,
           ${actionId})
      `);
      for (const [
        index,
        component,
      ] of CREATOR_AUDIENCE_V0_COMPONENTS.entries()) {
        const componentGenerationId = randomUUID();
        const componentPath = `$/f/${component}`;
        const componentValue = JSON.stringify(
          componentPayload(value, component),
        );
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO intelligence_component_generations
            (component_generation_id, owner_scope_id, brand_id, subject_id,
             object_generation_id, object_semantic_id, path_scheme_version,
             component_semantic_path, node_kind, component_contract_id,
             component_contract_version, value_state, value_payload, value_hash,
             authority, source_class, readiness, freshness_at_generation,
             metadata_payload, presentation_order)
          VALUES
            (${componentGenerationId}, ${refs.scopeId}, NULL, ${resolvedSubjectId},
             ${objectGenerationId}, ${CREATOR_AUDIENCE_V0_OBJECT_ID}, 1, ${componentPath},
             'OBJECT_FIELD', ${`creator_audience.${component}`},
             ${CREATOR_AUDIENCE_V0_CONTRACT_VERSION}, 'VALUE', ${componentValue}::jsonb,
             ${hash(componentValue)}, 'CREATOR_SHOP_DERIVED', 'INSTAGRAM_OWNED',
             ${value.status === "READY" ? "READY" : "PARTIAL"}::"IntelligenceReadiness", 'CURRENT', '{}'::jsonb, ${index})
        `);
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO intelligence_current_components
            (current_component_id, owner_scope_id, brand_id, subject_id,
             object_semantic_id, path_scheme_version, component_semantic_path,
             node_kind, current_component_generation_id, current_contract_id,
             current_contract_version, current_authority, current_source_class,
             current_readiness, current_freshness, updated_at)
          VALUES
            (${randomUUID()}, ${refs.scopeId}, NULL, ${resolvedSubjectId},
             ${CREATOR_AUDIENCE_V0_OBJECT_ID}, 1, ${componentPath}, 'OBJECT_FIELD',
             ${componentGenerationId}, ${`creator_audience.${component}`},
             ${CREATOR_AUDIENCE_V0_CONTRACT_VERSION}, 'CREATOR_SHOP_DERIVED',
             'INSTAGRAM_OWNED', ${value.status === "READY" ? "READY" : "PARTIAL"}::"IntelligenceReadiness", 'CURRENT', CURRENT_TIMESTAMP)
          ON CONFLICT (owner_scope_id, subject_id, object_semantic_id, path_scheme_version, component_semantic_path)
          DO UPDATE SET current_component_generation_id=EXCLUDED.current_component_generation_id,
            current_contract_id=EXCLUDED.current_contract_id,
            current_contract_version=EXCLUDED.current_contract_version,
            current_readiness=EXCLUDED.current_readiness,
            current_freshness=EXCLUDED.current_freshness,
            revision=intelligence_current_components.revision+1,
            updated_at=CURRENT_TIMESTAMP
        `);
        const supported = evidence.filter((item) =>
          component === "follower_audience"
            ? item.result.population === "FOLLOWERS"
            : component === "engaged_audience"
              ? item.result.population === "ENGAGED_AUDIENCE"
              : true,
        );
        for (const item of supported) {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO intelligence_evidence_references
              (evidence_reference_id, owner_scope_id, brand_id,
               object_generation_id, component_semantic_path, evidence_ref,
               capability_id, capture_id, capture_version, source_class,
               captured_at, evidence_manifest_hash)
            VALUES (${randomUUID()}, ${refs.scopeId}, NULL, ${objectGenerationId},
              ${componentPath}, ${item.ref}, ${item.capability}, ${refs.captureRef},
              ${NORMALIZATION}, 'INSTAGRAM_OWNED', ${new Date(input.acquisition.capturedAt)},
              ${hash(item.ref)})
          `);
        }
      }
    });
    return {
      objectGenerationId,
      evidenceRefs: evidence.map((item) => item.ref),
    };
  }
}

function componentPayload(
  value: CreatorAudienceConsumer,
  component: (typeof CREATOR_AUDIENCE_V0_COMPONENTS)[number],
): unknown {
  if (component === "source_status") return value.sourceStatus;
  if (component === "audience_highlights") return value.highlights;
  if (component === "follower_audience")
    return value.cohorts.find((item) => item.id === "FOLLOWERS");
  if (component === "engaged_audience")
    return value.cohorts.find((item) => item.id === "ENGAGED");
  if (component === "freshness") return value.freshness;
  return value.limitations;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
