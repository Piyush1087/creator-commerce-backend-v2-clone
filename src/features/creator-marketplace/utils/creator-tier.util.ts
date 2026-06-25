const TIER_ORDER = ["NANO", "MICRO", "MID", "MACRO", "MEGA"] as const;

export type CreatorFollowerTier = (typeof TIER_ORDER)[number];

/** Static tier bands until live Instagram follower counts are synced. */
const TIER_MIN_FOLLOWERS: Record<CreatorFollowerTier, number> = {
  NANO: 1_000,
  MICRO: 10_000,
  MID: 100_000,
  MACRO: 500_000,
  MEGA: 1_000_000,
};

export function resolveCreatorTierFromFollowers(
  followerCount: number,
): CreatorFollowerTier {
  if (followerCount >= TIER_MIN_FOLLOWERS.MEGA) return "MEGA";
  if (followerCount >= TIER_MIN_FOLLOWERS.MACRO) return "MACRO";
  if (followerCount >= TIER_MIN_FOLLOWERS.MID) return "MID";
  if (followerCount >= TIER_MIN_FOLLOWERS.MICRO) return "MICRO";
  return "NANO";
}

export function normalizeTierLabel(value: string): string {
  return value.trim().toUpperCase();
}

export function creatorMatchesFollowerTiers(
  followerCount: number,
  campaignTiers: string[],
): boolean {
  if (campaignTiers.length === 0) {
    return true;
  }
  const creatorTier = resolveCreatorTierFromFollowers(followerCount);
  const normalized = new Set(campaignTiers.map(normalizeTierLabel));
  return normalized.has(creatorTier);
}
