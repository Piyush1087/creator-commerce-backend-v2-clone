import { z } from "zod";

// \============================================================================  
// ORIGINAL SCHEMAS (PHASE 1 & AUDIT UTILITIES)  
// \============================================================================

/\*\*  
 \* Validates team invitation email formats and assigns baseline roles.  
 \*/  
export const TeamInviteSchema \= z.object({  
  email: z.string().email("Please enter a valid work email."),\[cite: 7\]  
  role: z.enum(\["ADMIN", "EDITOR"\]).default("ADMIN"),\[cite: 7\]  
});

/\*\*  
 \* Enforces parameter identity validation between active social media platform handles  
 \* and initial system scan inputs.  
 \*/  
export const MetaSyncSchema \= z.object({  
  metaHandle: z.string(),\[cite: 7\]  
  initialHandle: z.string(),\[cite: 7\]  
}).refine((data) \=\> data.metaHandle.toLowerCase() \=== data.initialHandle.toLowerCase(), {\[cite: 7\]  
  message: "The Meta account must match the handle provided during the scan.",\[cite: 7\]  
  path: \["metaHandle"\],\[cite: 7\]  
});

// \============================================================================  
// NEW SCHEMAS: STEP 6 DUAL-PATH VERIFICATION & PASSWORD SETUP  
// \============================================================================

/\*\*  
 \* Global blocklist tracking consumer public mail systems.  
 \* Prevents unauthorized public accounts from bypassing business authorization checks.  
 \*/  
const BANNED\_PUBLIC\_PROVIDERS \= \[  
  "gmail.com",  
  "yahoo.com",  
  "outlook.com",  
  "hotmail.com",  
  "icloud.com",  
  "mail.com",  
  "proton.me",  
  "protonmail.com"  
\] as const;

/\*\*  
 \* UTILITY: Domain Extraction & Normalization  
 \* Programmatically strips protocols, path extensions, and subdomains.  
 \* Maps 'https://www.evara.in/store' down to 'evara.in' for strict parity.  
 \*/  
export const normalizeBrandDomain \= (rawUrlOrDomain: string): string \=\> {  
  if (\!rawUrlOrDomain) return "";  
  return rawUrlOrDomain  
    .toLowerCase()  
    .replace(/^(https?:\\/\\/)?(www\\.|shop\\.|app\\.)?/, "") // Strip network schemes and subdomains  
    .split("/")\[0\]                                      // Discard trailing directory routes  
    .trim();  
};

/\*\*  
 \* PATH A \- PHASE 1: Manual Email Entry Validation Factory  
 \* Validates manual work email inputs against format requirements and public blocklists.  
 \*/  
export const EmailEntrySchema \= (step1BrandDomainUrl: string) \=\> {  
  const cleanTargetDomain \= normalizeBrandDomain(step1BrandDomainUrl);

  return z.object({  
    email: z  
      .string()  
      .min(1, { message: "Work email coordinate is required." })  
      .email({ message: "Please enter a valid email address (e.g., name@brand.in)" })  
      .refine(  
        (val) \=\> {  
          const inputDomain \= val.split("@")\[1\]?.toLowerCase().trim();  
          return \!BANNED\_PUBLIC\_PROVIDERS.includes(inputDomain as any);  
        },  
        {  
          message: \`Public email providers are not permitted for brand verification. Please use your official @${cleanTargetDomain} email.\`,  
        }  
      )  
      .refine(  
        (val) \=\> {  
          const inputDomain \= val.split("@")\[1\]?.toLowerCase().trim();  
          return inputDomain \=== cleanTargetDomain || inputDomain.endsWith(\`.${cleanTargetDomain}\`);  
        },  
        {  
          message: "DOMAIN\_MISMATCH\_TRIGGER", // Caught by form controller to pass dynamic copy  
        }  
      ),  
  });  
};

/\*\*  
 \* PATH A \- PHASE 2: 6-Digit Numerical OTP Verification Grid  
 \* Enforces exact numeric boundary constraints across individual digit input text boxes.  
 \*/  
export const OTPSchema \= z.object({  
  otp: z  
    .string()  
    .length(6, { message: "Verification code must be exactly 6 digits." })  
    .regex(/^\[0-9\]+$/, { message: "Verification code must contain digits only." }),  
});

/\*\*  
 \* PATH B: Federated Google OAuth Email Validation Factory  
 \* Parses the validated email address returned from Google's OAuth profile payload   
 \* to ensure alignment with the target workspace domain before routing to password setup.  
 \*/  
export const GoogleOAuthEmailSchema \= (step1BrandDomainUrl: string) \=\> {  
  const cleanTargetDomain \= normalizeBrandDomain(step1BrandDomainUrl);

  return z.object({  
    email: z  
      .string()  
      .email()  
      .refine(  
        (val) \=\> {  
          const inputDomain \= val.split("@")\[1\]?.toLowerCase().trim();  
          return \!BANNED\_PUBLIC\_PROVIDERS.includes(inputDomain as any);  
        },  
        {  
          message: "GOOGLE\_CONSUMER\_BLOCK", // Trigger code for consumer @gmail wrappers  
        }  
      )  
      .refine(  
        (val) \=\> {  
          const inputDomain \= val.split("@")\[1\]?.toLowerCase().trim();  
          return inputDomain \=== cleanTargetDomain || inputDomain.endsWith(\`.${cleanTargetDomain}\`);  
        },  
        {  
          message: "GOOGLE\_DOMAIN\_MISMATCH", // Trigger code for tenant matching rule validation failures  
        }  
      ),  
  });  
};

/\*\*  
 \* UNIFIED PHASE 3: Password Creation Security Gate  
 \* Evaluates password criteria across BOTH entry paths after identity verification success.  
 \* Intercepts empty character space string blocks to block profile setup bypass vectors.  
 \*/  
export const PasswordCreationSchema \= z.object({  
  password: z  
    .string()  
    .min(1, { message: "Password setup is required to secure your workspace." })  
    .refine((val) \=\> val.trim().length \> 0, {  
      message: "❌ Passwords cannot consist entirely of blank spaces. Please enter at least 8 visible characters.",  
    })  
    .refine((val) \=\> val.length \>= 8, {  
      message: "❌ Password must be at least 8 characters long.",  
    }),  
});

// Type Inferences  
export type TeamInviteInput \= z.infer\<typeof TeamInviteSchema\>;\[cite: 7\]  
export type MetaSyncInput \= z.infer\<typeof MetaSyncSchema\>;\[cite: 7\]  
export type EmailEntryInput \= z.infer\<ReturnType\<typeof EmailEntrySchema\>\>;  
export type OTPInput \= z.infer\<typeof OTPSchema\>;  
export type GoogleOAuthEmailInput \= z.infer\<ReturnType\<typeof GoogleOAuthEmailSchema\>\>;  
export type PasswordCreationInput \= z.infer\<typeof PasswordCreationSchema\>;

