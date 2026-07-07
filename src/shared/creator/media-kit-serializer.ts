import { DesignTheme } from "@prisma/client";

export type MediaKitProfileRow = {
  displayName: string | null;
  customBioOverride: string | null;
  aiGeneratedTagline: string | null;
  activeTheme: DesignTheme;
  showTotalReach: boolean;
  showEngagementRate: boolean;
  showViewsMetric: boolean;
  showRatesColumn: boolean;
  shortFormVideoRate: unknown;
  storyBundleRate: unknown;
  pastBrandLogos: string[];
  totalReachCache: number;
  engagementRateCache: unknown;
  topLocationCache: string | null;
};

export type PublicMediaKitContext = {
  instagramHandle: string | null;
  avatarUrl: string | null;
  displayName: string | null;
};

export function serializeMediaKit(
  profile: MediaKitProfileRow,
  context?: PublicMediaKitContext,
) {
  return {
    displayName: profile.displayName ?? context?.displayName ?? null,
    instagramHandle: context?.instagramHandle ?? null,
    avatarUrl: context?.avatarUrl ?? null,
    customBioOverride: profile.customBioOverride,
    aiGeneratedTagline: profile.aiGeneratedTagline,
    activeTheme: profile.activeTheme,
    visibility: {
      showTotalReach: profile.showTotalReach,
      showEngagementRate: profile.showEngagementRate,
      showViewsMetric: profile.showViewsMetric,
      showRatesColumn: profile.showRatesColumn,
    },
    rates: profile.showRatesColumn
      ? {
          shortFormVideoRate: Number(profile.shortFormVideoRate),
          storyBundleRate: Number(profile.storyBundleRate),
        }
      : null,
    pastBrandLogos: profile.pastBrandLogos,
    cachedMetrics: {
      totalReach: profile.showTotalReach ? profile.totalReachCache : null,
      engagementRate: profile.showEngagementRate
        ? Number(profile.engagementRateCache)
        : null,
      topLocation: profile.topLocationCache,
    },
  };
}
