import { readOwnerScopedIntelligenceCurrent } from "../brand-intelligence/projection/owner-scoped-current.read";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import {
  canonicalJson,
  sha256Canonical,
} from "../brand-intelligence/contracts/bundle/canonical-json";
import { CreatorContentConsumerSchema } from "../creator-content/contracts/creator-content-v0.contract";
import {
  CREATOR_CONTENT_COMPONENT_PATHS,
  CreatorContentEvidenceManifestSchema,
  creatorContentComponentValue,
  creatorContentVerifiedContract,
} from "../creator-content/creator-content-runtime.contract";

const metadata = z
  .object({
    sourceScope: z.literal("INSTAGRAM_OWNED"),
    integrationId: z.string().uuid(),
    providerAccountId: z.string().min(1).max(100),
    authorizationGeneration: z.number().int().nonnegative(),
    requestIdentity: z.string().min(1).max(255),
    captureRef: z.string().min(1).max(255),
  })
  .strict();
const semantic = z
  .object({
    themes: z.array(z.string().max(240)).max(8),
    captionPatterns: z.array(z.string().max(240)).max(6),
    creativeStructures: z.array(z.string().max(240)).max(6),
    visualExecution: z.array(z.string().max(240)).max(6),
    state: z.enum(["AVAILABLE", "PARTIAL", "UNKNOWN"]),
  })
  .strict();
const sourceCaption = z
  .object({
    providerMediaId: z.string().min(1).max(100),
    publishedAt: z.string().datetime(),
    mediaType: z.enum(["IMAGE", "CAROUSEL_ALBUM", "VIDEO", "REEL"]),
    permalink: z.string().nullable(),
    metrics: z.record(z.unknown()),
    captionHash: z.string().regex(/^[a-f0-9]{64}$/u),
    caption: z.string().max(2200).nullable(),
  })
  .strict();
const derived = z
  .object({
    semantic,
    provenance: z.record(z.unknown()),
    supportingEvidenceRefs: z.array(z.string()).length(1),
    sourceCaptureRef: z.string().min(1).max(255),
  })
  .strict();
export type CreatorContentAdmittedCurrentSource = {
  ownerScopeId: string;
  subjectId: string;
  subject: {
    creatorWorkspaceId: string;
    ownerCreatorProfileId: string;
    ownerUserId: string;
  };
  objectGenerationId: string;
  valueHash: string;
  manifestHash: string;
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  captureRef: string;
  capturedAt: string;
  windowEnd: string;
  providerInventoryComplete: boolean;
  semanticCoverage: number;
  componentGenerations: Array<{ path: string; generationId: string }>;
  posts: Array<{
    providerMediaId: string;
    publicationDate: string;
    evidenceRefs: string[];
    caption: string | null;
    semantic: z.infer<typeof semantic>;
  }>;
  evidence: Array<{
    evidenceRef: string;
    contentHash: string;
    capturedAt: string;
  }>;
};

const reference = z.string().min(1).max(255);
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/u);
export const CreatorContentAdmittedCurrentSourceSchema = z
  .object({
    ownerScopeId: z.string().uuid(),
    subjectId: z.string().uuid(),
    subject: z
      .object({
        creatorWorkspaceId: z.string().uuid(),
        ownerCreatorProfileId: z.string().uuid(),
        ownerUserId: z.string().uuid(),
      })
      .strict(),
    objectGenerationId: z.string().uuid(),
    valueHash: fingerprint,
    manifestHash: fingerprint,
    integrationId: z.string().uuid(),
    providerAccountId: z.string().min(1).max(100),
    authorizationGeneration: z.number().int().nonnegative(),
    captureRef: reference,
    capturedAt: z.string().datetime(),
    windowEnd: z.string().datetime(),
    providerInventoryComplete: z.boolean(),
    semanticCoverage: z.number().min(0).max(1),
    componentGenerations: z
      .array(
        z
          .object({
            path: z
              .string()
              .refine((path) => CREATOR_CONTENT_COMPONENT_PATHS.includes(path)),
            generationId: z.string().uuid(),
          })
          .strict(),
      )
      .length(8),
    posts: z
      .array(
        z
          .object({
            providerMediaId: z.string().min(1).max(100),
            publicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
            evidenceRefs: z.array(reference).min(1).max(24),
            caption: z.string().max(2200).nullable(),
            semantic,
          })
          .strict(),
      )
      .min(1)
      .max(24),
    evidence: z
      .array(
        z
          .object({
            evidenceRef: reference,
            contentHash: fingerprint,
            capturedAt: z.string().datetime(),
          })
          .strict(),
      )
      .min(1)
      .max(24),
  })
  .strict()
  .superRefine((source, context) => {
    const { manifestHash, ...body } = source;
    if (
      manifestHash !== sha256Canonical(body) ||
      new Set(source.componentGenerations.map((item) => item.path)).size !==
        8 ||
      new Set(source.componentGenerations.map((item) => item.generationId))
        .size !== 8 ||
      new Set(source.posts.map((item) => item.providerMediaId)).size !==
        source.posts.length ||
      new Set(source.evidence.map((item) => item.evidenceRef)).size !==
        source.evidence.length ||
      source.posts.some(
        (post) =>
          new Set(post.evidenceRefs).size !== post.evidenceRefs.length ||
          post.evidenceRefs.some(
            (ref) => !source.evidence.some((item) => item.evidenceRef === ref),
          ),
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exact source manifest required",
      });
  });

/** Read-only admission. No owner-scope upsert, credentials, acquisition or Content calculation. */
@Injectable()
export class CreatorContentCurrentSourceAdapter {
  constructor(private readonly prisma: PrismaService) {}
  read(actor: CreatorWorkspaceActorContext) {
    return this.prisma.$transaction((tx) => this.readInTransaction(tx, actor), {
      isolationLevel: "RepeatableRead",
    });
  }
  async readInTransaction(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
  ): Promise<CreatorContentAdmittedCurrentSource | null> {
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
    // Current, non-secret Settings fence; never select the encrypted token.
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
      integration.disconnectedAt ||
      integration.tokenStateCondition !== "ACTIVE" ||
      (integration.tokenExpiresAt &&
        integration.tokenExpiresAt <= new Date()) ||
      integration.authorizationHealth !== "USABLE" ||
      integration.basicAuthorizationCapability !== "AVAILABLE" ||
      integration.insightsCapability !== "AVAILABLE" ||
      !["BUSINESS", "CREATOR"].includes(
        integration.professionalAccountType ?? "",
      )
    )
      this.fail("SETTINGS_FENCE_REJECTED");
    const current = await readOwnerScopedIntelligenceCurrent(
      tx,
      scope.id,
      "creator_content",
    );
    if (
      current.some(
        (row) => row.currentComponentGeneration.subjectId !== subject.id,
      )
    )
      this.fail("SUBJECT_MISMATCH");
    if (!current.length) return null;
    if (
      current.length !== 8 ||
      new Set(current.map((row) => row.componentSemanticPath)).size !== 8 ||
      current.some(
        (row) =>
          !CREATOR_CONTENT_COMPONENT_PATHS.includes(
            row.componentSemanticPath,
          ) || row.pathSchemeVersion !== 1,
      )
    )
      this.fail("CURRENT_MANIFEST_INVALID");
    const object = current[0].currentComponentGeneration.objectGeneration;
    const verified = creatorContentVerifiedContract().bundle.manifest;
    const value = CreatorContentConsumerSchema.parse(object.valuePayload);
    const source = metadata.parse(object.objectMetadataPayload);
    if (
      object.ownerScopeId !== scope.id ||
      object.subjectId !== subject.id ||
      object.objectSemanticId !== "creator_content" ||
      object.bundleHash !== verified.bundleContentHash ||
      object.bundleId !== verified.bundleId ||
      object.bundleVersion !== verified.bundleVersion ||
      object.producerId !== verified.processorId ||
      object.producerVersion !== verified.processorVersion ||
      object.valueHash !== sha256Canonical(value) ||
      source.integrationId !== integration.id ||
      source.providerAccountId !== integration.nativePlatformUserId ||
      source.authorizationGeneration !== integration.authorizationGeneration
    )
      this.fail("CONTENT_IDENTITY_MISMATCH");
    for (const row of current) {
      const component = row.currentComponentGeneration;
      const expected = creatorContentComponentValue(
        value,
        row.componentSemanticPath,
      );
      if (
        component.objectGenerationId !== object.id ||
        component.ownerScopeId !== scope.id ||
        component.subjectId !== subject.id ||
        component.componentSemanticPath !== row.componentSemanticPath ||
        component.valueHash !== sha256Canonical(expected) ||
        canonicalJson(component.valuePayload) !== canonicalJson(expected)
      )
        this.fail("COMPONENT_IDENTITY_MISMATCH");
    }
    const capture = await tx.dataExtractionCapture.findUnique({
      select: {
        captureRef: true,
        resourceRef: true,
        ownerScopeId: true,
        status: true,
        capturedAt: true,
        providerIntegrationId: true,
        providerAccountId: true,
        authorizationGeneration: true,
      },
      where: { captureRef: source.captureRef },
    });
    if (
      !capture ||
      capture.ownerScopeId !== scope.id ||
      capture.status !== "COMPLETED" ||
      !capture.capturedAt ||
      capture.providerIntegrationId !== source.integrationId ||
      capture.providerAccountId !== source.providerAccountId ||
      capture.authorizationGeneration !== source.authorizationGeneration
    )
      this.fail("CAPTURE_IDENTITY_MISMATCH");
    const references = await tx.intelligenceEvidenceReference.findMany({
      select: {
        componentSemanticPath: true,
        evidenceRef: true,
        captureId: true,
        capabilityId: true,
        capturedAt: true,
      },
      where: { ownerScopeId: scope.id, objectGenerationId: object.id },
    });
    const allRefs = [
      ...new Set(value.snapshot.media.flatMap((post) => post.evidenceRefs)),
    ].sort();
    if (
      !allRefs.length ||
      allRefs.length > 24 ||
      value.snapshot.media.length !== value.snapshot.eligibleCount ||
      new Set(value.snapshot.media.map((post) => post.providerMediaId)).size !==
        value.snapshot.media.length
    )
      this.fail("CORPUS_INVALID");
    for (const path of ["$/f/content_snapshot", "$/f/what_you_create"]) {
      const exact = references.filter(
        (ref) => ref.componentSemanticPath === path,
      );
      if (
        canonicalJson(exact.map((ref) => ref.evidenceRef).sort()) !==
          canonicalJson(allRefs) ||
        exact.some(
          (ref) =>
            ref.captureId !== source.captureRef ||
            ref.capabilityId !== "instagram.media_insights" ||
            ref.capturedAt.getTime() !== capture.capturedAt!.getTime(),
        )
      )
        this.fail("EVIDENCE_MANIFEST_INVALID");
    }
    const evidence = await tx.dataExtractionEvidenceItem.findMany({
      select: {
        evidenceRef: true,
        captureRef: true,
        resourceRef: true,
        capabilityId: true,
        contentHash: true,
        boundedPayload: true,
        captureMethodClass: true,
        parentEvidenceRefs: true,
      },
      where: { ownerScopeId: scope.id, evidenceRef: { in: allRefs } },
    });
    if (evidence.length !== allRefs.length) this.fail("MISSING_EVIDENCE");
    const producer = await tx.intelligenceProcessorExecution.findUnique({
      select: {
        ownerScopeId: true,
        status: true,
        bundleHash: true,
        evidenceManifest: true,
        evidenceManifestHash: true,
      },
      where: { id: object.processorExecutionId! },
    });
    if (
      !producer ||
      producer.ownerScopeId !== scope.id ||
      producer.status !== "COMPLETED" ||
      producer.bundleHash !== verified.bundleContentHash
    )
      this.fail("PRODUCER_INVALID");
    const manifest = CreatorContentEvidenceManifestSchema.parse(
      producer.evidenceManifest,
    );
    if (
      manifest.identity.ownerScopeId !== scope.id ||
      manifest.identity.captureRef !== capture.captureRef ||
      sha256Canonical(producer.evidenceManifest) !==
        producer.evidenceManifestHash
    )
      this.fail("PRODUCER_MANIFEST_INVALID");
    const admitted: CreatorContentAdmittedCurrentSource["posts"] = [];
    for (const post of value.snapshot.media) {
      if (
        post.evidenceRefs.length !== 1 ||
        Date.parse(post.publishedAt) < Date.parse(value.snapshot.windowStart) ||
        Date.parse(post.publishedAt) > Date.parse(value.snapshot.windowEnd)
      )
        this.fail("POST_IDENTITY_INVALID");
      const item = evidence.find(
        (row) => row.evidenceRef === post.evidenceRefs[0],
      )!;
      if (
        item.captureRef !== capture.captureRef ||
        item.resourceRef !== capture.resourceRef ||
        item.capabilityId !== "instagram.media_insights" ||
        !manifest.evidence.some(
          (ref) =>
            ref.evidenceRef === item.evidenceRef &&
            ref.contentHash === item.contentHash &&
            ref.providerMediaId === post.providerMediaId &&
            ref.capturedAt === capture.capturedAt!.toISOString(),
        )
      )
        this.fail("EVIDENCE_IDENTITY_MISMATCH");
      let caption: z.infer<typeof sourceCaption>;
      let observed: z.infer<typeof semantic>;
      if (item.captureMethodClass === "MODEL_DERIVATION") {
        const payload = derived.parse(item.boundedPayload);
        if (
          payload.sourceCaptureRef !== capture.captureRef ||
          canonicalJson(payload.supportingEvidenceRefs) !==
            canonicalJson(item.parentEvidenceRefs)
        )
          this.fail("PARENT_LINEAGE_INVALID");
        const parent = await tx.dataExtractionEvidenceItem.findUnique({
          select: {
            ownerScopeId: true,
            captureRef: true,
            resourceRef: true,
            capabilityId: true,
            captureMethodClass: true,
            boundedPayload: true,
          },
          where: { evidenceRef: payload.supportingEvidenceRefs[0] },
        });
        if (
          !parent ||
          parent.ownerScopeId !== scope.id ||
          parent.captureRef !== capture.captureRef ||
          parent.resourceRef !== capture.resourceRef ||
          parent.capabilityId !== item.capabilityId ||
          parent.captureMethodClass !== "PROVIDER_MEDIATED_FETCH"
        )
          this.fail("PARENT_IDENTITY_MISMATCH");
        caption = sourceCaption.parse(parent.boundedPayload);
        observed = payload.semantic;
      } else {
        caption = sourceCaption.parse(item.boundedPayload);
        observed = {
          state: "UNKNOWN",
          themes: [],
          captionPatterns: [],
          creativeStructures: [],
          visualExecution: [],
        };
      }
      if (
        caption.providerMediaId !== post.providerMediaId ||
        caption.publishedAt !== post.publishedAt ||
        caption.mediaType !== post.mediaType ||
        canonicalJson(observed) !==
          canonicalJson({
            state: post.semanticState,
            themes: post.themes,
            captionPatterns: post.captionPatterns,
            creativeStructures: post.creativeStructures,
            visualExecution: post.visualExecution,
          })
      )
        this.fail("POST_EVIDENCE_MISMATCH");
      admitted.push({
        providerMediaId: post.providerMediaId,
        publicationDate: post.publishedAt.slice(0, 10),
        evidenceRefs: post.evidenceRefs,
        caption: caption.caption,
        semantic: observed,
      });
    }
    const result = {
      ownerScopeId: scope.id,
      subjectId: subject.id,
      subject: {
        creatorWorkspaceId: actor.workspaceId,
        ownerCreatorProfileId: actor.subjectCreatorProfileId,
        ownerUserId: actor.subjectOwnerUserId,
      },
      objectGenerationId: object.id,
      valueHash: object.valueHash,
      integrationId: source.integrationId,
      providerAccountId: source.providerAccountId,
      authorizationGeneration: source.authorizationGeneration,
      captureRef: capture.captureRef,
      capturedAt: capture.capturedAt.toISOString(),
      windowEnd: value.snapshot.windowEnd,
      providerInventoryComplete: !value.limitations.includes(
        "PROVIDER_INVENTORY_PARTIAL_LATEST_CORPUS_UNCONFIRMED",
      ),
      semanticCoverage: value.snapshot.coverage,
      componentGenerations: current
        .map((row) => ({
          path: row.componentSemanticPath,
          generationId: row.currentComponentGenerationId,
        }))
        .sort((a, b) => a.path.localeCompare(b.path)),
      posts: admitted,
      evidence: evidence
        .map((row) => ({
          evidenceRef: row.evidenceRef,
          contentHash: row.contentHash,
          capturedAt: capture.capturedAt!.toISOString(),
        }))
        .sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef)),
    };
    return CreatorContentAdmittedCurrentSourceSchema.parse({
      ...result,
      manifestHash: sha256Canonical(result),
    });
  }
  private fail(code: string): never {
    throw new Error(`CREATOR_CONTENT_SOURCE_${code}`);
  }
}
