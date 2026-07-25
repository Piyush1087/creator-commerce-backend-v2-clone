import type { IndustryVertical } from "@prisma/client";

export type IndustryBucket = "supported" | "regret" | "blocked";

export type IndustryClassification = {
  industry: IndustryVertical;
  bucket: IndustryBucket;
  /** Stage 0 Gatekeeper sub-industry label when present. */
  subIndustry?: string | null;
  confidence?: number;
  supported?: boolean;
};
