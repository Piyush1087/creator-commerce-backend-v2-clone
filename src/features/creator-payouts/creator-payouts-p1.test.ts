import { readFileSync } from "node:fs";

import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";

import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import type { AuthUser } from "../auth/types/auth-user";
import { creatorWorkspaceActionsForRole } from "../creator-settings/team/creator-team.policy";
import type { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { CreatorPayoutsAuthorizationService } from "./services/creator-payouts-authorization.service";
import { CreatorPayoutsCursorCodec } from "./utils/creator-payouts-cursor";

const scope = {
  workspaceId: "workspace-1",
  organizationId: "organization-1",
  subjectCreatorProfileId: "creator-profile-1",
  subjectOwnerUserId: "owner-user-1",
  membershipId: "membership-1",
  actorRole: "OWNER" as const,
  authorizationVersion: "membership:2026-09-08T00:00:00.000Z",
};

describe("C06 P1 contracts and authorization", () => {
  it("grants the distinct read action only to Owner and Manager", () => {
    expect(creatorWorkspaceActionsForRole("OWNER")).toContain(
      "PAYOUT_WORKSPACE_READ",
    );
    expect(creatorWorkspaceActionsForRole("MANAGER")).toContain(
      "PAYOUT_WORKSPACE_READ",
    );
    expect(creatorWorkspaceActionsForRole("ASSISTANT")).not.toContain(
      "PAYOUT_WORKSPACE_READ",
    );
  });

  it.each(["OWNER", "MANAGER"] as const)(
    "resolves %s before projection",
    async (actorRole) => {
      const actor = actorContext(actorRole);
      const actors = {
        resolveReadOnly: async () => actor,
      } as unknown as CreatorWorkspaceActorService;
      await expect(
        new CreatorPayoutsAuthorizationService(actors).resolve({
          id: actor.actorUserId,
        } as AuthUser),
      ).resolves.toMatchObject({
        actorRole,
        subjectCreatorProfileId: "creator-profile-1",
      });
    },
  );

  it("denies Assistant before projection", async () => {
    const actors = {
      resolveReadOnly: async () => actorContext("ASSISTANT"),
    } as unknown as CreatorWorkspaceActorService;
    await expect(
      new CreatorPayoutsAuthorizationService(actors).resolve({
        id: "assistant",
      } as AuthUser),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("binds signed cursors to endpoint, filters, Creator, membership, role and authorization version", () => {
    const codec = new CreatorPayoutsCursorCodec(
      new ConfigService({ JWT_SECRET: "c06-p1-test-secret" }),
    );
    const asOf = new Date("2026-09-08T12:00:00.000Z");
    const cursor = codec.encode({
      endpoint: "obligations",
      filterKey: "{}",
      authorization: scope,
      asOf,
      lastRecordedAt: new Date("2026-09-08T11:00:00.000Z"),
      lastStableId: "obligation-1",
    });
    expect(
      codec.decode({
        cursor,
        endpoint: "obligations",
        filterKey: "{}",
        authorization: scope,
        requestAsOf: asOf,
      }),
    ).toMatchObject({ lastStableId: "obligation-1" });
    expect(() =>
      codec.decode({
        cursor,
        endpoint: "history",
        filterKey: "{}",
        authorization: scope,
        requestAsOf: asOf,
      }),
    ).toThrow();
    expect(() =>
      codec.decode({
        cursor: `${cursor.slice(0, -1)}x`,
        endpoint: "obligations",
        filterKey: "{}",
        authorization: scope,
        requestAsOf: asOf,
      }),
    ).toThrow();
    expect(() =>
      codec.decode({
        cursor,
        endpoint: "obligations",
        filterKey: "{}",
        authorization: { ...scope, subjectCreatorProfileId: "foreign" },
        requestAsOf: asOf,
      }),
    ).toThrow();
  });

  it("exposes exactly six GET-only C06 routes with private no-store and no provider composition", () => {
    const controller = readFileSync(
      "src/features/creator-payouts/creator-payouts.controller.ts",
      "utf8",
    );
    const module = readFileSync(
      "src/features/creator-payouts/creator-payouts.module.ts",
      "utf8",
    );
    expect(controller.match(/@Get\(/g)).toHaveLength(6);
    expect(controller).not.toMatch(/@(Post|Put|Patch|Delete)\(/);
    expect(controller).toContain('"private, no-store"');
    expect(controller).toContain('@Get("obligations")');
    expect(controller).toContain('@Get("history")');
    expect(controller).toContain('@Get("payout-method")');
    expect(module).not.toMatch(
      /ProviderNeutralPayoutService|CreatorPayoutProviderPort|CREATOR_PAYOUT_PROVIDER_PORT/,
    );
  });
});

function actorContext(
  actorRole: "OWNER" | "MANAGER" | "ASSISTANT",
): CreatorWorkspaceActorContext {
  return {
    actorUserId: `actor-${actorRole}`,
    actorMembershipId: `membership-${actorRole}`,
    actorRole,
    authorizationVersion: "membership:2026-09-08T00:00:00.000Z",
    workspaceId: "workspace-1",
    organizationId: "organization-1",
    subjectCreatorProfileId: "creator-profile-1",
    subjectOwnerUserId: "owner-user-1",
    allowedActions: creatorWorkspaceActionsForRole(actorRole),
  };
}
