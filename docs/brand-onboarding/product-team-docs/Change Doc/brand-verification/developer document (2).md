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

