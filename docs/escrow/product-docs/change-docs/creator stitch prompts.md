Here is a structured series of prompts designed for Stitch to build the Creator Payouts tab.  
To ensure Stitch generates realistic UIs instead of printing literal code, I have included strict mock-data hydration instructions directly within each prompt based on the provided specifications.

### **Pre-Requisite Master Prompt for Stitch**

**Purpose:** To set up the workspace, protect your existing Creator screens, and build the global header for the Payouts page.  
**Master Instruction for Stitch: Creator Payouts Tab Build** We are building an entirely new page: "CREATOR PAYOUTS TAB". **CRITICAL RULE:** Do NOT modify, delete, or alter any of the existing Creator Marketplace, Campaign Detail, or Campaigns Command Center screens currently on your canvas. Build this on a completely separate layout canvas.  
**Step 1: Workspace Header**

* Ensure the Desktop Layout is accessible via the Universal Sidebar under the label "\[Icon: Wallet\] Payouts".  
* **Section Title:** Add the header text exactly as: "Earnings & Payouts Hub".  
* **Sub-headline Helper Text:** Add the text: "Track your secured escrow milestones, monitor upcoming bank transfers, and manage your financial compliance documents.".

### **Prompt 1: Zone 1 (Financial Pipeline)**

**Purpose:** To generate the top metric summary cards and enforce the mobile carousel rule.  
**Prompt for Stitch: Zone 1 Financial Pipeline** Build "ZONE 1: THE FINANCIAL PIPELINE (METRICS SUMMARY)" directly below the header.

* **Layout Rule:** Create a 3-column grid of metric cards. Ensure the CSS includes a rule where this becomes a swipeable horizontal carousel on mobile viewports ($\\le$ 768px).  
* **Hydrate all variables with the following mock data:**  
  * **Metric Card 1 (Secured in Escrow):** Label: "Active Escrow Locks". Value: "$ 4,500.00". Context Tag: "🛡️ Secured across 3 active briefs". Visual Accent: Add a border accent in Matrix Emerald / Green to signify safety.  
  * **Metric Card 2 (Processing to Bank):** Label: "Clearing in Progress". Value: "$ 1,200.00". Context Tag: "⏳ Est. Arrival: Oct 15, 2026". Visual Accent: Add a border accent in Amber / Yellow to signify transit.  
  * **Metric Card 3 (Total Settled Assets):** Label: "Lifetime Earnings". Value: "$ 24,500.00". Context Tag: "Since 2024".

### **Prompt 2: Zone 2 (Payout Method Management)**

**Purpose:** To build the bank connection management container and visualize all three of its potential validation states.  
**Prompt for Stitch: Zone 2 Payout Method Management** Build "ZONE 2: PAYOUT METHOD MANAGEMENT" as a full-width distinct container immediately below the financial metrics. Render all three states stacked vertically so we can review the UI logic. Hydrate variables with realistic mock data.

* **STATE A: NO BANK CONNECTED (Alert State):**  
  * Card Background: Light Amber / Warning tint.  
  * Header: "⚠️ Bank Account Setup Required".  
  * Body Copy: "You currently have $ 4,500.00 secured in active contracts. Please connect a verified bank account to ensure funds are routed to you immediately upon milestone approval.".  
  * Primary Action Button: "\[Solid Dark Charcoal Button\] Add Bank Details".  
* **STATE B: BANK CONNECTED & VERIFIED (Active State):**  
  * Card Background: Clean white/dark neutral with a subtle green verification shield.  
  * Header: "🏦 Active Payout Method".  
  * Bank Details Row: "\[Bank Icon\] Chase | Account ending in •••• 5678 | Status: \[Pill Badge: VERIFIED (Green)\]".  
  * Primary Action Link: "\[Ghost Text Link\] Edit or Update Bank Account".  
* **STATE C: ACTION REQUIRED (Failed/Rejected KYC):**  
  * Card Background: Light Ruby Pink / Error tint.  
  * Header: "🚨 Payout Method Suspended".  
  * Body Copy: "Your connected payout method requires attention. Identity verification failed or the routing details were rejected by the clearing network.".  
  * Primary Action Button: "\[Solid Ruby Red Button\] Fix Payout Details".

### **Prompt 3: Zone 3 (Transaction Ledger)**

**Purpose:** To generate the segmented data tables for the funds lifecycle and tax documents.  
**Prompt for Stitch: Zone 3 Transaction Ledger** Build "ZONE 3: THE TRANSACTION LEDGER" as a segmented data table container below Zone 2\.

* **Segmented Navigation Tabs:** Render three tabs: "Active Escrow Pipeline (3)", "Cleared Payouts (14)", and "Invoices & Taxes".  
* **TAB 1: ACTIVE ESCROW PIPELINE (Render as the active tab):**  
  * Helper Text: "Funds currently locked in platform escrow. These will be released to your bank automatically once your deliverables are approved.".  
  * Table Columns & Mock Row: Brand/Campaign ("Solv Skincare \- Summer Drop") | Amount Locked ("$1,500.00") | Milestone Status ("Content Drafting / Awaiting Brand Review") | Action ("\[Button: View Workflow\]").  
* **TAB 2: CLEARED PAYOUTS (Design logic):**  
  * Helper Text: "A historical ledger of all funds successfully transferred to your connected bank account.".  
  * Table Columns & Mock Row: Date Cleared ("Oct 12, 2026") | Brand/Campaign ("Aura Timepieces") | Net Payout ("$850.00") | Status ("\[Pill Badge: SETTLED\]") | Receipt ("\[Icon: Download PDF\]").  
* **TAB 3: INVOICES & TAXES (Design logic):**  
  * Helper Text: "Download auto-generated invoices for your accounting, as well as annual tax withholding documents.".  
  * List Layout: "Monthly Statement: October 2026 $\\rightarrow$ \[Button: Download PDF\]" and "Annual Tax Form (1099-NEC / Form 16A) \- 2025 $\\rightarrow$ \[Button: Download PDF\]".

### **Prompt 4: Mobile Adaptability Rules**

**Purpose:** To enforce the specific structural changes required for viewports $\\le$ 768px.  
**Prompt for Stitch: Mobile Constraints** Apply the following "MOBILE ADAPTABILITY" constraints for viewports $\\le$ 768px:

* **Zone 2 Refactor:** Ensure the bank details card compresses into a single stacked layout. The "Edit" ghost link must expand into a full-width mobile button.  
* **Zone 3 Refactor:** Convert the data tables into a vertical list of condensed rows (.row--mobile-asymmetric).  
* **Mobile Row Display:** The layout must map exactly to: "\[Brand Avatar\] | Campaign Name | Amount | \[Status Badge\]".  
* **Interaction Note:** Build a visual state or note indicating that tapping the mobile row opens a bottom-sheet drawer detailing the exact fee breakdowns (Gross, Platform Fee, Net) and transaction IDs.

