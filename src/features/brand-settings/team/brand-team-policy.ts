import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { BrandRole, Prisma, UserRole } from "@prisma/client";
import type { AuthUser } from "../../auth/types/auth-user";
import { lockCanonicalIdentityEmail } from "../../../shared/identity/sterile-provisional-creator.policy";
import {
  emailDomainMatchesBrandDomain,
  isSafeBrandDomainAuthority,
} from "../../brand-onboarding/verification/brand-verification-email.util";

export function canonicalInvitationRole(role: string): BrandRole {
  if (role === "ADMIN" || role === "BRAND_OWNER") return BrandRole.BRAND_OWNER;
  if (role === "FINANCE_ADMIN") return BrandRole.FINANCE_ADMIN;
  if (role === "CAMPAIGN_MANAGER") return BrandRole.CAMPAIGN_MANAGER;
  throw new BadRequestException("Unsupported invitation role");
}

export function assertTeamAuthority(
  actor: BrandRole,
  target?: BrandRole,
  next?: BrandRole,
) {
  if (actor === BrandRole.BRAND_OWNER) return;
  if (
    actor === BrandRole.FINANCE_ADMIN &&
    target !== BrandRole.BRAND_OWNER &&
    next !== BrandRole.BRAND_OWNER
  )
    return;
  throw new ForbiddenException(
    "Only a Brand Owner can manage Owner authority; Campaign Managers cannot administer the team.",
  );
}

// All BS-02 membership, invitation and bootstrap writes serialize on this row.
// READ COMMITTED queries after the lock see the latest actor/owner/invite state.
export async function lockBrandTeam(
  tx: Prisma.TransactionClient,
  brandProfileId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM brand_profiles WHERE id = ${brandProfileId} FOR UPDATE`;
  if (!rows.length) throw new NotFoundException("Brand workspace not found");
}

export async function lockAdmissionEmail(
  tx: Prisma.TransactionClient,
  email: string,
) {
  // Also serialize Brand and Creator admission for the same identity.
  await lockCanonicalIdentityEmail(tx, email.toLowerCase());
}

export async function requireActiveTeamMember(
  tx: Prisma.TransactionClient,
  brandProfileId: string,
  actor: AuthUser,
) {
  const member = await tx.brandTeamMember.findFirst({
    where: {
      brandProfileId,
      userId: actor.id,
      isActive: true,
      user: {
        role: UserRole.BRAND,
        organization: { brandProfile: { id: brandProfileId } },
      },
    },
  });
  if (!member)
    throw new ForbiddenException("Active Brand team membership required");
  return member;
}

export async function requireTeamActor(
  tx: Prisma.TransactionClient,
  brandProfileId: string,
  actor: AuthUser,
) {
  const member = await requireActiveTeamMember(tx, brandProfileId, actor);
  assertTeamAuthority(member.role);
  return member;
}

export function isRecognizedAnchorEmail(email: string, brandDomain: string) {
  return (
    isSafeBrandDomainAuthority(brandDomain) &&
    emailDomainMatchesBrandDomain(email, brandDomain)
  );
}

export async function recognizedAnchorOwnerCount(
  tx: Prisma.TransactionClient,
  brandProfileId: string,
  excludingMembershipId?: string,
) {
  const profile = await tx.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: { domain: true },
  });
  if (!profile || !isSafeBrandDomainAuthority(profile.domain)) return null;
  const owners = await tx.brandTeamMember.findMany({
    where: {
      brandProfileId,
      role: BrandRole.BRAND_OWNER,
      isActive: true,
      ...(excludingMembershipId ? { id: { not: excludingMembershipId } } : {}),
    },
    select: { user: { select: { email: true, role: true } } },
  });
  return owners.filter(
    ({ user }) =>
      user.role === UserRole.BRAND &&
      isRecognizedAnchorEmail(user.email, profile.domain),
  ).length;
}

/** Caller holds the Team lock and passes an active Owner being reduced. */
export async function protectOrganizationalAnchor(
  tx: Prisma.TransactionClient,
  brandProfileId: string,
  targetMembershipId: string,
) {
  const remaining = await recognizedAnchorOwnerCount(
    tx,
    brandProfileId,
    targetMembershipId,
  );
  if (remaining === null) {
    throw new ConflictException({
      code: "TEAM_ANCHOR_AUTHORITY_UNRESOLVED",
      message:
        "Brand-domain authority cannot be resolved. Contact support before reducing Owner authority.",
    });
  }
  if (remaining < 1) {
    throw new ConflictException({
      code: "TEAM_ANCHOR_OWNER_REQUIRED",
      message:
        "At least one active Brand-domain Owner must remain. Promote a qualifying successor first.",
    });
  }
}
