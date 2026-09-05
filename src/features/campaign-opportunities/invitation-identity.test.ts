import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  invitationIdentityMatches,
  resolveInvitationIdentityPepper,
  type InvitationIdentityEvidence,
} from "./invitation-identity";

const fixturePepper = "c03-test-only-not-a-production-key-0123456789";
const subject = {
  profileId: "owner-profile",
  nativeInstagramId: "100200300",
  verifiedOwnerEmail: "owner@example.test",
};
const hmac = (kind: string, value: string) =>
  createHmac("sha256", fixturePepper)
    .update(`C03_INVITATION_IDENTITY_V1|${kind}|${value}`)
    .digest("hex");
const all: InvitationIdentityEvidence = {
  intendedCreatorProfileId: subject.profileId,
  intendedNativeInstagramIdHmac: hmac(
    "NATIVE_INSTAGRAM_ID",
    subject.nativeInstagramId,
  ),
  intendedVerifiedEmailHmac: hmac(
    "VERIFIED_OWNER_EMAIL",
    subject.verifiedOwnerEmail,
  ),
};

describe("C03 invitation identity security", () => {
  it.each([1, 2, 3, 4, 5, 6, 7])(
    "requires every populated field in evidence mask %i",
    (mask) => {
      const evidence = {
        intendedCreatorProfileId:
          mask & 1 ? all.intendedCreatorProfileId : null,
        intendedNativeInstagramIdHmac:
          mask & 2 ? all.intendedNativeInstagramIdHmac : null,
        intendedVerifiedEmailHmac:
          mask & 4 ? all.intendedVerifiedEmailHmac : null,
      };
      expect(invitationIdentityMatches(evidence, subject, fixturePepper)).toBe(
        true,
      );
      for (const key of Object.keys(evidence) as Array<keyof typeof evidence>) {
        if (evidence[key] !== null)
          expect(
            invitationIdentityMatches(
              { ...evidence, [key]: "0".repeat(64) },
              subject,
              fixturePepper,
            ),
          ).toBe(false);
      }
    },
  );
  it.each([
    { ...subject, profileId: "other" },
    { ...subject, nativeInstagramId: "other" },
    { ...subject, verifiedOwnerEmail: "team-member@example.test" },
    { ...subject, nativeInstagramId: "@mutable-handle" },
    { ...subject, verifiedOwnerEmail: null },
  ])("denies wrong canonical evidence %#", (wrong) =>
    expect(invitationIdentityMatches(all, wrong, fixturePepper)).toBe(false),
  );
  it.each([
    undefined,
    "",
    " ".repeat(64),
    "\t\n".repeat(32),
    "short",
    " short ".padEnd(64),
    "replace-me".repeat(10),
  ])("fails closed on invalid configuration %#", (pepper) => {
    expect(() => invitationIdentityMatches(all, subject, pepper)).toThrow();
  });
  it.each([
    "a",
    "A".repeat(64),
    "z".repeat(64),
    "0".repeat(63),
    "0".repeat(65),
  ])("rejects malformed stored HMAC %#", (digest) => {
    expect(
      invitationIdentityMatches(
        { ...all, intendedNativeInstagramIdHmac: digest },
        subject,
        fixturePepper,
      ),
    ).toBe(false);
  });
  it("uses canonical email normalization and separate identity domains", () => {
    expect(
      invitationIdentityMatches(
        all,
        { ...subject, verifiedOwnerEmail: " OWNER@EXAMPLE.TEST " },
        fixturePepper,
      ),
    ).toBe(true);
    expect(
      invitationIdentityMatches(
        {
          ...all,
          intendedNativeInstagramIdHmac: hmac(
            "VERIFIED_OWNER_EMAIL",
            subject.nativeInstagramId,
          ),
        },
        subject,
        fixturePepper,
      ),
    ).toBe(false);
  });
  it("does not require a pepper for profile-only evidence", () => {
    expect(
      invitationIdentityMatches(
        {
          intendedCreatorProfileId: subject.profileId,
          intendedNativeInstagramIdHmac: null,
          intendedVerifiedEmailHmac: null,
        },
        subject,
        undefined,
      ),
    ).toBe(true);
  });
  it("rejects absent evidence and never logs keys or computed identities", () => {
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    expect(
      invitationIdentityMatches(
        {
          intendedCreatorProfileId: null,
          intendedNativeInstagramIdHmac: null,
          intendedVerifiedEmailHmac: null,
        },
        subject,
        fixturePepper,
      ),
    ).toBe(false);
    expect(invitationIdentityMatches(all, subject, fixturePepper)).toBe(true);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    error.mockRestore();
    expect(resolveInvitationIdentityPepper(fixturePepper)).toBe(fixturePepper);
  });
});
