import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  CollaborationLifecycle,
  CollaborationStage,
  Prisma,
  UceMilestoneStage,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import type { ListCollaborationThreadsQueryDto } from "../dto/collaboration-query.dto";
import {
  projectCanonicalCollaborationDetail,
  projectCanonicalCollaborationThreadRow,
} from "../utils/collaboration-thread.mapper";
import {
  COLLABORATION_THREAD_INCLUDE,
  CollaborationAccessService,
} from "./collaboration-access.service";

@Injectable()
export class CollaborationQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CollaborationAccessService,
  ) {}

  async list(user: AuthUser, query: ListCollaborationThreadsQueryDto) {
    const where: Prisma.CollaborationWhereInput = {};
    const viewerRole = this.viewerRole(user);

    if (viewerRole === "BRAND") {
      where.brandProfileId = await this.access.resolveBrandProfileId(user);
    } else {
      where.creatorUserId = user.id;
    }

    if (query.campaign_id) where.campaignId = query.campaign_id;
    if (query.brief_id) where.briefId = query.brief_id;
    const compatibilityFilters = buildCompatibilityAwareFilters(query);
    if (compatibilityFilters.length > 0) where.AND = compatibilityFilters;

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { campaign: { name: { contains: term, mode: "insensitive" } } },
        { brief: { internalTitle: { contains: term, mode: "insensitive" } } },
        { brandProfile: { name: { contains: term, mode: "insensitive" } } },
        {
          creatorUser: {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              {
                creatorProfile: {
                  is: {
                    displayName: { contains: term, mode: "insensitive" },
                  },
                },
              },
              {
                creatorProfile: {
                  is: {
                    instagramHandle: { contains: term, mode: "insensitive" },
                  },
                },
              },
            ],
          },
        },
      ];
    }

    const rows = await this.prisma.collaboration.findMany({
      where,
      include: COLLABORATION_THREAD_INCLUDE,
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: query.limit ?? 50,
    });

    return {
      rows: rows.map((row) =>
        projectCanonicalCollaborationThreadRow(row, viewerRole),
      ),
    };
  }

  async detail(user: AuthUser, collaborationId: string) {
    const row = await this.access.assertThreadForUser(user, collaborationId);
    const viewerRole = this.viewerRole(user);

    await this.prisma.collaboration.update({
      where: { id: collaborationId },
      data:
        viewerRole === "BRAND"
          ? { unreadCountBrand: 0 }
          : { unreadCountCreator: 0 },
    });

    return projectCanonicalCollaborationDetail(
      {
        ...row,
        ...(viewerRole === "BRAND"
          ? { unreadCountBrand: 0 }
          : { unreadCountCreator: 0 }),
      },
      viewerRole,
    );
  }

  private viewerRole(user: AuthUser): "BRAND" | "CREATOR" {
    if (user.role === UserRole.BRAND) return "BRAND";
    if (user.role === UserRole.CREATOR) return "CREATOR";
    throw new ForbiddenException("Unsupported role");
  }
}

export function buildCompatibilityAwareFilters(
  query: Pick<ListCollaborationThreadsQueryDto, "lifecycle" | "stage">,
): Prisma.CollaborationWhereInput[] {
  const filters: Prisma.CollaborationWhereInput[] = [];

  if (query.lifecycle) {
    const alternatives: Prisma.CollaborationWhereInput[] = [
      {
        sourceApplicationId: { not: null },
        lifecycle: query.lifecycle,
      },
    ];
    const legacy = legacyLifecycleFilter(query.lifecycle);
    if (legacy) alternatives.push(legacy);
    filters.push({ OR: alternatives });
  }

  if (query.stage) {
    filters.push({
      OR: [
        {
          sourceApplicationId: { not: null },
          canonicalStage: query.stage,
        },
        {
          sourceApplicationId: null,
          currentStage: { in: legacyStagesFor(query.stage) },
        },
      ],
    });
  }

  return filters;
}

function legacyLifecycleFilter(
  lifecycle: CollaborationLifecycle,
): Prisma.CollaborationWhereInput | null {
  switch (lifecycle) {
    case CollaborationLifecycle.ACTIVE:
      return {
        sourceApplicationId: null,
        isTerminated: false,
        isPaused: false,
      };
    case CollaborationLifecycle.PAUSED:
      return {
        sourceApplicationId: null,
        isTerminated: false,
        isPaused: true,
      };
    case CollaborationLifecycle.TERMINATED:
      return { sourceApplicationId: null, isTerminated: true };
    case CollaborationLifecycle.COMPLETED:
    case CollaborationLifecycle.CANCELLED:
      return null;
  }
}

function legacyStagesFor(stage: CollaborationStage): UceMilestoneStage[] {
  switch (stage) {
    case CollaborationStage.NEGOTIATION:
      return [UceMilestoneStage.STAGE_1_NEGOTIATION];
    case CollaborationStage.SECUREMENT:
      return [UceMilestoneStage.STAGE_2_SECUREMENT];
    case CollaborationStage.FULFILLMENT:
      return [UceMilestoneStage.STAGE_3_LOGISTICS];
    case CollaborationStage.PRODUCTION:
      return [UceMilestoneStage.STAGE_4_CONTENT_REVIEW];
    case CollaborationStage.PUBLISHING_SETTLEMENT:
      return [
        UceMilestoneStage.STAGE_5_PUBLISHING,
        UceMilestoneStage.STAGE_6_FEEDBACK_SYNC,
      ];
  }
}
