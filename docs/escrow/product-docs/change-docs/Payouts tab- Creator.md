# **MASTER UI COPY SPECIFICATION: CREATOR PAYOUTS TAB**

## **ROUTE PATH:** src/routes/creator/payouts

### **\[FRAMEWORK CONSTRAINT: PERSISTENT SHELL\]**

* **Desktop Layout:** Accessible via the Universal Sidebar \[Icon: Wallet\] Payouts.  
* **Mobile Layout:** Accessible via the Mobile Hamburger Menu or quick-action profile dropdown.

### **MODULE HEADER CONTEXT**

* **Section Title:** Earnings & Payouts Hub  
* **Sub-headline Helper Text:** Track your secured escrow milestones, monitor upcoming bank transfers, and manage your financial compliance documents.

### **ZONE 1: THE FINANCIAL PIPELINE (METRICS SUMMARY)**

**Layout Rule:** A 3-column grid of metric cards. On mobile, this becomes a swipeable horizontal carousel to save vertical space.

* **Metric Card 1: Secured in Escrow**  
  * *Label:* Active Escrow Locks  
  * *Value:* {{ Currency Enum }} {{ total\_escrow\_balance }}  
  * *Context Tag:* 🛡️ Secured across {{ active\_campaign\_count }} active briefs  
  * *Visual Accent:* Border accent in **Matrix Emerald / Green** to signify safety.  
* **Metric Card 2: Processing to Bank**  
  * *Label:* Clearing in Progress  
  * *Value:* {{ Currency Enum }} {{ processing\_balance }}  
  * *Context Tag:* ⏳ Est. Arrival: {{ next\_payout\_date }}  
  * *Visual Accent:* Border accent in **Amber / Yellow** to signify transit.  
* **Metric Card 3: Total Settled Assets**  
  * *Label:* Lifetime Earnings  
  * *Value:* {{ Currency Enum }} {{ lifetime\_cleared\_balance }}  
  * *Context Tag:* Since {{ account\_creation\_year }}

### **ZONE 2: PAYOUT METHOD MANAGEMENT**

**Layout Rule:** A full-width distinct container placed immediately below the financial metrics. Its state changes based on the creator's banking KYC verification.

#### **STATE A: NO BANK CONNECTED (Alert State)**

* **Card Background:** Light Amber / Warning tint.  
* **Header:** ⚠️ Bank Account Setup Required  
* **Body Copy:** "You currently have {{ Currency Enum }} {{ total\_escrow\_balance }} secured in active contracts. Please connect a verified bank account to ensure funds are routed to you immediately upon milestone approval."  
* **Primary Action Button:** \[Solid Dark Charcoal Button\] Add Bank Details $\\rightarrow$ *Triggers secure KYC/Bank Input Modal.*

#### **STATE B: BANK CONNECTED & VERIFIED (Active State)**

* **Card Background:** Clean white/dark neutral with a subtle green verification shield.  
* **Header:** 🏦 Active Payout Method  
* **Bank Details Row:** \* \[Bank Icon\] {{ bank\_name }} (e.g., Chase / HDFC Bank)  
  * Account ending in •••• {{ bank\_account\_last\_4 }}  
  * Status: \[Pill Badge: VERIFIED (Green)\]  
* **Primary Action Link:** \[Ghost Text Link\] Edit or Update Bank Account

#### **STATE C: ACTION REQUIRED (Failed/Rejected KYC)**

* **Card Background:** Light Ruby Pink / Error tint.  
* **Header:** 🚨 Payout Method Suspended  
* **Body Copy:** "Your connected payout method requires attention. Identity verification failed or the routing details were rejected by the clearing network."  
* **Primary Action Button:** \[Solid Ruby Red Button\] Fix Payout Details

### **ZONE 3: THE TRANSACTION LEDGER**

**Layout Rule:** A segmented data table container that organizes funds by their lifecycle stage.

#### **Segmented Navigation Tabs:**

* Active Escrow Pipeline ({{ escrow\_count }})  
* Cleared Payouts ({{ cleared\_count }})  
* Invoices & Taxes

#### **TAB 1: ACTIVE ESCROW PIPELINE**

* **Helper Text:** "Funds currently locked in platform escrow. These will be released to your bank automatically once your deliverables are approved."  
* **Table Columns (Desktop):**  
  * Brand / Campaign (e.g., Solv Skincare \- Summer Drop)  
  * Amount Locked (e.g., $1,500.00)  
  * Milestone Status (e.g., Content Drafting / Awaiting Brand Review)  
  * Action (e.g., \[Button: View Workflow\])

#### **TAB 2: CLEARED PAYOUTS**

* **Helper Text:** "A historical ledger of all funds successfully transferred to your connected bank account."  
* **Table Columns (Desktop):**  
  * Date Cleared (e.g., Oct 12, 2024\)  
  * Brand / Campaign  
  * Net Payout (Gross fee minus platform/tax deductions)  
  * Status (e.g., \[Pill Badge: SETTLED\])  
  * Receipt (e.g., \[Icon: Download PDF\])

#### **TAB 3: INVOICES & TAXES**

* **Helper Text:** "Download auto-generated invoices for your accounting, as well as annual tax withholding documents."  
* **List Layout:**  
  * Monthly Statement: October 2024 $\\rightarrow$ \[Button: Download PDF\]  
  * Annual Tax Form (1099-NEC / Form 16A) \- 2023 $\\rightarrow$ \[Button: Download PDF\]

### **MOBILE ADAPTABILITY (Viewport $\\le$ 768px)**

* **Zone 1 Refactor:** The three metric cards transition into a snap-scroll horizontal carousel.  
* **Zone 2 Refactor:** Bank details compress into a single stacked card. The "Edit" link becomes a full-width mobile button.  
* **Zone 3 Refactor:** Data tables are converted into a vertical list of condensed rows (.row--mobile-asymmetric).  
  * *Mobile Row Display:* \[Brand Avatar\] | Campaign Name | Amount | \[Status Badge\]  
  * Tapping the row opens a bottom-sheet drawer detailing the exact fee breakdowns (Gross, Platform Fee, Net) and transaction IDs.

