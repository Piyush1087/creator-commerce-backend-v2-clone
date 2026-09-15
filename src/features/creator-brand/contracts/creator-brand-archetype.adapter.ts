import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

export const CREATOR_BRAND_ARCHETYPE_SOURCE = Object.freeze({
  path: "campaign/canonical/creator_archetypes.yaml",
  blob: "5a2819f8a765857bb03c4b9ecc68d6fd4e7b707c",
  sha256: "ab4a9a3615baa3ffc5815eaae405f793dc08b5ae9404cb3e57db40f37beeb970",
  version: "1.0",
  status: "FROZEN",
  activeCount: 30,
});
const librarySchema = z
  .object({
    version: z.literal("1.0"),
    status: z.literal("FROZEN"),
    library: z.literal("creator_archetypes"),
    rules: z
      .object({
        canonical_ids_only: z.literal(true),
        custom_entries_allowed: z.literal(false),
        campaign_selection_min: z.literal(1),
        campaign_selection_max: z.literal(5),
        recommendation_engine_may_invent_archetype: z.literal(false),
      })
      .strict(),
    archetypes: z
      .array(
        z
          .object({
            id: z.string().regex(/^[A-Z_]+$/u),
            label: z.string().min(1),
            is_active: z.literal(true),
          })
          .strict(),
      )
      .length(30),
  })
  .strict();

/** Read the EXISTING Campaign artifact; never maintain a Creator ID copy. */
export function creatorBrandCanonicalArchetypes() {
  const bytes = readFileSync(
    join(
      __dirname,
      "..",
      "..",
      "brand-onboarding",
      "brand-preview",
      "runtime",
      "artifacts",
      "creator_archetypes.yaml",
    ),
  );
  // Windows checkout CRLF is presentation only; canonical Git blob uses LF.
  const source = bytes.toString("utf8").replace(/\r\n/gu, "\n");
  if (
    createHash("sha256").update(source).digest("hex") !==
    CREATOR_BRAND_ARCHETYPE_SOURCE.sha256
  )
    throw new Error("CANONICAL_ARCHETYPE_LIBRARY_CONFLICT");
  const library = librarySchema.parse(parse(source));
  if (new Set(library.archetypes.map((item) => item.id)).size !== 30)
    throw new Error("CANONICAL_ARCHETYPE_LIBRARY_CONFLICT");
  return library.archetypes;
}
export const CreatorBrandArchetypeIdSchema = z
  .string()
  .superRefine((value, context) => {
    if (!creatorBrandCanonicalArchetypes().some((item) => item.id === value))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Canonical active archetype ID required",
      });
  });
