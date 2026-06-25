import { Injectable } from "@nestjs/common";
import type { UceCampaignTargeting } from "@prisma/client";

import type { CreatorAudienceDemographicsMatrix } from "../types/creator-audience.types";
import {
  creatorMatchesFollowerTiers,
  normalizeTierLabel,
  resolveCreatorTierFromFollowers,
} from "../utils/creator-tier.util";

export type CreatorEligibilityInput = {
  primaryRegion: string;
  followerCount: number;
  audienceDemographicsMatrix: CreatorAudienceDemographicsMatrix;
  instagramHandle: string | null;
};

export type EligibilityBreakdown = {
  is_eligible: boolean;
  tier_match: boolean;
  region_match: boolean;
  audience_geo_match: boolean;
};

@Injectable()
export class CreatorEligibilityService {
  /**
   * Server-side targeting check (mock metrics today; replace with Instagram Graph API).
   */
  evaluateTargeting(
    creator: CreatorEligibilityInput,
    targeting: Pick<
      UceCampaignTargeting,
      | "followerTiers"
      | "targetLocations"
      | "audienceAgeMin"
      | "audienceAgeMax"
      | "audienceGender"
      | "disqualifyingKeywords"
    >,
  ): EligibilityBreakdown {
    const tierMatch = creatorMatchesFollowerTiers(
      creator.followerCount,
      targeting.followerTiers,
    );

    const regionMatch = this.matchesRegion(
      creator.primaryRegion,
      targeting.targetLocations,
    );

    const audienceGeoMatch = this.matchesAudienceGeo(
      creator.audienceDemographicsMatrix,
      targeting.targetLocations,
      creator.primaryRegion,
    );

    return {
      is_eligible: tierMatch && regionMatch && audienceGeoMatch,
      tier_match: tierMatch,
      region_match: regionMatch,
      audience_geo_match: audienceGeoMatch,
    };
  }

  matchesCreatorTierFilter(
    followerCount: number,
    filterTiers: string[],
  ): boolean {
    if (filterTiers.length === 0) {
      return true;
    }
    const resolved = resolveCreatorTierFromFollowers(followerCount);
    const normalizedFilter = new Set(filterTiers.map(normalizeTierLabel));
    return normalizedFilter.has(resolved);
  }

  private matchesRegion(
    primaryRegion: string,
    targetLocations: string[],
  ): boolean {
    if (targetLocations.length === 0) {
      return true;
    }
    const creatorRegion = primaryRegion.trim().toUpperCase();
    const targets = targetLocations.map((l) => l.trim().toUpperCase());
    if (targets.includes("GLOBAL") || targets.includes("ALL")) {
      return true;
    }
    return targets.includes(creatorRegion);
  }

  /**
   * PRD threshold: target country density >= 60% when comparing audience matrix.
   */
  private matchesAudienceGeo(
    matrix: CreatorAudienceDemographicsMatrix,
    targetLocations: string[],
    primaryRegion: string,
  ): boolean {
    if (targetLocations.length === 0) {
      return true;
    }

    const targets = targetLocations
      .map((l) => l.trim().toUpperCase())
      .filter((l) => l !== "GLOBAL" && l !== "ALL");

    if (targets.length === 0) {
      return true;
    }

    const topCountries = matrix.top_countries ?? {};
    const entries = Object.entries(topCountries);
    if (entries.length === 0) {
      return targets.includes(primaryRegion.trim().toUpperCase());
    }

    for (const target of targets) {
      const density =
        topCountries[target] ?? topCountries[target.toLowerCase()] ?? 0;
      if (density >= 0.6) {
        return true;
      }
    }

    return false;
  }
}
