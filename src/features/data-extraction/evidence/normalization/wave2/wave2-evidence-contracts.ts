import { z } from "zod";

const text = z.string().min(1).max(600);
const nullableText = text.nullable();
const scope = z.enum([
  "BRAND_LEVEL",
  "MULTI_OFFERING",
  "OFFERING_SPECIFIC",
  "CONTEXT_SPECIFIC",
]);
const common = {
  source_url: z.string().url(),
  source_locator: z.string().min(1).max(160),
  page_role: z.string(),
  subject_scope: scope,
  authorship: z.enum(["BRAND_AUTHORED", "TESTIMONIAL", "UNKNOWN"]),
};
export const proofEvidenceSchema = z
  .object({
    ...common,
    evidence_semantic: z.literal("proof_or_claim_observation"),
    statement: text,
    proof_strength: z.enum([
      "DIRECT_FIRST_PARTY_FACT",
      "EXPLICIT_CERTIFICATION_OR_CREDENTIAL",
      "OBSERVABLE_CAPABILITY",
      "FIRST_PARTY_CLAIM",
      "TESTIMONIAL_OR_SOCIAL_PROOF",
      "GENERIC_MARKETING_ASSERTION",
    ]),
    proof_class: z.enum([
      "DIRECT_FIRST_PARTY_FACTUAL_SUPPORT",
      "BRAND_AUTHORED_ASSERTION",
      "CLAIM_REQUIRING_EXTERNAL_VERIFICATION",
      "REGULATORY_OR_CREDENTIAL_STATEMENT",
      "OTHER_BOUNDED_PROOF_CONTEXT",
    ]),
    scope,
    factual_referent_ref: z.string().min(1).nullable(),
    offering_refs: z.array(z.string().min(1)).max(1),
    claim_sensitivity: z.array(
      z.enum([
        "BRAND_AUTHORED_CLAIM",
        "CLINICAL_CREDENTIAL",
        "REGULATORY_STATEMENT",
        "TESTIMONIAL",
        "GUARANTEED_OUTCOME_LANGUAGE",
        "TREATMENT_EFFICACY",
        "DIAGNOSTIC_ACCURACY",
        "CLINICAL_SUPERIORITY",
        "MEDICAL_SUCCESS_RATE",
        "SAFETY_CLAIM",
      ]),
    ),
    verification_status: z.literal("NOT_EXTERNALLY_VERIFIED"),
  })
  .strict();
export const visualEvidenceSchema = z
  .object({
    ...common,
    evidence_semantic: z.enum([
      "LOGO_OR_MARK_OBSERVATION",
      "COLOUR_USAGE_OBSERVATION",
      "TYPOGRAPHY_OBSERVATION",
      "LAYOUT_OR_COMPOSITION_OBSERVATION",
      "GENERAL_VISUAL_PATTERN",
    ]),
    observed_property: text,
    observed_value: text,
    matched_element_count: z.number().int().min(1),
    observation_basis: z.literal("RETAINED_DOM_DECLARATION"),
    computed_or_rendered: z.literal(false),
    canonical_asset_ref: z.null(),
    limitations: z.array(z.string()),
  })
  .strict();
export const geographyAssertionSchema = z
  .object({
    polarity: z.enum(["SUPPORTED", "EXCLUDED"]),
    scope: z.enum([
      "LOCAL",
      "REGIONAL",
      "COUNTRY",
      "MULTI_COUNTRY_MEMBER",
      "GLOBAL",
    ]),
    country_code: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
    region: nullableText,
    locality: nullableText,
    radius_km: z.number().nonnegative().nullable(),
  })
  .strict();
export const serviceabilityEvidenceSchema = z
  .object({
    ...common,
    evidence_semantic: z.literal("first_party_serviceability_observation"),
    observation_type: z.enum([
      "SHIPPING_DELIVERY_GEOGRAPHY",
      "SERVICE_AREA_STATEMENT",
      "DIGITAL_REMOTE_AVAILABILITY",
      "BOOKING_AVAILABILITY",
      "TRANSACTION_AVAILABILITY",
      "GEOGRAPHY_RESTRICTION",
      "EXPLICIT_UNSUPPORTED_GEOGRAPHY",
      "GENERAL_BRAND_AVAILABILITY",
    ]),
    coverage_modality: z.enum([
      "PHYSICAL_LOCATION",
      "SHIPPING_DELIVERY",
      "DIGITAL_REMOTE",
      "BOOKING_SERVICE",
      "TRANSACTIONAL",
    ]),
    geography_assertions: z.array(geographyAssertionSchema).max(8),
    offering_ref: z.string().min(1).nullable(),
    offering_candidate_ref: z.string().nullable(),
    statement_or_normalized_fact: text,
    evidence_strength: z.enum([
      "SPECIFIC_AVAILABILITY_STATEMENT",
      "GENERAL_AVAILABILITY_STATEMENT",
      "CONTEXTUAL_SUPPORT",
    ]),
  })
  .strict();
export const locationEvidenceSchema = z
  .object({
    ...common,
    evidence_semantic: z.literal("first_party_location_observation"),
    observation_type: z.enum([
      "LOCATION_PAGE",
      "LOCATION_DIRECTORY_ENTRY",
      "PHYSICAL_ADDRESS_OR_PRESENCE",
      "LOCATION_STATUS_SIGNAL",
    ]),
    candidate_location_ref: z.null(),
    canonical_location_ref: z.string().min(1).nullable(),
    geography_assertion: geographyAssertionSchema.nullable(),
    booking_or_access_ref: z.null(),
    offering_ref: z.string().min(1).nullable(),
    statement_or_normalized_fact: text,
    observed_name: nullableText,
    street_address: nullableText,
    city: nullableText,
    region: nullableText,
    postal_code: nullableText,
    country: nullableText,
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    telephone: nullableText,
    email: nullableText,
    source_location_identifier: nullableText,
  })
  .strict();

const amount = z.number().finite().nonnegative();
export const commercialEvidenceSchema = z
  .object({
    ...common,
    evidence_semantic: z.literal("exact_offering_commercial_observation"),
    canonical_offering_ref: z.string().min(1),
    observed_price_mode: z.enum([
      "EXACT",
      "STARTING_AT",
      "RANGE",
      "NOT_PUBLICLY_LISTED",
    ]),
    current_min_amount: amount.nullable(),
    current_max_amount: amount.nullable(),
    regular_reference_min_amount: amount.nullable(),
    regular_reference_max_amount: amount.nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    sale_or_reference_relationship: z.enum([
      "CURRENT_ONLY",
      "CURRENT_IS_SALE_WITH_REGULAR_REFERENCE",
      "NOT_APPLICABLE",
    ]),
    explicit_not_publicly_listed: z.boolean(),
    observed_at: z.string().datetime(),
    commercial_context: text,
    observation_source: z.enum(["HTML", "JSON_LD"]),
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, message });
    if (
      value.observed_price_mode === "EXACT" &&
      (value.current_min_amount === null ||
        value.current_max_amount !== value.current_min_amount)
    )
      issue("EXACT_REQUIRES_ONE_CURRENT_AMOUNT");
    if (
      value.observed_price_mode === "STARTING_AT" &&
      (value.current_min_amount === null || value.current_max_amount !== null)
    )
      issue("STARTING_AT_REQUIRES_MINIMUM_ONLY");
    if (
      value.observed_price_mode === "RANGE" &&
      (value.current_min_amount === null ||
        value.current_max_amount === null ||
        value.current_min_amount >= value.current_max_amount)
    )
      issue("RANGE_REQUIRES_ASCENDING_MINIMUM_AND_MAXIMUM");
    if (
      value.observed_price_mode === "NOT_PUBLICLY_LISTED" &&
      (!value.explicit_not_publicly_listed ||
        value.current_min_amount !== null ||
        value.current_max_amount !== null ||
        value.regular_reference_min_amount !== null ||
        value.regular_reference_max_amount !== null ||
        value.sale_or_reference_relationship !== "NOT_APPLICABLE")
    )
      issue("NOT_PUBLICLY_LISTED_REQUIRES_EXPLICIT_AMOUNT_ABSENCE");
    if (
      value.observed_price_mode !== "NOT_PUBLICLY_LISTED" &&
      value.explicit_not_publicly_listed
    )
      issue("PRICE_AMOUNT_CANNOT_BE_EXPLICITLY_NOT_LISTED");
    if (
      value.sale_or_reference_relationship ===
        "CURRENT_IS_SALE_WITH_REGULAR_REFERENCE" &&
      (value.regular_reference_min_amount === null ||
        value.regular_reference_max_amount === null)
    )
      issue("SALE_RELATIONSHIP_REQUIRES_REFERENCE_AMOUNT");
    if (
      value.sale_or_reference_relationship === "CURRENT_ONLY" &&
      (value.regular_reference_min_amount !== null ||
        value.regular_reference_max_amount !== null)
    )
      issue("CURRENT_ONLY_CANNOT_CARRY_REFERENCE_AMOUNT");
  });
