import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import {
  projectCreatorBriefPack,
  type CreatorBriefPackV1,
} from "./creator-brief-pack.projection";

@Injectable()
export class CreatorBriefPackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
  ) {}

  async get(
    user: AuthUser,
    applicationId: string,
  ): Promise<CreatorBriefPackV1> {
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.actors.resolveInTransaction(tx, user);
      const row = await tx.uceApplication.findFirst({
        where: {
          id: applicationId,
          subjectCreatorProfileId: actor.subjectCreatorProfileId,
          subjectCreatorWorkspaceId: actor.workspaceId,
        },
        select: {
          id: true,
          authorityVersion: true,
          campaignId: true,
          canonicalCampaignAssetId: true,
          canonicalBriefId: true,
          subjectCreatorProfileId: true,
          subjectCreatorWorkspaceId: true,
          appliedAt: true,
          snapshot: {
            select: {
              applicationId: true,
              schemaVersion: true,
              createdAt: true,
              campaignContext: true,
              campaignAssetContext: true,
              briefContext: true,
              commercialContext: true,
              creatorIdentity: true,
            },
          },
        },
      });
      if (!row) throw new NotFoundException({ code: "APPLICATION_NOT_FOUND" });
      return projectCreatorBriefPack(row);
    });
  }
}
