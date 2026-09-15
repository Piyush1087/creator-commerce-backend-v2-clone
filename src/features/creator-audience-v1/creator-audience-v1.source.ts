import { Injectable } from "@nestjs/common";
import { AUDIENCE_V1_BUNDLE_HASH } from "./creator-audience-v1.runtime";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import {
  canonicalJson,
  sha256Canonical,
} from "../brand-intelligence/contracts/bundle/canonical-json";
import {
  readOwnerScopedIntelligenceCurrent,
  type OwnerScopedIntelligenceCurrentRow,
} from "../brand-intelligence/projection/owner-scoped-current.read";
import { CreatorAudienceConsumerSchema } from "../creator-audience/contracts/creator-audience-v0.contract";
import { normalizeCreatorAudience } from "../creator-audience/creator-audience-normalizer";
import {
  CREATOR_AUDIENCE_COMPONENT_PATHS,
  CreatorAudienceEvidenceManifestSchema,
  CreatorAudienceProcessorInputSchema,
  creatorAudienceComponentValue,
  creatorAudienceVerifiedContract,
} from "../creator-audience/creator-audience-runtime.contract";
import { CreatorContentConsumerSchema } from "../creator-content/contracts/creator-content-v0.contract";
import { CreatorContentCurrentSourceAdapter } from "../creator-content/creator-content-current-source.adapter";
import {
  CREATOR_CONTENT_COMPONENT_PATHS,
  CreatorContentEvidenceManifestSchema,
  CreatorContentProcessorInputSchema,
  creatorContentComponentValue,
  creatorContentVerifiedContract,
} from "../creator-content/creator-content-runtime.contract";
import {
  AudienceV1ManifestSchema,
  audienceV1ReplayKey,
  type AudienceV1Manifest,
} from "./creator-audience-v1.contract";
import {
  calculateAudienceV1,
  type AudienceV1Snapshot,
  type AudienceV1Content,
} from "./creator-audience-v1.calculator";

const sourceMetadata = z
  .object({
    sourceScope: z.literal("INSTAGRAM_OWNED"),
    integrationId: z.string().uuid(),
    providerAccountId: z.string().min(1).max(100),
    authorizationGeneration: z.number().int().nonnegative(),
    requestIdentity: z.string().min(1).max(255),
    captureRef: z.string().min(1).max(255),
  })
  .strict();
const resultSchema = z
  .object({
    availability: z.enum(["AVAILABLE", "PARTIAL", "UNAVAILABLE"]),
    population: z.enum(["FOLLOWERS", "ENGAGED_AUDIENCE"]),
    breakdown: z.enum(["AGE", "GENDER", "COUNTRY", "CITY"]),
    timeframe: z.literal("THIS_MONTH"),
    values: z
      .array(
        z
          .object({
            dimension: z.string().min(1).max(100),
            value: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(45),
    denominator: z.number().finite().optional(),
    limitation: z
      .enum(["PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED", "TOP_45_PROVIDER_LIMIT"])
      .nullable(),
    failureClassification: z
      .enum([
        "RATE_LIMIT",
        "TRANSIENT",
        "AUTHORIZATION_REVALIDATION_REQUIRED",
        "PERMISSION_LOSS",
        "PROVIDER_ACCESS_BLOCKED",
        "CONTENT_OR_METRIC_UNAVAILABLE",
        "UNKNOWN",
      ])
      .optional(),
  })
  .strict();
type ObjectRow =
  OwnerScopedIntelligenceCurrentRow["currentComponentGeneration"]["objectGeneration"];
export type AudienceV1Admitted = {
  subjectId: string;
  manifest: AudienceV1Manifest;
  value: ReturnType<typeof calculateAudienceV1>;
};

/** Canonical Owner admission, no scope creation, credentials, provider, Brand or Content execution. */
@Injectable()
export class AudienceV1SourceReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentSource: CreatorContentCurrentSourceAdapter,
  ) {}
  read(actor: CreatorWorkspaceActorContext, now = new Date()) {
    return this.prisma.$transaction(
      (tx) => this.readInTransaction(tx, actor, now),
      { isolationLevel: "RepeatableRead" },
    );
  }
  async readInTransaction(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
    now = new Date(),
  ): Promise<AudienceV1Admitted | null> {
    const workspace = await tx.creatorWorkspace.findUnique({
      where: { id: actor.workspaceId },
      include: { ownerProfile: true },
    });
    if (
      !workspace ||
      workspace.ownerProfileId !== actor.subjectCreatorProfileId ||
      workspace.ownerProfile.userId !== actor.subjectOwnerUserId
    )
      this.fail("SUBJECT_MISMATCH");
    const scope = await tx.intelligenceOwnerScope.findUnique({
      where: {
        ownerKey: `CREATOR:${actor.subjectCreatorProfileId}:${actor.workspaceId}`,
      },
    });
    if (!scope) return null;
    if (
      scope.ownerType !== "CREATOR" ||
      scope.creatorProfileId !== actor.subjectCreatorProfileId ||
      scope.creatorWorkspaceId !== actor.workspaceId
    )
      this.fail("OWNER_SCOPE_MISMATCH");
    const subject = await tx.intelligenceSubject.findFirst({
      select: { id: true },
      where: {
        ownerScopeId: scope.id,
        subjectRef: actor.subjectCreatorProfileId,
      },
    });
    if (!subject) return null;
    // Deliberately select no token or encrypted credential field.
    const integration = await tx.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: actor.subjectCreatorProfileId,
          platformNetwork: "INSTAGRAM",
        },
      },
      select: {
        id: true,
        nativePlatformUserId: true,
        authorizationGeneration: true,
        disconnectedAt: true,
        tokenStateCondition: true,
        tokenExpiresAt: true,
        authorizationHealth: true,
        basicAuthorizationCapability: true,
        insightsCapability: true,
        professionalAccountType: true,
      },
    });
    if (
      !integration ||
      !integration.nativePlatformUserId ||
      integration.disconnectedAt ||
      integration.tokenStateCondition !== "ACTIVE" ||
      (integration.tokenExpiresAt && integration.tokenExpiresAt <= now) ||
      integration.authorizationHealth !== "USABLE" ||
      integration.basicAuthorizationCapability !== "AVAILABLE" ||
      integration.insightsCapability !== "AVAILABLE" ||
      !["BUSINESS", "CREATOR"].includes(
        integration.professionalAccountType ?? "",
      )
    )
      this.fail("SETTINGS_FENCE_REJECTED");
    const fence = {
      ownerScopeId: scope.id,
      subjectId: subject.id,
      integrationId: integration.id,
      providerAccountId: integration.nativePlatformUserId,
      authorizationGeneration: integration.authorizationGeneration,
    };
    const rows = (
      await readOwnerScopedIntelligenceCurrent(tx, scope.id, "creator_audience")
    ).filter((row) =>
      CREATOR_AUDIENCE_COMPONENT_PATHS.includes(row.componentSemanticPath),
    );
    if (!rows.length) return null;
    const latestObject = this.assertComponents(rows, "audience", fence);
    const latest = await this.audience(tx, latestObject, fence);
    if (latest.value.status === "UNAVAILABLE") return null;
    // Ordering is authoritative source capturedAt, not the time a retained Object was inserted.
    const historyRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT o.object_generation_id AS id FROM intelligence_object_generations o
      JOIN data_extraction_captures c ON c.capture_ref=o.object_metadata_payload->>'captureRef' AND c.owner_scope_id=o.owner_scope_id
      WHERE o.owner_scope_id=${scope.id} AND o.subject_id=${subject.id} AND o.producer_id='creator_audience_v0'
        AND o.object_generation_id<>${latestObject.id} AND c.captured_at<=${new Date(latest.capturedAt)}
      ORDER BY c.captured_at DESC, o.object_generation_id DESC LIMIT 63`);
    const history: Array<AudienceV1Snapshot | null> = [];
    for (const row of [...historyRows].reverse()) {
      const object = await tx.intelligenceObjectGeneration.findUnique({
        select: objectSelect,
        where: { id: row.id },
      });
      if (!object) {
        history.push(null);
        continue;
      }
      try {
        history.push(
          await this.audience(tx, object as unknown as ObjectRow, fence),
        );
      } catch {
        history.push(null);
      }
    }
    let content: AudienceV1Content | null = null;
    const contentRows = await readOwnerScopedIntelligenceCurrent(
      tx,
      scope.id,
      "creator_content",
    );
    if (contentRows.length) {
      try {
        const object = this.assertComponents(contentRows, "content", fence);
        const verifiedContent = await this.contentSource.readInTransaction(
          tx,
          actor,
        );
        content = verifiedContent
          ? await this.content(tx, object, fence, now)
          : null;
      } catch {
        content = null;
      } // Optional source cannot invalidate accepted Audience.
    }
    const value = calculateAudienceV1({ latest, history, content, now });
    const required = new Set([
      ...latest.evidence.map((row) => row.evidenceRef),
      ...value.change.observations.flatMap((row) => row.evidenceRefs),
      ...value.contentContext.flatMap((row) => row.contentFact.evidenceRefs),
    ]);
    const evidence = [
      ...new Map(
        [
          ...latest.evidence,
          ...history.flatMap((row) => row?.evidence ?? []),
          ...(content?.evidence ?? []),
        ]
          .filter((row) => required.has(row.evidenceRef))
          .map((row) => [row.evidenceRef, row]),
      ).values(),
    ].sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef));
    const historyIds = history.flatMap((row) =>
      row ? [row.objectGenerationId] : [],
    );
    const identity = {
      ownerScopeId: scope.id,
      creatorProfileId: actor.subjectCreatorProfileId,
      creatorWorkspaceId: actor.workspaceId,
      integrationId: integration.id,
      providerAccountId: integration.nativePlatformUserId,
      authorizationGeneration: integration.authorizationGeneration,
      captureRef: latest.evidence[0].captureRef,
      resourceRef: latest.evidence[0].resourceRef,
      audienceObjectGenerationId: latest.objectGenerationId,
      contentObjectGenerationId: value.contentContext.length
        ? content!.objectGenerationId
        : null,
      historyObjectGenerationIds: historyIds,
    };
    // Source cutoff is stable on replay; eligibility/material changes are included in inputHash.
    const requestIdentity = audienceV1ReplayKey({
      ...identity,
      evaluationTime: latest.capturedAt,
      inputHash: sha256Canonical({
        bundleHash: AUDIENCE_V1_BUNDLE_HASH,
        value,
        evidence,
        history: history.map((row) =>
          row
            ? {
                id: row.objectGenerationId,
                capturedAt: row.capturedAt,
                breakdowns: row.breakdowns,
              }
            : null,
        ),
      }),
    });
    return {
      subjectId: subject.id,
      value,
      manifest: AudienceV1ManifestSchema.parse({
        kind: "CREATOR_AUDIENCE_V1_MANIFEST",
        identity: { ...identity, requestIdentity },
        evidence,
      }),
    };
  }
  private assertComponents(
    rows: OwnerScopedIntelligenceCurrentRow[],
    kind: "audience" | "content",
    fence: Fence,
  ): ObjectRow {
    const paths =
      kind === "audience"
        ? CREATOR_AUDIENCE_COMPONENT_PATHS
        : CREATOR_CONTENT_COMPONENT_PATHS;
    if (
      rows.length !== paths.length ||
      new Set(rows.map((row) => row.componentSemanticPath)).size !==
        paths.length
    )
      this.fail("CURRENT_MANIFEST_INVALID");
    const object = rows[0].currentComponentGeneration.objectGeneration;
    const value =
      kind === "audience"
        ? CreatorAudienceConsumerSchema.parse(object.valuePayload)
        : CreatorContentConsumerSchema.parse(object.valuePayload);
    for (const row of rows) {
      const component = row.currentComponentGeneration;
      const expected =
        kind === "audience"
          ? creatorAudienceComponentValue(
              value as z.infer<typeof CreatorAudienceConsumerSchema>,
              row.componentSemanticPath,
            )
          : creatorContentComponentValue(
              value as z.infer<typeof CreatorContentConsumerSchema>,
              row.componentSemanticPath,
            );
      if (
        !paths.includes(row.componentSemanticPath) ||
        row.pathSchemeVersion !== 1 ||
        component.objectGenerationId !== object.id ||
        component.ownerScopeId !== fence.ownerScopeId ||
        component.subjectId !== fence.subjectId ||
        component.componentSemanticPath !== row.componentSemanticPath ||
        component.valueHash !== sha256Canonical(expected) ||
        canonicalJson(component.valuePayload) !== canonicalJson(expected)
      )
        this.fail("COMPONENT_IDENTITY_MISMATCH");
    }
    return object;
  }
  private async verified(
    tx: Prisma.TransactionClient,
    object: ObjectRow,
    kind: "audience" | "content",
    fence: Fence,
  ) {
    const bundle = (
      kind === "audience"
        ? creatorAudienceVerifiedContract()
        : creatorContentVerifiedContract()
    ).bundle.manifest;
    const metadata = sourceMetadata.parse(object.objectMetadataPayload);
    if (
      object.ownerScopeId !== fence.ownerScopeId ||
      object.subjectId !== fence.subjectId ||
      object.objectSemanticId !== `creator_${kind}` ||
      object.bundleHash !== bundle.bundleContentHash ||
      object.bundleId !== bundle.bundleId ||
      object.bundleVersion !== bundle.bundleVersion ||
      object.producerId !== bundle.processorId ||
      object.producerVersion !== bundle.processorVersion ||
      object.valueHash !== sha256Canonical(object.valuePayload) ||
      metadata.integrationId !== fence.integrationId ||
      metadata.providerAccountId !== fence.providerAccountId ||
      metadata.authorizationGeneration !== fence.authorizationGeneration
    )
      this.fail("SOURCE_IDENTITY_MISMATCH");
    const producer = await tx.intelligenceProcessorExecution.findUnique({
      select: {
        ownerScopeId: true,
        subjectId: true,
        status: true,
        bundleHash: true,
        evidenceManifest: true,
        evidenceManifestHash: true,
        dependencyManifest: true,
        dependencyManifestHash: true,
        processorId: true,
        processorVersion: true,
        outputContractId: true,
        outputContractVersion: true,
      },
      where: { id: object.processorExecutionId },
    });
    if (
      !producer ||
      producer.ownerScopeId !== fence.ownerScopeId ||
      producer.subjectId !== fence.subjectId ||
      producer.status !== "COMPLETED" ||
      producer.bundleHash !== bundle.bundleContentHash ||
      producer.processorId !== bundle.processorId ||
      producer.processorVersion !== bundle.processorVersion ||
      producer.outputContractId !== bundle.outputContractId ||
      producer.outputContractVersion !== bundle.outputContractVersion ||
      producer.evidenceManifestHash !==
        sha256Canonical(producer.evidenceManifest) ||
      producer.dependencyManifestHash !==
        sha256Canonical(producer.dependencyManifest)
    )
      this.fail("PRODUCER_INVALID");
    const manifest =
      kind === "audience"
        ? CreatorAudienceEvidenceManifestSchema.parse(producer.evidenceManifest)
        : CreatorContentEvidenceManifestSchema.parse(producer.evidenceManifest);
    const input =
      kind === "audience"
        ? CreatorAudienceProcessorInputSchema.parse(producer.dependencyManifest)
        : CreatorContentProcessorInputSchema.parse(producer.dependencyManifest);
    const owner = await tx.intelligenceOwnerScope.findUnique({
      select: { creatorProfileId: true, creatorWorkspaceId: true },
      where: { id: fence.ownerScopeId },
    });
    if (
      canonicalJson(input.value) !== canonicalJson(object.valuePayload) ||
      manifest.identity.ownerScopeId !== fence.ownerScopeId ||
      manifest.identity.creatorProfileId !== owner?.creatorProfileId ||
      manifest.identity.creatorWorkspaceId !== owner?.creatorWorkspaceId ||
      manifest.identity.requestIdentity !== metadata.requestIdentity ||
      manifest.identity.integrationId !== fence.integrationId ||
      manifest.identity.providerAccountId !== fence.providerAccountId ||
      manifest.identity.authorizationGeneration !==
        fence.authorizationGeneration ||
      manifest.identity.captureRef !== metadata.captureRef
    )
      this.fail("PRODUCER_MANIFEST_INVALID");
    const capture = await tx.dataExtractionCapture.findUnique({
      select: {
        ownerScopeId: true,
        status: true,
        capturedAt: true,
        providerIntegrationId: true,
        providerAccountId: true,
        authorizationGeneration: true,
        resourceRef: true,
        captureRef: true,
        acquisitionRequestKey: true,
      },
      where: { captureRef: metadata.captureRef },
    });
    if (
      !capture ||
      capture.ownerScopeId !== fence.ownerScopeId ||
      capture.status !== "COMPLETED" ||
      !capture.capturedAt ||
      capture.providerIntegrationId !== fence.integrationId ||
      capture.providerAccountId !== fence.providerAccountId ||
      capture.authorizationGeneration !== fence.authorizationGeneration ||
      capture.acquisitionRequestKey !== metadata.requestIdentity ||
      capture.resourceRef !== manifest.identity.resourceRef
    )
      this.fail("CAPTURE_IDENTITY_MISMATCH");
    const resource = await tx.dataExtractionResource.findUnique({
      select: {
        ownerScopeId: true,
        sourceClass: true,
        providerAccountId: true,
        resourceRef: true,
        resourceType: true,
      },
      where: { resourceRef: capture.resourceRef },
    });
    if (
      !resource ||
      resource.ownerScopeId !== fence.ownerScopeId ||
      resource.sourceClass !== "INSTAGRAM_OWNED" ||
      resource.resourceType !== "INSTAGRAM_ACCOUNT" ||
      resource.providerAccountId !== fence.providerAccountId
    )
      this.fail("RESOURCE_IDENTITY_MISMATCH");
    const evidence = await tx.dataExtractionEvidenceItem.findMany({
      select: evidenceSelect,
      where: {
        ownerScopeId: fence.ownerScopeId,
        evidenceRef: { in: manifest.evidence.map((row) => row.evidenceRef) },
      },
    });
    if (evidence.length !== manifest.evidence.length)
      this.fail("MISSING_EVIDENCE");
    for (const item of evidence) {
      const ref = manifest.evidence.find(
        (row) => row.evidenceRef === item.evidenceRef,
      )!;
      if (
        item.captureRef !== capture.captureRef ||
        item.resourceRef !== resource.resourceRef ||
        item.contentHash !== ref.contentHash ||
        ref.capturedAt !== capture.capturedAt.toISOString() ||
        (kind === "content"
          ? item.capabilityId !== "instagram.media_insights"
          : item.capabilityId !==
            (
              ref as z.infer<
                typeof CreatorAudienceEvidenceManifestSchema
              >["evidence"][number]
            ).capabilityId)
      )
        this.fail("EVIDENCE_IDENTITY_MISMATCH");
    }
    if (kind === "audience") {
      const references = await tx.intelligenceEvidenceReference.findMany({
        select: {
          componentSemanticPath: true,
          evidenceRef: true,
          captureId: true,
          capabilityId: true,
          capturedAt: true,
        },
        where: {
          ownerScopeId: fence.ownerScopeId,
          objectGenerationId: object.id,
        },
      });
      for (const [path, capability] of [
        ["$/f/follower_audience", "instagram.audience_followers"],
        ["$/f/engaged_audience", "instagram.audience_engaged"],
      ]) {
        const exact = references.filter(
          (row) => row.componentSemanticPath === path,
        );
        const expected = evidence
          .filter((row) => row.capabilityId === capability)
          .map((row) => row.evidenceRef)
          .sort();
        if (
          canonicalJson(exact.map((row) => row.evidenceRef).sort()) !==
            canonicalJson(expected) ||
          exact.some(
            (row) =>
              row.capabilityId !== capability ||
              row.captureId !== capture.captureRef ||
              row.capturedAt?.getTime() !== capture.capturedAt!.getTime(),
          )
        )
          this.fail("AUDIENCE_REFERENCE_LINEAGE_INVALID");
      }
    }
    return { metadata, manifest, capture, evidence };
  }
  private async audience(
    tx: Prisma.TransactionClient,
    object: ObjectRow,
    fence: Fence,
  ): Promise<AudienceV1Snapshot> {
    const value = CreatorAudienceConsumerSchema.parse(object.valuePayload);
    const admitted = await this.verified(tx, object, "audience", fence);
    const breakdowns: AudienceV1Snapshot["breakdowns"] = [];
    const results = [];
    for (const item of admitted.evidence) {
      if (
        item.captureMethodClass !== "PROVIDER_MEDIATED_FETCH" ||
        item.normalizationContractVersion !== "creator.audience.instagram.v0.1"
      )
        this.fail("AUDIENCE_NORMALIZATION_MISMATCH");
      const result = resultSchema.parse(item.boundedPayload);
      const ref = (
        admitted.manifest as z.infer<
          typeof CreatorAudienceEvidenceManifestSchema
        >
      ).evidence.find((row) => row.evidenceRef === item.evidenceRef)!;
      if (
        ref.population !== result.population ||
        ref.breakdown !== result.breakdown ||
        item.capabilityId !==
          (result.population === "FOLLOWERS"
            ? "instagram.audience_followers"
            : "instagram.audience_engaged")
      )
        this.fail("BREAKDOWN_IDENTITY_MISMATCH");
      results.push(result);
      breakdowns.push({
        cohort: result.population === "FOLLOWERS" ? "FOLLOWERS" : "ENGAGED",
        dimension: result.breakdown,
        evidenceRef: item.evidenceRef,
        denominator:
          typeof result.denominator === "number" &&
          Number.isInteger(result.denominator) &&
          result.denominator > 0 &&
          result.values.reduce((sum, row) => sum + row.value, 0) <=
            result.denominator
            ? result.denominator
            : null,
        // Provider basis, metric/normalizer and cohort semantics; counts are not series identities.
        basis: canonicalJson({
          normalization: item.normalizationContractVersion,
          population: result.population,
          breakdown: result.breakdown,
          timeframe: result.timeframe,
          denominatorBasis:
            typeof result.denominator === "number" &&
            Number.isInteger(result.denominator) &&
            result.denominator > 0 &&
            result.values.reduce((sum, row) => sum + row.value, 0) <=
              result.denominator
              ? "EXPLICIT_PROVIDER_TOTAL"
              : "UNAVAILABLE",
          limitation: result.limitation,
          period: value.snapshotBasis.period,
          providerWindow: admitted.capture
            .capturedAt!.toISOString()
            .slice(0, 7),
        }),
      });
    }
    if (
      new Set(breakdowns.map((row) => `${row.cohort}:${row.dimension}`))
        .size !== 8 ||
      value.snapshotBasis.capturedAt !==
        admitted.capture.capturedAt!.toISOString()
    )
      this.fail("AUDIENCE_MANIFEST_INVALID");
    const normalized = normalizeCreatorAudience({
      acquisition: {
        capturedAt: admitted.capture.capturedAt!.toISOString(),
        results: results as Parameters<
          typeof normalizeCreatorAudience
        >[0]["acquisition"]["results"],
        followerCount:
          value.cohorts.find((row) => row.id === "FOLLOWERS")?.size === null
            ? { state: "UNAVAILABLE", reason: "NOT_RETURNED" }
            : {
                state: "OBSERVED",
                value:
                  value.cohorts.find((row) => row.id === "FOLLOWERS")?.size ??
                  0,
              },
      },
      role: "OWNER",
      now: new Date(admitted.capture.capturedAt!),
    });
    if (canonicalJson(normalized.cohorts) !== canonicalJson(value.cohorts))
      this.fail("AUDIENCE_FACT_SUBSTITUTION");
    return {
      objectGenerationId: object.id,
      value,
      breakdowns,
      capturedAt: admitted.capture.capturedAt!.toISOString(),
      providerAccountId: fence.providerAccountId,
      authorizationGeneration: fence.authorizationGeneration,
      evidence: admitted.evidence.map((item) => ({
        evidenceRef: item.evidenceRef,
        captureRef: item.captureRef,
        resourceRef: item.resourceRef,
        capabilityId:
          item.capabilityId as AudienceV1Manifest["evidence"][number]["capabilityId"],
        contentHash: item.contentHash,
        capturedAt: admitted.capture.capturedAt!.toISOString(),
      })),
    };
  }
  private async content(
    tx: Prisma.TransactionClient,
    object: ObjectRow,
    fence: Fence,
    now: Date,
  ): Promise<AudienceV1Content | null> {
    const value = CreatorContentConsumerSchema.parse(object.valuePayload);
    if (
      value.status !== "READY" ||
      value.freshness.state !== "CURRENT" ||
      !value.freshness.capturedAt ||
      now.getTime() - Date.parse(value.freshness.capturedAt) >=
        48 * 3_600_000 ||
      value.limitations.includes(
        "PROVIDER_INVENTORY_PARTIAL_LATEST_CORPUS_UNCONFIRMED",
      )
    )
      return null;
    const admitted = await this.verified(tx, object, "content", fence);
    const pendingOrFailed = await tx.dataExtractionCapture.count({
      where: {
        ownerScopeId: fence.ownerScopeId,
        resourceRef: admitted.capture.resourceRef,
        providerIntegrationId: fence.integrationId,
        providerAccountId: fence.providerAccountId,
        status: { in: ["RUNNING", "FAILED"] },
        startedAt: { gt: admitted.capture.capturedAt! },
      },
    });
    if (pendingOrFailed) return null;
    if (
      value.freshness.capturedAt !== admitted.capture.capturedAt!.toISOString()
    )
      this.fail("CONTENT_CAPTURE_MISMATCH");
    const allRefs = new Set(
      value.snapshot.media.flatMap((row) => row.evidenceRefs),
    );
    for (const post of value.snapshot.media) {
      if (
        post.evidenceRefs.length !== 1 ||
        !admitted.evidence.some(
          (item) => item.evidenceRef === post.evidenceRefs[0],
        ) ||
        Date.parse(post.publishedAt) < Date.parse(value.snapshot.windowStart) ||
        Date.parse(post.publishedAt) > Date.parse(value.snapshot.windowEnd)
      )
        this.fail("CONTENT_POST_SUPPORT_INVALID");
    }
    const facts = value.highlights
      .filter(
        (row) =>
          row.kind !== "LIMITATION" &&
          row.evidenceRefs.length >= 3 &&
          row.evidenceRefs.every((ref) => allRefs.has(ref)) &&
          new Set(
            value.snapshot.media
              .filter((post) =>
                post.evidenceRefs.some((ref) => row.evidenceRefs.includes(ref)),
              )
              .map((post) => post.providerMediaId),
          ).size >= 3,
      )
      .slice(0, 2)
      .map((row) => ({ text: row.text, evidenceRefs: row.evidenceRefs }));
    const refs = new Set(facts.flatMap((row) => row.evidenceRefs));
    for (const item of admitted.evidence.filter((row) =>
      refs.has(row.evidenceRef),
    )) {
      if (item.captureMethodClass === "MODEL_DERIVATION") {
        if (item.parentEvidenceRefs.length !== 1)
          this.fail("CONTENT_PARENT_INVALID");
        const parent = await tx.dataExtractionEvidenceItem.findUnique({
          select: evidenceSelect,
          where: { evidenceRef: item.parentEvidenceRefs[0] },
        });
        if (
          !parent ||
          parent.ownerScopeId !== fence.ownerScopeId ||
          parent.captureRef !== item.captureRef ||
          parent.resourceRef !== item.resourceRef ||
          parent.capabilityId !== item.capabilityId ||
          parent.captureMethodClass !== "PROVIDER_MEDIATED_FETCH"
        )
          this.fail("CONTENT_PARENT_INVALID");
      } else if (item.captureMethodClass !== "PROVIDER_MEDIATED_FETCH")
        this.fail("CONTENT_MODALITY_INVALID");
    }
    return facts.length
      ? {
          objectGenerationId: object.id,
          capturedAt: admitted.capture.capturedAt!.toISOString(),
          facts,
          evidence: admitted.evidence
            .filter((row) => refs.has(row.evidenceRef))
            .map((item) => ({
              evidenceRef: item.evidenceRef,
              captureRef: item.captureRef,
              resourceRef: item.resourceRef,
              capabilityId: "instagram.media_insights",
              contentHash: item.contentHash,
              capturedAt: admitted.capture.capturedAt!.toISOString(),
            })),
        }
      : null;
  }
  private fail(code: string): never {
    throw new Error(`CREATOR_AUDIENCE_V1_${code}`);
  }
}
type Fence = {
  ownerScopeId: string;
  subjectId: string;
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
};
const objectSelect = {
  id: true,
  ownerScopeId: true,
  subjectId: true,
  objectSemanticId: true,
  bundleId: true,
  bundleVersion: true,
  bundleHash: true,
  producerId: true,
  producerVersion: true,
  valueHash: true,
  valuePayload: true,
  objectMetadataPayload: true,
  processorExecutionId: true,
  createdAt: true,
} as const;
const evidenceSelect = {
  evidenceRef: true,
  ownerScopeId: true,
  captureRef: true,
  resourceRef: true,
  capabilityId: true,
  contentHash: true,
  boundedPayload: true,
  normalizationContractVersion: true,
  captureMethodClass: true,
  parentEvidenceRefs: true,
} as const;
