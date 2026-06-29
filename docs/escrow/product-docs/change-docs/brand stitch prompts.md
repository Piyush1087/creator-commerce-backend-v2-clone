Here is a structured series of prompts designed for Stitch to build the Brand "Payouts" module.  
Just like before, I have included a "Master Instruction" to protect your existing canvases, and I have added explicit instructions to hydrate the {{ }} variable tags with mock data so Stitch doesn't print literal code on the UI.

### **Pre-Requisite Master Prompt for Stitch**

**Purpose:** To set up the workspace, protect existing screens, and initialize the layout shell for the Brand Payouts page.  
**Master Instruction for Stitch: Brand Payouts Module Build** We are building an entirely new page: "TAB MODULE: Payouts". **CRITICAL RULE:** Do NOT modify, delete, or alter any of the existing Creator Marketplace, Creator Campaigns, or Pricing screens currently on your canvas. Build this on a completely separate layout canvas.  
**Global Shell Setup:**

* Assume a standard Brand User sidebar navigation. Highlight 'Payouts' as the active menu item.  
* **Module Header Context:** Add the Section Title exactly as: "Billing, Escrow & Compliance Hub".  
* Add the Sub-headline Helper Text: "Monitor corporate liquidity reserves, track high-precision multi-tenant escrow allocations, access secure funding rails, and audit statutory tax deductions.".  
* Create a two-column desktop layout below the header (Column Panel 1 on the left, Column Panel 2 on the right).

### **Prompt 1: Column Panel 1 (Capital Liquidity & System Balance)**

**Purpose:** To build the left-hand column containing the real-time financial summary cards and warning banners.  
**Prompt for Stitch: Column Panel 1** Build "A. COLUMN PANEL 1: CAPITAL LIQUIDITY & SYSTEM BALANCE" displaying real-time metrics. Render three vertically stacked Metric Summary Cards, hydrating the variables with realistic mock data:

* **Metric Summary Card 1 (Total Escrow Assets):** Label: "Total Pooled Balance". Value: "\[Icon: Wallet\] USD 0.00 (Syncing with RazorpayX Node...)".  
* **Metric Summary Card 2 (Frozen Campaign Commitments):** Label: "Active Escrow Holds". Style this card with an \[Amber Light Fill\] warning highlight. Add subtext describing total liabilities frozen across "12 live campaigns" (hydrating {{ active\_campaign\_count }}). Value: "USD 45,200.00".  
* **Metric Summary Card 3 (Free Liquid Asset Allocation):** Label: "Liquid Available Balance". Value: "\[Aurora Green Text\] USD 12,500.00" (hydrating currency and balance).  
* **Dynamic Notification Banner Logic (Low Balance Block):** Directly below Card 3, inject a warning banner with a Warning Triangle icon. Text: "You have 3 creator locks stalled due to insufficient available funding assets." (hydrating {{ stalled\_allocations\_count }}). Include a button inside the banner: "\[Button Link: Request Wallet Top-Up from Finance\]".

### **Prompt 2: Column Panel 2 (Funding Rails & Selectors)**

**Purpose:** To build the top half of the right-hand column, containing bank wire credentials and the tab navigation.  
**Prompt for Stitch: Column Panel 2 (Top Half)** Build the top section of "B. COLUMN PANEL 2: SECURE FUNDING RAILS & REPORTING LEDGER".

* **Actionable Razorpay Funding Node Block:** Add text input fields for "Secure Bank Transfer Direct Wire Credentials". Render these with realistic mock data in place of variables:  
  * Account Name ➡️ "Aura Escrow Account \- Velvet Skincare Co.".  
  * Corporate Account Number ➡️ "22334455667788".  
  * Bank Routing IFSC Code ➡️ "RAZX0000123".  
  * UPI Link String ➡️ "velvet.escrow@razorpay".  
  * Add an Inline Action Element: "\[Button: Copy Funding Node Details\]". Add hover state text next to it: "➔ \[Green Light Check\] Details Copied\!".  
* **Transaction History Ledger Segmented Selectors:** Below the credentials, create a horizontal tab navigation row with four tabs:  
  * Tab 1: All Capital Movements \[Icon: Layer Group\] (Set this as the Active state).  
  * Tab 2: Active Escrow Locks \[Icon: Lock\].  
  * Tab 3: Cleared Payout Disbursals \[Icon: Check Circle\].  
  * Tab 4: Invoices & Tax Corner \[Icon: Document Text\].

### **Prompt 3: Column Panel 2 (Live History Grid)**

**Purpose:** To render the active data table for Tab 1 (All Capital Movements).  
**Prompt for Stitch: Live History Context Grid Canvas** Build the active table layout for Tab 1 ("All Capital Movements") directly below the segmented selectors.

* **System Helper Text:** Add text above the table: "Chronological tracking of incoming top-ups, outgoing disbursals, asset holds, and platform adjustments.".  
* **Table Layout:** Render a flat data table with the following column headers: Date/Timestamp | Transaction ID Hash | Type | Linked Campaign/Creator Name Context | Precision Amount Metric | Status.  
* **Mock Data Rows:** Populate 3 realistic rows. Example row: "Oct 24, 2026 14:30 | TXN-99882211 | Lock | Sarah Creates / Summer Glow | $1,200.00 | \[Status Badge Pill: Locked\]".  
* **Primary Focus Redirect CTA:** In the far-right column of each row, add an action button. Alternate between "\[Button: Slide Open Sidebar Detail Drawer\]" and "\[Button Link: Jump to Campaign Performance Layout ↗\]".

### **Prompt 4: Sticky Footer & Mobile Constraints**

**Purpose:** To generate the sticky bottom action bar and instruct the system on mobile CSS breakpoints.  
**Prompt for Stitch: Sticky Footer & Mobile Rules** Finalize the module by adding the sticky footer and implementing the specific mobile adaptability rules.

* **MODULE STICKY FOOTER BASELINE:** Pin a footer to the bottom of the viewport.  
  * **Left-Aligned:** Add "\[Button (Ghost Text Link): Clear Ledger Search Query History Filter Scopes\]".  
  * **Right-Aligned:** Add two buttons: "\[Button (Secondary Outlined): Export Current Filtered Table View to CSV\]" and "\[Button (Solid Aurora Green): Authorize Fast Top-Up Allocation Request\]".  
* **MOBILE ADAPTABILITY COMPACT LAYER RULES (≤ 768px):** Ensure the CSS strictly handles the following responsive rules:  
  * Metrics Summary Block (Panel 1\) transitions into a swipeable carousel container row.  
  * Funding Credentials Zone compresses into a floating card with a single "\[ Copy Banking Wire Node Details \]" button.  
  * Ledger Rows hide the TXN hashes and secondary parameters, mapping only Creator/Campaign Name ➔ Total Amount and a compressed \[Status Badge Pill\].  
  * On mobile, tapping a row slides an edge-to-edge menu drawer upwards housing: "\[ Go to Campaign Layout ↗ \]" and "\[ View Full Financial Sidebar Details \]".  
  * The bottom footer houses a static, full-width action trigger button: "\[ Request Corporate Balance Top-up \]".

