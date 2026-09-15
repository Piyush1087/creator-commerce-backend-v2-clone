import { readCreatorBrandCurrent } from "./creator-brand-current.reader";
import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import {
  canonicalJson,
  sha256Canonical,
} from "../brand-intelligence/contracts/bundle/canonical-json";
import {
  CreatorBrandSuggestionsSchema,
  CREATOR_BRAND_SUGGESTION_FAMILIES,
} from "./contracts/creator-brand-suggestions.contract";
import {
  CreatorBrandProfileInputSchema,
  type CreatorBrandProfileInput,
} from "./contracts/creator-brand-profile.contract";
import { CreatorBrandContentSourceAdapter } from "./creator-brand-content-source.adapter";
import {
  creatorBrandVerifiedContract,
  CREATOR_BRAND_COMPONENT_PATHS,
} from "./creator-brand-runtime.contract";

const candidateValue = z.union([
  z.string().min(1).max(300),
  z.array(z.string().min(1).max(100)).min(1).max(10),
  z
    .object({
      kind: z.literal("COLOR_WORDS"),
      words: z.array(z.string().min(1).max(100)).min(1).max(5),
    })
    .strict(),
]);
const candidate = z
  .object({
    candidateId: z.string().regex(/^[a-f0-9]{64}$/u),
    field: z.enum([
      "primaryNicheIds",
      "headline",
      "voiceDescriptorIds",
      "voiceDescription",
      "creatorArchetypeIds",
      "visualStyleDescriptors",
      "paletteCue",
      "languageTags",
    ]),
    value: candidateValue,
    confidence: z.enum(["LOW", "MEDIUM"]),
    supportingPosts: z.number().int().min(3).max(24),
    componentGenerationId: z.string().uuid(),
    confirmable: z.boolean(),
  })
  .strict();
const section = z
  .object({
    availability: z.enum(["AVAILABLE", "INSUFFICIENT_EVIDENCE"]),
    candidates: z.array(candidate).max(2),
  })
  .strict();
export const CreatorBrandSuggestionProjectionSchema = z
  .object({
    contractVersion: z.literal("creator-brand-suggestions-v0.1"),
    state: z.enum(["AVAILABLE", "PARTIAL", "UNAVAILABLE", "STALE", "DEGRADED"]),
    freshness: z.enum(["CURRENT", "STALE", "UNKNOWN"]),
    processing: z.enum(["IDLE", "PROCESSING", "FAILED"]),
    objectGenerationId: z.string().uuid().nullable(),
    autoApply: z.literal(false),
    coverage: z.number().min(0).max(1),
    eligiblePosts: z.number().int().min(0).max(24),
    limitations: z.array(z.string().max(160)).max(8),
    families: z
      .object({
        positioning: section,
        voice_personality: section,
        creator_style: section,
        visual_identity: section,
        languages: section,
      })
      .strict(),
  })
  .strict();
export function absentCreatorBrandSuggestions() {
  const family = () => ({
    availability: "INSUFFICIENT_EVIDENCE" as const,
    candidates: [],
  });
  return CreatorBrandSuggestionProjectionSchema.parse({
    contractVersion: "creator-brand-suggestions-v0.1",
    state: "UNAVAILABLE",
    freshness: "UNKNOWN",
    processing: "IDLE",
    objectGenerationId: null,
    autoApply: false,
    coverage: 0,
    eligiblePosts: 0,
    limitations: ["NO_CURRENT_AUTHORIZED_CONTENT_BASIS"],
    families: {
      positioning: family(),
      voice_personality: family(),
      creator_style: family(),
      visual_identity: family(),
      languages: family(),
    },
  });
}
export function creatorBrandCandidateId(
  componentGenerationId: string,
  field: string,
  value: unknown,
) {
  return sha256Canonical({ componentGenerationId, field, value });
}
function currentSourceEvidence(
  value: z.infer<typeof CreatorBrandSuggestionsSchema>,
) {
  return [...value.sourceContent.evidenceRefs].sort();
}
@Injectable()
export class CreatorBrandSuggestionsConsumer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly source: CreatorBrandContentSourceAdapter,
  ) {}
  async read(actor: CreatorWorkspaceActorContext) {
    return this.prisma.$transaction(
      async (tx) => {
        let current = null;
        try {
          current = await this.current(tx, actor);
        } catch {
          return absentCreatorBrandSuggestions();
        }
        if (!current) return absentCreatorBrandSuggestions();
        const projection = this.project(current);
        const work = await tx.intelligenceProcessorExecution.findMany({
          where: {
            ownerScopeId: current.object.ownerScopeId,
            processorId: {
              in: ["creator_brand_suggestions_v0", "creator_content_v0"],
            },
            createdAt: { gte: current.object.createdAt },
          },
          select: { status: true },
        });
        projection.processing = work.some((row) =>
          ["WAITING_FOR_DEPENDENCY", "QUEUED", "RUNNING"].includes(row.status),
        )
          ? "PROCESSING"
          : work.some((row) => ["FAILED_TERMINAL"].includes(row.status))
            ? "FAILED"
            : "IDLE";
        const pendingCapture = await tx.dataExtractionCapture.findFirst({
          where: {
            ownerScopeId: current.object.ownerScopeId,
            providerAccountId: (
              current.object.objectMetadataPayload as Record<string, unknown>
            ).providerAccountId as string,
            startedAt: { gte: current.object.createdAt },
            status: { in: ["RUNNING", "FAILED"] },
          },
          select: { status: true },
          orderBy: { startedAt: "desc" },
        });
        if (pendingCapture?.status === "RUNNING")
          projection.processing = "PROCESSING";
        else if (
          pendingCapture?.status === "FAILED" &&
          projection.processing !== "PROCESSING"
        )
          projection.processing = "FAILED";
        let latest = null;
        try {
          latest = await this.source.readInTransaction(tx, actor);
        } catch {
          /* Optional suggestions cannot break manual-first read. */
        }
        const stale =
          !latest ||
          latest.objectGenerationId !==
            current.value.sourceContent.objectGenerationId ||
          new Date(current.value.sourceContent.windowEnd).getTime() +
            48 * 3600_000 <
            Date.now();
        projection.freshness = stale ? "STALE" : "CURRENT";
        if (
          !latest ||
          latest.objectGenerationId !==
            current.value.sourceContent.objectGenerationId
        )
          Object.values(projection.families).forEach((family) =>
            family.candidates.forEach(
              (candidate) => (candidate.confirmable = false),
            ),
          );
        if (projection.processing === "FAILED" || !latest) {
          projection.state = "DEGRADED";
          projection.limitations.push(
            "CURRENT_PRESERVED_SOURCE_OR_SEMANTIC_UNAVAILABLE",
          );
        } else if (stale) {
          projection.state = "STALE";
          projection.limitations.push("AWAITING_FRESH_CONTENT_BASIS");
        }
        return CreatorBrandSuggestionProjectionSchema.parse(projection);
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async verifyInTransaction(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
    reference: {
      objectGenerationId: string;
      componentGenerationId: string;
      candidateId: string;
    },
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM creator_social_integrations WHERE creator_profile_id=${actor.subjectCreatorProfileId} AND platform_network='INSTAGRAM' FOR UPDATE`,
    );
    const scope = await tx.intelligenceOwnerScope.findUnique({
      where: {
        ownerKey: `CREATOR:${actor.subjectCreatorProfileId}:${actor.workspaceId}`,
      },
    });
    if (!scope) this.fail();
    await tx.$queryRaw(
      Prisma.sql`SELECT current_component_id FROM intelligence_current_components WHERE owner_scope_id=${scope.id} AND object_semantic_id IN ('creator_content', 'creator_brand_suggestions') ORDER BY object_semantic_id,component_semantic_path FOR UPDATE`,
    );
    const current = await this.current(tx, actor);
    if (!current || current.object.id !== reference.objectGenerationId)
      this.fail();
    const candidate = Object.values(this.project(current).families)
      .flatMap((family) => family.candidates)
      .find(
        (item) =>
          item.componentGenerationId === reference.componentGenerationId &&
          item.candidateId === reference.candidateId &&
          item.confirmable,
      );
    if (!candidate) this.fail();
    const source = await this.source.readInTransaction(tx, actor);
    if (
      !source ||
      source.manifestHash !==
        (current.object.objectMetadataPayload as Record<string, unknown>)
          .requestIdentity ||
      source.objectGenerationId !==
        current.value.sourceContent.objectGenerationId ||
      source.providerAccountId !==
        (current.object.objectMetadataPayload as Record<string, unknown>)
          .providerAccountId ||
      source.authorizationGeneration !==
        (current.object.objectMetadataPayload as Record<string, unknown>)
          .authorizationGeneration ||
      canonicalJson(source.componentGenerations) !==
        canonicalJson(current.value.sourceContent.componentGenerations) ||
      canonicalJson(source.evidence.map((item) => item.evidenceRef)) !==
        canonicalJson(current.value.sourceContent.evidenceRefs)
    )
      this.fail();
    return { candidate, reference: { ...reference } };
  }
  private async current(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
  ) {
    const scope = await tx.intelligenceOwnerScope.findUnique({
      where: {
        ownerKey: `CREATOR:${actor.subjectCreatorProfileId}:${actor.workspaceId}`,
      },
    });
    if (!scope) return null;
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
      },
    });
    const rows = await readCreatorBrandCurrent(
      tx,
      scope.id,
      "creator_brand_suggestions",
    );
    if (!rows.length) return null;
    if (
      rows.length !== 5 ||
      new Set(rows.map((row) => row.componentSemanticPath)).size !== 5 ||
      rows.some(
        (row) =>
          !CREATOR_BRAND_COMPONENT_PATHS.includes(row.componentSemanticPath),
      )
    )
      this.fail();
    const object = rows[0].currentComponentGeneration.objectGeneration;
    const value = CreatorBrandSuggestionsSchema.parse(object.valuePayload);
    const meta = object.objectMetadataPayload as Record<string, unknown>;
    if (
      !integration ||
      meta.integrationId !== integration.id ||
      meta.providerAccountId !== integration.nativePlatformUserId ||
      meta.authorizationGeneration !== integration.authorizationGeneration
    )
      return null;
    if (
      object.bundleHash !==
        creatorBrandVerifiedContract().bundle.manifest.bundleContentHash ||
      object.ownerScopeId !== scope.id ||
      object.valueHash !== sha256Canonical(value) ||
      value.subject.creatorWorkspaceId !== actor.workspaceId ||
      value.subject.ownerCreatorProfileId !== actor.subjectCreatorProfileId ||
      value.subject.ownerUserId !== actor.subjectOwnerUserId
    )
      this.fail();
    for (const row of rows) {
      const component = row.currentComponentGeneration;
      const family =
        value.families[
          row.componentSemanticPath.slice(4) as keyof typeof value.families
        ];
      if (
        component.objectGenerationId !== object.id ||
        component.ownerScopeId !== scope.id ||
        component.componentSemanticPath !== row.componentSemanticPath ||
        component.valueHash !== sha256Canonical(family) ||
        canonicalJson(component.valuePayload) !== canonicalJson(family)
      )
        this.fail();
      let expected = [
        ...new Set(
          Object.values(family).flatMap((field) =>
            field.availability === "AVAILABLE"
              ? field.support.evidenceRefs
              : [],
          ),
        ),
      ].sort();
      if (!expected.length) expected = currentSourceEvidence(value);
      const refs = await tx.intelligenceEvidenceReference.findMany({
        select: { evidenceRef: true },
        where: {
          ownerScopeId: scope.id,
          objectGenerationId: object.id,
          componentSemanticPath: row.componentSemanticPath,
        },
      });
      if (
        canonicalJson(refs.map((ref) => ref.evidenceRef).sort()) !==
        canonicalJson(expected)
      )
        this.fail();
    }
    return { rows, object, value };
  }
  private project(
    current: NonNullable<
      Awaited<ReturnType<CreatorBrandSuggestionsConsumer["current"]>>
    >,
  ) {
    const families = Object.fromEntries(
      CREATOR_BRAND_SUGGESTION_FAMILIES.map((name) => {
        const component = current.rows.find(
          (row) => row.componentSemanticPath === `$/f/${name}`,
        )!;
        const candidates = Object.entries(current.value.families[name]).flatMap(
          ([field, value]) =>
            value.availability === "AVAILABLE"
              ? [
                  {
                    candidateId: creatorBrandCandidateId(
                      component.currentComponentGenerationId,
                      field,
                      value.value,
                    ),
                    field,
                    value: value.value,
                    confidence: value.support.confidence,
                    supportingPosts: value.support.eligiblePostIds.length,
                    componentGenerationId:
                      component.currentComponentGenerationId,
                    confirmable: field !== "paletteCue",
                  },
                ]
              : [],
        );
        return [
          name,
          {
            availability: candidates.length
              ? "AVAILABLE"
              : "INSUFFICIENT_EVIDENCE",
            candidates,
          },
        ];
      }),
    );
    const allAvailable = Object.values(current.value.families).every((family) =>
      Object.values(family).some((field) => field.availability === "AVAILABLE"),
    );
    return CreatorBrandSuggestionProjectionSchema.parse({
      contractVersion: "creator-brand-suggestions-v0.1",
      state: allAvailable ? "AVAILABLE" : "PARTIAL",
      freshness: "CURRENT",
      processing: "IDLE",
      objectGenerationId: current.object.id,
      autoApply: false,
      coverage: current.value.sourceContent.semanticCoverage,
      eligiblePosts: current.value.sourceContent.posts.length,
      limitations: [],
      families,
    });
  }
  private fail(): never {
    throw new ConflictException({
      code: "CREATOR_BRAND_SUGGESTION_REFERENCE_INVALID",
    });
  }
}
export function emptyCreatorBrandProfile(): CreatorBrandProfileInput {
  return CreatorBrandProfileInputSchema.parse({
    headline: null,
    commercialBio: null,
    primaryNicheIds: [],
    creatorArchetypeIds: [],
    archetypeState: "UNCONFIGURED",
    voiceDescriptorIds: [],
    voiceDescription: null,
    visualStyleDescriptors: [],
    palette: null,
    languages: [],
  });
}
type CreatorBrandCandidate = z.infer<typeof candidate>;
export function applyCreatorBrandCandidate(
  prior: CreatorBrandProfileInput,
  candidate: CreatorBrandCandidate,
): CreatorBrandProfileInput {
  const field =
    candidate.field === "languageTags" ? "languages" : candidate.field;
  if (!candidate.confirmable || field === "paletteCue")
    throw new ConflictException({
      code: "CREATOR_BRAND_CANDIDATE_NOT_CONFIRMABLE",
    });
  return CreatorBrandProfileInputSchema.parse({
    ...prior,
    [field]: candidate.value,
    ...(field === "creatorArchetypeIds" ? { archetypeState: "CONFIRMED" } : {}),
  });
}
