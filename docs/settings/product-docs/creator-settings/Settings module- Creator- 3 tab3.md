# **UI Copy & Layout Architecture Specifications: Payout Architecture Settings Module**

System Integration: Settings Framework Workspace, Primary Navigation Tab  
Document Classification: Comprehensive UI Copy, Interaction States, and Modal Blueprints

## **1\. Main Header & Navigation Framework**

This framework controls the top-level navigation layout for the centralized platform configuration space, routing financial tracking nodes, localized clearing configurations, and tax documentation infrastructure.

### **Layout Structure**

* **Main Container Frame:** Global settings console featuring a horizontal tabbed navigation track.  
* **Header Stack:** Vertical text alignment presenting the primary console header directly above a muted context description.  
* **Tabs Navigation Rail:** Horizontal anchor routing bar displaying the optimized 3-tab layout. The "Payouts & Tax" tab utilizes a prominent high-focus active highlight to anchor the viewport.

### **UI Copy**

* **Headline:** Settings  
* **Subline:** Manage your creator identity, secure shipping logistics, team workspace access, and linked social performance nodes.  
* **Tabs Navigation Label Elements:**  
  * \[ ⚙️ Profile & Workspace \]  
  * \[ 🧩 Social Channels \]  
  * \[ 💰 Payouts & Tax \] (Active Tab Focus State)

## **SECTION I: FINANCIAL CLEARING RUNTIMES (Visible to All Users)**

This section hosts active transaction balances, clearing tracking engines, and local clearing house destination routing properties.

### **Card 1: Live Wallet Balances & Real-Time Telemetry Pipeline**

#### **Layout Structure**

* **Container Block:** Independent horizontal surface card with a high-contrast background to emphasize operational balance fields.  
* **Financial Metrics Split Grid:** A two-column real-time reporting interface.  
  * **Left Column:** Large-format numerical layout highlighting unpaid campaign earnings alongside currency processing tokens.  
  * **Right Column:** Secondary vertical metadata block tracking the next scheduled payout date, historical lifetime earnings, and manual payout action buttons.

#### **UI Copy**

* **Card Header:** Earnings & Clearing Telemetry  
* **Card Description:** Review your accumulated campaign funds, examine pending escrow settlements, and track automated payment distribution pathways.  
* **Telemetry Telemetry Display Elements:**  
  * **Metric 1: Available Balance**  
    * *Value Display:* ₹1,42,850.00 INR  
  * **Metric 2: Pending Escrow Settlement**  
    * *Value Display:* ₹58,000.00 INR  
  * **Metric 3: Lifetime Platform Earnings**  
    * *Value Display:* ₹12,04,500.00 INR  
  * **Scheduled Release Metric:** Next Automated Payout: June 15, 2026 (Bi-weekly schedule cycle)  
  * **Primary Interactive CTA Button:** \[ Request Immediate Clearing \] (Triggers manual routing mechanics)

### **Card 2: Localized Bank Node Registry (Direct Deposit Routing)**

#### **Layout Structure**

* **Container Block:** Solid background surface layout component positioned directly beneath Card 1\.  
* **Settlement Node Matrix:** A standardized two-column horizontal configuration layout.  
  * **Left Column:** Bank brand grouping displaying the beneficiary entity name and masked clearing house routing codes.  
  * **Right Column:** Interaction pathways designed to modify account parameters or replace target settlement nodes.

#### **UI Copy**

* **Card Header:** Local Bank Payout Node  
* **Card Description:** Configure your destination checking account to receive direct electronic fund transfers (NEFT / RTGS / IMPS).  
* **Settlement Routing Fields & Status Parameters:**  
  * **State A: Empty Configuration View**  
    * *Status Badge:* ⚪ Missing Settlement Destination  
    * *Contextual Instruction Note:* Add a verified local banking profile to route campaign funds securely.  
    * *Primary Interactive CTA Button:* \[ Add Local Bank Account \] (Launches State 3 Verification Interface)  
  * **State B: Verified Settlement View**  
    * *Account Route Metadata:* HDFC Bank Limited (Muted tracking identifier label)  
    * *Beneficiary Name Label:* Sarah Jenkins Media Group  
    * *Masked Routing String:* Account ending in ••••6842 • IFSC Code: HDFC000••••  
    * *Status Badge:* 🟢 Verified Active Node  
    * *Secondary Interactive Action Link:* \[ Replace Account Details \]

### **Card 3: Tax Profile & Compliance Documentation**

#### **Layout Structure**

* **Container Block:** Solid background surface layout component positioned directly beneath Card 2\.  
* **Compliance Verification Row:** High-contrast layout row tracking government tax declarations and generating transactional invoice ledgers.

#### **UI Copy**

* **Card Header:** Tax Compliance & Invoices  
* **Card Description:** Keep your permanent account numbers updated and access automated tax invoices generated for completed brand campaigns.  
* **Compliance Status Mapping:**  
  * **Tax Information Document Item:** Permanent Account Number (PAN) / Tax ID Registry  
  * **Status Badge Indicator:** 🟢 Verified Active Compliance File  
  * **Masked Document String:** PAN Record Identifier: ABCDE••••F  
  * **Invoice Repository Hub Label:** Historical Earnings Ledger Statements  
  * **Interactive System Link:** \[ Open Invoice Vault (PDF Downloads) \]

## **SECTION II: SUBSCRIPTION ARCHITECTURE ROADMAP (Future Expansion Tracking)**

This section embeds upcoming monetization layers using a grayscale overlay structure to highlight future pricing toolkits while keeping current workflows uncluttered.

### **Card 4: Extended Monetization Models (Roadmap Track)**

#### **Layout Structure**

* **Section Divider Rule:** A full-width horizontal tracking line establishing a clear structural break between active clearing configurations and future platform features.  
* **Container Block:** Independent configuration layout housing upcoming monetization tools, styled with a strict grayscale filter layer and disabled user interaction pathways (opacity 0.45).

#### **UI Copy**

* **Section Header Callout:** Planned Monetization Extensions  
* **Card Header:** Premium Tier Creator Infrastructure (Forthcoming)  
* **Card Description:** Build integrated paid subscription tiers directly into your media kit profile. This future extension will allow you to sell exclusive content packages, custom brand matching retainers, and priority execution turnarounds to enterprise agency clients.  
* **Grayscale Status Indicator Badge:** 🔒 Future Platform Extension — Launch Target: Q4 2026  
* **Disabled Action Anchor:** \[ Feature Access Locked \]

## **3\. Comprehensive State Machine Matrix**

### **State 1: Baseline Read-Only State (Pristine Financial View)**

* **Layout Mechanics:** Clearing cards display steady balances, verified badge configurations, and masked character layouts. Real-time indicators are hidden.  
* **Action Status:** The persistent save banner row remains completely unmounted from the active rendering track.

### **State 2: Critical Validation Failures (Invalid Financial Data Matrix)**

* **Layout Mechanics:** Triggers immediately if banking routing transactions fail verification checks or return clearing-house errors. The target card assumes an alert state (1px solid Error Crimson outline accompanied by clear instructional warning headers).  
* **Action Status:** Wallet payout requests lock instantly to protect current account funds.  
* **UI Copy Control Strings:**  
  * *Status Badge Display:* 🔴 Clearing Settlement Disrupted  
  * *Critical Error Alert Description:* Verification Error: The clearing house rejected recent transaction batches due to a mismatch between your beneficiary profile details and bank record names.  
  * *Primary Interactive CTA Button:* \[ Reconfigure Banking Credentials \]  
  * *Inline Auxiliary Option:* \[ Contact Financial Support Node \]

### **State 3: Active Payout Node Configuration (Inline Drawer Workflow)**

* **Layout Mechanics:** Invoked by selecting \[ Add Local Bank Account \] or \[ Replace Account Details \] in Card 2\. This expands a right-aligned form drawer panel to capture verified bank account details without page reloads.  
* **UI Copy Elements:**  
  * *Field Input 1 Label:* Beneficiary Legal Name  
    * *Placeholder:* e.g., Sarah Jenkins Media Group (Must precisely match bank registry profile)  
  * *Field Input 2 Label:* Bank Account Number  
    * *Placeholder:* Enter your full local bank account integer string  
  * *Field Input 3 Label:* Confirm Bank Account Number  
    * *Placeholder:* Re-enter your bank account integer string to verify accuracy  
  * *Field Input 4 Label:* IFSC / Routing / SWIFT Identifier Code  
    * *Placeholder:* e.g., HDFC0000123  
  * *Real-Time Validation Tracker Notification:* 💡 Verification Step: The system will run an automated verification check by depositing a small tracking sum (₹1.00) to confirm your bank routing data matches before running large balance distributions.  
  * *Drawer Actions Stack:* \[ Securely Save Payout Account \] (Disabled until form fields pass validation checks) • \[ Cancel Selection \]

### **State 4: Role-Based Access Restriction State (Assistant User View)**

* **Layout Mechanics:** Automatically applied if the logged-in user session carries the Assistant security role token.  
* **Action Status:** Primary manual request buttons, profile update keys, and configuration pathways are converted to a disabled layout configuration state. Master account numbers are replaced with dense masking blocks (••••••••).  
* **UI Copy Tooltip Overlay:** 🔒 Read-Only Access Layer: Assistant profiles are restricted from viewing granular bank routing codes, accessing tax history profiles, or changing settlement destinations. Contact the account Owner to update financial paths.

## **4\. System Modals & Drawer Overlays**

### **Modal A: Manual Earnings Clearing Authorization**

* **Layout Mechanics:** Launched by clicking \[ Request Immediate Clearing \] in Card 1\. This deployment maps an explicit interaction intercept overlay directly over the layout container to prevent accidental double-payout tracking errors.

\+-------------------------------------------------------+  
|  MODAL: INITIATE MANUAL EARNINGS CLEARING          \[X\] |  
|  Execute real-time balance distribution pipeline.     |  
|                                                       |  
|  You are authorizing an off-cycle manual transfer:     |  
|  Target Value: ₹1,42,850.00 INR                       |  
|  Destination Route: HDFC Bank (••••6842)              |  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  | \> Fee Warning: Off-cycle transaction batches may |  |  
|  | incur a standard processing settlement charge    |  |  
|  | of ₹250.00 INR, deducted at settlement.         |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \[ Abort Clearing Call \]       \[ Confirm Funds Release \]|  
\+-------------------------------------------------------+

#### **UI Copy**

* **Modal Title Alert:** 💰 Release Accumulated Account Balance?  
* **Critical Safety Micro-Copy Message:** "Confirm that you want to manually release your current balance outside your standard bi-weekly schedule cycle. Processing routines execute immediately and cannot be recalled once dispatched to external clearing house networks."  
* **Dynamic Information Warning Card:** \> Fee Warning: Off-cycle transaction batches may incur a standard processing settlement charge of ₹250.00 INR, deducted at settlement.  
* **Action Footer Row Controls:**  
  * *Right-Aligned Confirmation Element:* \[ Confirm Funds Release \] (High-contrast green processing layout fill)  
  * *Left-Aligned Dismissal Element:* \[ Abort Clearing Call \]

## **5\. Mobile Adaptability Compact Layer Rules**

* **Viewport Threshold:** Evaluated on all mobile screen configurations $\\le$ 768px.  
* **Layout Conversions:**  
  * The 3-tab sub-navigation layout shifts into a swipeable horizontal selector track.  
  * The Earnings Telemetry grid collapses its dual-column layout. Unpaid balances assume full-width top layout priorities, with secondary metrics tracking directly beneath them.  
  * Form field columns within the banking configuration drawer drop side-by-side elements, transforming into a stacked single-column design.  
  * Interactive buttons stretch to match full-width container parameters, adjusting to a **48px minimum height profile** to optimize for mobile touch targets.  
  * Complex data tables (such as tax compliance item summaries) hide secondary metadata parameters, shifting to simple status rows that launch details in a bottom drawer interface when tapped.

