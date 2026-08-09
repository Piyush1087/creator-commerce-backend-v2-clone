# Chat UI

### **\[DESTINATION: COLLABORATIONS\]**

**\[FRAMEWORK CONSTRAINT: PERSISTENT SHELL\]**

* **Universal Sidebar (Desktop):** Active Menu Item: `<Collaborations>`.  
* **Mobile Wrapper:** 3-Step Journey (Chat List → Single Chat → Execution Card).

---

### **1\. Left Pane: Chat List (Contextual Discovery)**

* **Header:** \* **Search:** `[Input: Search threads...]`.  
  * **Filter Icon:** `[Icon: Tune]` (Subtle).  
* **Expanded Filters (Dynamic):** \* **Label:** `Filter By`.  
  * **Dropdown 1:** `{{Campaign Name}}`.  
  * **Dropdown 2:** `{{Product/Brief}}`.  
  * **Dropdown 3:** `{{Workflow Stage}}`.  
* **Chat Thread Card (Mock: @art\_maven):**  
  * **Avatar:** `[Creator Image]`.  
  * **Headline:** `{{Creator Name}} (@{{handle}})`.  
  * **Sub-headline:** `{{Last message snippet...}}`.  
  * **Status Badge:** `[Chip: Step 1: Negotiation]`.  
  * **Timestamp:** `{{2m}}`.

---

### **2\. Centre Pane: Active Chat (Negotiation Stage)**

* **Header (Clickable Area):**  
  * **Title:** `{{Creator Name}} (@{{handle}})`.  
  * **Sub-header:** `Campaign: {{campaign_name}}`.  
  * **Workflow Chip:** `Stage 1 of 6: Negotiation`.  
  * **Interaction:** Clicking header triggers Side Pane: `<About>`.  
* **Chat Feed (WhatsApp Format):**  
  * **Date Splitter:** `[Center Text: Today]`.  
  * **System Notification:** `[Center Text: Step 1: Negotiation Started]`.  
  * **Welcome Message (Auto):** `Congrats @{{handle}}! You're approved for {{campaign_name}}. View your brief and secure your spot here: {{secure_link}}`.  
  * **Creator Message (Left):** `Hi! I’ve reviewed the brief for the Summer Skin Reel. Based on the deliverables, here is my quote for the project.`.  
* **Workflow CTA Card (Negotiation Phase):**  
  * **Icon:** `[Icon: Description]`  
  * **Title:** `Proposed Quote`.  
  * **Body:** `₹30,000`.  
  * **Primary Action:** `[Button: Review Quote]`.  
  * **Logic:** Clicking CTA triggers Side Pane: `<Execution>`.  
* **Footer (Message Input):**  
  * **Icons:** `[Icon: Attach] [Icon: Emoji]`.  
  * **Placeholder:** `Type a message or use / for AI prompts...`.  
  * **Action:** `[Button: Send]`.

---

### **3\. Mobile 3-Step Logic**

* **Step 1 (Chat List):** Full-screen render of **Section 1 (Left Pane)**.  
* **Step 2 (Single Chat):** Full-screen render of **Section 2 (Centre Pane)**.  
* **Step 3 (Action):** Tapping **"Review Quote"** or **Chat Header** navigates to the Execution Card (Side Pane content).

---

### **4\. Outreach Payload (Standardized)**

* **Trigger:** Automated upon Approval in `<Applicants>` tab.  
* **Payload:** `"Congrats @{{handle}}! You're approved for {{campaign_name}}. View your brief and secure your spot here: {{secure_link}}"`.  
* **Word Count:** 16 Words (Adheres to **"20-Word" Outreach Rule**).

# 1\. commercial negotiation

### **\[WORKFLOW MODULE: 1\. COMMERCIAL NEGOTIATION\]**

**\[LOGIC GATE: CAMPAIGN CONSTRUCT\]**

* **If Barter:** This entire module is auto-skipped; proceed to `Stage 2: Contract`.  
* **If Fixed:** Skip to `Card 1.2 (Final Terms)`.  
* **If Negotiable:** Start at `Card 1.1 (Quote Review)`.

---

### ***Card 1.1: Review Creator Quote (The Negotiation Gate)***

* ***Header:** `Review Proposed Quote`*  
* ***Context:** `Creator: {{creator_handle}}` | `Target: ₹{{budget_per_creator}}`*  
* ***Section 1: Product Value (The Sample)***  
* ***Status: `📦 Complimentary Sample: YES`***  
* ***Item: `{{Product_Name}}`***  
* ***Retail Value: `₹{{Product_Price}}`***  
* ***Logic: This reminds the brand that they are giving away inventory in addition to the cash payout.***  
* ***Section 2: Fixed Deliverables (Read-Only)***  
  * *`Main Content: {{Quantity}}x {{Type}} ({{Dimensions}})`*  
    * *(e.g., 1x Instagram Reel \- 9:16)*  
  * *`Stories: {{Quantity}}x ({{Story_Type: Amplify/Custom}})`*  
  * *`Link-in-Bio: {{Yes/No}} for {{Days}} days`*  
* ***Section 3: Usage & Rights (Read-Only)***  
  * *`Ad Permissions: {{Yes/No}} for {{Days}} days`*  
  * *`Organic Reposting: {{Yes/No}} for {{Days}} days`*  
* ***Section 4: Financial Offer***  
  * ***Creator's Total Quote:** `₹{{total_quote_amount}}`*  
  * ***Advance Payment:** `{{fixed_advance_percentage}}% (₹{{calculated_advance}})`*  
  * ***Balance Settlement:** `₹{{calculated_balance}} ({{days_to_settle}} days post-approval)`*  
* ***Brand Actions:***  
  * ***Primary Action:** `[Button: Accept Quote]`*  
  * ***Secondary Action:** `[Button: Send Counter-Offer]`*  
    * *Logic: User can only edit the Total Amount field.*  
  * ***Tertiary Action:** `[Link: Decline Application]`*

---

### ***Card 1.1(b): Review Creator Quote (Final Offer State)*** 

When the Brand opens the Side Pane for a "Final Offer," the UI must change to signal that the "Negotiate" button is now dead.

* **Visual Alert:** A high-contrast **MUI Alert** or **Banner** at the top of the card.  
  * **Copy:** ⚠️ Final Offer: The creator has submitted their best and final rate. No further counter-offers can be sent.

* ***Header:** `Review Proposed Quote`*  
* ***Context:** `Creator: {{creator_handle}}` | `Target: ₹{{budget_per_creator}}`*  
* ***Section 1: Product Value (The Sample)***  
* ***Status: `📦 Complimentary Sample: YES`***  
* ***Item: `{{Product_Name}}`***  
* ***Retail Value: `₹{{Product_Price}}`***  
* ***Logic: This reminds the brand that they are giving away inventory in addition to the cash payout.***  
* ***Section 2: Fixed Deliverables (Read-Only)***  
  * *`Main Content: {{Quantity}}x {{Type}} ({{Dimensions}})`*  
    * *(e.g., 1x Instagram Reel \- 9:16)*  
  * *`Stories: {{Quantity}}x ({{Story_Type: Amplify/Custom}})`*  
  * *`Link-in-Bio: {{Yes/No}} for {{Days}} days`*  
* ***Section 3: Usage & Rights (Read-Only)***  
  * *`Ad Permissions: {{Yes/No}} for {{Days}} days`*  
  * *`Organic Reposting: {{Yes/No}} for {{Days}} days`*  
* ***Section 4: Financial Offer***  
  * ***Creator's Total Quote:** `₹{{total_quote_amount}}`*  
  * ***Advance Payment:** `{{fixed_advance_percentage}}% (₹{{calculated_advance}})`*  
  * ***Balance Settlement:** `₹{{calculated_balance}} ({{days_to_settle}} days post-approval)`*  
* ***Brand Actions:***  
  * ***Primary Action:** `[Button: Accept Quote]`*  
  * ***Secondary Action:** `[Button: Send Counter-Offer]-`* **Disabled/Hidden**.  
  * ***Tertiary Action:** `[Link: Decline Application]`*  
* **Chat Notification:** The WhatsApp-style system message should read: *"@{{handle}} has sent a final quote. Review and decide to move to Contract or Close."*

---

### ***Card 1.2: Finalized Terms (The Confirmation)***

* **Header:** `Total Collaboration Value`  
* **Sub-headline:** `Confirm the total investment (Cash + Product) for this collaboration.`  
* **Total Summary Table:**  
* **Cash Payout:** `₹{{final_amount}}`  
* **Product Value:** `₹{{Product_Price}}`  
* **Total Investment:** `₹{{Sum_of_Cash_and_Product}}`  
* **Payment Mode:** `{{Active_Global_Mode: Escrow OR Manual}}`  
*   
* ***Actions:***  
  * ***Secondary Action:** `[Button: ← Back]`*  
  * ***Primary Action:** `[Button: Confirm & Proceed to Step 2]`*

    

---

### **`Card 1.3: Chat Feed - Status Notification`**

* **`Trigger:`** `Successful agreement of terms.`  
* **`UI Style:`** `WhatsApp-style centered notification.`  
* **`Copy:`** `[System: Commercials locked at ₹{{final_amount}}. Deliverables: {{Brief_Summary}}. Moving to Step 2: Contract]`  
* **`Creator View:`** `[System: Quote accepted! The Brand has moved your collaboration to the Contract stage.]`

---

---

### **\[TECHNICAL GUARDRAILS\]**

### **1\. Dynamic Visibility Guardrails (The "Clean Workspace" Rule)**

To maintain a clutter-free side drawer, the UI must strictly mirror the selections made in the **Add a Brief** module. If a right or deliverable was not toggled "Yes" during setup, it is completely purged from the negotiation view to prevent confusion.

* **Logic:** If Toggle \== No in Brief Setup $\\rightarrow$ Component \= Hidden in Negotiation Card.  
* **Specific Triggers:**  
  * **Link-in-Bio:** If disabled, the "Duration" and "Link Requirement" lines are hidden.  
  * **Organic Reposting Rights:** If disabled, the "Usage Rights" section removes this line item.  
  * **Partnership/Spark Ads:** If disabled, the "Ad Permissions" line item is hidden.  
* **The "Why":** This ensures the Brand User only reviews what they actually requested. It prevents creators from accidentally "quoting" for rights the brand doesn't want to pay for.

---

### **2\. The "One-Strike" Negotiation Policy**

To align with the "Hard Stop" philosophy (similar to your 2-revision limit), the negotiation is limited to **one counter-offer cycle**.

#### **The Logic Flow:**

1. **Initial State:** Creator applies with their **Initial Quote**.  
2. **Brand Action:** Brand can **Accept**, **Decline**, or **Counter-Offer**.  
3. **The Pivot:** If the Brand sends a Counter-Offer, the Creator receives it. They can either **Accept** the Brand's price or send a **Final Counter-Offer**.  
4. **The Final Gate:** Once the Creator sends that second response, it is flagged in the system as is\_final\_offer: true.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**3\. Shipping Trigger:** If the Brand accepts a quote where `Complimentary Sample == Yes`, the system automatically unlocks **Step 3: Shipping & Logistics** after the contract is signed. If `No`, Step 3 is skipped (for Digital/SaaS).  
**Tax/Accounting Note:** Including the retail value here helps the Brand’s finance team track the **Total Marketing Spend** per creator, not just the bank transfer amount.  
**Circuit Breaker Tie-in:** If the collaboration is terminated during "Step 3: Shipping" due to a product failure (legacy rule), the system refers back to the **Product Value** listed here for insurance or replacement tracking.

# 2\. securement

### **\[WORKFLOW MODULE: 2\. SECUREMENT\]**

**\[LOGIC GATE: PAYOUT MODE\]**

* **System Check:** Pulls `global_payout_mode` from Sidebar \> Payouts.  
* **Barter Bypass:** If `Campaign_Type == Barter`, this entire stage is **Auto-Skipped**. System Message: *"Terms secured. Moving to Step 3: Logistics."*

---

### **Use Case A: ESCROW MODE (Platform Managed)**

*Goal: Brand funds the total amount into the platform's "vault" to trigger the collaboration.*

#### **Card 2.1: Funding Required (Active State)**

* **Header:** `Secure Collaboration Funds`  
* **Body:** `To move into production, please fund the agreed quote. Funds are held securely in Escrow and released only after your content approval.`  
* **Summary:** \* `Total to Fund: ₹{{total_quote}}`  
  * `Advance Release (Immediate): ₹{{30%_value}}`  
  * `Final Release (Post-Approval): ₹{{70%_value}}`  
* **Primary Action:** `[Button: Add Funds & Secure]`  
* **Secondary Action:** `[Button: View Master Terms]`

#### **Edge Case: Insufficient Wallet Balance**

* **Trigger:** Brand clicks "Add Funds" but wallet balance is lower than total quote.  
* **UI Overlay:** `Insufficient Balance. You need ₹{{difference}} more to secure this collaboration.`  
* **Action:** `[Button: Top-up Wallet]`

#### **State: Funding Successful (Success State)**

* **Chat Notification:** `[System: Funds Secured in Escrow 🛡️. 30% Advance scheduled for release. Moving to Step 3: Logistics.]`

---

### **Use Case B: MANUAL MODE (Brand Managed)**

*Goal: Brand acknowledges legal liability for direct transfer and prepares to upload the first receipt.*

#### **Card 2.0: Awaiting Creator Bank Details (Alert State)**

#### ***Trigger: Stage 2 starts, Payout Mode is 'Manual', and the Creator has not yet updated their bank profile.***

* #### **Section 1: Product Value**

  * #### **📦 Complimentary Sample: {{YES/NO}} (₹{{Price}})**

* #### **Section 2: Fixed Deliverables**

  * #### **Main Content: {{Quantity}}x {{Type}}**

* #### **Section 3: Usage & Rights**

  * #### **Ad Permissions: {{Yes/No}}**

* #### **Section 4: Financial Action (Disabled)**

  * #### **Alert: ⏳ Pending: Creator Bank Details**

  * #### **Body: You have opted for Manual Payout. We are waiting for @{{handle}} to provide their bank details so you can process the 30% advance.**

  * #### **Advance Due: ₹{{30%\_value}}**

* #### **Brand Action: \[Button: Nudge Creator for Details\]**

  * #### **Logic: Sends a system ping to the creator's notification center.**

* #### **Secondary Action: \[Button: View Master Terms\]**

* #### **Chat Interaction (Brand View)**

* **System Notification**: `[Center: @{{handle}} has been notified to add their bank details. Payout functions are locked until updated.]`  
* **Status Badge Update**: The chat list badge remains `[Step 2: Securement]` but with a sub-label: `Waiting for Creator`.

**Stitch Instructions for Manual Mode Payout:**

The "Confirm Liability" button on the brand side should remain disabled or be replaced by the "Nudge Creator" button until the `creator_bank_details_id` is populated in the `securement_vault` table.

#### 

#### **Card 2.1: Confirm Payment Liability (Active State)**

* **Header:** `Confirm Direct Payment Liability`  
* **Body:** `You have opted for Manual Payouts. By clicking confirm, you acknowledge your responsibility to transfer the 30% advance directly to the creator within {{days}} days.`  
* **Milestone 1 (Advance):** `₹{{30%_value}} due by {{Date}}`  
* **Milestone 2 (Settlement):** `₹{{70%_value}} due after content approval.`  
* **Primary Action:** `[Button: I Confirm Liability & Proceed]`

#### **Edge Case: Delayed Advance Receipt**

* **Trigger:** Brand moves to Step 3 but hasn't uploaded the advance receipt.  
* **Visual Alert (Side Pane):** `⚠️ Missing Receipt: Please upload the transfer receipt for the ₹{{30%_value}} advance to maintain your Brand Trust Score.`  
* **Action:** `[Button: Upload Advance Receipt]`

---

### **Specific Edge Cases (Applicable to Both)**

#### **Edge Case 2: Multi-Brief Synchronization**

* **Scenario:** Brand user is managing 10 creators at once.  
* **Action:** Card 1.2 in the sidebar must explicitly show: `Project: {{Brief_Name}} | Creator: {{Handle}}` to ensure the user doesn't fund the wrong milestone.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

### **Side Pane: Execution Card (Brand View \- Securement)**

*This mirrors the Creator's "Stage 2 Version" but provides the Brand with the necessary payout data.*

* **Section 4: Payout Details**  
  * **Total Agreed Quote**: ₹{{total\_quote}}  
  * **30% Advance**: ₹{{30%\_val}}  
  * **Creator Bank Info**:  
    * *Account Holder:* {{Creator\_Full\_Name}}  
    * *Account Number:* {{Account\_Number}}  
    * *IFSC:* {{IFSC\_Code}}  
  * **Status**: AWAITING RECEIPT

---

### **Technical Guardrails for "Securement" (Stitch Instructions)**

1. **The "Check-out" Pattern:** Treat the Escrow funding card like an e-commerce checkout. It must be high-friction (requires a clear click) because it triggers a financial debit.  
2. **The PDF Generator:** Upon clicking the Primary Action in either mode, the system must generate the **"Collaboration Summary"** (Brief \+ Quote \+ T\&C Hash) and store the URL in `legal_agreement.agreement_pdf_url`.  
3. **Chat Feed Sync:** \* **Escrow:** Center notification should include the **SafePay Badge** icon.  
   * **Manual:** Center notification should include a **Warning icon** if the advance receipt is pending.

# 3\. Logistics & Shipping

# D2C / E-COMMERCE

### **\[WORKFLOW MODULE: 3\. Logistics & Shipping\]**

**\[LOGIC GATE: D2C / E-COMMERCE CONFIGURATION\]**

* **Trigger 1:** Checks `free_product` toggle (Yes/No) from Campaign Setup.  
* **Trigger 2:** Checks `return_after_shoot` toggle (Yes/No) from Campaign Setup.  
* **Trigger 3:** Checks `global_payout_mode` (Escrow/Manual) from Stage 2\.

---

### **State 1: No Free Product (The Bypass)**

*Trigger: `free_product == OFF`. The campaign requires no physical sample.*

* **System Action:** Stage 3 is auto-marked as complete.  
* **System Message (Chat):** `[System: No physical logistics required for this campaign. Digital/Service terms confirmed. Moving to Stage 4: Production.]`  
* **UI Visibility:** The workflow instantly transitions to Stage 4\.

---

### **State 2: Address Capture (Pre-Logistics)**

*Trigger: `free_product == ON` AND `shipping_address == null`.*

**Brand View: Card 3.0 (Holding State)**

* **Header:** `Logistics Preparation`  
* **Status Badge:** `⏳ Awaiting Address`  
* **Body:** `We have prompted {{creator_handle}} to share their shipping address. You will be able to dispatch the product once they provide these details.`  
* **Primary Action:** `[Button: Nudge Creator]`

**Creator View: Card 3.0b (Action Required)**

* **Header:** `Share Shipping Address`  
* **Body:** `To start the logistics process, please provide your delivery details.`  
* **Form Fields:** `Full Name`, `Phone Number`, `Address Line 1`, `Landmark`, `Pincode`, `City & State`.  
* **Primary Action:** `[Button: Share Address & Open Logistics]`

---

### **State 3: Dispatch Details (Brand Action)**

*Trigger: `shipping_address == VERIFIED`.*

**Brand View: Card 3.1**

* **Header:** `Dispatch Sample to Creator`  
* **Sub-headline:** `Send the agreed product to the address verified by the creator.`  
* **Recipient Profile (Read-Only):**  
  * **Name:** `{{creator_real_name}}`  
  * **Address:** `{{full_address_string}}`  
  * **Phone:** `{{phone_number}}`  
* **Form Fields:**  
  * **Courier Partner:** `[Dropdown: FedEx, BlueDart, Delhivery, DHL, Other]`  
  * **Tracking ID:** `[Text Input]`  
  * **Tracking Link:** `[Text Input]`  
* **Primary Action:** `[Button: Confirm Dispatch]`

---

### **State 4: In Transit & Receipt Confirmation**

*Trigger: Brand clicks \[Confirm Dispatch\].*

**Brand View: Card 3.2**

* **Header:** `Package in Transit 🚚`  
* **Body:** `Tracking details have been shared with {{creator_handle}}. The production stage (Stage 4) will unlock once they confirm receipt.`  
* **Summary Table:** Courier: `{{partner_name}}` | Tracking ID: `{{tracking_id}}`  
* **Secondary Action:** `[Button: Edit Tracking Details]`

---

### **State 5: Transit Issues (Strike 1 \- Remediation)**

*Trigger: Creator clicks \[I haven't received the product\].* *Issue Type captured: RTO, Stuck in transit, Wrong/Damaged item.*

**Brand View: Card 3.3 (Issue Resolution)**

* **Header:** `⚠️ Shipment Issue Reported`  
* **Body:** `{{creator_handle}} reported: "{{Issue_Type}}". Please resolve the shipment issue to avoid collaboration deadlock.`  
* **Form Fields:**  
  * **Action Taken:** `[Dropdown: Update Tracking ID, Resending Product, Coordinating with Courier]`  
  * **New Tracking ID:** `[Text Input: Optional]`  
* **Primary Action:** `[Button: Resolve & Update Creator]`

**Chat Notification (Both Parties):**

* `[System: ⚠️ Delivery Issue Flagged. Brand notified to resolve. Note: If a second dispatch attempt fails, this collaboration will be eligible for immediate cancellation.]`

---

### **State 6: Transit Deadlock (Strike 2 \- Terminal Failure)**

*Trigger: Creator clicks \[I haven't received the product\] for the SECOND time.*

**Branch A: Escrow Mode (Platform Managed)**

* **Brand View (Card 3.4a):**  
  * **Header:** `🚨 Terminal Logistics Failure`  
  * **Body:** `The second attempt to deliver the product has failed. As per policy, this collaboration must be cancelled. Funds held securely in Escrow will be refunded.`  
  * **Primary Action:** `[Button: Request Cancellation]`  
* **Resolution Action:** System automatically refunds the `₹{{total_quote}}` to the Brand's wallet upon cancellation.

**Branch B: Manual Mode (Brand Managed)**

* **Brand View (Card 3.4b):**  
  * **Header:** `🚨 Logistics Deadlock: Void Collaboration`  
  * **Body:** `Delivery has failed twice. As you are in Manual Payout mode, this collaboration will be marked as 'Voided'.`  
  * **Primary Action:** `[Button: Confirm Void & Close Collab]`  
* **Resolution Action:** Platform cancels the liability record confirmed in Stage 2\. Alert shown: `⚠️ Advance Recovery: If you transferred the advance manually, please coordinate the reversal directly with the creator.`

---

### **State 7: Return After Shoot (Reverse Logistics)**

*Trigger: `return_after_shoot == ON`. Note: This card specifically unlocks **after** Stage 4 (Content Approval) is completed.*

**Brand View: Card 3.5**

* **Header:** `Sample Return Required`  
* **Body:** `Content has been approved. As per the "Return after shoot" agreement, the creator must now return the sample.`  
* **Primary Action:** `[Button: Generate Return Label]`  
* **Secondary Action:** `[Button: Mark as Returned]`

---

### **Awareness Banners & Alerts**

* **Banner (Warning \- Delayed Dispatch):** `⚠️ High Delay: It has been 4 days since securement. Dispatching the sample is now critical to meeting your campaign timeline.`  
* **Banner (Success \- Receipt Confirmed):** `✅ Product Received: {{creator_handle}} has confirmed receipt. The "Upload Content" portal is now open for the creator.`  
* **Alert (RTO Risk \- Brand):** `🛑 Action Required: Creator has requested an address change in chat. Please verify before dispatching.`

---

### **Technical Guardrails (Stitch Instructions)**

1. **Production Lock:** The "Upload Draft" functionality in the Creator UI must remain strictly disabled until `shipping_logistics.received_at` is populated via the \[Confirm Receipt\] button.  
2. **Address Privacy:** Only display the full shipping address once the collaboration status moves to `SHIPPING`.  
3. **Deadlock Limit:** Limit `delivery_issue_count` to 2\. On the second failure, disable all dispatch inputs and force the Escrow Refund / Manual Voidance resolution paths.  
4. **Chat Feed Sync:**  
   * On Dispatch: `[System: Brand has dispatched the {{Product_Name}}. Tracking: {{Tracking_ID}}]`.  
   * On Receipt: `[System: {{creator_handle}} confirmed receipt of the product. Production started.]`.

# HEALTHCARE / OFFLINE EXPERIENCES

### **\[WORKFLOW MODULE: 3\. LOGISTICS & VISITS\]**

### **TRACK 1: HEALTHCARE / OFFLINE EXPERIENCES**

**\[LOGIC GATE: HEALTHCARE / OFFLINE CONFIGURATION\]**

* **Trigger 1:** Checks `visit_required` toggle (Yes/No) from Campaign Setup.  
* **Trigger 2:** Checks `offer_type` (Discount on treatment, Free treatment, Free consultation) from Setup.  
* **Trigger 3:** Checks `global_payout_mode` (Escrow/Manual) from Stage 2\.

---

### **State 1: No Visit Required (The Bypass)**

*Trigger: `visit_required == OFF`. (e.g., A telemedicine consultation or remote service).*

* **System Action:** Stage 3 is auto-marked as complete.  
* **System Message (Chat):** `[System: No physical visit required for this campaign. Digital service terms confirmed. Moving to Stage 4: Production.]`  
* **UI Visibility:** The workflow instantly transitions to Stage 4\.

---

### **State 2: Service & Offer Provision (Brand Action)**

*Trigger: `visit_required == ON`.*

**Brand View: Card 3.1**

* **Header:** `Service Access Details`  
* **Sub-headline:** `Provide the redemption details for the agreed service.`  
* **Offer Profile (Read-Only):**  
  * **Offer Type:** `{{offer_type: e.g., Free Consultation}}`  
  * **Retail Value:** `₹{{offer_value}}`  
* **Form Fields:**  
  * **Redemption/Coupon Code:** `[Text Input: e.g., HEALTH2024]`  
  * **Arrival Instructions:** `[Text Area: e.g., "Fast for 8 hours, bring ID."]`  
* **Primary Action:** `[Button: Confirm & Share with Creator]`

---

### **State 3: Appointment Scheduling (Mutual Coordination)**

*Trigger: Brand clicks \[Confirm & Share\].*

**Brand & Creator View: Card 3.2**

* **Header:** `Schedule Appointment`  
* **Body:** `Coordinate a date and time for the visit to the center.`  
* **Current Status:** `{{Awaiting Proposal / Proposed / Confirmed}}`  
* **Form Fields:**  
  * **Proposed Date:** `[Date Picker]`  
  * **Proposed Time:** `[Time Picker]`  
* **Primary Action:** `[Button: Confirm Appointment]`  
* **Secondary Action:** `[Button: Request Reschedule]`

---

### **State 4: Scheduling/Visit Issue (Strike 1 \- Remediation)**

*Trigger: Creator/Brand clicks \[Request Reschedule\] OR Creator reports "Service Issue" at the center.* *Issue Types: Center closed, Code invalid, Emergency reschedule.*

**Brand View: Card 3.3 (Issue Resolution)**

* **Header:** `⚠️ Visit Issue Reported`  
* **Body:** `An issue has been flagged: "{{Issue_Type}}". This is your final allowed reschedule or remediation.`  
* **Form Fields:**  
  * **Action Taken:** `[Dropdown: Propose New Slot, Update Redemption Code]`  
  * **New Date/Time:** `[Date/Time Picker]`  
* **Primary Action:** `[Button: Resolve & Update Creator]`

**Chat Notification (Both Parties):**

* `[System: ⚠️ Visit Issue Flagged. Note: If a second reschedule occurs or the visit fails again, this collaboration will be eligible for immediate cancellation.]`

---

### **State 5: Scheduling Deadlock (Strike 2 \- Terminal Failure)**

*Trigger: 2nd Reschedule requested OR 2nd Service Issue reported (e.g., No-Show).*

**Branch A: Escrow Mode (Platform Managed)**

* **Brand View (Card 3.4a):**  
  * **Header:** `🚨 Terminal Visit Failure`  
  * **Body:** `The visit could not be completed after two attempts. As per policy, this collaboration must be cancelled. Funds held in Escrow will be refunded.`  
  * **Primary Action:** `[Button: Request Cancellation]`  
* **Resolution Action:** System automatically refunds `₹{{total_quote}}` to the Brand's wallet.

**Branch B: Manual Mode (Brand Managed)**

* **Brand View (Card 3.4b):**  
  * **Header:** `🚨 Visit Deadlock: Void Collaboration`  
  * **Body:** `The visit has failed twice. As you are in Manual Payout mode, this collaboration will be marked as 'Voided'.`  
  * **Primary Action:** `[Button: Confirm Void & Close Collab]`  
* **Resolution Action:** Platform cancels the liability record confirmed in Stage 2\. Alert shown: `⚠️ Advance Recovery: If you paid the creator an advance, please coordinate the reversal directly.`

---

### **TRACK 2: AI / SAAS**

**\[LOGIC GATE: AI / SAAS CONFIGURATION\]**

* **Trigger 1:** Checks `access_required` toggle (Does the creator need a pro-account/credits?).  
* **Trigger 2:** Checks `global_payout_mode` (Escrow/Manual).

---

### **State 1: Existing Access (The Bypass)**

*Trigger: `access_required == OFF`. (Creator already uses the software).*

* **System Action:** Stage 3 is auto-marked as complete.  
* **System Message (Chat):** `[System: No digital keys required. Creator already has platform access. Moving to Stage 4: Production.]`

---

### **State 2: Provide Digital Access (Brand Action)**

*Trigger: `access_required == ON`.*

**Brand View: Card 3.1**

* **Header:** `Grant Digital Access`  
* **Sub-headline:** `Provide the credentials or license keys for the creator to access the SaaS platform.`  
* **Form Fields:**  
  * **Access Key / Voucher:** `[Text Input: e.g., CREATOR-PRO-2024]`  
  * **Access Link:** `https://www.merriam-webster.com/dictionary/input`  
  * **Special Instructions:** `[Text Area: e.g., "Use the email in your profile."]`  
* **Primary Action:** `[Button: Confirm & Send Access]`

**Creator View: Card 3.1b**

* **Header:** `Awaiting Access Confirmation`  
* **Body:** `The brand has shared access details. Please verify your account/credits.`  
* **Primary Action:** `[Button: I have received access]`  
* **Secondary Link:** `[Link: Report access issue]`

---

### **State 3: Access Issue (Strike 1 \- Remediation)**

*Trigger: Creator clicks \[Report access issue\].* *Issue Types: Invalid Key, Account not upgraded, Login error.*

**Brand View: Card 3.2 (Issue Resolution)**

* **Header:** `⚠️ Access Issue Reported`  
* **Body:** `{{creator_handle}} reported: "{{Issue_Type}}". Please verify the details and provide a replacement key.`  
* **Form Fields:**  
  * **Update Key:** `[Text Input]`  
  * **Internal Note:** `[Text Area]`  
* **Primary Action:** `[Button: Re-send Access Details]`

**Chat Notification (Both Parties):**

* `[System: ⚠️ Access Issue Flagged. Note: If the second attempt fails, the collaboration will be eligible for immediate cancellation to protect both parties.]`

---

### **State 4: Access Deadlock (Strike 2 \- Terminal Failure)**

*Trigger: Creator clicks \[Report access issue\] for the SECOND time.*

**Branch A: Escrow Mode (Platform Managed)**

* **Brand View (Card 3.3a):**  
  * **Header:** `🚨 Final Access Failure`  
  * **Body:** `The second attempt to provide digital access has failed. As per platform policy, this collaboration must now be cancelled. Funds will be returned to your wallet.`  
  * **Primary Action:** `[Button: Request Cancellation]`  
* **Resolution Action:** Escrow vault reverses `₹{{total_quote}}` to Brand Wallet automatically.

**Branch B: Manual Mode (Brand Managed)**

* **Brand View (Card 3.3b):**  
  * **Header:** `🚨 Access Deadlock: Void Collaboration`  
  * **Body:** `Digital access has failed twice. As you are in Manual Payout mode, this collaboration is now being marked as 'Voided'. You are no longer liable for the payments.`  
  * **Primary Action:** `[Button: Confirm Void & Close Collab]`  
* **Resolution Action:** Liability record is nullified. Alert shown for manual advance recovery.

# AI / SAAS

### **\[WORKFLOW MODULE: 3\. DIGITAL ACCESS HANDSHAKE\]**

**\[LOGIC GATE: AI / SAAS CONFIGURATION\]**

* **Source:** Derived from "Industry" and "Fulfillment Method" selected in Campaign Setup.  
* **Access Types:** Extended Trial, Full Pro/Paid Plan Access, Platform Credits, Team Seat License.  
* **Trigger:** Checks global\_payout\_mode (Escrow/Manual) from Stage 2\.

---

### **State 1: Provide Digital Access (Brand Action)**

**Goal:** Brand provides the specific digital credentials agreed upon during negotiation.

**Card 3.1: Grant Digital Access**

* **Header:** Grant Digital Access  
* **Sub-headline:** Provide the credentials or license keys for the creator to access the SaaS platform.  
* **Access Summary (Read-Only):**  
  * **Access Type:** {{Product\_Type: e.g., Full Pro Plan Access}}  
  * **Value/Credits:** {{Value: e.g., 500 Credits / 6 Months}}  
* **Form Fields:**  
  * **Product Key / Voucher:** \[Text Input: e.g., SAAS-PRO-2024\]  
  * **Access/Redemption Link:** https://www.justanswer.com/software/uuslq-redeem-loyalty-points-after-purchase.html  
  * **Special Instructions:** \[Text Area: e.g., "Log in using your registered email to see the credits."\]  
* **Primary Action:** \[Button: Confirm & Send Access\]

---

### **State 2: Verification (Creator Action)**

**Goal:** Creator confirms the digital credentials work to unlock production.

**Card 3.2: Verify Access**

* **Header:** Awaiting Access Confirmation  
* **Body:** The brand has shared your access details. Please verify your account, credits, or license seat to proceed.  
* **Primary Action:** \[Button: I have received access\]  
* **Secondary Link:** \[Link: Report product key issue\]

---

### **State 3: Key/Access Issue (Strike 1 \- Remediation)**

**Goal:** Allow the brand one attempt to fix invalid or non-working credentials.

**Card 3.3: Product Key Issue Flagged**

* **Header:** ⚠️ Access Issue Reported  
* **Body:** {{creator\_handle}} reported: "{{Issue\_Type: e.g., Invalid Key / Credits not reflected}}". Please provide a replacement or verify the link.  
* **Form Fields:**  
  * **Replacement Key:** \[Text Input\]  
  * **Updated Instructions:** \[Text Area\]  
* **Primary Action:** \[Button: Resolve & Update Creator\]

**Chat Notification (Both Parties):**

\[System: ⚠️ Access Issue Flagged. Brand has been notified to provide a replacement. Note: If the second attempt fails, the collaboration will be eligible for immediate cancellation.\]

---

### **State 4: Access Deadlock (Strike 2 \- Terminal Failure)**

**Goal:** Resolve the collaboration if digital access fails a second time.

**Branch A: ESCROW MODE (Platform Managed)**

* **Brand View (Card 3.4a):**  
  * **Header:** 🚨 Final Access Failure  
  * **Body:** The second attempt to provide digital access has failed. As per policy, this collaboration must be cancelled. Funds held in Escrow will be refunded.  
  * **Primary Action:** \[Button: Request Cancellation\]  
* **Resolution Action:** System automatically refunds ₹{{total\_quote}} to the Brand's wallet.

**Branch B: MANUAL MODE (Brand Managed)**

* **Brand View (Card 3.4b):**  
  * **Header:** 🚨 Access Deadlock: Void Collaboration  
  * **Body:** Digital access has failed twice. As you are in Manual Payout mode, this collaboration is now being marked as 'Voided'.  
  * **Primary Action:** \[Button: Confirm Void & Close Collab\]  
* **Alert:** ⚠️ Advance Recovery: If you paid the 30% advance manually, please coordinate the reversal directly with the creator.

---

### **Awareness Banners & Alerts**

* **Banner (Warning \- Delayed Fulfillment):** ⚠️ Fulfillment Pending: It has been 48 hours since securement. Providing access is critical to your campaign timeline.  
* **Banner (Success \- Access Verified):** ✅ Access Verified: {{creator\_handle}} has confirmed access. The "Upload Content" portal is now open.

---

### **Technical Guardrails (Stitch Instructions)**

1. **Production Lock:** The "Upload Draft" functionality in the Creator UI must remain strictly disabled until the creator clicks **\[I have received access\]**.  
2. **Strike Counter:** Maintain a fulfillment\_issue\_count. On count \== 2, disable key inputs and show only the **\[Request Cancellation\]** resolution path.  
3. **Chat Feed Sync:**  
   * **On Key Sent:** \[System: Brand shared access details for {{Product\_Name}}. Key: {{Key\_Sample}}.\]  
   * **On Access Verified:** \[System: {{creator\_handle}} confirmed access. Production started.

# 4\. Content Production & Review\]

\[WORKFLOW MODULE: 4\. Content Production & Review\]

 \[LOGIC GATE: BRIEF TYPE & DELIVERABLES\]

* System Check: Pulls `brief_type` (Brand-Led vs. Creator-Led) and `deliverables_inventory` (Number and type of creatives) from Stage 3\.  
* Brand-Led Bypass: If `brief_type == Brand-Led`, the Script Review stage is Auto-Skipped because the brand already provided the script. System Message: "Brand-Led Brief detected. Moving directly to Media Production."  
* Timeline Tracker: Pulls `days_to_deliver` from Campaign Schedule to set the strict deadline clock.

---

Use Case A: SCRIPT REVIEW (Creator-Led Briefs Only) Goal: Align on the creator's proposed concept before any filming begins. Card 4.1: Awaiting Script (Holding State)

* Header: Production Underway  
* Body: {{creator\_handle}} is drafting the script based on your brief. You will be notified once it is uploaded.  
* Summary:  
  * Brief Type: Creator-Led  
  * Deadline: {{script\_deadline\_date}}  
* Action: \[Button: View Finalized Brief\]

Card 4.2: Script Approval Required (Active State)

* Header: Script Approval Required  
* Body: Review the creative direction before the creator begins filming to ensure alignment with your brand voice.  
* Summary:  
  * Document: \[Integrated PDF/Doc Viewer\]  
  * Reference: \[Toggle: Open Brief Side-by-Side\]  
* Primary Action: \[Button: Approve Script\]  
* Secondary Action: \[Button: Request Script Changes\]

### 1\. If Brand Clicks \[Approve Script\]

* Transition: The collaboration moves from the "Scripting" phase to the "Media Production" phase.  
* Next Card for Brand: Card 4.3: Filming in Progress.  
* State: This is a "Holding State." The Brand is waiting for the Creator to film and upload the high-resolution files into the designated slots (e.g., Reel, Story).

### **2\. If Brand Clicks \[Request Script Changes\]**

* **Transition:** The card remains in a "Revision Pending" state.  
* **Brand Experience:** The card UI updates to show a status badge: `⏳ Awaiting Revised Script`.  
* **Creator Action:** The Creator receives the feedback and must re-upload the script.  
* **Loop:** Once the Creator resubmits the script, the Brand sees **Card 4.2** again, but the status badge updates to `✅ Script Resubmitted`.  
* **\[Approve & Move to Filming\]:** (Recommended path)  
* **\[Request Further Edits\]:** (Only used if the script is still fundamentally wrong).  
* 

---

Use Case B: MEDIA PRODUCTION & DEADLINE TRACKING Goal: Creator uses the integrated upload tool to submit exact deliverables before the clock runs out. Card 4.3: Filming in Progress (Holding State)

* Header: Creator is Filming 🎬  
* Body: The script is approved. {{creator\_handle}} is now using the Integrated Media Uploader to submit the high-resolution deliverables.  
* Summary:  
  * Slot 1: {{creative\_type\_1}} (e.g., 1x Instagram Reel 9:16) \- ⏳ Pending  
  * Slot 2: {{creative\_type\_2}} (e.g., 2x High-Res Carousels) \- ⏳ Pending  
  * Time Remaining: {{days\_remaining}} Days  
* Action: \[Button: Nudge Creator\]

Edge Case 1: Deadline Breach (Late Submission)

* Trigger: The production countdown reaches 0 before the creator uploads all required slots.  
* UI Overlay: 🚨 Timeline Breach: {{creator\_handle}} has missed the submission deadline.  
* Action 1: \[Button: Issue Formal Warning\] (Extends timer by 24h & drops Creator Trust Score)  
* Action 2: \[Button: Cancel Collaboration Without Penalty\]

---

Use Case C: BRAND REVIEW & REVISION CYCLES Goal: Brand reviews uploaded content and provides feedback, strictly limited to two revision rounds. Card 4.4: Review Drafts (Round 1 of 2\)

* Header: Review Deliverables  
* Body: Check the uploaded content against your 'Mandatory Mentions' and 'Visual Direction'. You have 1 revision round available.  
* Summary:  
  * Media Player: \[Integrated Video/Image Preview showing Slot 1 & Slot 2\]  
  * Comments: \[Text Area: Add specific feedback or timestamps for the creator\]  
* Primary Action: \[Button: Approve & Lock\]  
* Secondary Action: \[Button: Request Revision\]

Card 4.5: Final Quality Assessment (Round 2 of 2 \- Hard Stop)

* Trigger: Creator uploads revised content following the first edit request.  
* Header: Final Review (Round 2 of 2\)  
* Body: This is the final revision round. Please review carefully. If the content still does not meet the brief, you must terminate the collaboration.  
* Summary:  
  * Media Player: \[Comparison View: Version 1 vs. Version 2\]  
  * Warning: ⚠️ No further revisions allowed.  
* Primary Action: \[Button: Approve & Lock\]  
* Secondary Action: \[Button: Reject & Terminate\]

Edge Case 2: Auto-Approval Risk

* Trigger: Brand does not review the submitted drafts within 72 hours.  
* UI Overlay: ⏳ Auto-Approval Alert: If no action is taken, this content will be automatically approved in {{hours\_remaining}} to maintain the campaign timeline.

---

Use Case D: TERMINAL STATES & NEXT STEPS Goal: Resolve the workflow based on the final decision made in the Review Hub. State 1: Content Approved (Success State)

* Trigger: Brand clicks \[Approve & Lock\] at any revision round.  
* Chat Notification: \[System: Content Approved 🎉\! The deliverables are locked and 70% final payout is staged. Moving to Step 5: Posting.\]  
* Action: Workflow automatically transitions to Stage 5\.

State 2: Collaboration Terminated (Failure State)

* Trigger: Brand clicks \[Reject & Terminate\] during Round 2 (Hard Stop).  
* Chat Notification: \[System: 🛑 Collaboration Terminated. Content failed to meet the brief after 2 revisions.\]  
* UI State (Card 4.6):  
  * Header: 🛑 Collaboration Terminated  
  * Legal Shield: \[Alert\] Usage Forbidden. You do not have the rights to use or publish any assets from this collaboration.  
  * Financial Resolution: The 30% advance is retained as a kill-fee. The remaining 70% Escrow has been refunded to your wallet.  
* Action: \[Button: View Refund Transaction\]

# 5\. Final Posting & Analytics

### **\[WORKFLOW MODULE: 5\. Final Posting & Analytics\]**

**\[BRAND-SIDE UI\]**

#### **STATE 0: LOGIC GATE (OBJECTIVE CHECK)**

* **Logic:** If `campaign_objective == 'PRODUCTION_ONLY'`, skip to **Module B (Final Settlement)**.  
* **System Message:** *"Production-only objective detected. Social posting verification is not required. Moving to asset handover and final payment."*

---

### **MODULE A: DELIVERY VERIFICATION (Compliance Gate)**

**Goal:** Verify all live links and extended deliverables before funds are released.

#### **Card 5.1: Live Content Verification**

* **Header:** `Live Content Verification`  
* **Sub-headline:** `Review the live links and extended deliverables. Payouts are locked until all items are verified.`  
* **Deliverable Checklist:**  
  * **Primary Post:** `[Icon: Instagram] {{live_link_url}}` — `[Badge: ✅ Verified]`  
  * **Link-in-Bio:** `[Status: ❌ Not Detected]` — *"We couldn't find the link on the creator's profile."*  
  * **Partnership Ad:** `[Code: XJ7-99L-P2]` — `[Button: Copy Code]`  
  * **Branded Collab:** `✅ Partnership Label Active`  
* **Primary Action:** `[Button: Confirm All Live]` — *“Unlocks Final Settlement.”*  
* **Secondary Action:** `[Button: Request Correction]` — *“Nudges creator to fix missing elements.”*

#### **Card 5.2: Delivery Discrepancy (Dispute/Delay State)**

* **Trigger:** Posting date missed OR Link-in-Bio/Ad Code is unfulfilled after 48 hours.  
* **Header:** `🚨 Compliance Issue Detected`  
* **Status Badge:** `Partial Fulfillment`  
* **Alert (MUI Error):** `The posting deadline has passed and/or specific deliverables (Link-in-Bio) are missing.`  
* **Action Selection:**  
  1. **\[Grant 24h Extension\]:** "Keep the current payout terms but extend the deadline."  
  2. **\[Negotiate Deduction\]:** "Proceed to payout with a penalty for the missing items."  
  3. **\[Raise Dispute\]:** "Flag for platform mediation."

---

### **MODULE B: FINANCIAL SETTLEMENT (The Payout)**

**Goal:** Finalize the remaining 70% of the commercial quote.

#### **Card 5.3: Final Milestone Payout**

* **Header:** `Final Milestone Payout`  
* **Body:** `Delivery is verified. Please authorize the final 70% balance to close the collaboration.`  
* **Summary:**  
  * **Total Quote:** `₹{{total_quote}}`  
  * **Paid (Advance):** `₹{{30_value}}`  
  * **Balance Due:** `₹{{70_value}}`  
  * **Adjustment (Penalty):** `-₹{{penalty_value}}` (Only if Deduction was negotiated)  
* **Escrow Mode Action:** `[Button: Release ₹{{final_amount}}]` — *"Funds will be instantly transferred to the Creator’s wallet."*  
* **Manual Mode Action:** `[Button: Upload Final Receipt]` — *"Upload the bank transfer receipt for the final 70%."*

---

### **MODULE C: PERFORMANCE & MEASUREMENT (Long-Term Analytics)**

**Goal:** Track the organic and ad-based performance of the approved content.

#### **Card 5.4: Campaign Performance Dashboard**

* **Header:** `Performance & Usage Rights`  
* **Organic Metrics:**  
  * `Reach: {{reach}}` | `Engagement: {{er}}%` | `Shares: {{shares}}`  
* **Paid Metrics (Partnership Ad):**  
  * `Impressions: {{imps}}` | `CPE: ₹{{cpe}}` | `Conversions: {{conv}}`  
* **Usage Status:**  
  * **Organic Posting Rights:** `🟢 Active` (Expires: {{date}})  
  * **Raw Assets:** `[Button: Download Approved Media]`  
* **Primary Action:** `[Button: Export Final Campaign Report]`

---

### **SPECIAL STATE: PRODUCTION-ONLY CAMPAIGNS**

*Trigger: Used only when the objective is "Production" and no posting is required.*

#### **Card 5.5: Asset Handover & Completion**

* **Header:** `Asset Handover & Closing`  
* **Status Badge:** `Final Delivery Approved`  
* **Body:** `The production-only deliverables were approved in Stage 4. All high-resolution files are secured in the vault.`  
* **Vault:** `[Grid showing all approved JPG/MP4 files with 'Download' buttons]`  
* **Payment Requirement:** `Final 70% payout is required to activate the permanent usage license.`  
* **Primary Action:** `[Move to Final Settlement]`

---

### **System Awareness Banners (Side-Pane)**

* **Unfulfilled Warning:** `⚠️ Pending Deliverables: Link-in-Bio is not yet live. Final payment is restricted.`  
* **Receipt Missing (Manual):** `🚨 Action Needed: Final payout receipt is missing. Upload proof of transfer to complete the project.`  
* **Completion Success:** `🎉 Collaboration Completed: All funds released and usage rights activated.`

# 6\. Feedback & Archival

### **\[WORKFLOW MODULE: 6\. Feedback & Archival\]**

**\[BRAND-SIDE UI\]**

#### **Card 6.1: Rate Your Experience**

* **Header:** `Collaboration Feedback`  
* **Sub-headline:** `Your feedback helps maintain high standards and informs your future hiring decisions.`  
* **Rating Categories (1–5 Stars):**  
  * `Communication:` "How responsive and professional was the creator?"  
  * `Brief Compliance:` "How well did the content follow your Execution Guide?"  
  * `Timeliness:` "Were milestones and final posts delivered on schedule?"  
* **Recommendation Toggle:** \* `Would you work with this creator again?` \[Yes / No\]  
* **Private Note (TextField):** *"Internal notes for your team (not visible to creator)."*  
* **Primary Action:** `[Button: Submit & Archive]`

---

#### **Card 6.2: Final Archival State**

* **Header:** `Collaboration Archived`  
* **Status Badge:** `✅ Finalized`  
* **Body:** `This project is now archived. You can access the deliverables and performance data at any time from your Campaign History.`  
* **Quick Links:**  
  * `[Button: Download All Assets]`  
  * `[Button: View Final Report]`  
  * `[Button: Re-Hire Creator]`

# Tab 11

# phase 0

\#\#\# SYSTEM SEED INITIALIZATION  
\- Target Operational Module: Execution Workflow Engine  
\- Scope: Backend Schema & Validation Layer Seed (Zero Rendering)

\#\#\# OBJECTIVE  
Ingest and completely map out the data structures, relationship rules, conditional mutations, and hard-stop validation constraints provided in the attached backend schema and TypeScript Zod validation file. This logic serves as the permanent, immutable runtime rule-book for all subsequent UI component states, input text fields, form submissions, and structural banners generated across this canvas workspace.

\#\#\# ATTACHED SCHEMATICS & SOURCE TRACKING  
1\. File: \`Unified collaboration document (brand+ creator).txt\` (Provides the underlying SQL database tables, structures, and business rules)  
2\. File: \`collaboration.master.ts\` (Provides the programmatic frontend state validation parameters via Zod definitions)

\#\#\# PARSING DIRECTIONS & COMPONENT MAPPING  
Analyze the provided schemas to build an internal state map that hooks up UI interactions directly to data properties:  
1\. \*\*Stage Controls (\`current\_stage\` / \`WorkflowStageEnum\`):\*\* Track states from \`'STAGE\_1\_NEGOTIATION'\` through \`'STAGE\_6\_FEEDBACK\_SYNC'\`. Every component generated down the line must be tethered to one of these states.  
2\. \*\*Financial Hard Gates (\`commercials\` / \`total\_quote\`):\*\* Enforce that the primary layout actions only pass if \`total\_quote\` matches \`advance\_30\` \+ \`balance\_70\`. If \`payout\_mode \=== 'BARTER'\`, any inputs or buttons dealing with cash totals must lock or collapse to exactly 0\.  
3\. \*\*Logistics Two-Strike Deadlock (\`fulfillment\_issue\_count\`):\*\* Track this counter. If it reaches 2, prepare layout rules to lock out action states and display a terminal cancellation layout.  
4\. \*\*Production Rejection Cap (\`revision\_count\`):\*\* Keep this logic gate in memory. A value of 2 combined with a 'REJECTED' status means subsequent editing actions or "Request Revision" panels must be physically stripped from the layout canvas.  
5\. \*\*Polymorphic Industry Paths (\`industry\` / \`IndustryTypeEnum\`):\*\* Map out fields selectively based on this flag. D2C viewports require shipment tracking layouts, SaaS needs digital access inputs, and Healthcare requires code redemptions.  
6\. \*\*Compliance Validation Regex (\`live\_url\` / \`is\_link\_verified\`):\*\* Cache the validation rule restricting final escrow payouts from activating until URLs pass verification and domain whitelisting (Instagram, TikTok, YouTube).

\#\#\# FAULT HANDLING & RETENTION CONFIRMATION  
\- \*\*No UI Output:\*\* Do not generate any layout mockups, text blocks, or design canvases for this prompt.   
\- \*\*State Integrity:\*\* Confirm that you have fully parsed these logical boundaries and are ready to apply them uniformly to Phase 1 (Layout Shell). Respond with: "System Seed Active. Master Schema and Zod validation parameters successfully compiled into layout constraints."

# Phase 1

| \[DESTINATION: COLLABORATIONS\] \[FRAMEWORK CONSTRAINT: PERSISTENT SHELL\] Universal Sidebar (Desktop): Active Menu Item: \<Collaborations\>. Mobile Wrapper: 3-Step Journey (Chat List → Single Chat → Execution Card). 1\. Left Pane: Chat List (Contextual Discovery) Header: \* Search: \[Input: Search threads...\] . Filter Icon: \[Icon: Tune\] (Subtle). Expanded Filters (Dynamic): \* Label: Filter By . Dropdown 1: {{Campaign Name}} . Dropdown 2: {{Product/Brief}} . Dropdown 3: {{Workflow Stage}} . Chat Thread Card (Mock: @art\_maven): Avatar: \[Creator Image\] . Headline: {{Creator Name}} (@{{handle}}) . Sub-headline: {{Last message snippet...}} . Status Badge: \[Chip: Step 1: Negotiation\] . Timestamp: {{2m}} . 2\. Centre Pane: Active Chat (Negotiation Stage) Header (Clickable Area): Title: {{Creator Name}} (@{{handle}}) . Sub-header: Campaign: {{campaign\_name}} . Workflow Chip: Stage 1 of 6: Negotiation . Interaction: Clicking header triggers Side Pane: \<About\> . Chat Feed (WhatsApp Format): Date Splitter: \[Center Text: Today\] . System Notification: \[Center Text: Step 1: Negotiation Started\] . Welcome Message (Auto): Congrats @{{handle}}\! You're approved for {{campaign\_name}}. View your brief and secure your spot here: {{secure\_link}} . Creator Message (Left): Hi\! I’ve reviewed the brief for the Summer Skin Reel. Based on the deliverables, here is my quote for the project. . Workflow CTA Card (Negotiation Phase): Icon: \[Icon: Description\] Title: Proposed Quote . Body: ₹30,000 . Primary Action: \[Button: Review Quote\] . Logic: Clicking CTA triggers Side Pane: \<Execution\> . Footer (Message Input): Icons: \[Icon: Attach\] \[Icon: Emoji\] . Placeholder: Type a message or use / for AI prompts... . Action: \[Button: Send\] . 3\. Mobile 3-Step Logic Step 1 (Chat List): Full-screen render of Section 1 (Left Pane) . Step 2 (Single Chat): Full-screen render of Section 2 (Centre Pane) . Step 3 (Action): Tapping "Review Quote" or Chat Header navigates to the Execution Card (Side Pane content).  |
| :---- |

\#\#\# 1\. ARCHITECTURAL ANCHOR & STRUCTURAL INTEGRITY  
\- Target Destination: /collaborations  
\- Parent Layout Frame: Persistent Universal Navigation Sidebar active item: \<Global Shell \- Desktop\>  
\- Viewport Engine: Twin Responsive Grid System (Desktop 3-Pane vs Mobile 3-Step Flow)  
\- Foundation Rules: Use the exact structural components and metadata provided in the attached file \`phase1\_layout\_copy.txt\`. Do not introduce arbitrary custom styles or components outside of these explicit guidelines.

\#\#\# 2\. STATE VALIDATION INGESTION  
Rely directly on the attached \`collaboration.master.ts\` file to establish layout conditional states. Ensure that component wrappers are context-aware of the current workflow stages ('NEGOTIATION' through 'ARCHIVAL') and financial constraints.

\#\#\# 3\. DESKTOP WORKSPACE GRID SPECIFICATIONS (Viewport Width \>= 1024px)  
Construct a fixed-height parent workspace layout container (100vh minus parent navigation header offset) distributed horizontally as follows:

1\. UNIVERSAL HEADER CONTAINER (Full Width \- 100%)  
   \- Element Sub-tree: Breadcrumb navigation tracker, Progress lifecycle indicator rail, Stage Tracker text badge.

2\. PANE 1: CONTEXTUAL CHAT LIST (Fixed Width: 25% of workspace width)  
   \- Content Structural Bones: Bind the components directly from Section 1 of \`phase1\_layout\_copy.txt\` (Search input, Tune filter icon, the 3 dynamic dropdown selectors, and the scrollable thread list stack holding the Chat Thread Card).

3\. PANE 2: ACTIVE CHAT FEED (Fixed Width: 45% of workspace width)  
   \- Content Structural Bones: Bind components from Section 2 of \`phase1\_layout\_copy.txt\` (Clickable Header area routing to \<About\>, WhatsApp-format scrollable chat stream, Date splitter layout, the Workflow CTA card box containing the 'Review Quote' action item, and the sticky message input footer).

4\. PANE 3: EXECUTION CARD HUB (Fixed Width: 30% of workspace width)  
   \- Content Structural Bones: An empty state dashboard layout frame optimized to dynamically swap the contextual Step-by-Step execution phase panels. Clicking the 'Review Quote' button in Pane 2 must explicitly mount this third layout view.

\#\#\# 4\. MOBILE WORKFLOW STEP-ROUTING MATRIX (Viewport Width \< 1024px)  
Implement the 3-Step responsive state routing specified in Section 3 of \`phase1\_layout\_copy.txt\`. Do not render a side-by-side split screen on mobile screen sizes. Instead, enforce absolute view transitions controlled by a top-level state variable \`mobileViewStep\`:  
\- If \`mobileViewStep \=== 'LIST'\`: Render Pane 1 (Chat List) at 100% width. Tapping a thread card routes layout to 'CHAT'.  
\- If \`mobileViewStep \=== 'CHAT'\`: Render Pane 2 (Active Chat) at 100% width. Provide a clear text action item "\[Back to List\]" to return state to 'LIST'.  
\- If \`mobileViewStep \=== 'EXECUTION'\`: Render Pane 3 (Execution Hub) at 100% width. Provide an explicit top bar layout item "\[Back to Chat\]" to route back to 'CHAT'.

\#\#\# 5\. LITERAL CONTENT FIDELITY & ANTI-REGRESSION  
\- Keep all structural components locked to the specific names and tokens provided in the copy text file.   
\- Do not summarize strings or invent template items.  
\- Respond with the fully compiled structural framework code.

# Phase 2

\#\#\# SYSTEM ARCHITECTURE ENGINE  
\- Target Destination: /collaborations (Pane 1: Chat List & Pane 2: Active Chat Feed)  
\- Phase Scope: Content Layer Ingestion & Functional Deadlines  
\- Dependencies: \`collaboration.master.ts\`, \`AURORA DESIGN SYSTEM v4.1.txt\`, \`gemini.md v2 (1).txt\`

\#\#\# 1\. SPECIFIC LAYOUT DELETION (CRITICAL REFINEMENT)  
\- Locate the Clickable Creator Profile Header area at the top of Pane 2 (Active Chat Feed).  
\- Locate and completely strip out the video call icon and standard voice call icon from this area. This communication system is not supported. The profile header must present only: Creator Name, Handle, Campaign Name, and the Workflow Stage Chip.

\#\#\# 2\. PANE 1 CONTENT BINDING: CHAT LIST (Literal Copy Compliance)  
Populate the leftmost 25% pane using the strict typography pairings ('Satoshi Variable' for headers, 'Source Sans 3' for body strings):  
\- Input Field: Render a clear text search field with placeholder string exactly: "Search threads..."  
\- Filtering Mechanism: Anchor a static text button with a subtle tune/filter icon reading exactly: "Filter By". Underneath this action button, mount a horizontal grid of 3 distinct custom drop-down element rows:   
  1\. Dropdown 1 Placeholder: "Select Campaign"  
  2\. Dropdown 2 Placeholder: "Select Product/Brief"  
  3\. Dropdown 3 Placeholder: "Select Workflow Stage"  
\- Thread List Stack: Generate a scrollable wrapper area containing a template Chat Card for "@art\_maven" displaying:  
  \* Creator Avatar image placeholder.  
  \* Headline: "Art Maven (@art\_maven)"  
  \* Sub-headline: "Hi\! I’ve reviewed the brief for the Summer Skin..." (Truncated with ellipsis).  
  \* Status Badge: Render a rounded chip style with \`--surface-workflow\` background (\#F0FDF4) containing the text: "Step 1: Negotiation".  
  \* Timestamp: "2m" (Aligned to top right corner).

\#\#\# 3\. PANE 2 CONTENT BINDING: ACTIVE CHAT FEED & MESSAGE STREAM  
Populate the center 45% pane as a continuous, WhatsApp-style chronological message feed:  
\- Clickable Header Area: Bind layout interactions so that clicking this top block shifts focus to state triggers. It must show: Title: "Art Maven (@art\_maven)", Sub-header: "Campaign: Summer Skin Campaign", and a Workflow Chip reading: "Stage 1 of 6: Negotiation".  
\- Date Splitter Element: Render a centered, low-contrast string block reading exactly: "Today".  
\- System Notification Element: Render a centered status alert string block reading exactly: "Step 1: Negotiation Started".  
\- Welcome Message (Automated System Dispatch \- Left Aligned Card):   
  \* Text content: "Congrats @art\_maven\! You're approved for Summer Skin Campaign. View your brief and secure your spot here: secure\_link\_placeholder"  
\- Creator Message (Left Aligned Bubble):   
  \* Text content: "Hi\! I’ve reviewed the brief for the Summer Skin Reel. Based on the deliverables, here is my quote for the project."  
\- Sticky Message Input Footer: Anchor a clean text area at the absolute base of Pane 2 with integrated utility icons \[Attach File\] and \[Emoji Selector\]. Set input placeholder exactly to: "Type a message or use / for AI prompts...". Place a primary action button on the far right reading exactly: "Send" (Styled using \`--primary\` color \#34D399).

\#\#\# 4\. THE STEP 1 WORKFLOW CTA CARD (Pane 2 Flow Gate)  
Directly within the scrollable message feed stream, inject the active Stage 1 Collaboration card structure:  
\- Container Card Layout: Enforce background style \`--surface-card\` (\#FFFFFF) with a solid border framework of \`--border-default\` (\#E5E7EB).  
\- Card Elements:  
  \* Left-side layout icon: \[Description/Document Icon\].  
  \* Text Block: Title: "Proposed Quote", Body Weight Text: "₹30,000".  
  \* Primary Interaction Point: Render a prominent button styled with \`--primary\` (\#34D399) brand color reading exactly: "Review Quote".  
\- Logical Binding Route: Configure the click controller on the "Review Quote" button to dynamically change the state framework. On click, it must reveal and expand \*\*Card 1.1: Negotiation Active\*\* inside Pane 3 (Execution Hub) while collapsing all non-active execution modules to minimal hidden headers.

\#\#\# 5\. MULTI-VIEWPORT MATRIX CONTROL  
\- On Mobile viewports (\< 1024px), ensure that selecting the thread card inside Pane 1 programmatically advances \`mobileViewStep\` state to 'CHAT' (revealing this feed full screen). Tapping the "Review Quote" button inside this feed must transition \`mobileViewStep\` directly to 'EXECUTION' (revealing Pane 3 full screen).

Verify that all strings are printed 1:1 without paraphrasing. Output the updated Phase 2 code canvas now.

# phase 3

| \[WORKFLOW MODULE: 1\. Negotiation\] \[BRAND-SIDE UI\] Card 1.1: Negotiation Active Header: Negotiation Hub Sub-headline: Review the creator's proposed rate and secure the collaboration terms. Data Display Group: \* Creator Quote: ₹30,000 \* Campaign Budget Cap: ₹35,000 Action Row: \* \[Button: Accept Rate\] \-\> Triggers State Change: Move to Stage 2 (Securement) \* \[Button: Make Counter Offer\] \-\> Expands Card 1.2 inline Card 1.2: Counter-Offer Input Panel Conditional Render: Active only if negotiation\_round \< 2\. Input Field: \* Label: Your Counter Offer (₹) \* Placeholder: Enter amount... \* Validation Rule: Must be less than initial creator quote. Warning Alert (Inline): ⚠️ Counter-offers are capped at a maximum of 2 rounds. This is round {{negotiation\_round \+ 1}} of 2\. Action Row: \* \[Button: Submit Offer\] \-\> Increments negotiation\_round, posts system message to chat. \* \[Button: Cancel\] \-\> Collapses back to Card 1.1 view. \-------------------------------------------------------------------------------- \[WORKFLOW MODULE: 2\. Securement\] \[BRAND-SIDE UI\] Card 2.1: Escrow Securement (Milestone Locked) Header: Securement Deposit Required Sub-headline: Fund the securement contract milestone to initiate logistics and content scripting pathways. Breakdown Breakdown Grid: \* Upfront Milestone (30%): ₹9,000 \* Final Settlement (70%): ₹21,000 \* Total Escrow Contract: ₹30,000 System Message Block: "Funds are securely locked in an independent, multi-tenant escrow vault. Payout allocations trigger progressively upon verifiable milestone completion gates." Primary Action: \[Button: Deposit Funds & Sign Contract\] \-\> Updates current\_stage to 'SECUREMENT', posts system verification message to feed. Card 2.2: Bank Account Verification (Manual Mode Bypass) Conditional View: Active only if payout\_mode \== 'MANUAL'. Header: Creator Payment Information Status Banner: 🔒 Locked Archive Field Stack: \* Beneficiary Bank: {{bank\_name}} \* Account Identification: \*\*\*\*\*\*\*\*\*\*\*\*{{last\_four\_digits}} \* Routing Reference Code: {{ifsc\_or\_swift}} Warning Alert (Inline System Gate): 🚨 Action Mandatory: Manual payouts require explicit local validation clearance. You must upload a legal transaction receipt string to bypass escrow routing. Action Slot: \[Button: Verify & Authorize Pipeline\]  |
| :---- |

\#\#\# SYSTEM ARCHITECTURE ENGINE: PHASE 3  
\- Target Scope: Pane 3 (Execution Card Hub) \- Stage 1 & Stage 2 Layout Implementation  
\- Core Dependencies: \`phase3\_execution\_copy.txt\`, \`collaboration.master.ts\`, \`AURORA DESIGN SYSTEM v4.1.txt\`, \`gemini.md v2 (1).txt\`

\#\#\# 1\. ACTIVE FOCUS RENDERING RULES (gemini.md §14)  
\- Apply the Active Focus Rule strictly inside Pane 3: Only one execution workflow card can be expanded and fully interactive at any single time.  
\- All other non-active or upcoming module blocks must remain in a collapsed, minimal layout showing only their clear summary row sub-headers.

\#\#\# 2\. CARD 1.1 & 1.2 ARCHITECTURE (Stage 1: Negotiation Engine)  
\- Initial Viewport: When the "Review Quote" CTA button in Pane 2 is active or clicked, render Card 1.1 ("Negotiation Active") as the primary focused element in Pane 3 using exact strings from the copy file.  
\- Layout Styling: Use \`--surface-card\` (\#FFFFFF) with a solid boundary border of \`--border-default\` (\#E5E7EB). All headings must use 'Satoshi Variable'; body text must use 'Source Sans 3'.  
\- Conditional Inline Action: Clicking "\[Button: Make Counter Offer\]" must expand Card 1.2 inline directly underneath Card 1.1 details.  
\- Zod Integration Rule (collaboration.master.ts): Look at the \`commercials.round\_count\` property. If \`round\_count \=== 2\`, you must programmatically disable the "\[Make Counter Offer\]" button completely. Change its styling background to \`--disabled-bg\` (\#F3F4F6) and gray out the text.  
\- Warning Box Execution: The warning alert text regarding the 2-round cap must be wrapped inside an inline container colored precisely with \`--status-warning\` (\#FFF6F6 / Light Pink). Do not use yellow or amber text/backgrounds.

\#\#\# 3\. CARD 2.1 & 2.2 ARCHITECTURE (Stage 2: Securement Gate)  
\- Transition Rule: Accepting the quote or advancing past the negotiation stage shifts the workspace state engine to 'SECUREMENT'. This automatically collapses the negotiation block to a summary header and shifts Active Focus to the Securement workflow cards.  
\- Polymorphic Payout Routing: Parse the \`payout\_mode\` state field from the Zod configuration:  
  \* Route A (ESCROW): If \`payout\_mode \=== 'ESCROW'\`, display Card 2.1 ("Escrow Securement"). Render the 30% / 70% numeric grid breakdown precisely. Ensure the primary action button uses the solid \`--primary\` (\#34D399 / Aurora Green) theme styling.  
  \* Route B (MANUAL): If \`payout\_mode \=== 'MANUAL'\`, dynamically append and reveal Card 2.2 ("Bank Account Verification") directly inside the workspace view using the data fields specified in the text copy.  
\- Bank Details Warning Lock: If \`payout\_mode \=== 'MANUAL'\` and \`creator\_bank\_details\_id\` evaluates to empty or null, fire an active system gate block inside an inline \`--status-warning\` (\#FFF6F6) layout banner stating that manual registration details are mandatory. Disable the "Verify & Authorize Pipeline" submission action until valid data structures are bound.

\#\#\# 4\. MOBILE WORKSPACE COMPLIANCE  
\- Ensure that on mobile screens (\< 1024px), these active execution cards occupy 100% viewport width when the application state routes \`mobileViewStep \=== 'EXECUTION'\`. Provide a standard layout top-bar element titled "\[Back to Chat\]" pointing back to the active message stream.

Verify text string accuracy across all blocks and return the fully engineered, type-safe responsive code now.

# phase 4

| \[WORKFLOW MODULE: 3\. Logistics\] \[BRAND-SIDE UI\] Card 3.1: Logistics Tracking & Dispatches Header: Logistics Inbound Enforcer Sub-headline: Provision access credentials, tokens, or shipping manifests required to initiate production. Polymorphic Parameter Distribution: \* IF industry \== 'D2C':   \- Label: Courier Partner Name   \- Input: \[Input: Enter courier name...\]   \- Label: Package Tracking ID   \- Input: \[Input: Enter tracking number...\]   \- System Validation Rule: Tracking ID is strictly mandatory for D2C verticals. \* IF industry \== 'SAAS':   \- Label: Digital Access Portal Credentials   \- Input: \[Input: Enter software login or workspace invite link...\] \* IF industry \== 'HEALTHCARE':   \- Label: Safe Dispensing Code / Voucher Redemption Link   \- Input: \[Input: Enter pharmacy collection credentials...\] Action Row: \* \[Button: Dispatch & Transmit Data\] \-\> Saves metrics to logistics object, alerts creator. Card 3.2: Delivery Issue Log & Deadlock Banner Conditional Render: Triggered if creator logs a fulfillment delivery failure. Data Counter Indicator: \* Delivery Failures Recorded: {{fulfillment\_issue\_count}} / 2 Warning Notification Frame: ⚠️ Delivery Exception: The creator flagged a fulfillment issue. Verify addresses or credential strings immediately. Primary Action: \[Button: Clear Exception & Re-issue Payload\] \-------------------------------------------------------------------------------- \[WORKFLOW MODULE: 4\. Production\] \[BRAND-SIDE UI\] Card 4.1: Asset Verification Hub Header: Content Review Pipeline Sub-headline: Inspect submitted assets against your original execution guide constraints. Asset Metadata Metric Group: \* Deliverable Format: {{deliverable\_type}} (e.g., Reel / Story) \* Aspect Ratio Status: \[Badge: 9:16 Canvas Clearance Verified / Pending\] \* Asset Preview Link: \[Link: View Submitted Media File\] Action Row: \* \[Button: Approve & Authorize Payout\] \-\> Moves stage to POSTING \* \[Button: Request Content Revision\] \-\> Opens Card 4.2 inline Card 4.2: Content Revision Request Panel Input Field: \* Label: Structural Correction Feedback Notes \* Placeholder: Provide precise details regarding visual modifications or omissions... Warning Notification Frame: 🚨 Hard Revision Boundary: Collaborations are strictly limited to a maximum of 2 revision rounds. This modification request is round {{revision\_count \+ 1}} of 2\. Action Row: \* \[Button: Issue Revision Request\] \-\> Increments revision\_count, marks production status as REJECTED. \* \[Button: Retract\] \-\> Collapses back to Card 4.1 view.  |
| :---- |

# phase 5

| \[WORKFLOW MODULE: 5\. Compliance & Posting\] \[BRAND-SIDE UI\] Card 5.1: Live Content Compliance Gate Header: Publishing Verification Hub Sub-headline: Verify the live publication link to release the remaining contract settlement milestone. Input Field Stack: \* Label: Live Content URL Path \* Input: \[Input: Paste live Instagram, TikTok, or YouTube link...\] \* Validation Constraint: Links must resolve strictly to whitelisted provider domains. Status Metrics Grid: \* Link Verification: \[Badge: PENDING / SUCCESS\] \* Remaining Release Split (70%): ₹21,000 Unfulfilled Warning Alert: ⚠️ Pending Deliverables: Live content link is not yet verified. Final payment remains restricted. Receipt Missing Alert (Manual Mode Variant): 🚨 Action Needed: Final payout receipt is missing. Upload proof of bank transfer to complete the project. Action Row: \* \[Button: Execute Link Verification Scan\] \-\> Runs domain regex check \* \[Button: Process Final Settlement\] \-\> Releases funds, moves current\_stage to ARCHIVAL \-------------------------------------------------------------------------------- \[WORKFLOW MODULE: 6\. Feedback & Archival\] \[BRAND-SIDE UI\] Card 6.1: Rate Your Experience Header: Collaboration Feedback Sub-headline: Your feedback helps maintain high platform standards and informs your future hiring decisions. Feedback Evaluation Categories: \* Communication Rating: "How responsive and professional was the creator?" \[1-5 Stars Selection\] \* Brief Compliance Rating: "How well did the content follow your Execution Guide?" \[1-5 Stars Selection\] \* Timeliness Rating: "Were milestones and final posts delivered on schedule?" \[1-5 Stars Selection\] Toggle Group: \* Label: Would you choose to work with this creator again? \* Input: \[Toggle Button: Yes / No\] Internal Text Frame: \* Label: Internal Private Team Notes \* Placeholder: Provide internal notes for your team (this content is not visible to the creator)... Action Row: \* \[Button: Submit Feedback & Archive Project\] \-\> Commits metrics, pushes layout to Card 6.2 Card 6.2: Final Archival State Header: Collaboration Archived Status Badge: \[Badge: ✅ Finalized\] Body Copy: This project is now archived. You can access the deliverables, tracking histories, and contract performance data at any time from your permanent Campaign History vault. Quick Navigation Grid: \* \[Button: Download All Project Assets\] \* \[Button: View Final Report Dashboard\] \* \[Button: Re-Hire Creator\]  |
| :---- |

