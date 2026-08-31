import { BrandRole, Prisma, UserRole } from "@prisma/client";
import { lockBrandTeam } from "./brand-team-policy";

/** Explicit activation/backfill only. Never call from Settings authorization. */
export async function establishInitialBrandOwner(
  tx: Prisma.TransactionClient,
  brandProfileId: string,
  userId: string,
  apply = true,
) {
  await lockBrandTeam(tx, brandProfileId);
  const profile = await tx.brandProfile.findUnique({
    where: { id: brandProfileId },
  });
  if (
    !profile?.isVerified ||
    !profile.organizationId ||
    !profile.verificationEmail
  )
    return "UNVERIFIED_OR_UNASSOCIATED" as const;
  const candidates = await tx.user.findMany({
    where: {
      email: { equals: profile.verificationEmail.trim(), mode: "insensitive" },
    },
  });
  const user = candidates.length === 1 ? candidates[0] : null;
  if (
    !user ||
    user.id !== userId ||
    user.role !== UserRole.BRAND ||
    user.organizationId !== profile.organizationId
  )
    return "AMBIGUOUS_IDENTITY" as const;
  // Prior inactive rows may represent deliberate revocation. Only a new invite
  // may reactivate them; repair must never restore their authority.
  if (await tx.brandTeamMember.count({ where: { brandProfileId } }))
    return "EXISTING_TEAM" as const;
  if (apply)
    await tx.brandTeamMember.create({
      data: {
        brandProfileId,
        userId,
        role: BrandRole.BRAND_OWNER,
        isActive: true,
      },
    });
  return apply ? ("CREATED" as const) : ("ELIGIBLE" as const);
}
