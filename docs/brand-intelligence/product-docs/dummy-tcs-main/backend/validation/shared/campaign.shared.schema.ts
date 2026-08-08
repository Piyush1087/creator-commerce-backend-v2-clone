import { z } from "zod";

// IDs are intentionally shape-only here. Production ID format/existence is service-owned.
export const entityIdSchema = z.string().trim().min(1);
// Client-generated command identity used for replay-safe side-effecting mutations.
// Durable uniqueness and replay semantics are service/persistence-owned.
export const requestIdSchema = z.string().trim().min(1).max(128);
export const nonNegativeMoneySchema = z.coerce.number().finite().min(0);
export const percentageSchema = z.coerce.number().int().min(0).max(100);
export const dateTimeSchema = z.coerce.date();
export const optionalDateTimeSchema = dateTimeSchema.optional().nullable();

export const campaignStatusSchema = z.enum(["DRAFT", "PUBLISHED", "LIVE", "PAUSED", "COMPLETED", "ARCHIVED"]);
export const campaignCreationSourceSchema = z.enum(["MANUAL", "AI_RECOMMENDED"]);
export const publishingScheduleSchema = z.enum(["EVERGREEN", "SCHEDULED"]);
export const campaignObjectiveSchema = z.enum(["PULSE", "PROOF", "PRODUCTION", "PUSH"]);
export const mediaPlatformSchema = z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"]);
// Persistence remains future-ready, while Brand-writable MVP Campaign publication is Instagram-only.
export const mvpCampaignPlatformSchema = z.literal("INSTAGRAM");
export const visibilityScopeSchema = z.enum(["EVERYONE", "ELIGIBLE_ONLY", "INVITED_ONLY"]);
export const audienceGenderSchema = z.enum(["ALL", "FEMALE", "MALE"]);
export const compensationTypeSchema = z.enum(["FIXED_FEE", "NEGOTIABLE"]);
export const payoutTermsSchema = z.enum(["IMMEDIATE", "NET_7", "NET_15", "NET_30", "NET_45", "NET_60"]);
export const brandSupportTypeSchema = z.enum(["PRODUCT", "SERVICE", "EXPERIENCE", "ACCESS_SUBSCRIPTION", "OTHER"]);
export const campaignAssetKindSchema = z.enum(["BRAND", "OFFERING", "OFFER"]);
export const briefTypeSchema = z.enum(["CREATOR_LED", "BRAND_LED"]);
export const deliverableFormatSchema = z.enum(["REEL_VIDEO", "STORY", "PHOTOSHOOT", "BANNER_CAROUSEL"]);
export const campaignCreatorSourceSchema = z.enum(["META_MARKETPLACE", "MANUAL"]);
export const campaignCreatorIngestionMethodSchema = z.enum(["MARKETPLACE_RECOMMENDATION", "MANUAL_SINGLE", "MANUAL_CSV"]);
export const recommendationScoreBandSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const outreachChannelSchema = z.enum(["PRIORITY_DM", "EMAIL"]);
export const applicationSourceSchema = z.enum(["DIRECT", "OUTREACH", "SHARE"]);
export const reportAvailabilitySchema = z.enum(["AVAILABLE", "PARTIAL"]);
export const campaignShareChannelSchema = z.enum(["COPY_LINK", "WHATSAPP", "INSTAGRAM", "NATIVE_SHARE"]);

// Campaign collaboration currency is frozen to INR/USD for MVP.
export const campaignCurrencySchema = z.enum(["INR", "USD"]);

// Taxonomy membership is service/reference-data owned; Zod validates only identifiers/cardinality.
export const taxonomyIdSchema = z.string().trim().min(1);

// Recursive JSON-safe boundary for Prisma Json fields. This rejects non-JSON JS values such as
// Date, Map, Set, functions, symbols and undefined rather than accepting arbitrary nested unknowns.
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

// Current Campaign artifacts require object/array containers at these structured JSON boundaries.
export const structuredJsonSchema = z.union([
  z.record(jsonValueSchema),
  z.array(jsonValueSchema),
]);

export const emailSchema = z.string().trim().email();
export const socialHandleSchema = z.string().trim().min(1);
