import { z } from "zod";

export const CreatorTeamRoleEnum = z.enum(["OWNER", "MANAGER", "ASSISTANT"]);

export const SocialNetworkEnum = z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"]);

export const creatorShippingAddressSchema = z.object({
  recipientLegalName: z.string().min(2).max(150).trim(),
  streetAddressLine1: z.string().min(5).trim(),
  streetAddressLine2: z
    .string()
    .optional()
    .transform((val) => val?.trim() || null),
  city: z.string().min(2).trim(),
  stateProvince: z.string().min(2).trim(),
  postalCodeZip: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9\s-]+$/)
    .trim()
    .transform((val) => val.toUpperCase()),
  countryIsoCode: z
    .string()
    .length(2)
    .transform((val) => val.toUpperCase()),
  deliveryInstructionsNarrative: z
    .string()
    .max(500)
    .optional()
    .transform((val) => val?.trim() || null),
  isPrimaryDestination: z.boolean().default(true),
});

export const updateWorkspaceProfileSchema = z.object({
  organizationDisplayName: z.string().min(2).max(150).trim(),
});

export const inviteWorkspaceMemberSchema = z.object({
  recipientEmail: z.string().email(),
  allocatedRole: CreatorTeamRoleEnum.default("ASSISTANT"),
});

export const updateWorkspaceMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  allocatedRole: CreatorTeamRoleEnum,
});

export const updateCreatorProfileSchema = z.object({
  displayName: z.string().min(2).max(100).trim().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

export const paymentGatewayVerificationSchema = z
  .object({
    beneficiaryLegalName: z
      .string()
      .min(2)
      .max(150)
      .regex(/^[a-zA-Z\s.]+$/),
    accountNumber: z.string().min(8).max(25).regex(/^\d+$/),
    confirmAccountNumber: z.string(),
    routingIfscSwift: z.string().min(5).max(15).trim().toUpperCase(),
    payoutCurrencyToken: z.string().length(3).toUpperCase().default("INR"),
  })
  .refine((data) => data.accountNumber === data.confirmAccountNumber, {
    message: "Bank account inputs do not match.",
    path: ["confirmAccountNumber"],
  });

export type CreatorShippingAddressInput = z.infer<
  typeof creatorShippingAddressSchema
>;
export type UpdateWorkspaceProfileInput = z.infer<
  typeof updateWorkspaceProfileSchema
>;
export type InviteWorkspaceMemberInput = z.infer<
  typeof inviteWorkspaceMemberSchema
>;
export type UpdateCreatorProfileInput = z.infer<
  typeof updateCreatorProfileSchema
>;
export type PaymentGatewayVerificationInput = z.infer<
  typeof paymentGatewayVerificationSchema
>;
