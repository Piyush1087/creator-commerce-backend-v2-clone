import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { CreatorAudienceCredentialFenceService } from "../creator-audience/creator-audience-credential-fence.service";
import { CreatorAudienceConsumerSchema } from "../creator-audience/contracts/creator-audience-v0.contract";
import {
  CREATOR_AUDIENCE_COMPONENT_PATHS,
  creatorAudienceComponentValue,
  creatorAudienceVerifiedContract,
} from "../creator-audience/creator-audience-runtime.contract";
import { CreatorContentConsumerSchema } from "../creator-content/contracts/creator-content-v0.contract";
import {
  CREATOR_CONTENT_COMPONENT_PATHS,
  creatorContentComponentValue,
  creatorContentVerifiedContract,
} from "../creator-content/creator-content-runtime.contract";
import {
  readOwnerScopedIntelligenceCurrent,
  type OwnerScopedIntelligenceCurrentRow,
} from "../brand-intelligence/projection/owner-scoped-current.read";
import { sha256Canonical } from "../brand-intelligence/contracts/bundle/canonical-json";
import {
  AudienceV1ConsumerSchema,
  AUDIENCE_V1_VERSION,
  AUDIENCE_V1_PATHS,
  audienceV1Component,
} from "./creator-audience-v1.contract";
import { AUDIENCE_V1_BUNDLE_HASH } from "./creator-audience-v1.runtime";

type ObjectRow =
  OwnerScopedIntelligenceCurrentRow["currentComponentGeneration"]["objectGeneration"];
const metadataSchema = z
  .object({
    integrationId: z.string().uuid(),
    providerAccountId: z.string().min(1),
    authorizationGeneration: z.number().int().nonnegative(),
    captureRef: z.string().min(1),
    audienceObjectGenerationId: z.string().uuid().optional(),
    contentObjectGenerationId: z.string().uuid().nullable().optional(),
  })
  .passthrough();
type Metadata = z.infer<typeof metadataSchema>;

/** Authenticated projection only: no acquisition, scope creation or execution from GET. */
@Injectable()
export class AudienceV1ConsumerService {
  constructor(
    private readonly actors: CreatorWorkspaceActorService,
    private readonly fence: CreatorAudienceCredentialFenceService,
    private readonly prisma: PrismaService,
  ) {}
  read(user: AuthUser) {
    return this.readAt(user, new Date());
  }
  async readAt(user: AuthUser, now: Date) {
    const actor = await this.actors.resolveReadOnly(user);
    if (!actor.allowedActions.includes("INSIGHTS_AUDIENCE_READ"))
      throw new ForbiddenException("Creator Audience read access required");
    const source = await this.fence.project(actor);
    return this.prisma.$transaction(
      async (tx) => {
        const scope = await tx.intelligenceOwnerScope.findFirst({
          where: {
            ownerType: "CREATOR",
            creatorProfileId: actor.subjectCreatorProfileId,
            creatorWorkspaceId: actor.workspaceId,
          },
          select: { id: true },
        });
        const subject = scope
          ? await tx.intelligenceSubject.findFirst({
              where: {
                ownerScopeId: scope.id,
                subjectRef: actor.subjectCreatorProfileId,
              },
              select: { id: true },
            })
          : null;
        let derived: {
          object: ObjectRow;
          metadata: Metadata;
          value: z.infer<typeof AudienceV1ConsumerSchema>;
        } | null = null;
        let baseline: {
          object: ObjectRow;
          metadata: Metadata;
          value: z.infer<typeof CreatorAudienceConsumerSchema>;
        } | null = null;
        let processing: "IDLE" | "PROCESSING" | "FAILED" = "IDLE";
        if (scope && source.integrationId && source.providerAccountId) {
          const rows = await readOwnerScopedIntelligenceCurrent(
            tx,
            scope.id,
            "creator_audience",
          );
          const sameAccount = (object: ObjectRow) => {
            const meta = metadataSchema.parse(object.objectMetadataPayload);
            return meta.integrationId === source.integrationId &&
              meta.providerAccountId === source.providerAccountId
              ? meta
              : null;
          };
          const derivedObject = await this.coherent(
            tx,
            rows,
            AUDIENCE_V1_PATHS,
            scope.id,
            subject?.id ?? "",
            AUDIENCE_V1_BUNDLE_HASH,
            "creator_audience_v1",
            audienceV1Component,
          );
          if (derivedObject) {
            const metadata = sameAccount(derivedObject);
            if (metadata)
              derived = {
                object: derivedObject,
                metadata,
                value: AudienceV1ConsumerSchema.parse(
                  derivedObject.valuePayload,
                ),
              };
          }
          const sourceObject = await this.coherent(
            tx,
            rows,
            CREATOR_AUDIENCE_COMPONENT_PATHS,
            scope.id,
            subject?.id ?? "",
            creatorAudienceVerifiedContract().bundle.manifest.bundleContentHash,
            "creator_audience_v0",
            creatorAudienceComponentValue,
          );
          if (sourceObject) {
            const metadata = sameAccount(sourceObject);
            if (metadata)
              baseline = {
                object: sourceObject,
                metadata,
                value: CreatorAudienceConsumerSchema.parse(
                  sourceObject.valuePayload,
                ),
              };
          }
          const states = await tx.$queryRaw<
            Array<{ state: "IDLE" | "PROCESSING" | "FAILED" }>
          >(Prisma.sql`
          SELECT CASE WHEN EXISTS(
            SELECT 1 FROM intelligence_processor_executions p WHERE p.owner_scope_id=${scope.id}
            AND p.processor_id IN ('creator_audience_v0','creator_audience_v1')
            AND p.evidence_manifest->'identity'->>'integrationId'=${source.integrationId}
            AND p.evidence_manifest->'identity'->>'providerAccountId'=${source.providerAccountId}
            AND p.status IN ('QUEUED','RUNNING','WAITING_FOR_DEPENDENCY')
          ) OR EXISTS(
            SELECT 1 FROM instagram_intelligence_sync_jobs j WHERE j.owner_scope_id=${scope.id}
            AND j.creator_integration_id=${source.integrationId} AND j.provider_account_id=${source.providerAccountId}
            AND j.status IN ('DUE','RUNNING')
          ) THEN 'PROCESSING' WHEN EXISTS(
            SELECT 1 FROM intelligence_processor_executions p WHERE p.owner_scope_id=${scope.id}
            AND p.processor_id IN ('creator_audience_v0','creator_audience_v1')
            AND p.evidence_manifest->'identity'->>'integrationId'=${source.integrationId}
            AND p.evidence_manifest->'identity'->>'providerAccountId'=${source.providerAccountId}
            AND p.status='FAILED_TERMINAL'
            AND p.created_at > ${derived?.object.createdAt ?? baseline?.object.createdAt ?? new Date(0)}
          ) OR EXISTS(
            SELECT 1 FROM data_extraction_captures c JOIN data_extraction_resources r ON r.resource_ref=c.resource_ref AND r.owner_scope_id=c.owner_scope_id
            WHERE c.owner_scope_id=${scope.id} AND c.provider_integration_id=${source.integrationId}
            AND c.provider_account_id=${source.providerAccountId} AND r.resource_type='INSTAGRAM_ACCOUNT'
            AND c.status='FAILED' AND c.started_at > ${baseline?.value.snapshotBasis.capturedAt ? new Date(baseline.value.snapshotBasis.capturedAt) : new Date(0)}
          ) THEN 'FAILED' ELSE 'IDLE' END AS state`);
          processing = states[0]?.state ?? "IDLE";
        }
        const value =
          derived?.value ??
          (baseline ? this.unprocessed(baseline.value) : this.empty());
        const current = derived ?? baseline;
        const capturedAt = value.snapshotBasis.capturedAt
          ? new Date(value.snapshotBasis.capturedAt)
          : null;
        const stale =
          capturedAt !== null &&
          now.getTime() - capturedAt.getTime() >= 192 * 3_600_000;
        const generationChanged =
          current !== null &&
          current.metadata.authorizationGeneration !==
            source.authorizationGeneration;
        const sourceChanged =
          derived !== null &&
          baseline !== null &&
          derived.metadata.audienceObjectGenerationId !== baseline.object.id;
        const effectiveProcessing =
          processing === "FAILED" ? "FAILED" : processing;
        let contentContext = value.contentContext;
        if (
          stale ||
          !source.authorized ||
          generationChanged ||
          sourceChanged ||
          effectiveProcessing !== "IDLE"
        )
          contentContext = [];
        if (contentContext.length && scope && subject && derived) {
          const contentRows = await readOwnerScopedIntelligenceCurrent(
            tx,
            scope.id,
            "creator_content",
          );
          const contentObject = await this.coherent(
            tx,
            contentRows,
            CREATOR_CONTENT_COMPONENT_PATHS,
            scope.id,
            subject.id,
            creatorContentVerifiedContract().bundle.manifest.bundleContentHash,
            "creator_content_v0",
            creatorContentComponentValue,
          );
          if (
            !contentObject ||
            contentObject.id !== derived.metadata.contentObjectGenerationId
          )
            contentContext = [];
          else {
            const content = CreatorContentConsumerSchema.parse(
              contentObject.valuePayload,
            );
            const meta = metadataSchema.parse(
              contentObject.objectMetadataPayload,
            );
            const failed = await tx.$queryRaw<
              Array<{ failed: boolean }>
            >(Prisma.sql`
            SELECT EXISTS(SELECT 1 FROM data_extraction_captures c JOIN data_extraction_captures original ON original.capture_ref=${meta.captureRef}
              WHERE c.owner_scope_id=${scope.id} AND c.resource_ref=original.resource_ref
              AND c.provider_integration_id=${source.integrationId} AND c.provider_account_id=${source.providerAccountId}
              AND c.status IN ('RUNNING','FAILED') AND c.started_at>original.captured_at) AS failed`);
            if (
              content.status !== "READY" ||
              content.sourceStatus !== "CONNECTED" ||
              content.freshness.state !== "CURRENT" ||
              content.currentPreserved ||
              meta.authorizationGeneration !== source.authorizationGeneration ||
              meta.providerAccountId !== source.providerAccountId ||
              meta.integrationId !== source.integrationId ||
              failed[0]?.failed ||
              contentContext.some(
                (row) =>
                  now.getTime() -
                    new Date(row.contentFact.capturedAt).getTime() >=
                  48 * 3_600_000,
              )
            )
              contentContext = [];
          }
        }
        return AudienceV1ConsumerSchema.parse({
          ...value,
          context: { role: actor.actorRole },
          contentContext,
          freshness: {
            state: capturedAt ? (stale ? "STALE" : "CURRENT") : "UNKNOWN",
            staleAfterHours: 192,
          },
          processingState: effectiveProcessing,
          sourceStatus:
            effectiveProcessing === "FAILED"
              ? "PROVIDER_FAILURE"
              : source.sourceStatus,
          currentPreserved:
            !!current &&
            (value.currentPreserved ||
              !source.authorized ||
              generationChanged ||
              sourceChanged ||
              effectiveProcessing === "FAILED"),
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  private unprocessed(value: z.infer<typeof CreatorAudienceConsumerSchema>) {
    return {
      ...value,
      contractVersion: AUDIENCE_V1_VERSION,
      overview: {
        accountFollowerCount:
          value.cohorts.find((row) => row.id === "FOLLOWERS")?.size ?? null,
        facts: [],
      },
      profiles: [],
      contentContext: [],
      change: { state: "NOT_PROCESSED" as const, observations: [] },
      limitations: [
        ...value.limitations
          .filter((item) => item !== "AUDIENCE_V1_NOT_PROCESSED")
          .slice(0, 15),
        "AUDIENCE_V1_NOT_PROCESSED",
      ],
    };
  }
  private empty() {
    return this.unprocessed(
      CreatorAudienceConsumerSchema.parse({
        contractVersion: "creator_audience_v0.1",
        generatedAt: new Date(0).toISOString(),
        status: "UNAVAILABLE",
        context: { role: "OWNER" },
        source: "INSTAGRAM",
        sourceStatus: "DISCONNECTED",
        snapshotBasis: {
          period: "lifetime",
          timeframe: "this_month",
          capturedAt: null,
        },
        defaultCohort: null,
        highlights: [],
        cohorts: [],
        freshness: { state: "UNKNOWN", staleAfterHours: 192 },
        processingState: "IDLE",
        currentPreserved: false,
        limitations: ["AUDIENCE_DATA_NOT_YET_AVAILABLE"],
        settingsRecoveryRoute: "/creator/settings/instagram",
      }),
    );
  }
  private async coherent(
    tx: Prisma.TransactionClient,
    rows: OwnerScopedIntelligenceCurrentRow[],
    paths: readonly string[],
    scopeId: string,
    subjectId: string,
    bundleHash: string,
    producerId: string,
    component: (value: never, path: string) => unknown,
  ): Promise<ObjectRow | null> {
    const selected = rows.filter((row) =>
      paths.includes(row.componentSemanticPath),
    );
    if (!selected.length) return null;
    if (
      selected.length !== paths.length ||
      new Set(
        selected.map(
          (row) => row.currentComponentGeneration.objectGenerationId,
        ),
      ).size !== 1
    )
      throw new Error("CREATOR_AUDIENCE_V1_CURRENT_SCOPE_INVALID");
    const object = selected[0].currentComponentGeneration.objectGeneration;
    if (
      object.ownerScopeId !== scopeId ||
      object.subjectId !== subjectId ||
      object.objectSemanticId !==
        (producerId === "creator_content_v0"
          ? "creator_content"
          : "creator_audience") ||
      object.bundleHash !== bundleHash ||
      object.producerId !== producerId ||
      object.producerVersion !== "1.0" ||
      object.valueHash !== sha256Canonical(object.valuePayload)
    )
      throw new Error("CREATOR_AUDIENCE_V1_CURRENT_HASH_INVALID");
    for (const row of selected) {
      const generation = row.currentComponentGeneration;
      if (
        row.pathSchemeVersion !== 1 ||
        generation.ownerScopeId !== scopeId ||
        generation.subjectId !== subjectId ||
        generation.componentSemanticPath !== row.componentSemanticPath ||
        generation.valueHash !== sha256Canonical(generation.valuePayload) ||
        generation.valueHash !==
          sha256Canonical(
            component(object.valuePayload as never, row.componentSemanticPath),
          )
      )
        throw new Error("CREATOR_AUDIENCE_V1_COMPONENT_INVALID");
    }
    const producer = await tx.intelligenceProcessorExecution.findFirst({
      where: {
        id: object.processorExecutionId,
        ownerScopeId: scopeId,
        processorId: producerId,
        bundleHash,
        status: "COMPLETED",
      },
      select: { id: true },
    });
    if (!producer)
      throw new Error("CREATOR_AUDIENCE_V1_CURRENT_PRODUCER_INVALID");
    return object;
  }
}
