import { Injectable } from "@nestjs/common";
import { SocialNetworkProvider } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import type { AuthUser } from "../../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../team/creator-workspace-actor.service";

export type CreatorSettingsHomeRead = Readonly<{
  creator: {
    id: string;
    displayName: string;
    workspaceId: string;
    workspaceDisplayName: string;
    role: CreatorWorkspaceActorContext["actorRole"];
  };
  blockers: Array<{
    id: string;
    code:
      | "INSTAGRAM_RECONNECT_REQUIRED"
      | "INSTAGRAM_REVALIDATION_REQUIRED"
      | "RECOVERABLE_INSTAGRAM_PROVIDER_BLOCK";
    title: string;
    subtitle: string;
    actionState: "AVAILABLE" | "READ_ONLY";
  }>;
  observedAt: string;
}>;

@Injectable()
export class CreatorSettingsHomeReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
  ) {}

  async read(
    user: AuthUser,
    expected: CreatorWorkspaceActorContext,
  ): Promise<CreatorSettingsHomeRead> {
    const actor = await this.actors.resolveReadOnly(user, expected.workspaceId);
    if (
      actor.actorUserId !== expected.actorUserId ||
      actor.actorMembershipId !== expected.actorMembershipId ||
      actor.subjectCreatorProfileId !== expected.subjectCreatorProfileId
    ) {
      throw new Error("Creator Home actor context changed during read");
    }
    const [workspace, profile, integration] = await Promise.all([
      this.prisma.creatorWorkspace.findUniqueOrThrow({
        where: { id: actor.workspaceId },
        select: { organizationDisplayName: true },
      }),
      this.prisma.creatorProfile.findUniqueOrThrow({
        where: { id: actor.subjectCreatorProfileId },
        select: { displayName: true },
      }),
      this.prisma.creatorSocialIntegration.findUnique({
        where: {
          creatorProfileId_platformNetwork: {
            creatorProfileId: actor.subjectCreatorProfileId,
            platformNetwork: SocialNetworkProvider.INSTAGRAM,
          },
        },
        select: {
          authorizationHealth: true,
          tokenStateCondition: true,
          disconnectedAt: true,
          basicAuthorizationCapability: true,
        },
      }),
    ]);
    const canManage =
      actor.actorRole !== "ASSISTANT" &&
      actor.allowedActions.includes("INSTAGRAM_SETTINGS_MANAGE");
    const blockers: CreatorSettingsHomeRead["blockers"] = [];
    if (integration) {
      const code =
        integration.disconnectedAt ||
        ["REVOKED", "EXPIRED"].includes(integration.tokenStateCondition)
          ? "INSTAGRAM_RECONNECT_REQUIRED"
          : integration.authorizationHealth === "PROVIDER_ACCESS_BLOCKED"
            ? "RECOVERABLE_INSTAGRAM_PROVIDER_BLOCK"
            : integration.authorizationHealth === "REAUTHORIZATION_REQUIRED" ||
                integration.basicAuthorizationCapability === "UNAVAILABLE"
              ? "INSTAGRAM_REVALIDATION_REQUIRED"
              : null;
      if (code) {
        blockers.push({
          id: `settings:${code.toLowerCase()}`,
          code,
          title:
            code === "INSTAGRAM_RECONNECT_REQUIRED"
              ? "Reconnect Instagram"
              : code === "INSTAGRAM_REVALIDATION_REQUIRED"
                ? "Revalidate Instagram"
                : "Instagram access needs attention",
          subtitle: canManage
            ? "Open Instagram settings to restore access."
            : "An Owner or Manager needs to resolve this in Settings.",
          actionState: canManage ? "AVAILABLE" : "READ_ONLY",
        });
      }
    }
    return {
      creator: {
        id: actor.subjectCreatorProfileId,
        displayName: profile.displayName?.trim() || "Creator",
        workspaceId: actor.workspaceId,
        workspaceDisplayName: workspace.organizationDisplayName,
        role: actor.actorRole,
      },
      blockers,
      observedAt: new Date().toISOString(),
    };
  }
}
