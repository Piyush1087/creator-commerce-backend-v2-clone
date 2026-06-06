# Chat UI

### **\[DESTINATION: COLLABORATIONS\]**

**\[CREATOR-SIDE UI\]**

#### **1\. Left Pane: Chat List (Brand Threads)**

* **Header:** \* **Search:** \[Input: Search Brands or Campaigns...\]  
  * **Filter Icon:** \[Icon: Tune\]  
* **Chat Thread Card (Mock: Summer Skin Campaign):**  
  * **Avatar:** \[Brand Logo\]  
  * **Headline:** {{Brand Name}}  
  * **Sub-headline:** {{Last message snippet: "Brand sent a counter-offer..."}}  
  * **Status Badge:** \[Chip: Stage 1: Negotiation\]  
  * **Timestamp:** {{5m}}

---

#### **2\. Centre Pane: Active Chat (The Negotiation Feed)**

* **Header (Clickable):**  
  * **Title:** {{Brand Name}}  
  * **Sub-header:** Campaign: {{campaign\_name}}  
  * **Workflow Chip:** Stage 1 of 6: Negotiation  
  * **Interaction:** Clicking header triggers Side Pane: \<About Campaign\>  
* **Chat Feed (WhatsApp Style):**  
  * **Date Splitter:** \[Center: Today\]  
  * **System Notification:** \[Center: Stage 1: Negotiation Started\]  
  * **Welcome Message (Auto):** *"Congrats\! You're approved for {{campaign\_name}}. To secure your spot, please propose your quote below."*  
  * **Workflow CTA Card 1 (Initial State):**  
    * **Icon:** \[Icon: Request\_Quote\]  
    * **Title:** Propose Your Quote  
    * **Body:** *"Set your price for the deliverables & rights listed in the brief."*  
    * **Primary Action:** \[Button: Submit Quote\] — *Triggers Side Pane (Execution)*  
* **Workflow CTA Card 2 (Brand Counter State):**  
  \* **Icon:** \[Icon: Priority\_High\]  
  \* **Title:** Brand Counter-Offer  
  \* **Body:** ₹{{counter\_amount}}  
  \* **Primary Action:** \[Button: Review & Respond\] — *Triggers Side Pane (Execution)*

---

#### **3\. Side Pane: Execution Card (The 4-Section Structure)**

*This pane opens when the Creator clicks "Submit Quote" or "Review & Respond" in the chat feed. It follows the layout of the Brand's Commercial Doc.*

* **Header:** Negotiation Hub  
* **Section 1: Product Value (Read-Only)**  
  * 📦 Complimentary Sample: {{YES/NO}}  
  * Item: {{Product\_Name}} (₹{{Retail\_Value}})  
* **Section 2: Scope of Work (Read-Only)**  
  * Deliverables: {{Quantity}}x {{Type}}  
* **Section 3: Usage Rights (Read-Only)**  
  * Ad Permissions: {{Days}} Days  
* **Section 4: Financial Input**  
  * **Field:** \[Your Quote: ₹\_\_\_\_\_\_\_\]  
  * **Breakdown:** Advance (30%): ₹{{calc}} | Balance (70%): ₹{{calc}}  
  * **Logic (The "One-Strike" Warning):** If negotiation\_round \== 2, display: *"🚨 Final Offer: If the brand declines this, the collab will close."*  
* **Primary Action:** \[Button: Send to Brand\]

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

#### **4\. Side Pane: Execution Card** \<About Campaign\>

#### 

#### **Section 1: Campaign Overview**

* **Header:** `About the Campaign`  
* **Sub-header:** `{{campaign_name}}`  
* **Brand Profile:** \* `[Avatar: Brand Logo] {{brand_name}}`  
  * `[Link: View Brand Profile]`  
* **Campaign Objective:** `{{Objective_Type}}` (e.g., *Awareness / Production-Only*)  
* **The "Hook":** `{{campaign_tagline_or_usp}}` — *"A 30-second high-energy reel focusing on our new Summer Skin hydration formula."*  
  ---

  #### **Section 2: Execution Guide (The Brief)**

* **Sub-header:** `Execution Guide`  
* **Visual Direction:** `[Thumbnail Grid: Reference Images]`  
* **Key Messaging:** \* `Directives: {{Brief_Description}}`  
  * `Mandatory Mentions: @{{brand_handle}}, #{{campaign_hashtag}}`  
* **Reference Link:** `[Button: Download Full Brief PDF]`  
  ---

  #### **Section 3: Product Logistics**

* **Sub-header:** `Product & Logistics`  
* **Sample Requirement:** \* `Status: 📦 Complimentary Sample Required`  
  * `Product: {{Product_Name}}`  
  * `Retail Value: ₹{{Retail_Value}}`  
* **Shipping Status:** \* `Status: {{Logic_Status}}` (e.g., *Awaiting your address / In-Transit / Not Required*)  
  ---

  #### **Section 4: Usage & Timeline**

* **Sub-header:** `Usage & Schedule`  
* **Usage Rights:**  
  * `Ad Permissions: {{Yes/No}} ({{Days}} days)`  
  * `Organic Reposting: {{Yes/No}} ({{Days}} days)`  
* **Key Deadlines:**  
  * `Proposed Posting Date: {{DD/MM/YYYY}}`  
  * `Draft Submission: T-minus 5 days from live date`

  ---

  #### **Section 5: Collaboration ID (Footer)**

* **Header:** `Internal Reference`  
* **Details:**  
  * `Collab ID: #{{UUID_Short}}`  
  * `Status: Stage 1: Negotiation`  
  * `Support: [Link: Report an issue with this brief]`

  ---

  ### **Interaction & Logic**

* **Trigger:** User taps the Chat Header or the `<About>` tab in the Side Pane.  
* **Sticky Footer (Mobile):** On mobile, this information is rendered as a vertical scrollable sheet with a **"Back to Chat"** sticky button at the bottom.  
* **Dynamic Visibility:** If the Brand has toggled off "Ad Permissions," Section 4 will automatically hide that specific line item to prevent confusion.  
* **Contextual Sync:** If the Creator is in **Stage 4 (Production)**, an additional section **"Approved Script"** will appear at the top of this pane for quick reference while filming.  
* 

---

#### **4\. Chat Interaction & Notifications**

| Trigger | System Notification (In-Chat) | Creator Action |
| :---- | :---- | :---- |
| **Accept Campaign** | \[Center\] Negotiation Started | Clicks "Submit Quote" |
| **Creator Sends Quote** | \[Right Bubble\] I've proposed a quote of ₹{{amount}} | Awaiting Brand |
| **Brand Counters** | \[Left Bubble\] {{Brand}} sent a counter-offer of ₹{{amount}} | Clicks "Review & Respond" |
| **Creator Final Strike** | \[Right Bubble\] My final offer is ₹{{amount}} | Awaiting Brand |
| **Brand Accepts** | \[Center\] Commercials Finalized at ₹{{amount}} | Clicks "Next Step" |

---

#### **5\. Mobile 3-Step Logic**

* **Step 1 (Chat List):** Full-screen list of Brand threads.  
* **Step 2 (Single Chat):** The WhatsApp-style feed with the CTA cards.  
* **Step 3 (Action):** Tapping **"Submit Quote"** or **"Review & Respond"** slides the **Execution Card (Side Pane)** into full-screen view.

### **Stitch Instructions for Implementation:**

1. **Context Switching:** Ensure the Side Pane toggle pulls the Stage 1 commercial data specifically for the selected Creator-Brand pair.  
2. **Notification Logic:** The \[Button: Review & Respond\] in the chat feed must dynamically update based on who is "holding the ball" in the negotiation.  
3. **Section Fidelity:** Section 1, 2, and 3 must remain read-only to prevent creators from editing the scope while changing the price.

# 1\. Commercial Negotiation\]

### **\[WORKFLOW MODULE: 1\. Commercial Negotiation\]**

**\[CREATOR-SIDE UI\]**

#### **Logic Gate: Campaign Type Awareness**

* **If Barter: Creator sees "Barter Collaboration" – No quote input allowed.**  
* **If Fixed: Creator sees "Fixed Quote: ₹{{amount}}" – Only \[Accept\] or \[Decline\] options.**  
* **If Negotiable: Start with Card 1.1 (Negotiation Gate).**

#### **Card 1.1: Submit Your Quote (Initial Proposal)**

*Trigger: Creator enters the Chat UI from the campaign page.*

* **Section 1: Product Value (The Sample)**  
  * **Status:** `📦 Complimentary Sample: {{YES/NO}}`  
  * **Item:** `{{Product_Name}}`  
  * **Retail Value:** `₹{{Product_Price}}`  
  * **Logic:** This reminds the creator that the physical product is part of the total value exchange.  
* **Section 2: Fixed Deliverables (Read-Only)**  
  * **Main Content:** `{{Quantity}}x {{Type}} ({{Dimensions}})`  
  * **Stories:** `{{Quantity}}x ({{Story_Type}})`  
  * **Link-in-Bio:** `{{Yes/No}} for {{Days}} days`  
* **Section 3: Usage & Rights (Read-Only)**  
  * **Ad Permissions:** `{{Yes/No}} for {{Days}} days`  
  * **Organic Reposting:** `{{Yes/No}} for {{Days}} days`  
  * **Logic:** Matches the Brand's "Read-Only" section so the creator knows exactly what rights they are pricing for.  
* **Section 4: Financial Offer (Input State)**  
  * **Your Proposed Quote:** `[ ₹_______ ]`  
  * **Advance Payment (30%):** `₹{{calculated_advance}}` (Paid after securement)  
  * **Balance Settlement (70%):** `₹{{calculated_balance}}` (Paid post-approval)  
* **Creator Action:** `[Button: Send Quote to Brand]`  
* **Chat Notification:** `[System]: {{creator_handle}} has proposed a quote of ₹{{total_quote}}. Awaiting Brand review.`

---

#### **Card 1.2: Brand Counter-Offer (The Pivot)**

*Trigger: Brand sends a counter-offer as per the "One-Strike" policy.*

* **Section 1: Product Value:** `📦 Complimentary Sample: {{YES/NO}} (₹{{Price}})`  
* **Section 2: Fixed Deliverables:** `(Read-only summary of scope)`  
* **Section 3: Usage & Rights:** `(Read-only summary of rights)`  
* **Section 4: Comparison & Final Choice**  
  * **Your Previous Quote:** `₹{{creator_original_quote}}`  
  * **Brand’s Counter-Offer:** `₹{{brand_counter_amount}}`  
  * **Brand’s Message:** `“{{brand_comment}}”`  
* **Creator Action:** \* `[Button: Accept Brand’s Price]` — *Moves to Stage 2\.*  
  * `[Button: Suggest Final Quote]` — *Opens Section 4 input for the last time.*  
* **Chat Notification:** `[System]: {{brand_name}} has sent a counter-offer of ₹{{brand_counter_amount}}. This is the final negotiation cycle.`

---

#### **Card 1.3: Submit Final Quote (The Hard Stop)**

*Trigger: Creator clicks "Suggest Final Quote".*

* **Section 1, 2, & 3:** *(Same as above, Read-Only)*  
* **Section 4: The Final Gate**  
  * **Alert:** `🚨 This is your final counter-offer. If the brand does not accept this amount, the collaboration will be closed.`  
  * **Final Quote:** `[ ₹_______ ]`  
  * **Net Advance (30%):** `₹{{calc_30}}`  
  * **Net Balance (70%):** `₹{{calc_70}}`  
* **Creator Action:** `[Button: Send Final Offer]`  
* **Chat Notification:** `[System]: {{creator_handle}} has sent their FINAL quote of ₹{{total_quote}}. Brand decision pending.`

---

#### **Card 1.4: Commercials Finalized (The Terminal State)**

*Trigger: Brand Accepts the Creator's Final Quote.*

* **Section 1: Product Value:** `✅ Sample Confirmed`  
* **Section 2: Deliverables:** `✅ {{Summary}}`  
* **Section 3: Rights:** `✅ {{Summary}}`  
* **Section 4: Locked Financials**  
  * **Agreed Quote:** `₹{{final_quote}}`  
  * **Milestone 1 (30%):** `₹{{final_30}}`  
  * **Milestone 2 (70%):** `₹{{final_70}}`  
* **Creator Action:** \* **IF Sample \== YES:** `[Button: Provide Shipping Address]`  
  * **IF Sample \== NO:** `[Button: Enter Production Hub]`  
* **Chat Notification:** `[System]: Commercials finalized at ₹{{final_quote}}. Stage 2: Securement initiated.`

---

### **Summary of Section Logic Alignment**

1. **Section 1 (Product Value):** Present in all cards to ground the cash quote in the total "Marketing Value."  
2. **Section 2 & 3 (Scope/Rights):** Strictly Read-Only once the creator accepts the campaign, preventing "Scope Creep" during price talks.  
3. **Section 4 (Financials):** Only editable area. Implements the **One-Strike Policy** where the "Final Offer" card (1.3) triggers a specific system alert.  
4. **Chat Notifications:** Every card action triggers a system-generated message to ensure transparency and a "Paper Trail" in the Chat UI.

### **Backend Logic for Stage 1 (Creator-Side)**

1. **Validation:** The Creator cannot input a quote lower than the platform's minimum floor price (if applicable).  
2. **Split Enforcement:** The UI must display the 30% and 70% amounts clearly so the Creator knows exactly what the advance and final payments will be.  
3. **State Lock:** Once the Creator clicks "Accept," the `total_quote` field becomes read-only and is passed to the **Securement Stage**.

# 2\. Securement

**\[CREATOR-SIDE UI\]**

#### **LOGIC GATE: PAYOUT MODE CHECK**

* **Barter Bypass**: If the Campaign\_Type \== Barter, this stage is auto-skipped with a system message: *"Commercials secured via Barter. Moving to Stage 3: Logistics"*.

---

### **USE CASE A: ESCROW MODE (Platform Managed)**

Goal: Creator monitors the platform "Vault" to see when their 30% advance is unlocked.

#### **Card 2.1: Securement in Progress (Active State)**

* **Header**: Securement in Progress  
* **Body**: The brand is currently funding the agreed quote into the platform Escrow. Once secured, your 30% advance will be released to your wallet automatically.  
* **Summary Breakdown**:  
  * **Total Quote**: ₹{{total\_quote}}  
  * **Advance to be Released (30%)**: ₹{{30%\_value}}  
  * **Balance in Escrow (70%)**: ₹{{70%\_value}}  
* **Primary Action**: \[Button: View Payout Schedule\]  
* **Secondary Action**: \[Button: View Master Terms\]

#### **State: Securement Successful (Success State)**

* **Chat Notification**: \[Center: Funds Secured in Escrow 🛡️. Your 30% Advance (₹{{30%\_val}}) has been released to your wallet. Moving to Stage 3: Logistics.\]

---

### **USE CASE B: MANUAL MODE (Brand Managed)**

Goal: Creator tracks direct bank transfer and manages payment details.

#### **Card 2.1: Action Required: Provide Bank Details**

Trigger: Stage 2 starts, Payout Mode is 'Manual', and creator.bank\_details is missing.

* **Alert**: 🚨 Action Required: Missing Bank Details  
* **Body**: The brand will pay your 30% advance (₹{{30%\_value}}) via direct bank transfer. To receive this, you must update your bank details in your profile.  
* **Advance Amount**: ₹{{30%\_value}}  
* **Primary Action**: \[Button: Add Bank Details in Creator Centre\]  
  * **Logic**: Deep-links the creator directly to the **Profile \> Payments** section.  
* **Chat Notification**: \[System: Awaiting Creator's bank details to initiate Manual Advance Payment.\]

#### **Card 2.2: Awaiting Advance Payment (Active State)**

Trigger: Creator has updated bank details; now awaiting Brand transfer.

* **Header**: Awaiting Advance Payment  
* **Body**: The brand has acknowledged the 30% advance payment liability. Please notify us once you receive ₹{{30%\_value}} in your registered bank account.  
* **Summary**:  
  * **Agreed Advance (30%)**: ₹{{30%\_value}}  
  * **Pending Balance (70%)**: ₹{{70%\_value}}  
* **Status Badge**: ⏳ Waiting for Brand to upload receipt...  
* **Secondary Action**: \[Button: Contact Support\] (If payment is delayed)

#### **State: Advance Receipt Uploaded (Confirmation State)**

* **Chat Notification**: \[Center: Brand has uploaded the 30% Advance Receipt 📄. Please verify the credit in your account. Moving to Stage 3: Logistics.\]

---

### **SIDE PANE: EXECUTION CARD (Stage 2 Version)**

This pane mirrors the 4-section structure from Stage 1 but updates Section 4 to show Securement Status.

* **Section 1: Product Value**: 📦 Complimentary Sample: {{YES/NO}} (₹{{Price}})  
* **Section 2: Fixed Deliverables**: (Read-only summary of scope)  
* **Section 3: Usage & Rights**: (Read-only summary of rights)  
* **Section 4: Securement Status**:  
  * **Total Agreed Quote**: ₹{{total\_quote}}  
  * **Milestone 1 (30% Advance)**: \[Status: PAID/PENDING\]  
  * **Milestone 2 (70% Balance)**: \[Status: SECURED IN VAULT / DIRECT TRANSFER\]  
* **Visual Alert (Conditional)**: ⚠️ Awaiting Confirmation: The brand has not yet provided the advance payment receipt. We recommend waiting for receipt verification before starting production.  
* **Primary Creator Action**: \[Button: Download Collaboration Summary (PDF)\]  
* **Secondary Action (Manual Mode)**: \[Button: Nudge Brand for Receipt\]

---

### **TECHNICAL & STITCH INSTRUCTIONS**

* **PDF Generation**: Upon the Brand clicking "Secure" (Escrow) or "I Confirm Liability" (Manual), the Creator’s \[Download PDF\] button must populate with the legal\_agreement.agreement\_pdf\_url.  
* **Escrow Sync**: In Escrow mode, the "Success State" triggers only after the advance\_30\_amount is credited to the Creator's internal wallet.  
* **Visual Mirroring**: Use the **SafePay Badge** for Escrow and a **Warning Icon** for Manual (if receipt is pending) in the Chat Feed to maintain a "Shared Reality".

# 3\. Logistics and Shipping

### **\[WORKFLOW MODULE: 3\. LOGISTICS & SHIPPING\]**

**\[CREATOR-SIDE UI\]**

#### **STATE 1: THE BYPASS (Digital/No Product)**

*Trigger: `free_product == OFF`.*

* **Chat Notification:** `[System: No physical logistics required. Digital/Service terms confirmed. Moving to Stage 4: Production.]`

---

### **INDUSTRY A: D2C / E-COMMERCE (Physical Product)**

#### **Card 3.1: Address Submission (Action Required)**

*Trigger: `free_product == ON` and address is null.*

* **Header:** `Confirm Delivery Address`  
* **Body:** `{{brand_name}} needs your shipping details to send the {{product_name}}. Please provide an address where someone is available to receive the package.`  
* **Form Fields:**  
  * `Full Name` | `Phone Number`  
  * `Address Line 1` | `Landmark`  
  * `Pincode` | `City & State`  
* **Primary Action:** `[Button: Share Address with Brand]`  
* **Chat Notification:** `[System: {{creator_handle}} has shared their shipping address. Awaiting dispatch.]`

#### **Card 3.2: Tracking Your Package (Product Dispatched)**

*Trigger: Brand inputs tracking details.*

* **Header:** `Product In Transit 🚚`  
* **Status Badge:** `📦 Dispatched`  
* **Body:** `Your sample for "{{campaign_name}}" is on the way!`  
* **Tracking Details:**  
  * **Courier:** `{{courier_partner}}`  
  * **Tracking ID:** `{{tracking_number}}`  
* **Primary Action:** `[Button: Track Package]` (Links to courier site)  
* **Status Update:** *"Please click 'Confirm Receipt' once the product is in your hands to unlock Stage 4."*

#### **Card 3.3: Confirm Receipt (The Production Gate)**

*Trigger: Product marked as delivered or Creator receives it.*

* **Header:** `Product Delivered?`  
* **Body:** `Have you received the {{product_name}} and verified its condition?`  
* **Primary Action:** `[Button: ✅ Yes, I've Received It]`  
* **Secondary Action:** `[Button: ❌ Issue with Product]` (Triggers "Fulfillment Issue" workflow)  
* **Chat Notification:** `[System: {{creator_handle}} confirmed receipt. Production Hub is now open.]`

#### **`Card 3.4: Report Shipment Issue (Action State)`**

*`Trigger: Creator clicks "❌ Issue with Product" on Card 3.3.`*

* **`Header:`** `Report Logistics Issue`  
* **`Body:`** `Please specify the issue with the shipment. This will notify the brand to take corrective action.`  
* **`Form Fields:`**  
  * **`Issue Type (Dropdown):`** `* Product Received Damaged`  
    * `Incorrect Product/Size Received`  
    * `Package Not Received (Marked Delivered)`  
    * `Empty/Tampered Package`  
  * **`Additional Details (Text Area):`** `[ Describe the issue in detail... ]`  
  * **`Photo Proof (Uploader):`** `[ 📤 Upload Photo/Video of Package ]`  
* **`Warning:`** `⚠️ Note: Reporting an issue will pause the collaboration timeline until the brand resolves it.`  
* **`Primary Action:`** `[Button: Submit Issue to Brand]`

---

#### **`Card 3.5: Issue Reported (Awaiting Resolution)`**

*`Trigger: Creator submits the issue.`*

* **`Header:`** `Shipment Issue Reported`  
* **`Status Badge:`** `⚠️ Resolution Pending`  
* **`Body:`** `We've informed {{brand_name}} about the "{{Issue_Type}}". The brand is currently reviewing your report to coordinate a replacement or update tracking.`  
* **`Reported Details:`**  
  * **`Type:`** `{{Issue_Type}}`  
  * **`Timestamp:`** `{{DD/MM/YY | HH:MM}}`  
* **`Action:`** `[Button: Message Brand in Chat]`

### **Chat Notifications (Creator View)**

| Trigger | System Notification (In-Chat) |
| :---- | :---- |
| **Creator Reports Issue** | \[Right Bubble\] ⚠️ I've reported an issue: {{Issue\_Type}}. Details: {{Comment}} |
| **Brand Responds** | \[Left Bubble\] {{brand\_name}} has initiated: {{Action\_Taken}}. New Tracking: {{New\_ID}} |
| **Deadlock (Strike 2\)** | \[Center\] 🚨 Logistics Deadlock: Shipment failed twice. This collaboration is being reviewed for cancellation. |

---

#### **`Card 3.6: Resolution Received (Action State)`**

*`Trigger: Brand selects an action (e.g., Resending Product) and updates the system.`*

* **`Header:`** `Resolution Update`  
* **`Status Badge:`** `✅ Action Taken`  
* **`Body:`** `The brand has responded to your issue.`  
* **`Brand's Action:`** `{{Action_Taken}} (e.g., "We are resending the product.")`  
* **`New Tracking Details:`**  
  * **`Courier:`** `{{courier_partner}}`  
  * **`New Tracking ID:`** `{{new_tracking_id}}`  
* **`Instruction:`** `"Please confirm once you receive the new package to resume the collaboration."`  
* **`Primary Action:`** `[Button: Track New Package]`

### **Scenario A: Success on 2nd Attempt**

If the second package arrives and the creator verifies it:

1. **Creator Action:** Taps `[✅ Yes, I've Received It]` on **Card 3.3 (Confirm Receipt)**.  
2. **System Action:** \* The `is_production_ready` flag is set to `TRUE`.  
   * **The Production Lock is lifted:** Stage 4 (Production Hub) is officially unlocked.  
   * The 72-hour content deadline (or agreed timeline) begins.  
3. **Chat Notification:** `[System: {{creator_handle}} confirmed receipt of the replacement. Production started.]`

---

### **Scenario B: The "Deadlock" (2nd Issue Reported)**

If the creator reports an issue for the **second time** (e.g., the replacement is also damaged or incorrect), the system triggers a **Hard Stop** to prevent a infinite loop of shipping costs and delays.

#### **1\. The Terminal Logic (Strike 2\)**

* **Trigger:** `fulfillment_issue_count == 2`.  
* **System Action:** The standard "Resolve Issue" flow is disabled for the Brand. Both parties are moved to a **Logistics Deadlock** state.

#### **2\. Creator-Side UI (The Deadlock Card)**

* **Header:** `🚨 Logistics Deadlock: Action Required`  
* **Body:** `The shipment has failed twice. Due to these recurring logistics issues, this collaboration cannot proceed to production.`  
* **Action for Creator:** None. The UI informs them that the Brand or Admin must now decide to either cancel or move to a manual override.

#### **3\. Brand-Side UI (The Resolution Card)**

As per the Brand's **Branch A (Escrow Mode)** or **Branch B (Manual Mode)** logic:

* **If Escrow:** The Brand sees **Card 3.4a: Access Deadlock \- Request Cancellation**.  
  * **Primary Action:** `[Button: Request Cancellation]`.  
  * **Result:** System automatically refunds the `total_quote` from the Vault back to the Brand's wallet.  
* **If Manual:** The Brand sees **Card 3.4b: Access Deadlock \- Void Collaboration**.  
  * **Alert:** `⚠️ Advance Recovery: If you paid the 30% advance manually, please coordinate the reversal directly with the creator.`  
  * **Primary Action:** `[Button: Confirm Void & Close Collab]`.

---

### **Summary of the "Hard Stop" Rule**

The platform does not allow a 3rd shipping attempt through the automated UI. Once the **2nd failure** is logged:

* **Financials:** Escrow funds are returned to the Brand.  
* **Reputation:** The `fulfillment_issue_count` is logged against the Brand (if it was a faulty product) or the Creator (if it was a false claim), impacting their internal Trust Score.  
* **Collaboration Status:** Moved to `TERMINATED`.

---

### **INDUSTRY B: SAAS / SERVICE (Digital Access)**

#### **Card 3.1: Awaiting Digital Access**

*Trigger: Brand is preparing credentials.*

* **Header:** `Digital Access Pending`  
* **Body:** `{{brand_name}} is setting up your access to their service/platform. You will receive your login credentials or activation key here.`  
* **Status Badge:** `⏳ Waiting for Brand`

#### **Card 3.2: Access Credentials Received**

*Trigger: Brand shares the key/login.*

* **Header:** `Your Access Details`  
* **Section 1 (Credentials):**  
  * **Email/ID:** `{{login_email}}`  
  * **Password/Key:** `{{password_or_token}}`  
* **Section 2 (Instructions):** `{{brand_access_instructions}}`  
* **Primary Action:** `[Button: ✅ I Have Successfully Logged In]`  
* **Secondary Action:** `[Button: ⚠️ Access Code Doesn't Work]` (Increments "Strike Counter")  
* **Alert:** `⚠️ Note: Clicking 'Confirm' will notify the brand and start your 72-hour content deadline.`

### **EDGE CASE: RETURN LOGISTICS (D2C)**

*Trigger: `return_after_shoot == YES`.*

* **Creator UI Overlay (Post-Production):**  
  * **Header:** `Return Sample`  
  * **Body:** `As per the agreement, this item must be returned. A pre-paid shipping label has been generated.`  
  * **Action:** `[Button: Download Return Label]`

---

### **SIDE PANE: EXECUTION CARD (Stage 3 Version)**

*Mirrors the 4-section structure, now focusing on fulfillment.*

* **Section 1: Logistics Status**  
  * **Method:** `{{Shipping / Digital Access}}`  
  * **Status:** `{{In-Transit / Awaiting Verification}}`  
* **Section 2: Item Details**  
  * **Product:** `{{Product_Name}}`  
  * **Retail Value:** `₹{{Price}}`  
* **Section 3: Return Instructions (If Applicable)**  
  * **Return Required:** `{{Yes / No}}`  
  * **Instruction:** `“Please keep the original packaging for return shipping.”`  
* **Section 4: Actions**  
  * `[Button: Report Damaged Product]`  
  * `[Button: Contact Logistics Support]`

---

---

### **TECHNICAL & STITCH INSTRUCTIONS (Literal Fidelity)**

1. **The Production Lock:** The "Upload Draft" button in Stage 4 **MUST** remain disabled (greyed out) until the creator clicks `[I Have Received It]` or `[Logged In]`.  
2. **Strike Counter:** If the creator clicks `[Access Code Doesn't Work]` or `[Product Damaged]`, the system increments `fulfillment_issue_count`. If count \== 2, show the **"Access Deadlock"** card to both parties to initiate cancellation.  
3. **Address Sync:** Once the creator submits Card 3.1, the address must be pushed to the Brand's **"Card 3.1: Dispatch Product"** view immediately.

# D2C/ e-commerce

### **\[WORKFLOW MODULE: 3\. LOGISTICS & SHIPPING\]**

**\[CREATOR-SIDE UI\]**

**\[LOGIC GATE: D2C / E-COMMERCE CONFIGURATION\]**

* **Trigger 1:** Checks `free_product` toggle (Yes/No) from Campaign Setup.  
* **Trigger 2:** Checks `return_after_shoot` toggle (Yes/No) from Campaign Setup.  
* **Trigger 3:** Checks `global_payout_mode` (Escrow/Manual) from Stage 2\.

#### **Card 3.1: Provide Delivery Address (Action Required)**

*Trigger: Stage starts and `free_product == ON`.*

* **Section 1: Logistics Prep**  
  * **Status**: `⏳ Awaiting Address`  
  * **Item**: `{{Product_Name}} (₹{{Retail_Value}})`  
* **Section 2: Delivery Details (Form)**  
  * `[Full Name]` | `[Phone Number]`  
  * `[Address Line 1]` | `[Landmark]`  
  * `[Pincode]` | `[City & State]`  
* **Creator Action**: `[Button: Share Address with Brand]`  
* **Chat Notification**: `[System: {{creator_handle}} has shared their shipping address. Awaiting dispatch.]`

---

#### **Card 3.2: Track Your Sample (Product Dispatched)**

*Trigger: Brand inputs tracking details.*

* **Section 1: Logistics Status**  
  * **Badge**: `📦 Dispatched`  
  * **Courier**: `{{courier_partner}}` | **Tracking ID**: `{{tracking_number}}`  
* **Section 2: Item Details**  
  * `Product: {{Product_Name}}`  
* **Creator Action**: `[Button: Track Package]` (Links to courier site)  
* **Chat Notification**: `[System: {{brand_name}} has dispatched the product. Awaiting receipt.]`

---

#### **Card 3.3: Confirm Receipt (The Production Gate)**

*Trigger: Creator marks item as received or Tracking shows delivered.*

* **Header**: Product Received?  
* **Body**: Have you received the `{{product_name}}` and verified its condition? **Confirming receipt will unlock the Production Hub.**  
* **Primary Action**: `[Button: ✅ Yes, I've Received It]` (Moves to Stage 4\)  
* **Secondary Action**: `[Button: ❌ Issue with Product]` (Starts Issue/Re-shipment Cycle)  
* **Chat Notification (Success)**: `[System: Receipt confirmed. Stage 4: Production Hub is now open.]`

---

#### **Card 3.4: Report Shipment Issue (1st Strike)**

*Trigger: Creator clicks "❌ Issue with Product".*

* **Section 4: Report Issue (Form)**  
  * **Issue Type**: `[Dropdown: Damaged, Incorrect Product, Lost in Transit, Tampered]`  
  * **Details**: `[Text Area: Describe the issue...]`  
  * **Proof**: `[Uploader: Add Photo/Video Proof]`  
* **Creator Action**: `[Button: Submit Issue to Brand]`  
* **Chat Notification**: `[Right Bubble]: ⚠️ I've reported a shipment issue: {{Issue_Type}}. Please review for resolution.`

---

#### **Card 3.5: Resolution & Re-shipment (The Recovery)**

*Trigger: Brand selects "Resending Product" or "Updating Tracking".*

* **Header**: Resolution in Progress  
* **Status**: `✅ Brand is resending the product`  
* **Body**: The brand has addressed your report. A new shipment has been initiated.  
* **New Tracking**:  
  * **Courier**: `{{new_courier}}` | **Tracking ID**: `{{new_id}}`  
* **Note**: Once the new package arrives, please return to the "Confirm Receipt" card.  
* **Chat Notification**: `[System: Brand has re-shipped. {{creator_handle}} must confirm receipt to proceed.]`

---

#### **Card 3.6: Logistics Deadlock (2nd Strike \- Terminal)**

*Trigger: `fulfillment_issue_count == 2`.*

* **Header**: Collaboration Deadlock  
* **Status Badge**: `🚨 Terminated: Logistics Failure`  
* **Body**: Digital access or physical shipment has failed twice. To protect both parties, this collaboration is now closed.  
* **Section 1: Payment Return State (Conditional)**  
  * **IF ESCROW**: `Advance Recovery: The platform will coordinate the reversal of the 30% advance (₹{{30%_val}}) to the brand's vault.`  
  * **IF MANUAL**: `Notice: This collaboration is void. Both parties must settle the recovery of the manual advance (₹{{30%_val}}) offline.`  
* **Section 2: Item Instruction**: *"Please retain the faulty/damaged item until contacted by support."*  
* **Creator Action**: `[Button: Back to Hub]` | `[Button: Contact Support]`  
* **Chat Notification**: `[Center]: 🚨 Deadlock reached. Fulfillment failed twice. Collaboration Terminated.`

---

### **SIDE PANE: EXECUTION CARD (Stage 3 Snapshot)**

* **Section 1: Logistics**  
  * `Method: Physical Shipping` | `Status: {{Status_Badge}}`  
* **Section 2: Item Details**  
  * `Item: {{Product_Name}}` | `Retail Value: ₹{{Price}}`  
* **Section 3: Return Policy**  
  * `Return after shoot: {{Yes/No}}`  
  * `Instruction: "Keep original packaging for return shipping."`  
* **Section 4: Quick Actions**  
  * `[Button: Track Package]`  
  * `[Button: Nudge Brand for Tracking]`

---

### **Logical Guardrails (For Development)**

1. **The Hard Stop**: Once `fulfillment_issue_count` hits `2`, the "Submit Issue" and "Confirm Receipt" buttons are removed and replaced by the **Deadlock Card (3.6)**.  
2. **The Advance Clawback**:  
   * **Escrow Mode**: If Deadlock occurs, the system triggers an internal "Wallet Debit" for the creator to refund the brand's 30% advance automatically.  
   * **Manual Mode**: The system provides a **Void Agreement Certificate** so the Brand has legal proof of the failed collaboration for their accounting.  
3. **Production Lock**: Under no circumstances should the "Upload Draft" button in Stage 4 become active until Card 3.3 (or its re-shipment equivalent) is confirmed as `Success`.

# AI / SAAS

### **\[WORKFLOW MODULE: 3\. DIGITAL ACCESS HANDSHAKE\]**

**\[CREATOR-SIDE UI\]**

**\[LOGIC GATE: AI/SaaS\]**

#### **Card 3.1: Awaiting Digital Access (Holding State)**

*Trigger: Stage 2 complete. Payout secured.*

* **Header**: Digital Access Pending  
* **Body**: {{brand\_name}} is setting up your access to their platform. You will receive your login credentials, license key, or credits here.  
* **Access Summary**:  
  * **Plan Type**: `{{Product_Type: e.g., Full Pro Plan Access}}`  
  * **Duration/Credits**: `{{Value: e.g., 6 Months}}`  
* **Status Badge**: `⏳ Waiting for Brand`

---

#### **Card 3.2: Verify Your Access (Action Required)**

*Trigger: Brand clicks "Confirm & Send Access".*

* **Header**: Verify Your Access  
* **Body**: The brand has shared your credentials. Please log in and verify your account status to unlock the Production Hub.  
* **Access Credentials**:  
  * **Product Key/Link**: `[Click to Copy: {{Product_Key}}]`  
  * **Instructions**: `{{Special_Instructions}}`  
* **Warning**: `⚠️ Note: Confirming access starts your 72-hour content production window.`  
* **Primary Action**: `[Button: ✅ I’ve Logged In & Verified Access]`  
* **Secondary Action**: `[Button: ❌ Access Code Doesn't Work]` (Starts Issue Cycle)

---

#### **Card 3.3: Report Access Issue (1st Strike)**

*Trigger: Creator clicks "❌ Access Code Doesn't Work".*

* **Section 4: Report Technical Issue (Form)**  
  * **Issue Type**: `[Dropdown: Invalid Key, Account Not Upgraded, Link Broken, Login Failed]`  
  * **Details**: `[Text Area: Describe the technical error...]`  
  * **Proof**: `[Uploader: Upload Screenshot of Error]`  
* **Creator Action**: `[Button: Submit Issue to Brand]`  
* **Chat Notification**: `[Right Bubble]: ⚠️ Technical Issue: I'm unable to access the tool. {{Issue_Type}}. Please resolve.`

---

#### **Card 3.4: Resolution & Re-provisioning (The Recovery)**

*Trigger: Brand updates the Key or Instructions.*

* **Header**: Access Resolved  
* **Status**: `✅ Brand has updated your credentials`  
* **New Access Details**:  
  * **New Key/Link**: `{{new_key_or_link}}`  
  * **Updated Note**: `{{brand_resolution_note}}`  
* **Note**: Please attempt to log in again and confirm verification.  
* **Chat Notification**: `[System: Brand has updated access details. {{creator_handle}} must verify to proceed.]`

---

#### **Card 3.5: Access Deadlock (2nd Strike \- Terminal)**

*Trigger: `fulfillment_issue_count == 2`.*

* **Header**: Access Deadlock  
* **Status Badge**: `🚨 Terminated: Technical Failure`  
* **Body**: Digital credentials have failed to authenticate twice. This collaboration has been automatically closed to prevent further delays.  
* **Section 1: Payment Return State (Conditional)**  
  * **IF ESCROW**: `Advance Recovery: The 30% advance (₹{{30%_val}}) will be reversed from your wallet to the brand's vault.`  
  * **IF MANUAL**: `Notice: Collaboration Void. Please settle the recovery of the manual advance (₹{{30%_val}}) with the brand directly.`  
* **Creator Action**: `[Button: Back to Hub]` | `[Button: Contact Support]`  
* **Chat Notification**: `[Center]: 🚨 Deadlock reached. Digital access failed twice. Collaboration Voided.`

---

### **SIDE PANE: EXECUTION CARD (Stage 3 Version \- SaaS)**

* **Section 1: Access Status**  
  * `Method: Digital Provisioning` | `Status: {{Status_Badge}}`  
* **Section 2: Subscription Details**  
  * `Product: {{Product_Name}}` | `Value: {{Access_Value}}`  
* **Section 3: Content Deadline**  
  * `Production Window: 72 Hours from Verification`  
* **Section 4: Quick Actions**  
  * `[Button: Open Platform Link]`  
  * `[Button: Nudge Brand for Access]`

---

### **Technical Logic & Stitch Instructions**

1. **The Production Gate**: The `Stage 4: Production` state remains locked (403 Forbidden) until the API receives the `SUCCESS` callback from **Card 3.2**.  
2. **Strike Tracking**: The `fulfillment_issue_count` increments each time the creator submits **Card 3.3**.  
3. **Automatic Wallet Reversal (Escrow Only)**: If **Card 3.5** (Deadlock) is triggered, the system initiates a `WALLET_DEBIT` on the creator's account for the exact amount of the 30% advance previously released in Stage 2\.  
4. **Literal Fidelity Check**: Ensure the **Success Banner** on the Brand's side: *"✅ Access Verified: {{creator\_handle}} has confirmed access..."* is triggered exactly when the Creator clicks the Primary Action on Card 3.2.

# HEALTHCARE / OFFLINE EXPERIENCES

### **\[WORKFLOW MODULE: 3\. LOGISTICS & OFFLINE VISITS\]**

**\[CREATOR-SIDE UI\]**

**\[LOGIC GATE: HEALTHCARE / OFFLINE CONFIGURATION\]**

#### **Card 3.1: Awaiting Service Details (Holding State)**

*Trigger: Stage 2 complete. Payout secured.*

* **Header:** Service Access Pending  
* **Body:** {{brand\_name}} is preparing your redemption details for the offline service. You will receive your appointment code or arrival instructions here.  
* **Service Summary:**  
  * **Offer Type:** `{{offer_type: e.g., Free Full Body Checkup}}`  
  * **Retail Value:** `₹{{offer_value}}`  
* **Status Badge:** `⏳ Waiting for Brand`

---

#### **Card 3.2: Confirm Your Appointment (Action Required)**

*Trigger: Brand shares the redemption code/instructions.*

* **Header:** Appointment Details Received  
* **Body:** The brand has shared the details for your visit. Please verify the code and follow the instructions to schedule your visit.  
* **Redemption Info:**  
  * **Voucher/Coupon Code:** `[Click to Copy: {{Redemption_Code}}]`  
  * **Arrival Instructions:** `{{Arrival_Instructions: e.g., "Fast for 8 hours before the test."}}`  
* **Scheduling Note:** *"Please coordinate your visit date via chat. Once you have completed the service, return here to confirm."*  
* **Primary Action:** `[Button: ✅ I’ve Visited & Redeemed Service]`  
* **Secondary Action:** `[Button: ❌ Issue with Service/Redemption]` (Starts Issue Cycle)

---

#### **Card 3.3: Report Visit/Service Issue (1st Strike)**

*Trigger: Creator clicks "❌ Issue with Service/Redemption".*

* **Section 4: Report Offline Issue (Form)**  
  * **Issue Type (Dropdown):** \* `Invalid Redemption Code`  
    * `Clinic/Outlet Refused Entry`  
    * `Service Not Available at Location`  
    * `Appointment Cancelled by Provider`  
  * **Details:** `[Text Area: Describe what happened during the visit...]`  
  * **Proof:** `[Uploader: Upload Photo of Outlet or Error Screen]`  
* **Creator Action:** `[Button: Submit Issue to Brand]`  
* **Chat Notification:** `[Right Bubble]: ⚠️ Visit Issue: I encountered an issue at the location. {{Issue_Type}}. Please resolve.`

---

#### **Card 3.4: Resolution & Re-scheduling (The Recovery)**

*Trigger: Brand updates the Code or Instructions.*

* **Header:** Service Issue Resolved  
* **Status:** `✅ Brand has updated service details`  
* **New Details:**  
  * **New Voucher Code:** `{{new_code}}`  
  * **Updated Instruction:** `{{brand_resolution_note}}`  
* **Note:** Please attempt to redeem the service again. Once completed, click 'I've Visited' to unlock Stage 4\.  
* **Chat Notification:** `[System: Brand has updated redemption details. {{creator_handle}} must verify to proceed.]`

---

#### **Card 3.5: Logistics Deadlock (2nd Strike \- Terminal Failure)**

*Trigger: `fulfillment_issue_count == 2`.*

* **Header:** Service Deadlock  
* **Status Badge:** `🚨 Terminated: Service Failure`  
* **Body:** The offline service or redemption has failed twice. This collaboration has been automatically closed to prevent further delays in your production timeline.  
* **Section 1: Payment Return State (Mirroring Brand's Logic)**  
  * **IF ESCROW:** `Advance Recovery: The 30% advance (₹{{30%_val}}) will be reversed from your wallet to the brand's vault.`  
  * **IF MANUAL:** `Notice: Collaboration Void. Please settle the recovery of the manual advance (₹{{30%_val}}) with the brand directly.`  
* **Creator Action:** `[Button: Back to Hub]` | `[Button: Contact Support]`  
* **Chat Notification:** `[Center]: 🚨 Deadlock reached. Offline service failed twice. Collaboration Voided.`

---

### **SIDE PANE: EXECUTION CARD (Stage 3 Version \- Healthcare)**

* **Section 1: Service Status**  
  * `Method: Offline Visit/Redemption` | `Status: {{Status_Badge}}`  
* **Section 2: Offer Details**  
  * `Service: {{offer_type}}` | `Retail Value: ₹{{offer_value}}`  
* **Section 3: Content Deadline**  
  * `Production Lock: Stage 4 remains locked until visit confirmation.`  
* **Section 4: Quick Actions**  
  * `[Button: View Map to Location]`  
  * `[Button: Nudge Brand for New Code]`

---

### **Technical Logic & Stitch Instructions**

1. **The Visit Gate:** The `Stage 4: Production` state **must** remain disabled until the creator clicks the Primary Action on **Card 3.2**. Confirmation of visit is the legal trigger for the "Production Hub."  
2. **Strike Incrementation:** Any submission of **Card 3.3** must increment the `fulfillment_issue_count` in the database.  
3. **Automatic Advance Recovery (Escrow):** Upon reaching the Deadlock (Strike 2), the system must trigger a `WALLET_DEBIT` on the Creator's account to return the 30% advance to the Brand, as the service was never successfully rendered.  
4. **Literal Fidelity Check:** The Brand's "Success Banner" (*"✅ Visit Verified: {{creator\_handle}} has confirmed service completion..."*) should only fire once the Creator confirms receipt on their side.

# 4\. Content Production & Review\]

### **\[WORKFLOW MODULE: 4\. CONTENT PRODUCTION\]**

**\[CREATOR-SIDE UI\]**

#### **LOGIC GATE: BRIEF TYPE**

* **Brand-Led Bypass**: If `brief_type == Brand-Led`, the Scripting phase is auto-skipped.  
* **System Message**: *"Brand-Led Brief detected. Scripting phase skipped. Please proceed to Media Upload."*

---

### **PHASE 1: SCRIPTING (Creator-Led Only)**

#### **Card 4.1: Submit Your Script (Action Required)**

* **Header**: Script Submission  
* **Body**: Draft your creative concept based on the brand’s brief. Once submitted, the brand has 72 hours to approve or request changes.  
* **Form Fields**:  
  * `[Text Area: Script/Concept Outline]`  
  * `[Uploader: Attach Reference/Moodboard]`  
* **Primary Action**: `[Button: Submit Script for Approval]`  
* **Chat Notification**: `[Right Bubble] I've uploaded the script for {{campaign_name}}. Awaiting your review!`

#### **Card 4.2: Script Feedback Received (Revision State)**

*Trigger: Brand clicks "Request Script Changes".*

* **Header**: Script Revision Required  
* **Body**: The brand has requested changes to your script.  
* **Brand's Note**: `{{revision_notes}}`  
* **Primary Action**: `[Button: Submit Updated Script]`  
* **Warning**: `⚠️ Revision 1 of 2. Use this round to align perfectly with the brand voice.`

---

### **PHASE 2: MEDIA PRODUCTION (The Hybrid Uploader)**

#### **Card 4.3: Upload Content (Active State)**

*Trigger: Script Approved OR Brand-Led Brief.*

* **Header**: Production Studio  
* **Body**: Capture and upload your deliverables. Ensure all files meet the technical requirements listed in the brief.  
* **Deliverable Checklist**:  
  * `[Slot 1]: {{Deliverable_Type_1}} (e.g., 1x Reel)` \-\> `[Uploader]`  
  * `[Slot 2]: {{Deliverable_Type_2}} (e.g., 2x Stories)` \-\> `[Uploader]`  
* **Primary Action**: `[Button: Send Content for Review]`  
* **Deadline Tracker**: `⏳ 72:00:00 Remaining to Upload`

---

### **PHASE 3: THE REVISION ENGINE (The Hard Stop)**

#### **Card 4.4: Revision Request (Strike 1\)**

*Trigger: Brand rejects Version 1\.*

* **Header**: Content Revision Required  
* **Status**: `Round 1/2`  
* **Brand’s Feedback**: `{{brand_feedback_v1}}`  
* **Primary Action**: `[Button: Upload Revised Media]`  
* **Secondary Action**: `[Button: Clarify Feedback via Chat]`

#### **Card 4.5: Final Strike (The "Hard Stop" Warning)**

*Trigger: Brand rejects Version 2\.*

* **Header**: 🚨 Final Revision Round  
* **Status**: `Round 2/2 - Hard Stop Active`  
* **Body**: This is your final opportunity to modify the content. If the brand rejects this version, the collaboration will be **Terminated**.  
* **Primary Action**: `[Button: Upload Final Version]`  
* **Instruction**: *"Ensure all feedback from Round 1 is addressed to prevent termination."*

---

### **PHASE 4: TERMINAL STATES**

#### **State A: Content Approved (Success)**

* **Chat Notification**: `[Center: Content Approved 🎉! Deliverables are locked. 70% final payout is staged. Moving to Stage 5: Posting.]`  
* **UI Update**: All upload slots become **Read-Only**.

#### **State B: Collaboration Terminated (Failure)**

*Trigger: Brand clicks \[Reject & Terminate\] after Round 2\.*

* **Header**: 🛑 Collaboration Terminated  
* **Body**: The content failed to meet the brief after 2 revisions.  
* **Section 1: Legal Shield**: `Usage Forbidden: You retain your content, but the brand has no rights to use or publish these assets.`  
* **Section 2: Financial Resolution**: `The 30% advance is retained as a kill-fee. The remaining 70% balance has been returned to the Brand.`  
* **Chat Notification**: `[Center: 🛑 Collaboration Terminated. Final content rejected.]`

---

### **SIDE PANE: EXECUTION CARD (Stage 4 Version)**

* **Section 1: Deliverables Progress**  
  * `{{Approved_Count}} / {{Total_Deliverables}} Locked`  
* **Section 2: The Brief (Persistent Reference)**  
  * `[Button: Open Brief in Split View]`  
* **Section 3: Timeline**  
  * `Auto-Approval Deadline: {{Timestamp}}`  
* **Section 4: Technical Requirements**  
  * `Aspect Ratio: 9:16` | `Min Resolution: 1080p`

---

### **Technical & Stitch Instructions**

1. **The Revision Counter**: The database `revision_count` must increment on every `REJECT` action. At `count == 2`, the UI must inject the **"Hard Stop"** warning (Card 4.5).  
2. **Auto-Approval Trigger**: If the Brand does not interact with the media within 72 hours of the Creator's upload, the system must trigger `status = APPROVED` automatically.  
3. **Kill-Fee Logic**: On termination, the system must **not** attempt to claw back the 30% advance (unlike the Stage 3 Deadlock). The 30% is a "Kill-Fee" for the creator's labor.

# 5\. Final Posting & Analytics

### **\[WORKFLOW MODULE: 5\. FINAL POSTING & ANALYTICS\]**

**\[CREATOR-SIDE UI\]**

#### **LOGIC GATE: OBJECTIVE CHECK**

* **Production-Only Bypass**: If `campaign_objective == 'PRODUCTION_ONLY'`, skip to **Module B: Final Settlement**.  
* **System Message**: *"Production-only objective. Social posting not required. Proceeding to final asset handover and payout."*

---

### **MODULE A: DELIVERY & COMPLIANCE (The Verification Gate)**

*Goal: Creator provides the live links and ad codes required to trigger the final payment.*

#### **Card 5.1: Submit Live Links (Action Required)**

* **Header**: Go Live & Verify  
* **Body**: Your content is approved\! Please post it on the scheduled platforms and share the live links below to initiate the final 70% payout.  
* **Submission Checklist**:  
  * `[Input: Primary Post URL (e.g., Instagram Reel Link)]`  
  * `[Toggle: Link-in-Bio Active? (Yes/No)]`  
  * `[Input: Partnership Ad Code (if applicable)]`  
* **Primary Action**: `[Button: Submit for Verification]`  
* **Status**: `⏳ Awaiting Verification` (Moves to this state after submission)

#### **Card 5.2: Compliance Correction (Discrepancy State)**

*Trigger: Brand clicks "Request Correction" due to missing links or ad codes.*

* **Header**: 🚨 Action Required: Compliance Fix  
* **Body**: The brand could not verify all deliverables. Please fix the following:  
* **Brand’s Note**: `{{discrepancy_details: e.g., "Link-in-bio not found" or "Ad code is invalid"}}`  
* **Primary Action**: `[Button: Re-submit Links]`

---

### **MODULE B: FINAL SETTLEMENT (The 70% Release)**

*Goal: Closing the financial loop once compliance is verified.*

#### **USE CASE A: ESCROW MODE**

* **Card 5.3: Payout Released**  
  * **Header**: Final Payment Success  
  * **Body**: Compliance verified\! The remaining 70% balance has been released from the Vault to your wallet.  
  * **Breakdown**:  
    * **Final Payout (70%)**: `₹{{70%_value}}`  
    * **Status**: `✅ Paid`  
  * **Primary Action**: `[Button: View Wallet Transaction]`

#### **USE CASE B: MANUAL MODE**

* **Card 5.3: Awaiting Final Transfer**  
  * **Header**: Request Final Payment  
  * **Body**: Your work is complete and verified. The brand is now liable to transfer the remaining 70% balance to your registered bank account.  
  * **Amount Due**: `₹{{70%_value}}`  
  * **Status**: `⏳ Waiting for Brand to upload final receipt...`  
* **State: Receipt Uploaded**  
  * **Chat Notification**: `[Center: Brand has uploaded the Final Payout Receipt 📄. Please verify the credit of ₹{{70%_val}} in your account.]`

---

### **MODULE C: PERFORMANCE & ASSET HANDOVER**

#### **Card 5.4: Analytics & Asset Vault**

* **Header**: Performance & Handover  
* **Section 1 (Analytics)**:  
  * *Summary of sync'd metrics (Reach, Engagement) once API pulls data.*  
* **Section 2 (Usage Rights)**:  
  * `Organic Rights: 🟢 Active (Expires: {{date}})`  
  * `Ad Rights: 🟢 Active (Expires: {{date}})`  
* **Section 3 (Vault)**:  
  * `[Button: Download My Approved Assets]` (High-res backup)

---

### **SIDE PANE: EXECUTION CARD (Stage 5 Version)**

* **Section 1: Final Payout Status**  
  * `Total Quote: ₹{{total_quote}}`  
  * `Advance (30%): ✅ Received`  
  * `Balance (70%): {{PAID / PENDING VERIFICATION}}`  
* **Section 2: Live Links Snapshot**  
  * `Primary Post: [Link]` | `Ad Code: {{Code}}`  
* **Section 3: Project Completion**  
  * `Status: 🏁 Project Closing`  
  * `[Button: Download Final Collaboration PDF]` (Updated with all links and payment proofs)

---

### **Technical & Stitch Instructions**

1. **The Payout Trigger**: In Escrow mode, the `transfer_70_percent` function must be cryptographically locked until the Brand's `is_compliance_verified` flag is set to `TRUE`.  
2. **Compliance Loop**: If the Brand nudges for a correction, the 72-hour "Auto-Approval" clock does **not** apply to Stage 5\. Payout remains locked until the Creator fixes the discrepancy.  
3. **Manual Mode Receipt**: Just like Stage 2, the "Project Completed" status for Manual mode is only triggered once the Brand uploads the `final_receipt_url`.  
4. **Production-Only Logic**: If the objective is production-only, Card 5.1 is hidden, and the UI jumps straight to Card 5.3 (Final Settlement) upon the conclusion of Stage 4\.

# 6\. Feedback & Archival

Based on the core logic of the platform's lifecycle, **Stage 6: Feedback & Archival** serves as the "Post-Mortem" and repository phase. Following the **Literal Content Fidelity** rule, we mirror the Brand’s "Review & Vault" structure, focusing on the Creator's internal reputation score and the final organization of assets for their portfolio.

---

### **\[WORKFLOW MODULE: 6\. FEEDBACK & ARCHIVAL\]**

**\[CREATOR-SIDE UI\]**

#### **MODULE A: THE DOUBLE-BLIND REVIEW**

*Goal: To ensure honest feedback. Ratings are only revealed to both parties once both have submitted or after 48 hours.*

**Card 6.1: Rate Your Experience**

* **Header:** Collaboration Complete\! 🏁  
* **Body:** How was your experience working with {{brand\_name}}? Your feedback helps maintain a high-quality community.  
* **Form Fields:**  
  * **Star Rating (1-5):** `[ ⭐⭐⭐⭐⭐ ]`  
  * **Review Categories:** \* *Communication:* `[ ⭐⭐⭐⭐⭐ ]`  
    * *Brief Clarity:* `[ ⭐⭐⭐⭐⭐ ]`  
    * *Payment Promptness:* `[ ⭐⭐⭐⭐⭐ ]`  
  * **Private Comment (Admin Only):** `[Text Area: Anything you’d like the platform to know?]`  
  * **Public Review:** `[Text Area: Share your public feedback for the Brand's profile...]`  
* **Primary Action:** `[Button: Submit Final Review]`

---

#### **MODULE B: THE CREATOR VAULT (Long-Term Storage)**

*Goal: Providing a permanent home for all project-related assets and legal proof.*

**Card 6.2: Archive & Handover**

* **Header:** Project Archives  
* **Body:** Access all final documents and approved media for your records.  
* **The Vault Section:**  
  * **Final Legal PDF:** `[Button: Download Executed Agreement]` (Contains the unique T\&C Hash).  
  * **Payment Summary:** `[Button: Download Tax Invoice/Payment Receipt]`.  
  * **Media Assets:** `[Grid of Thumbnails]` with `[Download All]` option.  
* **Usage Rights Tracker:**  
  * **Current Status:** `🟢 Active`  
  * **Expiry Date:** `{{expiry_date}}`  
  * **Reminder:** *"You will be notified 7 days before ad rights expire for potential renewal."*

---

### **MODULE C: REPUTATION SYNC**

**Card 6.3: Trust Score Update**

* **Header:** Reputation Update  
* **Body:** Based on your performance in this collaboration, your Creator Trust Score has been updated.  
* **Metrics Summary:**  
  * **Timeliness:** `✅ No delays`  
  * **Revision Efficiency:** `✅ 1/2 Revisions used`  
  * **Communication:** `✅ High`  
* **New Trust Score:** `{{New_Score}}` (e.g., 98/100)

---

### **SIDE PANE: EXECUTION CARD (Final Archival Version)**

*This pane becomes the permanent "Project Summary" once the collaboration moves to the 'History' tab.*

* **Section 1: Final Financials**  
  * `Total Payout: ₹{{total_quote}}`  
  * `Method: {{Escrow / Manual}}`  
* **Section 2: Content Summary**  
  * `Deliverables: {{Qty}}x {{Type}}`  
  * `Live Link: [View Post]`  
* **Section 3: Key Contacts**  
  * `Brand Rep: {{Brand_User_Name}}`  
  * `Support Ticket: #{{Ticket_ID}}`  
* **Section 4: Status**  
  * `Status: 📦 ARCHIVED`

---

### **Technical & Stitch Instructions**

1. **Double-Blind Logic:** The `brand_review_text` must be hidden from the Creator's UI until the Creator submits their own `creator_review_text` or 48 hours have passed since project completion.  
2. **Asset Persistence:** Ensure all media in the Vault uses a long-term storage (S3) link that does not expire, as creators often need these for portfolios years later.  
3. **PDF Finalization:** The "Final Collaboration PDF" must now include the **Live Post Link** and **Final Payout Date** to serve as a complete legal record of fulfillment.

---

### **Final Updated 'backend schema- creator collab flow'**

SQL  
\-- Stage 6: Feedback & Archival  
TABLE collaboration\_reviews {  
  id UUID PRIMARY KEY  
  collaboration\_id UUID FOREIGN KEY  
  author\_type ENUM ('BRAND', 'CREATOR')  
    
  rating\_total INT  
  rating\_communication INT  
  rating\_clarity\_promptness INT  
  review\_text TEXT  
  is\_published BOOLEAN DEFAULT FALSE \-- Becomes true when both submit  
}

TABLE creator\_reputation\_log {  
  id UUID PRIMARY KEY  
  creator\_id UUID FOREIGN KEY  
  collaboration\_id UUID FOREIGN KEY  
  score\_change INT  
  reason ENUM ('TIMELY\_DELIVERY', 'LOW\_REVISIONS', 'STRIKE\_ISSUED', 'SUCCESSFUL\_COMPLETION')  
}

# Tab 11

# Phase 1

| \[DESTINATION: COLLABORATIONS\] \[USER PERSPECTIVE: CREATOR-SIDE UI\] 1\. Left Pane: Chat List (Brand Threads) Header: \* Search: \[Input: Search Brands or Campaigns...\] Filter Icon: \[Icon: Tune\] (Subtle) Chat Thread Card (Mock: Summer Skin Campaign): Avatar: \[Brand Logo Placeholder\] Headline: {{Brand Name}} Sub-headline: {{Last message snippet: "Brand sent a counter-offer..."}} Status Badge: \[Chip: Stage 1: Negotiation\] Timestamp: {{5m}}  |
| :---- |

\#\#\# SYSTEM ARCHITECTURE ENGINE: CREATOR-SIDE PHASE 1  
\- Target Scope: Global Multi-Persona Wrap & Pane 1 Configuration  
\- Core Design System Rules: \`creator\_phase1\_copy.txt\`, \`collaboration.master.ts\`, \`AURORA DESIGN SYSTEM v4.1.txt\`, \`gemini.md v2 (1).txt\`

\#\#\# 1\. POLYMORPHIC ROLE SWITCHER WRAPPER (ANTI-REGRESSION)  
\- Do not duplicate files or destroy the existing Brand-Side layout logic. Wrap the top-level parent container context of the \`/collaborations\` workspace layout inside a state-driven variable toggle: \`currentUserRole: 'BRAND' | 'CREATOR'\`.  
\- Default the active rendering track for this session to \`'CREATOR'\`.   
\- Ensure that the universal grid layout skeleton (Desktop 3-Pane split of 25% / 45% / 30% and the Mobile 3-Step state-routing machine) remains structurally untouched, inheriting the exact CSS variable roots previously established.

\#\#\# 2\. PANE 1 ARCHITECTURE RE-BINDING (Creator Context)  
When \`currentUserRole \=== 'CREATOR'\`, dynamically render the leftmost 25% pane utilizing the literal copy strings extracted from \`creator\_phase1\_copy.txt\`:  
\- Search Field Wrapper: Render the search text area tracking input with the exact placeholder: "Search Brands or Campaigns...".  
\- Maintain the subtle \`\[Icon: Tune\]\` element matching your system styling requirements.  
\- Thread List Stack: Generate the scrollable thread wrapper stack populating it with the creator-specific mockup thread displaying:  
  \* Brand Logo placeholder asset.  
  \* Typography Headline ('Satoshi Variable'): "{{Brand Name}}"  
  \* Sub-headline ('Source Sans 3'): "{{Last message snippet: \\"Brand sent a counter-offer...\\"}}"  
  \* Status Badge: Apply a rounded border chip utilizing the light mint background token \`--surface-workflow\` (\#F0FDF4) containing the text: "Stage 1: Negotiation".  
  \* Timestamp: "5m" right-aligned within the component box.

\#\#\# 3\. PERSISTENT NAVIGATION SHELL STANDARDS  
\- Ensure the structural shell sidebar highlights the active menu link \<Collaborations\> with its background tone firmly set to Midnight Black (\`--secondary\` / \#061F23).  
\- Headings must look to 'Satoshi Variable' and all labels or bodies must inherit 'Source Sans 3'. No raw Tailwind strings are permitted.

Verify the conditional integration context internally and output the updated phase code now.

# phase 2

\#\#\# SYSTEM ARCHITECTURE ENGINE: CREATOR PHASE 2  
\- User Perspective: \`currentUserRole \=== 'CREATOR'\`  
\- Scope: Pane 2 (Active Chat Feed Actions) & Pane 3 (Negotiation Cards 1.1, 1.2, 1.3)  
\- Context Hard Gates: \`AURORA DESIGN SYSTEM v4.1.txt\`, \`gemini.md v2 (1).txt\`, \`collaboration.master.ts\`

\#\#\# 1\. PANE 2 WORKFLOW CTA CARD CAROUSEL (State-Driven Multi-Views)  
Inside the continuous scrolling chat feed of Pane 2, render two conditional workflow status layouts based on the active structural state of the negotiation data schema:

\- STATE A (Initial State / No Quote Yet): Render Workflow CTA Card 1  
  \* Icon Asset: \`\[Icon: Request\_Quote\]\`  
  \* Card Typography Title: "Propose Your Quote"  
  \* Body Copy String exactly: "Set your price for the deliverables & rights listed in the brief."  
  \* Action Control: \`\[Button: Submit Quote\]\` (Styled using \`--primary\` \#34D399). Clicking this must set focus and expand Card 1.1 inside Pane 3\.

\- STATE B (Brand Counter-Offer State): Render Workflow CTA Card 2  
  \* Icon Asset: \`\[Icon: Priority\_High\]\`  
  \* Card Typography Title: "Brand Counter-Offer"  
  \* Body Copy String exactly: "₹{{counter\_amount}}" (Bind to \`commercials.counter\_amount\`).  
  \* Action Control: \`\[Button: Review & Respond\]\`. Clicking this must set focus and expand Card 1.2 inside Pane 3\.

\#\#\# 2\. PANE 3 CREATOR EXECUTION HUB BINDINGS (Negotiation Hub)  
Apply the Active Focus Rule strictly inside Pane 3\. Generate three functional creator card structures mapping exactly to the workflow copy specification parameters:

\- Card 1.1: Submit Initial Propose Panel (Active Focus Viewport)  
  \* Header Typography: "Submit Collaboration Quote"  
  \* Sub-headline: "Propose your definitive rate for the campaign deliverables."  
  \* Input Form: Label: "Your Proposed Amount (₹)". Placeholder: "Enter your rate...".  
  \* Control Row: \`\[Button: Send Proposal\]\` \-\> Posts quote card to chat feed. \`\[Button: Cancel\]\` \-\> Collapses module layout.

\- Card 1.2: Respond to Brand Counter Panel  
  \* Header Typography: "Review Counter-Offer"  
  \* Sub-headline: "The brand proposed a revised rate lock structure."  
  \* Display Field: "Brand's Counter Offer: ₹{{counter\_amount}}"  
  \* Action Row:   
    1\. \`\[Button: Accept Rate\]\` \-\> Updates state framework, advances current\_stage directly to 'SECUREMENT'.  
    2\. \`\[Button: Propose New Counter\]\` \-\> Conditional trigger. Opens Card 1.3 inline if \`round\_count \< 2\`.

\- Card 1.3: Creator Counter-Offer Input Panel  
  \* Input Field: Label: "Your Final Counter (₹)". Placeholder: "Enter amount...".  
  \* Hard Warning Notification Block: "⚠️ Final Round Notice: Counter-offers are capped at a maximum of 2 rounds. This is round {{round\_count \+ 1}} of 2."  
  \* SYSTEM ACCURACY COLOR ENFORCEMENT: Wrap this warning block inside an inline alert layout container colored strictly with \`--status-warning\` (\#FFF6F6 / Light Pink background). Do not use yellow, amber, or orange text/background configurations.  
  \* Control Row: \`\[Button: Submit Counter Offer\]\` \-\> Increments \`round\_count\` state variable.

\#\#\# 3\. TWO-ROUND BOUNDARY LOCK ENFORCEMENT (BR-02 Compliance)  
\- Evaluate data state \`commercials.round\_count \=== 2\`. If this rule resolves to true, programmatically strip out and disable the "\[Propose New Counter\]" interaction button inside Card 1.2.   
\- Apply background state styling \`--disabled-bg\` (\#F3F4F6) with text colors shifted to Muted Grey (\#6B7280).

\#\#\# 4\. MULTI-VIEWPORT RESPONSIVE RENDERING MATRIX  
\- Maintain smooth layout performance. For mobile breakdown layers (\< 1024px), when the creator taps either chat CTA card inside Pane 2, programmatically route view state tracking \`mobileViewStep \=== 'EXECUTION'\` to reveal Pane 3 context at 100% viewport width with a top-bar "\[Back to Chat\]" layout anchor item.

Verify 1:1 text accuracy and execute the updated Phase 2 workspace layout configuration code now.

# Phase 3

| \[WORKFLOW MODULE: 2\. Securement\] \[USER PERSPECTIVE: CREATOR-SIDE UI\] Card 2.1: Escrow Securement Tracker Header: Milestone Deposit Secured Sub-headline: The brand has funded your contract milestone. Work pathways are safe to initiate. Financial Securement Matrix: \* Locked Upfront Advance (30%): ₹9,000 \* Locked Final Settlement (70%): ₹21,000 \* Guaranteed Contract Pool: ₹30,000 System Legal Notice: "Funds are verified inside an independent, multi-tenant escrow vault. This allocation releases programmatically to your wallet upon verifiable step completion gates." Primary Action: \[Button: Accept Contract & Unlock Brief\] \-\> Updates stage to LOGISTICS Card 2.2: Bank Account Onboarding (Manual Mode Variant) Conditional Render: Active only if payout\_mode \== 'MANUAL'. Header: Local Payout Account Ingestion Sub-headline: This brand settles milestones manually. Register your exact local coordinates to clear distribution channels. Form Field Group: \* Label: Beneficiary Account Name   \- Input: \[Input: Enter exact legal bank name...\] \* Label: Core Routing Code (IFSC / SWIFT)   \- Input: \[Input: Enter routing token...\] \* Label: Complete Account Identification Number   \- Input: \[Input: Enter account number...\] Warning System Alert (Inline Gate): 🚨 Registration Mandatory: Manual payment clearing requires verified profile coordinates. Logistics paths remain locked until data payload parameters are successfully committed. Action Slot: \[Button: Save Coordinates & Request Clearances\]  |
| :---- |

\#\#\# SYSTEM ARCHITECTURE ENGINE: CREATOR PHASE 3  
\- User Perspective: \`currentUserRole \=== 'CREATOR'\`  
\- Scope: Pane 3 (Execution Hub) \- Stage 2 (Securement) Implementation  
\- Core Context Enforcers: \`creator\_phase3\_copy.txt\`, \`collaboration.master.ts\`, \`AURORA DESIGN SYSTEM v4.1.txt\`, \`gemini.md v2 (1).txt\`

\#\#\# 1\. ACTIVE FOCUS RENDERING GATEWAY (gemini.md §14)  
\- Enforce the Active Focus Rule continuously. When the collaboration lifecycle transitions to the 'SECUREMENT' phase, collapse all Phase 2 negotiation elements into flat summary header bands. Expand only the active Creator Securement cards inside Pane 3\.

\#\#\# 2\. POLYMORPHIC REVENUE VERIFICATION ROUTING (collaboration.master.ts Check)  
Parse the state variable \`payout\_mode\` from your master Zod configuration data and dynamically adapt Pane 3:

\- TRACK A (ESCROW ROUTING): If \`payout\_mode \=== 'ESCROW'\`, display Card 2.1 ("Escrow Securement Tracker").   
  \* Map the 30% / 70% locked distribution grid precisely matching the literal copy strings.  
  \* Style the primary action button using the solid \`--primary\` (\#34D399 / Aurora Green) token layer.

\- TRACK B (MANUAL ROUTING): If \`payout\_mode \=== 'MANUAL'\`, display Card 2.2 ("Bank Account Onboarding").  
  \* Render the complete input text area stack (Beneficiary Name, IFSC/SWIFT code, Account Identification Number) using 'Source Sans 3' font typography rules.  
  \* HARD SYSTEM LOCK VALIDATION: Check data parameters. If \`creator\_bank\_details\_id\` is empty or form fields are uncommitted, inject the "Registration Mandatory Alert" banner.   
  \* SYSTEM ACCURACY COLOR ENFORCEMENT: The alert container must apply a background of exactly \`--status-warning\` (\#FFF6F6 / Light Pink). Do not use amber, orange, or yellow backgrounds. Disable the primary "\[Save Coordinates\]" execution button utilizing styling token \`--disabled-bg\` (\#F3F4F6) until validation satisfies.

\#\#\# 3\. CHAT METADATA CONTEXT BINDING  
\- When the creator successfully clicks the active confirmation button within either card pathway, post a synchronized system verification log message to the center chat stream (Pane 2\) and automatically advance the workflow engine state track to 'LOGISTICS'.

\#\#\# 4\. MULTI-VIEWPORT WRAPPER MATRIX  
\- Guarantee clean responsive scaling behavior. For viewports under 1024px, display these active securement modules at 100% full screen width when the app routes \`mobileViewStep \=== 'EXECUTION'\`. Provide a persistent header navigation element reading "\[Back to Chat\]" to reverse routing cleanly.

Verify all string entries output 1:1 with the provided copy file text and compile the Phase 3 logic block now.

# phase 4

| \[WORKFLOW MODULE: 3\. Logistics\] \[USER PERSPECTIVE: CREATOR-SIDE UI\] Card 3.1: Inbound Fulfillment Tracker Header: Inbound Dispatch Monitor Sub-headline: Track physical courier shipments, software environment invites, or medical vouchers required for your review. Polymorphic Parameter Manifest: \* IF industry \== 'D2C':   \- Label: Assigned Courier Partner   \- Value: {{courier\_name}}   \- Label: Active Tracking Reference   \- Value: {{tracking\_id}}   \- Action Element: \[Button: Track Courier Package\] \* IF industry \== 'SAAS':   \- Label: Digital Access Portal Provisioning   \- Value: "Credentials generated by brand operator."   \- Action Element: \[Button: Launch Software Environment\] \* IF industry \== 'HEALTHCARE':   \- Label: Safe Dispensing Credentials / Voucher Code   \- Value: "Dispensing pass ready for collection."   \- Action Element: \[Button: View Pharmacy Barcode\] Primary Confirmation Trigger: \* \[Button: Confirm Delivery & Content Assets Ready\] \-\> Updates status to PRODUCTION Card 3.2: Flag Delivery Exception Header: Report Fulfillment Issue Sub-headline: Did you encounter a delivery failure, damaged item, or faulty access link? Select Error Variant: \[Dropdown: Select Issue \- Damaged | Invalid Code | Lost | Tech Error | No Show\] Action Row: \* \[Button: Log Production Exception\] \-\> Increments fulfillment\_issue\_count, alerts brand. \-------------------------------------------------------------------------------- \[WORKFLOW MODULE: 4\. Production\] \[USER PERSPECTIVE: CREATOR-SIDE UI\] Card 4.1: Creative Submission Vault Header: Content Asset Pipelines Sub-headline: Upload your raw production draft files matching your campaign execution guide boundaries. Asset Ingestion Matrix: \* Target Deliverable Format: {{deliverable\_type}} (e.g., Reel / Story) \* File Dropzone Frame: \[Upload Input: Drag and drop high-res video file...\] \* Technical Status Indicator: \[Badge: Aspect Ratio 9:16 Verification: Pending / Cleared\] Action Row: \* \[Button: Transmit Content Draft\] \-\> Submits file path to production schema, notifies brand. Card 4.2: Brand Revision Directive Panel Conditional Render: Active only if production status is 'REJECTED'. Header: Action Required: Required Technical Adjustments Sub-headline: The brand manager has requested modifications before clearing publishing pipelines. Feedback Stream: \* Brand Correction Script: "{{brand\_review\_text}}" Warning Constraint Frame: 🚨 Revision Limit Advisory: Project guidelines enforce a maximum boundary of 2 revision cycles. This is correction round {{revision\_count}} of 2\. Action Slot: \[Button: Acknowledge & Open Upload Window\] \-\> Collapses to Card 4.1 layout for re-upload.  |
| :---- |

\#\#\# SYSTEM ARCHITECTURE ENGINE: CREATOR PHASE 4  
\- User Perspective: \`currentUserRole \=== 'CREATOR'\`  
\- Scope: Pane 3 (Execution Hub) \- Stage 3 (Logistics) & Stage 4 (Production) Implementation  
\- Context Hard Gates: \`creator\_phase4\_copy.txt\`, \`collaboration.master.ts\`, \`AURORA DESIGN SYSTEM v4.1.txt\`, \`gemini.md v2 (1).txt\`

\#\#\# 1\. ACTIVE FOCUS ACCORDION MANAGEMENT (gemini.md §14)  
\- Enforce the Active Focus Rule strictly inside Pane 3\. The workspace layout must only expand the single active module block ('LOGISTICS' or 'PRODUCTION'). The opposite or alternative steps must collapse into minimal, un-expanded summary title headers.

\#\#\# 2\. STAGE 3 POLYMORPHIC CREATOR LOGISTICS (collaboration.master.ts)  
Read the underlying workspace \`industry\` variable and dynamically present Card 3.1 variables:  
\- IF \`industry \=== 'D2C'\`: Display the brand-provided Courier Name and Tracking ID values. Render the "\[Track Courier Package\]" utility button.  
\- IF \`industry \=== 'SAAS'\`: Strip courier details and display the Software Portal link button.  
\- IF \`industry \=== 'HEALTHCARE'\`: Hide product tracking and display the Pharmacy Barcode button.  
\- EXCEPTIONAL TWO-STRIKE DEADLOCK PROTOCOL (BR-03): Clicking "\[Button: Log Production Exception\]" increments \`fulfillment\_issue\_count\`. If \`fulfillment\_issue\_count \>= 2\`, immediately freeze the entire workspace view. Render an un-bypassable alert banner styled strictly with background \`--status-error\` (\#CA0F1C) and text white stating: "LOGISTICS\_DEADLOCK: Two-strike cancellation triggered. Project terminated."

\#\#\# 3\. STAGE 4 PRODUCTION & ASPECT RATIO GATING  
\- Aspect Ratio Canvas Verification: If the workspace asset configuration \`deliverable\_type\` indicates a 'Reel' or 'Story', the video file dropzone must implement an aspect ratio clearance validator flag. If \`is\_aspect\_ratio\_verified \=== false\`, display the status badge inside a clear \`--status-warning\` (\#FFF6F6 / Light Pink background) block reading "Pending" and lock out the primary transmission button.  
\- Two-Revision Hard Stop Protection (BR-04 / Hard-Stop Rule): If the brand manager sets the production state to 'REJECTED', reveal Card 4.2 inline.   
  \* Map the text feedback string exactly into the layout frame.  
  \* Wrap the "Revision Limit Advisory" notice inside a container styled precisely with \`--status-warning\` (\#FFF6F6 / Light Pink background). Do not use yellow or amber under any circumstance.  
  \* CRITICAL REJECTION LOCK: If data variable \`revision\_count \>= 2\` and the file status returns 'REJECTED', completely lock the interface. Strip all re-upload boxes or acknowledgment items. Render a terminal marquee notice: "PRODUCTION\_HARD\_STOP: Final revision boundary exceeded. Contract terminated; 30% advance locked, commercial usage restricted."

\#\#\# 4\. MOBILE LAYOUT & RE-SKIN INTEGRITY  
\- Maintain absolute fidelity to your global variables. Ensure that on narrow viewports (\< 1024px), these cards occupy 100% viewport width when \`mobileViewStep \=== 'EXECUTION'\`. Provide a standard navigation anchor titled "\[Back to Chat\]" to route back to the active message stream.

Verify text string accuracy across all blocks and output the updated creator-side execution code canvas now.

# Phase 5

| \[WORKFLOW MODULE: 5\. Compliance & Posting\] \[USER PERSPECTIVE: CREATOR-SIDE UI\] Card 5.1: Live Link Submission Pipeline Header: Publish & Verify Content Sub-headline: Submit your live publication link to unlock the remaining 70% escrow contract milestone. Input Field Stack: \* Label: Live Content URL Path \* Input: \[Input: Paste live Instagram, TikTok, or YouTube link...\] \* Validation Rule: Link regex must resolve directly to whitelisted provider domains. Status Metrics Grid: \* Link Verification Status: \[Badge: PENDING / SUCCESS\] \* Pending Release Split (70%): ₹21,000 Escrow Locked Warning Alert: ⚠️ Escrow Allocation Restricted: Your milestone settlement remains locked in the vault until the live content link passes validation checks. Manual Settlement Warning Alert: 🚨 Manual Payout Pending: Once you submit your link, the brand operator must manually upload their wire transfer receipt string to clear your payment. Action Row: \* \[Button: Submit Link for Verification Scan\] \-\> Runs domain validation \* \[Button: Claim Milestone Payout\] \-\> Moves current\_stage to FEEDBACK\_SYNC \-------------------------------------------------------------------------------- \[WORKFLOW MODULE: 6\. Feedback & Archival\] \[USER PERSPECTIVE: CREATOR-SIDE UI\] Card 6.1: Double-Blind Feedback Submission Header: Rate Your Collaboration Experience Sub-headline: Your private feedback ensures high platform standards. Reviews remain double-blind until both parties submit. Feedback Evaluation Categories: \* Communication Rating: "How responsive and professional was the brand manager?" \[1-5 Stars Selection\] \* Clarity & Promptness Rating: "How clear were the requirements and briefs?" \[1-5 Stars Selection\] Internal Text Frame: \* Label: Experience Review Notes \* Placeholder: Share your review notes regarding the collaboration flow... Action Row: \* \[Button: Submit Final Feedback & Complete Project\] \-\> Commits metrics to collaboration\_reviews, pushes layout to Card 6.2 Card 6.2: Final Archival View Header: Collaboration Archived Status Badge: \[Badge: 📦 ARCHIVED\] Final Financials Summary Matrix: \* Total Payout Secured: ₹30,000 \* Method: {{payout\_mode}} Content Vault Summary: \* Deliverables Provided: 1x Reel / Story \* Live Link: \[Link: View Live Post\] System Core Safeguard Lockout: "This collaboration is finalized and archived. Performance logs, asset persistence states, and financial legal histories are frozen inside your permanent vault." Quick Navigation Grid: \* \[Button: Download Final Collaboration PDF\] \* \[Button: Export Transaction Ledger\] \* \[Button: Re-Open Brief Details\]  |
| :---- |

\#\#\# SYSTEM ARCHITECTURE ENGINE: CREATOR PHASE 5  
\- User Perspective: \`currentUserRole \=== 'CREATOR'\`  
\- Scope: Pane 3 (Execution Hub) \- Stage 5 (Compliance & Posting) & Stage 6 (Feedback & Archival)  
\- Core Context Enforcers: \`creator\_phase5\_copy.txt\`, \`collaboration.master.ts\`, \`AURORA DESIGN SYSTEM v4.1.txt\`, \`gemini.md v2 (1).txt\`

\#\#\# 1\. ACTIVE FOCUS ACCORDION LAYOUT (gemini.md §14)  
\- Enforce the Active Focus Rule continuously within Pane 3\. The workspace layout must only expand the single active module card ('POSTING' or 'ARCHIVAL'). The opposite or alternate steps must collapse into thin, un-expanded summary title bands.

\#\#\# 2\. STAGE 5 LINK SUBMISSION & POLYMORPHIC ESCROW GATE  
\- Whitelist Verification Check: Enforce regex verification on the 'Live Content URL Path' text input. If the string entry fails validation against social provider domains (Instagram, TikTok, YouTube):  
  \* Set the "Link Verification Status Badge" into a clear high-contrast warning state.  
  \* Render the "Escrow Locked Warning Alert" text frame exactly as written in the copy file.  
  \* Wrap the warning block inside an absolute inline container layout styled precisely with \`--status-warning\` (\#FFF6F6 / Light Pink background). Do not use amber, yellow, or orange under any circumstance.  
\- HARD PAYOUT TRANSMISSION BLOCK: If \`is\_link\_verified \=== false\`, disable the primary "\[Claim Milestone Payout\]" button using style token \`--disabled-bg\` (\#F3F4F6) and gray out text.  
\- Polymorphic Warning Alternative: Parse the global \`payout\_mode\` parameter. If it evaluates to \`'MANUAL'\`, suppress the escrow warning and display the "Manual Settlement Warning Alert" instead.

\#\#\# 3\. STAGE 6 DOUBLE-BLIND FEEDBACK ARCHITECTURE  
\- Double-Blind Privacy Lock (BR-06 Compliance): Look at the \`collaboration\_reviews\` structural schema block. You are strictly prohibited from showing the brand manager's text (\`brand\_review\_text\`) anywhere on the Creator's layout canvas while \`creator\_review\_text\` remains empty or unsubmitted.  
\- Render Card 6.1 with the exact 2 star-rating selection rows (Communication, Clarity & Promptness) using 'Source Sans 3' text layout metrics.  
\- Clicking primary action button "\[Submit Final Feedback & Complete Project\]" pushes the application workflow engine state variables directly to 'ARCHIVAL'.

\#\#\# 4\. CARD 6.2 ABSOLUTE READ-ONLY TERMINAL ARCHIVE STATE  
\- Move the Active Focus seamlessly to Card 6.2 when the archival transition executes.   
\- Status Badge Injection: Render the status badge precisely as \`\[Badge: 📦 ARCHIVED\]\` using a custom layout layout styled with your mint token background \`--surface-workflow\` (\#F0FDF4).  
\- SYSTEM CORE SAFEGUARD STATE: Switch the entire multi-pane workspace layout matrix (Pane 1, Pane 2, and Pane 3\) into an absolute immutable, read-only layer. Remove all text area handlers, disable input boxes, strip button selectors, and ensure no parameters can be mutated once finalized. Layout the 3 navigation buttons inside the quick grid row using exact labels.

\#\#\# 5\. RESPONSIVE LAYER MATRIX ENFORCEMENT  
\- Verify that on mobile viewport dimensions (\< 1024px), these layout cards expand to full 100% device width when \`mobileViewStep \=== 'EXECUTION'\`. Anchor a sharp header row layout element holding the text navigation item "\[Back to Chat\]" pointing back to the active message stream.

Verify text string accuracy across all blocks and output the finalized Creator-Side Phase 5 workspace configuration now.

# Phase 6

|  |
| :---- |

\#\#\# SYSTEM ARCHITECTURE SYNCHRONIZATION AUDIT: PHASE 6 (FINAL)  
\- Target Scope: End-to-End Multi-Persona Workspace Architecture  
\- Core Objectives: Cross-role structural validation, theme token protection, state leakage prevention, and responsive grid layout optimization.  
\- Dependencies: \`collaboration.master.ts\`, \`AURORA DESIGN SYSTEM v4.1.txt\`, \`gemini.md v2 (1).txt\`

Execute an automated system engineering audit on the unified \`currentUserRole: 'BRAND' | 'CREATOR'\` code canvas. Evaluate layout execution against the following five compliance anchors and output a structured checklist report followed by the finalized, production-ready codebase:

\#\#\# 1\. DUAL-PERSONA ROLE SWITCHER SANITY  
\- Verify the persistent segmented selector bar at the top of the Universal Header Container. Clicking "Brand Workspace" or "Creator Workspace" must cleanly re-route the layout views across all three panes without destroying state, dropping message history, or unmounting foundational structures.  
\- Ensure that switching to 'BRAND' presents the Brand-Side parameters across all stages, and switching to 'CREATOR' correctly presents Creator-Side parameters (e.g., swapping Left Pane search placeholder text from "Search threads..." to "Search Brands or Campaigns..." cleanly).

\#\#\# 2\. STRICT DESIGN TOKEN SYSTEM LOCK DOWN (Aurora System §1.1 & §5.4)  
Locate every single element surface, layout border, text snippet, and status block to ensure complete adherence to pure token values:  
\- Ensure no inline Tailwind strings, generic gray style strings, or custom un-mapped style objects remain.  
\- Audit all warning components across Stages 1 to 6 for BOTH roles (e.g., Counter-offer round cap notices, missing manual bank detail warnings, and content revision request panels). Confirm that they apply a background color of exactly \`--status-warning\` (\#FFF6F6 / Light Pink background). Flag and fix any amber, orange, or yellow style bleed.  
\- Confirm all borders use exactly \`\#E5E7EB\` (--border-default), all disabled fields use exactly \`\#F3F4F6\` (--disabled-bg), and the universal navigation sidebar uses exactly \`\#061F23\` (--secondary / Midnight Black).

\#\#\# 3\. CROSS-ROLE LIGATION & HARD STATE-GATE RE-VERIFICATION  
Audit the cross-persona state constraints to prevent state bypass:  
\- \*\*Negotiation (Stage 1):\*\* Verify \`round\_count \=== 2\` locks out counter-offer capabilities for both the Brand and Creator.  
\- \*\*Logistics (Stage 3):\*\* Verify \`fulfillment\_issue\_count \>= 2\` throws the terminal layout block across both workspace views, halting layout progress.  
\- \*\*Production (Stage 4):\*\* Verify \`revision\_count \>= 2\` \+ 'REJECTED' status strips out all asset submission boxes for the creator and modification text areas for the brand.  
\- \*\*Posting/Compliance (Stage 5):\*\* Verify \`is\_link\_verified \=== false\` restricts final escrow payout buttons for both users.  
\- \*\*Double-Blind Feedback (Stage 6):\*\* Enforce the rule where \`brand\_review\_text\` remains completely masked from the creator UI, and \`creator\_review\_text\` remains masked from the brand UI, until BOTH parties have submitted their respective review fields.

\#\#\# 4\. LITERAL CONTENT FIDELITY MATRIX (gemini.md v2 §2)  
\- Compare text blocks against the previous phase extract sheets. Ensure all headings use 'Satoshi Variable' and all body paragraphs, badges, and text fields use 'Source Sans 3'.  
\- Re-verify that the communication header in Pane 2 remains entirely stripped of voice call and video call icon triggers for both roles.

\#\#\# 5\. MULTI-VIEWPORT WRAPPER HYBRID TESTING (gemini.md v2 §15)  
\- Test responsive breakdown parameters (\< 1024px) for both personas. Verify that the mobile view matrix (\`mobileViewStep\`: 'LIST' | 'CHAT' | 'EXECUTION') stacks rows into single-column containers smoothly.   
\- Ensure touch targets and safety back buttons (" \[Back to Chat\] ", " \[Back to List\] ") function reliably in both Brand and Creator workspaces.

Provide your final architectural evaluation report. If any token regression or rule leakage is detected, correct it inline and render the ultimate, production-complete type-safe file package now.

# Tab 13

