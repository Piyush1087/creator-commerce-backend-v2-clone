export const BILLING_REQUIRED_FIELDS = [
  "legal_entity_name",
  "legal_entity_type",
  "billing_country_code",
  "billing_address",
] as const;

export type BillingReadinessSource = {
  registeredCompanyName: string | null;
  legalEntityType: string | null;
  billingCountryCode: string | null;
  corporateBillingAddress: string | null;
} | null;

/** Shared pure billing-completeness authority for Settings and bounded reads. */
export function billingReadiness(profile: BillingReadinessSource) {
  const missingRequiredFields: (typeof BILLING_REQUIRED_FIELDS)[number][] = [];
  if (!profile?.registeredCompanyName?.trim())
    missingRequiredFields.push("legal_entity_name");
  if (!profile?.legalEntityType?.trim())
    missingRequiredFields.push("legal_entity_type");
  if (!profile?.billingCountryCode?.trim())
    missingRequiredFields.push("billing_country_code");
  if (!profile?.corporateBillingAddress?.trim())
    missingRequiredFields.push("billing_address");
  return {
    is_complete_for_paid_conversion: missingRequiredFields.length === 0,
    missing_required_fields: missingRequiredFields,
  };
}
