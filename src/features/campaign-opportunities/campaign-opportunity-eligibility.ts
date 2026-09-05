import { Injectable } from "@nestjs/common";
import type {
  CreatorProfile,
  Prisma,
  UceCampaignTargeting,
} from "@prisma/client";

import { creatorMatchesFollowerTiers } from "../creator-marketplace/utils/creator-tier.util";

export type OpportunityEligibility = {
  result: "ELIGIBLE" | "INELIGIBLE" | "UNAVAILABLE";
  targetingVersion: number | null;
  creatorFactsVersion: string | null;
};

export abstract class CampaignOpportunityEligibilityPort {
  abstract evaluate(
    tx: Prisma.TransactionClient,
    campaignId: string,
    profileId: string,
  ): Promise<OpportunityEligibility>;
}

/** Unsupported or absent canonical evidence never becomes an inferred positive. */
export function evaluateCanonicalEligibility(
  target: UceCampaignTargeting | null,
  facts: CreatorProfile | null,
): OpportunityEligibility {
  const version = {
    targetingVersion: target?.targetingVersion ?? null,
    creatorFactsVersion: facts?.updatedAt.toISOString() ?? null,
  };
  if (!target || !facts) return { result: "UNAVAILABLE", ...version };
  // CreatorProfile has no authoritative archetype, keyword or age/gender evidence.
  // These constraints require evidence; legacy mock metrics cannot authorize them.
  if (
    target.creatorArchetypes.length ||
    target.disqualifyingKeywords.length ||
    target.audienceAgeMin !== 18 ||
    target.audienceAgeMax !== 65 ||
    target.audienceGender !== "ALL"
  ) {
    return { result: "UNAVAILABLE", ...version };
  }
  if (!creatorMatchesFollowerTiers(facts.followerCount, target.followerTiers)) {
    return { result: "INELIGIBLE", ...version };
  }
  const locations = target.targetLocations.map((value) =>
    value.trim().toUpperCase(),
  );
  if (
    locations.length &&
    !locations.includes("GLOBAL") &&
    !locations.includes("ALL")
  ) {
    if (!locations.includes(facts.primaryRegion.trim().toUpperCase()))
      return { result: "INELIGIBLE", ...version };
    const matrix = facts.audienceDemographicsMatrix;
    if (!matrix || typeof matrix !== "object" || Array.isArray(matrix))
      return { result: "UNAVAILABLE", ...version };
    const countries = matrix.top_countries;
    if (!countries || typeof countries !== "object" || Array.isArray(countries))
      return { result: "UNAVAILABLE", ...version };
    const entries = Object.entries(countries);
    if (
      !entries.length ||
      entries.some(
        ([, value]) =>
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 1,
      )
    )
      return { result: "UNAVAILABLE", ...version };
    if (
      !entries.some(
        ([country, value]) =>
          locations.includes(country.toUpperCase()) &&
          typeof value === "number" &&
          value >= 0.6,
      )
    )
      return { result: "INELIGIBLE", ...version };
  }
  return { result: "ELIGIBLE", ...version };
}

@Injectable()
export class CanonicalCampaignOpportunityEligibility extends CampaignOpportunityEligibilityPort {
  async evaluate(
    tx: Prisma.TransactionClient,
    campaignId: string,
    profileId: string,
  ) {
    const target = await tx.uceCampaignTargeting.findUnique({
      where: { campaignId },
    });
    const facts = await tx.creatorProfile.findUnique({
      where: { id: profileId },
    });
    return evaluateCanonicalEligibility(target, facts);
  }
}
