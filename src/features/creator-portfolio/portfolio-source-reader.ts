import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import { CreatorAudienceCredentialFenceService } from "../creator-audience/creator-audience-credential-fence.service";
import {
  DestinationSchema,
  PortfolioItemSchema,
  portfolioIdentity,
  type PortfolioItem,
} from "./contracts/portfolio.contract";
import {
  discoverPortfolioCollaboration,
  PORTFOLIO_DISCLOSURE_PROFILE,
} from "./portfolio-instagram-discovery";
import { adaptPortfolioC04 } from "./portfolio-c04.adapter";
import {
  CREATOR_CONTENT_MAX_POSTS,
  CREATOR_CONTENT_WINDOW_DAYS,
} from "../creator-content/contracts/creator-content-v0.contract";
import {
  INSTAGRAM_C3_CONTRACT_VERSION,
  INSTAGRAM_C3_OBSERVATION_PROFILE_VERSION,
  INSTAGRAM_C3_NORMALIZATION_VERSION,
} from "../instagram-intelligence/semantics/instagram-c3-semantics";

export const PORTFOLIO_SOURCE_LIMIT = 240;
export type PortfolioSourceBatch = {
  items: PortfolioItem[];
  discovery: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" | "NOT_PROCESSED";
  limitations: string[];
};
const sourcePayload = z
  .object({
    providerMediaId: z.string().min(1).max(100),
    publishedAt: z.string().datetime(),
    mediaType: z.enum(["IMAGE", "CAROUSEL_ALBUM", "VIDEO", "REEL"]),
    permalink: z.string().max(500).nullable(),
    metrics: z
      .object({
        INTERACTION_RATE: z.number().nonnegative().nullable(),
        REACH: z.number().nonnegative().nullable(),
        VIEWS: z.number().nonnegative().nullable(),
        LIKES: z.number().nonnegative().nullable(),
        COMMENTS: z.number().nonnegative().nullable(),
        SAVES: z.number().nonnegative().nullable(),
        SHARES: z.number().nonnegative().nullable(),
        TOTAL_INTERACTIONS: z.number().nonnegative().nullable(),
      })
      .strict(),
    captionHash: z.string().regex(/^[a-f0-9]{64}$/u),
    caption: z.string().max(2200).nullable(),
  })
  .strict();
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function adaptPortfolioInstagram(input: {
  payload: unknown;
  evidenceRef: string;
  captureRef: string;
  contentHash: string;
  capturedAt: Date;
  requestIdentity: string;
  accountId: string;
  generation: number;
  ownerProfileId: string;
  workspaceId: string;
}): PortfolioItem | null {
  const p = sourcePayload.parse(input.payload);
  // Restore the accepted writer's declared key order after JSONB storage.
  // This validates retained source bytes, not a provider locator fingerprint.
  if (digest(p) !== input.contentHash)
    throw new Error("PORTFOLIO_SOURCE_HASH_INVALID");
  if (
    new Date(p.publishedAt).getTime() <
    input.capturedAt.getTime() - CREATOR_CONTENT_WINDOW_DAYS * 86_400_000
  )
    throw new Error("PORTFOLIO_SOURCE_WINDOW_INVALID");
  if (new Date(p.publishedAt) > input.capturedAt)
    throw new Error("PORTFOLIO_SOURCE_TIME_INVALID");
  const discovered = discoverPortfolioCollaboration({
    caption: p.caption,
    sourceEvidenceRef: input.evidenceRef,
  });
  if (!discovered.admitted) return null;
  const destination = DestinationSchema.parse(p.permalink);
  if (!destination.startsWith("https://www.instagram.com/"))
    throw new Error("PORTFOLIO_SOURCE_LINK_INVALID");
  // VIDEO alone does not establish Reel identity. A retained reel permalink does.
  const kind =
    p.mediaType === "IMAGE"
      ? "INSTAGRAM_IMAGE"
      : p.mediaType === "CAROUSEL_ALBUM"
        ? "INSTAGRAM_CAROUSEL"
        : p.mediaType === "REEL" || destination.includes("/reel/")
          ? "INSTAGRAM_REEL"
          : null;
  if (!kind) throw new Error("PORTFOLIO_SOURCE_FORMAT_UNSUPPORTED");
  return PortfolioItemSchema.parse({
    id: portfolioIdentity(
      input.ownerProfileId,
      `instagram:${input.accountId}:${p.providerMediaId}`,
    ),
    kind,
    destination,
    title:
      kind === "INSTAGRAM_REEL"
        ? "Instagram Reel"
        : kind === "INSTAGRAM_CAROUSEL"
          ? "Instagram carousel"
          : "Instagram post",
    creatorContext: null,
    brandLabel: null,
    workDate: p.publishedAt,
    state: "INCLUDED",
    provenance: [
      {
        source: "INSTAGRAM",
        accountId: input.accountId,
        authorizationGeneration: input.generation,
        providerMediaId: p.providerMediaId,
        sourceCaptureRef: input.captureRef,
        evidenceRefs: [input.evidenceRef],
        sourceHash: digest([
          PORTFOLIO_DISCLOSURE_PROFILE,
          INSTAGRAM_C3_CONTRACT_VERSION,
          INSTAGRAM_C3_OBSERVATION_PROFILE_VERSION,
          INSTAGRAM_C3_NORMALIZATION_VERSION,
          input.ownerProfileId,
          input.workspaceId,
          input.capturedAt.toISOString(),
          input.accountId,
          input.generation,
          input.requestIdentity,
          input.captureRef,
          input.evidenceRef,
          input.contentHash,
          p,
        ]),
        observedAt: input.capturedAt.toISOString(),
        classification: "POSSIBLE_COLLABORATION",
        confidence: "LOW",
        cueClasses: [PORTFOLIO_DISCLOSURE_PROFILE],
      },
    ],
    presentation: "SOURCE_LINK_ONLY",
    access: "ACCESS_REQUIREMENTS_UNKNOWN",
  });
}
@Injectable()
export class PortfolioSourceReader {
  async read(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
  ): Promise<PortfolioSourceBatch> {
    // Reuse current Settings non-secret projection. Never acquire/decrypt credentials.
    const fence = await new CreatorAudienceCredentialFenceService(
      tx as unknown as PrismaService,
    ).project(actor);
    const items: PortfolioItem[] = [];
    const limitations = new Set<string>();
    let discovery: PortfolioSourceBatch["discovery"] = fence.authorized
      ? "NOT_PROCESSED"
      : "UNAVAILABLE";
    if (!fence.authorized)
      limitations.add("INSTAGRAM_SOURCE_UNAVAILABLE_RETAINED_PORTFOLIO");
    if (fence.authorized) {
      // A current-generation integration lock fences concurrent Settings changes.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM creator_social_integrations WHERE id=${fence.integrationId} FOR SHARE`,
      );
      const checked = await new CreatorAudienceCredentialFenceService(
        tx as unknown as PrismaService,
      ).project(actor);
      if (
        !checked.authorized ||
        checked.integrationId !== fence.integrationId ||
        checked.providerAccountId !== fence.providerAccountId ||
        checked.authorizationGeneration !== fence.authorizationGeneration
      )
        throw new Error("PORTFOLIO_SOURCE_FENCE_CHANGED");
      const scope = await tx.intelligenceOwnerScope.findUnique({
        where: {
          ownerKey: `CREATOR:${actor.subjectCreatorProfileId}:${actor.workspaceId}`,
        },
      });
      if (
        scope &&
        (scope.ownerType !== "CREATOR" ||
          scope.creatorProfileId !== actor.subjectCreatorProfileId ||
          scope.creatorWorkspaceId !== actor.workspaceId)
      )
        throw new Error("PORTFOLIO_SOURCE_OWNER_INVALID");
      const captures = scope
        ? await tx.$queryRaw<
            Array<{
              captureRef: string;
              capturedAt: Date;
              requestIdentity: string;
              quality: string;
            }>
          >(Prisma.sql`
        SELECT capture_ref "captureRef",captured_at "capturedAt",acquisition_request_key "requestIdentity",acquisition_quality::text quality
        FROM data_extraction_captures WHERE owner_scope_id=${scope.id} AND status='COMPLETED' AND captured_at<=CURRENT_TIMESTAMP
        AND provider_integration_id=${fence.integrationId} AND provider_account_id=${fence.providerAccountId} AND authorization_generation=${fence.authorizationGeneration}
        AND capture_ref LIKE 'creator-content-capture:%' ORDER BY captured_at DESC,capture_ref ASC LIMIT 1 FOR SHARE`)
        : [];
      if (captures[0] && scope) {
        const capture = captures[0];
        discovery = capture.quality === "COMPLETE" ? "AVAILABLE" : "PARTIAL";
        const rows = await tx.$queryRaw<
          Array<{ payload: unknown; evidenceRef: string; contentHash: string }>
        >(Prisma.sql`
          SELECT e.bounded_payload payload,e.evidence_ref "evidenceRef",e.content_hash "contentHash" FROM data_extraction_evidence_items e
          JOIN data_extraction_resources r ON r.resource_ref=e.resource_ref AND r.owner_scope_id=e.owner_scope_id
          JOIN data_extraction_captures c ON c.capture_ref=e.capture_ref AND c.owner_scope_id=e.owner_scope_id AND c.resource_ref=e.resource_ref
          WHERE e.owner_scope_id=${scope.id} AND e.capture_ref=${capture.captureRef} AND e.brand_id IS NULL
          AND r.source_class='INSTAGRAM_OWNED' AND r.resource_type='INSTAGRAM_ACCOUNT' AND r.brand_id IS NULL AND c.brand_id IS NULL AND r.provider_account_id=${fence.providerAccountId}
          AND e.capability_id='instagram.media_insights' AND e.normalization_contract_version='creator.content.instagram.v0.1'
          AND e.capture_method_class='PROVIDER_MEDIATED_FETCH' ORDER BY e.evidence_ref ASC LIMIT ${CREATOR_CONTENT_MAX_POSTS + 1} FOR SHARE OF e,r,c`);
        if (rows.length > CREATOR_CONTENT_MAX_POSTS) {
          discovery = "PARTIAL";
          limitations.add("SOURCE_ADAPTATION_BOUND_REACHED");
        }
        const media = new Set<string>();
        for (const row of rows.slice(0, CREATOR_CONTENT_MAX_POSTS)) {
          try {
            const parsed = sourcePayload.parse(row.payload);
            if (media.has(parsed.providerMediaId))
              throw new Error("PORTFOLIO_DUPLICATE_SOURCE_MEDIA");
            media.add(parsed.providerMediaId);
            const item = adaptPortfolioInstagram({
              ...row,
              accountId: fence.providerAccountId!,
              generation: fence.authorizationGeneration!,
              ownerProfileId: actor.subjectCreatorProfileId,
              workspaceId: actor.workspaceId,
              ...capture,
            });
            if (item) items.push(item);
          } catch {
            discovery = "PARTIAL";
            limitations.add("INSTAGRAM_ITEM_UNAVAILABLE_OR_UNSUPPORTED");
          }
        }
        limitations.add("RETAINED_CONTENT_CORPUS_ONLY");
        if (discovery === "PARTIAL")
          limitations.add("INSTAGRAM_DISCOVERY_PARTIAL");
      }
      if (scope) {
        const pending = await tx.$queryRaw<
          Array<{ status: string }>
        >(Prisma.sql`SELECT status::text status FROM data_extraction_captures
          WHERE owner_scope_id=${scope.id} AND provider_integration_id=${fence.integrationId} AND provider_account_id=${fence.providerAccountId} AND authorization_generation=${fence.authorizationGeneration}
          AND capture_ref LIKE 'creator-content-capture:%' AND status IN ('FAILED','RUNNING') AND started_at>${captures[0]?.capturedAt ?? new Date(0)}
          ORDER BY started_at DESC,capture_ref ASC LIMIT 1 FOR SHARE`);
        if (pending[0]) {
          discovery =
            pending[0].status === "FAILED" ? "UNAVAILABLE" : "PARTIAL";
          limitations.add(
            pending[0].status === "FAILED"
              ? "INSTAGRAM_DISCOVERY_FAILED_RETAINED_PORTFOLIO"
              : "INSTAGRAM_DISCOVERY_PROCESSING_RETAINED_PORTFOLIO",
          );
        }
      }
    }
    // Every accepted publishing-evidence media reference qualifies separately;
    // never collapse an entire completed Collaboration to its latest proof.
    // Canonical explicit columns avoid an unused unmigrated legacy Prisma field.
    // Both branches and the final execution are bounded; source rows are locked
    // read-only through the short owning Portfolio transaction.
    const deliverables = await tx.$queryRaw<
      Array<{
        id: string;
        collaborationId: string;
        creatorProfileId: string;
        creatorWorkspaceId: string;
        completedAt: Date;
        publishingRequired: boolean;
        evidenceId: string;
        destination: string;
        verifiedAt: Date;
      }>
    >(Prisma.sql`
      WITH published AS MATERIALIZED (
        SELECT d.id,c.id "collaborationId",c.creator_profile_id "creatorProfileId",c.creator_workspace_id "creatorWorkspaceId",c.completed_at "completedAt",
        true "publishingRequired",e.id "evidenceId",e.evidence_ref destination,e.verified_at "verifiedAt"
        FROM collaborations c JOIN collaboration_deliverable_executions d ON d.collaboration_id=c.id
        JOIN collaboration_publishing_executions p ON p.deliverable_execution_id=d.id
        JOIN collaboration_publishing_evidence e ON e.publishing_execution_id=p.id
        WHERE c.authority_version='CANONICAL_V1' AND c.lifecycle='COMPLETED' AND c.completed_at IS NOT NULL
        AND c.creator_profile_id=${actor.subjectCreatorProfileId} AND c.creator_workspace_id=${actor.workspaceId} AND c.creator_id=${actor.subjectOwnerUserId}
        AND d.state IN ('APPROVED','AUTO_APPROVED') AND d.publishing_required=true
        AND p.state='COMPLIANCE_VERIFIED' AND p.compliance_verified_at IS NOT NULL AND e.verified_at IS NOT NULL
        ORDER BY c.id,d.id,e.sequence,e.id LIMIT ${PORTFOLIO_SOURCE_LIMIT + 1} FOR SHARE OF c,d,p,e
      ), ugc AS MATERIALIZED (
        SELECT d.id,c.id "collaborationId",c.creator_profile_id "creatorProfileId",c.creator_workspace_id "creatorWorkspaceId",c.completed_at "completedAt",
        false "publishingRequired",s.id "evidenceId",s.asset_ref destination,COALESCE(s.reviewed_at,s.auto_approved_at) "verifiedAt"
        FROM collaborations c JOIN collaboration_deliverable_executions d ON d.collaboration_id=c.id
        JOIN LATERAL (SELECT id,asset_ref,reviewed_at,auto_approved_at FROM collaboration_submission_versions
          WHERE deliverable_execution_id=d.id AND review_state IN ('APPROVED','AUTO_APPROVED') AND superseded_at IS NULL
          AND COALESCE(reviewed_at,auto_approved_at) IS NOT NULL ORDER BY version_number DESC LIMIT 1 FOR SHARE) s ON true
        WHERE c.authority_version='CANONICAL_V1' AND c.lifecycle='COMPLETED' AND c.completed_at IS NOT NULL
        AND c.creator_profile_id=${actor.subjectCreatorProfileId} AND c.creator_workspace_id=${actor.workspaceId} AND c.creator_id=${actor.subjectOwnerUserId}
        AND d.state IN ('APPROVED','AUTO_APPROVED') AND d.publishing_required=false
        ORDER BY c.id,d.id,s.id LIMIT ${PORTFOLIO_SOURCE_LIMIT + 1} FOR SHARE OF c,d
      ) SELECT * FROM published UNION ALL SELECT * FROM ugc ORDER BY "collaborationId",id,"evidenceId" LIMIT ${PORTFOLIO_SOURCE_LIMIT + 1}`);
    if (deliverables.length > PORTFOLIO_SOURCE_LIMIT)
      limitations.add("SOURCE_ADAPTATION_BOUND_REACHED");
    for (const d of deliverables.slice(0, PORTFOLIO_SOURCE_LIMIT)) {
      const { destination, verifiedAt } = d;
      try {
        if (!verifiedAt)
          throw new Error("PORTFOLIO_C04_VERIFICATION_TIME_MISSING");
        const adapted = adaptPortfolioC04(
          {
            creatorProfileId: d.creatorProfileId,
            creatorWorkspaceId: d.creatorWorkspaceId,
            collaborationId: d.collaborationId,
            deliverableExecutionId: d.id,
            evidenceId: d.evidenceId,
            authority: "CANONICAL_V1",
            lifecycle: "COMPLETED",
            publishingRequired: d.publishingRequired,
            state: d.publishingRequired
              ? "PUBLISHING_VERIFIED"
              : "UGC_APPROVED_COMPLETED",
            verifiedAt: verifiedAt.toISOString(),
            destination,
          },
          {
            creatorProfileId: actor.subjectCreatorProfileId,
            workspaceId: actor.workspaceId,
          },
        );
        items.push(
          PortfolioItemSchema.parse({
            id: portfolioIdentity(
              actor.subjectCreatorProfileId,
              `c04:${d.id}:${d.evidenceId}`,
            ),
            kind: adapted.destination.includes("instagram.com/reel/")
              ? "INSTAGRAM_REEL"
              : d.publishingRequired
                ? "EXTERNAL"
                : "UGC",
            destination: adapted.destination,
            title: d.publishingRequired
              ? "Completed published work"
              : "Completed UGC work",
            creatorContext: null,
            brandLabel: null,
            workDate: d.completedAt.toISOString(),
            state: "INCLUDED",
            provenance: [adapted.provenance],
            presentation: "SOURCE_LINK_ONLY",
            access: "ACCESS_REQUIREMENTS_UNKNOWN",
          }),
        );
      } catch {
        limitations.add("CREATOR_SHOP_WORK_REFERENCE_UNAVAILABLE");
      }
    }
    if (
      limitations.has("CREATOR_SHOP_WORK_REFERENCE_UNAVAILABLE") ||
      limitations.has("SOURCE_ADAPTATION_BOUND_REACHED")
    )
      discovery = "PARTIAL";
    return { items, discovery, limitations: [...limitations].sort() };
  }
}
