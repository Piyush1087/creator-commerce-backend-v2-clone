import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { CreatorTeamRole, WorkspaceInvitationStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  assertAssignableCreatorTeamRole,
  assertCreatorTeamSeatCapacity,
  assertCreatorTeamManager,
  assertCreatorWorkspaceAction,
  assertMutableCreatorTeamTarget,
  creatorWorkspaceActionsForRole,
  effectiveCreatorInvitationStatus,
} from "./creator-team.policy";
import { resolveCreatorTeamReadmission } from "./creator-team-invitations.service";

describe("C05 Creator Team policy", () => {
  it.each([CreatorTeamRole.OWNER, CreatorTeamRole.MANAGER])(
    "allows %s to administer non-Owner Team actors",
    (role) => {
      expect(() => assertCreatorTeamManager(role)).not.toThrow();
      expect(creatorWorkspaceActionsForRole(role)).toContain("TEAM_MANAGE");
    },
  );

  it("denies Assistant Team and workspace administration", () => {
    expect(creatorWorkspaceActionsForRole(CreatorTeamRole.ASSISTANT)).toEqual([
      "CAMPAIGN_OPPORTUNITY_VIEW",
      "CAMPAIGN_APPLICATION_APPLY",
    ]);
    expect(() => assertCreatorTeamManager(CreatorTeamRole.ASSISTANT)).toThrow(
      ForbiddenException,
    );
    expect(() => assertCreatorWorkspaceAction([], "TEAM_READ")).toThrow(
      ForbiddenException,
    );
  });

  it.each([CreatorTeamRole.MANAGER, CreatorTeamRole.ASSISTANT])(
    "accepts assignable role %s",
    (role) => {
      expect(() => assertAssignableCreatorTeamRole(role)).not.toThrow();
    },
  );

  it("prevents a second Owner through admission or role changes", () => {
    expect(() =>
      assertAssignableCreatorTeamRole(CreatorTeamRole.OWNER),
    ).toThrow(BadRequestException);
    expect(() =>
      assertMutableCreatorTeamTarget({
        actorUserId: "owner-user",
        targetUserId: "manager-user",
        targetRole: CreatorTeamRole.MANAGER,
        nextRole: CreatorTeamRole.OWNER,
      }),
    ).toThrow(BadRequestException);
  });

  it.each([CreatorTeamRole.MANAGER, CreatorTeamRole.ASSISTANT])(
    "protects the canonical Owner from %s replacement",
    (nextRole) => {
      expect(() =>
        assertMutableCreatorTeamTarget({
          actorUserId: "actor-user",
          targetUserId: "owner-user",
          targetRole: CreatorTeamRole.OWNER,
          nextRole,
        }),
      ).toThrow(ConflictException);
    },
  );

  it("prevents self-removal or self-role mutation", () => {
    expect(() =>
      assertMutableCreatorTeamTarget({
        actorUserId: "same-user",
        targetUserId: "same-user",
        targetRole: CreatorTeamRole.MANAGER,
      }),
    ).toThrow(BadRequestException);
  });

  it.each([
    [4, 0],
    [3, 1],
    [1, 3],
  ])(
    "allows occupancy below five (%i active, %i pending)",
    (active, pending) => {
      expect(() =>
        assertCreatorTeamSeatCapacity(active, pending),
      ).not.toThrow();
    },
  );

  it.each([
    [5, 0],
    [4, 1],
    [3, 2],
  ])(
    "enforces the five-seat cap (%i active, %i pending)",
    (active, pending) => {
      expect(() => assertCreatorTeamSeatCapacity(active, pending)).toThrow(
        BadRequestException,
      );
    },
  );

  it("projects invitation expiry without promoting terminal states", () => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    expect(
      effectiveCreatorInvitationStatus(
        {
          invitationStatus: WorkspaceInvitationStatus.PENDING,
          expiresAt: new Date("2026-09-01T12:00:01.000Z"),
        },
        now,
      ),
    ).toBe(WorkspaceInvitationStatus.PENDING);
    expect(
      effectiveCreatorInvitationStatus(
        {
          invitationStatus: WorkspaceInvitationStatus.PENDING,
          expiresAt: new Date("2026-09-01T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe(WorkspaceInvitationStatus.EXPIRED);
    expect(
      effectiveCreatorInvitationStatus(
        {
          invitationStatus: WorkspaceInvitationStatus.ACCEPTED,
          expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        now,
      ),
    ).toBe(WorkspaceInvitationStatus.ACCEPTED);
  });

  it("reactivates only an inactive canonical row for the accepting User", () => {
    expect(
      resolveCreatorTeamReadmission(
        [{ id: "inactive-member", userId: "invited-user", isActive: false }],
        "invited-user",
      ),
    ).toBe("inactive-member");
    expect(resolveCreatorTeamReadmission([], "invited-user")).toBeNull();
  });

  it("keeps email-only, mismatched, active, and ambiguous rows fail-closed", () => {
    expect(() =>
      resolveCreatorTeamReadmission(
        [{ id: "legacy", userId: null, isActive: false }],
        "invited-user",
      ),
    ).toThrow(ConflictException);
    expect(() =>
      resolveCreatorTeamReadmission(
        [{ id: "other", userId: "other-user", isActive: false }],
        "invited-user",
      ),
    ).toThrow(ConflictException);
    expect(() =>
      resolveCreatorTeamReadmission(
        [{ id: "active", userId: "invited-user", isActive: true }],
        "invited-user",
      ),
    ).toThrow(ConflictException);
    expect(() =>
      resolveCreatorTeamReadmission(
        [
          { id: "one", userId: "invited-user", isActive: false },
          { id: "two", userId: null, isActive: false },
        ],
        "invited-user",
      ),
    ).toThrow(ConflictException);
  });
});
