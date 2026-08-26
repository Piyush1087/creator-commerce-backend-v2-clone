import { BrandRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertTeamAuthority,
  canonicalInvitationRole,
} from "./brand-team-policy";
import {
  AcceptTeamInvitationSchema,
  InvitationTokenSchema,
} from "../schemas/team-invitation.schema";
import { hashInvitationToken } from "../services/brand-team-invitations.service";
import { randomBytes } from "node:crypto";

const roles = Object.values(BrandRole);
describe("BS-02 role and token boundaries", () => {
  it.each(
    roles.flatMap((actor) =>
      roles.flatMap((target) => roles.map((next) => ({ actor, target, next }))),
    ),
  )("$actor managing $target to $next", ({ actor, target, next }) => {
    const allowed =
      actor === "BRAND_OWNER" ||
      (actor === "FINANCE_ADMIN" &&
        target !== "BRAND_OWNER" &&
        next !== "BRAND_OWNER");
    if (allowed)
      expect(() => assertTeamAuthority(actor, target, next)).not.toThrow();
    else expect(() => assertTeamAuthority(actor, target, next)).toThrow();
  });
  it.each(["ADMIN", ...roles])("maps compatible role %s", (role) =>
    expect(canonicalInvitationRole(role)).toBe(
      role === "ADMIN" ? "BRAND_OWNER" : role,
    ),
  );
  it("fails closed on unknown legacy roles", () =>
    expect(() => canonicalInvitationRole("unexpected")).toThrow());
  it("hashes random raw tokens and rejects the digest as a bearer", () => {
    const raw = randomBytes(32).toString("hex");
    const hash = hashInvitationToken(raw);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hash).not.toContain(raw);
    expect(InvitationTokenSchema.safeParse(hash).success).toBe(false);
    expect(InvitationTokenSchema.safeParse(raw).success).toBe(true);
  });
  it.each(["", "short", "        ", "a".repeat(257)])(
    "rejects invalid bootstrap password %#",
    (password) => {
      expect(
        AcceptTeamInvitationSchema.safeParse({
          token: randomBytes(32).toString("hex"),
          password,
        }).success,
      ).toBe(false);
    },
  );
});
