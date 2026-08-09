import { Injectable } from "@nestjs/common";
import type { UceCampaignTargeting } from "@prisma/client";

import type { CreatorAudienceDemographicsMatrix } from "../types/creator-audience.types";
import { CreatorEligibilityService } from "./creator-eligibility.service";

const WEIGHT_GEO = 0.4;
const WEIGHT_DEMO = 0.4;
const WEIGHT_NICHE = 0.2;

@Injectable()
export class CreatorAffinityService {
  constructor(private readonly eligibility: CreatorEligibilityService) {}

  /**
   * S_match = (ω1·A_geo) + (ω2·A_demo) + (ω3·A_niche), bounded 0–100.
   * Uses mock creator metrics until Instagram Graph API is wired.
   */
  computeMatchScorePercent(
    creator: {
      primaryRegion: string;
      followerCount: number;
      audienceDemographicsMatrix: CreatorAudienceDemographicsMatrix;
      instagramHandle: string | null;
    },
    targeting: Pick<
      UceCampaignTargeting,
      | "followerTiers"
      | "targetLocations"
      | "audienceAgeMin"
      | "audienceAgeMax"
      | "audienceGender"
      | "industryVertical"
      | "creatorArchetypes"
      | "disqualifyingKeywords"
    >,
  ): number {
    const breakdown = this.eligibility.evaluateTargeting(creator, targeting);

    const aGeo = breakdown.region_match && breakdown.audience_geo_match ? 1 : 0;
    const aDemo = this.audienceDemographicOverlap(
      creator.audienceDemographicsMatrix,
      targeting.audienceAgeMin,
      targeting.audienceAgeMax,
    );
    const aNiche = this.nicheAlignment(
      targeting.industryVertical,
      targeting.creatorArchetypes,
    );

    const raw =
      WEIGHT_GEO * aGeo + WEIGHT_DEMO * aDemo + WEIGHT_NICHE * aNiche;
    return Math.round(Math.min(1, Math.max(0, raw)) * 100);
  }

  private audienceDemographicOverlap(
    matrix: CreatorAudienceDemographicsMatrix,
    ageMin: number,
    ageMax: number,
  ): number {
    const distribution = matrix.age_distribution ?? {};
    const keys = Object.keys(distribution);
    if (keys.length === 0) {
      return 0.5;
    }

    let overlap = 0;
    for (const [band, share] of Object.entries(distribution)) {
      const nums = band.match(/\d+/g);
      if (!nums || nums.length === 0) {
        continue;
      }
      const bandMin = Number(nums[0]);
      const bandMax = nums.length > 1 ? Number(nums[1]) : bandMin;
      const intersects = bandMax >= ageMin && bandMin <= ageMax;
      if (intersects) {
        overlap += share;
      }
    }

    return Math.min(1, overlap);
  }

  private nicheAlignment(
    industryVertical: string,
    archetypes: string[],
  ): number {
    if (archetypes.length === 0) {
      return industryVertical.trim() ? 0.7 : 0.5;
    }
    return 1;
  }
}
