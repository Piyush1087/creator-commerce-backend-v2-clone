import { z } from "zod";

const INSTAGRAM_HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/;

export const ActivatedModuleEnum = z.enum([
  "MESSY_DMS_TO_DEALS",
  "BUILDING_UPDATING_MEDIA_KIT",
  "POST_PERFORMANCE_PRICING",
  "CONTRACT_ESCROW_SECURITY",
]);

export const HandleCheckSchema = z.object({
  instagramHandle: z
    .string()
    .trim()
    .transform((val) => val.replace(/^@/, ""))
    .refine((val) => INSTAGRAM_HANDLE_REGEX.test(val), {
      message:
        "Please enter a valid Instagram handle (letters, numbers, periods, and underscores only).",
    }),
});

export const FeatureStagingSchema = z.object({
  onboardingTrackId: z.string().uuid(),
  stagedModules: z.array(ActivatedModuleEnum).min(0).max(4).default([]),
});

export const AccountSignupSchema = z.object({
  onboardingTrackId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(100),
});

export const EmailOtpVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otpCode: z
    .string()
    .trim()
    .length(6)
    .regex(/^\d+$/, { message: "Verification code must contain digits only." }),
});

export const MetaConnectSchema = z.object({
  onboardingTrackId: z.string().uuid(),
  code: z.string().min(1),
  redirectUri: z.string().url(),
});

export const AiActivationTriggerSchema = z.object({
  onboardingTrackId: z.string().uuid(),
  userConfirmedSync: z.literal(true),
  skipInstagramConnect: z.boolean().optional(),
});

export const JoinCreatorWaitlistSchema = z.object({
  onboardingTrackId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
});
