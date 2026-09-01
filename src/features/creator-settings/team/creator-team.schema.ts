import { z } from "zod";

export const CreatorTeamAssignableRoleSchema = z.enum(["MANAGER", "ASSISTANT"]);

export const InviteCreatorTeamMemberSchema = z
  .object({
    recipientEmail: z.string().trim().email().max(255),
    allocatedRole: CreatorTeamAssignableRoleSchema.default("ASSISTANT"),
  })
  .strict();

export const UpdateCreatorTeamMemberRoleSchema = z
  .object({ allocatedRole: CreatorTeamAssignableRoleSchema })
  .strict();

// A leaked stored digest must not work as a bearer credential.
export const CreatorTeamInvitationTokenSchema = z
  .string()
  .min(32)
  .max(512)
  .refine((value) => !value.startsWith("sha256:"), "Invalid invitation token");

export const InspectCreatorTeamInvitationSchema = z
  .object({ token: CreatorTeamInvitationTokenSchema })
  .strict();

export const AcceptCreatorTeamInvitationSchema =
  InspectCreatorTeamInvitationSchema;

export type InviteCreatorTeamMemberInput = z.infer<
  typeof InviteCreatorTeamMemberSchema
>;
export type CreatorTeamAssignableRole = z.infer<
  typeof CreatorTeamAssignableRoleSchema
>;
