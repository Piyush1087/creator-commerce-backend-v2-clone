import { Injectable } from "@nestjs/common";
import type { UceCampaignTargeting } from "@prisma/client";

import { isCreatorApplyBypassEmail } from "../../../shared/config/creator-apply-bypass";
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
  /** True when CREATOR_APPLY_BYPASS_EMAILS matched (QA only). */
  apply_bypass?: boolean;
};

type EligibilityTargeting = Pick<
  UceCampaignTargeting,
  | "followerTiers"
  | "targetLocations"
  | "audienceAgeMin"
  | "audienceAgeMax"
  | "audienceGender"
  | "disqualifyingKeywords"
> & {
  audienceGeographies?: unknown;
  minimumFollowers?: number;
  maximumFollowers?: number | null;
};

type NormalizedGeography = {
  hasTargeting: boolean;
  unrestricted: boolean;
  countryCodes: string[];
};

const BYPASS_ELIGIBLE: EligibilityBreakdown = {
  is_eligible: true,
  tier_match: true,
  region_match: true,
  audience_geo_match: true,
  apply_bypass: true,
};

@Injectable()
export class CreatorEligibilityService {
  /**
   * Server-side targeting check (mock metrics today; replace with Instagram Graph API).
   * When `creatorEmail` is on CREATOR_APPLY_BYPASS_EMAILS, returns eligible without
   * evaluating tiers/geo (QA seed creators such as test@creator.com).
   */
  evaluateTargeting(
    creator: CreatorEligibilityInput,
    targeting: EligibilityTargeting,
    options?: { creatorEmail?: string | null },
  ): EligibilityBreakdown {
    if (isCreatorApplyBypassEmail(options?.creatorEmail)) {
      return { ...BYPASS_ELIGIBLE };
    }

    const tierMatch = this.matchesFollowerTargeting(
      creator.followerCount,
      targeting,
    );

    const geography = this.normalizeGeography(targeting);
    const regionMatch = this.matchesRegion(creator.primaryRegion, geography);

    const audienceGeoMatch = this.matchesAudienceGeo(
      creator.audienceDemographicsMatrix,
      geography,
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
    options?: { creatorEmail?: string | null },
  ): boolean {
    if (isCreatorApplyBypassEmail(options?.creatorEmail)) {
      return true;
    }
    if (filterTiers.length === 0) {
      return true;
    }
    const resolved = resolveCreatorTierFromFollowers(followerCount);
    const normalizedFilter = new Set(filterTiers.map(normalizeTierLabel));
    return normalizedFilter.has(resolved);
  }

  private matchesFollowerTargeting(
    followerCount: number,
    targeting: EligibilityTargeting,
  ): boolean {
    if (typeof targeting.minimumFollowers === "number") {
      return (
        followerCount >= targeting.minimumFollowers &&
        (targeting.maximumFollowers == null ||
          followerCount <= targeting.maximumFollowers)
      );
    }

    return creatorMatchesFollowerTiers(followerCount, targeting.followerTiers);
  }

  private matchesRegion(
    primaryRegion: string,
    geography: NormalizedGeography,
  ): boolean {
    if (!geography.hasTargeting || geography.unrestricted) {
      return true;
    }
    const creatorRegion = primaryRegion.trim().toUpperCase();
    return geography.countryCodes.includes(creatorRegion);
  }

  /**
   * PRD threshold: target country density >= 60% when comparing audience matrix.
   */
  private matchesAudienceGeo(
    matrix: CreatorAudienceDemographicsMatrix,
    geography: NormalizedGeography,
    primaryRegion: string,
  ): boolean {
    if (!geography.hasTargeting || geography.unrestricted) {
      return true;
    }

    const targets = geography.countryCodes;

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

  /**
   * Canonical audienceGeographies is authoritative when present. Creator
   * geography authority is currently country-level, so COUNTRY, REGION and
   * LOCALITY selections deterministically bridge through country_code.
   * Legacy targetLocations remains a fallback for pre-canonical campaigns.
   */
  private normalizeGeography(
    targeting: EligibilityTargeting,
  ): NormalizedGeography {
    const canonical = Array.isArray(targeting.audienceGeographies)
      ? targeting.audienceGeographies
      : [];
    const source = canonical.length > 0 ? canonical : targeting.targetLocations;

    if (source.length === 0) {
      return { hasTargeting: false, unrestricted: false, countryCodes: [] };
    }

    let unrestricted = false;
    const countryCodes = new Set<string>();

    for (const entry of source) {
      const normalized = this.normalizeGeographyEntry(entry);
      if (normalized === "GLOBAL") {
        unrestricted = true;
      } else if (normalized) {
        countryCodes.add(normalized);
      }
    }

    return {
      hasTargeting: true,
      unrestricted,
      countryCodes: [...countryCodes],
    };
  }

  private normalizeGeographyEntry(entry: unknown): string | null {
    if (typeof entry === "string") {
      const value = entry.trim();
      if (!value) {
        return null;
      }
      try {
        return this.normalizeGeographyEntry(JSON.parse(value));
      } catch {
        const normalized = value.toUpperCase();
        return normalized === "ALL" ? "GLOBAL" : normalized;
      }
    }

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return null;
    }

    const geography = entry as Record<string, unknown>;
    const scope =
      typeof geography.scope === "string"
        ? geography.scope.trim().toUpperCase()
        : "";
    if (scope === "GLOBAL") {
      return "GLOBAL";
    }

    return typeof geography.country_code === "string"
      ? geography.country_code.trim().toUpperCase()
      : null;
  }
}
