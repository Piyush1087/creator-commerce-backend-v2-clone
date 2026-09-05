import { ServiceUnavailableException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

import { normalizeEmail } from "../../shared/identity/normalize-email";

export const INVITATION_IDENTITY_ENV = "C03_INVITATION_IDENTITY_HMAC_PEPPER";

export function resolveInvitationIdentityPepper(
  value: string | undefined,
): string {
  if (
    !value ||
    Buffer.byteLength(value.trim(), "utf8") < 32 ||
    /placeholder|replace[-_ ]?me|changeme|not-for-deploy/i.test(value)
  ) {
    throw new ServiceUnavailableException({
      code: "INVITATION_IDENTITY_CONFIGURATION_UNAVAILABLE",
      recoveryAction: "RETRY_LATER",
    });
  }
  return value;
}

export type InvitationIdentityEvidence = {
  intendedCreatorProfileId: string | null;
  intendedNativeInstagramIdHmac: string | null;
  intendedVerifiedEmailHmac: string | null;
};

/** Inputs are loaded from canonical Owner-subject authority, never HTTP identity claims. */
export type CanonicalInvitationSubject = {
  profileId: string;
  nativeInstagramId: string | null;
  verifiedOwnerEmail: string | null;
};

export function invitationIdentityMatches(
  evidence: InvitationIdentityEvidence,
  subject: CanonicalInvitationSubject,
  configuredPepper: string | undefined,
): boolean {
  const fields = [
    evidence.intendedCreatorProfileId,
    evidence.intendedNativeInstagramIdHmac,
    evidence.intendedVerifiedEmailHmac,
  ];
  if (fields.every((field) => field === null)) return false;
  const requiresHmac =
    evidence.intendedNativeInstagramIdHmac !== null ||
    evidence.intendedVerifiedEmailHmac !== null;
  const pepper = requiresHmac
    ? resolveInvitationIdentityPepper(configuredPepper)
    : "";
  const matches = (digest: string, domain: string, identity: string | null) => {
    if (!/^[0-9a-f]{64}$/.test(digest) || !identity) return false;
    const candidate = createHmac("sha256", pepper)
      .update(`C03_INVITATION_IDENTITY_V1|${domain}|${identity}`)
      .digest();
    return timingSafeEqual(Buffer.from(digest, "hex"), candidate);
  };
  return (
    (evidence.intendedCreatorProfileId === null ||
      evidence.intendedCreatorProfileId === subject.profileId) &&
    (evidence.intendedNativeInstagramIdHmac === null ||
      matches(
        evidence.intendedNativeInstagramIdHmac,
        "NATIVE_INSTAGRAM_ID",
        subject.nativeInstagramId,
      )) &&
    (evidence.intendedVerifiedEmailHmac === null ||
      matches(
        evidence.intendedVerifiedEmailHmac,
        "VERIFIED_OWNER_EMAIL",
        subject.verifiedOwnerEmail
          ? normalizeEmail(subject.verifiedOwnerEmail)
          : null,
      ))
  );
}
