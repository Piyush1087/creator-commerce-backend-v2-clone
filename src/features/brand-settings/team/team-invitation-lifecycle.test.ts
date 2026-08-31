import type { TeamInvitation } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  effectiveTeamInvitationStatus,
  TEAM_INVITATION_STATUS,
} from "./team-invitation-lifecycle";

function invitation(status: string, expiresAt: Date) {
  return { status, expiresAt } as TeamInvitation;
}

describe("BS-02 invitation lifecycle", () => {
  const now = new Date("2026-08-29T00:00:00.000Z");

  it.each([
    ["PENDING", "2026-08-29T00:00:00.001Z", "PENDING"],
    ["PENDING", "2026-08-29T00:00:00.000Z", "EXPIRED"],
    ["PENDING", "2026-08-28T23:59:59.999Z", "EXPIRED"],
    ["ACCEPTED", "2026-08-28T00:00:00.000Z", "ACCEPTED"],
    ["CANCELLED", "2026-08-28T00:00:00.000Z", "CANCELLED"],
    ["EXPIRED", "2026-08-30T00:00:00.000Z", "EXPIRED"],
    ["UNEXPECTED", "2026-08-30T00:00:00.000Z", "UNKNOWN"],
  ])("maps %s at %s to %s", (status, expiresAt, expected) => {
    expect(
      effectiveTeamInvitationStatus(
        invitation(status, new Date(expiresAt)),
        now,
      ),
    ).toBe(expected);
  });

  it("freezes distinct terminal states", () => {
    expect(TEAM_INVITATION_STATUS).toEqual({
      PENDING: "PENDING",
      ACCEPTED: "ACCEPTED",
      CANCELLED: "CANCELLED",
      EXPIRED: "EXPIRED",
    });
  });
});
