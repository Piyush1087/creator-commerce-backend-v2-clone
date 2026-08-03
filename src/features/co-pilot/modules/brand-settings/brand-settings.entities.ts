/**
 * Brand Settings entities for prompt understanding (not Prisma models).
 */
export const BRAND_SETTINGS_ENTITIES = [
  "FirstName",
  "LastName",
  "AccountEmail",
  "CompanyName",
  "Website",
  "Logo",
  "BrandDescription",
  "SupportEmail",
  "GST",
  "PAN",
  "BillingEmail",
  "BillingAddress",
  "BankAccount",
  "IFSC",
  "AccountHolder",
  "InstagramConnection",
  "MetaConnection",
  "IntegrationPermission",
  "TeamMember",
] as const;

export type BrandSettingsEntity = (typeof BRAND_SETTINGS_ENTITIES)[number];
