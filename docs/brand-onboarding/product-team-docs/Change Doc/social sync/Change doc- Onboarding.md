# Tab 3

| Promp \# | Context |
| :---- | :---- |
| 1 (Pro) | Influencer marketing platform- 2 lines description.  We have deployed and then working on identifying gaps and then building developer document for implementing these changes I am uploading \<these document\> for your context. I will uploadin xyz in the next prompt PostGRESQL, design system upload  |
| 2(Pro) | Brand onboarding journey Master PRD  |
| 3 (thinking) | Step 1 \> Core document and i have already world on a change doc (parked to my developer) \- incremental zod, PostGRE, ui copy update, url input various states Consolidate these 2  |
| 4 | Go to current step\> upload doc |
| 5 | Ask a few questions to gauge its understanding |
| 6 | Use- case edge case file (build it in exactly the same format as my upload |
| 7 |  |
| 8 |  |

# Brand Verification

# Use cases & edge cases

# **REVISED ARCHITECTURAL SPECIFICATION: STEP 6 (BRAND VERIFICATION)**

## **UNIFIED PASSWORD CREATION JOURNEY (v3.6)**

This revised specification updates the Step 6 onboarding framework to enforce a unified account protection protocol. Regardless of whether a brand authenticates its identity via **Path A (Work Email & OTP)** or **Path B (Google Sign-In OAuth)**, both verification loops now converge on the exact same **Password Security Configuration Screen**. This ensures every workspace creates a local security profile before gaining access to the platform.

## **1\. Unified Security Pipeline Architecture**

The state machine branches during the initial identity check but locks into a singular sequence for workspace encryption and final deployment.

*                  ┌──\> \[Path A: Email Entry\] ──\> \[OTP Validation\] ────┐  
*                   │                                                   ├──\> \[Password Creation\] ──\> \[Phase 4: Workspace Unlock\]  
* \[Phase 0: Choice\]─┤                                                   │  
*                   │                                                   │  
*                   └──\> \[Path B: Google OAuth\] ──\> \[Domain Match Gate\]─┘

* **Identity Phase (Verification Choice):** The user chooses between manual corporate email parsing or identity verification via Google OAuth.  
* **Security Phase (Unified Password Gate):** Once identity ownership is established, both paths route directly to the password creation screen. The right column data sneak peek remains hidden under a 12px blur filter until a valid password string is hashed and written to the database.

## **2\. Updated Use Case Matrix**

### **UC-01: Path A – Standard Email & OTP Validation Success**

* **User Action:** The user selects the email verification path, inputs an official work email (e.g., admin@evara.in) matching their registered root domain (evara.in), and requests an OTP.  
* **System Action:** The UI renders a skeleton loading layer. The backend generates a token record in the VerificationCode table and sends the code. The client shifts to the OTP entry screen.  
* **Transition:** The user enters the correct 6-digit numerical token. The interface displays an 800ms success indicator before routing the user to the unified password configuration view.

### **UC-02: Path B – Google Sign-In Identity Route (UPDATED)**

* **User Action:** The user clicks the "Verify with Google" option inside the initial action panel.  
* **System Action:** The interface opens a secure Google OAuth popup component. The user signs in using their corporate Google Workspace account (e.g., growth@evara.in).  
* **Evaluation:** The server processes the OAuth profile token, extracts the email address, and checks it against the domain extraction utility (normalizeBrandDomain).  
* **Transition:** The system confirms the domain matches the website from Step 1 (evara.in). Instead of bypassing setup, **the UI advances directly to the password creation screen**, carrying over the verified email context.

### **UC-03: Asynchronous Reward Zone Hydration (Sneak Peek)**

* **User Action:** The user navigates through the early validation steps.  
* **System Action:** The right-hand column (Midnight Black \#061F23) pulls variables collected during prior steps (e.g., Brand Name, Competitor 1, Competitor 2).  
* **Execution:** The engine runs a cross-fade transition every 5 seconds across 3 preview dashboards. **Crucial Protocol Rule:** The content metrics must remain obscured beneath a backdrop-filter: blur(12px) overlay across *both* identity verification and password configuration states.

### **UC-04: Mandatory Workspace Encryption (Unified Password Entry)**

* **User Action:** The user arrives at the password creation screen after clearing either the OTP or Google identity verification loops.  
* **System Action:** The form evaluates input text string properties against length ($\\text{length} \\ge 8$) and blank whitespace constraints.  
* **Completion:** The user submits a valid password. The server hashes the string, updates the accountPasswordHash column inside the BrandProfile table, changes is\_verified to TRUE, and removes the 12px right column blur overlay.

## **3\. Advanced Edge Cases & State Matrix**

* **EC-01: Public Domain / Provider Intercept Bypass (Dual-Path Enforced):**  
  * *Path A:* The user enters a public consumer address (e.g., evarabrand@gmail.com). The EmailEntrySchema blocks the submission and displays an inline warning.  
  * *Path B:* The user authenticates using a personal Google account (@gmail.com). The OAuth wrapper intercepts the payload, halts the progression, and alerts the user: *"Public consumer accounts cannot be used for brand verification. Please sign in with your official corporate Google Workspace account."*  
* **EC-02: Google OAuth Domain Mismatch Intercept:** The user signs into an authenticated corporate Google profile that does not match their registered brand website domain (e.g., logging into user@not-evara.com when the registered site is evara.in). The system catches the mismatch, halts progression, and displays an inline warning: *"The authenticated Google account (@not-evara.com) does not match your registered brand website domain (evara.in). Please sign in with the correct workspace account."*  
* **EC-03: Google OAuth Window Cancellation Recovery:** The user opens the Google Sign-In window but closes it prematurely or has a browser extension that blocks popups. The application catches the exception, clears the loading masks, and displays: *"Authentication cancelled. Please click again to retry or verify using your work email instead."*  
* **EC-04: Password Space Suffix Circumvention Gate (Unified):** The user attempts to bypass password generation by entering only empty spaces ( ). The validation schema applies a .trim() step before counting string length, rejecting the request with the following error copy: *"❌ Passwords cannot consist entirely of blank spaces. Please enter at least 8 visible characters."*  
* **EC-05: Sub-8 Character Password Rejection (Unified):** The user types a short password string into the security setup field and clicks submit. The input box border shifts to Ruby Red (\#CA0F1C) and displays the error message: *"❌ Password must be at least 8 characters long."*  
* **EC-06: Middle-Tier Network Disconnection Recovery (Unified):** A network dropout occurs after identity verification is complete, right as the user submits their new password. The client architecture catches the exception and retains the verified identity status in local state so the user does not have to repeat the OTP or Google OAuth check. The UI displays: *"We couldn't save your password due to a connection drop. Don't worry, your email is verified. Please click submit again."*  
* **EC-07: OTP Guessing Exhaustion Lockout (Path A Specific):** The user inputs an incorrect 6-digit code three times. The UI transitions to the LOCKED state, disabling the entry fields and prompting the user to generate a new verification code.  
* **EC-08: Responsive Viewport Pruning Layout Threshold:** The display viewport drops below the 768px responsive breakpoint. The system completely unmounts the right column preview pane. The left column scales to 100% and the primary button snaps into a sticky footer with an expanded 32px touch target, a rule that remains active during the password creation step.

## **4\. Downstream System Actions & Data Mutations**

When verification criteria are fulfilled via either journey branch, the database executes clean mutations to authorize environment access.

| Journey Stage | Origin Route | Target Database Action | Operational & Downstream Impact |
| :---- | :---- | :---- | :---- |
| **Email Submission Passed** | Path A (Manual) | Inserts record into VerificationCode table with expiresAt set to 10 minutes. | Dispatches an asynchronous transactional mail delivery payload. |
| **Identity Confirmed (OTP Match)** | Path A (Manual) | Validates code token against the database. Caches identity confirmation signature in local client state. | Transitions the left-pane view to the PASSWORD\_CREATION state. Right column blur remains active. |
| **Identity Confirmed (OAuth Match)** | Path B (Google) | Extracts email from OAuth token and processes it through the domain extraction utility. Caches signature. | Transitions the left-pane view to the PASSWORD\_CREATION state. Right column blur remains active. |
| **Account Password Creation Submitted** | Unified (Path A & B) | Hashes plaintext entry via server-side encryption. Updates BrandProfile: sets accountPasswordHash, is\_verified \= TRUE, and verified\_at \= now(). | Changes deep\_intel\_status from PENDING to PROCESSING. Fades out the right column 12px blur and initiates deep intelligence data builds. |
| **Compliance Enforcer** | Unified System Wrapper | Layout check: Verifies that the mandatory product footprint disclaimer is permanently visible. | The string "AI can make mistakes. Verify the results." remains fixed at the baseline of the left action card across all states. |

**Implementation Directive:** All layout shells must use core structural design primitives (\<Box\> containers configured with \--radius-card-standard boundaries and custom light gray line dividers) rather than generic pre-packaged elevations. This maintains strict compliance with the Aurora Design System v4.1 design directives.

* 

# UI Copy

# **MASTER PRODUCTION UI COPY MATRIX: STEP 6 (BRAND VERIFICATION)**

## **MULTI-PHASE DUAL-PATH STATE ENGINE (v3.6)**

This updated master copy specification outlines all user-facing strings, dynamic token variations, and error tracking exceptions for the updated Step 6 sequential workflow. The Left Column (Action Zone) serves as a dynamic state container that switches layout modes automatically based on whether the user selects **Path A (Manual Work Email & OTP)** or **Path B (Google OAuth)**, converging ultimately on a **Unified Password Security Gate** before clearing the workspace unlock routine.

## **PANE 1: THE ACTION ZONE (LEFT COLUMN)**

### **State 1: Dual-Path Entry Baseline (**VERIFICATION\_BASELINE**)**

The default structural layout when a user arrives at Step 6\. Offers immediate branching paths.

* **Headline:** Verify you own this brand  
* **Subline:** To protect brands on our platform, we verify that you're associated with the website you entered. Choose how you want to verify your domain.  
* **\--- PATH A: MANUAL WORK EMAIL CARD \---**  
  * **Input Field Label:** Work Email  
  * **Dynamic Placeholder Text:** you@\[brandDomain\] *(e.g.,* you@evara.in*—extracted from the storefront URL captured during Step 1\)*.  
  * **Contextual Helper Text:** 💡 Your email domain must match your website domain (\[brandDomain\]).  
  * **Primary CTA Button:** Send OTP →  
* **\--- PATH B: FEDERATED IDENTITY DIVIDER \---**  
  * **Divider Text:** — OR —  
* **\--- PATH B: FEDERATED IDENTITY CARD \---**  
  * **OAuth CTA Button Icon Component:** \[Google Marketplace G-Suite Logo\]  
  * **OAuth CTA Button String:** Verify with Google

### **State 1A: Email Domain Mismatch Rejections (Path A Errors)**

Triggers inline on the email entry screen if structural validation logic fails.

* **Input Field Component Styling:** Border transitions to a high-visibility Ruby Red (\#CA0F1C) outline.  
* **Dynamic Rejection Alert Copy:**  
  * *Option A (Domain Suffix Mismatch):* ❌ The email domain (\[@wrongdomain.com\]) doesn't match your website (\[brandDomain\]). Please use your official work email, or go back and re-enter your website.  
  * *Option B (Public Email Provider Block):* ❌ Public email providers are not permitted for brand verification. Please use your official @\[brandDomain\] email.  
* **Primary CTA Button:** Send OTP → *(Remains active to allow easy inline corrections)*.

### **State 1B: Google OAuth Failures (Path B Errors) — *NEW***

*Triggers inline on the baseline view if federated signature parameters violate domain checking rules.*

* **Dynamic OAuth Alert Copy:**  
  * *Option A (Google Domain Mismatch):* ❌ The authenticated Google account (@not-evara.com) does not match your registered brand website domain (evara.in). Please sign in with the correct workspace account.  
  * *Option B (Google Consumer Block):* ❌ Public consumer accounts cannot be used for brand verification. Please sign in with your official corporate Google Workspace account.  
  * *Option C (Popup Blocked/Cancelled):* ⚠️ Authentication cancelled. Please click again to retry or verify using your work email instead.

### **State 2: OTP Verification Grid (Path A Step 2\)**

Mounts instantly after a valid corporate handle passes initial validation gates and initiates backend token generation.

* **Headline:** Enter the 6-digit code  
* **Dynamic Subline:** We sent a code to \[user\_submitted\_email\]. It expires in 10 minutes.  
* **Interactive Input Element:** *\[ Renders 6 individual numeric input digit boxes with centered text styling \]*.  
* **Footer Navigation Link Block:** Didn't receive it? Check your spam folder, or Resend code  
* **Primary CTA Button:** Verify Identity → *(Disabled by default; updates to active style when the 6th character frame is complete)*.

### **State 3: Unified Identity Verification Success (**IDENTITY\_SUCCESS**) — *UPDATED***

Fires instantly for 800ms upon successfully validating a 6-digit OTP token OR receiving a valid Google Workspace OAuth signature, providing a confirmation step before shifting to workspace password configuration.

* **Headline:** Identity Verified\!  
* **Dynamic Subline:** Domain security match confirmed via \[OTP Code Validation / Google Secure Token\]. Loading workspace encryption layer...  
* **Interactive Input Element:** If originating from Path A, all 6 digit frames transition into a solid checked Green container layout path. If originating from Path B, a full-height centered green success animation renders.

### **State 4: Unified Password Security Configuration (**PASSWORD\_CREATION**)**

Mounts automatically following the identity success transition state for BOTH Path A and Path B journeys. The Right Reward Zone remains fully blurred to incentivize this final step.

* **Headline:** Secure your workspace  
* **Subline:** Your brand ownership is verified\! Create a strong local password to secure your personalized market insights database.  
* **Input Field Label:** New Password  
* **Input Field Placeholder Text:** ••••••••••••  
* **Contextual Helper Text:** 💡 Password must be at least 8 characters long.  
* **Primary CTA Button:** Create Account & Unlock →

### **State 5: Token Expiration Loop (Path A Recovery)**

Renders if the user submits a verification code after the 10-minute validity window has passed.

* **Headline:** Verification Code Expired  
* **Subline:** For security purposes, verification codes are only valid for 10 minutes.  
* **Inline Warning Message (Ruby Red** \#CA0F1C**):** This code has expired. Please request a new token.  
* **CTA Recovery Pivot:** The footer link string Resend code flashes with a continuous pulse animation to focus attention.

### **State 6: Brute-Force Rejection Lockout (**LOCKED**)**

Triggers immediately when the system detects 3 failed verification code entry attempts.

* **Headline:** Verification Attempts Exhausted  
* **Subline:** You have entered an incorrect code 3 times. This verification session has been securely locked.  
* **Actionable Helper Text:** Please click below to request a brand new verification code.  
* **Primary CTA Button:** Generate New OTP Code

### **State 7: Infrastructure Failure / Timeout Gate (**TIMEOUT**)**

Displays if network connectivity drops or the transactional framework fails.

* **Headline:** Connection Error  
* **Subline:** We’re having trouble connecting to our verification servers right now.  
* **Inline Warning Message (Ruby Red** \#CA0F1C**):** We were unable to process your request. Please check your internet connection and try again.  
* **Primary CTA Button:** Retry Action

## **🚨 SYSTEM MICROCOPY CRASH SHEET**

These targeted error string tags must be linked directly to client-side code parsing scripts and form submission controllers.

| System Context Code | Dynamic Context UI Alert Text | Component Presentation/Behavior |
| :---- | :---- | :---- |
| **Email Input Syntax Failure** | Please enter a valid email address (e.g., name@brand.in) | Renders inline below input box. |
| **Domain Suffix Mismatch** | The email domain (\[input\_domain\]) doesn't match your website (\[brand\_domain\]). Please use your work email, or go back and re-enter your website. | Triggers state EMAIL\_DOMAIN\_MISMATCH and updates input frames to red. |
| **Public Provider Intercept** | Public email providers are not permitted for brand verification. Please use your official @\[brand\_domain\] email. | Disables form progression and displays text in Ruby Red (\#CA0F1C). |
| **Google Domain Mismatch** | ❌ The authenticated Google account (@not-evara.com) does not match your registered brand website domain (evara.in). Please sign in with the correct workspace account. | Aborts OAuth parsing sequence; prints error below the Google OAuth CTA button structure. |
| **Google Consumer Block** | ❌ Public consumer accounts cannot be used for brand verification. Please sign in with your official corporate Google Workspace account. | Blocks consumer profile execution loops; flags button framework in warning layout state. |
| **OAuth Window Drop** | ⚠️ Authentication cancelled. Please click again to retry or verify using your work email instead. | Removes active loading masks from interface layout; returns buttons to active interactive states. |
| **Generation Rate Limit** | Too many attempts. Please wait 58 seconds before requesting another code. | Disables CTA button; renders text in Gray-500 (\#6B7280). |
| **Incremental OTP Mismatch** | Incorrect code. \[remaining\_attempts\] attempts remaining. | Appends below the active 6-box input elements; tints input background to \#FFF6F6. |
| **Password Length Failure** | ❌ Password must be at least 8 characters long. | Renders inline below password field; highlights input frame in Ruby Red. |
| **Password Whitespace Failure** | ❌ Passwords cannot consist entirely of blank spaces. Please enter at least 8 visible characters. | Blocks empty inputs; resets input focus layout. |
| **Password Network Drop Recovery** | We couldn't save your password due to a connection drop. Don't worry, your email is verified. Please click submit again. | Renders below text fields; retains verified identity locally; updates primary CTA to Retry Account Creation. |

## **PANE 2: THE SNEAK PEEK (REWARD ZONE \- RIGHT COLUMN)**

Features an immersive Midnight Black (\#061F23) background container. All strategy visual structures are locked beneath a tight backdrop-filter: blur(12px) mask until a valid password configuration writes successfully to the database layer across BOTH Path A and Path B verification journeys.

### **Persistent Design Shell Elements**

* **Floating Status Label Badge:** PHASE 2 PREVIEW  
* **Main Section Header Title:** Competitive Gap Analysis  
* **Sub-Header Description Label:** Real-time market intel comparison  
* **Dynamic Data Context Summary Banner:** We've mapped \[Brand Name\] against \[Competitor 1\] and \[Competitor 2\]. Verify your domain to see the gap analysis. *(Hydrated using variables collected from previous onboarding steps)*.  
* **System Processing Checklist Module:**  
  * \[Checkmark\] Surface Scan: Complete  
  * \[Checkmark\] Brand Identity: Curated  
  * \[Loading Spinner\] Deep Strategy: Ready to Unlock

### **Automated View Rotations**

* **Slide View 1 (Competitive Gap Analysis Chart):** Shows a blurred data graphic mapping metrics for \[competitor\_brand\] against You (Target).  
* **Slide View 2 (Campaign Strategy Matrix):** Renders locked filters showing high-growth keyword targets such as Sustainability and Next-Gen UX.  
* **Slide View 3 (AI Influencer Match Review Profile):** Displays a hidden creator recommendation thumbnail card detailing hidden target match rates and text logic loops.

## **⚠️ MANDATORY COMPLIANCE & LAYOUT RULES**

### **1\. Persistent Product Footprint Disclaimer**

To satisfy platform text compliance requirements, this exact string must remain permanently visible at the baseline of the left action card across all operational verification states:  
"AI can make mistakes. Verify the results."

### **2\. Mobile Responsive Layout Pruning Rules (\< 768px Breakpoint)**

* **Layout Modification:** Completely unmount the Right Pane (Reward Zone) from the rendering tree to minimize layout calculation weights on mobile devices.  
* **Action Card Scaling:** Scale the left container width to 100%, strip custom drop shadows, and implement simple thin border line structures.  
* **Touch Optimization Targets:** Convert the primary confirmation actions (including the newly unified Password Creation screens) into a fixed, sticky bottom footer asset row featuring an expanded touch container parameters layout measuring a minimum baseline value of 32px.  
* 

# Zod update

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

# Backend update

// \============================================================================  
// UPGRADED BRANDPROFILE MODEL (v3.6 Unified Core)  
// \============================================================================  
model BrandProfile {  
  id                     String             @id @default(cuid())  
  // ... existing core fields (domain, industry, logo\_url)

  // \--- BRAND VERIFICATION & DATA SECURITY (v3.6) \---  
  is\_verified            Boolean            @default(false)  
  verified\_at            DateTime?  
  verification\_email     String?            // Stores the validated email from either OTP or Google OAuth  
    
  // NEW SECURITY COLUMN: Populated across BOTH paths (OTP & Google Sign-In)   
  // during the final workspace password creation gate.  
  accountPasswordHash    String?

  // Relation to Phase 2 data (Locked until is\_verified is true)  
  deep\_intel\_status      IntelStatus        @default(PENDING)

  // FLUID PROGRESS CHECKS: Drives individual UI checklist components dynamically  
  surface\_scan\_complete  Boolean            @default(false) // Drives "\[Checkmark\] Surface Scan"  
  brand\_identity\_curated Boolean            @default(false) // Drives "\[Checkmark\] Brand Identity"\[cite: 5\]

  // \--- SOCIAL CONNECTIONS & SYNC EXTENSIONS \---  
  meta\_connected         Boolean            @default(false)\[cite: 8\]  
  meta\_access\_token      String?            // Encrypted at rest\[cite: 8\]  
  meta\_page\_id           String?\[cite: 8\]  
  meta\_business\_id       String?\[cite: 8\]

  // \--- RELATION PLUMBING \---  
  verification\_codes     VerificationCode\[\] // Prevents orphaned logs on account lifecycles\[cite: 5\]  
  invitations            TeamInvitation\[\]   // Links pending and active seat delegations\[cite: 8\]  
}

enum IntelStatus {  
  PENDING\[cite: 5\]  
  PROCESSING\[cite: 5\]  
  COMPLETED\[cite: 5\]  
  FAILED\[cite: 5\]  
}

// \============================================================================  
// VERIFICATIONCODE MODEL (Path A Identity Auditing)  
// \============================================================================  
model VerificationCode {  
  id                  String       @id @default(cuid())\[cite: 5\]  
  brand\_id            String\[cite: 5\]  
  brand               BrandProfile @relation(fields: \[brand\_id\], references: \[id\], onDelete: Cascade)\[cite: 5\]  
    
  email               String       // Explicit column for targeted logging and audit validation\[cite: 5\]  
  code                String       // Store as a hashed value in production environment layouts\[cite: 5\]  
  expiresAt           DateTime\[cite: 5\]  
    
  // STATE COUNTERS: Decouples guessing locks from generation limits  
  failed\_attempts     Int          @default(0) // Track wrong submissions (Max 3, triggers LOCKED state)\[cite: 5\]  
  generation\_count    Int          @default(1) // Track clicks within 60 seconds (Max 3, triggers COOL-DOWN)\[cite: 5\]  
    
  createdAt           DateTime     @default(now())\[cite: 5\]

  @@index(\[brand\_id, email\])\[cite: 5\]  
}

// \============================================================================  
// ORIGINAL TEAM INVITATION MODEL   
// \============================================================================  
model TeamInvitation {  
  id          String       @id @default(cuid())\[cite: 8\]  
  email       String\[cite: 8\]  
  role        String       @default("ADMIN")\[cite: 8\]  
  status      String       @default("PENDING") // PENDING, ACCEPTED, EXPIRED\[cite: 8\]  
  brandId     String\[cite: 8\]  
  brand       BrandProfile @relation(fields: \[brandId\], references: \[id\])\[cite: 8\]  
  token       String       @unique // Secure invite link\[cite: 8\]  
  createdAt   DateTime     @default(now())\[cite: 8\]  
  expiresAt   DateTime\[cite: 8\]  
}

# Developer document

# **TECHNICAL DEVELOPER RUNBOOK: STEP 6 INTEGRATION FLOW (v3.6)**

## **DUAL-PATH IDENTITY VERIFICATION & UNIFIED PASSWORD LAYOUT ENGINE**

This comprehensive developer runbook defines the procedural full-stack integration sequence required to implement the updated Step 6 onboarding engine. Follow this absolute engineering sequence to coordinate the branching dual-path identity framework (**Path A: Manual Work Email & OTP** or **Path B: Federated Google OAuth**) and converge them on the mandatory **Unified Password Security Gate**.

## **IMPLEMENTATION STEPS**

### **Step 1: Database Migration & Schema Baseline**

* Execute the database structural modifications script to extend the BrandProfile table with is\_verified, verified\_at, verification\_email, and fluid progress flags (surface\_scan\_complete, brand\_identity\_curated).  
* Extend the database structure to include the nullable accountPasswordHash column inside the BrandProfile model to securely store plaintext-to-cryptographic account keys.  
* Retain the legacy social synchronization columns (meta\_connected, meta\_access\_token, meta\_page\_id, meta\_business\_id) and the relational TeamInvitation records architecture within the baseline schema layout.  
* Provision the VerificationCode table with decoupled state trackers (failed\_attempts and generation\_count) to split brute-force protection hooks from resend limits.  
* Apply a composite database index on \[brand\_id, email\] inside the VerificationCode table to guarantee execution performance lookups under the 300ms platform threshold.

### **Step 2: Input Pre-Processing & Domain Normalization Layer**

* Implement the normalizeBrandDomain formatting logic inside the client field controller wrapper.  
* Configure the regex pattern matching engine to programmatically strip protocols (http://, https://) and common subdomain anchors (www., shop., app.) from the Step 1 storefront website variable.  
* Cache this clean string instance to serve as the dynamic domain boundary match template (e.g., transforming \[https://www.evara.in/store\](https://www.evara.in/store) down to evara.in).

### **Step 3: Zod Structural Parsing Gates & Security Filters**

* Bind the optimized EmailEntrySchema factory function to the manual email form submission hook.  
* Intercept manual and OAuth payload validation routines using the BANNED\_PUBLIC\_PROVIDERS array check to stop public consumer relays (gmail.com, yahoo.com, etc.) before completing downstream token loops.  
* Apply the numeric-only regex pattern (/^\[0-9\]+$/) across the 6 standalone digit blocks inside OTPSchema to prevent text character injections.  
* Bind the GoogleOAuthEmailSchema factory logic to the backend OAuth token handler to screen returned profile payloads for domain alignment.  
* Enforce PasswordCreationSchema parameters ($\\text{length} \\ge 8$) across both execution branches, utilizing a .trim() pre-filter processing block to prevent empty character space string submissions.

### **Step 4: UI Phase Router & State Switch Assembly**

* Wire up the left-pane frontend layout controller to render the active application card layout corresponding to the verificationState returned by the state engine:  
  * EMAIL\_ENTRY: Display default choice fields, manual inputs, dynamic placeholders (you@brand.in), and OAuth entry triggers.  
  * EMAIL\_DOMAIN\_MISMATCH / GOOGLE\_AUTH\_ERROR: Apply a high-contrast Ruby Red (\#CA0F1C) input frame and parse dynamic string variables to construct custom multi-variable mismatch message headers.  
  * OTP\_ENTRY: Mount the 6-digit numeric input layout box array and register the automatic submission hook on the 6th character frame.  
  * OTP\_SUCCESS: Mount the 800ms green validation confirmation container block before auto-routing the user to the security setup step.  
  * PASSWORD\_CREATION: Mount the password entry layout view, evaluate input string compliance properties, and surface interactive validation warnings.  
  * TIMEOUT / EXPIRED: Trigger the inline warning components and apply a continuous pulse animation loop onto the recovery link.  
  * LOCKED: Disable the text input grid block completely and remap the primary button to point to the generation route.

### **Step 5: Asynchronous Reward Pane Hydration (Sneak Peek)**

* Build a dynamic payload aggregator within the right-pane layout container (Midnight Black \#061F23).  
* Extract the brand strings collected from earlier steps (Brand Name, Competitor 1, Competitor 2) and map them directly into the sub-header presentation text.  
* Configure a 5-second interval loop utility to cross-fade between the 3 custom mock visual states (Competitive Gap, Campaign Archetype, and AI Influencer Match).  
* Inject the backdrop-filter: blur(12px) layer class across the charts to obscure text and raw metrics.  
* **Crucial Protocol Rule:** This structural blur mask must remain fully applied across *both* the identity phase (OTP/OAuth) and the password configuration step. It cannot be dropped until the password string successfully commits to the database layer.

### **Step 6: Path-Specific Identity Evaluation & Resolution Gates**

* Route the onboarding user through their elected identity verification pathway:  
  * **Branch A (Manual OTP):** Attach an evaluation transaction to the backend entry controller. Increment failed\_attempts by 1 for incorrect entries, triggering the Light Pink (\#FFF6F6) box background with Red text (\#CA0F1C). When failed\_attempts \>= 3, lock the session state. If now() \> expiresAt, route to the EXPIRED layout. If successful, fire OTP\_SUCCESS and transition the view after 800ms.  
  * **Branch B (Google OAuth):** Initialize the secure Google login popup. Process the callback token return payload through GoogleOAuthEmailSchema. If the profile utilizes a blacklisted provider or references a mismatched company domain, halt execution and display the respective inline warning label. If valid, cache the verification signature and bypass the OTP grid to route straight to the password setup window.

### **Step 7: Account Password Security Setup & Activation Dispatch**

* Upon submission of the unified password creation form, route the plaintext payload to the backend configuration endpoint.  
* **Validation Rejection Routing:** If validation filters fail due to short string profiles or explicit blank spacing constraints, block submission, highlight input borders in Ruby Red (\#CA0F1C), and render the failure copy.  
* **Network Drop Recovery Logic:** Map an exception intercept inside the API submit handler. If connection failures drop communication mid-request, retain the verified identity context signature in local memory so the user avoids repeating the OTP or OAuth steps. Update the UI messaging to reflect recovery status and transform the primary action label into Retry Account Creation.  
* **Successful Account Activation:** Encrypt the plaintext password string using a secure backend hashing algorithm (e.g., bcrypt or argon2) and write the output string directly into the accountPasswordHash column. Flip database flags to is\_verified: true and record the current execution timestamp under verified\_at.  
* **Downstream Release:** Fade out the 12px right-pane backdrop blur overlay using a smooth CSS transition to expose the un-blurred intel results. Mutate the backend tracking status enum deep\_intel\_status from PENDING to PROCESSING and fire the Asynchronous Deep Scan Queue Worker to initialize final environment data builds.

### **Step 8: Responsive Layout Breakpoint Pruning**

* Add a media condition listener tracking the 768px layout width threshold inside the root layout wrapper.  
* If the responsive screen viewport drops below 768px, unmount the entire right-pane Sneak Peak module from the application view to decrease mobile processing weight.  
* Scale the Action Zone card container width to 100%, strip custom dashboard drop shadows, and map the primary verification button into a sticky layout bar featuring an expanded 32px touch target framework. Maintain this layout optimization across both the identity verification views and the password creation setup screens.

## **💻 INTEGRATION VERIFICATION CHECKLIST FOR QA**

* \[ \] Validate that arriving users see both manual email entry fields and the Google OAuth CTA.  
* \[ \] Input 'brandname@gmail.com' into Path A and verify the public provider block intercepts it.  
* \[ \] Authenticate a generic consumer account in Path B and verify the OAuth block catches it.  
* \[ \] Complete Path A OTP validation and ensure it takes exactly 800ms before showing password entry.  
* \[ \] Complete Path B OAuth verification and ensure it shifts directly to password entry.  
* \[ \] Verify that the right column 'Sneak Peak' remains blurred @ 12px throughout the password entry screen.  
* \[ \] Enter 8 blank spaces in the password field and verify the trim validation gate triggers an error.  
* \[ \] Simulate a connection dropout on password submit and verify that email validation state is preserved.  
* \[ \] Verify the compliance string "AI can make mistakes. Verify the results." is permanently visible.  
* \[ \] Drop the viewport below 768px and verify that the reward zone completely unmounts from the DOM tree.

* 

# Stitch changes

![][image1]

**Changes on the verifications screen:**

## **1\. Left Pane (Action Zone) Layout Updates**

### **🔄 Text & Field Variable Upgrades**

* **Sub-Header Text Update:** Change the sub-paragraph text below "Verify you own this brand" to explicitly call out the dual choice layout:  
   *“To protect brands on our platform, we verify that you're associated with the website you entered. Choose how you want to verify your domain.”*

* **Dynamic Input Placeholder:** Replace the static name@company.com placeholder text. Wire it to your storefront context state to render dynamically as you@\[brandDomain\] (e.g., you@evara.in).  
* **Contextual Helper Microcopy:** Inject an inline microcopy string component right below the email input block:  
   *“💡 Your email domain must match your website domain (\[brandDomain\]).”*

### **➕ New UI Elements to Add**

* **The Divider:** Below the primary green Send OTP button asset container, add a visual structural section divider displaying text color centered: — OR —.  
* **Google OAuth Action Button:** Below the divider, mount a secondary federated button component styled to company design standards containing the Google logo icon asset and the button text label: Verify with Google.

**New Create Password screen**

### **1\. Left Pane (New Card State: PASSWORD\_CREATION)**

* **Card Framework:** A centered white card matching the onboarding design system, configured to mount after email/OAuth success.  
* **Header Typography:**  
  * Headline: Secure your workspace

  * Subline: Your brand ownership is verified\! Create a strong local password to secure your personalized market insights database.

* **Input Component:** A standard text entry box with hidden password masking (••••••••••••). Include a togglable trailing **eye icon button** on the far right inner edge for visibility toggle.  
* **Helper Microcopy:** Small muted gray text below the field: 💡 Password must be at least 8 characters long.

* **Primary CTA Button:** A solid Aurora Green button containing the string: Create Account & Unlock →.  
* **Compliance Footer:** Persistent standard text layer fixed to the bottom margin of the card layout: "AI can make mistakes. Verify the results."

### **2\. Left Card Component Variants (Error Handling)**

* **Variant A (Default):** Input box features a standard flat light-silver outline border.  
* **Variant B (Validation Failure):** Input box borders shift to **Ruby Red (\#CA0F1C)**. Injects an inline red error text asset directly underneath: ❌ Password must be at least 8 characters long.  
* **Variant C (Network Drop Recovery):** Injects a high-visibility error block inside the card: We couldn't save your password due to a connection drop. Don't worry, your email is verified. Please click submit again. Updates the green button label to: Retry Account Creation.

# Social Sync

# Use cases & Edge cases

These architectural refinements create a highly secure, single-purpose workflow. Moving the handle finalization upstream completely eliminates input errors on this screen, and treating the invited team member as a temporary administrative agent—rather than forcing them into a permanent user account—greatly reduces database clutter and protects workspace privacy.  
By introducing a dedicated invitation tracking layer and an OTP security wall, you ensure that only the intended recipient can execute this high-privilege API handshake.

## **📋 Master Blueprint: Updated Step 8 Use Cases & Edge Cases**

### **I. Comprehensive Functional Use Cases**

#### **1\. Immutable Target Awareness & Connection (Primary Flow)**

* **Context:** The brand owner has already finalized their handle upstream. They arrive at Step 8 purely to execute the technical handshake.  
* **UI Presentation:** The left panel prominently displays the finalized brand handle as a locked, read-only awareness block (*"System Target Account: @\[finalized\_handle\]"*). There are no entry fields, edit links, or correction dropdowns.  
* **User Action:** Clicks the unified primary CTA **"Connect Instagram Profile"**.  
* **System Action:** Launches the Meta OAuth pop-up requesting instagram\_basic and instagram\_manage\_insights Graph API permissions. Upon successful callback, it verifies that the returned handle perfectly matches the pre-finalized anchor, encrypts the access token at rest, sets meta\_connected \= true, and unlocks the primary workspace dashboard.

#### **2\. Specialized Workspace Invitation (Dedicated Backend Layer)**

* **Context:** The onboarding brand owner lacks the credentials for the company's Instagram professional profile and needs a team member to complete it.  
* **User Action:** Enters the colleague’s email address into the *"Invite Team Member"* section and clicks send.  
* **System Action:** Validates basic email syntax via Zod. Instead of creating a core user account, the system writes a record to a isolated InstagramSyncInvitation tracking table. This table generates a secure verification token and triggers a transaction email containing an authorization link.

#### **3\. Invited User Secure OTP Verification Gate**

* **Context:** The invited team member clicks the authorization link from their email client.  
* **Pre-Flight Router Redirect:** The system blocks them from seeing the social sync screen immediately, routing them to a clean **Identity Verification Page**.  
* **System Action:** Automatically dispatches a short-lived One-Time Password (OTP) to the invitee's email inbox.  
* **User Action:** The invitee inputs the OTP code and hits \[Verify Identity\].  
* **Result:** Once validated, the system unlocks the session router and routes them straight to the Step 8 Social Sync layout page.

#### **4\. Isolated Journey Termination (The Temporary Agent Path)**

* **Context:** The verified invited user lands on the Step 8 page post-OTP verification.  
* **UI Customization:** They are presented with the awareness layout showing the finalized handle. They do not see main app navigation, billing menus, or core onboarding steps.  
* **Execution & Termination:** The invitee clicks **"Connect Instagram Profile"** and completes the OAuth process. The moment the API returns a successful token, the system updates the main BrandProfile tracking column, invalidates the invitation token in the InstagramSyncInvitation table, closes the active session, and renders a clean task-complete screen: *"Thank you. The Instagram connection for \[Brand Name\] has been successfully securely established. You may now close this window."*

#### **5\. Deferral Path (Primary Owner Only)**

* **Context:** The primary account creator decides to postpone connecting their profile infrastructure.  
* **User Action:** Clicks the subtle *"Skip for now"* link at the bottom of the interface panel.  
* **System Action:** Displays the standard confirmation warning modal outlining optimization impacts. If approved, sets social\_sync\_skipped \= true and advances them to the active client workspace dashboard.

### **II. Critical Edge Cases**

#### **1\. OTP Code Expiration or Entry Failure**

* **Scenario:** The invited user clicks the email link but types the wrong OTP code, or waits past the 10-minute expiration threshold before entering it.  
* **System Action:** The verification gate blocks progression to the social sync screen. The UI displays an error:  
* ❌ Invalid or Expired Code: For security reasons, verification codes expire after 10 minutes. Please click below to generate a new secure OTP.  
* **Result:** The user is held at the verification wall until a valid code is matched against the database token session.

#### **2\. Target Handle Mismatch Hard Lock**

* **Scenario:** The pre-finalized brand handle is anchored as @AlphaShoe. The invited user completes the OTP gate, hits the Instagram OAuth button, but accidentally logs into an unaligned account they manage, such as @BetaFitness.  
* **System Action:** The backend verification node catches the string discrepancy. Because handle modifications are completely disabled on this screen, the system freezes execution, halts the onboarding wizard, and outputs an explicit error:  
* ❌ Connection Failed: The authenticated Instagram account (@BetaFitness) does not match the finalized brand handle (@AlphaShoe). Please sign out of Instagram in this browser and log into the correct profile.

#### **3\. Post-Termination Link Reuse Attempt**

* **Scenario:** The invited user successfully syncs the profile, closes the browser, and later attempts to click the original email invitation link or reload the Step 8 URL.  
* **System Action:** The incoming request hits the InstagramSyncInvitation validator. Because the token status was toggled to COMPLETED during their initial exit loop, the backend router denies access, completely blocking visibility of the social sync screen and rendering a notification: *“Link Expired: This integration task has already been completed. If you need to make changes, please contact the primary brand manager.”*

#### **4\. Account Type Rejection (Personal Profile Error)**

* **Scenario:** The user attempts to execute the handshake using a Personal Instagram account rather than a Creator or Business account.  
* **System Action:** The Meta Graph API fails to provide valid insights tokens. The platform preserves the user view state and surfaces a troubleshooting alert: *“Connection Rejected: The platform requires an Instagram Business or Creator account to track engagement data. Please convert your profile settings inside the Instagram app and try again.”*

Now that the invited user journey terminates cleanly at this step without generating a permanent account profile, how would you like the post-sync success screen to look for them? Should we include a way for them to notify the primary owner directly, or should the owner just receive an automated app notification?

* 

# UI Copy updated

# **UI COPY CHANGE DOCUMENT: STEP 8 SOCIAL MEDIA SYNC**

This change document outlines the user interface copy updates for **Step 8: Social Media Sync**. The revisions implement a single **Instagram Graph API connection path**, support **upstream-finalized immutable handles**, and accommodate the new **OTP security gate and isolated tracking layer** for team invitations.

## **1\. Left Pane: Action & Transparency Zone**

### **Headline & Supporting Subline**

* Before:  
  * Headline: Supercharge your Brand DNA  
  * Subline: Connect your Meta Business Manager to unlock verified performance data and the Creator Marketplace.  
* **After:**  
  * Headline: Supercharge your Brand DNA  
  * Subline: Connect your professional Instagram profile to unlock deep performance analytics and verify your ecosystem engagement metrics.

### **Pre-flight Checklist (Building Trust)**

* Before:  
  * Before the "Connect" button, show a clean list of the Permissions Meta will ask for.  
  * ✅ Insights Access: To see what's actually working on your feed.  
  * ✅ Business Discovery: To track competitor growth in real-time.  
  * ✅ Creator Marketplace: To send priority DMs that land in "Primary" inboxes.  
* **After:**  
  * Before the connection button, review the explicit data scopes handled via the Instagram Graph API:  
  * ✅ Profile Insights: To view verified reach, historical impressions, and core audience growth maps.  
  * ✅ Media Reads: To analyze performance details, specific video view data, and post save rates.

### **Primary Connection Action**

* Before:  
  * Button: Connect Meta Business Manager (Aurora Green \#34D399).  
  * Handle Check: A small indicator below: "Syncing with @\[brand\_handle\] captured in Step 1."  
* **After:**  
  * Button: Connect Instagram Profile (Aurora Green \#34D399 Fill)  
  * Handle Check Indicator (Static Text Only):  
  * 🔒 **System Target Profile: @\[finalized\_handle\]**  
  * *Note: This handle was finalized upstream. Ensure you log into this exact profile during the authentication pop-up.*

### **"Not the Account Manager?" Fallback Section**

* Before:  
  * UI: A secondary section titled "Not the Admin?"  
  * Action: An "Invite Team Member" input field.  
* **After:**  
  * UI Section Title: "Not the Instagram Account Manager?"  
  * Action Label: Enter the email address of the team member who manages your Instagram professional account credentials.  
  * Input Field Placeholder: colleague@anydomain.com *(Any domain structural format allowed)*  
  * CTA Button: Send Secure Integration Link

### **Skip Logic & Warnings**

* Before:  
  * Action: A subtle "Skip for now" link at the bottom.  
  * Warning: "Note: Skipping will limit your Creator Match accuracy and Competitor Real-time tracking."  
* **After:**  
  * Action: A subtle "Skip for now" link at the bottom.  
  * *System Action:* Triggers the confirmation warning modal layer:  
  * **Are you sure you want to skip integration?**  
  * Note: Bypassing this step will limit your real-time performance tracking and fallback to historical public engagement estimates. You can connect later via your workspace account panel.  
  * \[Proceed anyway\] | \[Back to Sync\]

## **2\. Right Pane: Value Visualization**

* Before:  
  * Visual State: The blur from Step 7 is now gone, but the data is "Static."  
  * Before (Public Data): Shows "Estimated Engagement: 2.4%".  
  * After (API Data): Shows "Verified Reach: 450k | Save Rate: 12% | Conversion: 0.8%".  
  * Narrative: A pulsing notification in the mock UI says: "Creator Marketplace Access: 5,000+ local creators identified for your DNA."  
* **After:**  
  * Visual State: Clean, focused preview screen representing the platform's performance tracking panels.  
  * Before Panel (Public Scraped Baseline): "Estimated Engagement: 2.4%"  
  * After Panel (Instagram Graph API Boost): "Verified Reach Analytics Unlocked | True Post Save Velocity | Follower Impression Mapping Activated"  
  * Narrative Status Overlay: A pulsing blue container displaying: *"Instagram API Synchronization Pipeline Active: Ready to parse private media optimization metrics."*

## **3\. New Onboarding Interceptor Screens**

The following screens manage the user journey for team members added through the isolated invitation table.

### **Screen A: Invitee Security Verification Gate (Pre-Flight Screen)**

* *Context:* The invited user clicks the unique link from their email inbox. Before accessing Step 8, they must pass this identity wall.  
* **Headline:** Verify Your Access Request  
* **Subline:** For security, we've dispatched a short-lived, 6-digit One-Time Password (OTP) to your email address. Please enter the code below to access the synchronization channel.  
* **Input Field Component:** \[ \_ \] \[ \_ \] \[ \_ \] \[ \_ \] \[ \_ \] \[ \_ \] (OTP character containers)  
* **CTA Button:** Confirm Identity & Enter Sync  
* **Error Label (Fallback state for invalid entries):** ❌ Invalid or expired code. Please verify the numbers or click \[Resend OTP\].

### **Screen B: Isolated Journey Completion Screen (Termination Point)**

* *Context:* The verified invitee successfully executes the Instagram connection handshake. The session terminates immediately, and this screen displays.  
* **Headline:** Integration Successfully Established\!  
* **Subline:** Thank you for your assistance. The secure Instagram Graph API token for **@\[finalized\_handle\]** has been successfully committed to the database profile layer.  
* **Next Steps Statement Block:** Your temporary administrative agent session is now closed. The primary account owner has been notified, and the onboarding tracking task is complete.  
* **UI Status Trigger:** The main application container closes or locks out navigation. A clear message directs the user: *“You may now safely close this browser tab.”*

## **4\. Error Injection Matrix**

| Target Code Path Trigger | Functional User Interface Output Text |
| :---- | :---- |
| **Handle Verification Mismatch** | ❌ Connection Failed: The authenticated Instagram profile handle does not match the finalized target handle (@\[finalized\_handle\]). Please clear your browser cache, log out of Instagram, and attempt the handshake using the correct account credentials. |
| **Personal Account Type Exception** | ⚠️ Account Tier Error: The Instagram Graph API requires an Instagram Business or Creator profile. Personal accounts do not provide historical analytical scopes. Please update your profile configurations inside the Instagram mobile app and click \[Retry Connection\]. |
| **Expired Link / Single-Use Check** | 🔒 Task Already Completed: This temporary invitation link has passed its usage window or was already used to establish a connection. Please contact the workspace manager if the account configuration needs to be modified. |

* 

# Zod updated

import { z } from "zod";

// \==========================================  
// 1\. ISOLATED INSTAGRAM SYNC INVITE SCHEMA  
// \==========================================  
/\*\*  
 \* Replaces the old TeamInviteSchema.  
 \* Used strictly for generating temporary administrative agent tokens   
 \* inside the isolated tracking table. Any email domain structure is permitted.  
 \*/  
export const InstagramSyncInviteSchema \= z.object({  
  email: z  
    .string()  
    .trim()  
    .min(1, { message: "Email address is required." })  
    .email("Please enter a valid email address."),  
});

// \==========================================  
// 2\. INVITEE SECURITY VERIFICATION GATE SCHEMA  
// \==========================================  
/\*\*  
 \* Enforces security constraints at the OTP validation wall  
 \* before an invited user can view the Step 8 configuration pane.  
 \*/  
export const OtpVerificationSchema \= z.object({  
  otp: z  
    .string()  
    .trim()  
    .length(6, { message: "The verification code must be exactly 6 digits." })  
    .regex(/^\\d+$/, { message: "The verification code must contain only numbers." }),  
});

// \==========================================  
// 3\. UNIFIED INSTAGRAM API SYNC SCHEMA  
// \==========================================  
/\*\*  
 \* Replaces the old MetaSyncSchema\[cite: 3\].  
 \* Enforces string matching against the immutable, upstream-finalized anchor.  
 \*/  
export const InstagramSyncSchema \= z  
  .object({  
    // The handle returned natively by the Instagram Graph API OAuth callback loop  
    instagramHandle: z  
      .string()  
      .trim()  
      .min(1, { message: "Instagram handle token is required from OAuth payload." })  
      .transform((val) \=\> val.replace(/^@/, "")),  
        
    // The immutable, read-only brand handle finalized upstream before this step  
    finalizedHandle: z  
      .string()  
      .trim()  
      .min(1, { message: "Upstream finalized target handle context is missing." })  
      .transform((val) \=\> val.replace(/^@/, "")),  
  })  
  .refine(  
    (data) \=\> data.instagramHandle.toLowerCase() \=== data.finalizedHandle.toLowerCase(),  
    {  
      message: "❌ Connection Failed: The authenticated Instagram account does not match the finalized brand handle.",  
      path: \["instagramHandle"\],  
    }  
  );

# Backend updated

model BrandProfile {  
  id                     String                      @id @default(cuid())  
  instagram\_handle       String                      @unique // Finalized upstream, immutable anchor  
  instagram\_connected    Boolean                     @default(false)  
  instagram\_access\_token String?                     // Encrypted at rest (AES-256-GCM)  
    
  // Decoupled relation managing single-purpose administrative agent paths  
  syncInvitations        InstagramSyncInvitation\[\]  
}

model InstagramSyncInvitation {  
  id            String       @id @default(cuid())  
  email         String       // Destination inbox tracker (any domain permitted)  
  status        String       @default("PENDING") // PENDING, VERIFIED, COMPLETED, EXPIRED  
  token         String       @unique // High-entropy secure link payload  
    
  // 6-Digit OTP Security Wall Parameters  
  otpCode       String?      // Hashed numeric verification challenge  
  otpExpiresAt  DateTime?    // Short-lived code threshold (10-minute window)  
    
  // Parent Association  
  brandId       String  
  brand         BrandProfile @relation(fields: \[brandId\], references: \[id\], onDelete: Cascade)  
    
  createdAt     DateTime     @default(now())  
  expiresAt     DateTime     // Links baseline lifespan (24-hour expiration)

  @@index(\[token\])  
  @@index(\[brandId\])  
}

# Developer Document

# **DEVELOPER IMPLEMENTATION DOCUMENT: STEP 8 SOCIAL MEDIA SYNC REFACTOR**

This document outlines the step-by-step developer implementation plan to transition **Step 8: Social Media Sync** into a single-purpose, cost-optimized, and secure **Instagram Graph API pipeline**. It enforces upstream-finalized immutable handles, an isolated team invitation layer, and a pre-flight One-Time Password (OTP) security gate.

## **🛠️ Phase 1: Database Migration (Prisma Schema Revisions)**

### **Step 1.1: Update** schema.prisma

Modify the data models to strip out obsolete Meta/Facebook parameters, add direct Instagram authorization states, and create the isolated invitation ecosystem.

1. Open your data access layer schema file (typically prisma/schema.prisma).  
2. Remove meta\_page\_id, meta\_business\_id, and the invitations relation array from the BrandProfile model.  
3. Add the structural modifications exactly as defined below:

Code snippet  
model BrandProfile {  
  id                     String                    @id @default(cuid())  
  instagram\_handle       String                    @unique // Enforced upstream  
  instagram\_connected    Boolean                   @default(false)  
  instagram\_access\_token String?                   // Encrypted at rest  
    
  // Decoupled relational tracking array for administrative agents  
  syncInvitations        InstagramSyncInvitation\[\]  
}

model InstagramSyncInvitation {  
  id            String       @id @default(cuid())  
  email         String       // Any domain structure permitted  
  status        String       @default("PENDING") // PENDING, VERIFIED, COMPLETED, EXPIRED  
  token         String       @unique // High-entropy secure link key  
    
  // 6-Digit OTP Security Wall Parameters  
  otpCode       String?      // Encrypted or cleartext string comparison  
  otpExpiresAt  DateTime?    // Short-lived code threshold (10-minute window)  
    
  // Relational Bridge  
  brandId       String  
  brand         BrandProfile @relation(fields: \[brandId\], references: \[id\], onDelete: Cascade)  
    
  createdAt     DateTime     @default(now())  
  expiresAt     DateTime     // Link lifespan (24-hour expiration)

  @@index(\[token\])  
  @@index(\[brandId\])  
}

### **Step 1.2: Generate and Run the Migration**

Execute the structural update query safely against your local and staging database layers.  
Bash  
npx prisma migrate dev \--name refactor\_step8\_instagram\_only\_sync  
npx prisma generate

## **🔐 Phase 2: Zod Schema Revisions (Validation Layer)**

### **Step 2.1: Update Shared Validation Declarations**

Replace your legacy token objects within your shared schemas file (e.g., src/shared/validators/socialSync.ts).  
TypeScript  
import { z } from "zod";

// 1\. Invitation Input Validator (Replaces old TeamInviteSchema\[cite: 2\])  
export const InstagramSyncInviteSchema \= z.object({  
  email: z  
    .string()  
    .trim()  
    .min(1, { message: "Email address is required." })  
    .email("Please enter a valid email address."),  
});

// 2\. Pre-Flight OTP Verification Gate Validator  
export const OtpVerificationSchema \= z.object({  
  otp: z  
    .string()  
    .trim()  
    .length(6, { message: "The verification code must be exactly 6 digits." })  
    .regex(/^\\d+$/, { message: "The verification code must contain only numbers." }),  
});

// 3\. OAuth Payload Validator (Replaces old MetaSyncSchema\[cite: 2\])  
export const InstagramSyncSchema \= z  
  .object({  
    instagramHandle: z  
      .string()  
      .trim()  
      .min(1, { message: "Instagram handle token is missing from OAuth payload." })  
      .transform((val) \=\> val.replace(/^@/, "")),  
    finalizedHandle: z  
      .string()  
      .trim()  
      .min(1, { message: "Upstream finalized target handle context is missing." })  
      .transform((val) \=\> val.replace(/^@/, "")),  
  })  
  .refine(  
    (data) \=\> data.instagramHandle.toLowerCase() \=== data.finalizedHandle.toLowerCase(),  
    {  
      message: "❌ Connection Failed: The authenticated Instagram account does not match the finalized brand handle.",  
      path: \["instagramHandle"\],  
    }  
  );

## **⚙️ Phase 3: Backend API Routes & Business Logic Execution**

### **Step 3.1: Implement the Invitation Pipeline (**/api/social-sync/invite**)**

Build or update the backend controller endpoint to accept team member emails and save them to the isolated tracking records.

1. **Authentication:** Ensure the executing session is verified as the primary brand owner.  
2. **Payload Parse:** Process the input body through InstagramSyncInviteSchema.  
3. **Database Write:**  
   * Generate a unique high-entropy verification payload (e.g., crypto.randomUUID()).  
   * Compute an absolute expiration date 24 hours into the future.  
   * Write to the InstagramSyncInvitation model table.  
4. **Email Dispatch:** Send an HTML transactional email containing the deep-link: \[https://yourplatform.com/onboarding/sync-verify?token=$\](https://yourplatform.com/onboarding/sync-verify?token=$){token}.

### **Step 3.2: Implement the OTP Interceptor Flow (**/api/social-sync/verify-otp**)**

Build the dual-stage verification routes that manage the pre-flight gate entry.

#### **Path A: GET** /api/social-sync/verify-token?token=...

When the invitee clicks the email link, validate the token payload:

* Query InstagramSyncInvitation where token \== request.query.token.  
* **Validation Guards:** Check if the record exists, if expiresAt is in the past, or if status \== "COMPLETED". If any guard triggers, reject with a 403 Forbidden response.  
* **OTP Generation:** Use a random numeric system to build a 6-digit string signature. Save the string signature to otpCode and set otpExpiresAt to Date.now() \+ 10 \* 60 \* 1000 (10-minute validity window).  
* **Dispatch:** Email the code to the record’s email target. Set an encrypted session cookie containing the active invitation id to securely persist state across sub-routes.

#### **Path B: POST** /api/social-sync/verify-otp

* Verify the input body via OtpVerificationSchema.  
* Match the input code against the row pointed to by the session cookie. Validate that otpExpiresAt is still active.  
* **State Transition:** Update the row status string variable to VERIFIED. Return a 200 OK success block.

### **Step 3.3: Refactor the OAuth Callback Handler (**/api/auth/callback/instagram**)**

Revamp the ingestion logic to terminate execution cleanly upon establishing a secure connection.

1. Receive the code payload from the Meta Graph API gateway callback.  
2. Exchange the temporary code token for a standard short-lived user token, and immediately scale it to a long-lived page/profile access token requesting instagram\_basic and instagram\_manage\_insights scopes.  
3. Query the base endpoint /me to extract the profile's public handle.  
4. Parse the identity strings using InstagramSyncSchema to guarantee a match against BrandProfile.instagram\_handle.  
5. **Encrypt and Save:** Use an infrastructure-approved encryption tool (e.g., AES-256-GCM) to encrypt the API token string, saving it to instagram\_access\_token and setting instagram\_connected \= true.  
6. **The Kill Switch Activation:**  
   * If the current active connection is executing under a team member invite context, look up the parent InstagramSyncInvitation id.  
   * Toggle the table row status value directly to COMPLETED.  
   * **Clear the Session:** Call clear-cookie operations on the active browser session payload to drop authorization headers entirely.

## **🎨 Phase 4: Frontend Routing & Interceptor Components**

### **Step 4.1: Establish the Pre-Flight Verification View**

Create a dedicated component route matching /onboarding/sync-verify. This layout manages the OTP input before exposing any core step elements.  
TypeScript  
// Complete visual presentation of Screen A: Invitee Security Verification Gate  
export default function SyncVerifyGate() {  
  const \[otp, setOtp\] \= useState("");  
  const \[error, setError\] \= useState("");

  const handleVerify \= async () \=\> {  
    const check \= OtpVerificationSchema.safeParse({ otp });  
    if (\!check.success) {  
      setError(check.error.errors\[0\].message);  
      return;  
    }  
      
    const res \= await fetch('/api/social-sync/verify-otp', {  
      method: 'POST',  
      body: JSON.stringify({ otp })  
    });  
      
    if (res.ok) {  
      // Direct router route advance to the Step 8 layout view pane  
      router.push('/onboarding/step8?context=agent');  
    } else {  
      setError("❌ Invalid or expired code. Please verify the numbers or generate a new secure OTP.");  
    }  
  };

  return (  
    \<div className="verify-container max-w-md mx-auto p-8 bg-white border rounded shadow"\>  
      \<h2 className="text-xl font-bold mb-2"\>Verify Your Access Request\</h2\>  
      \<p className="text-sm text-gray-600 mb-4"\>  
        For security, we've dispatched a short-lived, 6-digit One-Time Password (OTP) to your email address.   
        Please enter the code below to access the synchronization channel.  
      \</p\>  
      \<input   
        type="text"   
        maxLength={6}   
        value={otp}   
        onChange={(e) \=\> setOtp(e.target.value)}  
        placeholder="Enter 6-digit code"   
        className="w-full border p-2 tracking-widest text-center text-lg font-mono mb-2"  
      /\>  
      {error && \<p className="text-red-500 text-xs mb-2"\>{error}\</p\>}  
      \<button onClick={handleVerify} className="w-full bg-emerald-500 text-white p-3 rounded font-bold hover:bg-emerald-600"\>  
        Confirm Identity & Enter Sync  
      \</button\>  
    \</div\>  
  );  
}

### **Step 4.2: Build the Isolated Completion View (**/onboarding/sync-complete**)**

Construct the final application exit destination screen. When a temporary team agent completes their sync workflow, route them directly here.

* **Headline:** Integration Successfully Established\!  
* **Subline:** Thank you for your assistance. The secure Instagram Graph API token for **@\[finalized\_handle\]** has been successfully committed to the database profile layer.  
* **Component Content Body:** *"Your temporary administrative agent session is now closed. The primary account owner has been notified, and the onboarding tracking task is complete. You may now safely close this browser tab."*  
* **Behavior:** Clear out any leftover browser context and ensure the browser page components do not offer menu bars or navigation buttons.

## **📱 Phase 5: Step 8 Interface Revisions (Split-Screen Component)**

Update the UI file (src/components/onboarding/Step8SocialSync.tsx) to implement the updated copy blocks and lock states.

### **Left Pane Action Zone Revisions**

1. Remove all references to "Meta Business Manager" or "Facebook".  
2. Set the handle presentation area as a clean, static structural design block:  
3. TypeScript

\<div className="handle-awareness bg-gray-50 border p-4 rounded mb-4"\>  
  \<p className="text-sm font-semibold text-gray-700 flex items-center"\>  
    \<span\>🔒 System Target Profile:\</span\>  
    \<span className="ml-1 font-mono text-emerald-600"\>@{finalizedHandle}\</span\>  
  \</p\>  
  \<p className="text-xs text-gray-500 mt-1"\>  
    Note: This handle was finalized upstream. Ensure you log into this exact profile during the authentication pop-up.  
  \</p\>  
\</div\>

4.   
5.   
6. Set the Primary Button action string to exactly: Connect Instagram Profile (using Aurora Green hex \#34D399 fill colors).

### **Right Pane Metric Block Revisions**

1. Replace complex visual maps with two clear, distinct status cards:  
   * **Before Panel Structure:** Displays generic public scraper indicators: *"Estimated Engagement: 2.4%"*.  
   * **After Panel Structure:** Displays the private API value metrics: *"Verified Reach Analytics Unlocked | True Post Save Velocity | Follower Impression Mapping Activated"*.  
2. Add a persistent overlay badge inside the display grid containing the pulsing notification text string: *"Instagram API Synchronization Pipeline Active: Ready to parse private media optimization metrics."*

## **🔍 Phase 6: Post-Implementation Verification & Integration Testing**

Before pushing the refactored code to production, execute the following smoke tests to confirm system behavior:

1. **Verify Upstream Immutability:** Confirm that a user navigating to Step 8 cannot edit or pass arbitrary query payloads to mutate the initial instagram\_handle state.  
2. **Verify OTP Security Gate:** Attempt to force a page load on /onboarding/step8?context=agent without resolving the /api/social-sync/verify-otp path challenge. Confirm the backend handles this with a 403 Forbidden intercept response.  
3. **Verify Identity Check Rejection:** Simulate an OAuth callback sequence where the returned profile handle equals @BetaFitness, but the finalized target handle is anchored to @AlphaShoe. Confirm the system blocks the database write, triggers the validation error from InstagramSyncSchema, and does not alter target connection parameters.  
4. **Verify Session Destruction:** Complete a team invitation path workflow. Ensure that when the registration logic transitions the invitation record status to COMPLETED, the app cleanly destroys active browser session cookies, flags the authentication keys as single-use, and hard-locks access against future link reloads.

# Stitch updates

Here is your design change checklist for **Stitch**. It is broken down into updates for your current screen, new standalone screens to add, and interactive modals/overlays to design.

## **I. Changes to the Existing Screen (Step 8 Main View)**

### **1\. Left Pane Modifications**

* **Headline & Subline Update:**  
  * **Change Subline from:** "Sync your Meta Business Manager to transition from AI estimates to verified performance data." ➔ **To:** "Connect your professional Instagram profile to unlock deep performance analytics and verify your ecosystem engagement metrics."  
* **NEW ELEMENT: Target Handle Awareness Container (Crucial Addition):**  
  * *Position:* Add a new callout box directly **above** the primary green connection button.  
  * *Styling:* Light neutral/gray background (\#F9FAFB), subtle border (\#E5E7EB), rounded corners.  
  * *UI Text:*  
  * 🔒 **System Target Profile:** @\[finalized\_handle\]  
  * *Note: This handle was finalized upstream. Ensure you log into this exact profile during authentication.*  
  * *Note:* Ensure there are **no** edit links, text inputs, or dropdowns in this block.  
* **Pre-flight Checklist Updates:**  
  * *Item 1:* Change title to Profile Insights | Subtext: "To view verified reach, historical impressions, and core audience growth maps."  
  * *Item 2:* Change title to Media Reads | Subtext: "To analyze performance details, specific video view data, and post save rates."  
  * *Item 3:* **Remove** the generic *"Creator Marketplace"* item or replace it with an API permission scope indicator (since permissions are now focused on the Instagram Graph API).  
* **Primary CTA Button:**  
  * *Icon Swap:* Replace the Facebook icon with the **Instagram Icon**.  
  * *Button Text:* Change from "Connect Meta Business Manager" ➔ Connect Instagram Profile (Keep the Aurora Green \#34D399 fill).  
* **"Not the Account Admin?" Card:**  
  * *Card Title:* Change from "Not the Account Admin?" ➔ Not the Instagram Account Manager?  
  * *Subtext:* Change to: "Enter the email address of the team member who manages your Instagram professional credentials."  
  * *Input Placeholder:* Change from "Work email address" ➔ colleague@anydomain.com *(Visually signals that corporate domain restrictions are relaxed).*  
  * *Button Text:* Change from "Send Invite" ➔ Send Secure Integration Link  
* **Footer Badges:**  
  * Change "META TECH PROVIDER" to INSTAGRAM GRAPH API.

### **2\. Right Pane Modifications**

* **Top Floating Badge:**  
  * Change text from "API CONNECTED: CREATOR MARKETPLACE UNLOCKED" ➔ Instagram API Synchronization Pipeline Active  
* **Dark Dashboard Preview Panel:**  
  * Change footer source text from "Meta API Connection" ➔ Instagram Graph API.  
  * Change internal metrics to reflect Instagram Graph API scopes: *"Verified Reach Analytics Unlocked | True Post Save Velocity | Follower Impression Mapping Activated"*.

## **II. New Standalone Screens to Create in Stitch**

Since invited team members do not receive full app access or user accounts, you need to design two dedicated screens for their journey.  
\[Email Link Clicked\] ──\> \[Screen A: OTP Gate\] ──\> \[Step 8 Main View\] ──\> \[Screen B: Task Complete\]

### **📄 Screen A: Invitee Security Verification Gate (**/onboarding/sync-verify**)**

* **Layout:** Clean, centered, high-security card layout (no left/right split pane, no main navigation bar).  
* **Card Header:** Verify Your Access Request  
* **Subline:** For security, we've dispatched a short-lived, 6-digit One-Time Password (OTP) to your email inbox. Please enter the code below to access the synchronization channel.  
* **UI Components:**  
  * 6-digit inline OTP numeric entry box: \[ \_ \] \[ \_ \] \[ \_ \] \[ \_ \] \[ \_ \] \[ \_ \]  
  * Primary CTA Button: Confirm Identity & Enter Sync (Aurora Green)  
  * Secondary Text Trigger: Resend Code  
* **Error Variant State:** Include a red alert message for failed attempts: *"❌ Invalid or expired code. Please check your inbox or click Resend OTP."*

### **📄 Screen B: Isolated Journey Completion Screen (**/onboarding/sync-complete**)**

* **Layout:** Centered success screen shown to the invited team member immediately after a successful OAuth handshake.  
* **Visual Graphic:** Large green checkmark (✅) or success illustration.  
* **Headline:** Integration Successfully Established\!  
* **Subline:** Thank you for your assistance. The secure Instagram Graph API connection for @\[finalized\_handle\] has been successfully saved.  
* **Notice Box (Gray callout):**  
* *Your temporary administrative agent session is now closed. The primary account owner has been notified, and the onboarding tracking task is complete.*  
* **Footer Instruction:** "You may now safely close this browser tab." *(Ensure no dashboard navigation links, headers, or sidebar menus are visible).*

## **III. New Modals & Overlay States to Design in Stitch**

### **1\. Skip Confirmation Modal**

* *Trigger:* User clicks the "Skip for now" link at the bottom of Step 8\.  
* *Modal Title:* Are you sure you want to skip integration?  
* *Body Text:* Note: Bypassing this step will limit your real-time performance tracking and fallback to historical public engagement estimates. You can connect later via your workspace settings.  
* *Action Buttons:*  
  * Primary Action: Proceed Anyway (Neutral Gray)  
  * Secondary Action: Back to Sync (Aurora Green outline)

### **2\. Handle Verification Mismatch Error Toast**

* *Trigger:* OAuth callback returns an Instagram handle that doesn't match the finalized handle.  
* *UI Component:* High-priority Red Alert Banner pinned to the top of the Left Pane.  
* *Copy:*  
* **❌ Connection Failed: Handle Mismatch**  
* The authenticated Instagram profile (@BetaFitness) does not match the target handle locked for this brand (@\[finalized\_handle\]). Please sign out of Instagram in this browser and log into the correct account.

### **3\. Non-Professional Personal Account Warning Toast**

* *Trigger:* User authenticates a personal Instagram account instead of a Business/Creator account.  
* *UI Component:* Yellow/Amber Warning Banner pinned to the top of the Left Pane.  
* *Copy:*  
* **⚠️ Professional Account Required**  
* The Instagram Graph API requires an Instagram Business or Creator profile to pull analytics. Please convert your account type in the Instagram mobile app and try again.

# Postmark email automation

Below is the complete **Postmark User Invitation & Security Journey Specification** designed to plug directly into your Node.js/Next.js backend using the official postmark SDK.

# **POSTMARK EMAIL INTEGRATION & JOURNEY SPECIFICATION**

This specification assumes your **Postmark Server API Token** and **Transactional Message Stream** (outbound) are already configured in your environment variables as POSTMARK\_SERVER\_TOKEN.

## **📧 I. Postmark Templates Setup**

Set up the following **3 Transactional Templates** in your Postmark Server Console under your Transactional Message Stream.

### **1\. Template 1: Team Invitation (**instagram-sync-invite**)**

* **Template Alias:** instagram-sync-invite  
* **Subject Line:** \[Action Required\] Complete Instagram Sync for {{brand\_name}}  
* **Template Variables:**  
  * {{brand\_name}} — Name of the brand workspace.  
  * {{finalized\_handle}} — The locked Instagram handle (@brand\_handle).  
  * {{invite\_url}} — The tokenized deep-link (\[https://app.domain.com/onboarding/sync-verify?token=XYZ\](https://app.domain.com/onboarding/sync-verify?token=XYZ)).  
  * {{expires\_in\_hours}} — Link validity window (e.g., 24).

#### **HTML Body Structure Example:**

HTML  
\<h2\>Help {{brand\_name}} connect their Instagram Profile\</h2\>  
\<p\>You have been requested as an administrative agent to complete the Instagram Graph API sync for \<strong\>@{{finalized\_handle}}\</strong\>.\</p\>

\<p\>Click the button below to verify your access and complete the connection:\</p\>  
\<a href\="{{invite\_url}}" style\="background-color: \#34D399; color: \#ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;"\>  
  Complete Instagram Sync  
\</a\>

\<p style\="font-size: 12px; color: \#6B7280; margin-top: 24px;"\>  
  Note: This single-use link expires in {{expires\_in\_hours}} hours. You will not be asked to create an account.  
\</p\>

### **2\. Template 2: OTP Security Verification (**instagram-sync-otp**)**

* **Template Alias:** instagram-sync-otp  
* **Subject Line:** {{otp\_code}} is your verification code for {{brand\_name}}  
* **Template Variables:**  
  * {{otp\_code}} — 6-digit numeric string (e.g., 849201).  
  * {{brand\_name}} — Target brand workspace name.  
  * {{expires\_in\_minutes}} — Expiration threshold (e.g., 10).

#### **HTML Body Structure Example:**

HTML  
\<h2\>Your Access Verification Code\</h2\>  
\<p\>Use the following One-Time Password (OTP) to access the Instagram synchronization page for \<strong\>{{brand\_name}}\</strong\>:\</p\>

\<div style\="font-size: 32px; font-family: monospace; letter-spacing: 6px; font-weight: bold; color: \#111827; padding: 16px; background-color: \#F3F4F6; text-align: center; border-radius: 8px; margin: 20px 0;"\>  
  {{otp\_code}}  
\</div\>

\<p style\="font-size: 12px; color: \#6B7280;"\>  
  This code is valid for \<strong\>{{expires\_in\_minutes}} minutes\</strong\>. If you did not request this access, please ignore this email.  
\</p\>

### **3\. Template 3: Owner Confirmation Notification (**instagram-sync-owner-success**)**

* **Template Alias:** instagram-sync-owner-success  
* **Subject Line:** ✅ Instagram Connection Established for @{{finalized\_handle}}  
* **Template Variables:**  
  * {{owner\_name}} — Primary account creator's name.  
  * {{finalized\_handle}} — The connected handle.  
  * {{invitee\_email}} — Email address of the team member who completed the sync.

## **🔄 II. End-to-End Postmark Email Journey Logic**

\[Brand Owner\] Inputs Email ──\> Postmark sends \`instagram-sync-invite\`  
                                         │  
\[Team Member\] Clicks Link  ──\> Postmark sends \`instagram-sync-otp\`  
                                         │  
\[Team Member\] Passes OTP   ──\> Connects Instagram ──\> Postmark sends \`instagram-sync-owner-success\`

## **🛠️ III. Backend SDK Integration (Node.js / Express / Next.js)**

### **1\. Initialize Postmark Client**

Create a shared Postmark client utility (e.g., src/lib/postmark.ts):  
TypeScript  
import { ServerClient } from "postmark";

if (\!process.env.POSTMARK\_SERVER\_TOKEN) {  
  throw new Error("POSTMARK\_SERVER\_TOKEN environment variable is missing.");  
}

export const postmarkClient \= new ServerClient(process.env.POSTMARK\_SERVER\_TOKEN);  
export const FROM\_EMAIL \= process.env.POSTMARK\_FROM\_EMAIL || "noreply@yourdomain.com";

### **2\. Dispatch Invitation Email (**/api/social-sync/invite**)**

When the primary brand owner invites a colleague on Step 8:  
TypeScript  
import { postmarkClient, FROM\_EMAIL } from "@/lib/postmark";  
import { prisma } from "@/lib/prisma";  
import crypto from "crypto";

export async function sendTeamSyncInvite(brandId: string, inviteeEmail: string) {  
  // 1\. Fetch brand context  
  const brand \= await prisma.brandProfile.findUniqueOrThrow({  
    where: { id: brandId },  
  });

  // 2\. Create database invitation token  
  const token \= crypto.randomBytes(32).toString("hex");  
  const expiresAt \= new Date(Date.now() \+ 24 \* 60 \* 60 \* 1000); // 24 hours

  const invitation \= await prisma.instagramSyncInvitation.create({  
    data: {  
      email: inviteeEmail,  
      token,  
      brandId: brand.id,  
      expiresAt,  
    },  
  });

  // 3\. Dispatch Email via Postmark SDK  
  const inviteUrl \= \`${process.env.NEXT\_PUBLIC\_APP\_URL}/onboarding/sync-verify?token=${token}\`;

  await postmarkClient.sendEmailWithTemplate({  
    From: FROM\_EMAIL,  
    To: inviteeEmail,  
    TemplateAlias: "instagram-sync-invite",  
    TemplateModel: {  
      brand\_name: brand.name || "Your Workspace",  
      finalized\_handle: brand.instagram\_handle,  
      invite\_url: inviteUrl,  
      expires\_in\_hours: 24,  
    },  
    MessageStream: "outbound", // Transactional stream  
  });

  return invitation;  
}

### **3\. Dispatch OTP Email (**/api/social-sync/verify-token**)**

When the invited team member clicks the email link and lands on the verification gate:  
TypeScript  
import { postmarkClient, FROM\_EMAIL } from "@/lib/postmark";  
import { prisma } from "@/lib/prisma";

export async function generateAndSendOtp(token: string) {  
  // 1\. Fetch active invitation record  
  const invitation \= await prisma.instagramSyncInvitation.findUnique({  
    where: { token },  
    include: { brand: true },  
  });

  if (\!invitation || invitation.status \=== "COMPLETED" || invitation.expiresAt \< new Date()) {  
    throw new Error("Invalid or expired invitation link.");  
  }

  // 2\. Generate 6-digit OTP code  
  const otpCode \= Math.floor(100000 \+ Math.random() \* 900000).toString();  
  const otpExpiresAt \= new Date(Date.now() \+ 10 \* 60 \* 1000); // 10 minutes

  // 3\. Save OTP in DB  
  await prisma.instagramSyncInvitation.update({  
    where: { id: invitation.id },  
    data: {  
      otpCode, // Consider hashing with bcrypt before saving in high-security environments  
      otpExpiresAt,  
      status: "PENDING",  
    },  
  });

  // 4\. Dispatch OTP via Postmark SDK  
  await postmarkClient.sendEmailWithTemplate({  
    From: FROM\_EMAIL,  
    To: invitation.email,  
    TemplateAlias: "instagram-sync-otp",  
    TemplateModel: {  
      otp\_code: otpCode,  
      brand\_name: invitation.brand.name || "Workspace",  
      expires\_in\_minutes: 10,  
    },  
    MessageStream: "outbound",  
  });  
}

### **4\. Owner Completion Notification (**/api/auth/callback/instagram**)**

After the agent completes OAuth successfully and the session terminates:  
TypeScript  
import { postmarkClient, FROM\_EMAIL } from "@/lib/postmark";

export async function notifyOwnerOnSuccess(ownerEmail: string, brandName: string, handle: string, agentEmail: string) {  
  await postmarkClient.sendEmailWithTemplate({  
    From: FROM\_EMAIL,  
    To: ownerEmail,  
    TemplateAlias: "instagram-sync-owner-success",  
    TemplateModel: {  
      brand\_name: brandName,  
      finalized\_handle: handle,  
      invitee\_email: agentEmail,  
    },  
    MessageStream: "outbound",  
  });  
}

## **🚨 IV. Postmark Edge Case Handling & Deliverability Rules**

| Scenario / Edge Case | System Reaction & Postmark Mitigation |
| :---- | :---- |
| **Bounced Email / Invalid Address** | Use Postmark's **Webhook Listener** (Bounce event). If an invitation email bounces, update InstagramSyncInvitation.status \= "EXPIRED" and show an inline alert to the primary owner: *"We couldn't deliver the invite to this address."* |
| **User Clicks "Resend OTP"** | Rate limit the resend API route (max 3 dispatches per 15 minutes). Overwrite the existing otpCode and otpExpiresAt timestamp, then trigger postmarkClient.sendEmailWithTemplate again. |
| **Spam Folder Prevention** | Always send via a verified **Domain DKIM / SPF Signature** in Postmark, and restrict email copy to transactional context without aggressive marketing terms. |

Would you like to set up the **Postmark Webhook Endpoint** specification next to automatically detect bounced invite emails and notify the primary brand owner in real time?

# Tab 14

Meta has been gradually introducing **Instagram Login** to reduce the dependency on Facebook for some Instagram use cases.

So today:

| Capability | Instagram Login | Facebook Login |
| ----- | ----- | ----- |
| Read Instagram profile | ✅ | ✅ |
| Read media | ✅ | ✅ |
| Basic insights | ✅ | ✅ |
| Publish content | Depends on API | ✅ |
| Business Discovery | ❌ | ✅ |
| Facebook Pages | ❌ | ✅ |
| Business Portfolio | ❌ | ✅ |
| Creator Marketplace | ❌ | ✅ |
| Ad Accounts | ❌ | ✅ |

[image1]: <data:image/png;base64,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>