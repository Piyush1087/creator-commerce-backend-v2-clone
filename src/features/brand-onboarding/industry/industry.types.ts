import type { IndustryVertical } from "@prisma/client";

export type IndustryBucket = "supported" | "regret" | "blocked";

export type IndustryClassification = {
  industry: IndustryVertical;
  bucket: IndustryBucket;
};
