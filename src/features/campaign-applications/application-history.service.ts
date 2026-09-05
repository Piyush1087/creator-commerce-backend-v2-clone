import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import type { AuthUser } from "../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";

export type ApplicationWithSnapshot = Prisma.UceApplicationGetPayload<{
  include: { snapshot: true; collaboration: { select: { id: true } } };
}>;
const cursorSchema = z
  .object({ appliedAt: z.string().datetime(), id: z.string().uuid() })
  .strict();
function object(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}
function pick(value: Prisma.JsonValue | undefined, keys: string[]) {
  const source = object(value);
  return Object.fromEntries(keys.map((key) => [key, source[key] ?? null]));
}

export function projectApplication(
  row: ApplicationWithSnapshot,
  actor?: CreatorWorkspaceActorContext,
  detail = false,
) {
  const snapshot = row.snapshot;
  const campaign = pick(snapshot?.campaignContext, [
    "id",
    "name",
    "brand",
    "objective",
    "platforms",
    "publishingStart",
    "publishingEnd",
    "applicationDeadline",
  ]);
  const asset = pick(snapshot?.campaignAssetContext, [
    "id",
    "campaignId",
    "kind",
    "offering",
    "offer",
  ]);
  const brief = pick(
    snapshot?.briefContext,
    detail
      ? [
          "id",
          "campaignAssetId",
          "briefName",
          "creativeIntent",
          "creatorBrief",
          "briefType",
          "platform",
          "briefLevelGuidance",
          "referenceContent",
          "usageRights",
          "creatorRequirements",
          "deliverables",
        ]
      : ["id", "campaignAssetId", "briefName"],
  );
  return {
    schemaVersion: 1,
    applicationId: row.id,
    referenceAuthority: "C03_CANONICAL" as const,
    campaignId: row.campaignId,
    canonicalCampaignAssetId: row.canonicalCampaignAssetId,
    canonicalBriefId: row.canonicalBriefId,
    status: row.status,
    statusVersion: row.statusVersion,
    appliedAt: row.appliedAt.toISOString(),
    terminalAt: row.terminalAt?.toISOString() ?? null,
    campaign,
    asset,
    brief,
    creator: pick(snapshot?.creatorIdentity, ["displayName", "avatarUrl"]),
    commercial: pick(snapshot?.commercialContext, [
      "compensationModel",
      "offer",
      "currency",
      "receivesBrandSupport",
      "brandSupportType",
      "brandSupportEstimatedValue",
    ]),
    canWithdrawPending:
      row.status === "PENDING" &&
      Boolean(
        actor?.allowedActions.includes("CAMPAIGN_APPLICATION_WITHDRAW_PENDING"),
      ),
    collaborationId: row.collaboration?.id ?? null,
  };
}

@Injectable()
export class ApplicationHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
  ) {}

  async collection(user: AuthUser, encodedCursor?: string) {
    let cursor: z.infer<typeof cursorSchema> | undefined;
    if (encodedCursor) {
      try {
        if (
          encodedCursor.length > 256 ||
          !/^[A-Za-z0-9_-]+$/.test(encodedCursor)
        )
          throw new Error();
        cursor = cursorSchema.parse(
          JSON.parse(Buffer.from(encodedCursor, "base64url").toString("utf8")),
        );
      } catch {
        throw new BadRequestException({ code: "APPLICATION_CURSOR_INVALID" });
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.actors.resolveInTransaction(tx, user);
      const rows = await tx.uceApplication.findMany({
        where: {
          authorityVersion: "C03_CANONICAL",
          subjectCreatorProfileId: actor.subjectCreatorProfileId,
          subjectCreatorWorkspaceId: actor.workspaceId,
          ...(cursor
            ? {
                OR: [
                  { appliedAt: { lt: new Date(cursor.appliedAt) } },
                  {
                    appliedAt: new Date(cursor.appliedAt),
                    id: { lt: cursor.id },
                  },
                ],
              }
            : {}),
        },
        include: { snapshot: true, collaboration: { select: { id: true } } },
        orderBy: [{ appliedAt: "desc" }, { id: "desc" }],
        take: 21,
      });
      const page = rows.slice(0, 20),
        last = page[page.length - 1];
      return {
        items: page.map((row) => projectApplication(row, actor)),
        nextCursor:
          rows.length > 20
            ? Buffer.from(
                JSON.stringify({
                  appliedAt: last.appliedAt.toISOString(),
                  id: last.id,
                }),
              ).toString("base64url")
            : null,
      };
    });
  }

  async detail(user: AuthUser, applicationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.actors.resolveInTransaction(tx, user);
      const row = await tx.uceApplication.findFirst({
        where: {
          id: applicationId,
          authorityVersion: "C03_CANONICAL",
          subjectCreatorProfileId: actor.subjectCreatorProfileId,
          subjectCreatorWorkspaceId: actor.workspaceId,
        },
        include: { snapshot: true, collaboration: { select: { id: true } } },
      });
      if (!row) throw new NotFoundException({ code: "APPLICATION_NOT_FOUND" });
      return projectApplication(row, actor, true);
    });
  }
}
