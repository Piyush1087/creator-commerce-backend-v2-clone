# **UI Copy & Layout Architecture Specifications: Billing & Escrow Engine**

**System Integration:** Settings Framework Workspace, Tertiary Navigation Tab  
**Document Classification:** Comprehensive UI Copy, Interaction States, and Drawer Blueprints

### **1\. Main Header & Navigation Framework**

*This layout acts as the host container for the unified financial workspace, placing subscription tracking, invoice logs, and compliance-driven escrow infrastructure within a single, cohesive view.*

#### **Layout Structure**

* **Main Container Frame**: Global settings console featuring a horizontal tabbed navigation track.  
* **Header Stack**: Vertical text alignment presenting the primary console header directly above a muted context description.  
* **Tabs Navigation Rail**: Horizontal anchor routing bar displaying the standardized 3-tab configuration. The "Billing" tab utilizes an active highlighted focus state with a deep teal outline to signal current layout focus.

#### **UI Copy**

* **Headline**: Settings  
* **Subline**: Manage your personal profile, workspace permissions, external integrations, and financial ledgers.  
* **Tabs Navigation Label Elements**:  
  * \[ ⚙️ General \]  
  * \[ 🧩 Integrations \]  
  * \[ 💳 Billing \] **(Active Tab Focus State)**

### **SECTION I: SUBSCRIPTION MANAGMENT & PRICING PLANS**

*This section governs active subscription metrics, multi-tier pricing structures, and recurring payment lifecycles.*

#### **Card 1: Plan Status Overview Component (Current Plan Card)**

##### **Layout Structure**

* **Card Header Wrapper**: Bordered interactive enclosure containing an accordion toggle action control (Collapsible Arrow Icon) to collapse or expand tracking metrics cleanly.  
* **Description Metadata Stack**: Muted text string establishing descriptive intent directly underneath the panel heading text.  
* **Plan Summary Details Box**: Independent, solid background container block (surface-card style) containing a multi-column row layout mapping active parameters.

##### **UI Copy**

* **Card Header**: Current Plan  
* **Card Description**: Manage your subscription and billing  
* **Plan Detail Data Elements**:  
  * **Active Plan Name**: Founder's Beta  
  * **Current Account Status**: TRIALING (Active No-Card Preview Node)  
  * **Billing Cycle Term**: 30-Day Free Window  
  * **Next Invoice Schedule Marker**: Then $99/mo \+ 7% Collaboration Fee

#### **Card 2: Dynamic Interactive Plan Selection Canvas**

##### **Layout Structure**

* **Context & Urgency Banner**: Centered headline assembly positioned directly above the tier selection blocks to highlight pricing protection benefits.  
* **The Centerpiece Card**: Prominent centerpiece card component scaled to an exact desktop configuration width of 640px to allow detailed feature columns to breathe. The block assumes an active 2px solid Aurora Green (\#34D399) border perimeter layout combined with a subtle 2% opacity matching green tint background fill block to emphasize active selection context.  
* **High-Density Feature Grid**: Organized 3-column structured feature layout block within the centerpiece card. Group categories enforce bold Satoshi Variable (600) headings set precisely at a 14px typography layer, with descriptions trailing in Source Sans 3 (400) at a strict 14px floor to ensure scannability across dense lists. Custom SVG checkmark icons in Aurora Green accompany each list item.  
* **The Future Roadmap Horizon Row**: Positioning upcoming commercial tiers in a horizontal layout row directly beneath the primary centerpiece card. These roadmap blocks are scaled uniformly to exactly 70% of the primary card's layout size and rendered using a grayscale filter matrix set to 0.5 opacity to isolate them as un-selectable feature projections.  
* **Action Footer Row**: Anchored bottom-blended layout element containing the main validation trigger and subtle secondary action anchors. Clicking the primary button executes a custom Success Particle animation interface transition into the unlocked application workspace dashboard panels.

##### **UI Copy**

* **Top Urgency Section**:  
  * **Headline**: Start your 30-day Founder’s Preview  
  * **Subline**: You’re in the first 500 brands. Lock in $99/mo pricing forever and help us build the future of AI-led creator strategy.  
  * **Trust Badge UI Text**: No Credit Card Required • Instant Access  
* **The Centerpiece Card Block (Founder's Beta Tier)**:  
  * **Card Top Badge**: 🛡️ FOUNDING MEMBER ACCESS  
  * **Plan Title**: Founder’s Beta  
  * **Hero Price Display**: $0 *(Satoshi Variable 600, 48px Layout Height)*  
  * **Post-Trial Invoice Label**: Then $99/mo \+ 7% Collaboration Fee *(Source Sans 3, 16px Line Text)*  
  * **Blockquote Primary Promise Text**: \> Lock in foundational platform access rates forever before the public tier catalog expansion rollout.  
* **High-Density Feature Grid Content**:  
  * **Group Column 1: Deep Intel Engine**  
    * ✨ Automated Brand DNA: Your unique "Reason to Buy" extracted by AI.  
    * 🔍 Competitor Gap Analysis: Deep-scan up to 3 rivals to find creative winning streaks.  
    * 📊 Monthly Intel Refresh: 1 Full Deep-Scan per month to track market shifts.  
  * **Group Column 2: Strategic Execution**  
    * 📝 AI Creative Briefs: Auto-generated briefs for influencers based on your DNA.  
    * 📦 Inventory Mapping: Track up to 5 Products and 3 Collections.  
    * 📍 Local Footprint: Manage up to 3 Locations (Ideal for Healthcare/Retail).  
  * **Group Column 3: Creator Operations (Instagram Exclusive)**  
    * 🤝 Persona Matching: Unlimited AI-driven search in our Instagram database.  
    * 📨 Automated Outreach: 100 Managed Outreaches per month.  
    * 🛡️ Escrow Protection Interlock: Secure transaction tracking, automated contracts, and fixed escrow allocation caps bounded at ₹5,00,000 hold limits.  
* **Action Footer Row Controls**:  
  * **Primary CTA Button**: \[ Start My Free Trial → \]  
  * **Commitment Micro-Copy Label**: *"No credit card required to start. Your 30-day Founder’s Preview is completely free. We’ll notify you 5 days before your trial ends to set up your preferred payment method and keep your Deep Intel active."*  
  * **Secondary Exit Link Anchor**: *I’ll do this later, take me to the limited dashboard.* (Muted Gray-500 Color)  
* **The Future Roadmap Evolution Section**:  
  * **Section Headline**: The Evolution Path  
  * **Section Subline**: As we exit Beta, you’ll be first in line for these upgrades.  
  * **Roadmap Plan Card A (Professional Tier)**:  
    * **Tier Name**: Professional (Upcoming)  
    * **Price Rate**: $399/mo  
    * **Expansion Capabilities**: YouTube & TikTok Analysis \[Pill Badge: Coming in 30 Days \- Amber \#F59E0B\]  
    * **System Resource Capacity**: 10 Competitors / 500 Outreach  
  * **Roadmap Plan Card B (Enterprise Tier)**:  
    * **Tier Name**: Enterprise (Upcoming)  
    * **Price Rate**: Custom  
    * **Expansion Capabilities**: Global Regions & Multi-Currency Routing  
    * **System Resource Capacity**: Unlimited Scans & Corporate White-labeling

### **SECTION II: INVOICES & LEGAL ENTITY METADATA**

*This section houses billing profiles, historical tax receipts, and transactional documentation management controls.*

#### **Card 3: Billing Details**

##### **Layout Structure**

* **Card Container Header**: Enclosed accordion container panel mapping corporate registration profiles.  
* **Primary Action Framework**: Right-aligned single interactive input command line.

##### **UI Copy**

* **Card Header**: Billing Details \[Collapsible Arrow Icon\]  
* **Card Description**: Your organization and tax information  
* **Details Box Micro-Copy**: *"No billing details added yet. Add your organization info for invoices."*  
* **Primary Action Trigger**: \[ Update Billing Details \]

#### **Card 4: Invoices**

##### **Layout Structure**

* **Card Container Header**: Enclosed accordion history structure tracking past monetary drafts.  
* **Table Row Framework (Batch Tooling Compliance \- PIC-04)**: Master checkbox component positioned adjacent to batch extraction assets inside the table row header profile, locking output commands until list criteria rows switch to a positive check status.

##### **UI Copy**

* **Card Header**: Invoices \[Collapsible Arrow Icon\]  
* **Card Description**: Download your past invoices  
* **Invoices Box Muted Prompt**: *"No invoices available. Upgrade to PREMIUM to see billing history."*  
* **Dynamic Table Row Matrix Layout (Enabled when active historical ledger rows populate)**:  
* \[x\] Master Checkbox — \[Invoice Date Token\] — \[Transaction Reference ID Code\] — \[Billing Base Rate\] — \[Eye Control Icon Button\]

### **SECTION III: SECURE ESCROW ACCOUNT METRICS**

*This section governs high-trust escrow workflows, dedicated virtual corporate ledger routing systems, and real-time capital allocation distribution modules.*

#### **Card 5: Secure Escrow Account**

##### **Layout Structure**

* **Main Container Card**: Independent horizontal row layout container injected directly beneath the baseline invoice tracking sections in the core Billing panel.  
* **Header Stack**: Vertical text structure stacking the main feature header directly above a muted summary description.  
* **Information Frame**: A wide, single-column callout layout block containing core compliance and capability definitions.  
* **Action Footer Row**: Content aligned to the right-hand container boundary hosting the workspace bootstrapper callout.

##### **UI Copy**

* **Card Header**: Secure Escrow Account  
* **Card Description**: Automate creator payouts securely using our high-trust multi-tenant architecture.  
* **Current Sync Status Tracker**: Identity State: 🔘 Not Initialized

### **2\. Comprehensive Billing State Machine Matrix**

#### **State 1: Uninitialized / Setup Pending (Initial Empty State View)**

* **Layout Mechanics**: The Escrow module assumes an un-hydrated layout state focusing entirely on the core setup CTA. Financial matrix boxes and bank credentials nodes remain unmounted.  
* **UI Copy Elements**:  
  * **Main Body Text**: *"To initiate collaborations, launch campaigns, and process automated milestone payouts, you must first initialize your workspace escrow vault. The Creator Shop uses a secured virtual routing infrastructure to lock funds safely during content production and disburse payouts directly to verified creators upon automated live-post compliance checks."*  
  * **Micro-Copy Note**: *"Setting up this system creates a dedicated, RBI-compliant corporate banking node. No registration or platform infrastructure setup fees apply."*  
  * **Primary CTA Button**: \[ Initialize Secure Escrow Vault \]

#### **State 2: KYC & Provisioning In-Progress (Verification Pending View)**

* **Layout Mechanics**: Disabled/muted read-only state profile wrapper. Centered structural node enclosing an asynchronous system loader indicator tracking API webhooks.  
* **UI Copy Elements**:  
  * **Status Badge Row**: \[ Pill Badge: ⏳ PROVISIONING IN PROGRESS \]  
  * **Main Body Text**: *"We are currently setting up your dedicated corporate banking nodes and automated micro-ledger architecture via our processing partner Razorpay."*  
  * **Micro-Copy Note**: *"This deep-system validation and regulatory database synchronization typically takes between 2 to 10 minutes. Please do not re-submit your profile framework. Campaign execution paths will remain locked in a draft state until verification concludes."*

#### **State 3: Active & Fully Provisioned (Zero-Balance Empty State View)**

* **Layout Mechanics**: Fully interactive, multi-tiered structural view layout. Financial Metric Matrix presents a three-column horizontal split-row tracking dynamic ledger balances. VBA credentials box exposes complete routing properties.  
* **UI Copy Elements**:  
  * **Status Badge Row**: \[ Pill Badge: ✅ ACTIVE \]  
  * **Financial Metric Matrix**:  
    * **Total Pooled Balance**: \[Workspace Currency Token\] 0.00  
    * *Subline:* Sum total of all cleared liquidity within your virtual banking node.  
    * **Locked Campaign Funds**: \[Workspace Currency Token\] 0.00  
    * *Subline:* Escrow capital securely frozen for active Stage 2 to Stage 5 contracts.  
    * **Available Balance**: \[Workspace Currency Token\] 0.00  
    * *Subline:* Free unallocated capital ready to fund newly approved creators.  
  * **Credentials Box Structural Element**:  
    * **Header Title**: Your Dedicated Virtual Bank Account Details (For Corporate B2B Transfers)  
    * **Description**: Execute direct corporate net-banking transfers (NEFT / RTGS / IMPS) from your firm's bank account to credit your platform balance automatically. Bank wire methods incur zero processing surcharges.  
    * **Beneficiary Name**: The Creator Shop Escrow \- \[Dynamic Account Corporate Legal Name\]  
    * **Virtual Account Number (VAN)**: TCSB8920198231 \[Copy Code Icon\]  
    * **IFSC Code**: RATN0VAAPIS \[Copy Code Icon\]  
    * **Bank Name Partner Node**: RBL Bank (Razorpay Corporate Gateway Node)  
  * **Action Footer Controls**: \[ Top Up Balance \] *(Primary)* | \[ View Financial Ledger \] *(Secondary Link)*

#### **State 4: Active & Operating (Standard Funded Dashboard View)**

* **Layout Mechanics**: Active operational dashboard module. The dynamic three-column grid maps live currency weights. Credentials information folds away into an accordion module block to maintain interface cleanliness.  
* **UI Copy Elements**:  
  * **Status Badge Row**: \[ Pill Badge: ✅ ACTIVE \]  
  * **Financial Metric Matrix**:  
    * **Total Pooled Balance**: \[Dynamic Localized Currency\] XXX,XXX.XX  
    * *Subline:* Sum total of all cleared liquidity within your virtual banking node.  
    * **Locked Campaign Funds**: \[Dynamic Localized Currency\] YYY,YYY.XX  
    * *Subline:* Escrow capital securely frozen for active Stage 2 to Stage 5 contracts.  
    * **Available Balance**: \[Dynamic Localized Currency\] ZZZ,ZZZ.XX  
    * *Subline:* Free unallocated capital ready to fund newly approved creators.  
  * **Accordion Interactive Header**: Virtual Account Transfer Credentials (NEFT / RTGS / IMPS) \[Chevron Down Icon\]  
  * **Action Footer Controls**: \[ Top Up Balance \] *(Primary)* | \[ View Financial Ledger \] *(Secondary Link)*

#### **State 5: Subscription Past Due / Dunning Warning (Grace Window Context)**

* **Layout Mechanics**: High-visibility, amber-tinted horizontal warning interceptor banner injected directly at the top of the Billing tab workspace panel container. Locks active asset modification loops until cleared. Under strict compliance with **Constraint PIC-03**, the warning length is verified below 20 words to ensure error parsing across grid structures.  
* **UI Copy Alert Block**:  
  * **Headline**: ⚠️ Subscription Past Due  
  * **Subline Payload**: *"Your payment failed. Access is locked in read-only mode. Update your card parameters within 7 days to restore automation paths."* *(Exact Length: 19 Words — Constraint Compliant)*  
  * **Primary Interactive CTA**: \[ Update Payment Details & Retry Clearing \]

#### **State 6: Canceled / Halted State (Resource Locking Profile)**

* **Layout Mechanics**: Muted read-only layout treatment reducing alternative selection components to an explicit 0.4 opacity value. Injects a scrollable archive sub-panel mapping prior asset vectors as historical read-only lines.  
* **UI Copy Elements**:  
  * **Card System Alert Title**: 🔒 Workspace Automation Frozen  
  * **System Summary Subline**: *Your recurring plan cycle concluded without payment processing confirmation. Account actions are locked.*  
  * **Primary Reactive CTA Input**: \[ Reactivate Workspace Ledger & Select Plan \]

### **3\. System Drawers & Canvas Overlays**

#### **Drawer A: Top-Up Configuration Drawer (The Calculator Panel)**

* **Layout Mechanics**: Right-hand canvas slide-out overlay anchoring the core Billing view. Under strict compliance with **Constraint PIC-01**, selecting the primary top-up option transitions this **460px wide slide-out workspace drawer panel** into position rather than forcing external browser page routing tracks. Features input controls, option toggle block arrays, a nested real-time accounting breakdown box, and a fixed sticky baseline structural footer bar.

\+-------------------------------------------------------+  
|  DRAWER: TOP UP ESCROW BALANCE                    \[X\] |  
|  Inject liquidity to your secure corporate vault.    |  
|                                                       |  
|  Enter Amount to Allocate:                            |  
|  \[ 100,000.00            \]                            |  
|                                                       |  
|  Select Ingestion Method:                             |  
|  ( ) Bank Wire (NEFT / RTGS / IMPS)                   |  
|  (\*) Instant Deposit (Corporate Credit Card)          |  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  | DYNAMIC ACCOUNTING BREAKDOWN (INR)              |  |  
|  | Target Escrow Allocation Setup:    ₹100,000.00  |  |  
|  | Gateway Processing Fee (2.00%):      ₹2,040.81  |  |  
|  | Surcharge GST (18.00% on Fee):         ₹367.35  |  |  
|  | \----------------------------------------------- |  |  
|  | Total Invoiced Gateway Charge:     ₹102,408.16  |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \[ Cancel and Close \]   \[ Proceed to Secure Gateway \] |  
\+-------------------------------------------------------+

##### **UI Copy**

* **Drawer Header**: Top Up Escrow Balance  
* **Drawer Subline**: Inject liquidity to your secure corporate escrow vault to fund upcoming creator campaign workflows.  
* **Input Label**: Enter Amount to Allocate  
* **Field Placeholder**: 0.00  
* **Selector Title**: Select Ingestion Method  
* **Option A Label**: Bank Wire (NEFT / RTGS / IMPS)  
  * *Conditional Context Body*: Displays the fixed Virtual Bank Account block (VAN, IFSC, Name).  
  * *Micro-Copy Notification*: *"Processing Fee: 0.00%. Bank wires typically settle to your platform account metrics within 30 to 120 minutes depending on your corporate banking hours."*  
* **Option B Label**: Instant Deposit (Corporate Credit Card)  
  * *Conditional Context Body*: Injects the Dynamic Accounting Breakout Box.  
* **Dynamic Breakout Box Breakdown (INR Workspace Example)**:  
  * Target Escrow Allocation Setup: ₹100,000.00  
  * Gateway Processing Surcharge (2.00%): ₹2,040.81  
  * Surcharge Statutory GST (18.00% on Gateway Fee): ₹367.35  
  * \--------------------------------------------------------  
  * Total Invoiced Gateway Charge Amount: ₹102,408.16  
* **Dynamic Breakout Box Breakdown (USD Global Workspace Example)**:  
  * Target Escrow Allocation Setup: $5,000.00  
  * Gateway Processing Surcharge (2.00%): $102.04  
  * \--------------------------------------------------------  
  * Total Invoiced Gateway Charge Amount: $5,102.04  
* **Sticky Drawer Footer Actions Matrix (Adhering to Constraint PIC-02)**:  
  * **Left Action Trigger**: \[ Cancel and Close \]  
  * **Right Action Trigger**: \[ Proceed to Secure Payment Gateway \] *(Disabled until allocation amount exceeds zero)*

#### **Drawer B: Invoice In-Context Content Drawer**

* **Layout Mechanics**: Launched by selecting the inline diagnostic icon component ("Eye" icon) within the Invoice Listing history framework. In strict compliance with **Constraint PIC-01**, this workflow bypasses standard dashboard page redirection loops, translating out an independent **460px wide state-preserving Right-Side Drawer Overlay** to stream direct accounting line profiles.  
* **Sticky Drawer Footer Actions Matrix (Adhering to Constraint PIC-02)**:  
  * **Left Action Trigger**: \[ Close Receipt Profile \]  
  * **Right Action Trigger**: \[ Download Document PDF \]

### **4\. Verification & Callback Modals**

#### **Modal A: State 6 Processing Gateway Redirect State (Secure Overlay View)**

##### **Layout Structure**

* **Full-Canvas Modal Overlay**: Complete spatial block freezing interactive control layers within the active configuration drawer.  
* **Centered Indicator Track**: Vertical stack hosting an animated connection loop asset directly above system-critical safety micro-copy.

##### **UI Copy**

* **Overlay Title**: Securing Your Financial Routing Path...  
* **Overlay Subline**: Initializing payment framework session parameters with Razorpay secure merchant infrastructure.  
* **Critical Guardrail Message**: *"Please do not close this browser window, select your browser's back button, or reload the interface viewport. This cryptographic session handshake secures your corporate funds transit route against multi-tenant collision or transaction leakage."*

#### **Modal B: Sub-State A — Payment Captured Successfully**

##### **Layout Structure**

* **Centric Focus Confirmation Modal**: Content block rendering a success checklist micro-animation.  
* **Transaction Summary Table**: A unified two-column key-value ledger stack.  
* **Action Block Matrix**: Centered navigational controls routing the manager back to baseline dashboards.

##### **UI Copy**

* **Modal Title**: 🎉 Escrow Liquidity Secured  
* **Modal Subline**: Your payment transaction has cleared cleanly. Your corporate workspace ledger matrices have updated dynamically.  
* **Table Row Elements**:  
  * System Transaction ID Reference: TXN\_982103982A1  
  * Amount Credited to Node: \[Workspace Currency Token\] XXX,XXX.XX  
  * Updated Available Working Balance: \[Workspace Currency Token\] ZZZ,ZZZ.XX  
* **Primary CTA Button**: \[ Return to Billing Workspace \]

#### **Modal C: Sub-State B — Payment Processing Failed**

##### **Layout Structure**

* **Centric Focus Error Modal**: High-visibility alert context card structure.  
* **Error Log Data Box**: Deep-bordered code frame displaying external gateway API text outputs.  
* **Action Footer Row**: Split dual-button row facilitating path retries or method pivots.

##### **UI Copy**

* **Modal Title**: ⚠️ Transaction Aborted  
* **Modal Subline**: The secure banking gateway returned an execution routing error. Your transaction could not be processed.  
* **Error Box Label**: Gateway Diagnostics  
* **API Error Payload String**: \[ERR\_CODE: 402\] \- Insufficient Corporate Card Limits or Transaction Declined by Issuing Bank Authentication Node.  
* **Main Explanatory Text**: *"No charges were levied against your financial institution account. You can adjust your payment parameters to try again or switch your payment selection to our zero-fee Bank Wire routing path for seamless settlement."*  
* **Action Controls Matrix**: \[ Modify Funding Parameters & Retry \] *(Primary)* | \[ Close and Discard \] *(Secondary Link)*

### **5\. Regulatory Modules & Compliance Footnotes**

*Fixed legal assertions, data privacy frameworks, and algorithmic boundaries locked permanently to the billing viewport base margin rails.*

#### **Layout Structure**

* **Split Multi-Column Fine-Print Footnote**: Positioned at the bottom boundary of the primary billing workspace card grid layout.  
* **Persistent Footer Banner**: A full-width callout element pinned to the bottom margin of the workspace setup canvas layer.

#### **UI Copy**

* **Terms & Conditions Section (Founding Member Edition)**:  
  * **Headline**: Founder’s Beta Terms  
  * **Access Provision**: *"You are granted a revocable, non-exclusive license to use the Platform during the Beta period."*  
  * **Data Usage Clause**: *"By participating, you agree to allow our AI to process your brand’s public data and competitive landscape to generate strategy."*  
  * **Feedback Agreement**: *"As a Founding Member, you agree to provide occasional feedback to help us refine our YouTube and TikTok engines."*  
  * **Intellectual Property Baseline**: *"All AI-generated Brand DNA and Creative Briefs are yours to keep, provided your account remains in good standing."*  
* **Privacy & Security Section**:  
  * **Headline**: Your Data Security  
  * **No Scraping Assurance**: *"We only analyze publicly available data from your website and social profiles."*  
  * **Privacy First Protocol**: *"Your internal business metrics and outreach history are encrypted and never shared with third parties or used to train models for competitors."*  
  * **Ownership Clause**: *"You own your Brand DNA. We never sell your data."*  
  * **Compliance Attestation**: *"We are GDPR and CCPA compliant, ensuring your brand’s digital footprint is handled with institutional-grade security."*  
* **AI Disclaimer (Mandatory Aurora Guardrail)**:  
  * **Micro-Copy Text Control String**: *"Phase 2 Deep Intel is generated by AI. While we strive for 99% accuracy in Brand DNA extraction, please verify strategic insights before executing high-spend campaigns."*

### **6\. Mobile Adaptability Compact Layer Rules**

* **Viewport Threshold**: Evaluated on all mobile screen configurations $\\le$ 768px.  
* **Layout Conversions**:  
  * The top settings tab group merges into a swipeable linear navigation ribbon.  
  * The dynamic three-column financial ledger balance grid wraps vertically into stacked standalone value panels.  
  * The interactive pricing centerpiece selection canvas collapses down to single rows, matching mobile thumb bounds.  
  * All right-side drawer elements automatically open as full-screen viewport modal overlays, locking background scroll mechanics and ensuring all text elements adhere strictly to the absolute 14px typography floor.

