import { z } from "zod";

// Reject the stored representation itself: a leaked digest is not a bearer token.
export const InvitationTokenSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => !value.startsWith("sha256:"), "Invalid invitation token");
export const InspectTeamInvitationSchema = z
  .object({ token: InvitationTokenSchema })
  .strict();
export const AcceptTeamInvitationSchema = InspectTeamInvitationSchema.extend({
  password: z
    .string()
    .min(8)
    .max(128)
    .refine((value) => value.trim().length > 0, "Password cannot be blank")
    .optional(),
  googleIdToken: z.string().min(1).max(8192).optional(),
  otpCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
export type AcceptTeamInvitationInput = z.infer<
  typeof AcceptTeamInvitationSchema
>;
