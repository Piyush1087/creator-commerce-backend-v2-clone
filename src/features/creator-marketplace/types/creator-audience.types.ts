/** Shape stored on CreatorProfile.audienceDemographicsMatrix (mock until Instagram Graph API). */
export type CreatorAudienceDemographicsMatrix = {
  age_distribution?: Record<string, number>;
  top_countries?: Record<string, number>;
  gender_skew?: Record<string, number>;
};

export type CreatorAccessTier = "SOCIAL_PENDING" | "FULL";
