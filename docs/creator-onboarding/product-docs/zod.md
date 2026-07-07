import { z } from "zod";

// \============================================================================  
// SYSTEM IDENTIFIERS & CONSTANTS  
// \============================================================================

const OnboardingStatusEnum \= z.enum(\[  
  "HANDLE\_INPUTTED",  
  "ELIGIBILITY\_CALCULATED",  
  "FEATURES\_STAGED",  
  "ACCOUNT\_CREATED",  
  "OTP\_VERIFIED",  
  "META\_OAUTH\_SUCCESS",  
  "AI\_ENGINE\_SYNCED",  
  "WAITLISTED",  
\]);

const ActivatedModuleEnum \= z.enum(\[  
  "MESSY\_DMS\_TO\_DEALS",  
  "BUILDING\_UPDATING\_MEDIA\_KIT",  
  "POST\_PERFORMANCE\_PRICING",  
  "CONTRACT\_ESCROW\_SECURITY",  
\]);

const INSTAGRAM\_HANDLE\_REGEX \= /^\[a-zA-Z0-9.\_\]{1,30}$/;

// \============================================================================  
// STEP 1: HERO CONTAINER SOCIAL HANDLE ENTERED  
// \============================================================================

export const handleCheckSchema \= z.object({  
  instagramHandle: z  
    .string()  
    .trim()  
    .transform((val) \=\> val.replace(/^@/, "")) // Safely flattens leading symbols out  
    .refine((val) \=\> INSTAGRAM\_HANDLE\_REGEX.test(val), {  
      message: "Please enter a valid Instagram handle (letters, numbers, periods, and underscores only).",  
    }),  
  clientIp: z.string().ip({ message: "A valid client IP footprint is required." }),  
});

export type HandleCheckInput \= z.infer\<typeof handleCheckSchema\>;

// \============================================================================  
// STEP 2: PRE-SIGNUP PRE-SELECTION WIZARD CHECKLIST  
// \============================================================================

export const featureStagingSchema \= z.object({  
  onboardingTrackId: z.string().uuid({ message: "Invalid onboarding tracking token sequence." }),  
  stagedModules: z  
    .array(ActivatedModuleEnum)  
    .min(0)  
    .max(4)  
    .default(\[\]),  
});

export type FeatureStagingInput \= z.infer\<typeof featureStagingSchema\>;

// \============================================================================  
// STEP 3: CREATOR ACCOUNT CREATION MIGRATION (FLEXIBLE USER SIGNUP)  
// \============================================================================

export const accountSignupSchema \= z.object({  
  onboardingTrackId: z.string().uuid({ message: "Invalid onboarding tracking token sequence." }),  
  email: z  
    .string()  
    .trim()  
    .toLowerCase()  
    .email({ message: "Please enter a valid email address." }), // Intentionally accepts ANY valid layout domain (personal/work)  
  password: z  
    .string()  
    .min(6, { message: "Password security requirement must be at least 6 characters long." })  
    .max(100, { message: "Password cannot exceed 100 characters." }),  
});

export type AccountSignupInput \= z.infer\<typeof accountSignupSchema\>;

// \============================================================================  
// STEP 3A: TRANSIENT INLINE SECURITY EMAIL OTP CAPTURE  
// \============================================================================

export const emailOtpVerificationSchema \= z.object({  
  email: z.string().trim().toLowerCase().email(),  
  otpCode: z  
    .string()  
    .trim()  
    .length(6, { message: "Verification security token must be exactly 6 digits." })  
    .regex(/^\\d+$/, { message: "Verification code must contain digits only." }),  
});

export type EmailOtpVerificationInput \= z.infer\<typeof emailOtpVerificationSchema\>;

// \============================================================================  
// STEP 4: NATIVE INSTAGRAM GRAPH API SECURE AUTHORIZATION GATEWAY  
// \============================================================================

export const metaAssetSelectionSchema \= z.object({  
  onboardingTrackId: z.string().uuid({ message: "Invalid onboarding tracking token sequence." }),  
  metaAccessToken: z.string().min(1, { message: "Instagram API authority token cannot be blank." }),  
    
  // Mandatory unique platform user ID parameter returned directly from the native API handler.  
  // Enforces data sovereignty matching and catches duplicates at runtime.  
  selectedInstagramProfileId: z  
    .string()  
    .trim()  
    .min(1, { message: "The absolute, unique Instagram Graph User ID parameter is required." }),  
      
  selectedInstagramHandle: z  
    .string()  
    .trim()  
    .min(1, { message: "Profile display handle string required." }),  
});

export type MetaAssetSelectionInput \= z.infer\<typeof metaAssetSelectionSchema\>;

// \============================================================================  
// STEP 5: FINAL SYSTEM COMPILATION SCAN ACTIVATION TRIGGER  
// \============================================================================

export const aiActivationTriggerSchema \= z.object({  
  onboardingTrackId: z.string().uuid({ message: "Invalid onboarding tracking token sequence." }),  
  userConfirmedSync: z.literal(true, {  
    errorMap: () \=\> ({ message: "You must explicitly confirm workspace deployment execution." }),  
  }),  
});

export type AIActivationTriggerInput \= z.infer\<typeof aiActivationTriggerSchema\>;  
