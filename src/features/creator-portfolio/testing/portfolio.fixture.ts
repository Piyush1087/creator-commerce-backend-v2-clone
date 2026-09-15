import { randomUUID } from "node:crypto";
import {
  type CreatorTeamRole,
  type PrismaClient,
  UserRole,
} from "@prisma/client";
import type { AuthUser } from "../../auth/types/auth-user";
import { audienceV1TestOwner } from "../../creator-audience-v1/creator-audience-v1.test-fixture";
export async function portfolioTestOwner(db: PrismaClient) {
  const source = await audienceV1TestOwner(db);
  const ownerUser = await db.user.findUniqueOrThrow({
    where: { id: source.actor.actorUserId },
  });
  const seat = async (
    role: CreatorTeamRole,
    user: { id: string; email: string },
  ) => {
    const membership = await db.creatorWorkspaceMember.create({
      data: {
        workspaceId: source.workspace.id,
        userId: user.id,
        assignedProfileId: role === "OWNER" ? source.profile.id : null,
        associatedEmail: user.email,
        securityRole: role,
        isActive: true,
      },
    });
    const auth: AuthUser = {
      id: user.id,
      email: user.email,
      role: UserRole.CREATOR,
      name: null,
      organizationId: source.actor.organizationId,
    };
    return { auth, membership };
  };
  const owner = await seat("OWNER", ownerUser);
  const extra = async (role: CreatorTeamRole) =>
    seat(
      role,
      await db.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          role: "CREATOR",
          authState: "ACTIVE",
          organizationId: source.actor.organizationId,
          emailVerifiedAt: new Date(),
        },
      }),
    );
  return {
    ...source,
    actor: { ...source.actor, actorMembershipId: owner.membership.id },
    owner,
    manager: await extra("MANAGER"),
    assistant: await extra("ASSISTANT"),
  };
}
export function portfolioReference(expectedRevision = 0) {
  return {
    intent: "ADD_REFERENCE" as const,
    expectedRevision,
    idempotencyKey: randomUUID(),
    kind: "UGC" as const,
    destination: `https://drive.google.com/file/d/${randomUUID()}/view`,
    title: "Authorized work reference",
    creatorContext: null,
    workDate: null,
  };
}
