import { IndustryVertical } from "@prisma/client";

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pickFrom<T>(values: readonly T[], seed: string): T {
  const idx = hashString(seed) % values.length;
  return values[idx] as T;
}

/**
 * Deterministic placeholder until the real classifier ships. Product can
 * override outcomes using hostname markers for demos:
 * - `supported-*` subdomain prefix on any domain → D2C
 * - `regret-*` → REAL_ESTATE (waitlist path)
 * - `blocked-*` → GAMBLING (hard block path)
 */
export function stubClassifyIndustry(hostname: string): {
  industry: IndustryVertical;
  bucket: "supported" | "regret" | "blocked";
} {
  const h = hostname.toLowerCase();
  if (h.startsWith("supported.") || h.includes(".supported.")) {
    return { industry: IndustryVertical.D2C, bucket: "supported" };
  }
  if (h.startsWith("regret.") || h.includes(".regret.")) {
    return { industry: IndustryVertical.REAL_ESTATE, bucket: "regret" };
  }
  if (h.startsWith("blocked.") || h.includes(".blocked.")) {
    return { industry: IndustryVertical.GAMBLING, bucket: "blocked" };
  }
  if (/gambl|casino|porn|xxx|betting|bet\./i.test(h)) {
    return { industry: IndustryVertical.GAMBLING, bucket: "blocked" };
  }
  const supportedList = [
    IndustryVertical.D2C,
    IndustryVertical.SAAS_AI,
    IndustryVertical.HEALTHCARE,
    IndustryVertical.OFFLINE_SERVICES,
  ] as const;
  const regretList = [
    IndustryVertical.REAL_ESTATE,
    IndustryVertical.B2B_AGENCY,
    IndustryVertical.MEDIA,
    IndustryVertical.EDUCATION,
    IndustryVertical.ENTERTAINMENT,
    IndustryVertical.UNKNOWN,
  ] as const;
  const bucketRoll = hashString(hostname) % 100;
  if (bucketRoll < 55) {
    return {
      industry: pickFrom(supportedList, `${hostname}:s`),
      bucket: "supported",
    };
  }
  if (bucketRoll < 90) {
    return {
      industry: pickFrom(regretList, `${hostname}:r`),
      bucket: "regret",
    };
  }
  return {
    industry: pickFrom(
      [
        IndustryVertical.GAMBLING,
        IndustryVertical.ADULT,
        IndustryVertical.FRAUDULENT_HIGH_RISK,
      ],
      `${hostname}:b`,
    ),
    bucket: "blocked",
  };
}
