import { z } from "zod";
import { isIso31661Alpha2CountryCode } from "../../../shared/geography/iso-country-code";

export const BrandRoleEnum = z.enum([
  "BRAND_OWNER",
  "FINANCE_ADMIN",
  "CAMPAIGN_MANAGER",
]);

export const NotificationCategoryEnum = z.enum([
  "BILLING_SUBSCRIPTION",
  "ESCROW_PAYOUTS",
  "CAMPAIGNS_APPLICATIONS",
  "COLLABORATIONS",
  "BRAND_INTELLIGENCE",
  "TEAM_ACCOUNT_INTEGRATIONS",
]);

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const optionalGstin = z
  .union([z.string().trim().toUpperCase().regex(GSTIN_REGEX), z.literal("")])
  .optional()
  .transform((val) => (!val ? null : val));

export const UpdateTeamRoleSchema = z.object({
  membershipId: z.string().uuid(),
  role: BrandRoleEnum,
});

export const InviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: BrandRoleEnum.default("CAMPAIGN_MANAGER"),
});

export const BrandBillingProfileSchema = z
  .object({
    legalEntityName: z.string().trim().min(2).max(255),
    legalEntityType: z.string().trim().min(2).max(100),
    billingCountryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Use an ISO-3166-1 alpha-2 country code")
      .refine(
        isIso31661Alpha2CountryCode,
        "Use an assigned ISO-3166-1 alpha-2 country code",
      ),
    billingAddress: z.string().trim().min(10).max(2000),
    gstin: optionalGstin,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.gstin && value.billingCountryCode !== "IN") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gstin"],
        message: "GSTIN is supported only when billing country is IN",
      });
    }
  });

export const BrandWithdrawalAccountSchema = z
  .object({
    beneficiaryName: z.string().min(3).max(255),
    bankName: z.string().min(2),
    accountNumber: z.string().min(9).max(18).regex(/^\d+$/),
    confirmAccountNumber: z.string(),
    ifscCode: z.string().trim().toUpperCase().regex(IFSC_REGEX),
  })
  .refine((data) => data.accountNumber === data.confirmAccountNumber, {
    message: "Bank account inputs do not match.",
    path: ["confirmAccountNumber"],
  });

export const NotificationSettingLineSchema = z
  .object({
    category: NotificationCategoryEnum,
    optionalEmailEnabled: z.boolean(),
  })
  .strict();

export const BulkNotificationSettingsSchema = z
  .object({
    settings: z.array(NotificationSettingLineSchema),
  })
  .strict();

export const UpdateBrandGeneralProfileSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    organizationLegalName: z.string().min(2).max(255).optional(),
  })
  .strict();

export type UpdateTeamRoleInput = z.infer<typeof UpdateTeamRoleSchema>;
export type InviteTeamMemberInput = z.infer<typeof InviteTeamMemberSchema>;
export type BrandBillingProfileInput = z.infer<
  typeof BrandBillingProfileSchema
>;

function stagedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Accepts canonical billing fields or retired Co-Pilot aliases. Drops PAN/TDS/currency. */
export function brandBillingProfileFromStaged(
  staged: Record<string, unknown>,
): BrandBillingProfileInput {
  return BrandBillingProfileSchema.parse({
    legalEntityName:
      stagedString(staged.legalEntityName) ??
      stagedString(staged.registeredCompanyName),
    legalEntityType: stagedString(staged.legalEntityType),
    billingCountryCode: stagedString(staged.billingCountryCode),
    billingAddress:
      stagedString(staged.billingAddress) ??
      stagedString(staged.corporateBillingAddress),
    gstin: stagedString(staged.gstin),
  });
}

export type BrandWithdrawalAccountInput = z.infer<
  typeof BrandWithdrawalAccountSchema
>;
export type BulkNotificationSettingsInput = z.infer<
  typeof BulkNotificationSettingsSchema
>;
export type UpdateBrandGeneralProfileInput = z.infer<
  typeof UpdateBrandGeneralProfileSchema
>;

export const IntegrationProviderEnum = z.enum([
  "META_BUSINESS_SUITE",
  "INSTAGRAM",
]);

export const IntegrationStatusEnum = z.enum([
  "CONNECTED",
  "PARTIALLY_CONNECTED",
  "TOKEN_EXPIRED",
  "DISCONNECTED",
]);

export const IntegrationScopeEnum = z.enum([
  "BASIC_PROFILE",
  "ENGAGEMENT_INSIGHTS",
  "TARGETED_OUTREACH",
]);

export const ManageConnectionActionEnum = z.enum([
  "RECONNECT",
  "DISCONNECT_INTEGRATION",
  "DELETE_INGESTED_DATA",
]);

export const IntegrationConnectionSchema = z.object({
  id: z.string().uuid(),
  provider: IntegrationProviderEnum,
  status: IntegrationStatusEnum,
  currentPlatformHandle: z
    .string()
    .min(1)
    .startsWith("@", { message: 'Handle must start with "@".' })
    .nullable(),
  inboundOauthHandle: z
    .string()
    .startsWith("@", { message: 'Inbound handle must start with "@".' })
    .nullable()
    .optional(),
  scopes: z.array(IntegrationScopeEnum).default([]),
  tokenExpiresAt: z.string().datetime().nullable().optional(),
});

export const ManageConnectionActionSchema = z
  .object({
    integrationId: z.string().uuid(),
    action: ManageConnectionActionEnum,
    confirmDeleteData: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      if (data.action === "DELETE_INGESTED_DATA" && !data.confirmDeleteData) {
        return false;
      }
      return true;
    },
    {
      message:
        "Explicit confirmation required to disconnect and remove connection credentials.",
      path: ["confirmDeleteData"],
    },
  );

export const IdentityConflictResolutionSchema = z.object({
  integrationId: z.string().uuid(),
  currentPlatformHandle: z.string().startsWith("@"),
  inboundOauthHandle: z.string().startsWith("@"),
  resolution: z.enum(["OVERWRITE_HANDLE", "CANCEL_CONNECT"]),
});

export const ConnectInstagramSettingsSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
  state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export type IntegrationConnectionDto = z.infer<
  typeof IntegrationConnectionSchema
>;
export type ManageConnectionActionInput = z.infer<
  typeof ManageConnectionActionSchema
>;
export type IdentityConflictResolutionDto = z.infer<
  typeof IdentityConflictResolutionSchema
>;
export type ConnectInstagramSettingsInput = z.infer<
  typeof ConnectInstagramSettingsSchema
>;
