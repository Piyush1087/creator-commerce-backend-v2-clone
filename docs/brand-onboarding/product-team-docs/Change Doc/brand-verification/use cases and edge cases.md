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

