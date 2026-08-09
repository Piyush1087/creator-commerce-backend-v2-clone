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

