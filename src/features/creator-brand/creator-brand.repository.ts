import { Injectable, ConflictException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import {
  assertCreatorWorkspaceAction,
  lockCreatorTeam,
} from "../creator-settings/team/creator-team.policy";
import {
  CreatorBrandRevisionContractSchema,
  CreatorBrandProfileInputSchema,
} from "./contracts/creator-brand-profile.contract";
import { CreatorBrandManualRequestSchema } from "./dto/creator-brand-consumer.schema";
import type { z } from "zod";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";

export function projectCreatorBrandAvatar(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      [...url.searchParams.keys()].some((key) =>
        /token|signature|credential|^sig$|^x-amz-/iu.test(key),
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

@Injectable()
export class CreatorBrandRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
  ) {}

  read(user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
      assertCreatorWorkspaceAction(actor.allowedActions, "CREATOR_BRAND_READ");
      const profile = await tx.creatorBrandProfile.findUnique({
        where: { workspaceId: actor.workspaceId },
      });
      if (profile && profile.ownerProfileId !== actor.subjectCreatorProfileId)
        throw new ConflictException({
          code: "CREATOR_BRAND_SUBJECT_INCONSISTENT",
        });
      if (profile) {
        const revision = await tx.creatorBrandRevision.findUniqueOrThrow({
          where: {
            profileId_revision: {
              profileId: profile.id,
              revision: profile.currentRevision,
            },
          },
        });
        if (
          JSON.stringify(revision.snapshot) !== JSON.stringify(profile.snapshot)
        )
          throw new ConflictException({
            code: "CREATOR_BRAND_REVISION_INCONSISTENT",
          });
      }
      return {
        actor,
        revision: profile?.currentRevision ?? 0,
        values: profile
          ? CreatorBrandProfileInputSchema.parse(profile.snapshot)
          : null,
        identity: await this.identity(tx, actor),
      };
    });
  }

  mutate(
    user: AuthUser,
    command: z.infer<typeof CreatorBrandManualRequestSchema>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      let actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
      assertCreatorWorkspaceAction(actor.allowedActions, "CREATOR_BRAND_EDIT");
      // Same lock as Team mutations; fence membership again after any wait.
      const lockedWorkspaceId = actor.workspaceId;
      await lockCreatorTeam(tx, actor.workspaceId);
      actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
      if (actor.workspaceId !== lockedWorkspaceId)
        throw new ConflictException({ code: "CREATOR_BRAND_SUBJECT_CHANGED" });
      assertCreatorWorkspaceAction(actor.allowedActions, "CREATOR_BRAND_EDIT");
      const values = CreatorBrandProfileInputSchema.parse(command.values);
      const commandHash = createHash("sha256")
        .update(
          JSON.stringify({
            actorUserId: actor.actorUserId,
            actorMembershipId: actor.actorMembershipId,
            expectedRevision: command.expectedRevision,
            intent: command.intent,
            values,
          }),
        )
        .digest("hex");
      let profile = await tx.creatorBrandProfile.findUnique({
        where: { workspaceId: actor.workspaceId },
      });
      if (profile && profile.ownerProfileId !== actor.subjectCreatorProfileId)
        throw new ConflictException({
          code: "CREATOR_BRAND_SUBJECT_INCONSISTENT",
        });
      const replay = profile
        ? await tx.creatorBrandRevision.findUnique({
            where: {
              profileId_idempotencyKey: {
                profileId: profile.id,
                idempotencyKey: command.idempotencyKey,
              },
            },
          })
        : null;
      if (replay) {
        if (replay.commandHash !== commandHash)
          throw new ConflictException({
            code: "CREATOR_BRAND_IDEMPOTENCY_CONFLICT",
          });
        return {
          actor,
          revision: replay.revision,
          values: CreatorBrandProfileInputSchema.parse(replay.snapshot),
          identity: await this.identity(tx, actor),
        };
      }
      const previousRevision = profile?.currentRevision ?? 0;
      if (previousRevision !== command.expectedRevision)
        throw new ConflictException({
          code: "CREATOR_BRAND_REVISION_CONFLICT",
        });
      const revision = previousRevision + 1;
      const capturedAt = new Date();
      CreatorBrandRevisionContractSchema.parse({
        subject: {
          creatorWorkspaceId: actor.workspaceId,
          ownerCreatorProfileId: actor.subjectCreatorProfileId,
          ownerUserId: actor.subjectOwnerUserId,
        },
        actor: {
          actorUserId: actor.actorUserId,
          actorMembershipId: actor.actorMembershipId,
          actorRole: actor.actorRole,
        },
        revision,
        previousRevision,
        idempotencyKey: command.idempotencyKey,
        createdAt: capturedAt.toISOString(),
        origin: "MANUAL",
        confirmedValues: values,
        serverVerifiedSuggestionReference: null,
      });
      if (!profile)
        profile = await tx.creatorBrandProfile.create({
          data: {
            workspaceId: actor.workspaceId,
            ownerProfileId: actor.subjectCreatorProfileId,
            currentRevision: revision,
            snapshot: values as Prisma.InputJsonValue,
          },
        });
      await tx.creatorBrandRevision.create({
        data: {
          profileId: profile.id,
          revision,
          previousRevision,
          snapshot: values as Prisma.InputJsonValue,
          actorUserId: actor.actorUserId,
          actorMembershipId: actor.actorMembershipId,
          actorRole: actor.actorRole,
          origin: "MANUAL",
          idempotencyKey: command.idempotencyKey,
          commandHash,
        },
      });
      if (previousRevision > 0)
        await tx.creatorBrandProfile.update({
          where: { id: profile.id },
          data: {
            currentRevision: revision,
            snapshot: values as Prisma.InputJsonValue,
          },
        });
      const stored = await tx.creatorBrandProfile.findUniqueOrThrow({
        where: { id: profile.id },
      });
      return {
        actor,
        revision: stored.currentRevision,
        values: CreatorBrandProfileInputSchema.parse(stored.snapshot),
        identity: await this.identity(tx, actor),
      };
    });
  }

  private async identity(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
  ) {
    const owner = await tx.creatorProfile.findUniqueOrThrow({
      where: { id: actor.subjectCreatorProfileId },
      select: { displayName: true, avatarUrl: true },
    });
    const source = await tx.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: actor.subjectCreatorProfileId,
          platformNetwork: "INSTAGRAM",
        },
      },
      select: {
        channelHandleString: true,
        disconnectedAt: true,
        tokenStateCondition: true,
        tokenExpiresAt: true,
        authorizationHealth: true,
      },
    });
    const connected =
      source &&
      !source.disconnectedAt &&
      source.tokenStateCondition === "ACTIVE" &&
      source.authorizationHealth !== "DISCONNECTED" &&
      (!source.tokenExpiresAt || source.tokenExpiresAt > new Date());
    // No credential fields selected or decrypted; never legacy stale profile handle.
    return {
      creatorName: owner.displayName,
      avatarImageReference: projectCreatorBrandAvatar(owner.avatarUrl),
      primaryInstagramHandle: connected ? source.channelHandleString : null,
    };
  }
}
