

## **Final Revised UI Copy: Step 6**

### **Pane 1: Email Verification (Action Zone)**

* **Initial State (Email Entry)**  
  * **Headline:** `Verify you own this brand`  
  * **Subline:** `To protect brands on our platform, we verify that you're associated with the website you entered. Enter your work email to receive a one-time code.`  
  * **Field Label:** `Work Email`  
  * **Placeholder:** `you@brand.in`  
  * **Helper Text:** `💡 Your email domain must match your website domain (brand.in).`  
  * **CTA Button:** `Send OTP →`  
* **Error State**   
  * **Domain Mismatch**  
    * **Error Message:** `The email domain (@gmail.com) doesn't match your website (evara.in). Please use your work email, or go back and re-enter your website.`  
    * **Format & Syntax Errors**  
      * **Trigger:** `User enters a string that does not follow the name@domain.com pattern or includes invalid characters`   
      * **Error Message:** `Please enter a valid email address (e.g., name@brand.in)`   
    * **Restricted Provider/Public Domain Error**  
      * **Trigger:** `User attempts to use @gmail.com, @yahoo.com, or @outlook.com when the brand website is a private domain (e.g., brand.in).`    
      * **Error Message:** `Public email providers are not permitted for brand verification. Please use your official @evara.in email.`   
    * **Rate Limiting (Cool-down State)**  
      * **Trigger:** `User clicks "Send OTP" more than 3 times within a 60-second window.`    
      * **Error Message:** T`oo many attempts. Please wait 58 seconds before requesting another code.`  
      * **UI Treatment:** `Disable the Send OTP button and show a countdown timer in Gray-500 (#6B7280)`  
    * **Backend Connection / Timeout Error**  
      * **Trigger:** `The API fails to respond or the request times out.`    
      * **Error Message:** We’re having trouble connecting to our verification server. Please try again in a moment.  
    * **Backend Connection / Timeout Error**  
      * **Trigger:** `The API fails to respond or the request times out.`    
      * **Error Message:** We’re having trouble connecting to our verification server. Please try again in a moment.  
    *   
        
* **OTP State (Code Entry)**  
  * **Headline:** `Enter the 6-digit code`  
  * **Subline:** `We sent a code to admin@evara.in. It expires in 10 minutes.`  
  * **Input Fields:** `[ 6 Individual Digit Boxes ]`  
  * **Footer Links:** `Didn't receive it? Check your spam folder`, or `Resend code`  
  * **Error/Expired:** `Incorrect code. 2 attempts remaining. / This code has expired. Resend →`  
  * **CTA Button:** `Verify & Continue →`

### **Pane 2: Sneak Peak (Reward Zone)**

**Badge: `PHASE 2 UNLOCKED ON VERIFICATION`**

**Main Hook: `Your Brand DNA is ready for Deep Intel.`**

**Dynamic Subtext: "`We've mapped [Brand Name] against [Competitor 1] and [Competitor 2]. Verify your domain to see the gap analysis`."**

**Progress Indicators:**

* **`[Checkmark] Surface Scan: Complete`**  
* **`[Checkmark] Brand Identity: Curated`**  
* **`[Loading Spinner] Deep Strategy: Ready to Unlock`**

### **Screen-by-Screen Implementation (Sneak Peak)**

#### **Screen 1: Competitive Gap Analysis**

* **Visual:** A mock Instagram feed analysis UI.  
* **Dynamic Data:** Show the logo of the competitor added in Step 5\.  
* **The Hook:** A bar chart comparing "Competitor Creative Strategy" vs. "Your Brand Opportunity."  
* **Blurred Content:** The literal "Strategic Gap" text and the specific "Winning Keyword" identified by the AI.

#### **Screen 2: Campaign & Archetype Strategy**

* **Visual:** A campaign dashboard mockup showing a "Creative Brief" section.  
* **Dynamic Data:** Display your **Brand Name** and **Tagline** from Step 3\.  
* **The Hook:** An "Influencer Archetype" card (e.g., "The Minimalist Curator") with a ghosted silhouette.  
* **Blurred Content:** The specific "Archetype Name" and the "Primary Angle" of the campaign strategy.

#### **Screen 3: AI Influencer Match Review**

* **Visual:** A "Review Application" screen.  
* **Dynamic Data:** Show the **Audience Traits** (e.g., Urban, Gen-Z) from Step 3 as filter tags.  
* **The Hook:** A high-quality profile preview card of a creator.  
* **Blurred Content:** The **Influencer Name**, their **Match Rate %**, and the **AI Reasoning** text.

---

## **UI Implementation Guide**

### **Action zone (Left)**

### **1\. Atmospheric Depth & Layout**

* **Split-Screen Ratio:** 50/50 Desktop split.The right pane must have `overflow: hidden` to simulate a "window" into a larger dashboard.   
* **Action Zone (Left):** Use surface-page (\#F8F8F8). The form card should use surface-card (\#FFFFFF) with a **12px radius**.

### **2\. Component Specifics (MUI \+ Aurora)**

* **Typography:**  
  * **Headlines:** Satoshi Variable, Weight 600, 32px (Desktop) / 26px (Mobile).  
  * **Body/Labels:** Source Sans 3, Weight 400, strictly **14px floor**.  
* **OTP Input:**  
  * Render 6 separate Box components.  
  * Each box: 48px height, 8px radius, centered text.  
  * Active state: border: 2px solid var(--color-primary) (\#34D399).  
* **CTA Button:** 48px height, 8px radius, **Aurora Green (\#34D399)** background.

### **3\. State Machine Logic (Single Screen)**

* **Instant Feedback:** When the user clicks "Send OTP," the UI must transition instantly using a **Skeleton Loader** during the API call.  
* **Validation Visuals:** If an incorrect OTP is entered, change the background of the OTP boxes to **Light Pink (\#FFF6F6)** with **Ruby Red (\#CA0F1C)** text.  
* **Success Event:** Upon entering the 6th digit, if valid, trigger a "Scan Unlocked" animation where the Sneak Peak blur clears before redirecting to the Dashboard

### **Sneak Peak (Right)**

### **1\. Atmospheric Setup & Rotation Logic**

* **Background:** Fixed **Midnight Black (\#061F23)** surface to maintain "Deep Intel" depth.  
* **Transition Type:** Use a **Cross-Fade** (duration: 800ms) every 5 seconds.  
* **The "Unlock" Layer:** Apply a fixed backdrop-filter: blur(12px) over the specific high-value data points (insight text, archetype titles, and match scores).  
* **Overlay Badge:** A sticky **Aurora Green (\#34D399)** badge in the top-right: "PHASE 2 PREVIEW".

### **3\. UI Implementation Guardrails (MUI & Aurora)**

* **Typography:** All headings in **Satoshi Variable (Weight 600\)**; all labels/body text strictly at the **14px floor** in **Source Sans 3**.  
* **Component Structure:**  
  * Use \<Box\> with sx props for the rotation container.  
  * Images/Mockups must have a **12px radius** (\--radius-card-standard).

.

### **Mobile Transformation (\< 768px)**

* **Structural Change:** Hide the **Sneak Peak Pane** entirely to focus on verification.  
* **Layout:** The verification card should occupy width: 100% with a **Sticky Bottom CTA**.  
* **Touch Targets:** Ensure the "Resend code" link and button have a **32px touch target**.  
* **Surfaces:** Do not use standard MUI elevations; use raw `<Box>` components with custom borders (`--border-default`) and 12px radii (`--radius-card-standard`). 

### **5\. Mandatory Footer**

* **Disclaimer:** `"AI can make mistakes. Verify the results."` must be present at the bottom of the Action Zone.

