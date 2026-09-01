import {
  AuthMethodType,
  Prisma,
  UserAuthState,
  UserRole,
} from "@prisma/client";

type IdentityPolicyClient = Pick<
  Prisma.TransactionClient,
  "user" | "$queryRaw"
>;

export type SterileProvisionalCreatorInspection = {
  userId: string;
  sterile: boolean;
  reason:
    | "STERILE"
    | "USER_NOT_FOUND"
    | "STATE_OR_ROLE"
    | "CANONICAL_IDENTITY"
    | "LEGACY_OR_CUSTOMER_CONTEXT"
    | "LIVE_SESSION"
    | "AUTH_METHOD_CONTRADICTION";
};

export async function lockCanonicalIdentityEmail(
  tx: IdentityPolicyClient,
  normalizedEmail: string,
): Promise<void> {
  // Salt 2 is shared with Brand admission so Brand and Creator activation
  // serialize on the same normalized identity.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${normalizedEmail}, 2))::text`;
}

export async function inspectSterileProvisionalCreator(
  client: IdentityPolicyClient,
  userId: string,
  now = new Date(),
): Promise<SterileProvisionalCreatorInspection> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      authState: true,
      organizationId: true,
      emailVerifiedAt: true,
      googleSubjectId: true,
      creatorProfile: { select: { id: true } },
      creatorOnboardingTrack: { select: { id: true } },
      userProfile: { select: { id: true } },
      brandTeamMemberships: {
        where: { isActive: true },
        select: { id: true },
        take: 1,
      },
      authSessions: {
        where: { revokedAt: null, absoluteExpiresAt: { gt: now } },
        select: { id: true },
        take: 1,
      },
      authMethods: {
        where: { disabledAt: null },
        select: {
          type: true,
          credentialHash: true,
          providerSubjectId: true,
        },
      },
      initiatedProviderOAuthTransactions: {
        where: { consumedAt: null, expiresAt: { gt: now } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!user) {
    return { userId, sterile: false, reason: "USER_NOT_FOUND" };
  }
  if (
    user.authState !== UserAuthState.PROVISIONAL ||
    user.role !== UserRole.CREATOR
  ) {
    return { userId, sterile: false, reason: "STATE_OR_ROLE" };
  }
  if (
    user.organizationId ||
    user.emailVerifiedAt ||
    user.googleSubjectId ||
    user.creatorProfile
  ) {
    return { userId, sterile: false, reason: "CANONICAL_IDENTITY" };
  }
  if (
    user.creatorOnboardingTrack ||
    user.userProfile ||
    user.brandTeamMemberships.length ||
    user.initiatedProviderOAuthTransactions.length
  ) {
    return {
      userId,
      sterile: false,
      reason: "LEGACY_OR_CUSTOMER_CONTEXT",
    };
  }
  if (user.authSessions.length) {
    return { userId, sterile: false, reason: "LIVE_SESSION" };
  }
  if (
    user.authMethods.some(
      (method) =>
        method.type !== AuthMethodType.PASSWORD ||
        !method.credentialHash ||
        method.providerSubjectId,
    )
  ) {
    return {
      userId,
      sterile: false,
      reason: "AUTH_METHOD_CONTRADICTION",
    };
  }
  return { userId, sterile: true, reason: "STERILE" };
}
