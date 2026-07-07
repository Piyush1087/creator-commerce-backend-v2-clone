export type HandleEligibilityResult = {
  is_approved: boolean;
  eligibility_score: number;
  percentile_rank: number;
  detected_vertical:
    | "D2C"
    | "SAAS_AI"
    | "HEALTHCARE"
    | "MEDIA"
    | "ENTERTAINMENT"
    | "UNKNOWN";
};
