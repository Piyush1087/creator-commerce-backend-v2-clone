import { ConflictException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import type { CampaignContinuationContextPort } from "../creator-entry/campaign-continuation-context.port";
import { hashCreatorEntryContinuationToken } from "../creator-entry/creator-entry-continuation.store";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { lockCreatorTeam } from "../creator-settings/team/creator-team.policy";
import { CampaignInvitationService } from "./campaign-invitation.service";

@Injectable()
export class CampaignContinuationContextService implements CampaignContinuationContextPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
    private readonly invitations: CampaignInvitationService,
  ) {}

  async bind(user: AuthUser, opaqueToken: string, now: Date): Promise<string> {
    const initial = await this.actors.resolve(user);
    const result = await this.prisma.$transaction(async (tx) => {
      await lockCreatorTeam(tx, initial.workspaceId);
      const actor = await this.actors.resolveInTransaction(
        tx,
        user,
        initial.workspaceId,
      );
      const row = await tx.creatorEntryContinuation.findUnique({
        where: { tokenDigest: hashCreatorEntryContinuationToken(opaqueToken) },
      });
      if (
        !row ||
        row.boundUserId !== user.id ||
        row.expiresAt <= now ||
        (row.boundCreatorProfileId &&
          (row.boundCreatorProfileId !== actor.subjectCreatorProfileId ||
            row.boundCreatorWorkspaceId !== actor.workspaceId))
      ) {
        throw new ConflictException({
          code: "CREATOR_ENTRY_CONTINUATION_IDENTITY_CONFLICT",
        });
      }
      if (row.campaignInvitationId) {
        const result = await this.invitations.validateAndBind(
          tx,
          actor,
          row.campaignId,
          row.campaignInvitationId,
          now,
        );
        if (result !== "VALID")
          throw new ConflictException({ code: `INVITATION_${result}` });
      }
      if (!row.boundCreatorProfileId)
        await tx.creatorEntryContinuation.update({
          where: { id: row.id },
          data: {
            boundCreatorProfileId: actor.subjectCreatorProfileId,
            boundCreatorWorkspaceId: actor.workspaceId,
          },
        });
      return { actor, row };
    });
    const { actor, row } = result;
    if (row.firstQualifiedTouchId) {
      try {
        await this.prisma.campaignIngressTouch.updateMany({
          where: {
            id: row.firstQualifiedTouchId,
            campaignId: row.campaignId,
            boundCreatorProfileId: null,
            boundCreatorWorkspaceId: null,
          },
          data: {
            boundCreatorProfileId: actor.subjectCreatorProfileId,
            boundCreatorWorkspaceId: actor.workspaceId,
            boundAt: now,
          },
        });
      } catch {
        // Attribution is best effort and cannot prevent identity continuation.
      }
    }
    return actor.subjectOwnerUserId;
  }
}
