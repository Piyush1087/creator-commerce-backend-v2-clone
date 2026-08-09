# **PRODUCT REQUIREMENT DOCUMENT (PRD)**

## **PRD: Universal Creator Journey (Discovery, Access & Conversion Engine)**

## **1\. Product Overview**

The Universal Creator Journey governs how creators discover, evaluate, and apply for campaigns within the platform. This journey bridges two core pipelines: outbound acquisition (creators arriving via deep links or Meta Marketplace API outbound DMs) and inbound discovery (creators browsing the internal platform marketplace).  
By decoupling **Visibility Scopes** from **Application Submission Scopes** into a multi-select matrix, this engine eliminates binary access blocks. It safely maximizes creator sign-up rates and platform lifetime value (LTV) through an automated split-tier teaser system, real-time Instagram Graph API data validation, and automated cross-sell retention loops.

## **2\. Objectives & Success Metrics**

* **Maximize Conversion Rate & Minimize Bounce:** Prevent creators from dropping off due to immediate, uncompromised social verification walls by offering an engaging, low-friction teaser experience.  
* **Protect Brand Intellectual Property:** Safeguard highly sensitive campaign metadata—such as narrative hooks, audio tracks, and technical compliance parameters—behind authenticated, authorized status states.  
* **Automated Target Optimization:** Enforce real-time server-side checking of Meta Graph API demographics prior to unlocking application controls, protecting the brand's pipeline from out-of-niche spam.  
* **System-Wide Creator Retention:** Eliminate dead-ends by redirecting failed verification traffic or paused campaigns into highly optimized alternative recommendation trays.

## **3\. User Stories**

| ID | User Role | Requirement | Goal |
| :---- | :---- | :---- | :---- |
| **US.1** | Invited / Browsing Creator | View public brand assets, product definitions, and general visual archetypes without immediate OAuth connection. | Evaluate creative alignment and brand aesthetic match before sharing sensitive account data. |
| **US.2** | Verified Platform Creator | Clear target metric filters automatically and experience a frictionless transition from the discovery feed into an unlocked application workflow. | Apply to relevant, high-paying briefs without encountering broken access states. |
| **US.3** | High-Value / VIP Creator | Access private, high-value briefs via direct outbound tracking tokens, completely bypassing metric floor rules. | Execute an instant application or sign-off without algorithmic interference from the system. |
| **US.4** | Brand Manager | Configure specific visibility filters and distinct application submission gates independently during the campaign creation wizard step. | Protect proprietary campaign strategy from non-participants while maintaining scalable inbound/outbound flexibility. |
| **US.5** | Platform Engine | Capture real-time social data tokens post-OAuth and automatically cross-sell matching marketplace rows if a specific brief rejects a profile. | Protect platform retention and maintain long-term creator engagement. |

## **4\. Functional Requirements**

### **4.1. Access Routing & Deep-Linking Channels**

The engine handles traffic natively across two primary ingress channels:

#### **Path A: Marketplace Discovery Engine (**src/routes/creator/marketplace**)**

* **Row-Level SQL Visibility Filtering:** The discovery feed applies real-time database filtering. A campaign row is queried and rendered *if and only if* it satisfies the brand's visibility configuration array:  
  * EVERYONE: Displayed globally to all active creators.  
  * ELIGIBLE\_ONLY: Screened against the creator’s synced metrics (follower tiers, category tags) before appending to the feed array.  
  * INVITED\_ONLY: Screened out of the marketplace entirely. Only visible if an invitation record matching the creator's platform identity exists in the database.

#### **Path B: Direct Link Routing (**src/routes/creator/campaign/:campaignId**)**

* **Tokenized Resolution Layer:** Supports inbound traffic originating from external sources (e.g., social bios, direct messages, automated outbound Meta Marketplace API scripts).  
* **Meta API Context Parsing:** If the creator arrives via an external outbound DM token, the system parses the incoming string and dynamically hydrates a persistent context banner:  
* *"Welcome,* @handle*. \[Brand Name\] has hand-picked your profile for this campaign collaboration."*

### **4.2. Tiered Reveal Architecture (The Access Layer)**

Every campaign detail page operates dynamically across two distinct layout tiers, driven by the creator's current authentication and compliance state.  
\[User Arrives at Page\]   
       │  
       ▼  
┌────────────────────────────────────────────────────────┐  
│ TIER 1: PUBLIC VIEW (Teaser Mode)                      │  
│ \- Brand Identity, Product USPs, Valuation Tokens       │ ──► Unauthenticated / Pre-OAuth  
│ \- Gated Sections covered by Frosted Glass Overlay      │  
└────────────────────────────────────────────────────────┘  
       │  
       ▼ \[Trigger: Connect Social OAuth\]  
       │  
┌────────────────────────────────────────────────────────┐  
│ SERVER-SIDE ACCESS MATRIX EVALUATION                   │  
│ \- Parse visibility\_scopes & application\_scope          │  
└────────────────────────────────────────────────────────┘  
       │  
       ├───────────────────────────┐  
       ▼ (Passed Rules)            ▼ (Failed Rules)  
┌───────────────────────────┐┌───────────────────────────┐  
│ TIER 2: UNLOCKED BREIF    ││ LOCKED RETENTION BRIEF    │  
│ \- Read-Only Live Mirror   ││ \- CTA Locked (Alert UI)   │  
│ \- Narrative / Do's & Dont's││ \- Hydrate Cross-Sell Tray │  
│ \- Action: Apply Allowed   ││ \- Prevent User Drop-off   │  
└───────────────────────────┘└───────────────────────────┘

#### **Tier 1: Public Visibility Layer (Pre-OAuth / Teaser Mode)**

Accessible to unauthenticated or unconnected creators.

* **Exposed Assets:** Brand master logo, product lifestyle photography imagery, retail pricing/incentive value tags, and target creator archetype badges.  
* **Masked Assets:** Creative execution narratives, mandatory content angles, raw script hooks, environmental lighting parameters, audio tracks, precise payment terms, and specific legal usage rights are completely masked behind a secure UI element.  
* **Primary Teaser CTA:** A highly visible action control stating: **\[Connect Social to Check Selection Eligibility\]**.

#### **Tier 2: Gated Visibility Layer (Post-OAuth / Authenticated Mode)**

Mounts onto the DOM tree after the creator completes the Instagram Graph API handshake and hydrates their profile data variables. Access levels depend on the brand's configured parameters:

* **Unlocked Brief Access State:** Mounts the functional workspace if the profile satisfies the matrix criteria. The creator gains clear access to a read-only mirror of the brand's side drawer brief layout (Narrative, Production Audio/Video settings, Social Optimization text copy, and Verification Compliance Checklists). The main CTA transitions to: **\[Submit Application to Campaign Pool\]**.  
* **Locked Retention State:** If the profile fails the verification parameters, Tier 2 metadata remains masked. The primary apply button transitions to a locked state, and the viewport injects a warning alert box featuring a soft pink background tint color (\--status-warning: \#FFF6F6) alongside ruby-red text explaining why the profile metrics do not match the brand's target criteria.

### **4.3. Matrix Logic Resolution (Data Mapping Model)**

The system evaluates the creator's platform context against the brand's visibility\_scopes and application\_scope selections using strict validation logic:

| Visibility Configuration | Application Configuration | Core Evaluation Behavior & System Routing |
| :---- | :---- | :---- |
| \['EVERYONE'\] | EVERYONE | **Open Marketplace:** No eligibility rules applied. Any creator can discover the card and submit an application immediately. |
| \['EVERYONE'\] | ELIGIBLE\_ONLY | **The Brand Protector:** Campaign is globally visible. Clicking "Apply" triggers a real-time background metric validation check. Ineligible profiles are blocked from submitting and display the warning alert UI layer. |
| \['EVERYONE'\] | INVITED\_ONLY | **Public Roster Lock:** Globally visible to build platform interest, but the primary action CTA remains locked unless the creator's profile ID is pre-whitelisted in the database. |
| \['ELIGIBLE\_ONLY'\] | ELIGIBLE\_ONLY | **Pure Niche Vault:** Hidden from the marketplace for non-matching profiles. Direct link access triggers an immediate automated verification pass before rendering any brief parameters. |
| \['ELIGIBLE\_ONLY', 'INVITED\_ONLY'\] | ELIGIBLE\_ONLY / BLENDED\_SMART\_FUNNEL | **Meta API Fallout Match:** Visible to organically eligible creators and outbound API invitees. If an outbound invitee fails deep demographic verification (e.g., target country density $\< 60\\%$), the application button locks and routes them to the cross-sell recovery tray. |
| \['INVITED\_ONLY'\] | DIRECT\_BYPASS | **VIP Override:** Completely hidden from marketplace streams. Access is restricted to unique direct invitation link tracking tokens. Bypasses all automated metrics to let the creator sign and confirm instantly. |
| \['INVITED\_ONLY'\] | VETTED\_STEALTH | **Private Vetted Circle:** Hidden from public discovery streams. Hand-picked creators must possess a valid tracking link AND pass automated profile eligibility evaluations to unlock the apply button. |

### **4.4. Retention & "Not a Fit" Alternative Cross-Sell Engine**

To prevent creator drop-off, the engine uses an automated recovery routine below the campaign detail container if a creator does not complete an application or fails metric clearance checks.  
Code snippet  
model MarketplaceCrossSell {  
  id               String   @id @default(uuid())  
  sourceCampaignId String   @map("source\_campaign\_id")  
  targetCampaignId String   @map("target\_campaign\_id")  
  matchScore       Float    @map("match\_score")  
}

* **The LTV Recovery Grid Layout:** When a campaign locks out a creator, the bottom container of the canvas dynamically renders a split-screen recommendation section. The system takes the creator's freshly synchronized Instagram Graph API profile metrics and queries the database for active marketplace campaigns where their metrics match perfectly, keeping the user engaged on the platform.

## **5\. UI/UX & Design System Constraints**

### **5.1. Teaser Page Layout & Masking Details**

* **The Frosted Glass Masking Overlay:** Gated campaign content tiers must be wrapped inside a responsive container block configured with an absolute frosted glass blur layout layer (backdrop-filter: blur(12px); background: rgba(255, 255, 255, 0.65);). A centralized secure lock icon component sits above the layer, directly adjacent to the interactive OAuth trigger control.  
* **Active Focus Rule Navigation:** To preserve visual layout hierarchy, the campaign briefs page sections must implement a single-focus open routine. Expanding one information accordion pane (e.g., Content Theme & Creative Angles) automatically collapses any previously open panel across the view layer.

### **5.2. Post-Authentication Read-Only Mirror Syncing**

* **WYSIWYG Mirror Matching:** Once unlocked via successful eligibility clearance or a VIP override bypass, the layout structure must render an exact read-only mirror layout of the side drawer panel seen by the brand manager.  
* **Design Tokens:** The interface uses platform design tokens for messaging states:  
  * \--status-warning: \#FFF6F6 (Light Pink Fill for rejection alerts).  
  * \--status-brand: \#00FF66 (Aurora Green Accent for matching success indicators and verified tokens).

## **6\. Technical Architecture & Verification Logic**

### **6.1. Background Eligibility Verification**

Upon successful redirection from the official social OAuth endpoint, a server-side routine intercepts the payload and parses the data fields against the parameters in the database model:  
$$\\text{Eligibility Status} \= \\begin{cases} \\text{Passed}, & \\text{if } \\text{Followers}\_{\\text{Current}} \\in \[\\text{Min}, \\text{Max}\] \\land \\text{Audience}\_{\\text{Target}} \\ge \\text{Threshold} \\\\ \\text{Failed}, & \\text{otherwise} \\end{cases}$$  
If the campaign's application\_scope is set to DIRECT\_BYPASS, the system skips this step, records an immediate passing audit log, and displays the unlocked content.

### **6.2. Referral Tracking & Link Shortening Mechanics**

* **Universal Router Tokenization:** The "Share" tool uses an automated URL shortener that embeds cryptographic identifiers (?token=uce\_coll\_xxx) into the shared link string.  
* **Analytics Tracking:** These tokens resolve via the UceCampaignCollaboration tracking database to attribute link engagement, signup attribution, and application routing steps back to specific outbound branding channels.

## **7\. Operational Boundary States**

### **7.1. Ineligible Traffic Rejection**

If a creator completes the OAuth flow but fails the automated target demographic requirements for a campaign configured with ELIGIBLE\_ONLY restrictions, the system blocks the application flow. The primary CTA is replaced with a locked button reading **"Application Parameters Mismatched"**, and the platform initializes the data recovery pipeline to display alternative campaign cards.

### **7.2. Paused or Terminated Campaign Lifecycle Handling**

If a creator uses an older link to access a campaign whose status toggle has flipped to PAUSED or COMPLETED, the route executes a safe fallback behavior:

* The page displays a localized notification message modal sheet stating: *"This specific collaboration opportunity is currently closed, but the brand has alternative active project paths open below."*  
* The system completely unmounts the primary application container and automatically populates the lower canvas workspace with the live, open campaign list from that brand's primary profile catalog.

## **8\. Multi-Industry Domain Adaptations**

The system variables and UI copy strings dynamically shift across different domain categories to match specific brand profiles:

### **8.1. Healthcare & Medical Verticals**

* **Teaser Metric Updates:** Changes the "Base Offer" text label to ➡️ **Clinical Engagement Stipend / Service Co-pay Credit**.  
* **Verification Compliance Checks:** Enforces mandatory expert credential reviews. The green compliance container requires creators to include explicit disclaimer language, while the red container locks out off-label medical treatment claims or unapproved physiological performance guarantees.

### **8.2. AI / SaaS / Tech Platforms**

* **Teaser Metric Updates:** Changes the "Base Offer" text label to ➡️ **Sandbox Access Provisioning Token** (e.g., 12-Month Pro Team Seat License \+ Baseline Fee).  
* **Verification Compliance Checks:** Tracks software onboarding status (Sandbox\_Account\_Activated) instead of physical shipping status. The compliance layout requires showing live user interface interaction with software metrics within the first few seconds of creative footage.

### **8.3. Offline Experiences (Events, Venues, Hospitality)**

* **Teaser Metric Updates:** Changes the "Base Offer" text label to ➡️ **VIP Pass Valuation Bucket** (e.g., Event Ticket/Pass \+ Travel/Stay Package Allocation).  
* **Verification Compliance Checks:** The workspace features maps API autocomplete integrations and requires physical on-site coordinate checks. Content rules require showing identifiable exterior venue branding markers, while prohibiting footage of security checkpoints or guests who have not signed appearance waivers.

Would you like to review the Zod database query execution schemas designed to map this "Exit Logic" cross-sell recommendation matrix?  
**AI Verification Note:** AI can make mistakes. Verify the results.  
