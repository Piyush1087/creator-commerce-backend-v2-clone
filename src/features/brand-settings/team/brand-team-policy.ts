import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { BrandRole, Prisma, UserRole } from "@prisma/client";
import type { AuthUser } from "../../auth/types/auth-user";

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
  // Also serialize the same recipient accepting invitations to different Brands.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email.toLowerCase()}, 2))::text`;
}

export async function requireTeamActor(
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
  assertTeamAuthority(member.role);
  return member;
}

export async function protectLastOwner(
  tx: Prisma.TransactionClient,
  brandProfileId: string,
  targetRole: BrandRole,
) {
  if (targetRole !== BrandRole.BRAND_OWNER) return;
  const owners = await tx.brandTeamMember.count({
    where: { brandProfileId, role: BrandRole.BRAND_OWNER, isActive: true },
  });
  if (owners <= 1)
    throw new BadRequestException(
      "At least one Brand Owner must remain on the workspace.",
    );
}
