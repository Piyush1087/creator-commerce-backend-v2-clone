import { z } from "zod";

export const canonicalCampaignObjectiveSchema = z.enum([
  "AWARENESS",
  "TRUST",
  "ASSETS",
  "ACTION",
]);

export type CanonicalCampaignObjective = z.infer<
  typeof canonicalCampaignObjectiveSchema
>;
