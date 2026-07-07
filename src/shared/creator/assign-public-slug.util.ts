import type { PrismaClient } from "@prisma/client";

import { instagramHandleToPublicSlug } from "./creator-slug.util";

/** Assign a unique public slug from an Instagram handle. */
export async function assignUniquePublicSlug(
  prisma: Pick<PrismaClient, "creatorProfile">,
  handle: string,
  excludeProfileId?: string,
): Promise<string> {
  const base = instagramHandleToPublicSlug(handle);
  if (!base) {
    throw new Error("Cannot derive public slug from handle");
  }

  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await prisma.creatorProfile.findFirst({
      where: {
        publicSlug: candidate,
        ...(excludeProfileId ? { NOT: { id: excludeProfileId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
