import type { UceCampaignTargeting } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { CreatorEligibilityService } from "./creator-eligibility.service";

const service = new CreatorEligibilityService();

const creator = (primaryRegion: string) => ({
  primaryRegion,
  followerCount: 50_000,
  audienceDemographicsMatrix: {
    top_countries: { [primaryRegion]: 0.75 },
  },
  instagramHandle: "acceptance_creator",
});

const targeting = (audienceGeographies: unknown, targetLocations: string[]) =>
  ({
    followerTiers: ["MIN:20000", "MAX:100000"],
    minimumFollowers: 20_000,
    maximumFollowers: 100_000,
    targetLocations,
    audienceGeographies,
    audienceAgeMin: 18,
    audienceAgeMax: 34,
    audienceGender: "ALL",
    disqualifyingKeywords: [],
  }) as Pick<
    UceCampaignTargeting,
    | "followerTiers"
    | "minimumFollowers"
    | "maximumFollowers"
    | "targetLocations"
    | "audienceGeographies"
    | "audienceAgeMin"
    | "audienceAgeMax"
    | "audienceGender"
    | "disqualifyingKeywords"
  >;

describe("CreatorEligibilityService canonical geography bridge", () => {
  it("matches canonical structured geography to creator country authority", () => {
    const result = service.evaluateTargeting(
      creator("IN"),
      targeting(
        [
          {
            scope: "LOCALITY",
            label: "Mumbai",
            country_code: "IN",
            locality: "Mumbai",
            region: "Maharashtra",
            radius_km: 25,
            is_primary: true,
          },
        ],
        ['{"scope":"LOCALITY","country_code":"IN"}'],
      ),
    );

    expect(result).toMatchObject({
      is_eligible: true,
      region_match: true,
      audience_geo_match: true,
    });
  });

  it("rejects a creator outside canonical geography even if legacy projection matches", () => {
    const result = service.evaluateTargeting(
      creator("US"),
      targeting(
        [
          {
            scope: "COUNTRY",
            label: "India",
            country_code: "IN",
            locality: null,
            region: null,
            radius_km: null,
            is_primary: true,
          },
        ],
        ["US"],
      ),
    );

    expect(result).toMatchObject({
      is_eligible: false,
      region_match: false,
      audience_geo_match: false,
    });
  });

  it("retains plain legacy geography compatibility when canonical data is absent", () => {
    const result = service.evaluateTargeting(
      creator("IN"),
      targeting([], ["IN"]),
    );

    expect(result.is_eligible).toBe(true);
  });

  it("enforces canonical follower bounds before deprecated tier labels", () => {
    const input = targeting([], ["IN"]);
    input.followerTiers = ["MEGA"];
    input.maximumFollowers = 40_000;

    const result = service.evaluateTargeting(creator("IN"), input);

    expect(result).toMatchObject({ is_eligible: false, tier_match: false });
  });
});
