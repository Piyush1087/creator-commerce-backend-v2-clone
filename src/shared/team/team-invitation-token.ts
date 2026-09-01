import { createHash, randomBytes } from "node:crypto";

const STORED_TOKEN_PREFIX = "sha256:";

export function generateTeamInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashTeamInvitationToken(rawToken: string): string {
  return `${STORED_TOKEN_PREFIX}${createHash("sha256")
    .update(rawToken)
    .digest("hex")}`;
}

/**
 * Creator invitations pre-date the digest prefix. Both candidates are hashes;
 * the raw bearer token is never queried or persisted.
 */
export function teamInvitationDigestCandidates(rawToken: string): string[] {
  const digest = createHash("sha256").update(rawToken).digest("hex");
  return [`${STORED_TOKEN_PREFIX}${digest}`, digest];
}
