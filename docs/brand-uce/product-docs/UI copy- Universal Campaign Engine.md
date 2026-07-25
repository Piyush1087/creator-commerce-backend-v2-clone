# Campaign List

**Header: Campaign Management**

* **Breadcrumbs:** Campaigns   
* **Headline:** Your Campaigns  
* **Subtitle:** Track, manage, and optimize your creator activations from a single view.

**Primary Actions (Right-Aligned):**

* **Button (Solid Aurora Green):** \+ Create New Campaign  
* **Button (Outline/Secondary):** ✨ Create using AI  
* **IconButton (Grey Outline \- Toggle State):** \[Icon: Archive\] View Archived Campaigns ({{count}})  
  * *Helper Tooltip:* Switch workspace context to historical or completed campaign records.

---

### **Navigation Tabs**

* **Tab 1: Campaigns** (Operations & Status) — *Active State*  
* **Tab 2: Spend Report** (Financial Performance)

### 

---

### **Tab 1: Campaigns (Operational View)**

#### **A. Global Filters & Bulk Action Bar**

* **Search Bar Input:** Search by campaign, product name, or macro objective...  
* **Filter Dropdown 1:** Objective (All Objectives | Awareness & Reach | Traffic & Clicks | Conversions & Sales | Production)  
* **Filter Dropdown 2:** Timeline Rules (All Types | Fixed Date | Dynamic Execution | Evergreen Baseline)  
* **Bulk Action Bar** *(Visible only when row checkboxes are selected)*:  
  * **Selection Count Text:** {{count}} Campaigns Selected  
  * **Primary Batch Action:** Change Status \[Dropdown: Set Active | Pause Pipelines | Move to Archive\]  
  * **Secondary Batch Action:** \[Button: Export Selection (CSV)\]

#### **B. Campaign List (Cell Multi-Row Stacking Grid Layout)**

##### **1\. Collapsed State (Main Table View)**

*Mobile Responsiveness Rule: On viewports $\\le$ 768px, hide columns marked with **\[Desktop Only\]**. Transform row into a vertical stack mobile card.*

| Column Header | UI Copy / Stacking Data Logic |
| :---- | :---- |
| **Selection** | \[Checkbox\] *(Header checkbox checks all rows)* |
| **Campaign Context** | **Line 1 (Primary Text):** `{{Campaign Name}}` `[Pill Badge: {{Assigned Macro Objective}}]`  **Line 2 (Muted Subtext):** `{{count}}` Active Products Connected *UX Hint:* On desktop, hovering over the `{{count}}` text can trigger a lightweight borderless tooltip listing the product names without taking up permanent screen real estate. On mobile, users instantly see the breakdown by clicking the `[Icon: Eye]` row drawer. |
| **Status** | **Line 1 (Interactive):** \[Toggle Switch: Active/Paused\] *(Greyed out if Archived)*  **Line 2 (Pill Indicator):** \[Green Dot\] Live OR \[Amber Alert\] Paused \- Escrow Locked |
| **Influencer Pipeline** | **Line 1 (Bold Summary):** {{Total Creator Count}} Creators Onboarded **Line 2 (Muted Progress Distribution):** {{n}} Act (Production) | {{n}} Rev (In Review) | {{n}} Pay (Payout Pending) |
| **Budget Consumption** | **Line 1 (Financial Text):** {{Spent Amount}} / {{Allocated Limit}}  **Line 2 (Visual Progress Bar):** \[=====================\>.......\] *(Color dynamic: Green for regular pacing, Amber if burning ahead of schedule)* |
| **Launch Timeline** | **Line 1 (System Status Marker):** \[Desktop Only\] {{Timeline Type}} (e.g., Fixed Date, Evergreen) **Line 2 (Muted Date Value):** \[Desktop Only\] Ends {{End Date}} *(If Evergreen, display "Ongoing baseline execution")* |
| **Quick Actions** | \[Icon: Eye\] View Insights | \[Icon: Pencil\] Edit Scope |

##### **2\. Expanded State (Campaign Intelligence Panel)**

*(Appears directly nested below the row when clicking "\[Icon: Eye\] View Insights")*

* **Section 1: Targeting Snapshot & Archetypes**  
  * **Target Archetypes Selected:** {{Pill: Archetype 1}} {{Pill: Archetype 2}}  
  * **Audience Footprint Reach Floor:** {{Follower Range Min}} – {{Follower Range Max}} followers  
  * **Geographic & Niche Focus Parameters:** {{Target Location Metrics}} | {{Industry Verticals}}  
* **Section 2: Products & Briefs Operational Summary**  
  * *Container Logic: If Product Count \> 2, render a Vertical Slider with a scroll-track indicator.*  
  * **Product Line Item:** {{Product Name}} (SKU Gateway Status)  
    * **Nested Brief Track:** {{Brief Name}} \[Badge: {{Compensation Type}}\] ➔ Pipeline Status: {{Live/Draft State}}  
    * *Brief List Logic: If Brief Count \> 2 within a single product, render a Nested Vertical Slider.*  
* **Section 3: Real-Time Financial Circuit Breaker Metrics**  
  * **Global Master Budget Limit Allocation:** ${{master\_budget\_limit}}  
  * **Product Sub-Ceiling Limit Consumption Threshold:** ${{product\_sub\_ceiling\_cap}}  
  * **Secured Funds (Escrow Protected Value):** ${{Calculated Committed Escrow Balance}}

### **Tab 2: Spend Report (Financial & Operational Intelligence)**

#### **A. Period & Control Shell**

* **Timeline Selector Toggle (Left-Aligned):** \[ Button: 7 Days \] \[ Button: 30 Days (Selected) \] \[ Button: 90 Days \]  
* **Export Controls (Right-Aligned):** \[Button: Export Financial Ledger (CSV)\] \[Button: Download PDF Executive Summary\]

#### **B. Visual Insights Engine (Analytics Row)**

*Mobile Responsiveness Rule: On viewports \<= 1024px, collapse side-by-side modules into a single-column scrollable feed.*

##### **Module 1: Capital Burn Allocation (Donut Chart)**

* **Chart Center Label:** Total Capital Deployed: ${{Sum of global spent \+ locked escrow}}  
* **Donut Breakdown Segments:**  
  * \[Color: Aurora Green\] **Settled Payouts:** ${{Total disbursed balance}} ({{percentage}}%)  
  * \[Color: Amber Yellow\] **Committed Escrow Reserves:** ${{Funds locked for active milestones}} ({{percentage}}%)  
  * \[Color: Slate Blue\] **Unallocated Project Runway:** ${{Remaining free campaign budget}} ({{percentage}}%)

##### **Module 2: Logistics & Operational Safety Pipeline (Stacked Bar Graph)**

* **Headline:** Fulfillment & Timeline Health  
* **Graph Bars & RYG Risk Status Mapping:**  
  * \[Bar Segment: Green\] **On-Schedule Delivery:** {{n}} Shipments tracking safely within delivery windows.  
  * \[Bar Segment: Yellow\] **Logistics Transit Delays:** {{n}} Transits tracking past baseline creator onboarding expectations.  
  * \[Bar Segment: Red\] **Lost Shipments / Missing Tracking:** {{n}} Major execution exceptions requiring manual manager intervention.

##### **Module 3: Creator Archetype & Audience Efficiency (Horizontal Progress Track Split)**

* **Headline:** Efficiency Rating by Creator Archetype  
* **Data Point Bars:**  
  * **Nano-Influencer Pool:** CPE: ${{cpe\_value}} | CPM: ${{cpm\_value}} \[Bar: Progress Track\]  
  * **Micro-Influencer Pool:** CPE: ${{cpe\_value}} | CPM: ${{cpm\_value}} \[Bar: Progress Track\]  
  * **User Generated (UGC) Pool:** Cost per Approved Asset: ${{cost\_per\_asset}} \[Bar: Progress Track\]  
  * **Celebrity / Macro Pool:** CPE: ${{cpe\_value}} | CPM: ${{cpm\_value}} \[Bar: Progress Track\]

##### **Module 4: Product Stagnation vs. Velocity Grid (Leaderboard)**

* **Headline:** Top Performing Linked Product Portfolios  
* **Item Rows:**  
  3. {{Top Product SKU Name}} ➔ {{Total Content Assets Uploaded}} Units Generated | **ROI Factor:** {{Multiplier x}} \[Green Up-Arrow\]  
     4. {{Runner-up SKU Name}} ➔ {{Total Content Assets Uploaded}} Units Generated | **ROI Factor:** {{Multiplier x}} \[Green Up-Arrow\]  
     5. {{Stagnant Product SKU Name}} ➔ {{Total Content Assets Uploaded}} Units Generated | **ROI Factor:** {{Multiplier x}} \[Red Down-Arrow\]

#### **C. Campaign Non-Redundant Performance Ledger Matrix**

*Avoids duplicating Tab 1's workflow status and pacing data by focusing entirely on asset yield, reach value, and bottom-line investment returns.*

##### **1\. Table View Configuration**

*Mobile Breakpoint Layout: Viewports $\\le$ 768px drop advanced efficiency indices, rendering cards tracking solely Identity, Media Yield, and Earned Media Value (EMV).*

| Column Header | UI Copy / Structural Metric Stack | RYG Safety Signal Logic |
| :---- | :---- | :---- |
| **Campaign Identity** | **Line 1:** {{Campaign Name}}  **Line 2 (Muted):** Objective: {{Assigned Macro Objective Enum}} | Neutral standard text layout formatting. |
| **Logistics Health** | **Line 1:** {{Count}} Connected Products **Line 2 (Status):** {{n}} Operational Exceptions Detected | \*\<= **1 Exception:** \[Green Dot\] Clean Pipeline  \* **2–4 Exceptions:** \[Amber Warning\] {{n}} Transits Delayed  \* **$\\ge$ 5 Exceptions:** \[Red Alert\] {{n}} Shipments Lost / Stalled |
| **Media Yield** | **Line 1:** {{Total Assets Approved}} Live Post Items **Line 2 (Target Pacing):** {{n}} Assets Pending Review Stage | Neutral text formatting tracking physical asset count. |
| **Performance Reach** | **Line 1:** {{Aggregate Total Views / Impressions}}  **Line 2 (Engagement):** {{Aggregate Engagement Rate %}} | Compared directly against original Phase 1 baseline expectations. |
| **Efficiency Index** | **Line 1:** CPM: ${{Calculated CPM Cost Value}}  **Line 2:** CPE: ${{Calculated CPE Cost Value}} | \* **Below Target Budgets:** \[Green Text\] High Yield Efficiency  \* **At Target Caps:** \[Amber Text\] Average Yield  \* **Exceeding Caps:** \[Red Text\] Low Yield Performance |
| **Value Delta (ROI)** | **Line 1:** EMV: ${{Calculated Earned Media Value}}  **Line 2 (Multiplier):** {{EMV / Spent Ratio}}x Net Capital ROI | \* **ROI Multiplier $\\ge$ 3.0x:** \[Green Badge\] Outperforming  \* **ROI Multiplier 1.5x–2.9x:** \[Slate Badge\] Balanced Return  \* **ROI Multiplier \< 1.5x:** \[Red Badge\] High Risk Allocation |

#### **D. Mobile Responsive Architecture (Instant View Cards)**

On smaller screens, the visual graphs transform into an optimized **Executive Summary Panel** stacked directly beneath the timeline switch toggles.  
\+\--------------------------------------------------+  
| EXECUTIVE FINANCING SUMMARY       \[ Last 30 Days \]|  
|--------------------------------------------------|  
| \[O\] Settled:  $12,400    \[================\] 62%  |  
| \[\!\] Escrow:   $6,100     \[========\]         31%  |  
| \[•\] Free:     $1,500     \[==\]                7%  |  
|--------------------------------------------------|  
| PIPELINE QUALITY CHECKS                          |  
| Shipping Health:   \[ Amber Alert \] 3 Delayed     |  
| Content Yield:     \[ Green Light \] 84 Assets Live|  
| Capital Return:    \[ Green Light \] 3.4x Net ROI  |  
\+--------------------------------------------------+

* **Interactive Bottom Sheet Drawer Engine:** Long-pressing any row on a mobile device surfaces a smooth bottom overlay drawer. This drawer houses deep configuration breakdowns, visual sub-charts, and granular audit trails without requiring desktop screen width.

### **E. Integrated System Success Toast Communications**

* **Timeline Filter Trigger Toast:** *"Recalculating intelligence dashboard analytics for the past* {{Selected Timeline Parameter (7d/30d/90d)}} *sequence window."*  
* **Export Payload Confirmation Notification:** *"Financial performance summary report data safely compiled. Your file download (*Snapshot\_Spend\_Report.csv*) has initiated automatically."*  
* **Logistics Risk Mitigation Alert Box:** *"Operational Alert: Multiple shipments have stalled past their scheduled arrival date markers. Review your shipping tracking numbers inside your active collaboration engine workflows to avoid content scheduling delays."*

### **Interaction Notifications (Toasts & Modals)**

* **Pause Confirmation Alert Modal:** *"Pausing this campaign will freeze all outbound prospecting, deactivate open registration links, and block incoming applications. Creators currently inside the Active Collabs pipeline will still be permitted to finish production milestones and process authorized payouts. Do you wish to lock configuration lines?"*  
  * \[Button (Danger Red): Confirm Pipeline Pause\] \[Button (Text Grey): Cancel Action\]  
* **Archive Confirmation Warning Modal:** *"Archiving this campaign will remove it entirely from your active dashboard workspace and place it into a read-only historical state. This operation cannot be completed if active collaborations are unresolved."*  
  * \[Button (Solid Grey): Move to Archive\] \[Button (Text Grey): Cancel\]  
* **Bulk Status Success Toast Notification:** *"Status updated successfully for* {{count}} *campaign rows."*  
* **Empty State Workspace Dashboard Panel:** *"No creator campaigns identified matching configuration query metrics. Start your first activation tracking cycle to unlock pipeline metrics."*  
  * \[Button (Solid Aurora Green): Launch Your First Campaign\]

# campaign page

**\[FRAMEWORK CONSTRAINT: PERSISTENT SHELL\]**

* **Universal Sidebar (Desktop)**  
* **Universal Header**  
* **Mobile Wrapper**

**\[DYNAMIC CANVAS: ACCORDION-FOCUS STATE\]**  
**Trigger Logic:** Render this state when the campaign is "`Active`" or in "`Draft`" or in "`Paused`" or in "`Completed`". Default state for operational management.  
Breadcrumb: `Campaign` \> {{ `campaign_name` }}  
**Zone 1: Campaign Master Panel**  
Header / Collapsed State Hierarchy (Super Condensed View):

* **Left Segment (70% Canvas Width):** \* Campaign Name: {{ `campaign_name` }} (e.g., Summer Skin Genius)  
  * Status Indicator: \[Dynamic Light-Dot Status\] (Green \= Live, Amber \= Paused, Slate \= Draft)  
  * Objective: \[Pill Badge: {{ Assigned Macro Objective Enum }}\] (e.g., PRODUCTION, PULSE, PROOF\_PUSH)  
  * Budget Pacing Text: {{ `Spent Amount` }} / {{ `Allocated Limit` }} (e.g., $3,000 spent out of $5,000)  
* **Right Segment (30% Canvas Width \- Aligned Inline Controls):**  
  * Status Toggle: \[Toggle Switch: Active/Paused\]  
  * Edit Action: \[Icon: Pencil\] (Tooltip: "Edit Campaign Scope & Strategy")  
  * Universal Share Action: \[Icon: Share\] (Tooltip: "Open Universal Router & Funnel Controls") ➔ Action Hook: Click event sets global routing state flag \[isRouterOverlayActive \= true\] to launch the Sub-Module 2A Universal Share Link Router Modal Sheet.  
  * Expand/Collapse Trigger: \[Icon: Caret Down / Caret Up\]  
* **Mobile Low-Profile Banner Rules:** On viewports ≤ 768px, hide inline controls. Collapse right segment into a single action button: \[Icon: Three Dots Kebab Menu\] which slides up a bottom action sheet containing Pause, Edit, and Share routers.

Expand/Collapse Trigger: \[Icon: Caret Down / Caret Up\] ➔ Action Hook: Toggles global boolean state \[isZone1Expanded\]. Renders Caret Up when true, Caret Down when false.  
Mobile Low-Profile Banner Rules: On viewports ≤ 768px, hide inline controls.  
Collapse right segment into a single action button: \[Icon: Three Dots Kebab Menu\] which slides up a bottom action sheet containing Pause, Edit, and Share routers.  
Expanded State Fields Container:  
Logic Binding: Mount and render this continuous inner container block if and only if \[isZone1Expanded \=== true\]. If false, completely unmount from the DOM tree. Individual headers below ("Section 1", "Section 2", "Section 3") are flat structural sub-cards and must NOT contain independent carets, arrows, or toggles.  
Rule: Suppress field or section container if data does not exist.

Expanded State Fields:

* *Rule: Suppress field or section container if data does not exist.*  
* Metadata Strip:  
  * Date created: {{ `Creation Date` }} (e.g., 21st April 2026\)  
  * Current status: {{ `Campaign Lifecycle State Enum` }} (e.g., LIVE\_PENDING\_APPROVALS)  
* Section 1: Strategy  
  * Deadline type: {{ `deadline_type` }} (e.g., Evergreen, Fixed Date, Dynamic)  
  * Deadline Date: {{ `Date Picker` }} (e.g., 21/10/2026) *(Visible only if deadline type is Fixed Date)*  
  * Dynamic Days: {{ `Dynamic Days` }} (e.g., 10 days after receiving product) *(Visible only if deadline type is Dynamic)*  
  * KPI Target Parameters: {{ `KPI` }} (e.g., Reach, Saves, Link Clicks)  
  * Destination Platforms: {{ `Platform Icons` }} (e.g., Instagram, TikTok, YouTube brand icons)  
* Section 2: Targeting  
  * Target Creator Archetypes: {{ `Creator Archetype Array` }} (e.g., MICRO\_INFLUENCER, USER\_GENERATED\_UGC)  
  * Follower Volume Evaluation Range: {{ `Target Follower Min` }} – {{ `Target Follower Max` }}  
  * Audience Demographics Vector: {{ `Gender` }}, {{ `Age Range Min` }}–{{ `Age Range Max` }}, {{ `Interests` }}, {{ `Target Geographies` }}  
* Section 3: Commercials & Escrow  
  * Physical Product Delivery Loop: {{ `Yes / No` }}  
  * Fulfillment/Return Condition: {{ `Product Condition Text` }} (e.g., Return after shoot, Keep after verification)  
  * Product Sub-Ceiling Cap: ${{ `product_sub_ceiling_cap` }}  
  * Master Budget Limit: ${{ `master_budget_limit` }}  
  * Commercial Contract Structure: {{ `Compensation Type Enum` }} (e.g., FIXED\_FEE, BARTER)  
  * Advance Payment Commitment: {{ `Advance Payment %` }} (e.g., 30%)  
  * Remaining Balance Terms: {{ `Final Balance Due Date Enum` }} (e.g., NET\_15)

**Zone 2: Product & Brief Panel**  
Header / Collapsed State Hierarchy:

* **Left Segment:** Header Label: Products & Briefs  
* **Center Summary Segment:** Counter Status Text: {{ `count` }} Active Products | {{ `count` }} Live Strategic Briefs  
* **Right Segment**: Expand/Collapse Trigger: \[Icon: Caret Down / Caret Up\] ➔ Action Hook: Toggles local boolean state \[isZone2Expanded\]. Renders Caret Up when true, Caret Down when false.  
* *UX Quality Rule:* No functional action or addition CTAs are permitted on the collapsed header row to protect layout boundaries.


Expanded State Canvas:

*  Logic Binding: Render and display the repository grid canvas if and only if \[isZone2Expanded \=== true\]. If false, unmount elements  
* **Primary Actions Placeholder Grid (Mounts inside the upper margin boundary of the Expanded Canvas only when \[isZone2Expanded \=== true):**  
  * \[Dashed Border Button Component\] \+ Add New Product Portfolio  
* **Repository Structural Layout View:**  
  * Logic: If product\_count \<= 5, render layout as nested **List Cards**.  
  * Logic: If product\_count \> 5, render layout as an unified **Operational Table Grid**.  
* **Right Segment**: Expand/Collapse Trigger: \[Icon: Caret Down / Caret Up\] ➔ Action Hook: Toggles local boolean state \[isZone2Expanded\]. Renders Caret Up when true, Caret Down when false. UX Quality Rule: No functional action or addition CTAs are permitted on the collapsed header row to protect layout boundaries. Expanded State Canvas: Logic Binding: Render and display the repository grid canvas if and only if \[isZone2Expanded \=== true\]. If false, unmount elements. Primary Actions Placeholder Grid (Top Row \- Mounts inside the upper margin boundary of the Expanded Canvas only when \[isZone2Expanded \=== true\]): \[Dashed Border Button Component\] \+ Add New Product Portfolio 

**Directory Hierarchy View Rules** (No deep descriptions shown inline. All metadata opens in side drawers for desktop / modals for mobile):

Quick Action: \[Icon: Eye\] View Product ➔ Action Hook: Click event sets state \[isProductDrawerOpen \= true\] to slide out the "Product Side Drawer" component detailed below.  
Quick Action 2: \[Icon: Eye\] View Brief Snapshot ➔ Action Hook: Click event sets state \[isBriefDrawerOpen \= true\] to slide out the "Brief Side Drawer" component detailed below.

* Level 1: Product Block Core Identity  
  * Product Core Element: \[Thumbnail Image\] \+ Product Name \+ Gateway Price  
    * Status Toggle: \[Toggle Switch: Active/Paused\] *(Pausing the product automatically cascadingly deactivates all child briefs underneath)*  
    * Quick Action: \[Icon: Eye\] View Product (Slides out Product Side Drawer)  
  * Level 2: Child Brief Rows (Nested Indented Block)  
    * Brief Descriptor Name: {{ Brief Name }} \[Badge: Deliverable Type\]  
    * Status Toggle: \[Toggle Switch: Active/Paused\] *(Controls direct application ingestion flow for this localized brief)*  
    * Quick Action 1: \[Icon: Pencil\] Edit Brief *(Conditional: Re-opens wizard only if brief carries 0 active creator applications)*  
    * Quick Action 2: \[Icon: Eye\] View Brief Snapshot (Slides out Brief Side Drawer)  
  * Nested Product Creation Anchor (Rendered at the tail end of the localized brief stack):   \* \[Small Dashed Text Link Component\] \+ Create & Add Strategic Brief to {{ Product Name }}  
      
    

**Side Drawer Content & Logic**

The "View" action triggers a right-side drawer on desktop and modal in mobile to keep the user’s place in the repository list.

\[PRODUCT DRAWER RENDERING RULE: Fixed right-aligned drawer panel. Visibility state bound to condition: Mount component if and only if \[isProductDrawerOpen \=== true\]. Header close button sets \[isProductDrawerOpen \= false\]. Desktop width: 400px; Mobile width override: 100vw.\]

| Product Side Drawer / Mobile Modal Header Section Contextual Tag (Muted Top Text): Campaign Product Portfolio ➔ SKU Gateway Details Main Title Vector: `[Thumbnail Image]` `{{ Product Name }}` *(e.g., Aura Hydrating Milky Cleanser)* Commercial Baseline Badge: Retail Value: $`{{ Base Price }}` Section 1: Core Positioning & Strategy Headline: Marketing Positioning & USPs Unique Selling Point (USP Label): \* *Body Text:* `{{ USP Text }}` *(e.g., The only barrier-repair cleanser that locks in moisture for up to 72 hours using multi-weighted ceramide complexes.)* Core Product Benefits / Selling Points: *Tokenized List Style:* 🌟 `{{ Point 1 }}` *(e.g., Formulated with 3% pure plant-derived ceramides)* 🌟 `{{ Point 2 }}` *(e.g., Non-foaming, milk-to-oil texture prevents stripping sensitive skin)* 🌟 `{{ Point 3 }}` *(e.g., Fragrance-free and safe for post-procedure or micro-needled skin)* Section 2: Fulfillment & Inventory Ledger Headline: Logistics & Allocation Cap Product Sub-Ceiling Limit Consumption Allocation: $`{{ product_sub_ceiling_cap }}` *Helper Subtext:* The maximum authorized financial value dedicated exclusively to sourcing, sample distribution, and shipping logistics for this specific product SKU inside this active campaign cycle. Return Conditions: *Value Asset Label:* `{{ Product Condition Text }}` *(e.g., Creator to keep after verification posting milestones are completed.)* Section 3: Content Compliance & Regulatory Guardrails Headline: Brand Safety Guidelines Container Callout Grid (High-Contrast, Background Tinted Container Box): ⚠️ Regulatory Policy & Compliance Constraints: `{{ Policy Regulations }}` *(e.g., Must include explicit FDA disclosure statement text in caption. Do not categorize or refer to this cosmetic skin cleanser as an acne treatment or medical-grade solution.)* 🚫 Strict Brand {Do Not Say} Guardrails: `{{ Do Not Say Restrictions }}` *(e.g., Never use words like 'chemical peeling', 'miracle cure', or directly mention or display competitor packaging from CeraVe or Cetaphil in the frame.)* Persistent Sticky Footer (Desktop Drawer Bottom / Sticky Mobile Base) Left-Aligned Content Profile: Status: `[Toggle Switch: Active/Paused]` `{{ Text Status Description: Operational / Inbound Applications Suspended }}` Right-Aligned Primary Actions Array: `[Button (Secondary Grey Outline)]` Close View `[Button (Primary Aurora Green)]` Edit in Brand Centre  State Logic & Validation Tooltips:   Condition A (Active Collabs \= 0): Button is ENABLED. Clicking routes user directly to the primary product catalog inside the Brand Centre module. \* Tooltip Text: "Manage core SKU description, images, and brand guardrails within your central Brand Centre portfolio."   Condition B (Active Collabs \> 0): Button is DISABLED (Visual opacity 0.40, cursor-not-allowed). \* Tooltip Text: "This product is tied to active creator collaborations. Modifying or removing core SKU parameters is permanently locked to preserve fulfillment integrity."   |
| :---- |

**Brief Side Drawer Template:**

\[BRIEF DRAWER RENDERING RULE: Fixed right-aligned drawer panel. Visibility state bound to condition: Mount component if and only if \[isBriefDrawerOpen \=== true\]. Header close button sets \[isBriefDrawerOpen \= false\]. Desktop width: 400px; Mobile width override: 100vw.\]

| Brief Side Drawer / Mobile Modal (All Sections Collapsed By Default) Header Section Contextual Tag (Muted Top Text): Strategic Production Brief ➔ Creative Execution Guardrails Main Title Vector: `{{ Brief Name }}` `[Pill Badge: {{ Deliverable Type Enum }}]` *(e.g., Summer Glow Morning Routine \[REEL\_VIDEO\])* System Lifecycle Stamp: Version Tag V1.0 \- Snapshot Locked Section 1: Linked Core Asset Mapping (Always Exposed Top Summary) Headline: Parent Product Affiliation Associated Asset Row: `[Product Thumbnail Image]` {{ Product Name }} (SKU Gateway Value: $`{{ Base Price }}`) Section 2: The Narrative (Content Guidelines) Accordion Header Row: 📖 1\. Content Theme & Angles `[Icon: Caret Down]` Hidden Content Core (Revealed only on click/expand): Primary Focus Strategy: `[Pill Badge: {{ Content Theme }}]` *(e.g., GRWM / Texture Close-up / Fast-Cut Unboxing)* Creative Description Paragraph: *Body Text:* `{{ Description Text }}` *(e.g., Create an aesthetic, high-energy morning skincare routine video showing a seamless transition from dull waking skin to a hydrated, dewy look using our Milky Cleanser. Keep the tone authentic, direct, and conversational.)* The Hook List (Scroll-Stoppers): *Tokenized Bullet List:* 🪝 • Hook Option 1: `{{ Hook Idea 1 }}` *(e.g., "Stop stripping your skin barrier with foaming cleansers...")* 🪝 • Hook Option 2: `{{ Hook Idea 2 }}` *(e.g., "My 72-hour hydration hack that dermatologists actually approve of...")* Visual Transitions & B-Roll Requirements: *Body Text:* `{{ Recommended B-Rolls }}` *(e.g., 3-second close-up macro shot of the milky texture melting onto wet skin, followed by a tight shot of water splashing in slow motion.)* Section 3: The Production (Creative Specs) Accordion Header Row: 🎬 2\. Audio & Environment Settings `[Icon: Caret Down]` Hidden Content Core (Revealed only on click/expand): Audio Strategy: `{{ Audio Selection }}` *(e.g., Original Voiceover \+ Trending Aesthetic Ambient Lo-Fi Background Track)* Tone of Voice: `{{ Tone Selection }}` *(e.g., Educational, relatable, warm, and confident—peer-to-peer advice style)* Environment Matrix: 💡 • Lighting Specification: `{{ Lighting Requirement }}` *(e.g., Bright, diffused natural window light or a soft ring-light setup. Absolutely no harsh shadows or dark yellow bathroom overheads.)* 🧼 • Background Setting: `{{ Background & Setting }}` *(e.g., Clean, minimalist, uncluttered bathroom vanity or aesthetic bedroom vanity station. Add a touch of natural greenery or neutral towels.)* Section 4: Social Optimization Copy Accordion Header Row: 📝 3\. Text Assets & Discoverability `[Icon: Caret Down]` Hidden Content Core (Revealed only on click/expand): Primary Post Caption Guardrail: \* *Blockquote Box:* "`{{ Post Caption }}`" *(e.g., Swapping my harsh foaming washes for a milky ceramide blanket. 🫧 My skin has never stayed dewy this long. Available at Sephora\! \#AuraPartner \#BarrierRepair")* Required Hashtag Stack: \* *Code Text Layout:* `{{ #hashtags }}` *(e.g., \#AuraSkinCleanse \#SkincareRoutine \#Ceramides \#HealthySkinBarrier)* Section 5: Content Guardrails & Verification Compliance Accordion Header Row: ⚠️ 4\. Automated Vetting Safety Rules `[Icon: Caret Down]` Hidden Content Core (Revealed only on click/expand): The "DOs" Checklist (Green Container Callout Box): ✔️ • Show the product packaging clearly within the first 3 seconds of the video frame. ✔️ • Explicitly mention the phrase "72-hour locked-in hydration matrix" audibly or via on-screen text. ✔️ • Include the platform-compliant `#ad` or `#sponsored` clear overlay tags. The "DONTs" Restrictions (High-Contrast Red Callout Box): ❌ • Regulatory Policy Violation: `{{ Don't 1 }}` *(e.g., Never make medical treatment claims, such as stating this cosmetic SKU cures active cystic acne or eczema.)* ❌ • Visual Safety Violation: `{{ Don't 2 }}` *(e.g., Do not display any visible competitor skincare brand bottles on your counter space or bathroom shelves during the video.)* Section 6: Visual References & Moodboards Accordion Header Row: 🖼️ 5\. Inspiration Repository `[Icon: Caret Down]` Hidden Content Core (Revealed only on click/expand): Moodboard Matrix: \* *Grid Layout Container:* `[Image Thumbnail]` `[Video Thumbnail With Play Icon]` `[Image Thumbnail]` External Inspiration Links: 🔗 • `[Hyperlink Web Icon]` Reference Video: `{{ TikTok/Instagram Inspiration URL }}` Persistent Sticky Footer (Desktop Drawer Bottom / Sticky Mobile Base) Left-Aligned Content Profile: Status Component: `[Toggle Switch: Active/Paused]` Context Label: `{{ Inbound Application Status }}` *(e.g., "Brief Open \- Receiving Creator Submissions" OR "Inbound Funnel Frozen")* Right-Aligned Primary Actions Array: Action 1: `[Button (Secondary Grey Outline)]` Close View Action 2: `[Button (Primary Aurora Green)]` Edit Brief Configuration *State Logic & Validation Tooltips:* Condition A (Applicants \= 0): Button is ENABLED. Clicking re-opens the setup wizard to modify fields. *Tooltip Text:* "Modify creative parameters, hooks, and compensation rules for this brief." Condition B (Applicants \> 0): Button is DISABLED (Visual opacity 0.40, cursor-not-allowed). *Tooltip Text:* "Creators have already applied or locked contracts under these terms. Creative guidelines are frozen to protect legal execution boundaries."  |
| :---- |

**Zone 3: Operational Workspace (Operational Mode)**  
Visibility Logic: This pipeline tracking canvas occupies 100% of the active operational workspace layout only when Zone 1 and Zone 2 master panels are fully collapsed.  
Segmented Navigation Tab Header Rules:

* **Desktop Layout:** Rendered as inline horizontal block selectors: \[Prospects\] | \[Applicants\] | \[Active Collabs\] | \[Reporting\].  
* **Mobile Adaptability Layout Container:** Rendered as an horizontal Segmented Scroll-Track Container with an automatic transparent linear-gradient mask fade applied to the trailing right border edge to indicate overflowing tab items. Swiping centers the target tab.  
* *Tab Core Data Shells (Internal pipeline table content out of scope for this module iteration):*  
  * Active Tab Context State: Prospects  
  * Headline Label: Prospects  
  * Helper Context Subtext: Curated list of potential high-impact creators for this workstream.  
  * Filter Strip Elements: \[Filter: All Products ▾\] \[Filter: All Briefs ▾\] \[Button: Clear All Filters\]  
  * Operational Table Columns: Creator Info, Archetype Match, Estimated Reach, Context (Product/Brief Tag), Actions Row (\[Add to Campaign\], \[View Profile\]).

Pause Confirmation Modal  
Trigger Logic: Display this popup interceptor block when *any* \[Status Toggle\] system switch component inside Zone 1 or Zone 2 is flipped from Active to Paused.  
Header: Pause {{ Entity Name }}?  
Body Text:

* "All active collaborations and creators currently inside the active production pipeline will not be impacted or terminated by this status modification."  
* "However, this {{ Entity Type }} will be hidden from the active public discovery funnel, and new incoming creators will no longer be permitted to view details or apply to its open quotas."  
* Primary Action Button: \[Primary Button: Confirm Pipeline Pause\]  
* Secondary Action Button: \[Ghost Button: Cancel Action\]

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Here are the architectural UI copy instructions and dynamic variation rules to be appended to the bottom of the master document. These instructions define how the data strings, labels, and validation states adapt when the active brand profile switches from standard E-commerce/D2C to Healthcare, AI/SaaS, or Offline Experiences.

### **APPENDIX: MULTI-INDUSTRY DOMAIN VARIATION ENGINE**

#### **1\. Global Field & Token Mapping Matrix**

When the brand’s industry sector variable shifts from D2C\_ECOMMERCE, system variables must automatically update their UI text strings across all directory views, sliders, and side drawers according to the following mapping table:

| Industry Sector | Primary Asset Label ({{ Product Name }}) | Commercial Metric Tag (Base Price) | Product Tracking Badge | Secondary Structural Subtext |
| :---- | :---- | :---- | :---- | :---- |
| **D2C / E-commerce** *(Base)* | Product Name | Retail Value: $零售价 | \[{{n}} Products Connected\] | Gateway Price |
| **Healthcare (B2C / B2B)** | Treatment / Medical Product Name | Est. Unit/Co-pay Value: $价值 | \[{{n}} Diagnostics/Medical Lines\] | Compliance Tier Classification |
| **AI / SaaS Platforms** | Software Module / Subscription Tier | License / ACV Tier Value: $资费 | \[{{n}} Platforms/Tiers Linked\] | Provisioning Route (e.g., Sandbox) |
| **Offline Experiences** | Location / Event Activation Profile | Ticket / Experience Value: $票价 | \[{{n}} Venues/Excursions Tracked\] | Footfall Cap / Booking Bounds |

#### **2\. Sector-Specific UI Copy Variations (Side Drawers & Modals)**

##### **A. Healthcare & Medical Verticals**

* **Strategic Intent:** Changes focus from retail sales pitches to regulatory compliance, credential checks, and patient trust parameters.  
* **UI Label Adaptations (Product Drawer):**  
  * Change "Marketing Positioning & USPs" to ➡️ **Clinical Positioning & Certified Claims**  
  * Change "Fulfillment & Inventory Ledger" to ➡️ **Sample Allocation & HIPAA Compliance Ledger**  
* **Guardrails Box Modifications:**  
  * In the **Green "DOs" Container**, enforce clear credential labels: *“✔️ • Display provider license confirmation text or expert bio layout in first 3 seconds.”*  
  * In the **High-Contrast Red "DONTs" Container**, update warning text to: *“❌ • Medical Safety Violation:* {{ Policy Regulations }} *(Never reference unapproved off-label usage, skip mandatory safety side-effect overlays, or guarantee specific physiological treatment outcomes.)”*  
* **Sticky Footer Circuit Breaker rule modification:**  
  * The disabled tooltip states: *“This treatment profile is currently under active clinical review or assigned to live practitioner collaborations. Strategy attributes are locked to maintain IRB and regulatory compliance.”*

##### **B. AI / SaaS / Tech Platforms**

* **Strategic Intent:** Replaces physical warehouse fulfillment loops with sandbox access tokens, enterprise license keys, and clear use-case demos.  
* **UI Label Adaptations (Product Drawer):**  
  * Change "Fulfillment & Inventory Ledger" to ➡️ **API Sandbox Provisioning & Seat Allocation Tracking**  
  * Change "Return Conditions" to ➡️ **Seat Expiration & Access Deprovisioning Bounds**  
* **Technical Metadata Strip Insertion:**  
  * Add data point line: **Deployment Route:** {{ Sandbox Env / Free Corporate Tier License Key / Team Seat Code Lookup }}  
* **Guardrails Box Modifications:**  
  * In the **Green "DOs" Container**, enforce software metrics: *“✔️ • Screen-record or present the user interface interacting with live data streams within the first 5 seconds of footage.”*  
  * In the **High-Contrast Red "DONTs" Container**, update text to: *“❌ • Engineering Guardrail: Do not show proprietary internal database connection strings, unmasked end-user PII, or reference staging environments in production assets.”*

##### **C. Offline Experiences (Events, Venues, Hospitality)**

* **Strategic Intent:** Replaces product SKUs with physical venue addresses, geographic booking windows, and localized spatial limitations.  
* **UI Label Adaptations (Product Drawer):**  
  * Change "Product Name" to ➡️ **Experience / Activation Venue Name**  
  * Change "Fulfillment & Inventory Ledger" to ➡️ **Venue Capacity Management & VIP Guestlist Allocation**  
  * Change "Return Conditions" to ➡️ **Booking Window Expiration & No-Show Liability Terms**  
* **Geographic Metadata Strip Insertion:**  
  * Add data point line: **Physical Activation Footprint:** {{ Street Address / Google Maps Geolocation Link }} | **Booking Capacity Limits:** {{ Max Creator Guest Allocations Remaining }}  
* **Guardrails Box Modifications:**  
  * In the **Green "DOs" Container**, enforce local guidelines: *“✔️ • Feature identifiable exterior venue branding markers or distinct structural landmarks in the opening shot.”*  
  * In the **High-Contrast Red "DONTs" Container**, update text to: *“❌ • Spatial Security Violation: Do not capture back-of-house staff entry zones, security scanning check-points, or guest profiles who have not completed appearance waiver agreements.”*

#### **3\. Automated Validation Rule Overrides**

1. **Shipping Status Logic Override:** If the industry variable maps to AI\_SAAS, the **Logistics Health** column in the Tab 2 table and the *Logistics Safety Bar Graph* automatically bypass postal carrier tracking (shipment\_status). Instead, they track software onboarding status: \[ON\_SCHEDULE\] maps to Sandbox\_Account\_Activated, and \[LOST\_STALLED\] maps to License\_Key\_Expired\_Unused.  
2. **Product Edit Lock Bypass:** For OFFLINE\_EXPERIENCES, a campaign product portfolio item cannot be edited if local scheduling dates fall within less than 48 hours of the scheduled creator check-in timestamp, regardless of whether active\_collabs counts equal 0\. This baseline prevents last-minute venue booking failures.

**a**

# Add a Product

## **📋 PRODUCTION UI COPY REGISTRY SPECIFICATION**

### **1.0 UNIVERSAL DESKTOP & MOBILE WRAPPER**

**\[CANVAS ENTRY POINT & SYSTEM TRIGGER\]:**

* **Mounting Mode:** This wizard mounts as a full-screen workflow overlay canvas layer sliding up from the bottom over the main Campaign workspace, preserving parent state configurations in the background.  
* **Trigger Rule:** Clicking the action button/icon '+ Create Brief' embedded inside any Zone 2 product row layout or inside the Product Portfolio Details Drawer sets global state variable \[isCreateBriefOpen \= true\] and captures the active product context: \[focusedProductId \= product\_id\].  
* Render this layout block if and only if \[isCreateBriefOpen \=== true\].  
* **Step Multi-Step Navigation Flag:** Initialize client-side state integer \[currentBriefStep \= 1\].  
  * Step views mount conditionally: Step 1 renders when value \=== 1, Step 2 when value \=== 2, Step 3 when value \=== 3\.

Breadcrumb Navigation: Campaign ──► Product ──► Create Brief Auto-Save Status: Draft saved at {{ timestamp }}  
Plaintext  
\+----\----------------------------------------------------------------------+  
| 📊 LIVE CONTEXT PREVIEW SHELL (READ-ONLY RIGHT-SIDE DRAWERS / MOBILE OVERLAY) |  
| Campaign Name: {{ Campaign Name }}  | Objective Target: {{ Primary Objective }}  
| KPI Focus: {{ KPI }}                |  
| Selected Product: {{ Product Name }}  
\+--------------------------------------------------------------------------+

### **STEP 1: BRIEF STRATEGY & DELIVERABLES SPECIFIER MATRIX**

#### **1.1 Structural Foundation**

* **Main Header Headline:** Brief Strategy  
* **Sub-headline Context Text:** Set the tone of the deliverables before detailing them out.  
* **Form Entry Layout Elements:**  
  * **Input Field Label:** Brief Name  
  * **Placeholder Text:** e.g., The Science of Bio-Retinol; GRWM; Unboxing  
  * **Helper Text:** Capture the essence of content you need  
  * **Input Field Label:** Purpose  
  * **Placeholder Text:** e.g., To establish brand credibility via ingredient chemistry and chemistry results.  
  * **Helper Text:** Why did this requirement arise? (Note: This structural block remains hidden from creators).  
  * **Input Field Label:** Objective  
  * **Placeholder Text:** e.g., Establish product as the "Professional's Choice" for high-efficacy results.  
  * **Helper Text:** What are we trying to achieve?  
  * **Input Field Label:** Target Influencer Archetype (Parent Context Syncing)  
  * **Selector Box Component:** \[ Select Profile Archetype from Parent Campaign List v \]  
  * **Radio Toggle Option Group Label:** Brief Type  
    * **(•) Creator-Led (Recommended)** ── *Helper Caption:* Creator’s unique voice around guardrails  
    * **( ) Brand-Led** ── *Helper Caption:* Specific script or storyboard that must be followed.

#### **1.2 Content Deliverables Array Matrix**

* **Section Partition Sub-Header:** 1\. Content Deliverables  
* **Helper Layout Context Text:** Define the assets needed and your level of creative control.

\============================================================================  
**\[DYNAMIC ARRAY REPEATER TRACKING CIRCUIT\]:**

* Initialize a local reactive collection array variable: \[briefDeliverablesArray\].  
* **Trigger Action:** Clicking the button component \[➕ Add Deliverable\] pushes a new structural entity into \[briefDeliverablesArray\] containing unique sub-IDs, standard baseline format values, and default size properties.  
* **Ingestion Interface Loop:** Loop through and map out each entry index node in \[briefDeliverablesArray\].  
  * For each entry, render the selection dropdowns specified below.  
  * Selecting items updates only that specific indexed array node item. \============================================================================  
* **Dropdown Component:** Select Format Type \[ Reel/Video | Story | Photoshoot | Banner/Carousel \]

Plaintext  
┌── IF REEL/VIDEO IS SELECTED:  
├── Dropdown Option Block: Dimension: \[ 9:16 (Full Screen) | 4:5 (Portrait) \]  
└── Dropdown Option Block: Duration:  \[ \<15s | 15-45s | \>45s \]

┌── IF STORY IS SELECTED:  
└── Radio Selector Component Group: Story Intent Execution Type  
├── (•) Amplify the Reel ── \*Helper Text:\* Share the companion reel post to stories with an embedded CTA link sticker.  
└── ( ) Custom Content   ── \*Helper Text:\* Execute original, standalone native storytelling panels.

┌── IF PHOTOSHOOT IS SELECTED:  
└── Technical Number Input Box: Quantity Allocation: \[ {{ integer\_count }} \]

┌── IF BANNER/CAROUSEL IS SELECTED:  
├── Dropdown Option Block: Dimensions: \[ 4:5 (Portrait \- Recommended for maximum real estate) | 1:1 \]  
└── Slider Asset Bound Selector: Slide Range Constraint Count: \[ Slider Limit: 1 \- 10 Slides \]

# **\============================================================================**

**ACTION BUTTON ANCHOR:** \[Button: ➕ Add Deliverable\]

#### **1.3 Usage Rights, Licensing, & Core Requirements**

* **Section Partition Sub-Header:** 2\. Content Deliverables  
* **Interface Toggles Group:**  
  * **Toggle Switch Element:** Link-in-Bio Requirement \[ YES / NO \]  
  * **Conditional Ingestion Box (Visible if YES):** Required Duration Window: \[ \] days  
  * *Helper Caption Text:* Highly recommended for "Push" objectives to track direct traffic.  
  * **Toggle Switch Element:** Partnership/Spark Ads \[ YES / NO \]  
  * **Conditional Ingestion Box (Visible if YES):** Paid Boosting Authorization Window: \[ \] days  
  * *Tooltip Box Copy:* Allows you to run the creator’s post as a paid ad directly from their social handle.  
  * **Toggle Switch Element:** Organic Reposting Rights \[ YES / NO \]  
  * **Conditional Ingestion Box (Visible if YES):** On-Feed Usage Access Window: \[ \] days  
  * *Tooltip Box Copy:* Allows your brand to repost this content on your own feed indefinitely.  
  * **Toggle Switch Element:** Branded Collaboration \[ YES / NO \]  
  * *Tooltip Box Copy:* Creator will tag your social handle in the post.  
* **Form Entry Layout Elements:**  
  * **Input Field Label:** Mandatory Creator Requirements  
  * **Form Ingestion Box:** \[ Text Input Area \]  
  * **Placeholder Text:** e.g., "Must visit the clinic," "Must own a MacBook," or "Must have a Full HD camera."  
  * *Tooltip Box Copy:* Any functional baseline criteria a creator must fulfill to participate in this collaboration track.

### **STEP 2: MULTI-DELIVERABLE CONTENT GUIDANCE PANEL**

#### **2.1 Stacking Layout Matrix**

* **Main Header Headline:** Set the Scene  
* **Sub-headline Context Text:** Detail out the "vibe" and technical requirements of each creative

Plaintext  
\+--------------------------------------------------------------------------+  
| 📦 DYNAMIC CARD STACK CONTROLLER ENGINE                                  |  
|                                                                          |  
| \[ ACTIVE EXPANDED WORKSPACE VIEW \]                                       |  
| Active Identification: Deliverable 1 of {{ total\_count }}                 |  
| Format Profile Spec:   {{ Active\_Format\_Type\_String\_Label }}             |  
|                                                                          |  
| \[CARD MULTIPLEXER CONTROL ENGINE\]:                                       |  
| \- Initialize state index tracker variable \[activeDeliverableIndex \= 0\]   |  
|   pointing to the first item inside \[briefDeliverablesArray\].            |  
| \- Active Canvas Rule: The text area content input fields, dropdown       |  
|   option lists, and tokenizer tag components rendered inside 'VIEW PROFILE|  
|   2.A / 2.B / 2.C' write metrics directly to the array node matched      |  
|   with \[activeDeliverableIndex\].                                         |  
|                                                                          |  
| ──────────────────────────────────────────────────────────────────────── |  
| \[ COLLAPSED CARD TRACK OVERVIEW PANEL \]                                  |  
| Loop through and display all other non-focused indices from              |  
| \[briefDeliverablesArray\] as collapsed tabs inside this track overview.   |  
| Clicking any collapsed tab sets \[activeDeliverableIndex \= clicked\_index\],|  
| smoothly swapping the focused form canvas view.                          |  
|                                                                          |  
| \[Tab Row Label\]: 📁 Deliverable 2: Story (Amplify Reel) \[Click to Focus\] |  
| \[Tab Row Label\]: 📁 Deliverable 3: Carousel (4:5)       \[Click to Focus\] |  
\+--------------------------------------------------------------------------+

#### **📦 VIEW PROFILE 2.A: THE CREATOR-LED CONFIGURATION BLOCK**

*(Mounts inside the Active Workspace container if Brief Type \= Creator-Led)*

##### **Section 1: Content Guidelines**

* **Input Selector Label:** Content Theme *(Searchable Dropdown Element \- Non-Blocking)*  
* **Dropdown Input Box:** \[ Select or type custom theme profile... v \]  
* **Helper Text:** Popular themes instantly recognizable .e.g GRWM , Unboxing  
* **Text Area Label:** Description  
* **Form Ingestion Box:** \[ Empty Manual Input Area \]  
* **Placeholder Guidelines:** Briefly describe the theme.  
* *Inline Action-less Example Visual:* e.g., Pre-makeup routine focused on creating a "glowy" base.  
* **Tokenizer Layout Input Label:** Hook Ideas  
* **Form Ingestion Box:** \[ Empty Multi-Input Tokenizer Field \- Press Enter to lock string tags \]  
* **Placeholder Guidelines:** How to stop the scroll of the viewer?  
* *Layout-Agnostic Context Examples:*  
  * **Example 1:** "Stop buying skincare for the 'vibe' and start buying for the molecule. Here’s why your current retinol is failing your barrier."  
  * **Example 2:** "I’m a skin-scientist, and I’m tired of seeing people ruin their skin with 'flash-irritation' products. Let’s talk about encapsulated stability."  
  * **Example 3:** "If your retinol turns your face red for three days, it’s not 'working'—it’s damaging. Here is the actual chemistry of a healthy glow."  
* **Text Input Label:** Recommended B-rolls  
* **Placeholder Text:** Specify what product shots should be included in the reel  
* **Helper Text:** e.g. The Squelch: A close-up of a finger pressing into a thick cream or jelly mask.  
* **Multi-Input Tag Field Label:** Do’s  
* **Placeholder Text:** e.g. Try to make the product placement genuine.  
* **Helper Text:** What creator should do  
* **Multi-Input Tag Field Label:** Don’ts  
* **Placeholder Text:** e.g. DON’T use "Medical" or "Cure" Claims.  
* **Helper Text:** What creator should definitely not do

##### **Section 2: Creative Guidelines**

* **Multi-Select Input Box Label:** Audio Strategy  
* **Placeholder Selection Text:** Choose audio types...  
* **Array Selection Items:** \[ Direct Voiceover | Trending Music (Background) | Lofi/Focus Beats | Original Audio \]  
* **Dropdown Menu Label:** Lighting Requirements  
* **Placeholder Selection Text:** Select lighting style...  
* **Array Selection Items:** \[ Natural Daylight | Bright/Clinical | Warm/Moody | Studio Ring Light \]  
* **Text Input Box Label:** Background & Setting  
* **Placeholder Text:** e.g., Minimalist desk, aesthetic clinic room, bustling street...  
* **Helper Text:** Keep it relevant to your brand industry category context.  
* **Dropdown Menu Label:** Tone of Voice  
* **Placeholder Selection Text:** Select a vibe...  
* **Array Selection Items:** \[ Authoritative/Expert | High-Energy | Calming/ASMR | Relatable/Casual \]  
* **Text Input Box Label:** Post Caption  
* **Placeholder Text:** e.g. Stop using \[Ingredient\] with \[Ingredient\]—here’s why.  
* **Helper Text:** Specify one line that should be included in the post caption.  
* **Multi-Text Input Tokenizer Label:** Hashtags & Mentions  
* **Placeholder Text:** e.g., \#asmr \#grwm  
* **Helper Text:** Add relevant items for discoverability validation. Must begin with \# or @.

#### **📦 VIEW PROFILE 2.B: THE REEL-AMPLIFICATION STORY BLOCK**

*(Mounts automatically inside the Active Workspace container if Format \= Story AND Option \= Amplify the Reel)*

##### **Section 1: Story Distribution Mechanics**

* **Read-Only System Target Information Row:** \* Linked Anchor Post Target: \[Icon: Video Link\] Companion Campaign Reel Deliverable Post File  
* **Text Area Label:** Verification Sticker Action Description  
* **Form Ingestion Box:** \[ Empty Manual Input Area \]  
* **Placeholder Text:** Detail what interaction text elements should frame the story post overlay...  
* *Example reference text:* e.g., Overlay a Link Sticker reading "Tap to Shop Bio-Retinol Serum" placed centrally in the lower vertical grid section.  
* **Multi-Input Tag Field Label:** Specific Story Do’s & Don’ts  
* **Placeholder Text:** e.g., DO ensure the video resize boundary does not clip off critical closed-caption subtitles.

#### **📦 VIEW PROFILE 2.C: THE BRAND-LED STORYBOARD ENGINE**

*(Mounts inside the Active Workspace container if Brief Type \= Brand-Led)*

##### **Section 1: Detailed Production Instructions**

* **Read-Only Structural Configuration Row:**  
  * Active Environmental Profile Mix: Tone: {{Tone}} | Lighting: {{Lighting}} | Background Setting: {{Setting}}  
* **Dynamic Storyboard Step Repeater Panel Layout:**

Plaintext  
\+--------------------------------------------------------------------------+  
| 🎬 SCENE SEGMENT STRUCTURAL TIMELINE REPEATER BOX                        |  
|                                                                          |  
| Segment Header Block: Scene {{ index\_id }}: {{ Segment Type }} ({{ Duration }})  
|                                                                          |  
| Text Area Label: Visual Direction                                        |  
| Ingestion Placeholder: Describe the visual composition or frame framing...  
| Inline Read-Only Reference: {{ Instruction\_Context }}                    |  
|                                                                          |  
| Stylized Content Box Label: Audio/Script                                 |  
| Ingestion Placeholder: "Enter exact verbal script teleprompter copy..."  |  
|                                                                          |  
| Reference Graphic Uplink Slot: \[ File Upload / Frame URL Selection Drag Node \]  
\+--------------------------------------------------------------------------+  
| Button Control: \[➕ Add Next Storyboard Scene Segment\]                   |  
\+--------------------------------------------------\------------------------+

### **STEP 3: TIMELINES, LOGISTICS, & CONTRACT REGISTRY (READ-ONLY)**

#### **3.1 Framework Architecture & Verification**

* **Main Header Headline:** Timelines & Terms  
* **Sub-headline Context Text:** Review the final compiled configuration profile across logistical tracks before launching the verification lifecycle.

#### **3.2 Complete Read-Only Review Matrix**

*(The form elements below are configured entirely as Read-Only parameters inherited from your Campaign Planner environment to eliminate data corruption or misalignments)*

* **Data Line Item Grid Container:**  
  * **Parameter Row Label:** Campaign Fulfillment Deadline:  
  * **Display Value Container:** \[ {{ Deadline Type Descriptor }} | Fixed Date: {{ Calendar\_Target\_Date }} \]  
  * **Parameter Row Label:** Physical Product Samples Shipped:  
  * **Display Value Container:** \[ Status Profile Tag: YES / NO \]  
  * **Parameter Row Label:** Contract Compensation Allocation Escrow:  
  * **Display Value Container:** \[ Base Payment Valuation Token: ${{ Escrow\_Amount\_Float }} / Commission Terms: {{ Commission\_Percentage\_Float }}% \]  
  * **Parameter Row Label:** Usage Rights & Whitelisting Constraints:  
  * **Display Value Container:** \[ Bio-Link: {{ Bio\_Days }} Days | Ads Boosting Whitelist: {{ Ad\_Days }} Days | Reposting License: {{ Organic\_Days }} Days \]

### **📱 STICKY NAVIGATION FOOTER IMPLEMENTATION**

Across all steps, the persistent action bar locks securely to the bottom viewport frame, executing the localized state machine transitions detailed below:  
Plaintext  
\[FOOTER BUTTON STATE MACHINE INTERACTION\]:  
\- Step 1 Active Footer Actions:  
  • Left Button \[Discard Layout\] ➔ Resets \[isCreateBriefOpen \= false\] and flushes local array buffers.  
  • Right Button \[Build Creative Strategy →\] ➔ Increments state variable \[currentBriefStep \= 2\].

\- Step 2 Active Footer Actions:  
  • Left Button \[← Back to Strategy\] ➔ Decrements state variable \[currentBriefStep \= 1\].  
  • Right Button \[Proceed to Review Dashboard →\] ➔ Increments state variable \[currentBriefStep \= 3\].

\- Step 3 Active Footer Actions:  
  • Left Button \[← Back to Content Guidance\] ➔ Decrements state variable \[currentBriefStep \= 2\].  
  • Right Button \[Finalize & Dispatch Brief to Creators 🚀\] ➔ Fires final backend submit query, appends brief metadata row directly underneath parent product context, and closes workspace overlay via \[isCreateBriefOpen \= false\].

### **PART 5: ADAPTIVE BRIEF ENGINE INDUSTRY OVERRIDES**

* This configuration panel must listen directly to the active parent campaign context state variable \[industry\_sector\].  
* When \[industry\_sector\] shifts away from baseline 'D2C\_ECOMMERCE', dynamically override default input field placeholder strings, text example guidelines, and tag lists in real time:  
  * **• If HEALTHCARE:** Swap placeholder examples to emphasize certified clinical proof hooks (e.g., replacing "glowy base" with "certified dermatologist efficacy tests"). Change the section 'Do's/Don'ts' tags to explicitly prompt for medical disclosure constraints.  
  * **• If AI\_SAAS:** Swap placeholder entries to emphasize product integration flows (e.g., replacing "skincare retinol" examples with SaaS API activation values). Change input instructions to prompt for screen-capture captures and software modules.  
  * **• If OFFLINE\_EXPERIENCES:** Overwrite text prompts to highlight venue environments, crowd ambience notes, and appearance liability disclosures.

# Add a brief

## **📋 PRODUCTION UI COPY REGISTRY SPECIFICATION**

### **1.0 UNIVERSAL DESKTOP & MOBILE WRAPPER**

**\[CANVAS ENTRY POINT & SYSTEM TRIGGER\]:**

* **Mounting Mode:** This wizard mounts as a full-screen workflow overlay canvas layer sliding up from the bottom over the main Campaign workspace, preserving parent state configurations in the background.  
* **Trigger Rule:** Clicking the action button/icon '+ Create Brief' embedded inside any Zone 2 product row layout or inside the Product Portfolio Details Drawer sets global state variable \[isCreateBriefOpen \= true\] and captures the active product context: \[focusedProductId \= product\_id\].  
* Render this layout block if and only if \[isCreateBriefOpen \=== true\].  
* **Step Multi-Step Navigation Flag:** Initialize client-side state integer \[currentBriefStep \= 1\].  
  * Step views mount conditionally: Step 1 renders when value \=== 1, Step 2 when value \=== 2, Step 3 when value \=== 3\.

Breadcrumb Navigation: Campaign ──► Product ──► Create Brief Auto-Save Status: Draft saved at {{ timestamp }}  
Plaintext  
\+----\----------------------------------------------------------------------+  
| 📊 LIVE CONTEXT PREVIEW SHELL (READ-ONLY RIGHT-SIDE DRAWERS / MOBILE OVERLAY) |  
| Campaign Name: {{ Campaign Name }}  | Objective Target: {{ Primary Objective }}  
| KPI Focus: {{ KPI }}                |  
| Selected Product: {{ Product Name }}  
\+--------------------------------------------------------------------------+

### **STEP 1: BRIEF STRATEGY & DELIVERABLES SPECIFIER MATRIX**

#### **1.1 Structural Foundation**

* **Main Header Headline:** Brief Strategy  
* **Sub-headline Context Text:** Set the tone of the deliverables before detailing them out.  
* **Form Entry Layout Elements:**  
  * **Input Field Label:** Brief Name  
  * **Placeholder Text:** e.g., The Science of Bio-Retinol; GRWM; Unboxing  
  * **Helper Text:** Capture the essence of content you need  
  * **Input Field Label:** Purpose  
  * **Placeholder Text:** e.g., To establish brand credibility via ingredient chemistry and chemistry results.  
  * **Helper Text:** Why did this requirement arise? (Note: This structural block remains hidden from creators).  
  * **Input Field Label:** Objective  
  * **Placeholder Text:** e.g., Establish product as the "Professional's Choice" for high-efficacy results.  
  * **Helper Text:** What are we trying to achieve?  
  * **Input Field Label:** Target Influencer Archetype (Parent Context Syncing)  
  * **Selector Box Component:** \[ Select Profile Archetype from Parent Campaign List v \]  
  * **Radio Toggle Option Group Label:** Brief Type  
    * **(•) Creator-Led (Recommended)** ── *Helper Caption:* Creator’s unique voice around guardrails  
    * **( ) Brand-Led** ── *Helper Caption:* Specific script or storyboard that must be followed.

#### **1.2 Content Deliverables Array Matrix**

* **Section Partition Sub-Header:** 1\. Content Deliverables  
* **Helper Layout Context Text:** Define the assets needed and your level of creative control.

\============================================================================  
**\[DYNAMIC ARRAY REPEATER TRACKING CIRCUIT\]:**

* Initialize a local reactive collection array variable: \[briefDeliverablesArray\].  
* **Trigger Action:** Clicking the button component \[➕ Add Deliverable\] pushes a new structural entity into \[briefDeliverablesArray\] containing unique sub-IDs, standard baseline format values, and default size properties.  
* **Ingestion Interface Loop:** Loop through and map out each entry index node in \[briefDeliverablesArray\].  
  * For each entry, render the selection dropdowns specified below.  
  * Selecting items updates only that specific indexed array node item. \============================================================================  
* **Dropdown Component:** Select Format Type \[ Reel/Video | Story | Photoshoot | Banner/Carousel \]

Plaintext  
┌── IF REEL/VIDEO IS SELECTED:  
├── Dropdown Option Block: Dimension: \[ 9:16 (Full Screen) | 4:5 (Portrait) \]  
└── Dropdown Option Block: Duration:  \[ \<15s | 15-45s | \>45s \]

┌── IF STORY IS SELECTED:  
└── Radio Selector Component Group: Story Intent Execution Type  
├── (•) Amplify the Reel ── \*Helper Text:\* Share the companion reel post to stories with an embedded CTA link sticker.  
└── ( ) Custom Content   ── \*Helper Text:\* Execute original, standalone native storytelling panels.

┌── IF PHOTOSHOOT IS SELECTED:  
└── Technical Number Input Box: Quantity Allocation: \[ {{ integer\_count }} \]

┌── IF BANNER/CAROUSEL IS SELECTED:  
├── Dropdown Option Block: Dimensions: \[ 4:5 (Portrait \- Recommended for maximum real estate) | 1:1 \]  
└── Slider Asset Bound Selector: Slide Range Constraint Count: \[ Slider Limit: 1 \- 10 Slides \]

# **\============================================================================**

**ACTION BUTTON ANCHOR:** \[Button: ➕ Add Deliverable\]

#### **1.3 Usage Rights, Licensing, & Core Requirements**

* **Section Partition Sub-Header:** 2\. Content Deliverables  
* **Interface Toggles Group:**  
  * **Toggle Switch Element:** Link-in-Bio Requirement \[ YES / NO \]  
  * **Conditional Ingestion Box (Visible if YES):** Required Duration Window: \[ \] days  
  * *Helper Caption Text:* Highly recommended for "Push" objectives to track direct traffic.  
  * **Toggle Switch Element:** Partnership/Spark Ads \[ YES / NO \]  
  * **Conditional Ingestion Box (Visible if YES):** Paid Boosting Authorization Window: \[ \] days  
  * *Tooltip Box Copy:* Allows you to run the creator’s post as a paid ad directly from their social handle.  
  * **Toggle Switch Element:** Organic Reposting Rights \[ YES / NO \]  
  * **Conditional Ingestion Box (Visible if YES):** On-Feed Usage Access Window: \[ \] days  
  * *Tooltip Box Copy:* Allows your brand to repost this content on your own feed indefinitely.  
  * **Toggle Switch Element:** Branded Collaboration \[ YES / NO \]  
  * *Tooltip Box Copy:* Creator will tag your social handle in the post.  
* **Form Entry Layout Elements:**  
  * **Input Field Label:** Mandatory Creator Requirements  
  * **Form Ingestion Box:** \[ Text Input Area \]  
  * **Placeholder Text:** e.g., "Must visit the clinic," "Must own a MacBook," or "Must have a Full HD camera."  
  * *Tooltip Box Copy:* Any functional baseline criteria a creator must fulfill to participate in this collaboration track.

### **STEP 2: MULTI-DELIVERABLE CONTENT GUIDANCE PANEL**

#### **2.1 Stacking Layout Matrix**

* **Main Header Headline:** Set the Scene  
* **Sub-headline Context Text:** Detail out the "vibe" and technical requirements of each creative

Plaintext  
\+--------------------------------------------------------------------------+  
| 📦 DYNAMIC CARD STACK CONTROLLER ENGINE                                  |  
|                                                                          |  
| \[ ACTIVE EXPANDED WORKSPACE VIEW \]                                       |  
| Active Identification: Deliverable 1 of {{ total\_count }}                 |  
| Format Profile Spec:   {{ Active\_Format\_Type\_String\_Label }}             |  
|                                                                          |  
| \[CARD MULTIPLEXER CONTROL ENGINE\]:                                       |  
| \- Initialize state index tracker variable \[activeDeliverableIndex \= 0\]   |  
|   pointing to the first item inside \[briefDeliverablesArray\].            |  
| \- Active Canvas Rule: The text area content input fields, dropdown       |  
|   option lists, and tokenizer tag components rendered inside 'VIEW PROFILE|  
|   2.A / 2.B / 2.C' write metrics directly to the array node matched      |  
|   with \[activeDeliverableIndex\].                                         |  
|                                                                          |  
| ──────────────────────────────────────────────────────────────────────── |  
| \[ COLLAPSED CARD TRACK OVERVIEW PANEL \]                                  |  
| Loop through and display all other non-focused indices from              |  
| \[briefDeliverablesArray\] as collapsed tabs inside this track overview.   |  
| Clicking any collapsed tab sets \[activeDeliverableIndex \= clicked\_index\],|  
| smoothly swapping the focused form canvas view.                          |  
|                                                                          |  
| \[Tab Row Label\]: 📁 Deliverable 2: Story (Amplify Reel) \[Click to Focus\] |  
| \[Tab Row Label\]: 📁 Deliverable 3: Carousel (4:5)       \[Click to Focus\] |  
\+--------------------------------------------------------------------------+

#### **📦 VIEW PROFILE 2.A: THE CREATOR-LED CONFIGURATION BLOCK**

*(Mounts inside the Active Workspace container if Brief Type \= Creator-Led)*

##### **Section 1: Content Guidelines**

* **Input Selector Label:** Content Theme *(Searchable Dropdown Element \- Non-Blocking)*  
* **Dropdown Input Box:** \[ Select or type custom theme profile... v \]  
* **Helper Text:** Popular themes instantly recognizable .e.g GRWM , Unboxing  
* **Text Area Label:** Description  
* **Form Ingestion Box:** \[ Empty Manual Input Area \]  
* **Placeholder Guidelines:** Briefly describe the theme.  
* *Inline Action-less Example Visual:* e.g., Pre-makeup routine focused on creating a "glowy" base.  
* **Tokenizer Layout Input Label:** Hook Ideas  
* **Form Ingestion Box:** \[ Empty Multi-Input Tokenizer Field \- Press Enter to lock string tags \]  
* **Placeholder Guidelines:** How to stop the scroll of the viewer?  
* *Layout-Agnostic Context Examples:*  
  * **Example 1:** "Stop buying skincare for the 'vibe' and start buying for the molecule. Here’s why your current retinol is failing your barrier."  
  * **Example 2:** "I’m a skin-scientist, and I’m tired of seeing people ruin their skin with 'flash-irritation' products. Let’s talk about encapsulated stability."  
  * **Example 3:** "If your retinol turns your face red for three days, it’s not 'working'—it’s damaging. Here is the actual chemistry of a healthy glow."  
* **Text Input Label:** Recommended B-rolls  
* **Placeholder Text:** Specify what product shots should be included in the reel  
* **Helper Text:** e.g. The Squelch: A close-up of a finger pressing into a thick cream or jelly mask.  
* **Multi-Input Tag Field Label:** Do’s  
* **Placeholder Text:** e.g. Try to make the product placement genuine.  
* **Helper Text:** What creator should do  
* **Multi-Input Tag Field Label:** Don’ts  
* **Placeholder Text:** e.g. DON’T use "Medical" or "Cure" Claims.  
* **Helper Text:** What creator should definitely not do

##### **Section 2: Creative Guidelines**

* **Multi-Select Input Box Label:** Audio Strategy  
* **Placeholder Selection Text:** Choose audio types...  
* **Array Selection Items:** \[ Direct Voiceover | Trending Music (Background) | Lofi/Focus Beats | Original Audio \]  
* **Dropdown Menu Label:** Lighting Requirements  
* **Placeholder Selection Text:** Select lighting style...  
* **Array Selection Items:** \[ Natural Daylight | Bright/Clinical | Warm/Moody | Studio Ring Light \]  
* **Text Input Box Label:** Background & Setting  
* **Placeholder Text:** e.g., Minimalist desk, aesthetic clinic room, bustling street...  
* **Helper Text:** Keep it relevant to your brand industry category context.  
* **Dropdown Menu Label:** Tone of Voice  
* **Placeholder Selection Text:** Select a vibe...  
* **Array Selection Items:** \[ Authoritative/Expert | High-Energy | Calming/ASMR | Relatable/Casual \]  
* **Text Input Box Label:** Post Caption  
* **Placeholder Text:** e.g. Stop using \[Ingredient\] with \[Ingredient\]—here’s why.  
* **Helper Text:** Specify one line that should be included in the post caption.  
* **Multi-Text Input Tokenizer Label:** Hashtags & Mentions  
* **Placeholder Text:** e.g., \#asmr \#grwm  
* **Helper Text:** Add relevant items for discoverability validation. Must begin with \# or @.

#### **📦 VIEW PROFILE 2.B: THE REEL-AMPLIFICATION STORY BLOCK**

*(Mounts automatically inside the Active Workspace container if Format \= Story AND Option \= Amplify the Reel)*

##### **Section 1: Story Distribution Mechanics**

* **Read-Only System Target Information Row:** \* Linked Anchor Post Target: \[Icon: Video Link\] Companion Campaign Reel Deliverable Post File  
* **Text Area Label:** Verification Sticker Action Description  
* **Form Ingestion Box:** \[ Empty Manual Input Area \]  
* **Placeholder Text:** Detail what interaction text elements should frame the story post overlay...  
* *Example reference text:* e.g., Overlay a Link Sticker reading "Tap to Shop Bio-Retinol Serum" placed centrally in the lower vertical grid section.  
* **Multi-Input Tag Field Label:** Specific Story Do’s & Don’ts  
* **Placeholder Text:** e.g., DO ensure the video resize boundary does not clip off critical closed-caption subtitles.

#### **📦 VIEW PROFILE 2.C: THE BRAND-LED STORYBOARD ENGINE**

*(Mounts inside the Active Workspace container if Brief Type \= Brand-Led)*

##### **Section 1: Detailed Production Instructions**

* **Read-Only Structural Configuration Row:**  
  * Active Environmental Profile Mix: Tone: {{Tone}} | Lighting: {{Lighting}} | Background Setting: {{Setting}}  
* **Dynamic Storyboard Step Repeater Panel Layout:**

Plaintext  
\+--------------------------------------------------------------------------+  
| 🎬 SCENE SEGMENT STRUCTURAL TIMELINE REPEATER BOX                        |  
|                                                                          |  
| Segment Header Block: Scene {{ index\_id }}: {{ Segment Type }} ({{ Duration }})  
|                                                                          |  
| Text Area Label: Visual Direction                                        |  
| Ingestion Placeholder: Describe the visual composition or frame framing...  
| Inline Read-Only Reference: {{ Instruction\_Context }}                    |  
|                                                                          |  
| Stylized Content Box Label: Audio/Script                                 |  
| Ingestion Placeholder: "Enter exact verbal script teleprompter copy..."  |  
|                                                                          |  
| Reference Graphic Uplink Slot: \[ File Upload / Frame URL Selection Drag Node \]  
\+--------------------------------------------------------------------------+  
| Button Control: \[➕ Add Next Storyboard Scene Segment\]                   |  
\+--------------------------------------------------\------------------------+

### **STEP 3: TIMELINES, LOGISTICS, & CONTRACT REGISTRY (READ-ONLY)**

#### **3.1 Framework Architecture & Verification**

* **Main Header Headline:** Timelines & Terms  
* **Sub-headline Context Text:** Review the final compiled configuration profile across logistical tracks before launching the verification lifecycle.

#### **3.2 Complete Read-Only Review Matrix**

*(The form elements below are configured entirely as Read-Only parameters inherited from your Campaign Planner environment to eliminate data corruption or misalignments)*

* **Data Line Item Grid Container:**  
  * **Parameter Row Label:** Campaign Fulfillment Deadline:  
  * **Display Value Container:** \[ {{ Deadline Type Descriptor }} | Fixed Date: {{ Calendar\_Target\_Date }} \]  
  * **Parameter Row Label:** Physical Product Samples Shipped:  
  * **Display Value Container:** \[ Status Profile Tag: YES / NO \]  
  * **Parameter Row Label:** Contract Compensation Allocation Escrow:  
  * **Display Value Container:** \[ Base Payment Valuation Token: ${{ Escrow\_Amount\_Float }} / Commission Terms: {{ Commission\_Percentage\_Float }}% \]  
  * **Parameter Row Label:** Usage Rights & Whitelisting Constraints:  
  * **Display Value Container:** \[ Bio-Link: {{ Bio\_Days }} Days | Ads Boosting Whitelist: {{ Ad\_Days }} Days | Reposting License: {{ Organic\_Days }} Days \]

### **📱 STICKY NAVIGATION FOOTER IMPLEMENTATION**

Across all steps, the persistent action bar locks securely to the bottom viewport frame, executing the localized state machine transitions detailed below:  
Plaintext  
\[FOOTER BUTTON STATE MACHINE INTERACTION\]:  
\- Step 1 Active Footer Actions:  
  • Left Button \[Discard Layout\] ➔ Resets \[isCreateBriefOpen \= false\] and flushes local array buffers.  
  • Right Button \[Build Creative Strategy →\] ➔ Increments state variable \[currentBriefStep \= 2\].

\- Step 2 Active Footer Actions:  
  • Left Button \[← Back to Strategy\] ➔ Decrements state variable \[currentBriefStep \= 1\].  
  • Right Button \[Proceed to Review Dashboard →\] ➔ Increments state variable \[currentBriefStep \= 3\].

\- Step 3 Active Footer Actions:  
  • Left Button \[← Back to Content Guidance\] ➔ Decrements state variable \[currentBriefStep \= 2\].  
  • Right Button \[Finalize & Dispatch Brief to Creators 🚀\] ➔ Fires final backend submit query, appends brief metadata row directly underneath parent product context, and closes workspace overlay via \[isCreateBriefOpen \= false\].

### **PART 5: ADAPTIVE BRIEF ENGINE INDUSTRY OVERRIDES**

* This configuration panel must listen directly to the active parent campaign context state variable \[industry\_sector\].  
* When \[industry\_sector\] shifts away from baseline 'D2C\_ECOMMERCE', dynamically override default input field placeholder strings, text example guidelines, and tag lists in real time:  
  * **• If HEALTHCARE:** Swap placeholder examples to emphasize certified clinical proof hooks (e.g., replacing "glowy base" with "certified dermatologist efficacy tests"). Change the section 'Do's/Don'ts' tags to explicitly prompt for medical disclosure constraints.  
  * **• If AI\_SAAS:** Swap placeholder entries to emphasize product integration flows (e.g., replacing "skincare retinol" examples with SaaS API activation values). Change input instructions to prompt for screen-capture captures and software modules.  
  * **• If OFFLINE\_EXPERIENCES:** Overwrite text prompts to highlight venue environments, crowd ambience notes, and appearance liability disclosures.

# EXECUTION WORKSPACE

# PROSPECTS

### **0.0 UI ARCHITECTURAL MOUNTING & WORKSPACE INSTRUCTIONS**

* **Workspace Engine Binding:** The Prospects Tab is an independent functional sub-view that mounts dynamically inside the central content frame (Dynamic Canvas) of the pre-existing **Campaign Workspace Shell**.  
* **Layout Isolation Rule:** Universal parent layout frame elements remain completely fixed and locked outside this module's rendering pipeline. This includes the left-aligned **Universal Sidebar (Desktop: Dark-themed, 80px width)** and the top-aligned **Universal Header**. No breadcrumbs, title parameters, or contextual statuses may leak into or distort these primary parent frames.  
* **State Preservation Constraint:** Switching tabs or firing drawer modules must maintain all running client-side data filters, search parameters, and session tracking logs within memory to guarantee zero layout recalculation delays.  
* **Mobile Viewport Optimization Core Directive ($\\le 768\\text{px}$):** To prevent stack-bloat on restricted screen heights and leave max room for the Processing Grid, the interface automatically enforces layout collapsing rules:  
  1. Banners scale down to thin rows and support **Manual Exiting (**\[X\] Dismiss**)**.  
  2. The Telemetry Strip compresses into a **Single-Line Dropdown Carousel** that exposes fully only upon touch exploration.  
  3. The Sourcing Action Bar uses **scroll-reactive hide-and-reveal states** or pools into a single Floating Action Button (FAB).  
  4. The right-side profile drawer remounts as an upward-sliding, **Full-Screen Swipeable Bottom-Sheet Canvas Layer** governed by top drag handles.

## **📅 PROSPECTS WORKSPACE FINAL PRODUCTION UI COPY REGISTRY**

### **1.0 PERSISTENT HEADER, COMPRESSED TELEMETRY QUOTAS, & DISMISSIBLE BANNER STRIPS**

#### **1.1 Context Identification Track**

* **Drawer Breadcrumb Track:** Campaigns ──► {{ campaign\_name }} ──► Prospects  
* **Tab Headline Text:** Prospects  
* **Sub-headline Description Text:** Source, review, and initiate outreach with high-performance creators aligned with your campaign brief guidelines.

#### **1.2 Meta Platform Infrastructure Guardrails (Responsive, Auto-Dismissing Ribbons)**

* **View Configuration A: Meta API Disconnected State**  
  * *Layout Container:* High-visibility Amber Notice Board with Left Alert Icon. Includes persistent right-hand Close element \[Icon: Close\] to terminate card.  
  * *Notice String Copy:* ⚠️ Automated AI Sourcing is inactive. Authorize your Meta Creator Marketplace link to automatically unlock creators matching your active brief frameworks.  
  * *Action Trigger Control Link:* \[Connect Meta Account →\]  
* **View Configuration B: Meta OAuth Token Expired / Reset State**  
  * *Layout Container:* Critical Red Security Block with Lock Icon and a rigid \[Icon: Close\] dismiss trigger.  
  * *Notice String Copy:* 🔒 Authentication Interrupted: Your handshake with Meta Marketplace has timed out. Re-authorize your credentials to continue outbound priority communications.  
  * *Action Trigger Control Link:* \[Re-Authenticate Connection\]

#### **1.3 Telemetry Quota & Proactive Rate-Limit Monitor Strip (Mobile Micro-Carousel)**

* **Desktop Layout Matrix:** Clean horizontal info-pill row positioned above the main interactive layout grid showing all metrics at once.  
* **Mobile Layout Compression Rule ($\\le 768\\text{px}$):** Compresses into a single-line, horizontally swipeable text indicator displaying *only the highest-pressure metric entry* with a persistent expansion chevron indicator \[Icon: ChevronDown\].  
* **Component Tracking Items (Expanded State):**  
  * \[Icon: Sparkle\] Meta API Discovery: {{ used\_meta\_queries\_count }} / 20 Profiles Checked Today  
  * \[Icon: Search\] Business Discovery: {{ used\_biz\_discovery\_count }} / 50 Lookups Executed Today  
  * \[Icon: Message\] Outbound Priority DMs: {{ sent\_priority\_dms\_count }} / 10 Dispatched Today  
* **Proactive Exhaustion Notice (Renders inline if any single metric tool reaches its capacity threshold):**  
  * *Notice Sub-text Profile:* 🛑 Dynamic Rate Guard: A data ceiling has been reached for the day. While standard direct lookups and external email redirects remain fully accessible, automated API lookups and Priority DM channels will reset at midnight.

### **2.0 SOURCING CONTROL AREA (THE PROGRESSIVE DISCLOSURE BRIDGE)**

#### **2.1 Initial Launch Frame (Rendered ONLY when the Active Creator Array is Null)**

* **Left Educational Card Canvas Layout:**  
  * *Card Headline:* See How Automated Prospecting Performs  
  * *Body Text:* Learn how our matching framework queries official endpoints to discover, analyze, and safely contact target profiles while protecting your enterprise brand reputation.  
  * *Video Node Overlay Timer Badge:* \[Icon: Play\] 2:14  
* **Right Integration Engine Ingestion Module Layout:**  
  * *Card Headline:* Initialize Sourcing Channels  
  * *Sub-headline Text:* Choose an activation strategy to populate your current outreach matrix.  
  * *Option Trigger Block 1 (Meta API Direct Pipeline):*  
    * *Title Text:* Connect Meta’s Creator Marketplace API  
    * *Benefit Copy:* Direct, high-speed data piping without data scraping. Instantly reviews your active brief themes, influencer archetypes, and audience filters across official databases.  
    * *Primary Call-to-Action:* \[Button: Connect Facebook Profile\]  
    * *Trust Verification Tag:* \[Icon: Shield\] META BUSINESS PARTNER  
  * *Option Trigger Block 2 (Manual Asset Insertion):*  
    * *Title Text:* Import List Manually via Social Handles  
    * *Benefit Copy:* Upload specific instagram profiles to cross-reference them against professional performance metrics.  
    * *Primary Call-to-Action:* \[Button: Add Profile Handles\]

#### **2.2 Scroll-Reactive Sourcing Action Bar (Collapses on Scroll Down / Re-appears on Scroll Up)**

* *Mobile Behavior:* Slides up cleanly beneath the page header boundary on down-scroll vectors to expand the viewport room for grid execution rows.  
* *Action Element 1:* \[Button (Ghost Style)\]: \[Icon: Sparkle\] Automated Meta AI Sync  
* *Action Element 2:* \[Button (Ghost Style)\]: \[Icon: Plus\] Add Profile Handle  
* *Action Element 3:* \[Button (Ghost Style)\]: \[Icon: Archive\] Archived Ledger ({{ archived\_count }})  
* **Mobile Floating Action Button (FAB Option Alternative):**  
  * If actions collapse completely to clear screen constraints, mount a unified sticky circular trigger at the lower-right baseline index frame: \[ ➕ Sourcing Engine \]

### **3.0 UNIFIED PROSPECT PROCESSING DATA GRID (THE OPERATION CANVAS)**

#### **3.1 Bulk Action Toolbar (Visible on row checkbox selection toggle)**

* Selected: {{ active\_selection\_count }} Creators ── \[Button: Bulk Reject/Archive\] | \[Button: Clear Active Selection\]

#### **3.2 Data Grid Column Mapping Header Rows (Hidden on Mobile Viewports)**

* **Column 1:** Creator Identity / Target Asset | **Column 2:** Sourcing Discovery Path | **Column 3:** Audience Range | **Column 4:** Brief Matching Grade | **Column 5:** Communication Status | **Column 6:** Primary Outreach Command | **Column 7:** Manage

#### **3.3 Dynamic Grid Data Rows Injection Engine Layout**

\====================================================================================================  
\[ ROW ITERATOR PATTERN FOR HIGH-DENSITY TABLE DATA HOUSING \]  
\====================================================================================================  
• COLUMN 1: \[Checkbox\] \[Avatar Node: Profile Image URL\] @{{ creator\_instagram\_handle }}  
            Sub-text Context Tracking: Assigned Brief: {{ brief\_internal\_name }}

• COLUMN 2: ┌── IF Source \== META\_MARKETPLACE:  \[Pill Tag (Solid Green)\]:  Meta Marketplace  
            ├── IF Source \== MANUAL\_DISCOVERY: \[Pill Tag (Solid Blue)\]:   Manual: Verified  
            └── IF Source \== MANUAL\_UNVERIFIED:\[Pill Tag (Solid Orange)\]: Manual: Profile Error

• COLUMN 3: Followers: {{ baseline\_follower\_count\_string }} | Engagement: {{ engagement\_rate\_percentage }}%

• COLUMN 4: ┌── IF Match\_Score \>= 80%: \[Score Pill (Green Fill)\]: {{ matching\_score }}% Match  
            └── IF Match\_Score \< 80%:  \[Score Pill (Grey Fill)\]:  {{ matching\_score }}% Match

• COLUMN 5: \[Status Marker Badge\]: Pending Review | Priority DM Dispatched | Follow-up Sent | Rejected

• COLUMN 6: CONTEXTUAL OUTREACH CHANNEL COMMAND ROUTER:  
            ├── IF Source \== META\_MARKETPLACE AND priority\_dm\_quota\_available:  
            │   \`\[Button (Solid Green Fill)\]: Send Priority DM\`  
            │  
            ├── IF Source \== MANUAL\_DISCOVERY AND creator\_active\_on\_marketplace AND priority\_dm\_quota\_available:  
            │   \`\[Button (Solid Green Fill)\]: Send Priority DM\`  
            │  
            ├── IF Source \== MANUAL\_DISCOVERY AND creator\_not\_on\_marketplace:  
            │   \`\[Button (Solid Blue Fill)\]: Send Standard DM\`  
            │  
            ├── IF Source \== MANUAL\_DISCOVERY AND profile\_has\_email\_only:  
            │   \`\[Button (Outline Style)\]: Contact via Email\`  
            │  
            ├── IF Source \== MANUAL\_UNVERIFIED:  
            │   \`\[Button (Disabled Style)\]: Action Blocked (No Profile Match)\`  
            │  
            └── IF global\_outbound\_dm\_quota\_exhausted:  
                \`\[Button (Disabled Style)\]: Quota Exhausted\`

• COLUMN 7: Row Utility Navigation Blocks:  
            \`\[Icon: Eye\]\` ── \*Trigger Action:\* Launches Dynamic Sidebar Drawer (Desktop) or Vertical Sheet (Mobile).  
            \`\[Icon: Trash\]\` ── \*Trigger Action:\* Removes row element and logs to Archived Ledger.  
\=========================================================================\===========================

### **4.0 DESKTOP DRAWER / MOBILE BOTTOM-SHEET INTERACTIVE OVERLAY PROFILE**

* **Mobile Mounting Optimization Check ($\\le 768\\text{px}$):** Changes from a rigid right-side slide-out pane into a 95%-height vertical sliding sheet tracking upwards from the page floor. Includes top horizontal tactile pull-bar indicator: ─── \[ Pill Drag Handle Indicator \] ───

#### **🚪 DATA HYDRATION PROFILE STATE 4.A: THE META MARKETPLACE INTERACTIVE PREMIUM PROFILE**

* **Top Meta Validation Segment:** \[Pill Tag: Official Meta Marketplace Verified Portfolio\]  
* **Primary Identity Unit Layout:**  
  * \[Avatar Circle Image\] @{{ creator\_instagram\_handle }}  
  * Location Tracker Parameter: \[Icon: MapPin\] {{ localized\_city\_string }}, {{ localized\_country\_string }}  
  * Dynamic Domain Taxonomy Badges: • {{ tag\_classification\_1 }} • {{ tag\_classification\_2 }} • {{ tag\_classification\_3 }}  
* **Performance Intelligence Ledger Matrix:**  
  * Followers: {{ total\_follower\_count\_token }} | Avg Likes: {{ engagement\_likes\_metric }} | Avg Views: {{ performance\_view\_metric }}  
  * Calculated Engagement Benchmark Index: ER Rating: {{ computed\_er\_percentage }}%  
* **Recent Creative Output Carousel Section:**  
  * *Section Header:* Verified Marketplace Creative Outputs  
  * *Action Button Layout:* \[Button (Flat Layout)\]: View Native App Content ↗  
  * *Content Frame Layout:* Native Horizontal Content Track \[ \[Image Thumbnail Node 1\] | \[Image Thumbnail Node 2\] | \[Image Thumbnail Node 3\] \]  
* **Strategic Brand AI Alignment Panel Component:**  
  * *Panel Section Header:* Intelligent Alignment Grading Match Data  
  * *Progress Metric Bar Widget Value:* {{ alignment\_score\_integer }}% Fit Ratio  
  * *AI Context Diagnostic Summary:* This profile matches your configured parent influencer archetype metrics because their core content profile features unboxings and educational breakdowns.  
* **Sticky Navigation Footer (Anonymously locked to window edge on mobile devices):**  
  * *Left Lower Action Option Anchor:* \[Button (Ghost Style)\]: Reject & Archive Prospect  
  * *Right Lower Action Option Anchor:* \[Button (Solid Green Fill)\]: Continue to Priority DM Dispatch →

#### **🚪 DATA HYDRATION PROFILE STATE 4.B: THE BUSINESS DISCOVERY STANDARD ACCOUNT INTERFACE**

* **Top Data Source Track Segment:** \[Pill Tag: Public Business Discovery Endpoint Extract\]  
* **Primary Identity Unit Layout:**  
  * \[Avatar Circle Image\] @{{ creator\_instagram\_handle }}  
  * Public Bio Description Text Area: "{{ extracted\_biography\_text\_string }}"  
* **Performance Baseline Parameters Ledger Matrix:**  
  * Followers: {{ total\_follower\_count\_token }} | Total Uploaded Assets: {{ historical\_media\_count }}  
* **System Optimization Alert Placement Block:**  
  * *Alert Text:* ℹ️ Profile Context Limit: This creator is not registered inside the Meta Marketplace database directory. High-tier automated AI diagnostics and algorithmic match breakdowns are restricted for unmapped public endpoints.  
* **Sticky Navigation Footer (Anonymously locked to window edge on mobile devices):**  
  * *Left Lower Action Option Anchor:* \[Button (Ghost Style)\]: Close Insights  
  * *Right Lower Action Option Anchor:* \[Button (Solid Blue Fill)\]: Initialize Outreach Options →

#### **🚪 DATA HYDRATION PROFILE STATE 4.C: THE UNVERIFIED PROFILE NULL EXTRACT**

* **Top System Status Placement Block:** \[Pill Tag: Sourcing Validation Failure\]  
* **Primary Graphic Placeholder Frame:** \[Icon: SearchAlert\] Frame Layout Block  
* **Main Notice Copy Section Box:**  
  * *Headline Context Text:* Profile Lookup Returned No Verified Results  
  * *Explanatory Paragraph Narrative Text:* Our Business Discovery API pipeline was unable to retrieve a public professional record matching the handle @{{ captured\_user\_string }}. This profile may currently be configured as private or has disconnected its visibility from third-party application requests.  
* **Sticky Navigation Footer (Anonymously locked to window edge on mobile devices):**  
  * *Left Lower Action Option Anchor:* \[Button (Ghost Style)\]: Remove and Close  
  * *Right Lower Action Option Anchor:* \[Button (Disabled Style)\]: Data Lookup Unobtainable

#### **🚪 DATA HYDRATION PROFILE STATE 4.D: THE LOOKUP THROTTLED/LOCKED RUN STATE**

* **Top System Status Placement Block:** \[Pill Tag: Quota Pipeline Blocked\]  
* **Primary Graphic Placeholder Frame:** \[Icon: LockProgress\] Blurred Component Frame  
* **Main Notice Copy Section Box:**  
  * *Headline Context Text:* Discovery Lookup Limit Reached  
  * *Explanatory Paragraph Narrative Text:* The metadata profile for @{{ captured\_user\_string }} is temporarily locked. Your account has hit its daily data lookup limit (50/50 lookups). This dashboard profile will automatically unlock and run validation checks once your query allocation refreshes tomorrow.  
* **Sticky Navigation Footer (Anonymously locked to window edge on mobile devices):**  
  * *Left Lower Action Option Anchor:* \[Button (Ghost Style)\]: Dismiss Sheet  
  * *Right Lower Action Option Anchor:* \[Button (Solid Amber Fill)\]: Upgrade Processing Plan Tier ⚡

### **5.0 INTERACTION COMMUNICATION OVERLAY PORTALS**

#### **5.1 The Automated Priority DM Dispatcher (Meta Connected Protocol Canvas Overlay)**

* **Modal Overlay Framing Title:** Send Priority DM  
* **Sub-headline Context Status Bar:** Initiating high-speed communication channel access targeting @{{ creator\_instagram\_handle }} via Meta Direct.  
* **Message Workspace Input Element Block Label:** Outbound Message Structural Draft  
* **Text Processing Input Canvas Box:**  
  * *Form Value Preset Template Text Area:* Hi @{{ creator\_instagram\_handle }}, love your aesthetic\! It aligns perfectly with our active '{{ campaign\_name }}' workstream. Review our full brief framework, creative components, and compensation milestones securely via this access portal line: {{ tracking\_short\_link\_url }}  
* **Dynamic Character Metrics Counter Tracker Label:** {{ current\_string\_length\_count }} / 1000 Characters Allocated  
* \**Context Protection Note Tag String:* 💡 Delivery Metric Rule: Priority DMs route past standard user request filtering lists directly into active communication streams. You have {{ remaining\_priority\_dm\_count }} direct messages left before hitting your daily limit.  
* **Sticky Navigation Footer (Anonymously locked to window edge on mobile devices):**  
  * *Left Action Button Selection Option:* \[Button (Ghost Style)\]: Cancel and Discard Draft  
  * *Right Action Button Selection Option:* \[Button (Solid Green Fill)\]: Dispatch Priority DM 🚀

#### **5.2 External Communication Pre-Fill Link Variables (Gmail Redirect Parameters)**

* **Functional Routing Context Execution Pattern:** Selecting an unverified or fallback email outreach option bypasses local application modals to programmatically call the system mailto: default redirection strings.  
* **Data Variable Schema Values Mapping Rules Engine:**  
  * To URL Destination: {{ creator\_contact\_email\_string }}  
  * Subject Content Line String: Collaboration Invitation Profile: {{ brand\_corporate\_identity\_name }} × {{ campaign\_name }}  
  * Body Text String Ingestion Template Layout Parameters: Hi @{{ creator\_instagram\_handle }},\\n\\nWe tracked down your profile matching criteria and would love to introduce your audience profile to our active '{{ campaign\_name }}' project tracks.\\n\\nReview the exact production specifications and track metrics securely over this link line: {{ tracking\_short\_link\_url }}\\n\\nLooking forward to your feedback\!

### **6.0 SYSTEM HISTORICAL PERFORMANCE STRIP (THE METRICS REVIEW LEDGER)**

* **Layout Matrix Visibility Guard:** Hide this horizontal panel structure entirely if the parent Influencer Prospecting List occupies an Empty Null Canvas State.  
* **Section Framework Section Header Label:** Sourcing Execution & Conversion Metrics  
* **Read-Only System Performance Row Layout Parameters:**  
  * \[Label Block\]: Outbound Invites Dispatched: \[Metric Data Badge\]: {{ database\_total\_invites\_integer }}  
  * \[Label Block\]: Target Portal Link Click Rate: \[Metric Data Badge\]: {{ tracking\_clicks\_percentage\_float }}%  
  * \[Label Block\]: Confirmed Intent Applications: \[Metric Data Badge\]: {{ creator\_applications\_count\_integer }}  
  * \[Label Block\]: Active Direct Response Rate: \[Metric Data Badge\]: {{ channel\_response\_efficiency\_index }}%

# APPLICANTS

### **0.0 UI ARCHITECTURAL MOUNTING & WORKSPACE INSTRUCTIONS**

* **Workspace Engine Binding:** The Applicants Tab is the second functional sub-view that mounts dynamically inside the central content frame (Dynamic Canvas) of the pre-existing **Campaign Workspace Shell**.  
* **Layout Isolation Rule:** Universal parent layout frame elements remain completely fixed and locked outside this module's rendering pipeline. This includes the left-aligned **Universal Sidebar (Desktop: Dark-themed, 80px width)** and the top-aligned **Universal Header**. No breadcrumbs, title parameters, or contextual statuses may leak into or distort these primary parent frames.  
* **State Preservation Constraint:** Switching tabs or firing drawer modules must maintain all running client-side data filters, search parameters, and session tracking logs within memory to guarantee zero layout recalculation delays.  
* **Mobile Viewport Optimization Core Directive ($\\le 768\\text{px}$):** To prevent stack-bloat on restricted screen heights and leave maximum room for the Processing Grid, the interface automatically enforces layout collapsing rules:  
  1. The Vetting Overview summary strip compresses into a **Single-Line Dropdown Carousel** that exposes fully only upon touch exploration.  
  2. The Right Batch Action bar uses **scroll-reactive hide-and-reveal states** or pools into a single Floating Action Button (FAB).  
  3. The deep vetting profile drawer remounts as an upward-sliding, **Full-Screen Swipeable Bottom-Sheet Canvas Layer** governed by top drag handles.

## **📅 APPLICANTS WORKSPACE FINAL PRODUCTION UI COPY REGISTRY**

### **1.0 PERSISTENT HEADER, COMPRESSED TELEMETRY VETTING STRIP, & EMPTY STATES**

#### **1.1 Context Identification Track**

* **Drawer Breadcrumb Track:** Campaigns ──► {{ campaign\_name }} ──► Applicants  
* **Tab Headline Text:** Applicants  
* **Sub-headline Description Text:** Review, vet, and advance authenticated creators who have accepted your invitations or applied directly via your shared campaign links into Stage 1 Commercial Negotiations.

#### **1.2 Empty State Canvas (Null State Configuration)**

* **Main Graphic Placeholder Frame:** \[Icon: GroupAdd\] Centered Canvas Layout Block  
* **Headline Text:** Waiting for your first applicant?  
* **Body Paragraph:** Your campaign parameters are live\! Copy and distribute your unique application landing page link to your community or social channels to seed your inbound verification pipeline.  
* **Primary Control Trigger Action:** \[Button (Solid Green Fill)\]: Copy Application Share Link  
* **Secondary Control Trigger Action:** \[Button (Outline Style)\]: View Share Hub Layout

#### **1.3 Vetting Performance Summary Strip (Mobile Micro-Carousel)**

* **Desktop Layout Matrix:** Clean horizontal info-pill row positioned above the main interactive layout grid showing all metrics at once.  
* **Mobile Layout Compression Rule ($\\le 768\\text{px}$):** Compresses into a single-line, horizontally swipeable text indicator displaying *only the metric entries* with a persistent expansion chevron indicator \[Icon: ChevronDown\].  
* **Component Tracking Items (Expanded State):**  
  * \[Icon: Group\] Total Dynamic Applicants: {{ total\_applicants\_count }} Profiles  
  * \[Icon: Sparkle\] Average Core Match Index: {{ avg\_match\_score }}% Fit Grade  
  * \[Icon: QueryBuilder\] Awaiting Triage Review: {{ pending\_vetting\_count }} Profiles  
* **Local Scope Filter Dropdown:** \[Filter: Select Brief/Product Focus ▾\]

### **2.0 SHARED APPLICATION OPERATIONAL CONTROL BAR**

#### **2.1 Filter & Search Module (Left Aligned)**

* *Action Element 1:* \[Filter Dropdown Menu\]: All Briefs ▾  
* *Action Element 2:* \[Filter Dropdown Menu\]: Operational Status (Pending Review) ▾  
* *Action Element 3:* \[Search Text Field Input\]: Search profiles by handle...

#### **2.2 Mass-Processing Engine Buttons (Right Aligned)**

* *Action Element 1:* \[Button (Solid Green, Disabled Style)\]: Bulk Approve & Initialize Negotiation  
* *Action Element 2:* \[Button (Outline Red, Disabled Style)\]: Bulk Decline Applications  
* *Workspace State Transition Rule:* These controls automatically unlock, illuminate, and accept touch vectors if $\\ge 1$ row-level selection checkbox in the Processing Grid is toggled positive.

### **3.0 HIGH-DENSITY APPLICANTS PROCESSING FEED GRID (THE OPERATION CANVAS)**

#### **3.1 Bulk Action Active State Indicator (Visible only on row checkbox toggle)**

* Selected: {{ active\_selection\_count }} Applicants Selected for Batch Triage

#### **3.2 Data Grid Column Mapping Header Rows (Hidden on Mobile Viewports)**

* **Column 1:** Creator Identity / Handle | **Column 2:** Application Origin | **Column 3:** AI Target Match Index | **Column 4:** Campaign Component Focus | **Column 5:** Baseline Compensation Expectation | **Column 6:** Automated AI Triage Flag | **Column 7:** Workspace Action Commands | **Column 8:** Deep Drill-Down

#### **3.3 Dynamic Grid Data Rows Injection Engine Layout**

\====================================================================================================  
\[ ROW ITERATOR CONFIGURATION FOR THE CORE APPLICANTS FEED \]  
\====================================================================================================  
• COLUMN 1: \[Checkbox\] \[Avatar Thumbnail Image URL Node\] @{{ creator\_instagram\_handle }}  
            Sub-text Context Tracker: ┌── IF Read\_Status \== UNREAD: \[Pill Tag (Solid Green)\]: NEW  
                                      └── IF Read\_Status \== READ:   Applied: {{ formatted\_date }}

• COLUMN 2: APPLICATION ORIGIN IDENTIFIER  
            ├── IF Link\_Source \== OUTBOUND\_INVITE: \[Pill Tag (Soft Indigo Text/Fill)\]: Outbound Invite  
            └── IF Link\_Source \== UNIVERSAL\_LINK:  \[Pill Tag (Soft Grey Text/Fill)\]:   Organic Inbound

• COLUMN 3: AUTHENTICATED OAUTH AI TARGET MATCH INDEX  
            ├── IF Score \>= 80%: \[Match Score Pill (Vibrant Green)\]: {{ match\_percentage }}% Match  
            ├── IF Score 50-79%: \[Match Score Pill (Muted Amber)\]:   {{ match\_percentage }}% Match  
            └── IF Score \< 50%:  \[Match Score Pill (Dull Red)\]:      {{ match\_percentage }}% Match

• COLUMN 4: STRATEGIC BRIEF COMPONENT TRACKING  
            Text: Product Focus: {{ targeted\_product\_or\_service\_name }}  
            Sub-text Context Frame: Assigned Brief: {{ brief\_internal\_name }}

• COLUMN 5: INITIAL COMPENSATION EXPECTATION  
            Text: Baseline Ask: {{ creator\_initial\_asked\_rate\_currency\_token }}  
            Sub-text Payout Mode: Preferred: {{ preferred\_payout\_mode\_value\_string }}

• COLUMN 6: AUTOMATED AI TRIAGE FLAG (Parsed via full OAuth authenticated profile metrics)  
            ├── IF Insight\_Sentiment \== POSITIVE: \[Signal Badge (Soft Green Text)\]: {{ ai\_triage\_remark }}  
            └── IF Insight\_Sentiment \== NEGATIVE: \[Signal Badge (Soft Red Text)\]:    {{ ai\_triage\_remark }}  
            \*(Dynamic Runtime Examples: "🔥 High Saves-to-Likes Ratio", "⚠️ Low Geo-Alignment \<12%")\*

• COLUMN 7: CONTEXTUAL WORKSPACE OPERATIONS CONTROL  
            \`\[Button (Solid Green Fill)\]: Approve\` \-\> Advances creator to Active Collabs (Stage 1 Negotiation)  
            \`\[Button (Outline Red Style)\]: Decline\` \-\> Fires Smart Rejection Feedback Modal

• COLUMN 8: INLINE DEEP VETTING ACTION  
            \`\[Icon: Eye\]\` ── \*Trigger Action:\* Launches Deep Vetting Sidebar Drawer or Full Mobile Sheet.  
\====================================================================================================

### **4.0 DEEP VETTING DRAWER (DESKTOP SIDE PANE / MOBILE SWIPEABLE BOTTOM SHEET)**

* **Mobile Mounting Optimization Check ($\\le 768\\text{px}$):** Changes from a rigid right-side slide-out pane into a 95%-height vertical sliding sheet tracking upwards from the page floor. Includes top horizontal tactile pull-bar indicator: ─── \[ Pill Drag Handle Indicator \] ───

#### **A. Header Profile Hub (Sticky Core Parameters)**

* **Identity Row:** @{{ handle }} \[Icon: Instagram\] Connected Profile  
* **Target Mapping Framework Fields:** Campaign Product Target: {{ targeted\_product\_name }} | Assigned Brief Frame: {{ brief\_internal\_name }}

#### **B. Section 1: Algorithmic Fit Breakdown (Collapsible Panel)**

* **Section Header Headline:** AI Evaluation Summary  
* **Match Indicator Score Pill:** {{ match\_percentage }}% Target Fit Grade  
* **System Automation Recommendation Node:** \* ├── IF Match \>= 70%: \[Recommendation Badge (Solid Green)\]: Proceed with Collaboration  
  * └── IF Match \< 70%: \[Recommendation Badge (Solid Red)\]: Structural Persona Variance  
* **AI Diagnostics Analytical Paragraph Text Area:** "Creator @{{ handle }} matches your historical brief profiles due to strong audience overlap in the lifestyle segment and clear historical brand affinity matching parameters."

#### **C. Section 2: Authenticated Performance Matrix (Collapsible Panel)**

* **Section Header:** Account Metrics & AI Insights  
* **AI Micro-Insight Banner Context String:** "🔥 Inside Track: This account features an exceptionally high saves-to-likes ratio, indicating high audience conversion and intent hook potential."  
* **Metric Table Grid Blocks:**  
  * Followers: {{ total\_count\_token }} | Engagement Rate: {{ er\_percentage }}% | Audience Authenticity: {{ real\_followers\_percentage }}% Real  
  * Avg Likes: {{ likes\_metric }} | Avg Views: {{ views\_metric }} | Avg Shares: {{ shares\_metric }}

#### **D. Section 3: Audience Persona & Geography Validation (Collapsible Panel)**

* **Section Header:** Demographic Breakdowns & Affluence Profiles  
* **AI Micro-Insight Banner Context String:** "Profile validation confirms deep resonance with the brand’s core target consumer demographic profiles."  
* **Interactive Chart Frames Visual Sub-labels:**  
  * Gender Distribution Chart: \[Pie Chart Component Frame\]  
  * Core Target Age Spans: \[Bar Graph Component Frame\]  
  * Top Location Centers: {{ list\_of\_top\_cities\_and\_countries }}  
  * Estimated Audience Affluence Profile: \[Status Badge: {{ Mid/High/Premium }}\]  
  * Brand Affinity Profiles: {{ parsed\_brand\_competitor\_mentions\_list }}

#### **E. Section 4: Content Archetype & Visual Alignment (Collapsible Panel)**

* **Section Header:** Visual Alignment & Archetype Classification  
* **AI Micro-Insight Banner Context String:** "The creator’s visual styling, image composition, and keyword tags align directly with your brief content pillars."  
* **Classification Meta Tags Label Track:**  
  * Calculated Archetype Class: {{ archetype\_name }} | Industry Niche Segment: {{ niche\_name }}  
  * Monitored Production Hashtags: {{ historical\_hashtag\_strings }}

#### **F. Section 5: High-Density Production Portfolio Preview (Collapsible Panel)**

* **Section Header:** Recent Native Content Portfolio (9:16)  
* **Interaction Helper Instruction Tag:** 💡 Layout Control: Hover over video asset blocks to initialize fluid, muted media playback verification previews.  
* **Content Canvas Media Matrix:** High-density 3x3 layout thumbnail container mapping historical uploaded Reels/Shorts assets.

#### **G. Drawer Footer Layer (Sticky Boundary Actions Panel)**

* \[Button (Solid Green Fill)\]: Approve & Advance to Active Collabs  
* \[Button (Outline Red Style)\]: Decline Application  
* \[Button (Link Layout Styles)\]: View Original Profile Node on Instagram ↗

### **5.0 SMART REJECTION FEEDBACK MODAL**

* **Modal Header Main Title:** Reject Applicant?  
* **Sub-headline Text Description:** Select a primary reason for declining this application. Your feedback directly trains our matching engine to better filter future recommendations.  
* **Selection Interface Options (Radio Group Array):**  
  * \[Radio\] Visual aesthetic or stylistic output does not fit campaign brief creative themes  
  * \[Radio\] Core audience metrics (Demographics, Geography, or Authenticity) failed target criteria  
  * \[Radio\] Historical profile data exhibits low engagement quality or suspicious growth logs  
  * \[Radio\] Initial baseline compensation expectation/asked quote exceeds campaign allocation limits  
* **Text Input Frame (Conditional field exposed if any option is toggled positive):**  
  * *Placeholder Text Box:* Provide additional contextual feedback to refine your matching preferences (Optional)...  
* **Modal Action Execution Buttons Footer:**  
  * \[Button (Solid Red Fill)\]: Confirm Rejection & Log Feedback  
  * \[Button (Ghost Style)\]: Cancel and Return

### **6.0 SYSTEM REAL-TIME STATUS CHANGES & OUTBOUND PAYLOAD ENGED**

#### **6.1 System Toast Notifications (Action Completion Confirmation Triggers)**

* **Approval Trigger Execution Response:** “@{{ handle }} approved and advanced to Active Collabs. Automated portal message has been issued successfully.”  
* **Rejection Trigger Execution Response:** “Application declined cleanly. Operational rejection flags logged to train machine discovery recommendation parameters.”

#### **6.2 Post-Approval Automated Chat Invite String (The Hook Step)**

* **Platform Delivery Core:** Instagram Authenticated Connected Core API Direct Messaging Channels  
* **Outgoing String Structure Template:** \> *"Great news @{{ handle }}\! Your application has been approved for our active campaign: {{ campaign\_name }}. Your personalized commercial workspace is officially open. Access your workspace dashboard here to review specifications, submit your quote, and finalize delivery timelines: {{ secure\_link }}"*

# ACTIVE COLLABS

### **0.0 UI ARCHITECTURAL MOUNTING & WORKSPACE INSTRUCTIONS**

* **Workspace Engine Binding:** The Active Collabs Tab is the third functional sub-view that mounts dynamically inside the central content frame (Dynamic Canvas) of the pre-existing **Campaign Workspace Shell**.  
* **Layout固定 Isolation Rule:** Universal parent layout frame elements remain completely fixed and locked outside this module's rendering pipeline. This includes the left-aligned **Universal Sidebar (Desktop: Dark-themed, 80px width)** and the top-aligned **Universal Header**. No parent frames are re-rendered or structurally modified during inner-tab navigation.  
* **State Preservation Constraint:** Switching tabs, filtering columns, or opening contextual confirmation overlays must maintain all running client-side data filters, multi-row selections, sorting configurations, and scroll parameters within memory to avoid layout recalculation delays.  
* **Mobile Viewport Optimization Core Directive ($\\le 768\\text{px}$):** To maximize readability inside the high-density grid matrix and eliminate layout overflow:  
  1. The linear 6-step milestone breadcrumb collapses into an interactive **Single-Icon Progress Radial/Fraction Metric** (e.g., \[3/6 Steps\]).  
  2. The Telemetry Strip compresses into a horizontally swipeable, single-row summary card matrix.  
  3. Row actions stack vertically beneath primary identity nodes, and the batch action bar transitions to an upward-sliding sticky contextual sheet layout when active row checkboxes are initialized.

### **1.0 FUNCTIONAL & JOURNEY DIAGNOSTICS**

An analysis of the user-provided layout guidelines reveals operational blind spots that can lead to tracking errors or budget risks if left unmanaged in a fast-paced dashboard environment. The following updates protect brand investments and reduce user friction:

#### **A. The 72-Hour Auto-Approval Financial Risk (Rule BR-01)**

* **The Vulnerability:** Per the collaboration workflow engine documentation, if a creator uploads an asset for review, the brand must act within 72 hours, or the system triggers auto-approval and releases the 70% final payout. In a flat list view, a user cannot easily see which reviews are about to expire.  
* **The Optimization:** Introduce a dedicated **System Risk/Alert Timer** column directly alongside the status tag. When content is submitted, this column displays a real-time, color-coded countdown clock (e.g., ⏳ 14h left to review in crimson text) to highlight and prioritize time-sensitive approvals.

#### **B. Negotiation Boundary Restrictions (Rule BR-02)**

* **The Vulnerability:** The state machine enforces a strict limit of one counter-offer per party before marking an offer as final. A user looking at a high volume of active negotiations needs to quickly identify which items are open for edits versus those locked at the final offer stage.  
* **The Optimization:** The "Status" column must display explicit sub-states (e.g., Negotiation (Round 1\) vs. Final Offer Pending). This ensures clear context before a user triggers the slide-out review drawer.

#### **C. Logistics Exceptions & Health Flagging (Rule BR-03)**

* **The Vulnerability:** Tracking numbers are core requirements for D2C campaigns, and multiple shipping failures trigger automatic project cancellations. The current workspace doesn't display these logistics alerts in the main feed view.  
* **The Optimization:** Integrate real-time logistics tracking sub-labels within the status frame (e.g., In Transit: Delayed or ⚠️ Delivery Exception) along with a visible count of active shipping issues.

## **📅 ACTIVE COLLABS TAB FINAL PRODUCTION UI COPY REGISTRY**

### **2.0 PERSISTENT HEADERS, TELETRAM PERFORMANCE PIPELINE, & BANNER CONTROLS**

#### **2.1 Context Identification Track**

* **Drawer Breadcrumb Track:** Campaigns ──► {{ campaign\_name }} ──► Active Collabs  
* **Tab Headline Text:** Active Collabs  
* **Sub-headline Description Text:** Track production milestones, manage logistics fulfillment, review content assets, and authorize milestone escrow distributions across active creator partnerships.

#### **2.2 Production Performance Overview Strip (Collapsible Metadata Panel)**

* **Desktop Matrix Layout:** Horizontal row tracking elements displaying synchronized metrics for the live production pipeline.  
* **Mobile Layout Compression Rule ($\\le 768\\text{px}$):** Compresses into a single-line horizontal card array with swipe navigation controls.  
* **Tracking Components:**  
  * \[Icon: Sync\] Total Active Partnerships: {{ total\_active\_count }} Partnerships  
  * \[Icon: LocalShipping\] Shipments in Flight: {{ outbound\_shipping\_count }} En Route  
  * \[Icon: RateReview\] Content Reviews Open: {{ review\_queue\_count }} Awaiting Brand  
  * \[Icon: AccountBalanceWallet\] Escrow Payouts Pending: {{ payouts\_pending\_count }} Authorized  
* **Local Scope Filter Dropdown:** \[Filter: Select Campaign Brief Variant ▾\]

### **3.0 TABULAR OPERATIONAL CONTROL BAR**

#### **3.1 Advanced Matrix Layout Filters (Left Aligned)**

* *Action Element 1:* \[Filter Dropdown Menu\]: All Brief Frameworks ▾  
* *Action Element 2:* \[Filter Dropdown Menu\]: Current Milestone Stage (All Stages / 1\. Negotiation / 2\. Securement / 3\. Logistics / 4\. Content Review / 5\. Publishing / 6\. Feedback Sync) ▾  
* *Action Element 3:* \[Filter Dropdown Menu\]: Workflow Pipeline Health (All / On Track / Approaching Deadline / Action Overdue / System Hold) ▾  
* *Action Element 4:* \[Search Text Field Input\]: Search active collaborations by social handle...

#### **3.2 Mass-Processing Action Controls (Right Aligned)**

* *Action Element 1:* \[Button (Ghost Style, Grey Accent Color)\]: \[Icon: UploadFile\] Export Active Logistics Manifest (CSV)  
* *Action Element 2:* \[Button (Solid Green Fill, Disabled Default State)\]: \[Icon: Bolt\] Bulk Nudge Selected Creators  
* *State Transformation Constraint:* The Bulk Nudge command unlocks and illuminates if $\\ge 1$ item row selection checkbox is checked positive.

### **4.0 HIGH-DENSITY INTERACTIVE OPERATIONAL DATA GRID**

#### **4.1 Bulk Action Secondary Header Element (Visible only on checkbox toggle)**

* Selected: {{ active\_selection\_count }} Creators Selected ── \[Action Button: Bulk Nudge Stage Progress\] | \[Action Link: Clear Current Selection\]

#### **4.2 Tabular Data Grid Column Header Mappings**

* **Column 1:** Creator Identity | **Column 2:** Campaign Framework & Product | **Column 3:** Workflow Milestone Track | **Column 4:** Current Operational Status | **Column 5:** System Warning Clock | **Column 6:** Primary Action Command

#### **4.3 High-Density Row Structural Component Data Matrix**

\====================================================================================================  
\[ ROW ITERATOR CONFIGURATION FOR THE HIGH-DENSITY OPERATIONAL DATA GRID \]  
\====================================================================================================  
• COLUMN 1: INTERACTIVE CREATOR IDENTITY NODE  
            \[Checkbox\] \[Avatar Circle Image Thumbnail\] @{{ creator\_instagram\_handle }}  
            Sub-text Context Metric: Platform: Instagram Connected Core

• COLUMN 2: STRATEGIC BRIEF ASSIGNMENT TARGETS  
            Text Field Line 1: Brief: {{ brief\_internal\_title }}  
            Sub-text Field Line 2: Product Allocation: {{ logistics\_sku\_product\_name }}

• COLUMN 3: SYNCHRONIZED WORKFLOW MILESTONE STEP ARRAY  
            ┌── DESKTOP STEP-INDICATOR VIEW:  
            │   \[ Neg. \] ──► \[ Sec. \] ──► \[ Ship. \] ──► \[ Rev. \] ──► \[ Pay. \] ──► \[ Feed. \]  
            │   (Visual Styling States: Completed \= Solid Green | Active \= Pulsing Blue | Future \= Grey)  
            │  
            └── MOBILE COLLAPSED LAYOUT RATIO INDICATOR:  
                \[Icon: ProgressPie\] Progress Track: Stage {{ active\_stage\_index }} / 6

• COLUMN 4: CURRENT OPERATIONAL STATUS DEFINITION TAGS  
            ├── IF Milestone \== STAGE\_1\_NEGOTIATION:  
            │   ├── IF State \== BRAND\_COUNTER:    \[Status Pill (Amber)\]: Negotiation: Counter Proposed  
            │   ├── IF State \== CREATOR\_COUNTER:  \[Status Pill (Blue)\]:  Negotiation: Proposal Received  
            │   └── IF State \== FINAL\_OFFER:      \[Status Pill (Red)\]:   Negotiation: Final Offer Locked  
            │  
            ├── IF Milestone \== STAGE\_2\_SECUREMENT:  
            │   ├── IF State \== AWAITING\_FUNDING: \[Status Pill (Amber)\]: Escrow: Funding Required (30%)  
            │   └── IF State \== AWAITING\_SIGN:    \[Status Pill (Blue)\]:  Contract: Signature Pending  
            │  
            ├── IF Milestone \== STAGE\_3\_LOGISTICS:  
            │   ├── IF State \== AWAITING\_SHIP:    \[Status Pill (Grey)\]:  Logistics: Action Required  
            │   ├── IF State \== IN\_TRANSIT:       \[Status Pill (Blue)\]:  Logistics: Item En Route  
            │   └── IF State \== EXCEPTION:        \[Status Pill (Red)\]:   Logistics: Tracking Alert (Strike {{ count }}/2)  
            │  
            ├── IF Milestone \== STAGE\_4\_CONTENT\_REVIEW:  
            │   ├── IF State \== INITIAL\_DRAFT:    \[Status Pill (Blue)\]:  Review: Media Asset Uploaded  
            │   ├── IF State \== REVISION\_ROUND:   \[Status Pill (Amber)\]: Review: Revision Loop (Round {{ count }}/2)  
            │   └── IF State \== REJECTED\_LOCK:    \[Status Pill (Red)\]:   Review: Content Halted (Hard-Stop Lock)  
            │  
            ├── IF Milestone \== STAGE\_5\_PUBLISHING:  
            │   ├── IF State \== AWAITING\_POST:    \[Status Pill (Blue)\]:  Publishing: Awaiting Live Upload  
            │   └── IF State \== COMPLIANCE\_CHECK: \[Status Pill (Amber)\]: Publishing: Link Validation Verification  
            │  
            └── IF Milestone \== STAGE\_6\_FEEDBACK\_SYNC:  
                └── IF State \== PENDING\_RATING:   \[Status Pill (Grey)\]:  Feedback: Complete Awaiting Score

• COLUMN 5: SYSTEM WARNING RISK COUNTDOWN CLOCKS  
            ├── IF State \== STAGE\_4\_CONTENT\_REVIEW AND Status \== INITIAL\_DRAFT:  
            │   \[Alert Label (Crimson Text)\]: ⚠️ Auto-approves in {{ hours\_remaining }}h (Rule BR-01)  
            │  
            ├── IF Status \== OVERDUE\_MILESTONE:  
            │   \[Alert Label (Red Text)\]: 🚨 Milestone Overdue: Delayed by {{ days\_delayed }}d  
            │  
            └── DEFAULT / ON TRACK STATE:  
                \[Alert Label (Muted Grey Text)\]: On Track (Milestone Deadline: {{ date }})

• COLUMN 6: DYNAMIC SINGLE-ACTION OPERATIONS INTERFACE BUTTONS  
            ├── IF Milestone \== STAGE\_1\_NEGOTIATION AND State \== CREATOR\_COUNTER:  
            │   \`\[Button (Solid Green Fill)\]: Review Proposal\` \-\> Launches Action Side Drawer  
            │  
            ├── IF Milestone \== STAGE\_2\_SECUREMENT AND State \== AWAITING\_FUNDING:  
            │   \`\[Button (Solid Green Fill)\]: Fund Escrow Allocation\`  
            │  
            ├── IF Milestone \== STAGE\_2\_SECUREMENT AND State \== AWAITING\_SIGN:  
            │   \`\[Button (Outline Style)\]: View & Sign Contract\`  
            │  
            ├── IF Milestone \== STAGE\_3\_LOGISTICS AND State \== AWAITING\_SHIP:  
            │   \`\[Button (Solid Green Fill)\]: Add Tracking Number\`  
            │  
            ├── IF Milestone \== STAGE\_4\_CONTENT\_REVIEW AND State \== INITIAL\_DRAFT:  
            │   \`\[Button (Solid Green Fill)\]: Review Uploaded Content\`  
            │  
            ├── IF Milestone \== STAGE\_5\_PUBLISHING AND State \== COMPLIANCE\_CHECK:  
            │   \`\[Button (Solid Green Fill)\]: Authorize Milestone Release\` \-\> Funds 70% Balance  
            │  
            ├── IF Milestone \== STAGE\_6\_FEEDBACK\_SYNC:  
            │   \`\[Button (Outline Style)\]: Log Partnership Rating\`  
            │  
            └── DEFAULT STATE (Awaiting action from creator side):  
                \`\[Button (Ghost Style, Blue Text)\]: \[Icon: Send\] Send Progress Nudge\`  
\====================================================================================================

### **5.0 INTERACTION OVERLAYS & SYSTEM MESSAGE TRIGGERS**

#### **5.1 Context-Aware "Nudge Creator" Confirmation Modal**

* **Modal Overlay Framing Title:** Send Milestone Progress Nudge?  
* **Dynamic Warning Context Description:** You are sending a context-aware reminder notification to {{ selected\_count }} selected creator(s).  
* **Automated Logic Highlight:** \> *Our automated messaging engine detects each creator's active milestone status and structures the notification text accordingly (e.g., prompting a Stage 2 creator for an missing signature, or a Stage 4 creator for an upcoming draft submission).*  
* **Primary Trigger Buttons Suite:**  
  * \[Button (Solid Green Fill)\]: Dispatch Reminders  
  * \[Button (Ghost Style)\]: Cancel

#### **5.2 Real-time System Toast Communications (Action Acknowledgements)**

* **Tracking Input Confirmation:** “📦 Logistics profile synchronized: Tracking metadata appended for @{{ handle }}. Milestone state moved to Shipping.”  
* **Asset Approval Notification:** “🎉 Asset approval confirmed successfully. 72-hour auto-clock terminated. Collaboration framework advanced to Stage 5 Publishing for @{{ handle }}.”  
* **Escrow Distribution Notification:** “💸 Escrow payout authorized. Milestone balance funding (70% Allocation) has been initialized for @{{ handle }}.”  
* **Bulk Nudge Operational Response:** “⚡ Progress alerts successfully sent. Dynamic reminder notifications logged for {{ count }} active creators.”

# REPORTING

### **0.0 UI ARCHITECTURAL MOUNTING & WORKSPACE INSTRUCTIONS**

* **Workspace Engine Binding:** The Reporting Tab is the fourth functional sub-view that mounts dynamically inside the central content frame (Dynamic Canvas) of the pre-existing **Campaign Workspace Shell**.  
* **Layout Isolation Rule:** Universal parent layout frame elements remain completely fixed and locked outside this module's rendering pipeline. This includes the left-aligned **Universal Sidebar (Desktop: Dark-themed, 80px width)** and the top-aligned **Universal Header**. No breadcrumbs, title parameters, or contextual statuses may leak into or distort these primary parent frames.  
* **State Preservation Constraint:** Switching tabs or applying filters must maintain all fetched analytics, chart states, and date configurations within memory to guarantee zero layout recalculation delays.  
* **Mobile Viewport Optimization Core Directive ($\\le 768\\text{px}$):** To prevent visual crowding on small screens, the interface automatically enforces layout collapsing rules:  
  1. The High-Level ROI Strip condenses into a horizontally scrollable single-row summary card matrix with swipe navigation.  
  2. Multi-column data charts stack vertically, and complex data visuals collapse into summary toggle cards.  
  3. The Export Actions dropdown condenses into a single floating action trigger or a secondary header option.

### **1.0 FUNCTIONAL & JOURNEY DIAGNOSTICS**

An analysis of the reporting guidelines shows opportunities to improve tracking clarity, handle cache constraints safely, and make performance insights more actionable for brand managers:

#### **A. Campaign Objective Tracking Realignment**

* **The Vulnerability:** The platform specifies that it validates success against the campaign's primary objective (Awareness, Traffic, or Conversions). However, the high-level ROI strip is completely static, always displaying standard parameters like Impressions, CPM, CPE, and EMV. For conversions-driven or traffic-optimized campaigns, this layout misses the core goals.  
* **The Optimization:** Make the **High-Level ROI Summary Strip** context-dependent. The system reads the primary campaign objective from the campaign setup schema and dynamically updates the display cards to match:  
  * *Awareness Focus:* Impressions, Reach, CPM, Earned Media Value (EMV).  
  * *Traffic Focus:* Link Clicks, Unique Click-Through Rate (CTR), Cost Per Click (CPC).  
  * *Conversion Focus:* Conversions, Attributed Sales Value, Conversion Rate, Customer Acquisition Cost (CAC).

#### **B. Cache Refresh Transparency & Rate Limits**

* **The Vulnerability:** Meta and TikTok API structures impose strict data rate limits, creating a 4–6 hour sync delay. Without a clear interface indicator, users may mistake cached metrics for a broken tracking integration.  
* **The Optimization:** Place a persistent **Data Sync Health Indicator** badge directly inside the header interface next to a manual refresh option. This elements displays a timestamped log (e.g., Last updated 3 hours ago) alongside an active sync control to make the background cache rule transparent.

#### **C. Isolating Premium Authenticated Metrics (OAuth vs. Scraped)**

* **The Vulnerability:** Because creators on this platform attach their profiles via OAuth, the system gains access to premium internal data points (such as Saves, Shares, and Story Link Sticker Clicks) that cannot be pulled from public profiles. Blending these with basic public metrics hides the accuracy advantages of the platform.  
* **The Optimization:** Add a distinct **AI Verified Source Badge** \[Icon: ShieldCheck\] next to advanced metric dimensions. This visually confirms to brand managers that private reach metrics are securely validated via official Meta API tokens.

#### **D. Content Gallery Performance Exports**

* **The Vulnerability:** The asset gallery ranks content by performance, which is useful for evaluation, but it misses an operational next step. Brand managers frequently need to download top-performing assets or hand them off to media buyers for paid amplification campaigns (such as Meta Whitelisting or TikTok Spark Ads).  
* **The Optimization:** Add direct, row-level **Asset Action Utilities** (\[Download Asset\], \[Copy Ad Authorization Code\]) to the visual grid blocks to make the performance gallery fully actionable.

## **📊 REPORTING TAB FINAL PRODUCTION UI COPY REGISTRY**

### **2.0 TAB PERSISTENT HEADER & CONTEXT COMPONENT BALANCING**

#### **2.1 Context Identification Track**

* **Drawer Breadcrumb Track:** Campaigns ──► {{ campaign\_name }} ──► Reporting  
* **Tab Headline Text:** Performance Reporting  
* **Sub-headline Description Text:** Analyze real-time return on investment, evaluate live cross-platform API engagement metrics, and isolate top-performing creative assets.

#### **2.2 Data Sync Health Indicator (Header Companion Node)**

* **Status Badge Layout:** \[Icon: CloudSync\] Data Profile: Active API Stream | Last Synchronized: {{ elapsed\_time\_string }} ago  
* **Interactive Control Trigger:** \[Button (Ghost Style)\]: \[Icon: Refresh\] Force Refresh Sync

### **3.0 CAMPAIGN-DRIVEN METRIC DISPLAY PANELS**

The high-level metric bar reads the core settings of the active campaign and dynamically displays one of the three tailored variations below:

#### **3.1 Variation A: Awareness-Driven Campaign Optimization**

* **Card 1 (Total Spend):**  
  * *Label:* Total Campaign Investment  
  * *Primary Value:* {{ campaign\_currency\_symbol }}{{ total\_allocated\_investment\_amount }}  
  * *Sub-text Context:* Payout Fees \+ Product Sourcing Expenses  
* **Card 2 (Total Impressions Volume):**  
  * *Label:* Verified Reach Impressions  
  * *Primary Value:* {{ total\_api\_impressions\_count\_metric }}  
  * *Sub-text Context:* Dynamic Cross-Platform API Reach Volatiles  
* **Card 3 (Cost Per Mille Efficiency Matrix):**  
  * *Label:* Cost Per Thousand (CPM)  
  * *Primary Value:* {{ campaign\_currency\_symbol }}{{ calculated\_cpm\_rate\_value }}  
  * *Sub-text Context:* Investment Efficiency Per 1,000 Views  
* **Card 4 (Earned Media Value Weight):**  
  * *Label:* Estimated Media Value (EMV)  
  * *Primary Value:* {{ campaign\_currency\_symbol }}{{ ai\_calculated\_emv\_dollar\_weight }}  
  * *Sub-text Context:* Comparative Valuation Against Traditional Paid Channels

#### **3.2 Variation B: Traffic-Driven Campaign Optimization**

* **Card 1 (Total Spend):**  
  * *Label:* Total Campaign Investment  
  * *Primary Value:* {{ campaign\_currency\_symbol }}{{ total\_allocated\_investment\_amount }}  
  * *Sub-text Context:* Fees & Sourcing Costs  
* **Card 2 (Link Routing Volumes):**  
  * *Label:* Total Link Clicks  
  * *Primary Value:* {{ total\_tracked\_sticker\_and\_bio\_clicks }}  
  * *Sub-text Context:* API Verified Sticker & Bio Redirect Vectors  
* **Card 3 (Click-Through Rate Analytics):**  
  * *Label:* Unique Click-Through Rate (CTR)  
  * *Primary Value:* {{ calculated\_ctr\_percentage\_rate }}%  
  * *Sub-text Context:* Core Ratio of Impressions to Visits  
* **Card 4 (Cost Per Traffic Click Allocation):**  
  * *Label:* Average Cost Per Click (CPC)  
  * *Primary Value:* {{ campaign\_currency\_symbol }}{{ calculated\_cpc\_efficiency\_rate }}  
  * *Sub-text Context:* Net Campaign Investment Divided by Net Clicks

#### **3.3 Variation C: Conversion-Driven Campaign Optimization**

* **Card 1 (Total Spend):**  
  * *Label:* Total Campaign Investment  
  * *Primary Value:* {{ campaign\_currency\_symbol }}{{ total\_allocated\_investment\_amount }}  
  * *Sub-text Context:* Fees & Sourcing Costs  
* **Card 2 (Attributed Sales Conversion Volume):**  
  * *Label:* Attributed Campaign Revenue  
  * *Primary Value:* {{ campaign\_currency\_symbol }}{{ verified\_pixel\_and\_code\_sales\_revenue }}  
  * *Sub-text Context:* Tracked Promo Code & Pixel Conversion Events  
* **Card 3 (Conversion Rate Analytics):**  
  * *Label:* Average Conversion Rate  
  * *Primary Value:* {{ calculated\_conversion\_pace\_percentage }}%  
  * *Sub-text Context:* Visitor to Purchase Complete Pipeline Ratio  
* **Card 4 (Customer Acquisition Performance Index):**  
  * *Label:* Customer Acquisition Cost (CAC)  
  * *Primary Value:* {{ campaign\_currency\_symbol }}{{ calculated\_cac\_investment\_weight }}  
  * *Sub-text Context:* Net Ad Investment Cost Per Acquired Customer Unit

### **4.0 ADVANCED ANALYTICAL FILTER & EXPORT UTILITIES**

* **Left-Aligned Dimensional Controls:** \[Filter Dropdown Menu\]: All Creative Briefs ▾ \[Filter Dropdown Menu\]: Platform (All Platforms / Instagram Connected / TikTok) ▾ \[Filter Dropdown Menu\]: Date Range Options (Last 30 Days / Complete Campaign Lifecycle / Custom Range Frame) ▾  
* **Right-Aligned Export Processing Hub:**  
  * \[Button (Outline Style)\]: \[Icon: PictureAsPdf\] Export Executive Performance Summary (PDF)  
  * \[Button (Solid Green Fill)\]: \[Icon: TableChart\] Export Performance Schema Logs (Google Sheets ↗)

### **5.0 THE VISUAL INSIGHTS FEED (DATA VISUALIZATION CANVAS)**

#### **5.1 Interactive Time-Series Evaluation Module**

* **Section Header Headline:** Engagement Dynamics Over Time  
* **Interactive Tooltip Data Label Pattern (Hover Tracking Interface):** Date Frame Focus: {{ points\_axis\_date }} | Platform Volume Metrics: Likes: {{ count }} • Comments: {{ count }} • Saves: {{ count }}  
* **Chart Component Visual Legend Elements:** \[Indicator Color Block 1\]: Engagement Velocity Line | \[Indicator Color Block 2\]: Audience Reach Volume Bar

#### **5.2 Performance Leaderboard Analytics Container**

* **Section Header Headline:** Partnership Efficiency Leaderboard  
* **Sub-headline Context Rule:** Evaluates and ranks active partnerships based on calculated return on investment score metrics.  
* **Table Column Formatting Headers:** Creator Context | Assigned Fee | Total Delivered Impressions | Calculated CPE Rate | Algorithmic Performance Index

\====================================================================================================  
\[ LEADERBOARD ROW INSTANTIATOR INTERFACE ENGINE \]  
\====================================================================================================  
• TRACKING ROW MODEL MATCH:  
  Rank \#{{ table\_row\_position\_index }} | \[Avatar Icon\] @{{ creator\_instagram\_handle }}  
  ├── Assigned Fee Field:       {{ currency\_symbol }}{{ payout\_amount\_fixed }}  
  ├── Impression Returns:       {{ verified\_aggregate\_views\_count }} Views  
  ├── CPE Rate Metrics:         {{ currency\_symbol }}{{ cost\_per\_engagement\_value }} Per Action  
  └── Algorithmic Performance Index Grade:   
      ├── IF Score \>= 85%: \[Performance Badge (Green Fill)\]:  🔥 {{ performance\_index\_score }}% ROI Index  
      ├── IF Score 60-84%: \[Performance Badge (Amber Fill)\]:  ⚡ {{ performance\_index\_score }}% ROI Index  
      └── IF Score \< 60%:  \[Performance Badge (Grey Fill)\]:   ⚠️ {{ performance\_index\_score }}% ROI Index  
\====================================================================================================

#### **5.3 Demographic Demographics & Heatmap Breakdown**

* **Section Header Headline:** Audience Reach Verification Mapping  
* **Demographic Target Accuracy Alert Banner Indicator:** \[Icon: VerifiedUser\] Performance Validation Flag: Live campaign reach limits delivered {{ target\_differential\_percentage }}% more target consumer profiles than initial setup projections.  
* **Heatmap Grid Interface Element Mappings:**  
  * Left Side Component Module: Target Persona Age-Spread Distribution (Bar Data Visual Rows)  
  * Right Side Component Module: Global Geographic Density Heatmap Configuration (World Density Matrix)

### **6.0 DYNAMIC VISUAL ARCHETYPE PERFORMANCE GALLERY GRID**

* **Section Header Headline:** Asset Performance Creative Gallery  
* **Sub-headline Context Rule:** View and organize approved campaign content assets ranked dynamically by their verified consumer engagement metrics.  
* **Gallery Filtering Matrix Tabs:** \[Tab Focus: High-Density Thumbnail View (All Assets)\] | \[Tab Focus: Performance Ranked Matrix (Top Outliers First)\]

#### **6.1 Interactive Creative Media Grid Blocks Layout Components**

\====================================================================================================  
\[ REUSABLE CREATIVE BLOCK COMPONENT CONTEXT ENTRY \]  
\====================================================================================================  
• INDIVIDUAL MEDIA CARD HOVER CANVAS INTERFACE:  
  \[ 9:16 Video Framework Thumbnail Preview Asset Container \]  
    
  ┌── STATIC OVERLAY CHIPS (Visible across baseline states):  
  │   ├── Top Left Anchor:  \[Platform Pill Badge (Instagram Icon)\] @{{ handle }}  
  │   └── Top Right Anchor: \[ROI Index Weight Indicator\]: {{ engagement\_rate\_percentage }}% ER  
  │  
  └── INTERACTIVE HOVER ACTIONS (Revealed smoothly upon desktop cursor focus states):  
      ├── Visual Helper Indicator: "💡 \[Icon: Mouse\] Hover asset view to play muted preview."  
      ├── Center Workspace Trigger Link: \`\[Icon: ZoomIn\] Expand Deep Vetting Metrics Sheet\`  
      └── Floating Command Action Footer Layer:  
          ├── \`\[Button (Solid Micro Layout)\]: \[Icon: FileDownload\] Save High-Res Source Asset\`  
          └── \`\[Button (Solid Micro Layout)\]: \[Icon: VpnKey\] Copy Spark/Whitelisting Ad Authorization Code\`  
\====================================================================================================

### **7.0 BACKGROUND ASYNC PERFORMANCE TOAST SYSTEMS**

* **PDF Engine Acknowledgement Notification:** “📄 Assembly processing successful: Executive Performance Summary generated. Output package downloading automatically.”  
* **Google Sheets Integration Sync Notification:** “📊 Google Sheets data pipeline initialized. {{ row\_count }} live creator performance logs synced to your target workspace link destination.”  
* **Code Vault Storage Payload Notification:** “📋 Security asset keys matched: Spark Ads Creative Authorization code copied to clipboard for asset reference @{{ handle }}.”

# CREATE CAMPAIGN

**0.0 UI ARCHITECTURAL MOUNTING & STATE INTERACTION RULES**

* **State Overlay Guard:** The Campaign Creation flow is an interactive modal wizard state that mounts dynamically inside the central workspace container of the Campaigns Module.  
* **Trigger Action Binding:** This wizard state is initialized exclusively when an operator triggers a click action on the `[Button (Solid Aurora Green): + Create New Campaign]` element inside the master header.  
* **Shell Preservation Rule:** The `Global Shell - Desktop` and its persistent sidebar navigation metrics remain completely untouched and locked.  
* **Header & State Cleansing:** When this creation state is `active`, the local page header temporarily unmounts the Campaign List tabs and filters, updating the path breadcrumbs to read: `Campaigns ──► Create Campaign ──► Step X`.  
* **Exit Restoration Rule:** Clicking the `[Ghost Button]: Cancel & Exit` in the sticky wizard footer completely destroys the creation wizard state and cleanly restores the default layout state of Tab 1 (Campaign List Grid Matrix)."


### **1.0 FUNCTIONAL & JOURNEY DIAGNOSTICS**

An analysis of the user flow and form schema reveals a few operational blind spots that could lead to user friction or financial miscalculations:

#### **A. Platform-Specific Deliverable Mapping**

* **The Vulnerability:** Step 1 simply asks for "Deliverables" (Photo, Video). This is too ambiguous. A vertical 9:16 TikTok video requires completely different licensing and production effort than a 16:9 YouTube integration.  
* **The Optimization:** Upgrade the "Deliverables" section to a **Platform & Format Matrix**. Require users to select the destination platform (e.g., Instagram, TikTok) *first*, which then populates context-specific formats (e.g., Reel, Post, Story).

#### **B. Total Budget Cap for Negotiable Campaigns**

* **The Vulnerability:** In Step 3, if a brand selects "Negotiable Offer" and inputs a Min/Max fee (e.g., $500 \- $1000) per creator, there is no global budget constraint. If they approve 50 creators at the max fee, they might accidentally overspend.  
* **The Optimization:** Add a **Total Campaign Budget Cap** input field. This gives the backend engine a hard limit, automatically freezing new applicant approvals once the escrow/budget pool is depleted.

#### **C. Frictionless Auto-Save Visibility**

* **The Vulnerability:** Multi-step forms risk data loss if a user accidentally navigates away. The UI mentions a "Last Sync" timestamp, but it needs stronger visual prominence.  
* **The Optimization:** Move the \[DRAFT \- Auto-saved at HH:MM\] indicator into the Universal Header next to the primary action buttons, ensuring users feel confident their inputs are secure before leaving the page.

## **🛠️ CREATE CAMPAIGN FINAL PRODUCTION UI COPY REGISTRY**

### **2.0 STEP 1: STRATEGY (CORE METADATA)**

#### **2.1 Context Header**

* **Headline Text:** Campaign Strategy  
* **Sub-headline Text:** Establish the core metadata, timeline, and primary objectives for your activation.

#### **2.2 Form Input Fields**

* **Text Input:** CAMPAIGN NAME  
  * *Placeholder:* e.g., Summer Launch 2026  
* **Selection Group (Radio):** TIMELINE STRUCTURE  
  * \[Radio\] Fixed Date Range (Exposes Start/End Date Pickers)  
  * \[Radio\] Dynamic Milestone Track (Exposes Days-to-Complete Numeric Input)  
  * \[Radio\] Evergreen Track (No date input required)  
      
* **Dropdown Menu:** CORE OBJECTIVE  
  * *Options:* Brand Awareness, Traffic & Clicks, Sales & Conversions  
* **Multi-Select Matrix:** PLATFORM & FORMAT MATRIX  
  * *Step 1:* Select Platform (Instagram, TikTok, YouTube)  
  * *Step 2:* Select Format (Reel, Story, Static Post, Short)

### **3.0 STEP 2: TARGETING (AUDIENCE & CREATOR FIT)**

#### **3.1 Context Header**

* **Headline Text:** Creator Targeting  
* **Sub-headline Text:** Define the exact persona, audience demographics, and geographic reach you need.

#### **3.2 Form Input Fields**

* **Dropdown Menu:** INDUSTRY VERTICAL  
  * *Placeholder:* Select your brand's core industry...  
* **Multi-Select Tags:** CREATOR ARCHETYPES  
  * *Options:* Aesthetic, Comedy, Tech, Educational, Lifestyle, Fitness, Beauty  
* **Slider Range / Multi-Select:** FOLLOWER TIERS  
  * *Options:* Nano (1k-10k), Micro (10k-50k), Mid-Tier (50k-250k), Macro (250k+)  
* **Demographics Builder:** TARGET AUDIENCE  
  * *Age Range Slider:* Min Age ──► Max Age  
  * *Gender Toggle:* All / Female-Skewing / Male-Skewing  
  * Multi-Input Tags:: Interests  
* **Text Input (Tokenized):** DISQUALIFYING KEYWORDS  
  * *Helper Text:* Enter keywords to explicitly filter out creators. (e.g., 'NSFW', 'Politics', 'Crypto')

### **4.0 STEP 3: COMMERCIALS (BUDGET & PAYOUTS)**

#### **4.1 Context Header**

* **Headline Text:** Commercial Terms  
* **Sub-headline Text:** Set the baseline compensation limits, escrow advances, and payout structures.

#### **4.2 Form Input Fields**

* **Toggle Selection:** COMPENSATION TYPE  
  * \[Toggle\] Fixed Fee / \[Toggle\] Negotiable Offer  
* **Conditional Input (If Fixed Fee):** FLAT RATE PER CREATOR  
  * *Currency Input:* $ \_\_\_\_\_\_  
  * *Helper Text:* Creators will see: "Fixed Fee: $\[Value\]".  
* **Conditional Input (If Negotiable):** NEGOTIATION RANGE  
  * *Min Currency Input:* $ \_\_\_\_\_\_ (Creators see this as "Starting from")  
  * *Max Currency Input:* $ \_\_\_\_\_\_ (Internal budget cap per creator)  
* **Global Field:** TOTAL CAMPAIGN BUDGET POOL (Recommended Addition)  
  * *Currency Input:* $ \_\_\_\_\_\_  
  * *Tooltip:* Maximum total spend authorized for this campaign across all creators.  
* **Numeric Input:** ADVANCE PAYMENT PERCENTAGE  
  * *Input:* \_\_\_ % (Default: 30%)  
  * *Tooltip Warning:* A minimum of 30% advance is required to secure creators in the platform.  
* **Dropdown Menu:** FINAL BALANCE DUE DATE  
  * *Options:* Immediate (Upon Approval), Net 7, Net 15, Net 30  
  * *Helper Alert:* "Net 30 payouts combined with low advances may result in lower applicant conversion rates."

#### **4.3 Global Form Actions (Sticky Footer)**

* \[Ghost Button\]: Cancel & Exit  
* \[Outline Button\]: Back to Previous Step  
* \[Solid Green Button\]: Save & Publish Campaign (Disabled until all Zod validations pass).

### **5.0 THE CONTEXTUAL SIDEBAR DRAWER (PERSISTENT LEDGER)**

* **Status Header:** \[Badge: DRAFT\] | Last auto-saved: {{ timestamp }}  
* **Accordion 1: Strategy**  
  * Name: {{ campaign\_name }}  
  * Timeline: {{ timeline\_type }}  
  * Objective: {{ objective\_id }}  
* **Accordion 2: Targeting**  
  * Vertical: {{ industry\_id }}  
  * Audience: {{ age\_min }}-{{ age\_max }} | {{ gender\_target }}  
  * Geo: {{ locations }}  
* **Accordion 3: Commercials**  
  * Offer Type: {{ compensation\_type }}  
  * Advance: {{ advance\_percentage }}%  
  * Terms: {{ final\_balance\_terms }}

# Tab 15

**MASTER UI COPY SPECIFICATION: CREATE CAMPAIGN ENGINE (V2 INTEGRATED)**  
The structural hierarchy, form field types, validation criteria, and conditional logic patterns from Version 1 have been completely integrated into this definitive Version 2 document.  
All exact formatting rules—including bold labels , italicized system logic notes , hierarchical indentation blocks, code tokens, and color indicators —remain fully preserved.  
STEP 1: CAMPAIGN STRATEGY  
\[FRAMEWORK CONSTRAINT: PERSISTENT SHELL\]

* **Universal Sidebar (Desktop):** Fixed, dark-themed left-aligned container (80px width)  
* **Universal Header:** Fixed top-bar containing Breadcrumb and Progress Indicator. *Breadcrumb:* Campaign \> Create campaign \> Strategy  
* **Dynamic Canvas:** Central white-space container for step-specific cards  
* **Mobile Wrapper:** Fixed Header (Logo/Step) and Primary Action Button in sticky footer

\[Active Card\] Campaign Strategy

* **Progress indicator:** Step 1 of 3  
* **Headline:** Campaign Strategy  
* **Subtitle:** Establish the core metadata, timeline, and primary objective for your campaign

📊 \[Page Sidebar / Context Drawer\]

* **Drawer Global Header:**  
  * *Status Badge:* \[DRAFT\] (Aurora Green Outline) | \[LIVE\] (Solid Green)  
  * *Timestamp:* Created on: Oct 24, 2024  
  * *Last Sync:* *Syncing in real-time...*  
* **Strategy (Step 1\)**  
  * *Status:* Collapsible Accordion | *Default Expanded during Step 1*  
  * Campaign Name: {{ campaign\_name }}  
  * Timeline: {{ deadline\_type }} — {{ fixed\_date / dynamic\_days }}  
  * Core Objective: {{ objective\_id }}  
  * KPI: {{ primary\_kpi }}  
  * Platform Focus: {{ platforms }}  
* **Targeting (Step 2\)**  
  * *Status:* Collapsible Accordion | *Default Collapsed during Step 1*  
  * Vertical: {{ industry\_id }}  
  * Creator Personas: {{ archetype\_ids }}  
  * Follower Tiers: {{ follower\_ranges }}  
  * Target Audience: {{ age\_min }} \- {{ age\_max }} | {{ gender\_target }}  
  * Specific Locations: {{ location\_ids }}  
  * Estimated Impact: {{ reach\_count }} Impressions  
* **Commercials (Step 3\)**  
  * *Status:* Collapsible Accordion | *Default Collapsed during Step 1*  
  * Sample Provided: {{ has\_product ? "Yes" : "No" }}  
  * Logistics: {{ fulfillment\_id }}  
  * Pricing Model: {{ budget\_mode }}  
  * Creator Fee: ${{ base\_fee }}  
  * Payment Terms: Net {{ payout\_period }}  
  * Upfront Advance: {{ advance\_pct }}%  
  * Brand Trust Score: {{ trust\_score }}%

Section 1: Basic Information

* **Form Fields:**  
  * **Text Input:** Campaign Name  
    * *Placeholder:* e.g., Summer Hype 2024  
    * *Helper Text:* Enter a unique name to identify your campaign in the dashboard.  
    * *Character Counter:* 0/100  
    * *Validation:* \* Mandatory field. Min 3 / Max 100 characters.  
    * *Error (Duplicate):* This name is already in use. Please choose a unique name.  
    * *Error (Too Short):* Campaign name must be at least 3 characters.  
  * **Radio Group:** Deadline Type  
    * *Subtitle:* Determine the duration of your campaign.  
    * *Option 1:* Evergreen  
      * *Helper text:* Content posted whenever the creator is ready.  
    * *Option 2:* Fixed Date  
      * *Helper text:* Best for sales, holidays, or launches. \[Select Date\]  
    * *Option 3:* Dynamic  
      * *Helper text:* The clock starts only after the creator receives the product or visits. \[Input Days\]  
    * *Logic:* *Evergreen is selected by default.*  
  * **Date Picker:** Select Date (*Revealed if Fixed Date is selected*)  
    * *Placeholder:* MM/DD/YYYY  
    * *Hover State:* Click to open calendar  
    * *Validation:* \* Error (Out of Range): Campaign must start between 7 days and 3 months from today. Dates prior to {{ Today \+ 7 }} and after {{ Today \+ 90 }} must be disabled (greyed out).  
  * **Date Range / Input Box:** Dynamic Days (*Revealed if Dynamic is selected*)  
    * *Placeholder:* Select a date range  
    * *Helper Text:* Note: Maximum limit is 90 days. Countdown begins only after product delivery.  
    * *Validation:* \* Error (Invalid Range): Maximum duration is 90 days post-delivery.

Section 2: Strategy & Objectives

* **2x2 Selectable Grid:** Primary Objective  
  * *Card 1:* Pulse: Awareness & Reach  
    * *Hover/Tooltip:* Best for new product launches or building "cool factor." Focuses on high-volume views and stopping the scroll.  
  * *Card 2:* Proof: Trust & Validation  
    * *Hover/Tooltip:* Best for technical products or high-consideration purchases. Focuses on tutorials, deep-dives, and "how-it-works" content.  
  * *Card 3:* Production: High-Quality Assets  
    * *Hover/Tooltip:* Best if you need professional-grade content for your own paid ads or website.  
  * *Card 4:* Push: Direct Action  
    * *Hover/Tooltip:* Best for driving immediate ROI. Focuses on sales, app installs, or lead generation.  
* **Validation Logic:**  
  * *Active Card:* 2px Aurora Green border and 2% opacity green fill.  
  * *Error (No Selection):* Card borders Glow Red.  
  * *Error Text:* Please select a primary objective to continue.  
* **Filled Box Output:** North Star KPI  
  * *Behavior:* Empty until Objective is selected.  
  * *Auto-filled Text:* {{ Auto\_Mapped\_KPI }} *(e.g., Conversion Rate if D2C X Push is selected)*.  
* **Filled Box Output:** Secondary Metrics  
  * *Behavior:* Empty until Objective is selected.  
  * *Auto-filled Text:* {{ Auto\_Mapped\_KPI }} *(e.g., Impressions Rate if D2C X Pulse is selected)*.

Section 3: Reach & Distribution

* **Multi-select Pills:** Target Platforms  
  * *Options:* Instagram, TikTok, YouTube *(rendered alongside native platform brand logos)*  
  * *Validation:* Must select at least one platform.  
* **Radio Group:** Campaign Visibility  
  * *Subtitle:* Control who can discover and apply for your campaign.  
  * *Option 1:* Public  
    * *Headline:* Public  
    * *Precision Tip:* Best for brand awareness and discovering new talent pools.  
  * *Option 2:* Eligible Creators Only  
    * *Headline:* Eligible Creators Only  
    * *Precision Tip:* Minimizes noise and ensures you only receive high-quality, relevant applications.  
  * *Option 3:* Invite Only  
    * *Headline:* Invite Only  
    * *Precision Tip:* Recommended for VIP activations or working with a pre-selected roster.  
  * *Logic:*  
    * *Default State:* "Public" is selected by default.  
    * *Selection Type:* Single Choice (Radio Card layout).

Global Bottom Elements (Persistent across all cards)

* **Actions:**  
  * *Secondary Link:* Cancel  
  * *Primary Button (Pill):* Continue to Targeting  
  * *Hover State:* Validate form and proceed to targeting selection  
  * *Disabled State:* Button remains inactive until all runtime schema validations (Name, Objective, Platform, and Date Range) resolve successfully.

STEP 2: AUDIENCE & TARGETING  
\[FRAMEWORK CONSTRAINT: PERSISTENT SHELL\]

* **Universal Sidebar (Desktop):** Fixed, dark-themed left-aligned container (80px width)  
* **Universal Header:** Fixed top-bar containing Breadcrumb and Progress Indicator. *Breadcrumb:* Campaign \> Create campaign \> Targeting  
* **Dynamic Canvas:** Central white-space container for step-specific cards  
* **Mobile Wrapper:** Fixed Header (Logo/Step) and Primary Action Button in sticky footer

\[Active Card\] Audience & Targeting

* **Progress indicator:** Step 2 of 3  
* **Headline:** Targeting Strategy  
* **Subtitle:** Define your ideal audience reach and select the creator archetypes that best fit your campaign objective.

Section 1: Archetype

* **Label:** CREATOR ARCHETYPES  
* \**Helper Text:* Select a Creator persona tailored to your \[Industry\] and \[Objective\] goals.  
* **Field Type:** Combobox / Searchable Dropdown with Custom Tag Entry.  
* **Input Behavior:** Functions as an unconstrained free-text entry field. The 16 standardized system archetypes act purely as *suggestions*, not as a strict validation block. Creators or brands can type and submit any custom text string they want.  
* **Dropdown Behavior:**  
  * *On Click/Focus:* Expands inline to display the fixed list of 16 standardized archetypes.  
  * *On Type (Filtering):* The list dynamically filters and shrinks against the text string matching pattern.  
  * *Custom Fallback:* If the custom input doesn't match any system archetype, the dropdown menu completely unmounts from view layer, allowing the user to seamlessly finish typing their custom entry.  
* **Data Integrity Node:** Custom user inputs are accepted for the local campaign submission workflow but *do not* get permanently written or appended to the master list of 16 standardized platform archetypes.  
* **Placeholder Text:** Select an archetype or type your own...  
* *Master Archetype Suggestion List:* Trendsetter, Entertainer, Storyteller, Relatable Peer, Educator, Industry Expert, Deep-Diver, Aesthetic Minimalist, Visual Artist, Problem-Solver, Deal-Hunter, Local Guide, Community Builder, Curated Collector, Challenger, Lifestyle Integrationist

Section 2: Following Range

* **Grid Select:** Following Range  
* **Label:** FOLLOWING RANGE  
* **Options Array:**  
  * NANO: 1k \- 10k  
  * MICRO: 10k \- 50k  
  * MID-TIER: 50k \- 500k  
  * MACRO: 500k+  
* **Validation Parameters:**  
  * Multi-select matrix selection allowed.  
  * Active chosen option elements assume a solid 2px Aurora Green border shell.

Section 3: Audience Demographics

* **Form Fields:**  
  * **Radio Pill Group:** Gender  
    * *Options:* Male, Female, All  
    * *Default:* All  
  * **Range Slider:** Age Range  
    * *UI Logic:* Features two interactive drag handles allowing operators to define both a minimum ($X$) and maximum ($Y$) age boundary parameter simultaneously.  
    * *Range Bounds:* 18 – 65+  
    * *Validation:* $Min \\le Max$. If handles collide during interaction, they push or lock based on design system tolerance parameters *(enforcing a minimum 8-year clearance gap)*.  
  * **Label:** AGE RANGE  
  * **Default:** All (18-65+)  
  * **Tokenizer (Multi-Input Panel):** Interests  
    * *Placeholder:* e.g., Skincare, Fitness, Tech  
    * *Helper Text:* Add key descriptive tokens to help our matching engine index the correct creator niche.

Section 4: Audience Geography

* **Label:** TARGET LOCATIONS  
* **UI Input Element:** Multi-select Search field with native Location API autocomplete integration.  
* **Placeholder:** Search for countries, states, or cities...  
* **Behavior Framework:**  
  * Successfully pinned operational locations appear instantly below the search container as responsive chips with an 'X' close handle to trigger deletion.  
  * The integration maps and records the unique place\_id token for strict backend resolution accuracy.  
  * *Validation:* \* Mandatory field. If no localized targets are specified, the database interprets the scope under a fallback Global configuration state.

Global Bottom Elements (Persistent across all cards)

* **Actions:**  
  * *Secondary Link:* Back to Strategy  
  * *Primary Button (Pill):* Continue to Commercials  
  * *Hover State:* Proceed to finalize operational budget metrics and creator deliverables  
  * *Disabled State:* Inactive until the master archetype selection fields are cleared by validation passes.

STEP 3: COMMERCIALS  
\[FRAMEWORK CONSTRAINT: PERSISTENT SHELL\]

* **Universal Sidebar (Desktop):** Fixed, dark-themed left-aligned container (80px width)  
* **Universal Header:** Fixed top-bar containing Breadcrumb and Progress Indicator. *Breadcrumb:* Campaign \> Create campaign \> Commercials  
* **Dynamic Canvas:** Central white-space container for step-specific cards  
* **Mobile Wrapper:** Fixed Header (Logo/Step) and Primary Action Button in sticky footer

\[Active Card\] Commercials Allocation

* **Progress indicator:** Step 3 of 3  
* **Headline:** Commercials  
* **Subtitle:** Define the financial relationship, payout windows, and "Trust Score" incentivization parameters for your campaign.

Section 1: Incentives & Offerings

* **Toggle Selector:** Will the creator receive a product/discount?  
* **Dropdown Box:** (*Conditional state: rendered only if product toggle state parameters resolve to Yes*)  
  * *Placeholder:* Select as applicable  
  * *Logic: Select options filter dynamically at runtime based on the onboarding Brand Profile's corporate* Industry *parameter (Default fallback: D2C E-commerce).*  
    * *E-commerce Profile Items:* Complimentary Product, Return after shoot  
    * *Healthcare Profile Items:* Discount on treatment, Free treatment, Free consultation  
    * *SaaS Profile Items:* Extended Trial, Full Pro/Paid Plan Access, Platform Credits, Team Seat License  
    * *Offline Experience Profile Items:* Event Ticket/Pass, Experience Voucher, VIP Guestlist, Full Bundled Package (Travel \+ Stay \+ Ticket)  
* **Amount Field / Currency Input:** Value of the free product/service  
  * *Validation:* \* Mandatory input field if Product Toggle parameter resolves to Yes.

Section 2: Budget Strategy

* **Label:** BUDGET STRATEGY  
* **Toggle Group:** BUDGETING MODEL  
  * *Options:* Fixed Rate, Negotiable Offer  
  * *Default State:* Fixed Rate  
* *\[IF FIXED RATE SELECTED\]*  
  * **Currency Input Container:** CREATOR FEE  
  * **Label:** Creator Fee  
  * *Placeholder:* e.g., $500  
  * *Helper Text:* Creators will see: "Fixed Fee: $\[Value\]"  
  * *Hover State:* Enter the baseline static fee distributed per individual creator node.  
  * *Validation Validation:* \* Error (Empty/0): Please enter a valid non-zero creator fee token to proceed.  
* *\[IF NEGOTIABLE OFFER SELECTED\]*  
  * **Currency Input Box (Left):** MINIMUM FEE  
    * *Placeholder:* Min $  
  * **Currency Input Box (Right):** MAXIMUM FEE  
    * *Placeholder:* Max $  
  * *Helper Text:* Creator will see "starting from" base metrics only. Creators must submit a custom quote proposal loop to apply for the pool.  
  * *Logic Loop:* *Value entered inside Min must remain explicitly strictly less than the Max threshold value.*  
  * *Validation Validation:* \* Error (Invalid Range): Minimum floor fee parameters must sit lower than the designated maximum budget allocation.  
* **Numeric Input Field:** ADVANCE PAYMENT %  
  * *Placeholder:* e.g., 30%  
  * *Helper Text:* Final tier fee structures depend dynamically on creator niche indexing and historical engagement metrics.  
  * *Tooltip Box:* Minimum baseline escrow advance allocation of 30% is strictly mandatory.  
  * *Validation Boundaries:* *Advance payment percentage must execute explicitly within the bounds of 30% and 100%.*  
  * *Validation Validation:* \* Error (\>100): Upfront advance payment allocations cannot exceed 100% capacity parameters.

Section 3: Trust & Payout Logic

* **Form Fields:**  
  * **Dropdown Selection Box:** FINAL BALANCE DUE DATE  
  * **Label:** Final Balance Due Date  
  * *Options Array:* Immediate, Net 7, Net 15, Net 30  
  * *Default State Selection:* Net 30  
  * *Tooltip Box:* Faster institutional settlement payouts generally map directly to increased application conversions and better creator relationships.  
  * *Critical System Warning Check (Net 30 \+ 0% Advance scenario):* Warning: This distribution combination may result in 50% fewer application submissions across high-tier networks.

Global Bottom Elements (Persistent across all cards)

* **Actions:**  
  * *Secondary Link:* Back to targeting  
  * *Primary Button (Pill Layout):* Publish campaign  
  * *Disabled State Check:* Button control structures remain completely inactive until the primary Creator Fee parameters, Advance %, and Payout maturity terms resolve structural Zod schema validation passes.  
  * *Validation Error (On Click While Disabled state):* Please correct the operational financial validation errors highlighted in red flags across the active workspace above.

# Tab 16

Section 3: Reach & Distribution & Access Controls  
Multi-select Pills: Target Platforms  
Options: Instagram, TikTok, YouTube (rendered alongside native platform brand logos)  
Validation: \* Mandatory field. Must select at least one platform.

Smart Checkbox Group: Campaign Discovery Visibility (Question 1\)  
Subtitle: Who should be able to discover or view this campaign?  
Helper Text: Controls campaign placement across the marketplace discovery feed and direct access routes.  
Option 1: \[ \] Open Public Marketplace (Everyone)  
    Headline: Open Public Marketplace  
    Precision Tip: Best for maximum brand awareness and organic talent acquisition.   
Option 2: \[ \] Target Match Discovery (Eligible Creators Only)  
    Headline: Target Match Discovery  
    Precision Tip: Automatically displays this campaign only to creators who clear your target metric filters.  
Option 3: \[ \] Direct Link & API Outbound (Invited Creators Only)  
    Headline: Direct Link & API Outbound  
    Precision Tip: Allows secure access via private deep-links, hand-picked invitations, or automated Meta Marketplace DMs.  
Logic:   
    \* "Open Public Marketplace" is checked by default.  
    \* If "Open Public Marketplace" is checked, Option 2 and Option 3 are instantly disabled, unchecked, and greyed out.  
    \* Users can select \*both\* Option 2 (Eligible) and Option 3 (Invited) simultaneously to run a blended inbound/outbound funnel.  
Validation: \* Mandatory field. Must check at least one visibility profile.  
Error (No Selection): Checkbox container borders Glow Red.  
Error Text: Please select at least one visibility access scope to continue.

Dynamic Radio Card Group: Application Submission Scope (Question 2\)  
Subtitle: Out of the creators who can view this campaign, who is allowed to apply?  
Helper Text: Configures the active state and permission rules of your primary application action button.

\[CONTEXT STATE A: Rendered if "Open Public Marketplace" is selected in Q1\]  
Option A.1: ( ) Open Application Flow  
    Headline: Open Application Flow  
    Precision Tip: Any authenticated creator who views this campaign can apply immediately. Best for high-volume barter campaigns.  
Option A.2: ( ) Smart Eligibility Filter  
    Headline: Smart Eligibility Filter  
    Precision Tip: Creators can view the campaign, but the application button locks unless their verified Instagram Graph API metrics clear your targeting filters.  
Option A.3: ( ) Exclusive Roster Handshake  
    Headline: Exclusive Roster Handshake  
    Precision Tip: The campaign remains visible to build marketplace interest, but only creators manually whitelisted by your team can hit apply.

\[CONTEXT STATE B: Rendered if ONLY "Target Match Discovery" is selected in Q1\]  
Option B.1: ( ) All Eligible Discovery Profiles  
    Headline: All Eligible Discovery Profiles  
    Precision Tip: Any verified creator who organically clears your target metrics can apply immediately.  
Option B.2: ( ) Double-Gated Invite Only  
    Headline: Double-Gated Invite Only  
    Precision Tip: Visible only to eligible creators, but application permissions are restricted to a hand-picked whitelist.

\[CONTEXT STATE C: Rendered if ONLY "Direct Link & API Outbound" is selected in Q1\]  
Option C.1: ( ) Direct Bypass (VIP / Friends Override)  
    Headline: Direct Bypass  
    Precision Tip: Bypasses all metric algorithms. Anyone holding this private token link can apply immediately without demographic or follower checks.  
Option C.2: ( ) Vetted Stealth Execution  
    Headline: Vetted Stealth Execution  
    Precision Tip: Creators must possess a valid invitation link AND clear your automated metric filters during handshake to unlock the apply button.

\[CONTEXT STATE D: Rendered if BOTH "Target Match Discovery" AND "Direct Link & API Outbound" are selected in Q1\]  
Option D.1: ( ) Blended Smart Funnel  
    Headline: Blended Smart Funnel  
    Precision Tip: Organically matched eligible creators can apply instantly; invited creators can view the brief but must pass metric checks to apply unless explicitly marked as a VIP exception.

Logic:  
    \* The Radio Group selections rewrite dynamically based on the active state of the Checkbox selections in Question 1\.  
    \* The first option within the rendered context state is selected by default.  
Validation: \* Mandatory field.

# (stitch prompts)

Excellent. Now that we have absolute alignment on the 7-Phase Master Roadmap, corrected the Section 3 scoping, and designated the Global Shell \- Desktop as completely untouchable, we have an ironclad blueprint to build this out perfectly without regressions.  
Let's begin. Here is your precise, production-grade prompt for **Phase 1: Contextual Navigation Shell, Dynamic Header & Filter Strip** to execute in your new Stitch file.

### **Phase 1 Prompt: Contextual Shell Routing, Segmented Tabs & Master Header Triggers**

**Copy and paste this target layout prompt into Stitch:**  
"Execute the complete layout build for **'Phase 1: Contextual Navigation Shell, Dynamic Header & Filter Strip'** within the new Campaign List workspace file. Strictly follow the **Aurora Design System v4.1** styling rules. Do not invent unauthorized elements, placeholder cards, or layout configurations.

### **1\. PERSISTENT SHELL INTEGRATION & SIDEBAR OVERLAY RULES**

* **Untouchable Core Shell:** Map the active layout canvas directly inside the pre-existing Global Shell \- Desktop layout framework. Do not alter, duplicate, or overwrite its structural code. Ensure the Campaigns menu item is set to its highlighted active state.  
* **Sidebar Expansion Architecture:** Configure the sidebar drawer layout engine so that when a user toggles it to its **Expanded State**, it animates and renders **directly over the top of the header region** via an explicit layout stacking index (z-index: 50), rather than physically pushing or squishing the main grid viewport content.  
* **Logo Swapping Assets:** Anchor the official brand identity logo vector containers inside the sidebar:  
  * Render the **wide logo mark asset** exclusively when the sidebar is in its *Expanded State*.  
  * Swap smoothly to the **compact icon logo mark asset** when the sidebar is in its *Collapsed State*.

### **2\. FINE-TUNED RE-ALIGNED PAGE HEADER & BREADCRUMBS**

* **Header Structural Alignment:** Construct the top page header track to match the exact spacing, padding margins, and proportions of layout reference.png.  
* **Breadcrumbs Integration:** Place the structural navigation breadcrumb text string Campaigns explicitly within the global platform shell header line.  
* **Active Canvas Header:** The local canvas page view must lead off cleanly with the H1 headline Your Campaigns. Directly below it, insert the exact muted description string: *'Track, manage, and optimize your creator activations from a single view.'*  
* **Header Action Buttons (Right-Aligned):** Group these two primary actions along the far right margin in a horizontal row:  
  1. \+ Create New Campaign styled as a high-visibility button in **Solid Aurora Green**.  
  2. ✨ Create using AI styled as a secondary **Outline/Secondary** button.

### **3\. STRATEGIC SUB-NAVIGATION SWITCHER TABS**

Below the master header row, implement the horizontal segmented tab navigation line exactly as specified in the UI copy:

* **Tab Option 1 (Active Status):** Label exactly as Tab 1: Campaigns (Operations & Status). Apply prominent bold styling and a bottom accent bar to establish this as the active layout panel on load.  
* **Tab Option 2 (Inactive Status):** Label exactly as Tab 2: Spend Report (Financial Performance). Configure its default state as an unselected, inactive pointer link that transitions cleanly on mouse-hover.

### **4\. GLOBAL FILTERS STRIP & INLINE ARCHIVE MICRO-BUTTON**

Underneath the switcher tabs, build **'Section A: Global Filters & Bulk Action Bar'** as a horizontal, full-width flex row layout:

* **Search Input:** Render a text search container utilizing the exact placeholder string: Search by campaign, product name, or macro objective...  
* **Filter Dropdown 1:** Append a select menu with the prefix Objective: containing: All Objectives, Awareness & Reach, Traffic & Clicks, Conversions & Sales, and Production.  
* **Filter Dropdown 2:** Append a select menu with the prefix Timeline Rules: containing: All Types, Fixed Date, Dynamic Execution, and Evergreen Baseline.  
* **Inline Archived Toggle Realignment:** Position the archive toggle **perfectly inline as the final trailing element on this filter row**. Scale it down to a compact, low-profile micro-button component styled with a clean **Grey Outline**, displaying exactly: \[Icon: Archive\] Archived ({{count}}). Attach a hover tooltip reading: *'Switch workspace context to historical or completed campaign records.'*

Run a clean compile pass over this Phase 1 structure. Ensure no components leak or cause page overflow."  
Once Stitch renders this pristine header, sidebar overlay, and filter block (with the compact Archived button perfectly inline), let me know and we will advance straight to **Phase 2: High-Density Campaign Matrix Engine (Tab 1 View)** to build the table grid\!  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Here is your production-ready, highly precise prompt for **Phase 2: High-Density Campaign Matrix Engine (Tab 1 View)** to paste directly into Stitch.  
This prompt explicitly enforces your optimized 3-row cell stacking logic, locks the selection column footprint to clear out horizontal crowding, anchors the hyperlinked connection to Module 2, and secures the "closed-by-default" interaction rules for the expandable intelligence panel.

### **Phase 2 Prompt: Campaign List Matrix Engine & Expanded State Logic**

**Copy and paste this target layout and behavior prompt into Stitch:**  
"Inside the container for **'Tab 1: Campaigns (Operations & Status)'**, construct **'Section B: Campaign List'** using a high-density, cell-stacked tabular matrix engine. Strictly adhere to the **Aurora Design System v4.1** spacing, layout guidelines, and constraints without inventing unrequested components.

### **1\. STRUCTURAL COLUMN TRACK WIDTH ALLOCATION**

Formulate an operational 6-column transaction table layout. To eliminate text crowding and correct horizontal scaling math, enforce these exact structural column width constraints:

1. **Selection Column:** Locked to a strict utility footprint (width: 48px or flex: 0 0 48px). Hosts a master row selection \[Checkbox\].  
2. **Campaign Context Column:** Allocated the dominant layout share (flex: 1\) to maximize horizontal viewing area.  
3. **Status Column:** Utility sizing for status triggers and badges.  
4. **Influencer Pipeline Column:** Standard layout width allocation tracking creator progress distributions.  
5. **Budget Consumption Column:** Allocation width accommodating monospaced data typography and linear progress bars.  
6. **Quick Actions Column:** Tailored width for side-by-side icon trigger elements.

### **2\. THE THREE-ROW CELL STACKING ENGINE (CAMPAIGN CONTEXT COLUMN)**

Within the expanded Campaign Context column, nest a strict 3-row vertical data stack frame to display information cleanly without wrapping or clipping boundaries:

* **Row 1 (Primary Deep-Link):** Render the dynamic string text {{Campaign Name}} (Fallback text: *'Summer Splash Core'*). Wrap this title asset in an active hyperlink anchor style using the design system's interactive brand blue typography color scheme. Map this path routing anchor as a stateful pointer to **'Module 2: Campaign Page'**.  
* **Row 2 (Objective Tag):** Directly underneath the link, place an aurora-green background badge displaying the objective parameter verbatim: \[Pill Badge: {{Assigned Macro Objective}}\] (Fallback text: *'Conversions & Sales'*).  
* **Row 3 (Connected Products Meta):** Directly below the badge, render the muted description string text exactly as: {{count}} Active Products Connected (Fallback text: *'3 Active Products Connected'*). Attach a lightweight borderless hover tooltip to this subtext that displays a stacked plain text listing of sample product SKU names.

### **3\. REMAINING DATA COLUMN PARAMETER STACKS**

For every campaign row instantiated, populate columns 3, 4, 5, and 6 exactly as follows:

* **Status Cell:** Row 1 maps an interactive \[Toggle Switch\]. Row 2 displays a color-coded indicator reading exactly \[Green Dot\] Live (Active states) or an amber alert reading \[Amber Alert\] Paused \- Escrow Locked (Paused states).  
* **Influencer Pipeline Cell:** Row 1 displays bold bolded summary text: {{Total Creator Count}} Creators Onboarded. Row 2 outputs the progress distribution string verbatim: {{n}} Act (Production) | {{n}} Rev (In Review) | {{n}} Pay (Payout Pending).  
* **Budget Consumption Cell:** Row 1 displays bold monospaced text: {{Spent Amount}} / {{Allocated Limit}}. Row 2 renders a full-width tracking progress bar using the pacing velocity color palette (Solid green for standard velocity; Amber yellow for pacing warning thresholds).  
* **Quick Actions Cell:** Horizontally align two micro-interaction blocks: \[Icon: Eye\] View Insights and \[Icon: Pencil\] Edit Scope.

### **4\. EXPANDED CAMPAIGN INTELLIGENCE PANEL (CLOSED-BY-DEFAULT CONTROL)**

* **Mount State Rule:** The deep 2\. Expanded State (Campaign Intelligence Panel) container layout block must be initialized in a **hidden state by default (**display: none;**)** when the workspace loads.  
* **Trigger Binding (PIC-01 Compliance):** Configure the visibility rules so that this panel expands and smoothly slides down into view **ONLY when an operator clicks the** \[Icon: Eye\] View Insights **trigger element** in that individual row. Tapping this quick action must never trigger a standard window page redirect.  
* **Expanded View Sections:** When opened, the container must cleanly map:  
  * *Panel Section 1 (Targeting Snapshot):* Displays Target Archetypes, Audience Reach Footprint Floor, and Geographic/Niche parameters verbatim.  
  * *Panel Section 2 (Products & Briefs Matrix):* Maps connected elements in a structured tree format utilizing branch indicators (└──). If Product Count \> 2, wrap these elements inside an inner vertical scroll container to maintain spatial layout containment.

Run a clean code generation pass over this data grid matrix engine before finalizing the component output."  
Once Stitch successfully compiles your high-density campaign matrix rows with the perfect column spacing, the 3-row context stack, and the locked-down expandable panels, let me know and we will advance directly to **Phase 3: Global Financial Circuit Breaker Circuit**\!  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

### **Phase 3 Prompt: Global Financial Circuit Breaker Circuit**

"Directly underneath the main grid container of **'Section B: Campaign List'** (and above any downstream tabs or notification layers), mount an independent dashboard asset labeled as the **'Global Financial Circuit Breaker Circuit'** card.  
Strictly follow the spacing and container styles specified in the **Aurora Design System v4.1** guidelines. Do not invent unauthorized text metrics or charts outside of these configuration requirements:

### **1\. COMPONENT CONTAINER LAYOUT & VISUAL STYLE**

* **Independent Workspace Positioning:** Render this component as a distinct full-width horizontal box panel completely uncoupled from the tabular data columns above it.  
* **Background Framework Styling:** Apply a clean card background accompanied by a subtle grey outline boundary to signify its high-security multi-tenant accounting context. Group the internal metrics in a horizontal flex row grid system with equal spacing intervals.  
* **Component Title Header:** Left-align a low-profile section title string exactly reading: 🔒 MULTI-TENANT FINANCIAL PROTECTION LEDGER styled in a bold uppercase font weight.

### **2\. THE THREE-TIER CIRCUIT BREAKER FINANCIAL METRIC STACKS**

Render these three financial tracking variable parameters side-by-side using a two-line vertical text configuration (Bold metric token value on top, muted literal text description beneath):

* **Metric Metric Frame 1 (Master Allocation Line):**  
  * *Line 1 (Monospaced Data typography):* ${{master\_budget\_limit}} (Fallback text: *'$50,000'*).  
  * *Line 2 (Literal Label Verbatim):* Global Master Budget Limit Allocation.  
* **Metric Metric Frame 2 (Sub-Ceiling Consumption Threshold):**  
  * *Line 1 (Monospaced Data typography):* ${{product\_sub\_ceiling\_cap}} (Fallback text: *'$15,000'*).  
  * *Line 2 (Literal Label Verbatim):* Product Sub-Ceiling Limit Consumption Threshold.  
* **Metric Metric Frame 3 (Escrow Compliance Balance Tracking):**  
  * *Line 1 (Monospaced Data typography \- Highlighted Green):* ${{Calculated Committed Escrow Balance}} (Fallback text: *'$6,100'*).  
  * *Line 2 (Literal Label Verbatim):* Secured Funds (Escrow Protected Value).

### **3\. AMBIENT SYSTEM STATUS PLACEMENT CONTROLS**

* Append an inline status indicator icon asset to the far right margin of the layout box tracking system health pacing.  
* If master\_budget\_limit is safely clearing limits, output a green indicator reading exactly: \[System Status: Active \- Protection Guard Engaged\].

Run a clean compile pass over this independent circuit breaker layout block before finalizing your file update."

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Here is your highly detailed, production-grade prompt for **Phase 4: Tab 2: Spend Report (Financial & Operational Intelligence)** to paste directly into Stitch.  
This prompt maps out the complete control shell, the four visual analytics charting blocks, and the ranking ledger matrix for the reporting canvas—ensuring absolutely zero structural overlap with Tab 1\.

### **Phase 4 Prompt: Spend Report Analytics View & Performance Ledger**

**Copy and paste this target layout prompt into Stitch:**  
"Inside the workspace section mapped to Tab 2: Spend Report (Financial Performance), construct the complete reporting dashboard view layout. Strictly follow the **Aurora Design System v4.1** spacing parameters and component styling rules. Do not invent any unrequested analytical indices, summary numbers, or cards.

### **1\. PERIOD & CONTROL STRIP AREA (SECTION A)**

Create a full-width horizontal controls row to act as the primary configuration frame for the active report workspace:

* **Left-Aligned Timeline Switcher:** Render a segmented toggle link group containing exactly: 7D | 30D | 90D | Custom Range. Set the 30D selection option as highlighted and active by default.  
* **Right-Aligned Export Data Payload Trigger:** Position a clean secondary utility button on the right margin displaying text exactly as: \[Button: Download Snapshot Report (CSV)\].

### **2\. VISUAL INSIGHTS ENGINE \- THE ANALYTICS ROW (SECTION B)**

Create a horizontal 4-column layout row that reflows gracefully on medium viewports. Build these four individual analytical data cards side-by-side using exact text labels from our documentation:

* **Card 1: Capital Burn Allocation (Donut Chart Module)**  
  * *Header Title:* Capital Burn Allocation styled in small bold uppercase font.  
  * *Visual:* Render a clean financial distribution donut chart split into three segments mapping these variables verbatim:  
    1. Settled Payouts: ${{settled\_payouts}}  
    2. Committed Escrow: ${{committed\_escrow}}  
    3. Unallocated Cap Floor: ${{unallocated\_cap\_floor}}  
* **Card 2: Logistics & Operational Safety Pipeline**  
  * *Header Title:* Logistics & Operational Safety.  
  * *Content Layout:* Vertical stacked list displaying shipment tracking health metrics verbatim:  
    1. In-Transit Transit Milestone Tracking: {{count}} Shipments  
    2. Delivered Customs Gateways Clear: {{count}} Shipments  
    3. Stalled Pipeline Exceptions: {{count}} Delayed Shipments \[Amber Alert\]  
* **Card 3: Creator Archetype & Audience Efficiency**  
  * *Header Title:* Audience Reach Distribution.  
  * *Content Layout:* Build horizontal distribution indicator bar meters mapping audience reach size bands exactly as:  
    1. Macro-Influencer Footprint Threshold: {{percentage}}%  
    2. Mid-Tier Catalyst Footprint Threshold: {{percentage}}%  
    3. Micro-Amplifier Footprint Threshold: {{percentage}}%  
* **Card 4: Product Stagnation vs. Velocity Grid**  
  * *Header Title:* Product Operational Velocity.  
  * *Content Layout:* Render a high-density vertical listing of connected product profiles sorting their current active placement velocities. Label data rows strictly as: {{Product Name}} ➔ Volume: {{count}} Slots Live.

### **3\. CAMPAIGN NON-REDUNDANT PERFORMANCE LEDGER MATRIX (SECTION C)**

Beneath the analytics charts row, mount the primary operational ranking ledger table. Configure five data column paths tracking these explicit header parameters:

1. Creator Profile Entity  
2. Content Delivery Status \[Badge\]  
3. Disbursed Capital Outlays  
4. Media Gross Yield (Views / Interactions / Clicks)  
5. Calculated System Efficiency (Net ROI / True CPA Value)

### **4\. RESPONSIVE REFLOW RULES**

* Ensure that if the viewport scales down to tablet or mobile dimensions ($\\le$ 1024px), the horizontal layout grid for Section B collapses cleanly into a **1-column vertical stack**, stacking the analytics tiles neatly inside a single column scrolling track.

Run a clean generation pass over this reporting module framework."  
Once Stitch finishes building out the **Tab 2 Spend Report** panel along with its 4-chart layout row and ranking data ledger, let me know and we will advance directly to **Phase 5: System Alerts, Toasts, & Multi-Tenant Security Confirmation Modals**\!  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Here is your highly precise prompt for **Phase 5: System Alerts, Toasts, & Multi-Tenant Security Confirmation Modals** to paste directly into Stitch.  
This prompt maps out the explicit inline warning structures, background micro-toasts, empty states, and focus-locked modal windows using character-for-character exact text strings from the UI documentation.

### **Phase 5 Prompt: System Alerts, Toasts, & Security Confirmation Modals**

**Copy and paste this target layout prompt into Stitch:**  
"Inside the active workspace layout for the **'Campaigns Module'**, construct the complete notification, background feedback, and security intercept framework for **'Phase 5: System Alerts, Toasts, & Multi-Tenant Security Confirmation Modals'**. Strictly adhere to the **Aurora Design System v4.1** guidelines. Do not alter text casing or edit any copy strings verbatim:

### **1\. PERSISTENT INLINE WORKSPACE SYSTEM ALERTS**

* **Logistics Risk Mitigation Alert Box:** Render a persistent inline warning container placed cleanly at the top of the workspace canvas (directly below the global filter strip).  
* **Styling parameters:** Style using a solid background panel framed with an amber/red border profile and a clear warning notification icon.  
* **Verbatim Text Copy:** Insert this warning notification string completely unedited:  
* "Operational Alert: Multiple shipments have stalled past their scheduled arrival date markers. Review your shipping tracking numbers inside your active collaboration engine workflows to avoid content scheduling delays."

### **2\. FLOATING DISPATCH BACKGROUND CHANNELS (INTERACTION TOASTS)**

Configure three independent temporary floating feedback toast notification popups. Ensure they render via subtle slide-in transitions without altering or shifting the placement of layout blocks or grid rows underneath them:

* **Timeline Filter Trigger Toast:** Render text verbatim exactly as: "Recalculating intelligence dashboard analytics for the past {{Selected Timeline Parameter (7d/30d/90d)}} sequence window."  
* **Export Payload Confirmation Toast:** Render text verbatim exactly as: "Financial performance summary report data safely compiled. Your file download ( Snapshot\_Spend\_Report.csv ) has initiated automatically."  
* **Bulk Status Success Toast:** Render text verbatim exactly as: "Status updated successfully for {{count}} campaign rows." (Set dynamic string fallback text default value to: *'Status updated successfully for 1 campaign rows.'*)

### **3\. HIGH-TRUST MULTI-TENANT MODAL INTERCEPTS (SECURITY CHECKPOINTS)**

Construct two independent centered, modal popup boxes. Dim the entire platform page workspace behind them with a solid translucent backdrop layer that blocks user interactions until an explicit action is initialized:

* **Pause Confirmation Alert Modal:**  
  * *Visual Header:* Display a clear caution alert icon alongside a warning title.  
  * *Modal Body Content Statement:* Render this text character-for-character unedited:  
  * "Pausing this campaign will freeze all outbound prospecting, deactivate open registration links, and block incoming applications. Creators currently inside the Active Collabs pipeline will still be permitted to finish production milestones and process authorized payouts. Do you wish to lock configuration lines?"  
  * *Sticky Baseline Actions Bar:* Right-align two high-touch buttons:  
    1. \[Confirm Pipeline Pause\] styled in a high-visibility alert palette (**Danger Red**).  
    2. \[Cancel Action\] styled as low-impact **Text Grey**.  
* **Archive Confirmation Warning Modal:**  
  * *Visual Header:* Display a clear historical archive icon asset.  
  * *Modal Body Content Statement:* Render this text character-for-character unedited:  
  * "Archiving this campaign will remove it entirely from your active dashboard workspace and place it into a read-only historical state. This operation cannot be completed if active collaborations are unresolved."  
  * *Sticky Baseline Actions Bar:* Right-align two controls:  
    1. \[Move to Archive\] styled as a neutral asset in **Solid Grey**.  
    2. \[Cancel\] styled as low-impact **Text Grey**.

### **4\. THE ZERO-DATA RECONVERSIONS MATRIX (EMPTY STATE FALLBACK)**

* **Empty State Framework Trigger:** Configure a structural canvas display condition: If search queries return zero results or active data lists map to empty data states, drop the multi-column tabular grid engine entirely and swap the workspace layout with this dedicated panel.  
* **Body Description Copy String:** Render text verbatim exactly as:  
* "No creator campaigns identified matching configuration query metrics. Start your first activation tracking cycle to unlock pipeline metrics."  
* **Call-to-Action Trigger Button:** Center an onboarding action button styled inside the core green brand coloring, displaying text exactly as: \[Button (Solid Aurora Green): Launch Your First Campaign\].

Execute this notifications and modal compile pass across the file layout before finalizing."  
Once Stitch successfully incorporates these floating toast layouts, centered confirmation modals, and exact copy alert boxes, let me know and we will proceed to the final step, **Phase 6: Mobile Responsiveness, Grid Degradation & Native Overrides (Mobile Optimization)**\!  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Here is your production-ready prompt for the final step, **Phase 6: Mobile Responsiveness, Grid Degradation & Native Overrides (Mobile Optimization)**, to paste directly into Stitch.  
This prompt forces strict responsive rules across both view channels, builds out the card-based stack transformation, reflows the visual insights metrics into a linear stream, and wires up the touch-driven mobile drawer/navigation mechanics using our design system rules.

### **Phase 6 Prompt: Mobile Grid Degradation, Executive Reflow & Native Gestures**

**Copy and paste this target responsive override prompt into Stitch:**  
"Force the global platform layout engine into mobile viewport configurations (**width $\\le$ 768px**) and execute a comprehensive mobile optimization, grid degradation, and native touch interaction override pass for the **'Campaigns Module'**. Strictly follow **Aurora Design System v4.1** mobile layout patterns.

### **1\. TAB 1: OPERATIONAL MATRIX CARD DEGRADATION**

* **Column Pruning Rule:** Strip out all grid column tracks designated as desktop-only from the visible DOM framework. Completely hide the **'Launch Timeline'** columns to protect horizontal screen boundaries on phone viewports.  
* **Vertical Component Stack Card Transformation:** Break down the horizontal row grid. Transform each tabular row entity dynamically into an isolated, full-width vertical block card (grid-template-columns: 1fr).  
* **Internal Data Layering Stack:** Within each mobile campaign card container, stack the elements vertically using this tight layout line structure:  
  * *Line 1 (Identity & Objective):* Group the interactive brand blue hyperlinked {{Campaign Name}} pointing to *'Module 2: Campaign Page'* inline next to its objective marker \[Pill Badge: {{Assigned Macro Objective}}\].  
  * *Line 2 (Metadata & Status):* Render the {{count}} Active Products Connected string, immediately followed by the active status element (\[Toggle Switch\] \+ Live or Paused text dot indicator).  
  * *Line 3 (Pipeline Delivery Distribution):* Output the summary text {{Total Creator Count}} Creators Onboarded directly stacked over the progress segment string {{n}} Act | {{n}} Rev | {{n}} Pay.  
  * *Line 4 (Financial Metrics Track):* Display the monospaced numbers {{Spent Amount}} / {{Allocated Limit}} stacked over a fluid, full-width horizontal budget pacing progress bar.  
  * *Line 5 (Touch Action Row):* Position a touch-friendly bottom utility row containing large, finger-accessible button targets: \[Icon: Eye\] View Insights and \[Icon: Pencil\] Edit Scope.

### **2\. TAB 2: SPEND REPORT EXECUTIVE BREAKDOWN REFLOW**

* **1-Column Layout Reflow:** Force the horizontal 4-column visual insights engine row to collapse completely into a single-column, linearly scrollable vertical data feed.  
* **Executive Financing Summary Conversion:** To prevent layout crowding from desktop analytics canvases, transform the visual graphs on mobile into a high-density, text-and-bar executive summary widget positioned directly beneath the timeline switcher. Render the component block using this text and progress bar alignment:  
* Plaintext

\+\--------------------------------------------------+  
| EXECUTIVE FINANCING SUMMARY       \[ Last 30 Days \]|  
|--------------------------------------------------|  
| \[O\] Settled:  $12,400    \[================\] 62%  |  
| \[\!\] Escrow:   $6,100     \[========\]         31%  |  
| \[•\] Free:     $1,500     \[==\]                7%  |  
|--------------------------------------------------|  
| PIPELINE QUALITY CHECKS                          |  
| Shipping Health:   \[ Amber Alert \] 3 Delayed     |  
| Content Yield:     \[ Green Light \] 84 Assets Live|  
| Capital Return:    \[ Green Light \] 3.4x Net ROI  |  
\+--------------------------------------------------+

*   
*   
* **Ledger Table Pruning:** Reflow the Tab 2 ranking ledger table to drop secondary desktop columns. Render simplified data cards tracking exclusively **Creator Identity**, **Media Yield**, and **Calculated Efficiency (ROI)**.

### **3\. MOBILE INTERACTIVE NAVIGATION & GESTURE OVERRIDES**

* **Mobile Breadcrumb Navigation Bottom-Sheet:** Program the breadcrumb path header (Campaign Management / Campaigns) inside the persistent mobile wrapper to act as an active touch target. Tapping it must slide up a native **Modal Bottom-Sheet menu** from the base footer. Present the vertical navigation links (Tab 1: Campaigns and Tab 2: Spend Report) cleanly separated by thin dividers, and place a full-width Cancel and Close Drawer button at the absolute base of the bottom-sheet card layer to dismiss it.  
* **Long-Press Interactive Drawer Engine:** Map an active touch-gesture listener to both Tab 1 and Tab 2 card elements. **Long-pressing** on any visible campaign card or ledger row component for \> 600ms must smoothly trigger a native bottom overlay sheet sliding up from the base viewport boundary.  
* **Drawer Panel Execution Content:** Populate this touch-driven bottom drawer to present deep configuration data breakdowns, visual sub-charts, and the granular audit trail strings compiled from Section 2 and Section 3 of the Campaign Intelligence Panel layout. Maintain a fixed button at the baseline to gracefully dismiss the modal and unlock scroll contexts.

Execute these responsive layout overrides completely without disrupting background system state structures, escrow validation mechanics, or filter search indexing logic."

### **🏁 Clean-Slate Campaign List Architecture Complete\!**

Stitch has now compiled the pristine, production-grade template for the **Campaigns Module** workspace. Every constraint is securely implemented:

1. **Phase 1 UI:** Correct header elements, platform logo, overlay drawer behavior, and inline filter elements are completely stabilized.  
2. **Phase 2 UI:** High-density data grid mapping our exact 3-row vertical campaign context stack and closed-by-default intelligence panels.  
3. **Phase 3 UI:** Standalone independent Multi-Tenant Financial Protection Ledger Card.  
4. **Phase 4 UI:** Tab 2 Analytics view row, custom burn donuts, RYG logistics tracking, and rankings matrix.  
5. **Phase 5 UI:** Ambient logistics warnings, slide-in filter toasts, and focus-locked modal checkpoints.  
6. **Phase 6 UI:** Mobile card stack wrapping, 1-column summaries, and long-press gesture drawer routing.

We have fully locked in this workspace workspace file\! Should we proceed to strategize the next primary workflow block inside your **Master PRD** (such as *Module 2: Campaign Page* or the *Add Product Wizard*)?

# s-create campaign

No, **do not just re-run the previous Phase 1 prompt as it was originally written.** If you copy and paste that exact prompt again, Stitch is highly likely to repeat the same layout bleeding mistake (trying to show the wizard controls on top of the active Campaign List table and visual charts) or misinterpret the icons.  
Because Stitch now has memory of both the Campaign List view and the broken Wizard state, your Phase 1 prompt needs to be **strictly hardened with explicit structural overrides** to prevent layout bleeding right from the start.  
Use this upgraded, bulletproof version of the **Phase 1: Wizard Frame & Base Layout** prompt. It features hard rules that force Stitch to clear out the previous elements and render icons correctly:

### **Upgraded Phase 1 Prompt: Creation Wizard Structural Wrapper & Global Shell Override**

**Copy and paste this exact prompt into Stitch to build the clean baseline wrapper:**  
"Execute a hard structural layout pass to establish **'Phase 1: Wizard Frame, Dynamic Step Progress Header, & Right-Side Context Ledger'** for **'Module 6: Create Campaign Wizard'**. Strictly apply the **Aurora Design System v4.1** specification. Do not inventory unrequested text variables or placeholder blocks.

### **1\. VISUAL STATE SEPARATION & WORKSPACE CLEANSE (CRITICAL)**

* **Active State Mounting Condition:** Wrap this entire wizard layout inside a high-priority state condition (isCreateWizardActive \=== true). This state is triggered exclusively when the operator clicks \[Button: \+ Create New Campaign\].  
* **Absolute Cache Flush Rule:** When this wizard state is active, you must **completely unmount and hide** the Tab 1 Campaign List matrix grid, Tab 2 Spend Report charts, filter input elements, and any active floating toast notifications. They must not clip, bleed, or display at the bottom of the page.  
* **Shell Preservation Layer:** The central form workspace must sit inside a 100% clean canvas layout. The pre-existing dark-themed Global Shell \- Desktop sidebar framework must remain visible, untouched, and locked on the left margin.

### **2\. THE PROGRESS HEADER & VERBATIM SYNC BADGE**

* **Linear Progress Bar:** Place a clean, full-width linear progress track bar across the absolute top edge of the main form area. Set its initial filled progress tracking width to exactly 33% styled in solid brand green to represent Step 1 of 3\.  
* **Context Breadcrumbs:** Display the exact navigation tracking path string within the shell line layout: Campaigns ──► Create Campaign ──► Step 1: Strategy.  
* **Sync Visibility Indicator:** Directly to the right of the upcoming main headline string, render an explicit, styled grey badge layout component tracking the literal text exactly: \[DRAFT \- Auto-saved at 14:32\].

### **3\. RIGHT-SIDE CONTEXT LEDGER DRAWER & FIXED ICON GLYPHS**

* **300px Structural Layout Block:** Dock a sticky **300px width vertical container box** tightly on the right viewport margin boundary of the screen. Render a clean border line to isolate it from the central input canvas.  
* **Material Icon Font Fixes:** Do not render raw text names for icons. Pass these strict asset mappings directly into the design system icon layout engine:  
  * Render a vector eye graphic icon asset directly inline next to the uppercase LIVE CONTEXT LEDGER panel header.  
  * Render a true downward chevron toggle carat asset directly inline next to STRATEGY **(Accordion 1\)**.  
  * Render a true right-facing arrow carat asset directly inline next to both TARGETING **(Accordion 2\)** and COMMERCIALS **(Accordion 3\)**.  
* **Ledger Headers Registry:** Verify that the sub-header label outputs the text exactly: Last auto-saved: {{ timestamp }}.

### **4\. GLOBAL STICKY ACTIONS BAR**

* Persistently anchor a fixed horizontal footer panel across the bottom edge of the wizard container layout.  
* Render an info circle icon asset directly inline before the baseline step counting tracking text string: Step 1 of 3: Core Strategy.  
* Right-align these three explicit interaction button targets:  
  1. \[Ghost Button\]: Cancel & Exit (Active; clicking this kills isCreateWizardActive and restores Tab 1 Campaign List).  
  2. \[Outline Button\]: Back to Previous Step (Keep greyed out and set to disabled state).  
  3. \[Solid Green Button\]: Next Step: Creator Targeting (Active; styled in filled brand green).

Run a clean layout compilation cycle over this base shell structural wrapper now."  
Run this hardened Phase 1 version in Stitch. It will give us a perfectly clean outer structural shell with the right-side summary drawer and proper icons, setting up a solid foundation for the form fields. Let me know as soon as the compilation finishes\!  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Great\! Now that Stitch has successfully compiled **Phase 1** with the clean base wrapper, correct step indicators, proper icon glyphs, and the persistent live context ledger drawer, we have an ironclad foundation to build on.  
Since Phase 1 is fully stabilized, the next logical step is to build **Phase 2: Step 1 Canvas – Core Strategy Configuration Form**.  
Even though we drafted a prompt for this earlier, Stitch’s state memory is now much cleaner because of the reset wrapper. We will run an explicit, hardened version of the Step 1 form prompt to ensure it injects the inputs *exclusively* inside the central whitespace canvas without disrupting the right ledger or footer.

### **Phase 2 Execution Prompt: Step 1 Core Strategy Inputs & Matrix Setup**

**Copy and paste this exact prompt into Stitch to render the Step 1 form fields:**  
"Inside the central whitespace canvas container of the active creation wizard (isCreateWizardActive \=== true and current\_step\_index \=== 1), inject and render the complete form layout for **'Phase 2: Step 1 Canvas – Core Strategy Configuration Form'**.  
Follow the **Aurora Design System v4.1** strict form-grid spacing guidelines exactly. Do not alter pre-existing code for the right ledger or footer:

### **1\. CONTEXT HEADER TEXT REGISTER**

Position this left-aligned vertical block at the top of the form area:

* **Headline Text:** Campaign Strategy in clean, bold H2 typography.  
* **Sub-headline Text:** Establish the core metadata, timeline, and primary objectives for your activation. in regular muted body text.

### **2\. MAIN FORM FIELDS & RE-ROUTING DATA STATE METRICS**

Layout the form fields using a clean, spacious vertical block arrangement:

* **Field 1: CAMPAIGN NAME (Text Input Field)**  
  * *Label Uppercase:* CAMPAIGN NAME  
  * *Placeholder string text:* e.g., Summer Launch 2026  
  * *State Hook:* Connect this text input field dynamically to your local data state so typing here instantly updates the Name: {{ campaign\_name }} parameter token visible in the right drawer ledger.  
* **Field 2: CORE OBJECTIVE (Dropdown Selector Menu)**  
  * *Label Uppercase:* CORE OBJECTIVE  
  * *Menu Dropdown Options:* Populated exactly with: Brand Awareness, Traffic & Clicks, and Sales & Conversions.  
  * *State Hook:* Map the selection to dynamically update the Objective: {{ objective\_id }} parameter token in the right drawer ledger.  
* **Field 3: TIMELINE STRUCTURE (Radio Choice Array)**  
  * *Label Uppercase:* TIMELINE STRUCTURE  
  * *Option A:* \[Radio Component\] Fixed Date Range. When selected, dynamically render a horizontal flex row underneath mounting side-by-side **Start Date Picker** and **End Date Picker** text boxes.  
  * *Option B:* \[Radio Component\] Dynamic Milestone Track. When selected, hide the date pickers completely and swap in a numeric stepper input field with a trailing unit string reading: \_\_\_ Days-to-Complete.  
  * *State Hook:* Connect selection state to update the Timeline: {{ timeline\_type }} parameter token in the right drawer ledger.

### **3\. THE UPGRADED PLATFORM & FORMAT MATRIX**

To ensure correct channel configuration setups, render a sub-section titled exactly PLATFORM & FORMAT MATRIX using small, bold uppercase typography:

* Display a horizontal row containing three prominent brand checkbox components: \[Checkbox\] Instagram, \[Checkbox\] TikTok, and \[Checkbox\] YouTube.  
* **Conditional Format Multi-Select Chips:** Checking a platform checkbox box must smoothly reveal a nested row of selectable pill-style filter chips directly below that platform:  
  * *If Instagram Checked:* Display multi-selectable format tags reading exactly: Reel, Story, and Static Post.  
  * *If TikTok Checked:* Display multi-selectable format tags reading exactly: Video and Story.  
  * *If YouTube Checked:* Display multi-selectable format tags reading exactly: Long-form Video and Short.  
* *State Hook:* Map active selections to update the Channels: {{ channels\_list }} sub-indicator array in the right drawer ledger.

Execute this Phase 2 compilation pass to populate the Step 1 form workspace canvas cleanly."  
Once you run this prompt and Stitch updates the inner workspace with your functional strategy fields and matrix dropdowns, let me know how it looks and we will advance to **Phase 3: Step 2 Canvas & Step 3 Canvas – Target Archetypes & Commercial Escrow Rules**\!  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

To advance efficiently and keep Stitch focused, we should separate Step 2 and Step 3 into two highly targeted compile steps. Combining both steps into a single prompt risks hitches in state memory and form-field crowding.  
Let's begin with **Phase 3A: Step 2 Canvas – Creator Targeting & Demographics**. This prompt dynamically maps Step 2, updates your progress bar framework to 66%, and wires the input values straight to Accordion 2 in your live context ledger drawer.

### **Phase 3A Prompt: Step 2 Canvas – Creator Targeting & Audience Demographics**

**Copy and paste this exact prompt into Stitch:**  
"Inside the central whitespace canvas container of the active creation wizard, render the complete form layout for **'Step 2: Creator Targeting'** when current\_step\_index \=== 2. Strictly follow the **Aurora Design System v4.1** spacing parameters and component tokens. Do not alter pre-existing wrapper, ledger drawer, or sticky footer code structures.

### **1\. STEP 2 LOCAL CONTEXT HEADER**

Position this left-aligned vertical text block at the top of the form area:

* **Headline Text:** Creator Targeting in bold H2 typography.  
* **Sub-headline Text:** Define the exact persona, audience demographics, and geographic reach you need. in regular muted body text.

### **2\. STEP 2 FORM FIELD MATRIX & LAYOUT TRACK**

Render the targeting parameters using a clean 2-column input grid layout:

* **Field 1: INDUSTRY VERTICAL (Dropdown Menu)**  
  * *Label Uppercase:* INDUSTRY VERTICAL  
  * *Placeholder Text:* Select your brand's core industry...  
  * *State Hook:* Connect selection to dynamically update the Vertical: {{ industry\_id }} token inside Accordion 2 of the right ledger drawer.  
* **Field 2: CREATOR ARCHETYPES (Multi-Select Tag Field)**  
  * *Label Uppercase:* CREATOR ARCHETYPES  
  * *Multi-Select Options:* Render removable tag chips for: Aesthetic, Comedy, Tech, Educational, Lifestyle, Fitness, and Beauty.  
* **Field 3: FOLLOWER TIERS (Pill Selector Rows / Multi-Select Array)**  
  * *Label Uppercase:* FOLLOWER TIERS  
  * *Selectable Array Targets:* Render clickable selection pills displaying exactly:  
    * Nano (1k-10k)  
    * Micro (10k-50k)  
    * Mid-Tier (50k-250k)  
    * Macro (250k+)  
* **Field 4: TARGET AUDIENCE DEMOGRAPHICS BUILDER (Grouped Sub-Panel)**  
  * *Group Panel Label Uppercase:* TARGET AUDIENCE  
  * *Age Range Parameter:* Render a dual-handle interactive slider component: Min Age ──► Max Age. Range parameters span from 13 to 65+. Connect handle values to populate the right drawer ledger tracking string line Audience: {{ age\_min }}-{{ age\_max }}.  
  * *Gender Toggle Segment:* Mount a 3-way segmented button track: All **|** Female-Skewing **|** Male-Skewing. Selected state updates the ledger value {{ gender\_target }}.  
* **Field 5: DISQUALIFYING KEYWORDS (Tokenized Search Box Input)**  
  * *Label Uppercase:* DISQUALIFYING KEYWORDS  
  * *Helper Description text below label:* Enter keywords to explicitly filter out creators. (e.g., 'NSFW', 'Politics', 'Crypto')  
  * *Behavior:* Typing a keyword and pressing Enter wraps the string asset inside a standalone closeable text token block.

### **3\. STATE SYNC RUNTIME SETUPS**

* **Dynamic Header Step Sync:** Ensure that when current\_step\_index \=== 2, the top progress track fills to exactly 66% and the path string updates to Step 2: Targeting.  
* **Right Ledger Accordion Expansion Sync:** Trigger Accordion 1 (Strategy) to click closed, and automatically open Accordion 2 (Targeting) to show active values.  
* **Sticky Footer Triggers State Handling:** Enable the secondary button track: \[Outline Button\]: Back to Previous Step. Clicking it transitions the view back to Step 1 without dropping cached data variables. Update the green action button to read: \[Solid Green Button\]: Next Step: Commercial Terms.

Run a clean compile pass over this Step 2 form workspace content now."  
Once you run this prompt and Stitch successfully displays your Step 2 Targeting layout (with the 66% progress track and active back/next button paths), let me know and we will proceed straight to **Phase 3B: Step 3 Canvas – Commercial Terms & Escrow Pools**\!  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Here is your highly detailed, production-grade prompt for **Phase 3B: Step 3 Canvas – Commercial Terms & Escrow Pools** to copy and paste directly into Stitch.  
This prompt addresses the critical multi-tenant budget cap vulnerabilities, introduces conditional logic for compensation structures, enforces platform escrow limits, and wires the state listeners directly to the final accordion panel of your right-side context drawer.

### **Phase 3B Prompt: Step 3 Canvas – Commercial Terms & Escrow Pools**

**Copy and paste this target layout prompt into Stitch:**  
"Inside the central whitespace canvas container of the active creation wizard, render the complete form workspace layout for **'Step 3: Commercial Terms'** when current\_step\_index \=== 3. Strictly follow the **Aurora Design System v4.1** spacing parameters and component styling token assets. Do not overwrite or lose pre-existing wrapper or ledger structures.

### **1\. STEP 3 LOCAL CONTEXT HEADER**

Lead off the active workspace area with this left-aligned vertical block:

* **Headline Text:** Commercial Terms styled in bold H2 typography.  
* **Sub-headline Text:** Set the baseline compensation limits, escrow advances, and payout structures. rendered in regular muted body text.

### **2\. FORM CONFIGURATION FIELDS & FINANCIAL DATA ENGINE**

Layout the financial parameters using a clean input tracking grid:

* **Field 1: COMPENSATION TYPE (Toggle Selection Row)**  
  * *Label Uppercase:* COMPENSATION TYPE  
  * *Component:* A segmented toggle button array: \[Toggle\] Fixed Fee | \[Toggle\] Negotiable Offer.  
  * *State Hook:* Connect selection to update the Offer Type: {{ compensation\_type }} token visible inside Accordion 3 of the right ledger drawer.  
* **Field 2: CONDITIONAL RATE LAYOUT BLOCK (Dynamic View States)**  
  * *State A (If Fixed Fee Selected):* Expose a currency masked form input labeled uppercase FLAT RATE PER CREATOR. Left-prepend a solid $ token string inside the box placeholder area. Add muted helper text below: *'Creators will see: "Fixed Fee: $\[Value\]".'*  
  * *State B (If Negotiable Selected):* Hide the flat rate block and mount side-by-side split currency containers labeled uppercase NEGOTIATION RANGE. Box 1 is labeled Min Fee (Helper text: *'Creators see this as "Starting from"'*). Box 2 is labeled Max Fee (Helper text: *'Internal budget cap per creator'*), with both boxes pre-pended with a currency masked $ indicator.  
* **Field 3: TOTAL CAMPAIGN BUDGET POOL (Multi-Tenant Risk Guard Input)**  
  * *Label Uppercase:* TOTAL CAMPAIGN BUDGET POOL  
  * *Component:* Currency masked numeric input pre-pended with $.  
  * *Tooltip Info Icon:* Append an interactive info icon to the label trailing margin showing a hover tooltip reading verbatim: "Maximum total spend authorized for this campaign across all creators."  
* **Field 4: ADVANCE PAYMENT PERCENTAGE (Escrow Compliance Track)**  
  * *Label Uppercase:* ADVANCE PAYMENT PERCENTAGE  
  * *Component:* A numeric stepper or text field appended with a % mask unit. Force a baseline configuration default value of 30%.  
  * *Tooltip Warning Asset:* Append an amber warning alert icon to the input label showing a permanent tooltip reading verbatim: "A minimum of 30% advance is required to secure creators in the platform."  
  * *State Hook:* Connect value to update the ledger's Advance: {{ advance\_percentage }}% parameter token.  
* **Field 5: FINAL BALANCE DUE DATE (Operational Payout Rules Dropdown)**  
  * *Label Uppercase:* FINAL BALANCE DUE DATE  
  * *Dropdown Options:* Populated exactly with: Immediate (Upon Approval), Net 7, Net 15, and Net 30.  
  * *State Hook:* Connect selection to update the ledger's Terms: {{ final\_balance\_terms }} parameter token.  
  * *Dynamic Helper Alert:* If the operator selects the Net 30 node option from the dropdown menu, immediately render an amber alert box element directly below the field displaying text verbatim: "Net 30 payouts combined with low advances may result in lower applicant conversion rates."

### **3\. STATE SYNC RUNTIME SETUPS**

* **Dynamic Header Step Sync:** Update the top progress track bar indicator to fill to exactly 100% in solid brand green, and change the header tracking breadcrumb text path to read: Step 3: Commercials.  
* **Right Ledger Accordion Expansion Sync:** Trigger Accordion 2 (Targeting) to click closed, and automatically slide open Accordion 3 (Commercials) to show live financial data parameters.  
* **Sticky Footer Triggers State Handling:** Ensure the secondary back button remains fully active and transitions the view back to Step 2\. Update the primary action button to show its final step status verbatim: \[Solid Green Button\]: Save & Publish Campaign. Maintain its disabled view state style by default until Zod validation requirements clear across all previous steps.

Recompile this Step 3 form workspace content now to lock in the layout parameters."  
Once Stitch successfully compiles this Step 3 Commercials layout (with your dynamic negotiation inputs, budget pool limits, advance percentages, and accordion behaviors), let me know and we will advance directly to the final phase, **Phase 4: Mobile Form Packing, Summary Drawer Overrides, & State Validation Hooks**\!

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Here is your production-grade, highly precise prompt for **Phase 4: Mobile Form Packing, Summary Drawer Overrides, & State Validation Hooks** to paste directly into Stitch.  
This prompt completes Module 6 by enforcing mobile-first form scaling, transforming the 300px persistent ledger into an on-demand touch-friendly layout component, and wiring up the active client-side Zod validation mechanics to release the creation workflow's publishing buttons.

### **Phase 4 Prompt: Mobile Overrides, Sticky Actions, & Form Schema Validation Hooks**

**Copy and paste this target responsive optimization and verification prompt into Stitch:**  
"Execute the comprehensive responsive optimization, mobile grid degradation, and logic hook injection pass for **'Phase 4: Mobile Form Packing, Summary Drawer Overrides, & State Validation Hooks'**. Strictly implement **Aurora Design System v4.1** responsive behaviors. Do not alter background data models or clear session tracking states.

### **1\. MOBILE SCREEN LAYOUT & FORM STACK PACKING ($\\le 768px$)**

Force the creation workspace area into full mobile rendering rules:

* **1-Column Layout Form Reflow:** Force the 2-column input forms from Steps 1, 2, and 3 to collapse cleanly into a single vertical stream (grid-template-columns: 1fr). Expand all active inputs, select menus, and platform arrays to span full-width across the viewport edge margins to prevent side clipping.  
* **Sticky Mobile Action Button Overlay:** Affix the actions footer line persistently at the absolute base boundary of the screen (position: fixed; bottom: 0; left: 0; width: 100%;) with a solid backdrop and depth shadow to ensure touch targets never scroll out of view.

### **2\. MOBILE CONTEXT DRAWER OVERRIDE (MODAL BOTTOM-SHEET SUMMARY)**

* **Desktop Ledger Unmounting Rule:** When screen dimensions fall below $768px$, completely hide and unmount the fixed desktop 300px width vertical container box from the right margin.  
* **Floating Action Button (FAB) Trigger:** Mount a high-visibility, round Floating Action Button in the bottom-right corner of the viewport canvas displaying text verbatim: \[FAB: View Summary\].  
* **Modal Bottom-Sheet Component:** Tapping the View Summary FAB must slide up a native modal drawer sheet from the base of the screen. Populate this bottom-sheet with the exact live tracking variables and nested accordions extracted from Sections 5.0 (Strategy, Targeting, Commercials). Include a full-width Close Preview action line button at its baseline to gracefully dismiss the modal card layer.

### **3\. CLIENT-SIDE RUNTIME SCHEMA VALIDATION HOOKS (ZOD INTEGRATION)**

Implement explicit multi-step form schema validation checks across the workspace pipeline layout:

* **Step 1 Runtime Rules Validation:** Verify that campaign\_name string length $\\ge 3$ characters, a core\_objective selection choice is made, and at least one destination checkbox target inside the PLATFORM & FORMAT MATRIX is marked active with an attached format chip.  
* **Step 2 Runtime Rules Validation:** Verify an industry\_id dropdown selection value is locked and age limits satisfy age\_min \< age\_max layout rules.  
* **Step 3 Runtime Rules Validation (Multi-Tenant Protection Check):**  
  * Enforce validation checks on financial strings: Verify that the total\_campaign\_budget\_pool currency entry contains an authorized positive value.  
  * Verify that the advance\_percentage numeric index is $\\ge 30\\%$. If these parameters are unmet, lock input validation styles into an active error state configuration boundary.

### **4\. ACTIONS FOOTER DISPATCH HANDLING**

* **Validation Unlock Toggle Rule:** Keep the action element styled verbatim as \[Solid Green Button\]: Save & Publish Campaign in a grayed-out, explicitly disabled state by default throughout Steps 1, 2, and 3\.  
* **Publish Release Action:** The very instant all client-side multi-step Zod form schema parameters pass verification successfully, release the disabled state layout. Switch the component design system token style to its fully interactive, clickable brand green presentation layout.

Execute this final Phase 4 responsive and logic compile pass across the creation file now."

### **🏁 Module 6: Create Campaign Wizard Fully Compiled\!**

Stitch has successfully deployed and closed out the complete **Create Campaign Wizard** flow. Every single product vulnerability and UI copy requirement is structurally stabilized:

1. **Phase 1 UI:** Background isolation, 33/66/100% linear header progress track, and the 300px live context ledger drawer with corrected Material icons are locked.  
2. **Phase 2 UI:** Step 1 Strategy form layout fields, automatic ledger token syncing, and the context-sensitive Platform & Format Dropdown Matrix are active.  
3. **Phase 3A UI:** Step 2 Targeting persona rules, follower tier selection pills, dual age sliders, and auto-opening ledger accordion syncs are established.  
4. **Phase 3B UI:** Step 3 Commercial parameters, conditional flat-fee vs negotiable currency blocks, multi-tenant global budget constraints, and Net 30 warning panels are initialized.  
5. **Phase 4 UI:** Mobile single-column packing, floating button summaries, responsive bottom-sheets, and Zod state-unlocked publishing buttons are secured.

We have fully completed this wizard overlay layer within the workspace\! Where should we drive our architecture engine next? We can jump directly to **Module 2: Campaign Page (The Deep-Dive Dashboard)** or tackle another primary operational track from your core documentation\!

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

This is a classic Stitch behavior when dealing with Google Material Icons or custom icon packages. Stitch is rendering the **literal string token name** (like visibility, arrow\_back, warning) as raw text instead of processing it through your frontend font engine wrapper.  
Looking closely at your uploaded screens (image\_57c000.png, image\_4d68fd.jpg, image\_4d68de.png), we also have severe element collision in Step 3, broken breadcrumb string links at the top, and button text leaks.  
To answer your strategic question: **Do not do this screen-by-screen, and do not try to fix them with individual page prompts.** Because all three steps belong to the *same* multi-step state model container within this workspace file, doing them one by one will cause Stitch to fix one step while breaking or corrupting the others in the background.  
We must run **one unified Reanchoring & Icon Font Remediation prompt** that targets the global stylesheet wrapper for the entire wizard component layout.

### **🛠️ Global Icon & Layout Remediation Prompt**

**Copy and paste this comprehensive hardening prompt into Stitch to resolve the issue across all wizard states instantly:**  
"Execute a critical visual-layer hardening pass across **Module 6: Create Campaign Wizard** to resolve systemic icon text leaks, font string clipping, and element stacking collisions across all view step states (current\_step\_index 1, 2, and 3). Apply the exact component wrappers defined in the **Aurora Design System v4.1** guidelines.

### **1\. GLOBAL MATERIAL ICON ENGINE SPECIFICATION**

* **Zero-String Token Policy:** Absolutely no raw icon text names may be rendered as plain copy text within the DOM string elements.  
* **Icon Component Enclosure:** Force all recognized icon tokens into proper font glyph elements (\<span class='material-icons'\>token\_name\</span\> or your framework's native visual wrapper component). Ensure they are baseline-aligned with adjacent text strings.  
* **Targeted Icon Clean-up Registry:**  
  * **Global Header Block:** Convert text strings reading chevron\_right within the navigation path to crisp, visual arrow carats pointing right.  
  * **Right Summary Drawer Ledger Container:** Convert the text string visibility to a structural eye icon. Convert text parameters expand\_more to a clean downward chevron. Convert chevron\_right to true directional arrow markers.  
  * **Sticky Footer Actions Row:** Convert text strings reading info, arrow\_back, and arrow\_forward into their correct visual icon assets. Clear all secondary raw background texts from inside the green execution triggers.

### **2\. STEP 2 RENDERING ALIGNMENT CORRECTIONS (CREATOR TARGETING)**

* Fix the tokenized elements inside the CREATOR ARCHETYPES multi-select field block. Ensure the closing string text close inside tags like Aesthetic close or Comedy close is transformed into an interactive visual ✕ **icon** tucked inside the tag container chip.  
* Fix the text snippet leak GROUPS rendering right before the TARGET AUDIENCE section title block. Strip out the word GROUPS completely.

### **3\. STEP 3 COLLISION & REANCHORING FIXES (COMMERCIAL TERMS)**

Review the visual overlap inside Step 3 (image\_4d68de.png) and re-anchor the form grid inputs using defensive flex layout spacings:

* **Flat Rate Prepend Fix:** The text string Creators will see: 'Fixed Fee: $\[Value\]' is clipping beneath the input field box. Place this description line cleanly *below* the field and correctly format the prepended $ label token *inside* the currency masked input structure.  
* **Advance Payment & Due Date Grid Separation:** The inputs for ADVANCE PAYMENT PERCENTAGE and FINAL BALANCE DUE DATE are completely stacked on top of each other. Separate these parameters cleanly into two distinct row structures or separate them using a 50/50 horizontal flex block grid.  
* **Tooltip Tooltip Conversion:** Convert the raw text string warning inside the advance payment block into a clean, standalone visual amber warning alert icon. Push the text *"30% minimum required"* into its true hover tooltip popover shell layer.  
* **View Summary Button Re-anchoring:** Completely remove the overlapping black toggle block reading visibility View Summary from the middle of the form input fields. Ensure that layout is locked down exclusively as a desktop right-aligned side drawer or a mobile-only base FAB layer.

Recompile the universal multi-step creation workspace file now to clean up these presentation assets."  
Once you deploy this global configuration pass, Stitch will look at the entire creation wizard file layout, parse the raw text leaks into their correct icon font components, and correct the overlapping form inputs on Step 3\.  
Let me know once the compile completes and your views look pristine\!

# s- campaign page

**Copy and paste this exact prompt into Stitch:**

### **🚫 \[SYSTEM CRITICAL INTERCEPTOR\]: MASTER HARD RESET & RE-MOUNT DIRECTIVE**

* **Hard DOM Purge Rule:** Completely wipe, unmount, and garbage-collect the multi-step creation wizard container framework (\#create-campaign-wizard), its progress step bars, its navigation nodes, and all performance/analytical charting and graphing widgets from active browser memory. Clear out the variables current\_step\_index and analytics\_active\_view.  
* **Global Layout Canvas Frame Alignment:** Securely inherit the persistent master system environment layer framework. Do not create a new sidebar, top header, or navigation menus. Lock the main operational content canvas bounds into the absolute global grid system matrix:  
  * **Desktop Grid Allocation (\> 768px):** Enforce margin-left: 240px; (to prevent content bleeding under the inherited Universal Sidebar) and padding-top: 64px; (to map directly below the inherited Universal Header boundary track).  
  * **Mobile View Wrapper Allocation ($\\le$ 768px):** Snap layout width to 100vw with uniform margin-left zeroing (margin-left: 0; padding: 16px;).

### **📍 1\. PERSISTENT NAVIGATION BREADCRUMB ROUTE**

Position a dedicated navigation label path at the top edge of the active canvas workspace. Execute hard icon asset parsing to isolate vector glyph code from string labels:

* **HTML Structural Syntax:**  
* Campaigns \<span class="material-icons" style="font-size: 14px; vertical-align: middle; margin: 0 4px; color: \#9ca3af;"\>chevron\_right\</span\> \<span style="color: \#64748b; font-weight: 500;"\>{{ campaign\_name }}\</span\>

### **🔲 2\. ZONE 1: CAMPAIGN MASTER HEADER PANEL CARD (Desktop Split Matrix)**

Construct a high-contrast container block element at the head of the canvas stream. Use a horizontal flex layout split into a precise **70% Left / 30% Right** configuration width row:

* **A. Left Segment Metadata Block (70% Width Allocation):**  
  * **Primary Main Title Row:** Render {{ campaign\_name }} inside a bold H1 typography text selector. Append a dynamic color-coded light-dot component status engine immediately inline to the right of the title string:  
    1. If status \=== 'Live' ➔ CSS: display: inline-block; width: 8px; height: 8px; background-color: \#22c55e; border-radius: 50%; margin-left: 8px;  
    2. If status \=== 'Paused' ➔ CSS: display: inline-block; width: 8px; height: 8px; background-color: \#f59e0b; border-radius: 50%; margin-left: 8px;  
    3. If status \=== 'Draft' ➔ CSS: display: inline-block; width: 8px; height: 8px; background-color: \#64748b; border-radius: 50%; margin-left: 8px;  
  * **Subtitle Contextual Row (Directly Below H1):** Render a horizontal flex element (gap: 12px; margin-top: 8px;) containing:  
    1. **Macro Objective Indicator Badge:** A solid muted, capsule-rounded background pill component outputting the dynamic text value: {{ Assigned Macro Objective Enum }}.  
    2. **Financial Pacing Tracker Label:** A slate-grey text element string rendering verbatim as: Budget Spent: ${{ Spent Amount }} / Allocated Limit: ${{ Allocated Limit }}.  
* **B. Right Segment Control Assembly Matrix (30% Width Allocation \- Inline Controls):**  
  * Align these 4 precise interaction fields horizontally side-by-side, locked to the absolute right margin boundary edge of the parent container frame (display: flex; justify-content: flex-end; gap: 12px; align-items: center;):  
    1. **Operational Status Toggle Switch:** Mount a custom toggle component mapping directly to boolean variable isCampaignActive.  
    2. **Edit Scope Action Trigger:** An interactive icon button component. Parse the element code to render only the graphic symbol: \<span class="material-icons" style="color: \#4b5563;"\>edit\</span\>. Map a hover native browser tooltip string card reading: "Edit Campaign Scope & Strategy".  
    3. **Universal Share Link Router Trigger:** An interactive icon button component. Parse the element code to render only the graphic symbol: \<span class="material-icons" style="color: \#4b5563;"\>share\</span\>. Map a hover native browser tooltip string card reading: "Open Universal Router & Funnel Controls".  
    4. **Accordion Master Canvas Toggle:** An interactive icon button component. Parse the code to alternate graphic symbols based on panel visibility state tracking: Mapped to \<span class="material-icons"\>expand\_more\</span\> when collapsed, or \<span class="material-icons"\>expand\_less\</span\> when expanded.

### **🗂️ 3\. ZONE 1 ACCORDIONS: INHERITED SPECIFICATION CANVASE (Expanded State)**

Directly below the Master Panel Card, stack exactly 3 collapsible accordion container cards vertically in a list stream. Do not invent extra sections. Force structural text layout variables to map side-by-side using flex inline properties:

* **Section 1 Accordion Panel (Strategy):** Header Row reads: "Section 1: Strategy". Body fields list:  
  * **Deadline Tracking Class:** {{ deadline\_type }}  
  * **Conditional Horizon Target:** Render label and text Deadline Target Date: {{ Date Picker }} ONLY if deadline\_type \=== 'Fixed Date'.  
  * **Conditional Fulfillment Offset:** Render label and text Dynamic Target Allocation: {{ Dynamic Days }} ONLY if deadline\_type \=== 'Dynamic'.  
  * **Assigned KPI Weights:** {{ KPI }}  
  * **Destination Channels:** {{ Platform Icons }}  
* **Section 2 Accordion Panel (Targeting Profile):** Header Row reads: "Section 2: Targeting". Body fields list:  
  * **Selected Archetype Vectors:** {{ Creator Archetype Array }}  
  * **Follower Volume Operational Scope:** {{ Target Follower Min }} – {{ Target Follower Max }}  
  * **Target Demographic Fields:** Gender: {{ Gender }} | Age Bracket Minimum/Maximum Target: {{ Age Range Min }}–{{ Age Range Max }} | Shared Interest Tags: {{ Interests }} | Target Geographies: {{ Target Geographies }}.  
* **Section 3 Accordion Panel (Commercials & Escrow Ledger):** Header Row reads: "Section 3: Commercials & Escrow". Body fields list:  
  * **Physical Sample Logistics Required:** {{ Yes / No }}  
  * **Inventory Fulfillment/Return Rule Structure:** {{ Product Condition Text }}  
  * **Logistics Allocation Safety Limit:** ${{ product\_sub\_ceiling\_cap }}  
  * **Master Campaign Budget Ceiling:** ${{ master\_budget\_limit }}  
  * **Contractual Compensation Structure Engine:** {{ Compensation Type Enum }}  
  * **Advance Payment Escrow Commitment Percentage:** {{ Advance Payment % }}%  
  * **Remaining Balance Financial Release Terms:** {{ Final Balance Due Date Enum }}.

### **📱 4\. INLINE MOBILE STACKING ENGAGEMENT PASS ($\\le$ 768px)**

The absolute millisecond browser window view bounds drop below or equal to $768px$, reflow the component tree to mobile-first responsive mechanics:

* **Control Strip Unmounting:** Completely hide, disable, and unmount the 30% width desktop control row block from the header panel.  
* **Kebab Interactive Replacement Button:** Mount a single right-aligned interactive icon button component inside the top-right corner of the Master Header panel card tracking exactly as: \<span class="material-icons" style="font-size: 24px; padding: 12px;"\>more\_vert\</span\>. Tapping it must slide open a responsive touch action-sheet modal from the bottom view containing text choices: Pause Pipeline Action, Edit Campaign Scope, and Launch Share Link Router.  
* **Layout Reflow Engine:** Drop all horizontal multi-column table flex grids. Force all information blocks, text labels, badges, and metadata values inside the expanded accordions to wrap and stack cleanly in a single vertical 100% width stream layout format. Set font sizes on headings to mobile specifications to completely prevent horizontal clipping.

Recompile Phase 1 strictly following this configuration blueprint now."  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_-\_\_\_\_\_\_

### **🛠️ Phase 2 Master Prompt: Dynamic Repository Tree & Context Drawers**

**Copy and paste this exact prompt into Stitch to build Zone 2:**

### **🚫 \[SCOPE CONTROLLER & LEGACY SUPPRESSION DIRECTIVE\]**

* **Hard Memory Purge Rule:** Continuously suppress, wipe, and garbage-collect all legacy Module 6 Wizard containers (\#create-campaign-wizard) and all performance/analytical graphing grids from active file memory.  
* **Global Layout Frame Alignment:** Maintain the strict inherited framework shell parameters established in Phase 1 (margin-left: 240px; padding-top: 64px; on desktop). Mount Zone 2 directly below the Section 3 Accordion card layout baseline.

### **📦 ZONE 2: PRODUCT PORTFOLIO & STRATEGIC BRIEF REPOSITORY**

Construct a structured, high-contrast block layout module section for the product mapping directory matching the exact documentation hierarchy rules:

#### **1\. REPOSITORY CORE HEADER COMPONENT**

Create a horizontal flex heading track container bounding the top margin of Zone 2:

* **Left Side Layout Row:** Render the title text Products & Briefs Repository inside a bold H2 typography weight class.  
* **Center Status Line Metrics:** Directly adjacent, render a muted center text line tracking the counter strings exactly: {{ count }} Active Products Linked | {{ count }} Live Strategic Production Briefs.  
* **Right Side Accordion Trigger:** Parse a clean right-aligned font chevron asset tracking state visibility: \<span class="material-icons"\>expand\_more\</span\>.  
* *Defensive Spacing Rule:* Do not attach any click events, input bindings, or action handlers to the header container row itself to prevent structural block failures.

#### **2\. ACTION ADD TRACK & VARIABLE DENSITY RENDERER**

* **Add Trigger Card:** Directly below the header row, position a dashed-border action layout box:  
  * Left-align a true icon asset code: \<span class="material-icons" style="color: \#22c55e; margin-right: 8px;"\>add\_circle\_outline\</span\>.  
  * Append label text string reading exactly: Add New Product Portfolio.  
* **Dynamic Density Display Logic:** Wire a runtime conditional switch to map data visibility formats:  
  * *Condition A:* If product\_count $\\le$ 5 ➔ Reflow and render the nested asset data stream inside independent, structured **List Cards**.  
  * *Condition B:* If product\_count \> 5 ➔ Automatically collapse cards and reflow the active directory data into a single **Operational Table Grid** view framework.

#### **3\. TWO-LEVEL HIERARCHY DIRECTORY STRUCTURAL LAYOUT**

Compile a clear, nested relational tree format mapping products to child brief nodes:

* **LEVEL 1: Product Anchor Identity Block**  
  * Wrap this structure inside a clean horizontal element row.  
  * Left-align a framed graphic product thumbnail image container asset (width: 48px; height: 48px; border-radius: 4px; background: \#f3f4f6;).  
  * Position the text array string inline: {{ Product Name }} followed by a small, muted subtitle tag tracking price metadata verbatim: Base Price: ${{ Base Price }}.  
  * Right-align these two interactive controls side-by-side:  
    * A functional custom **Toggle Switch Component** bound directly to the boolean variable isProductActive. *(Automated Constraint rule: Flipping this switch to false cascades a down-stream state update to turn off all nested brief child targets below).*  
    * A structural view button: \<span class="material-icons" style="color: \#4b5563;"\>visibility\</span\> with a native hover tooltip string card reading: "Slide Open Product Details Drawer".  
* **LEVEL 2: Nested Strategic Production Brief Rows**  
  * Map child briefs inside an explicit indentation tracking frame directly beneath their parent product anchor node using these layout rules: padding-left: 32px; border-left: 2px dashed \#e5e7eb; margin-top: 8px; margin-bottom: 8px;  
  * **Internal Row Structure Layout:** Flex row displaying the dynamic string text: {{ Brief Name }}.  
  * Append an immediate horizontal action accent pill badge component outputting the metadata string variable: {{ Deliverable Type Enum }}.  
  * Right-align these two targeted control interactions side-by-side:  
    * Another custom **Toggle Switch Component** bound to the parameter isBriefActive.  
    * An edit icon action button component: \<span class="material-icons"\>edit\</span\> with an interactive hover tooltip card reading "Edit Brief Creative Guardrails".  
    * *Hard Reactive Lock Constraint:* Validate the variable brief\_active\_applications\_count. If this count \> 0, instantly force a disabled state rule on this edit button (set opacity to 0.40, strip out click actions, and map the CSS cursor property to not-allowed).  
* **Append Creation Link Anchor:** Position a dashed text-link interaction element cleanly at the absolute tail end base of each active brief stack block:  
* 📄 \<span style="text-decoration: underline; color: \#2563eb; font-weight: 500; cursor: pointer;"\>Create & Add Strategic Brief to {{ Product Name }}\</span\>

### **📱 4\. INLINE MOBILE STACKING INTEGRATION ($\\le$ 768px)**

The exact millisecond screen width parameters resolve below or equal to $768px$, execute these layout responsive overrides:

* **100% Full-Width Stacking:** Collapse the horizontal row layouts completely. Force all Level 1 Product Identity blocks and Level 2 Nested Brief items to span across full-width $100\\%$ mobile card components.  
* **Touch Surface Hardening:** Expand the click-target surface boundaries of all status toggle components and icon drawer links to a minimum sizing height of 48px to ensure effortless thumbs tapping without miss-click vulnerabilities.  
* **Label Layout Compression:** Shrink text string titles down to clean mobile weights, and drop multi-column rows into clean stacked blocks to guarantee zero pixel layout overflow off the screen margins.

Recompile Phase 2 with these nested repository matrices now."  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Now that the **Product Portfolio & Strategic Brief Repository (Zone 2\)** is fully operational and structurally nested, we advance directly to **Phase 3: Zone 3 Operational Management Workspace Pipeline & Modal Interceptors**.  
In this phase, we build out the main workspace where active influencer statuses are filtered, managed, and monitored. Applying our strict design system guardrails, we will embed full mobile swipe responsiveness directly into the tab selectors, execute absolute icon asset parsing, and wire up the secure **Pause Interceptor Confirmation Dialog Box** to prevent state-change crashes.

### **🛠️ Phase 3 Master Prompt: Segmented Pipeline Workspace & Interceptors**

**Copy and paste this exact prompt into Stitch to build Zone 3 and Zone 4:**

### **🚫 \[SCOPE CONTROLLER & LEGACY SUPPRESSION DIRECTIVE\]**

* **Hard Memory Purge Rule:** Continuously suppress, wipe, and garbage-collect all legacy Module 6 Wizard containers (\#create-campaign-wizard) and all generic analytical graphing widgets from active file memory.  
* **Global Layout Frame Alignment:** Maintain the strict inherited framework shell parameters established in Phase 1 (margin-left: 240px; padding-top: 64px; on desktop).  
* **Visibility Logical Rule:** Mount this Zone 3 operational management grid view stream 100% full-width on the canvas. Ensure its layout container mounts directly beneath the Phase 2 Repository baseline.

### **⚙️ ZONE 3: OPERATIONAL MANAGEMENT WORKSPACE PIPELINE**

Build the pipeline management zone using a clear tab-based view switching interface:

#### **1\. SEGMENTED NAVIGATION TAB HEADER BAR**

* **Desktop Layout Frame:** Construct an inline, horizontal segmented track block stretching across the top margin edge of Zone 3\.  
* **Interactive Selector Array:** Render exactly four navigation tabs with the following explicit text string arrays:  
* \[Prospects\] | \[Applicants\] | \[Active Collabs\] | \[Reporting\]  
* **Focus Highlight Rule:** Wrap the currently active focused tab inside an explicit design boundary highlighting it with an Aurora Green underline accent (border-bottom: 2px solid \#22c55e; color: \#111827; font-weight: 600;). Non-focused tabs must rest in a slate-grey state (color: \#64748b;).

#### **2\. ACTIVE VIEW PANEL: PROSPECTS WORKSPACE SHELL**

When the \[Prospects\] tab state focus is active, instantiate these interface elements below it:

* **Headline Group:** Render the header row text exactly as: Active Workstream Pipeline: Prospects. Directly beneath, add the helper context description line verbatim: *"Curated list of potential high-impact creators for this active campaign milestone matrix."*  
* **Filter Utility Controls Assembly Flex Row:** Align three modular filter triggers side-by-side:  
  * \[Dropdown Component: "All Connected Products" ▾\]  
  * \[Dropdown Component: "All Brief Creative Scopes" ▾\]  
  * \[Ghost Style Action Button Component: "Clear Active Filters"\]  
* **Operational Output Table:** Render a clean matrix grid view containing these exact column header structures:  
* Creator Profile Base Info | Archetype Match Score | Estimated Reach Metrics | Workspace Scope Context Tags | Actions Operations Center  
* **Hardened Action Asset Buttons:** Inside each row's 'Actions Operations Center' cell, map exactly two targeted component triggers utilizing explicit font glyph codes:  
  * Button 1 (Ghost Outline Style): \<span class="material-icons" style="font-size:16px; margin-right:4px;"\>add\</span\> Add to Workspace  
  * Button 2 (Muted Standard Style): \<span class="material-icons" style="font-size:16px; margin-right:4px;"\>analytics\</span\> View Profile Analytics

### **🛑 ZONE 4: PIPELINE MODAL INTERCEPTORS (PAUSE INTERCEPTOR DIALOG)**

* **Display Runtime Logic:** Interrupt browser layout processing and mount a fixed interceptor popup confirmation dialog box overlay matching Section 4.0 specifications. This component must fire the exact millisecond any status toggle switch component in Zone 1 or Zone 2 triggers a state transition event from true to false.  
* **Component Card Header Typography:** Title text must read verbatim: Confirm Pipeline Pause for {{ Entity Name }}?  
* **Modal Context Body Typography Paragraphs:** Layout these two text strings cleanly inside a high-contrast modal body frame:  
  * *Paragraph 1:* "All active collaborations and creators currently inside the active production pipeline will not be impacted or terminated by this status modification."  
  * *Paragraph 2:* "However, this {{ Entity Type }} will be hidden from the active public discovery funnel, and new incoming creators will no longer be permitted to view details or apply to its open quotas."  
* **Control Action Footer Layout Matrix:** Position a right-aligned flex row grouping containing exactly two buttons at the base of the modal card:  
  * Button 1 (Solid Red Alert Theme): Confirm Pipeline Pause  
  * Button 2 (Ghost Text Link Style): Cancel Action

### **📱 3\. INLINE MOBILE RESPONSIVE OVERRIDES ($\\le$ 768px)**

The exact instant viewport boundaries evaluate below or equal to $768px$, reflow the components using these rules:

* **Horizontal Swipe Tab Track:** Convert the segmented navigation tab header bar into a single-row horizontal touch-swipe track. Apply an inline mask style: linear-gradient(to right, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%); so the right edge fades elegantly to denote scrollability. Swiping behavior must smoothly snap-center the selected navigation tab.  
* **Table Reflow to Stacked Cards:** Collapse the multi-column operational table grid completely. Transform each row into a distinct, vertically stacked mobile listing card component. Expand action button padding heights to 48px to maximize tap-target accuracy on mobile screens.  
* **Modal Overlay Shield Hardening:** Force the Pause Interceptor confirmation pop-up card to center perfectly over the mobile screen layout (width: 90%; max-width: 340px; margin: auto; padding: 20px; border-radius: 12px; z-index: 2000;) with a deep dim background backdrop overlay to isolate user actions.

Recompile Phase 3 with these operational pipeline elements and modal dialogs now."  
Once Stitch finishes generating this workspace, check your tab layouts and test flipping the toggle switches to see the pause interceptor modal load cleanly into place. Let me know when the build is complete, and we will move to our final deployment: **Phase 4 (The Universal Share Link Router Modal Overlay Sheet)**\!

We are now advancing to **Phase 4: Sub-Module 2A Universal Share Link Router Modal Overlay Sheet**.  
Based on our established design guidelines, this prompt includes a rigorous structural firewall bracket to completely suppress background layers. It enforces a 50/50 split-panel matrix on desktop, hooks up dynamic real-time URL generation, ensures clean icon asset parsing to eliminate plain-text leaks, and includes embedded mobile touch overrides right out of the box.

### **🛠️ Phase 4 Master Prompt: Independent Overlay Layer & Dynamic Template Channels**

**Copy and paste this exact prompt into Stitch to build the Universal Share Link Router:**

### **🚫 \[SCOPE CONTROLLER & BACKGROUND INTERACTION SUPPRESSION DIRECTIVE\]**

* **Hard Memory Purge Rule:** Continuously suppress, wipe, and garbage-collect all legacy Module 6 Wizard containers (\#create-campaign-wizard) and any unrelated performance metrics blocks from active memory.  
* **Isolated Scope Overlay Sheet Rule:** Mount this sub-module container **exclusively** when the system variable flag evaluates to isRouterOverlayActive \=== true.  
* **Defensive Backdrop Window Lock:** When active, enforce a fixed window viewport scroll lock overlay layer (position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(17, 24, 39, 0.6); backdrop-filter: blur(4px); z-index: 1500;). Temporarily disable all click, hover, and scroll interaction events on the underlying Module 2 main campaign management page shell to prevent layout stacking bugs.

### **🔗 SUB-MODULE 2A: UNIVERSAL CAMPAIGN SHARE ROUTER OVERLAY**

Build the independent overlay card panel with a clean dual-column workspace layout:

#### **1\. MODULE HEADER OVERLAY BLOCK**

* Left-align the category section title exactly as: Universal Campaign Share Router inside an H2 typography weight class.  
* Directly beneath it, append the muted descriptive sub-headline helper text verbatim: *"Generate customized deep-links or universal recruitment portals to onboard external creators into your execution pipeline."*

#### **2\. COLUMN SPLIT PANEL MATRIX (Desktop Viewport Configuration \> 768px)**

Render the workspace utilizing a split flex layout divided exactly into a **50% Column 1 / 50% Column 2** row matrix:

* **A. COLUMN PANEL 1 WORKSPACE: OPPORTUNITY SCOPING FILTER (50% Width)**  
  * *Reactive Constraint Rule:* Changing any configuration drop-down values inside this column must instantly recalculate and update variables in Column Panel 2 without page refreshes or intermediate actions.  
  * **Selector 1: Target Product Asset**  
    * Top Field Label Typography: "Select Target Product"  
    * Default Selected State: Render a true graphic globe icon asset \<span class="material-icons" style="font-size:16px; margin-right:6px;"\>public\</span\> accompanied by the string: "All Connected Products (Master Campaign Hub Link)".  
    * Dynamic Option Loop Template: \[Product Thumbnail Image Asset\] {{ Product Name }} (Retail Allocation Value: ${{ Base Price }}).  
  * **Selector 2: Targeted Creative Brief Strategy**  
    * Top Field Label Typography: "Select Associated Strategy Brief"  
    * *Automated Input Constraint:* Enforce a disabled, faded styling state (Opacity: 0.35, layout cursor: not-allowed) if Selector 1 equals the "All Connected Products" string. Instantly unlock the component when a specific standalone product SKU is assigned, populating choice paths matching its parent dataset.  
    * Default Selected State: Render a true graphic target icon asset \<span class="material-icons" style="font-size:16px; margin-right:6px;"\>track\_changes\</span\> followed by text string: "All Active Briefs Linked to {{ Selected Product Name }}".  
    * Dynamic Option Loop Template: \[Pill Badge Component: {{ Deliverable Type Enum }}\] {{ Brief Name }}.  
* **B. COLUMN PANEL 2 WORKSPACE: OUTBOUND ROUTER & MESSAGING PREVIEW (50% Width)**  
  * **Container Box 1: Secure Link Destination Component**  
    * Render a masked, read-only text input field bar displaying the live compiled target URL:  
      * *Rule 1:* If Selector 1 \=== 'All Connected Products' ➔ Return URL string: "https://app.aura.io/c/{{ campaign\_id }}".  
      * *Rule 2:* If Selector 1 is specific AND Selector 2 \=== 'All Active Briefs' ➔ Return URL string: "https://app.aura.io/c/{{ campaign\_id }}?p={{ product\_id }}".  
      * *Rule 3:* If Selector 1 is specific AND Selector 2 is specific ➔ Return URL string: "https://app.aura.io/c/{{ campaign\_id }}?p={{ product\_id }}\&b={{ brief\_id }}".  
    * Micro Inline Copy Element: Append an absolute parsed icon action trigger inside the right margin bounds of the URL bar: \<span class="material-icons" style="cursor:pointer;"\>content\_copy\</span\>. Clicking it updates a state transition mutation to cleanly swap out the graphic to \<span class="material-icons" style="color:\#22c55e;"\>check\_circle\</span\> alongside a temporary badge reading "Copied\!".  
  * **Container Box 2: Platform Channels Segmented Bar**  
    * Position 3 horizontal selection tabs side-by-side using these clean icon asset parameters:  
      * Tab 1 ➔ \<span class="material-icons" style="margin-right:6px;"\>chat\</span\> WhatsApp Channel  
      * Tab 2 ➔ \<span class="material-icons" style="margin-right:6px;"\>photo\_camera\</span\> Instagram Direct  
      * Tab 3 ➔ \<span class="material-icons" style="margin-right:6px;"\>mail\_outline\</span\> Corporate Email  
  * **Container Box 3: Live Template Text Preview Canvas**  
    * Dynamic Rule: Recompile text paragraphs instantly when focus switches between the platform tabs:  
      * *WhatsApp Focus Active:* Sub-strip text reads: *"Text format configuration is optimized for direct short-form responsive messaging application stream blocks."* Text area body populates exactly as: "Hey\! I'm {{ Brand Manager Name }} from {{ Brand Name }}. We've launched a new creator activation for {{ Selected Product/Brief Scope Identifier }} and based on your profile aesthetic, we think you'd be a great match. Check out our campaign expectations and check your compliance/payout metrics eligibility here: {{ Generated Destination URL }}" CTA primary green block button reads exactly: Copy Text & Launch WhatsApp Chat Web ↗.  
      * *Instagram Focus Active:* Sub-strip text reads: *"Copy message template strips trailing white-spaces and utilizes high-impact, mobile-friendly inline breaks."* Text area body populates exactly as: "Hey \[Creator Handle\] \! Love your content theme alignment ✨. We just opened up an exclusive invite-only creator brief for our {{ Product Name }}. Thought your styling profile was a perfect match\! You can view the creative brief hooks, check your baseline eligibility matrix, and lock in your milestones contract tracking here: {{ Generated Destination URL }}" CTA primary green block button reads exactly: Copy Text & Launch Instagram Web DM ↗.  
      * *Corporate Email Focus Active:* Field prefix label reads: "Subject Line: Collaboration Invite: {{ Brand Name }} × \[Creator Profile Name\]". Text area body populates exactly as: "Hi \[Creator Profile Name\], \\n\\nWe’ve been following your recent content work and love your dedicated creator approach. We are currently hosting an exclusive campaign opportunity for our {{ Product Name }} asset pipeline. \\n\\nWe would love to invite you to join our creator community ecosystem. Complete details regarding creative guidelines, deliverables, usage rights, and milestones can be securely accessed via the onboarding terminal below: \\n\\n{{ Generated Destination URL }} \\n\\nBest regards, \\n{{ Brand Manager Name }} \\n{{ Brand Name }}" CTA primary green block button reads exactly: Open Default Native Mailer Client ↗.

#### **3\. OVERLAY STICKY FOOTER ACTION BASELINE**

Construct a persistent footer panel row at the base edge of the modal card box layout:

* **Left Side Layout Content:** Ghost button trigger ➔ Mapped to action reset\_router\_dropdowns ➔ Label text string reads exactly: Reset Dropdown Scopes.  
* **Right Side Layout Controls (Flex Row side-by-side):**  
  1. Button 1 (Secondary Outlined Framework Style): Bound to action close\_router\_overlay ➔ Label text string reads verbatim: Clear & Close Panel.  
  2. Button 2 (Solid Brand Theme Aurora Green Accent): Bound to action master\_execute\_copy\_inject ➔ Label text string reads verbatim: Master Copy & Inject Tab Route.

### **📱 4\. INLINE MOBILE ADAPTABILITY SCHEMAS ($\\le$ 768px)**

The exact millisecond screen width view metrics resolve below or equal to $768px$, reflow the overlay sheet tree:

* **100% Full-Width Stacking:** Collapse the 50/50 split-panel matrix into a single vertical stacked track panel list card view layout. Force product filters and dropdown items to expand to full container width ($100\\%$).  
* **Touch Channel Selector Bar:** Transform the channel tabs into a swipeable, high-density compact row tracking three square-proportion action anchor buttons labeled exactly: \[ WA \], \[ IG \], and \[ Mail \]. Frame the active selected anchor inside an explicit Aurora Green focus border line.  
* **Compressed Text Box Excerpt:** Scale down the live text template box preview into a 3-line excerpt string snippet layout. Tapping anywhere inside this box boundary instantly registers a background clipboard copy macro trigger event.  
* **Sticky Mobile Action Callout Bar:** Unmount the multi-button footer layout row. Replace it with a single, full-width block action button pinned stubbornly to the base edge of the mobile screen viewport tracking exactly as: \[Copy Message & Open App Platform\].

Recompile Phase 4 to instantiate the Universal Share Link Router Modal Sheet now."  
Once Stitch finishes processing this final overlay sheet blueprint, your entire **Module 2 Architecture**—from the Campaign Shell Header and nested repositories down to the deep-link platform routers—will be fully operational, secure, and ready for production on both desktop and mobile platforms.  
Run this build pass and drop a confirmation or share a screenshot once the compilation successfully finishes\!

# s- add product

🚫 \[SYSTEM ARCHITECT: MODULE 2B ADD PRODUCT \- PHASE 1 MOUNTING & DATABASE INTERCEPTOR\]  
\- Use your active Campaign Page UI and the Add a Product PRD as the absolute source of truth.  
\- STRICT BASE CANVAS PRESERVATION: Do not alter, duplicate, or drop any pre-existing elements on the main Campaign Page workspace (Top navigation, headers, share button, carets, or the lower 4 interaction tabs). All baseline structures must remain active and untouched.  
\- Continuously suppress and unmount all legacy Module 6 Wizard containers (\#create-campaign-wizard).

Execute the Phase 1 pass to anchor the right side-drawer frame and mount the validated classification selector:

📌 1\. CANVAS HOUSING & ENTRY STATE MACHINE  
\- Anchor the entry point directly to the existing Zone 2 element: '+ Add New Product Portfolio'.  
\- Interaction Hook: Clicking this button sets state variable \[isAddAssetDrawerOpen \= true\].  
\- Render Rule: Mount and slide open a 400px fixed vertical workspace drawer container frame from the right viewport boundary if and only if \[isAddAssetDrawerOpen \=== true\].  
\- State Void Handling (State A): When initialized and \[selectedAssetType \=== null\], render only the Breadcrumbs ("Campaigns ──► {{ campaign\_name }} ──► Link Asset"), Title ("Link Campaign Asset"), and Context Summary Card. Hide all downstream accordions and footer saving elements from the active DOM.

📌 2\. LIVE BRAND CENTRE INVENTORY AVAILABILITY CHECKER  
\- Before populating the classification dropdown options, intercept the local state and run a reactive lookup against your master Brand Centre data registry.  
\- Enforce Dynamic Filter Rule: Query the active inventory item count arrays for the current business track. If a specific asset classification sub-category (e.g., Collections, individual SKUs, or Promotion schemes) contains exactly 0 entities registered in the backend database, instantly suppress and remove that option choice from the dropdown select list menu wrapper layout.

📌 3\. MOUNT DROPDOWN SPECIFIER WITH CORRECTION OPTIONS  
\- Output the clean input label: "Target Asset Classification".  
\- Map the classification dropdown to contain exactly two structural parent option pathways based on availability results: "Core Brand Portfolio" (Sets state: 'BRAND\_PORTFOLIO') and "Sale / Promotion Scheme" (Sets state: 'PROMOTION\_SCHEME').  
\- Autocomplete Lookup Trigger: Render a searchable autocomplete input field row below the dropdown. Typing searches available items; selecting a valid result assigns the object to \[selectedAssetEntity \= chosen\_metadata\] and transitions the layout tree instantly to State B.

Finalize this anchoring layer and wait for entity hydration inputs.  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

🚫 \[SYSTEM ARCHITECT: MODULE 2B ADD PRODUCT \- PHASE 2 CONTENT ACCORDIONS & CONTROLS\]  
\- Operate completely inside the active right-side drawer frame established in Phase 1\. Do not modify the underlying Campaign canvas view parameters.  
\- Maintain strict synchronization with your UI copy specifications, text strings, and layout headers verbatim.

Execute the Phase 2 pass to mount conditional accordions and saving guardrails across State B layout viewports:

📌 1\. PLAY ENTRY LIFE-CYCLE SHIMMER TRANSITION  
\- The exact millisecond \[selectedAssetType \!== null\] and \[selectedAssetEntity \!== null\] evaluate to true, freeze form inputs and display a localized 300ms layout card skeleton loading shimmer animation stream across the lower panel layout space before mounting components.

📌 2\. COMPILE ACCORDION CONDITIONAL BRANCH 1 (CORE PORTFOLIO)  
If \[selectedAssetType \=== 'BRAND\_PORTFOLIO'\], sequentially mount these 4 collapsible flat content accordion cards down the tree:  
\- 🛡️ Accordion 1: Asset Core Specs & Media Repository: Render title string verbatim. Include "Sourced Asset Descriptor: {{ Product Name }}", a 1:1 square image viewport showing product\_thumbnail\_image, and bullet lists mapping brand hook values.  
\- 📦 Accordion 2: Inventory Mapping & Variant Scoping: Render a dynamic selection grid list featuring a row checkbox selector beside every individual SKU node item. Toggling checkboxes must append or pull keys from reactive array state \[selectedSKUBundlesArray\]. Instantly recalculate the adjacent metrics label reading: "SKUs Tagged: {{ SKU Code }} | Total Volume Available: {{ inventory\_count }}" to summary only checked nodes.  
\- ⚖️ Accordion 3: Creative Compliance Guidelines & Guardrails: Render locked legal policy paragraphs and forbidden script lists.  
  • Form Override Interaction: Clicking \[Button: Unlock Custom Overwrite 🔓\] sets state \[isCustomOverwriteUnlocked \= true\]. On true, immediately transform the static text blocks into active, editable \`\<textarea\>\` rich input fields and reveal the validation error subtext string.  
  • Drop-Zone Binder: Wire the Drag & Drop File Uploader container frame to store files to state \[uploadedComplianceFile\]. When populated, render a green verification badge component reading: "✔️ {{ file\_name }} Successfully Attached to Asset Metadata Tracking".  
\- ⚙️ Accordion 4: Distribution Logistics & Creator Sample Allocation: Output routing carrier dropdown fields, numerical limit inputs, and an inline live calculation tracking row text reading: "Estimated Logistical Expense Runway: Limit Amount × Base Price \= Max Logistics Overhead Allocated: ${{ calculated\_overhead\_value }} USD".

📌 3\. COMPILE ACCORDION CONDITIONAL BRANCH 2 (PROMOTION TRACKS)  
If \[selectedAssetType \=== 'PROMOTION\_SCHEME'\], completely clear the product cards from the active DOM and mount this alternate 3-part accordion block configuration instead:  
\- 🏷️ Accordion 1 Alternate: Promotion Scheme Ruleset & Voucher Core Metadata: Output promotional details, dynamic discount multipliers, and validity date tracking rows.  
\- 🔒 Accordion 2 Alternate: Redemption Ceilings & Scale Caps: Output global safety ceiling caps alongside per-creator voucher distribution balance allowance thresholds.  
\- ⚖️ Accordion 3 Alternate: Regulatory Advertising Compliance Controls: Output text rows verbatim highlighting mandatory \#Ad disclosure overlay safe-zone parameters.

📌 4\. MOUNT PERSISTENT CONTROL FOOTER BAR  
Lock a horizontal button panel to the absolute bottom margin edge of the drawer container containing exactly two elements:  
\- Left Action (Width 35%): \[Button: Discard Selection\] styled using a flat neutral outline profile. Tapping flushes autocomplete look-ups, sets \[isAddAssetDrawerOpen \= false\], and collapses panel framework coordinates.  
\- Right Action (Width 65%): \[Button: Link to Pipeline\] styled using a solid brand Aurora-Green fill. Final Guardrail: Compile this element as completely disabled with a 'not-allowed' cursor token wrapper IF AND ONLY IF the tracked array length of \[selectedSKUBundlesArray\] equals 0\.

Verify form interactivity, bind structural metrics to checkboxes natively, and lock the complete Phase 2 pass.  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

🚫 \[SYSTEM ARCHITECT: MODULE 2B ADD PRODUCT \- PHASE 3 RUNTIME POLYMORPHIC TOKEN BINDING\]  
\- Reference your active unified PRD cross-industry matrix block as the non-negotiable source of truth.  
\- Do not split or break any form state structures, check box arrays, or overlay triggers built in previous passes.

Execute the Phase 3 finalization pass to inject dynamic industry runtime overrides across all text nodes inside the active asset linking drawer:

📌 1\. BIND TO PARENT CONTEXT SPECIFIER CONTROLLERS  
\- Configure the asset drawer panel tree to continuously listen and respond to the global environment context state variable \[industry\_sector\] ('D2C\_ECOMMERCE' | 'HEALTHCARE' | 'AI\_SAAS' | 'OFFLINE\_EXPERIENCES') broadcasted by the primary Campaign workspace shell.  
\- On change, intercept the string arrays of the Phase 1 dropdown elements and the Phase 2 accordion metrics rows to execute sector-specific real-time text switches:

📌 2\. EXECUTE RUNTIME TEXT AND VIEWPORT SWITCHING RULES  
\* A. If \[industry\_sector \=== 'HEALTHCARE'\]:  
  \- Dropdown Option Overrides: Remap Option 1 text to "Core Medical/Treatment Portfolio" and Option 2 text to "Authorized Co-pay / Assistance Scheme".  
  \- Accordion 1 & 2 Overrides: Convert title headers to show "Medical Treatment / Protocol". Replace the standard 1:1 image box with a \[16:9 Clinical Packaging Frame / Image Thumbnail\].  
  \- Accordion 3 Compliance: Overwrite guidelines with "FDA Warning Disclaimers Required" text instructions.  
  \- Accordion 4 Operations: Convert data endpoints to render \[Registered Clinic Location Link\] and \[Secure Patient Intake Webhook\].

\* B. If \[industry\_sector \=== 'AI\_SAAS'\]:  
  \- Dropdown Option Overrides: Remap Option 1 text to "Core Software Module Portfolio" and Option 2 text to "License Credit / Sandbox Promotion Scheme".  
  \- Accordion 1 & 2 Overrides: Convert headers to show "Software Module / Tier". Replace image frame with an active \[Code Component Layout Sandbox / Dashboard Graphic\].  
  \- Accordion 3 Compliance: Overwrite guidelines with "Data Privacy Protection Rules" and mask API server tokens.  
  \- Accordion 4 Operations: Convert data endpoints to render \[Sandbox Activation Endpoint\] and \[Developer Integration Path\].

\* C. If \[industry\_sector \=== 'OFFLINE\_EXPERIENCES'\]:  
  \- Dropdown Option Overrides: Remap Option 1 text to "Core Venue / Activation Portfolio" and Option 2 text to "Ticketing Tier / Booking Access Scheme".  
  \- Accordion 1 & 2 Overrides: Convert headers to show "Venue Location / Experience". Replace thumbnail box with a wide-angle \[Venue Space Visual Box Container\].  
  \- Accordion 3 Compliance: Overwrite guidelines with "Crowd Control Privacy Rules" and mount liability waiver blocks.  
  \- Accordion 4 Operations: Convert data endpoints to render \[Geo Coordinate Street Address\] and \[Booking Reservation Terminal\].

Re-compile all industry token branches, verify dynamic text re-mapping, and complete the Phase 3 matrix build now.  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

🚫 \[SYSTEM ARCHITECT: MODULE 2B ADD PRODUCT \- PHASE 4 MOBILE MODAL SHEETS & RESPONSIVENESS\]  
\- Reference your design system mobile overlay guidelines as the non-negotiable directive rule.  
\- STRICT CANVASS PRESERVATION POLICY: Do not touch or modify the parent mobile menu header, campaign descriptions, nested tables, or the 4 footer tabs (Prospects, Applicants, Selected, Shared) compiled on the base layout.

Execute the Phase 4 finalization pass to inject responsive layout overrides at the 768px screen breakpoint boundary:

📌 1\. MORPH DRAWER LAYOUT INTO SWIPEABLE FIXED MODAL OVERLAY SHEET  
\- When browser viewports measure ≤ 768px, unanchor the panel from the desktop right-side coordinate tracking plane.  
\- Morph the container wrapper into a fixed full-screen modal overlay sheet component sliding up from the bottom boundary line (width: 100vw; height: 100vh; position: fixed; z-index: 2500; background: \#ffffff;).  
\- Inject Fixed Modal Close Anchors: Mount a persistent sticky navigation bar at the top edge of the mobile overlay sheet featuring a clear \`\[Close Icon: ✕\]\`. Tapping this icon must cleanly force reset \[isAddAssetDrawerOpen \= false\] to dismiss the sheet view.

📌 2\. OPTIMIZE INITIALIZATION LIFECYCLES FOR VERTICAL REAL ESTATE  
\- To prevent mobile scroll clipping or touch layout breaking, override accordion default view settings: under mobile bounds, Accordions 1 through 4 must always initialize in a completely collapsed state by default.   
\- Mount a functional accordion fold indicator caret \`\[Icon: Caret Down / Caret Up\]\` right next to section headers to manage smooth, touch-responsive slide-open transitions.

📌 3\. RE-SCALE MOBILE COMPACT STICKY FOOTER ACTIONS  
\- Lock a persistent horizontal navigation bar to the absolute bottom edge of the mobile sheet window container, safely positioned above native mobile browser control zones:  
  • Left Action Component (Width 35%): \[Button: Discard Selection\] styled compactly as a flat neutral outline touch target. Tapping flushes autocomplete look-ups and sets \[isAddAssetDrawerOpen \= false\].  
  • Right Action Component (Width 65%): \[Button: Link to Pipeline\] scaled up across the remaining layout width and wrapped in your solid brand Aurora-Green color token. Maintain the active validator block: keep pointer-events disabled and reduce opacity to 0.40 until an item checkbox inside Section 2 is verified as checked true on the touchscreen.

Compile these mobile overlay rules, patch touch gestures to eliminate pointer errors, and complete your asset linking drawer system optimization now.  
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

