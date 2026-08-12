import { z } from "zod";

/**
 * Add Asset drawer — from docs/brand-uce/change-doc/zod-add-product.md
 * (+ inventory-validation.md: no inventory_count on create).
 */

export const AssetClassificationSchema = z.enum([
  "INDIVIDUAL_PRODUCT_SKU",
  "CURATED_COLLECTION_LINE",
  "CORE_BRAND_IDENTITY",
  "ACTIVE_SALE_PROMOTION",
]);

export const PromotionApplicabilitySchema = z.enum([
  "SITEWIDE",
  "SPECIFIC_PRODUCT",
  "SPECIFIC_COLLECTION",
]);

export const LinkProductAssetPayloadSchema = z.object({
  asset_type: z.literal("INDIVIDUAL_PRODUCT_SKU"),
  campaign_id: z
    .string()
    .uuid(
      "Campaign verification identifier framework requires a clean UUID structure.",
    ),
  product_name: z
    .string()
    .min(1, "Asset naming properties require structural label identities."),
  price: z
    .number()
    .positive(
      "Item retail pricing thresholds cannot settle below or equal to zero assets.",
    ),
  pdp_url: z
    .string()
    .url(
      "Product Detail Page parameter requires standard URL domain protocols.",
    ),
  thumbnail_asset_url: z.string().url().nullable(),
  brief_description: z
    .string()
    .min(
      10,
      "Provide context-rich descriptive summaries from your Brand Centre DNA records.",
    ),
  unique_selling_points: z
    .array(z.string().min(2))
    .min(1, "Provide at least one Core Unique Selling Point.")
    .max(3, "Brand DNA operational guidelines cap allowable USPs at 3 items."),
  compliance_do_not_say_tokens: z.array(z.string()),
  is_sync_locked: z.boolean().default(true),
  canonical_offering_id: z.string().uuid(),
});

export const LinkCollectionAssetPayloadSchema = z.object({
  asset_type: z.literal("CURATED_COLLECTION_LINE"),
  campaign_id: z.string().uuid(),
  collection_name: z.string().min(1),
  collection_pdp_url: z.string().url(),
  collection_thumbnail_url: z.string().url().nullable(),
  short_description: z.string().min(10),
  collection_usps: z.array(z.string()).max(3),
  linked_product_ids: z
    .array(z.string().uuid())
    .min(
      1,
      "Curated collections require at least one attached child Product SKU ID value.",
    ),
  canonical_offering_id: z.string().uuid(),
});

export const LinkBrandIdentityPayloadSchema = z.object({
  asset_type: z.literal("CORE_BRAND_IDENTITY"),
  campaign_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  corporate_legal_name: z.string().min(1),
  brand_mission_statement: z.string().min(10),
  global_tone_adjectives: z.array(z.string()).min(1),
});

/** Plain object only — Zod discriminatedUnion rejects ZodEffects from `.refine()`. */
export const LinkPromotionPayloadSchema = z.object({
  asset_type: z.literal("ACTIVE_SALE_PROMOTION"),
  campaign_id: z.string().uuid(),
  offer_name: z
    .string()
    .min(2, "Operational promotion names require tracking handles."),
  brief_description: z.string().min(5),
  offer_code: z
    .string()
    .min(1, "Voucher transactions require alphanumeric tracking tokens."),
  applicability: PromotionApplicabilitySchema,
  target_linked_entity_id: z.string().uuid().nullable(),
  start_date_iso: z
    .string()
    .datetime("Start window must track to valid ISO date formats."),
  expiration_date_iso: z
    .string()
    .datetime("Expiration parameter must track to valid ISO date formats."),
  t_and_c_footnote: z
    .string()
    .min(5, "Include minimal regulatory compliance Terms & Conditions text."),
  entity_deep_link_url: z
    .string()
    .url("Promotion destination route requires clean path URL formatting."),
  canonical_brand_offer_id: z.string().uuid(),
});

export const MasterAddAssetDrawerSchema = z
  .discriminatedUnion("asset_type", [
    LinkProductAssetPayloadSchema,
    LinkCollectionAssetPayloadSchema,
    LinkBrandIdentityPayloadSchema,
    LinkPromotionPayloadSchema,
  ])
  .superRefine((data, ctx) => {
    if (data.asset_type !== "ACTIVE_SALE_PROMOTION") return;
    if (
      Date.parse(data.expiration_date_iso) <= Date.parse(data.start_date_iso)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Promotion invalidation expiration window bounds must be set logically after start date thresholds.",
        path: ["expiration_date_iso"],
      });
    }
  });

export type LinkProductAssetPayload = z.infer<
  typeof LinkProductAssetPayloadSchema
>;
export type LinkCollectionAssetPayload = z.infer<
  typeof LinkCollectionAssetPayloadSchema
>;
export type LinkBrandIdentityPayload = z.infer<
  typeof LinkBrandIdentityPayloadSchema
>;
export type LinkPromotionPayload = z.infer<typeof LinkPromotionPayloadSchema>;
export type MasterAddAssetDrawerRequest = z.infer<
  typeof MasterAddAssetDrawerSchema
>;
