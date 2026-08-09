# **UI Copy & Layout Architecture Specifications: Integrations Module**

**System Integration:** Settings Framework Workspace, Secondary Navigation Tab  
**Document Classification:** Comprehensive UI Copy, Interaction States, and Modal Blueprints

### **1\. Main Header & Navigation Framework**

*This framework controls the top-level navigation layout for the centralized platform configuration space, reducing navigation friction by merging personal accounts and workspace parameters into a single view.*

#### **Layout Structure**

* **Main Container Frame**: Global settings console featuring a horizontal tabbed navigation track.  
* **Header Stack**: Vertical text alignment presenting the primary console header directly above a muted context description.  
* **Tabs Navigation Rail**: Horizontal anchor routing bar displaying the optimized 3-tab layout. The "Integrations" tab utilizes a prominent high-focus active highlight to anchor the viewport.

#### **UI Copy**

* **Headline**: Settings  
* **Subline**: Manage your personal profile, workspace permissions, external integrations, and financial ledgers.  
* **Tabs Navigation Label Elements**:  
  * \[ ⚙️ General \]  
  * \[ 🧩 Integrations \] **(Active Tab Focus State)**  
  * \[ 💳 Finance & Escrow \]

### **SECTION I: SOCIAL ECOSYSTEM PLATFORM INTEGRATION (Active Scope)**

*This section governs the centralized Meta API handshakes. It manages the discovery, authentication, and verification parameters for the brand's primary creator outreach operations.*

#### **Card 1: Meta Ecosystem Discovery Banner (Pre-Connection Discovery State)**

##### **Layout Structure**

* **Container Block**: A persistent notification banner spanning the top margin of the integrations grid, highlighted by an amber alert tint layout frame. This module is dynamically unmounted or hidden once a verified connection state is successfully verified.

##### **UI Copy**

* **Banner Status Badge**: \[ Pill Badge: ⚠️ UNVERIFIED DEEP DISCOVERY \]  
* **Core Context Text**: *"Our AI-driven website analysis has identified the following target profile handle associated with your organization's parent domain: **@\[Captured\_Handle\]**."*  
* **Callout Notice**: \> 💡 System Requirement: This handle must be securely authenticated below via Meta OAuth to activate automated performance tracking, milestone tracking loops, and outreach synchronization.

#### **Card 2: Meta Ecosystem Sync (The Unified Integration Module)**

##### **Layout Structure**

* **Container Block**: Full-width card component serving as the central orchestration node for Meta access permissions.  
* **Dual-Path Structural Framework**: Split rows stack inside the card container layout, explicitly establishing a value-driven hierarchy between full business suite sync parameters and standalone profile connections.

##### **UI Copy**

* **Card Header**: Meta Ecosystem Sync  
* **Card Description**: Securely link your brand's digital presence to automate influencer search discovery pipelines and manage real-time creator campaign activations.  
* **Current Sync Status Tracker**: Identity State: 🔘 Not Connected

##### **PATH A: FULL ECOSYSTEM INTEGRATION (Recommended Option)**

###### **Layout Structure**

* **Container Frame**: Highlighted inner panel bounding the primary business manager connection layout track. Features a subtle, distinct full-width background container tint to visually prioritize this path.

###### **UI Copy**

* **Sub-Section Header**: ⚡ Path A: Complete Workspace Automation (Meta Business Manager Suite)  
* **Functional Value Propositions Grid**:  
  * ✨ Automated Persona Discovery: Grants our core matching engine the authorization to analyze ecosystem data to dynamically match high-alignment creator personas with your unique Brand DNA.  
  * 📨 Priority Outreach Routing: Enables secure, automated outbound Direct Messaging (DM) dispatch paths straight into high-match creator priority inboxes.  
  * 📈 Unified Metric Ingestion: Tracks ongoing creator reel, post, and story performance analytics automatically to continuously refine campaign execution loops.  
* **Primary Interactive CTA Element**: \[ Sync Meta Business Manager Suite → \] *(Triggers State 2 External Handshake Redirect Loop)*

##### **PATH B: CHANNEL LOGS ONLY (Limited Capability Option)**

###### **Layout Structure**

* **Container Frame**: Secondary outlined inner panel component, styled with lower visual weight boundaries to emphasize its limitation context.

###### **UI Copy**

* **Sub-Section Header**: ℹ️ Path B: Standalone Profile Logs (Instagram Business Account Only)  
* **Functional Value Propositions Grid**:  
  * 📈 Performance Optimization Tracking: Grants basic, read-only metric ingestion paths to import creative content analytics and historical asset engagement statistics.  
  * ⚠️ Automation Limit: Does not support automated AI-driven creator matchmaking configurations or automated Direct Message communication delivery pipelines.  
* **Secondary Interactive CTA Element**: \[ Connect Instagram Profile Only \] *(Triggers State 2 External Handshake Redirect Loop)*

### **SECTION II: PIPELINE & FUTURE EVOLUTION CORES (Roadmap Scope)**

*This section houses forthcoming integration modules, leveraging our standardized catalog design token system to communicate future scalability without rendering empty placeholder frames.*

#### **Card 3: Communications & Commerce Ecosystem Extensions**

##### **Layout Structure**

* **Container Block**: Dual-column, low-profile card layout row positioned at the base of the page viewport.  
* **Visual Filtering Element**: The entire block assumes an exact desktop design token configuration scaling constraint: rendered under a strict 0.5 grayscale opacity filter matrix to signal its un-selectable future deployment lifecycle.

##### **UI Copy**

* **Card A (Left Grid Column)**:  
  * **Card Header**: Gmail Workspace Sync \[ Pill Badge: IN PIPELINE \] *(Muted Amber background theme)*  
  * **Card Description**: Link your official corporate communication node to manage email-based influencer negotiation pipelines and contract routing tables straight from your dashboard workspace.  
* **Card B (Right Grid Column)**:  
  * **Card Header**: Shopify Commerce & Analytics Hub \[ Pill Badge: ROADMAP \] *(Light Gray background theme)*  
  * **Card Description**: Integrate online storefront infrastructure and conversion pixel tracking models to match localized creative creator campaigns directly to gross product sales metrics.

### **3\. Comprehensive State Machine Matrix**

#### **State 1: Baseline Read-Only State (Pristine Dashboard View)**

* **Layout Mechanics**: All active selection tracks across Section I render in an un-focused, static visual layout. Selection loops are inactive, and third-party credential data arrays remain hidden.  
* **Action Status**: The persistent screen bottom sticky bar remains completely unmounted from the DOM element compilation chain.

#### **State 2: OAuth Handshake & Redirect Loop Processing**

* **Layout Mechanics**: Triggered instantly when a user clicks \[ Sync Meta Business Manager Suite → \] or \[ Connect Instagram Profile Only \]. The specific card frame locks down securely under a full-height solid background overlay mask component.  
* **Action Status**: Exposes an asynchronous spinning loading status indicator. All adjacent settings menus, tabs, and input vectors are hard-locked to avoid session collision or duplicate data transmission errors.  
* **UI Copy Control String**: 🔒 Initializing Secure Meta Verification Handshake... Please complete the external authentication sequence inside the browser redirect window.

#### **State 3: Fully Authenticated & Synchronized (Operational State)**

* **Layout Mechanics**: The Meta card drops its connection tracks and transitions into a full-color active operational state layout. The top Discovery Banner is completely unmounted from view.  
* **UI Copy Elements**:  
  * **Ecosystem Connection Success Tracker**: Identity State: 🟢 VERIFIED METASPHERE SYNC *(Deep Teal typography style)*  
  * **Profile Account Details Row Matrix**: \[Avatar: Verified Logo\] Verified Brand Workspace Account: @thecreatorshop  
  * **Integration Connection Context Label**: Authentication Level: Meta Business Manager Integration (Full Automation Mode Active)  
  * **Real-Time Data Sync Telemetry Stamp**: Live Synchronization Active • Last Ledger Data Pull Executed: Just Now  
* **Action Footer Layout Row**:  
  * \[Button: Disconnect Integration\] *(Destructive outline styling; prompts Modal B flow on click)*  
  * \[Button: Configure Data Permissions\] *(Secondary inline action layout; opens 460px Right-Side Drawer Overlay adhering to Constraint PIC-01)*

#### **State 4: Authentication Expired / Token Revocation Failure**

* **Layout Mechanics**: Triggers automatically if external Meta account settings parameters strip app communication rights or security access tokens expire. The card container assumes a high-visibility amber alert frame.  
* **Action Status**: Standard operational management items are hidden, replaced by a critical resolution error action link block. To comply with **Constraint PIC-03**, the user payload is audited to remain under a 20-word total constraint.  
* **UI Copy Action Alert String**: *"⚠️ Meta authentication token expired. Automated outreaches are paused. Click below to refresh your credentials and restore campaign tracking pipelines."* *(Exact Length: 19 Words — Constraint Compliant)*  
* **Resolution Control Element**: \[ Re-Authenticate Connection Token \]

#### **State 5: Progressive Progressive Enhancement Path (Ecosystem Upgrade)**

* **Layout Mechanics**: Occurs when a brand that previously connected via Path B (Instagram Only) selects the upgrade path to unlock the complete Business Suite feature set without severing active campaign tracking.  
* **UI Copy Elements**:  
  * **Card Header Active Tracker**: Identity State: 🟢 INSTAGRAM CONNECTED (Limited Strategy Insights Mode)  
  * **Upgrade Callout Block Header**: ⚡ UNLOCK FULL AUTOMATION INFRASTRUCTURE  
  * **Upgrade Context Description Text**: *"Your workspace is currently operating on a limited, read-only performance log channel track. Elevate your connection settings parameters to Meta Business Manager to instantly unlock automated high-alignment persona matchmaking and priority Direct Message outreach delivery capabilities."*  
  * **Primary Upgrade Control Action**: \[ Upgrade to Business Manager Sync \]

### **4\. System Modals & Drawer Overlays**

#### **Drawer A: Advanced Meta Data Scoping Panel**

* **Layout Mechanics**: Launched by selecting \[ Configure Data Permissions \] in State 3\. In strict compliance with **Constraint PIC-01**, this workflow bypasses standard dashboard page redirection loops, translating out an independent **460px wide state-preserving Right-Side Drawer Overlay**.

\+-------------------------------------------------------+  
|  DRAWER: DATA SCOPING PERMISSIONS                 \[X\] |  
|  Manage webhook tracking data layers.                 |  
|                                                       |  
|  \[x\] Sync Creator Campaign Metric Logs                |  
|      Ingest view counts, reel reach, and post metrics |  
|                                                       |  
|  \[x\] Enable Automated Direct Message Outreach         |  
|      Allow system DM dispatch logic to creators       |  
|                                                       |  
|  \[ \] Profile Discovery Engine Ingestion               |  
|      Allow algorithm to analyze connected followers   |  
|                                                       |  
|  \---------------------------------------------------  |  
|  ⚠️ Modification Warning: Altering these permissions   |  
|  may disrupt active automation tracks.                |  
|                                                       |  
|  \[ Discard & Close \]       \[ Save Integration Settings \]|  
\+-------------------------------------------------------+

##### **UI Copy**

* **Drawer Title Header**: Data Scoping Permissions  
* **Drawer Subline Helper Text**: Review and isolate the granular webhook communication and data ingestion tracks allowed by your Meta integration framework.  
* **Interactive Configuration Row 1**:  
  * *Checkbox Label*: Sync Creator Campaign Metric Logs  
  * *Description String*: Ingest real-time impressions, reel view counts, story reach metrics, and historical asset engagement statistics across verified active campaigns.  
* **Interactive Configuration Row 2**:  
  * *Checkbox Label*: Enable Automated Direct Message Outreach  
  * *Description String*: Allow the platform execution matrix to dispatch outreach message structures directly into target creator priority inboxes.  
* **Interactive Configuration Row 3**:  
  * *Checkbox Label*: Profile Discovery Engine Ingestion  
  * *Description String*: Authorize the platform algorithm to scan and catalog the audience demographic distributions of your connected followers to optimize brand matching.  
* **Granular Safety Change Warning Callout Box**: \> ⚠️ Operational Notice: Modifying permission configurations during active, live recruitment cycles can pause ongoing creator communication tracks and break metric monitoring data layers.  
* **Sticky Drawer Footer Actions Matrix (Adhering to Constraint PIC-02)**:  
  * **Left Action Trigger**: \[ Discard & Close \]  
  * **Right Action Trigger**: \[ Save Integration Settings \]

#### **Modal A: Identity Conflict Overwrite Resolution Modal**

* **Layout Mechanics**: Centered warning card overlay layout context that intercepts the application flow if an active user executes a State 5 Upgrade sequence using an external account owning an entirely mismatched Instagram handle registry.

##### **UI Copy**

* **Modal Title Alert**: ⚠️ Meta Identity Conflict Detected  
* **Modal Subline Context**: *The inbound authenticated Meta Business Manager suite does not match the active Instagram handle parameters tracked in your Brand Center settings.*  
* **Identity Mapping Discrepancy Matrix Box**:  
  * Active Platform Identity Vector: @thecreatorshop (Instagram Direct Connected)  
  * Inbound Authenticated Identity Vector: @creatorshop\_global (Via Meta Business Manager)  
* **Main Explanatory Text**: *"All active campaign briefs, creator negotiation pipelines, escrow milestone milestones, and verification logs depend completely on maintaining a single, consistent identity track. Overwriting this context will alter your global profile parameters."*  
* **Action Footer Row Controls Matrix**:  
  * **Primary Right-Aligned Action Button (Solid Blue)**: \[ Overwrite & Use New Business Manager Identity \]  
  * *Micro-Copy Underline Note:* "Selecting this option automatically overrides historical configurations, updates your Brand Center tracking references to @creatorshop\_global, and re-routes active campaigns."  
  * **Secondary Left-Aligned Action Button (Outlined)**: \[ Cancel Handshake & Reconnect Correct Profile \]

#### **Modal B: Destructive Connection Termination Guardrail**

* **Layout Mechanics**: Intercepts focus at the center of the viewport layout when a user executes a \[ Disconnect Integration \] action command, completely freezing background navigation tracks.

##### **UI Copy**

* **Modal Title Alert**: ⚠️ Sever Meta Ecosystem Data Sync?  
* **Critical Safety Micro-Copy Message**: *"You are about to terminate all active communication tracks, data webhooks, and performance ingestion pipelines established with the Meta Graph API. The platform will immediately lose the capability to execute automated influencer matching, monitor active campaign reels, or process automated outreach messaging scripts. Historical data logs will remain locked in read-only tracking states as documented in Campaign page Workspace.docx."*  
* **Confirmation Verification Checklist Input**: \[x\] I explicitly verify that I have the administrative authority to sever this integration architecture and pause active outreach pipelines.  
* **Action Footer Row Controls**:  
  * **Right-Aligned Confirmation Element**: \[ Disconnect Integration & Sever Webhooks \] *(High-visibility destructive red text fill; button remains disabled until the confirmation checklist box is checked)*  
  * **Left-Aligned Dismissal Element**: \[ Maintain Active Connection State \]

### **5\. Mobile Adaptability Compact Layer Rules**

* **Viewport Threshold**: Evaluated on all mobile screen configurations $\\le$ 768px.  
* **Layout Conversions**:  
  * The top 3-tab navigation rail converts into a swipeable horizontal selector track.  
  * Form configurations and split value grids inside the Meta Integration Card stack shift from multi-column parallel frames into single-column layouts.  
  * CTA action loops (\[ Sync Meta Business Manager Suite → \]) scale to cover 100% of the horizontal screen margin width, optimizing touch targets.  
  * All right-side drawer panels automatically open as full-screen viewport modal overlays, locking background scroll mechanics and ensuring all text elements adhere strictly to the absolute 14px typography floor.

