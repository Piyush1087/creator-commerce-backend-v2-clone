import { z } from "zod";

export const BrandRoleEnum = z.enum([
  "BRAND_OWNER",
  "FINANCE_ADMIN",
  "CAMPAIGN_MANAGER",
]);

export const NotificationChannelEnum = z.enum([
  "EMAIL",
  "IN_APP",
  "SLACK_WEBHOOK",
]);

export const NotificationCategoryEnum = z.enum([
  "ESCROW_LOW_BALANCE",
  "MILESTONE_RELEASE_REQUEST",
  "TAX_COMPLIANCE_ALERT",
  "CAMPAIGN_BUDGET_OVERRUN",
]);

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const optionalGstin = z
  .union([z.string().trim().toUpperCase().regex(GSTIN_REGEX), z.literal("")])
  .optional()
  .transform((val) => (!val ? null : val));

const optionalPan = z
  .union([z.string().trim().toUpperCase().regex(PAN_REGEX), z.literal("")])
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

export const BrandBillingProfileSchema = z.object({
  registeredCompanyName: z.string().min(2).max(255),
  corporateBillingAddress: z.string().min(10),
  gstin: optionalGstin,
  pan: optionalPan,
  defaultTdsPercentage: z.number().min(0).max(10).default(2),
  currencyPreference: z
    .string()
    .length(3)
    .default("INR")
    .transform((val) => val.toUpperCase()),
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
    channel: NotificationChannelEnum,
    isEnabled: z.boolean().default(true),
    slackWebhookUrl: z
      .union([z.string().url(), z.literal(""), z.null()])
      .optional()
      .transform((val) => val || null),
  })
  .refine(
    (data) => {
      if (
        data.channel === "SLACK_WEBHOOK" &&
        data.isEnabled &&
        !data.slackWebhookUrl
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "A target webhook URL is required when Slack webhooks are enabled.",
      path: ["slackWebhookUrl"],
    },
  );

export const BulkNotificationSettingsSchema = z.object({
  settings: z.array(NotificationSettingLineSchema),
});

export const UpdateBrandGeneralProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  organizationLegalName: z.string().min(2).max(255).optional(),
  organizationAddress: z.string().min(5).optional(),
  countryCode: z.string().length(2).optional(),
  currencyCode: z.string().length(3).optional(),
  taxId: z.string().max(50).nullable().optional(),
});

export type UpdateTeamRoleInput = z.infer<typeof UpdateTeamRoleSchema>;
export type InviteTeamMemberInput = z.infer<typeof InviteTeamMemberSchema>;
export type BrandBillingProfileInput = z.infer<
  typeof BrandBillingProfileSchema
>;
export type BrandWithdrawalAccountInput = z.infer<
  typeof BrandWithdrawalAccountSchema
>;
export type BulkNotificationSettingsInput = z.infer<
  typeof BulkNotificationSettingsSchema
>;
export type UpdateBrandGeneralProfileInput = z.infer<
  typeof UpdateBrandGeneralProfileSchema
>;
