import { IndustryVertical } from "@prisma/client";
import { z } from "zod";

import { normalizeIndustryVertical } from "./core-identity.schema";

const nullableUrl = z.string().url().nullable().catch(null);

export const ConfirmIdentityBodySchema = z.object({
  brand_name: z.string().min(1),
  brand_logo: z.string().url().nullable(),
  industry: z
    .string()
    .min(1)
    .transform((value) => normalizeIndustryVertical(value))
    .pipe(z.nativeEnum(IndustryVertical)),
  sub_industry: z.string().min(1),
  tagline: z.string().nullable(),
  social_handles: z.object({
    instagram: nullableUrl,
    tiktok: nullableUrl,
    facebook: nullableUrl,
    youtube: nullableUrl,
    linkedin: nullableUrl,
  }),
});

export type ConfirmIdentityBody = z.infer<typeof ConfirmIdentityBodySchema>;
