import { IndustryVertical } from "@prisma/client";

import type { IndustryBucket, IndustryClassification } from "./industry.types";
import type { GatekeeperGeminiPayload } from "./gatekeeper.schema";

const SUPPORTED = new Set<IndustryVertical>([
  IndustryVertical.D2C,
  IndustryVertical.SAAS_AI,
  IndustryVertical.HEALTHCARE,
  IndustryVertical.OFFLINE_SERVICES,
]);

const BLOCKED = new Set<IndustryVertical>([
  IndustryVertical.GAMBLING,
  IndustryVertical.ADULT,
  IndustryVertical.FRAUDULENT_HIGH_RISK,
]);

function normalizeIndustryToken(raw: string): IndustryVertical {
  const key = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const aliases: Record<string, IndustryVertical> = {
    D2C: IndustryVertical.D2C,
    D2C_ECOMMERCE: IndustryVertical.D2C,
    ECOMMERCE: IndustryVertical.D2C,
    SAAS_AI: IndustryVertical.SAAS_AI,
    AI_SAAS: IndustryVertical.SAAS_AI,
    SAAS: IndustryVertical.SAAS_AI,
    HEALTHCARE: IndustryVertical.HEALTHCARE,
    OFFLINE_SERVICES: IndustryVertical.OFFLINE_SERVICES,
    REAL_ESTATE: IndustryVertical.REAL_ESTATE,
    B2B_AGENCY: IndustryVertical.B2B_AGENCY,
    MEDIA: IndustryVertical.MEDIA,
    EDUCATION: IndustryVertical.EDUCATION,
    ENTERTAINMENT: IndustryVertical.ENTERTAINMENT,
    UNKNOWN: IndustryVertical.UNKNOWN,
    GAMBLING: IndustryVertical.GAMBLING,
    ADULT: IndustryVertical.ADULT,
    FRAUDULENT_HIGHRISK: IndustryVertical.FRAUDULENT_HIGH_RISK,
    FRAUDULENT_HIGH_RISK: IndustryVertical.FRAUDULENT_HIGH_RISK,
  };

  return aliases[key] ?? IndustryVertical.UNKNOWN;
}

function bucketFor(
  industry: IndustryVertical,
  supportedFlag: boolean,
): IndustryBucket {
  if (BLOCKED.has(industry)) {
    return "blocked";
  }
  if (supportedFlag && SUPPORTED.has(industry)) {
    return "supported";
  }
  if (SUPPORTED.has(industry) && supportedFlag === false) {
    return "regret";
  }
  if (SUPPORTED.has(industry)) {
    return "supported";
  }
  return "regret";
}

export function mapGatekeeperToClassification(
  gate: GatekeeperGeminiPayload,
): IndustryClassification {
  const industry = normalizeIndustryToken(gate.industry);
  const bucket = bucketFor(industry, gate.supported);
  return {
    industry,
    bucket,
    subIndustry: gate.sub_industry.trim(),
    confidence: gate.confidence,
    supported: gate.supported && bucket === "supported",
  };
}
