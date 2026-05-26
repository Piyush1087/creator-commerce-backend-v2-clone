import { IndustryVertical } from "@prisma/client";

import type { IndustryClassification } from "./industry.types";
import type { IndustryGateGeminiPayload } from "./industry-gate-gemini.schema";

function normalizeDetail(detail: string | null | undefined): string {
  return (detail ?? "").toLowerCase();
}

/**
 * Maps Gemini industry-gate output to supported Prisma enum + triage bucket.
 * Mirrors product doc: supported verticals vs "Other" (waitlist) vs hard-blocked risk.
 */
export function mapIndustryGateToClassification(
  gate: IndustryGateGeminiPayload,
): IndustryClassification {
  switch (gate.highLevelIndustry) {
    case "D2C":
      return { industry: IndustryVertical.D2C, bucket: "supported" };
    case "SAAS_AI":
      return { industry: IndustryVertical.SAAS_AI, bucket: "supported" };
    case "HEALTHCARE":
      return { industry: IndustryVertical.HEALTHCARE, bucket: "supported" };
    case "OFFLINE_SERVICES":
      return {
        industry: IndustryVertical.OFFLINE_SERVICES,
        bucket: "supported",
      };
    default:
      break;
  }

  const detail = normalizeDetail(gate.otherIndustryDetail);

  if (
    /gambl|casino|betting|poker|sportsbook|lottery/.test(detail) ||
    detail.includes("gambling")
  ) {
    return { industry: IndustryVertical.GAMBLING, bucket: "blocked" };
  }
  if (/porn|adult|xxx|escort/.test(detail)) {
    return { industry: IndustryVertical.ADULT, bucket: "blocked" };
  }
  if (/fraud|scam|counterfeit/.test(detail)) {
    return {
      industry: IndustryVertical.FRAUDULENT_HIGH_RISK,
      bucket: "blocked",
    };
  }

  if (
    /real\s*estate|realtor|property\s*listing|mortgage\s*broker/.test(detail)
  ) {
    return { industry: IndustryVertical.REAL_ESTATE, bucket: "regret" };
  }
  if (/edtech|education|school|university|academy/.test(detail)) {
    return { industry: IndustryVertical.EDUCATION, bucket: "regret" };
  }
  if (/media|publisher|broadcast|news\s*network/.test(detail)) {
    return { industry: IndustryVertical.MEDIA, bucket: "regret" };
  }
  if (/agency|consulting|b2b\s*services/.test(detail)) {
    return { industry: IndustryVertical.B2B_AGENCY, bucket: "regret" };
  }
  if (/entertainment|streaming|film|music\s*label/.test(detail)) {
    return { industry: IndustryVertical.ENTERTAINMENT, bucket: "regret" };
  }

  return { industry: IndustryVertical.UNKNOWN, bucket: "regret" };
}
