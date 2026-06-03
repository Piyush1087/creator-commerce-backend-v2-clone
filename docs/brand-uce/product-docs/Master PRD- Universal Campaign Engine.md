# **MASTER PRODUCT REQUIREMENT DOCUMENT (PRD)**

## **SYSTEM LOGIC ARCHITECTURE: UNIVERSAL CAMPAIGN WORKSPACE ENGINE**

**Document Version:** 4.0.0-PROD  
**Target Core Modules:** Campaign List, Management Shell, Add Product, Add Brief, Prospects, Applicants, Active Collabs, Reporting Tab, Create Campaign Wizard  
**System Classification:** High-Trust Automations, Multi-Tenant Escrow, API Stateful Engine

## **1.0 ARCHITECTURAL FRAMEWORK & LAYOUT SYSTEM (THE SHELL)**

### **1.1 Core Three-Zone Accordion-Focus Framework**

The Campaign Management Workspace uses an adaptive layout pattern designed to manage intense data density without overwhelming the user. The primary desktop view isolates core campaign parameters into three structural nesting tiers that scale fluidly:  
\+---------------------------------------------------------------------------------------+  
|  UNIVERSAL HEADER: Breadcrumbs | Global Status Toggle | \[LIVE\] | Save State Tracking    |  
\+---------------------------------------------------------------------------------------+  
|  ZONE 1: CAMPAIGN MASTER (STRATEGY ACCORDION)                               \[Collapse\] |  
|  Name: Summer Splash | Budget: $50,000 | Objective: Conversion | Timeline: Fixed Range |  
\+---------------------------------------------------------------------------------------+  
|  ZONE 2: PRODUCT & BRIEF (TACTICS ACCORDION)                                \[Collapse\] |  
|  Products: 3 Loaded SKUs | Briefs: 2 Dynamic Frameworks (Reels / TikTok Videos)     |  
\+---------------------------------------------------------------------------------------+  
|  ZONE 3: OPERATIONAL WORKSPACE (EXECUTION PIPELINE MODULES)                           |  
|  \+---------------------------------------------------------------------------------+  |  
|  | \[Prospects Tab\]  |  \[Applicants Tab\]  |  \[\*Active Collabs\*\]  |  \[Reporting Tab\] |  |  
|  \+---------------------------------------------------------------------------------+  |  
|  | FILTERS: \[ Briefs v \] \[ Stages v \] \[ Health v \]              \[ Search Handle... \]  |  
|  |                                                                                    |  |  
|  |  \[x\] CREATOR       | MATCH | STATUS/MILESTONE          | AD AUTHORIZATION KEYS     |  |  
|  |  \--------------------------------------------------------------------------------  |  
|  |  \[ \] @clara\_vibe   |  94%  | STAGE\_4\_CONTENT\_REVIEW     | \[Copy Spark Code\]         |  |  
|  \+---------------------------------------------------------------------------------+  |  
\+---------------------------------------------------------------------------------------+

* **Zone 1: Campaign Master (Strategy):** High-level global settings. Houses the master campaign objective, total budget allocation pools, and chronological boundaries. It remains collapsed by default once initial setup concludes to prioritize execution.  
* **Zone 2: Product & Brief (Tactics):** Handles physical fulfillment and instructions. Manages linked inventory items, custom retail values, and structural criteria for briefs.  
* **Zone 3: Creator Pipeline (Execution):** The core tracking workspace. Houses the dynamic 4-tab workflow (**Prospects**, **Applicants**, **Active Collabs**, **Reporting**). It expands to fill available vertical space while Zone 1 and Zone 2 condense into read-only summary headers.

### **1.2 Layout Isolation & Shell Rules**

* **Universal Sidebar Integration:** The interface mounts within a permanent left-aligned workspace navbar (Desktop width: 80px, Dark-themed \#0F172A). It operates independently of the canvas rendering layout, preventing route transitions from recalculating parent navigation trees.  
* **State-Preserving Tab Switches:** Moving between tabs within Zone 3 must never trigger full network refetches or clear UI filter states. Tab states remain cached in local app memory to allow instant back-and-forth comparison.  
* **Mobile Viewport Collapsing Protocols ($\\le 768\\text{px}$):**  
  * Zone 1 and Zone 2 automatically hide behind a top-bar contextual summary badge list.  
  * Data tables transform into vertical touch cards with swipe-to-action gestures.  
  * Primary action configurations (such as approvals, rejections, or contract distribution) lock into a fixed sticky footer container to prevent scrolling fatigue.

## **2.0 WORKSPACE MODULES SPECIFICATIONS**

### **MODULE 1: CAMPAIGN LIST ENGINE**

* **Functional Objective:** Serve as the high-density analytical dashboard for cross-campaign health verification, performance tracking, and direct creation routing.  
* **Visual Architecture & Components:**  
  * *High-Level Aggregates Strip:* Highlights total active spend across campaigns, gross delivered impressions, and pipeline bottlenecks.  
  * *Search & Categorization Module:* Features quick filters for campaign objective categories, lifecycle statuses (DRAFT, ACTIVE, PAUSED, COMPLETED), and keyword search.  
  * *High-Density Campaign Inventory Grid:* A data list tracking individual campaigns. Rows surface linked products, active creator counts split by pipeline lifecycle states, live aggregate engagement indices, and progress bars matching actual spend to budget pools.  
* **Interactive Controls & Gateways:**  
  * \[Button: Create New Campaign\]: Initializing this control redirects the user to the 3-step creation wizard.  
  * \[Row Trigger\]: Clicking anywhere on an existing campaign entry focuses the workspace view and opens the target Campaign Page Shell.

### **MODULE 2: CAMPAIGN MANAGEMENT PAGE SHELL**

* **Functional Objective:** Act as the command framework for individual campaigns, providing global status control and loading state management.  
* **Visual Architecture & Components:**  
  * *Context Navigation Header:* Tracks path mapping across nested views via dynamic breadcrumbs: Campaigns ──► {{ campaign\_name }}.  
  * *Global Status Interface:* Features a prominent status toggle tracking states (ACTIVE, PAUSED). It includes an indicator badge that pulses green (\#22C55E) when active and changes to amber (\#F59E0B) when paused.  
* **State Control Logic:**  
  * **Pause State Logic:** Flipping the global switch to PAUSED automatically disables all inbound public application links and landing pages linked to the campaign. It surfaces a warning banner stating: *"Campaign Paused. Inbound application links are offline. Active collaboration workflows remain accessible for processing."*  
  * **Active Activation Checks:** Transitioning a campaign from DRAFT to ACTIVE checks that the campaign has at least one validated product SKU, one active brief configuration, and sufficient funding in the escrow pool. If validation fails, the change is blocked and a checklist modal highlights the missing criteria.

### **MODULE 3: ADD A PRODUCT MODULE**

* **Functional Objective:** Embed inventory management directly into the campaign workspace to track physical goods fulfillment and D2C product seed tracking.  
* **Visual Architecture & Components:**  
  * *Product Definition Workspace:* A split panel setup. The left side handles configuration inputs (Product Name, Unique SKU Number, Total Inventory Allocation, and Wholesale/Retail Value Fields). The right side features a drag-and-drop image media uploader.  
* **System Validation Logic:**  
  * **Duplicate SKU Protection:** The system checks inputted SKU strings against the database in real time. If a conflict is detected within the active brand profile, it flags an inline warning: *"This SKU is already tied to an active product structure. Please enter a unique identifier."*  
  * **Inventory Depletion Logic:** Every time an applicant is approved in the pipeline, the system claims one unit from the matching allocation pool. If the inventory reaches zero, the platform marks the product as OUT\_OF\_STOCK and automatically surfaces a warning label next to linked briefs: *"Fulfillment Halted: Inventory depleted. Allocate additional stock to resume automated shipping tracking."*

### **MODULE 4: ADD A BRIEF MODULE**

* **Functional Objective:** Allow brand managers to define clear creative requirements, channel targets, usage rights parameters, and compensation terms.  
* **Visual Architecture & Components:**  
  * *Creative Guidelines Panel:* Structured rich text fields capturing content requirements, mandatory hooks, and banned phrases.  
  * *Deliverable Matrix Picker:* Toggles for channel mapping (INSTAGRAM, TIKTOK, YOUTUBE) matched to content format selectors (e.g., Reels, Stories, Carousels, Shorts).  
  * *Legal Framework Builder:* Fields for defining distribution usage rights parameters (e.g., Whitelisting Windows, Spark Ads Authorization requirements, Organic Reposting Permissions).  
* **System Validation Logic:**  
  * **Usage Window Checks:** Setting licensing or boosting rights options requires defining an explicit active window duration (e.g., 30, 60, or 90 days). The interface enforces this with a validation rule: if a right is checked, its duration input cannot be left blank.

### **MODULE 5: THE EXECUTION WORKSPACE PIPELINE (FOUR-TAB DASHBOARD)**

#### **TAB A: PROSPECTS**

* **Functional Objective:** Manage outbound outreach discovery, handle Meta integrations cleanly, and control automated outbound communication vectors.  
* **Visual Architecture & Components:**  
  * *Meta Marketplace Sync Hub:* A conditional integration panel. If the brand's profile lacks an active OAuth token, the workspace hides the discovery feed and displays a dark card layout with a prominent connection trigger: \[Button: Connect Facebook\]. This panel features verified trust tags stating: OFFICIAL META BUSINESS PARTNER | SECURE OAUTH PROTOCOL.  
  * *Prospecting Overview Strip:* Surfaces high-level funnel metrics tracking total invitations distributed, click-through rates on outreach links, and remaining daily outreach balance allocations.  
  * *Curated Discovery List Grid:* A clean data table that ranks potential creators. Surfaces key evaluation points including avatar details, channel handles, calculated match scores, geographic concentrations, vertical alignment tags, and performance metrics.  
* **Interactive Controls & Communication Payloads:**  
  * \[Button: Send Priority DM\]: Opens a modal for a direct message on Instagram. Includes a rich text box with AI-assisted template tokens ({{handle}}, {{campaign\_name}}, {{secure\_link}}).  
  * \[Button: Send Email\]: Triggers a Gmail redirect popup with populated email parameters (to:, subject:, body:).  
  * **The 20-Word Preview Rule:** To prevent truncation in mobile notification trays, the system limits outreach templates to 20 words. An automated counter enforces this length boundary, and the primary send button remains locked if the input text overflows.

#### **TAB B: APPLICANTS**

* **Functional Objective:** Vet inbound influencer profiles, cross-reference audience metrics against campaign criteria, and handle approvals or rejections cleanly.  
* **Visual Architecture & Components:**  
  * *Vetting Overview Analytics Bar:* Displays aggregate data metrics including inbound applicant volumes, mean campaign alignment metrics, and profiles awaiting review.  
  * *Applicants Operational Grid Table:* A high-density data matrix featuring batch selection checkboxes, creator identities, dynamic algorithmic match scores, linked product briefs, and uploader notes.  
  * *The Contextual Slider Drawer Overlay:* Triggered by clicking an entry's inspection icon (\[Eye\]), this overlay slides out from the right side of the screen. It organizes detailed insights into clear, collapsible sections:  
    * *Section 1: Performance Matrix:* Tracks platform statistics like historical engagement metrics and verified follower ranges.  
    * *Section 2: Vetting Criteria Check:* Displays automated green or red validation checkmarks comparing target criteria against creator demographics.  
    * *Section 3: Content Portfolio Stream:* A 3x3 interactive media thumbnail grid. Hovering over a thumbnail previews the muted asset file.  
* **System Workflow Actions:**  
  * \[Button: Approve Creator\]: Triggers an automation that locks the creator into the project pipeline, marks them as active, and automatically sends a secure portal registration link via DM or email.  
  * \[Button: Decline Application\]: Opens an inline selection menu requesting a rejection reason (Aesthetic Fit, Vetting Mismatch, High Quote). Collecting this feedback trains future AI search recommendations.

#### **TAB C: ACTIVE COLLABS (THE ENGINE CORE)**

* **Functional Objective:** Track live, milestone-based influencer management workflows across a synchronized 6-stage lifecycle state machine.  
* **Visual Architecture & Components:**  
  * *Production Overview Strip:* A high-level pipeline tracking component displaying active partner volume data divided across core operational milestones.  
  * *Pipeline Operational Grid Table:* Tracks live workflows across clear, distinct columns: batch selection checkboxes, creator channel indicators, active brief specifications, and a visual progress indicator tracking the 6-stage milestone path.  
* **The 6-Stage Milestone Lifecycle Matrix:**

\+-------------------------------------------------------------------------------------------------------------------------+  
|                                    THE SYNCED 6-STAGE MILESTONE STATE MACHINE                                           |  
\+============================+===========================+============================+===================================+  
| LIFECYCLE STAGE            | SUB-STATE STATUS LABELS   | PRIMARY SYSTEM ACTIONS     | TECHNICAL CORE ENFORCEMENT RULES  |  
\+============================+===========================+============================+===================================+  
| 1\. STAGE\_1\_NEGOTIATION     | BRAND\_COUNTER,            | \`\[Review Proposal\]\`        | Max 2 counter-offers per party.   |  
|                            | CREATOR\_COUNTER           |                            | Exceeding this locks negotiation. |  
\+----------------------------+---------------------------+----------------------------+-----------------------------------+  
| 2\. STAGE\_2\_SECUREMENT      | AWAITING\_FUNDING,         | \`\[View Contract\]\`          | Requires 100% brand funding.      |  
|                            | AWAITING\_SIGNATURE        |                            | Triggers 30/70 escrow lock.       |  
\+----------------------------+---------------------------+----------------------------+-----------------------------------+  
| 3\. STAGE\_3\_LOGISTICS       | AWAITING\_DISPATCH,        | \`\[Add Tracking\]\`           | If product is D2C, tracking ID is |  
|                            | IN\_TRANSIT                |                            | mandatory to advance stage.       |  
\+----------------------------+---------------------------+----------------------------+-----------------------------------+  
| 4\. STAGE\_4\_CONTENT\_REVIEW  | INITIAL\_DRAFT\_SUBMITTED,  | \`\[Review Content\]\`         | 72-hour auto-approval clock. Max  |  
|                            | REVISION\_ROUND\_ACTIVE     |                            | 2 revision rounds before lockout. |  
\+----------------------------+---------------------------+----------------------------+-----------------------------------+  
| 5\. STAGE\_5\_PUBLISHING      | AWAITING\_LIVE\_POST,       | \`\[Release Payout\]\`         | Automated API verification of live|  
|                            | COMPLIANCE\_CHECK\_ACTIVE   |                            | link & compliance requirements.   |  
\+----------------------------+---------------------------+----------------------------+-----------------------------------+  
| 6\. STAGE\_6\_FEEDBACK\_SYNC   | PENDING\_FEEDBACK          | \`\[Give Feedback\]\`          | Generates archival record and     |  
|                            |                           |                            | appends rating scores.            |  
\+----------------------------+---------------------------+----------------------------+-----------------------------------+

#### **TAB D: REPORTING**

* **Functional Objective:** Aggregate multi-channel campaign return on investment insights, compile performance analytics data streams, and showcase high-performing assets.  
* **Visual Architecture & Components:**  
  * *Dynamic Metrics Strip:* Context-aware card array that reconfigures to track metrics matching the primary campaign objective:  
    * *Awareness:* Tracks Total Spend, Views/Impressions, Reach, and calculated CPM/CPE metrics. Includes an Earned Media Value indicator.  
    * *Traffic:* Displays Link Clicks, Unique CTR, and CPC ratios.  
    * *Conversions:* Highlights Pixel Sales Revenue, Conversion Volumes, and CAC performance metrics.  
  * *Live Tracking Sync Dashboard:* Displays an active system sync badge next to a manual refresh trigger control: \[Button: Force Refresh Sync\]. This surfaces data lag rules explicitly (e.g., *"Last updated 3 hours ago"*).  
  * *Analytical Visualization Data Feed:* Features multi-axis line graphs tracking engagement velocity against reach, a leaderboard ranking partnerships by ROI metrics, and comparative audience age and regional mapping tools.  
  * *Asset Performance Creative Gallery:* A visual grid of all approved influencer assets. Media cards display profile badges and engagement rate percentages across baseline views. Hovering over a card displays expansion tools (\[Expand Analytics Sheet\]) and file actions (\[Download Source Asset\], \[Copy Authorization Key\]).

### **MODULE 6: CREATE CAMPAIGN WIZARD**

* **Functional Objective:** A high-fidelity, 3-step configuration interface that guides brands from initial campaign design to deployment validation.  
* **Visual Architecture & Progress Mechanics:**  
  * *Universal Framework:* Displays a fixed horizontal multi-step tracker across the header bar, mapping progress clearly (Strategy ──► Targeting ──► Commercials).  
  * *The Persistent Context Drawer Panel:* A sticky summary ledger docked on the right side of the screen. It updates dynamically as fields are completed, displaying input details in real time across clear, collapsible section accordions.  
* **Form Progression & Architecture:**  
  * *Step 1: Strategy:* Captures campaign names, structural tracking models, core business objective selections, and multi-select platform matrices.  
  * *Step 2: Targeting:* Collects vertical definitions, creator persona tags, follower size filters, target demographics, and negative keyword exclusions.  
  * *Step 3: Commercials:* Configures compensation parameters. Handles flat rates or minimum/maximum negotiation boundaries alongside global budget caps, escrow advance settings, and payment timeline choices.

## **3.0 BUSINESS RULES & LIFECYCLE STATE MACHINE LOCKS**

* **Rule BR-01: The 72-Hour Auto-Approval Rule:** When a creator uploads an asset draft for review in Stage 4, a 72-hour system clock begins counting down. If the brand manager fails to request modifications or log an explicit rejection within this window, the platform triggers an automatic approval, updates the milestone stage to Publishing, and safely locks in the creator's 70% final payout allocation.  
* **Rule BR-02: Negotiation Round Caps:** System limits communication chains inside Stage 1 to **two rounds of counter-offers**. Once the tracking variable negotiation\_round\_count \== 2, the negotiation interface locks for both participants and enforces an analytical review. The final counter is marked as a definitive choice, offering only clear acceptance or termination options.  
* **Rule BR-03: Two-Strike Shipping Rule:** If a logistics delivery exception occurs or a creator logs a physical sample failure twice (fulfillment\_issue\_count \>= 2), the system triggers a cancellation protocol. This terminates the partnership, closes the active workspace entry, and automatically returns escrowed capital back to the brand’s balance pool.  
* **Rule BR-04: Creative Modification Limits:** To protect creative workflows, a collaboration is limited to **two revision cycles** in Stage 4\. If a brand manager logs a third successive asset rejection, the system intervenes, terminates the workflow, and pays the creator their 30% advance fee. The brand retains no legal distribution rights for the disputed assets.  
* **Rule BR-05: Gated Content Usage Rights:** Legal usage rights for assets remain strictly inactive until the campaign engine changes an asset's status to VERIFIED. This state requires the live publication URL to pass layout and validation checks, confirmation that the 70% final payout has left escrow, and validation that disclosure labels are present.

## **4.0 SYSTEM DATABASE SETUP: POSTGRESQL SCHEMA ENGINE**

SQL  
\-- \=============================================================================  
\-- POSTGRESQL STATE ENGINE SCHEMA DEFINITIONS  
\-- MODULE: UNIVERSAL CAMPAIGN MANAGEMENT ARCHITECTURE  
\-- \=============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\-- ARCHITECTURAL ENUMERATIONS CONFIGURATION  
CREATE TYPE campaign\_status\_enum AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');  
CREATE TYPE timeline\_structure\_enum AS ENUM ('FIXED\_DATES', 'DYNAMIC\_MILESTONES');  
CREATE TYPE campaign\_objective\_enum AS ENUM ('BRAND\_AWARENESS', 'TRAFFIC\_CLICKS', 'SALES\_CONVERSIONS');  
CREATE TYPE compensation\_type\_enum AS ENUM ('FIXED\_FEE', 'NEGOTIABLE');  
CREATE TYPE payout\_terms\_enum AS ENUM ('IMMEDIATE', 'NET\_7', 'NET\_15', 'NET\_30');

CREATE TYPE collab\_status\_enum AS ENUM (  
    'PROSPECT\_CURATED', 'PROSPECT\_INVITED', 'APPLICANT\_PENDING',  
    'APPLICANT\_SHORTLISTED', 'APPLICANT\_REJECTED', 'ACTIVE\_WORKFLOW',  
    'TERMINATED\_CANCELED', 'ARCHIVED\_COMPLETE'  
);

CREATE TYPE collabs\_milestone\_stage\_enum AS ENUM (  
    'STAGE\_1\_NEGOTIATION', 'STAGE\_2\_SECUREMENT', 'STAGE\_3\_LOGISTICS',  
    'STAGE\_4\_CONTENT\_REVIEW', 'STAGE\_5\_PUBLISHING', 'STAGE\_6\_FEEDBACK\_SYNC'  
);

CREATE TYPE pipeline\_health\_status\_enum AS ENUM ('ON\_TRACK', 'APPROACHING\_DEADLINE', 'ACTION\_OVERDUE', 'SYSTEM\_HOLD');  
CREATE TYPE negotiation\_sub\_state\_enum AS ENUM ('BRAND\_COUNTER', 'CREATOR\_COUNTER', 'FINAL\_OFFER\_PENDING');  
CREATE TYPE securement\_sub\_state\_enum AS ENUM ('AWAITING\_FUNDING', 'AWAITING\_SIGNATURE');  
CREATE TYPE logistics\_sub\_state\_enum AS ENUM ('AWAITING\_DISPATCH', 'IN\_TRANSIT', 'DELIVERY\_EXCEPTION');  
CREATE TYPE review\_sub\_state\_enum AS ENUM ('INITIAL\_DRAFT\_SUBMITTED', 'REVISION\_ROUND\_ACTIVE', 'CONTENT\_HALTED\_LOCK');  
CREATE TYPE publishing\_sub\_state\_enum AS ENUM ('AWAITING\_LIVE\_POST', 'COMPLIANCE\_CHECK\_ACTIVE');  
CREATE TYPE media\_platform\_enum AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE');

\-- \=============================================================================  
\-- SYSTEM INVENTORY MASTER SCHEMAS  
\-- \=============================================================================

CREATE TABLE campaigns (  
    campaign\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    brand\_id UUID NOT NULL,  
    campaign\_name VARCHAR(255) NOT NULL,  
    current\_status campaign\_status\_enum NOT NULL DEFAULT 'DRAFT',  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE TABLE campaign\_performance\_aggregates (  
    campaign\_id UUID PRIMARY KEY REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    total\_spend\_to\_date NUMERIC(14,2) NOT NULL DEFAULT 0.00,  
    total\_impressions\_count BIGINT NOT NULL DEFAULT 0,  
    total\_clicks\_count BIGINT NOT NULL DEFAULT 0,  
    total\_conversions\_count INT NOT NULL DEFAULT 0,  
    total\_prospects\_count INT NOT NULL DEFAULT 0,  
    total\_applicants\_count INT NOT NULL DEFAULT 0,  
    total\_active\_collabs\_count INT NOT NULL DEFAULT 0,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- \=============================================================================  
\-- CAMPAIGN CONFIGURATION STRUCTURES (CREATE WIZARD SUBSYSTEMS)  
\-- \=============================================================================

CREATE TABLE campaign\_strategy (  
    campaign\_id UUID PRIMARY KEY REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    timeline\_type timeline\_structure\_enum NOT NULL,  
    fixed\_start\_date TIMESTAMP WITH TIME ZONE NULL,  
    fixed\_end\_date TIMESTAMP WITH TIME ZONE NULL,  
    dynamic\_days\_limit INT NULL,  
    core\_objective campaign\_objective\_enum NOT NULL,  
    platform\_deliverables JSONB NOT NULL,  
    CONSTRAINT chk\_timeline\_integrity CHECK (  
        (timeline\_type \= 'FIXED\_DATES' AND fixed\_start\_date IS NOT NULL AND fixed\_end\_date IS NOT NULL) OR  
        (timeline\_type \= 'DYNAMIC\_MILESTONES' AND dynamic\_days\_limit IS NOT NULL)  
    )  
);

CREATE TABLE campaign\_targeting (  
    campaign\_id UUID PRIMARY KEY REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    industry\_vertical VARCHAR(100) NOT NULL,  
    creator\_archetypes TEXT\[\] NOT NULL DEFAULT '{}',  
    follower\_tiers TEXT\[\] NOT NULL DEFAULT '{}',  
    audience\_age\_min INT NOT NULL DEFAULT 18 CHECK (audience\_age\_min \>= 13),  
    audience\_age\_max INT NOT NULL DEFAULT 65 CHECK (audience\_age\_max \>= audience\_age\_min),  
    audience\_gender VARCHAR(50) NOT NULL DEFAULT 'ALL',  
    target\_locations TEXT\[\] NOT NULL DEFAULT '{}',  
    disqualifying\_keywords TEXT\[\] NOT NULL DEFAULT '{}'  
);

CREATE TABLE campaign\_commercials (  
    campaign\_id UUID PRIMARY KEY REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    compensation\_type compensation\_type\_enum NOT NULL,  
    fixed\_fee\_amount NUMERIC(12,2) NULL DEFAULT 0.00,  
    negotiable\_min\_fee NUMERIC(12,2) NULL DEFAULT 0.00,  
    negotiable\_max\_fee NUMERIC(12,2) NULL DEFAULT 0.00,  
    total\_campaign\_budget\_pool NUMERIC(14,2) NOT NULL CHECK (total\_campaign\_budget\_pool \> 0.00),  
    advance\_payment\_percentage INT NOT NULL DEFAULT 30 CHECK (advance\_payment\_percentage \>= 30 AND advance\_payment\_percentage \<= 100),  
    final\_balance\_terms payout\_terms\_enum NOT NULL DEFAULT 'NET\_30',  
    CONSTRAINT chk\_fee\_bounds CHECK (  
        (compensation\_type \= 'FIXED\_FEE' AND fixed\_fee\_amount \> 0.00) OR  
        (compensation\_type \= 'NEGOTIABLE' AND negotiable\_min\_fee \>= 0.00 AND negotiable\_max\_fee \> negotiable\_min\_fee)  
    )  
);

\-- \=============================================================================  
\-- LOGISTICS & STRUCTURAL CONTENT COMPONENT REGISTRIES  
\-- \=============================================================================

CREATE TABLE campaign\_products (  
    product\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    sku\_code VARCHAR(150) NOT NULL,  
    product\_name VARCHAR(255) NOT NULL,  
    inventory\_count INT NOT NULL DEFAULT 0 CHECK (inventory\_count \>= 0),  
    cost\_per\_unit NUMERIC(10,2) NOT NULL DEFAULT 0.00,  
    image\_url TEXT NULL,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    CONSTRAINT unique\_campaign\_sku UNIQUE (campaign\_id, sku\_code)  
);

CREATE TABLE campaign\_briefs (  
    brief\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    internal\_title VARCHAR(255) NOT NULL,  
    creative\_guidelines TEXT NOT NULL,  
    required\_platforms media\_platform\_enum\[\] NOT NULL,  
    deliverable\_format\_tags TEXT\[\] NOT NULL,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- \=============================================================================  
\-- PIPELINE CRM STATE ENGINE SCHEMA  
\-- \=============================================================================

CREATE TABLE campaign\_collaborations (  
    collaboration\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    brief\_id UUID NOT NULL REFERENCES campaign\_briefs(brief\_id) ON DELETE RESTRICT,  
    product\_id UUID NULL REFERENCES campaign\_products(product\_id) ON DELETE SET NULL,  
      
    instagram\_handle VARCHAR(100) NOT NULL,  
    creator\_email VARCHAR(255) NOT NULL,  
    match\_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,  
    vetting\_remark VARCHAR(255) NULL,  
    rejection\_reason VARCHAR(255) NULL,  
      
    collab\_status collab\_status\_enum NOT NULL DEFAULT 'PROSPECT\_CURATED',  
    current\_milestone collabs\_milestone\_stage\_enum NOT NULL DEFAULT 'STAGE\_1\_NEGOTIATION',  
    pipeline\_health pipeline\_health\_status\_enum NOT NULL DEFAULT 'ON\_TRACK',  
      
    negotiation\_state negotiation\_sub\_state\_enum NULL,  
    securement\_state securement\_sub\_state\_enum NULL,  
    logistics\_state logistics\_sub\_state\_enum NULL,  
    review\_state review\_sub\_state\_enum NULL,  
    publishing\_state publishing\_sub\_state\_enum NULL,  
      
    negotiation\_round\_count INT NOT NULL DEFAULT 0 CONSTRAINT chk\_negotiation\_limit CHECK (negotiation\_round\_count \<= 2),  
    fulfillment\_issue\_count INT NOT NULL DEFAULT 0 CONSTRAINT chk\_logistics\_limit CHECK (fulfillment\_issue\_count \<= 2),  
    revision\_round\_count INT NOT NULL DEFAULT 0 CONSTRAINT chk\_revision\_limit CHECK (revision\_round\_count \<= 2),  
      
    total\_quote NUMERIC(12,2) NOT NULL DEFAULT 0.00,  
    advance\_30\_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,  
    balance\_70\_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,  
      
    logistics\_carrier VARCHAR(100) NULL,  
    logistics\_tracking\_number VARCHAR(150) NULL,  
    content\_draft\_url TEXT NULL,  
    live\_published\_url TEXT NULL,  
    compliance\_verified BOOLEAN NOT NULL DEFAULT FALSE,  
      
    auto\_approval\_deadline\_72h TIMESTAMP WITH TIME ZONE NULL,  
    current\_milestone\_deadline TIMESTAMP WITH TIME ZONE NOT NULL,  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
      
    CONSTRAINT unique\_campaign\_creator UNIQUE (campaign\_id, instagram\_handle),  
    CONSTRAINT chk\_financial\_balance CHECK (total\_quote \= (advance\_30\_value \+ balance\_70\_value))  
);

CREATE INDEX idx\_collab\_crm\_flow ON campaign\_collaborations (campaign\_id, collab\_status, current\_milestone);  
CREATE INDEX idx\_collab\_health\_deadline ON campaign\_collaborations (pipeline\_health, current\_milestone\_deadline ASC);

\-- \=============================================================================  
\-- AUDIT TELEMETRY HISTORICAL LEDGER  
\-- \=============================================================================

CREATE TABLE collaboration\_audit\_logs (  
    log\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    collaboration\_id UUID NOT NULL REFERENCES campaign\_collaborations(collaboration\_id) ON DELETE CASCADE,  
    stage\_context collabs\_milestone\_stage\_enum NOT NULL,  
    system\_event\_tag VARCHAR(100) NOT NULL,  
    log\_message\_payload TEXT NOT NULL,  
    actor\_identifier VARCHAR(100) NOT NULL,  
    logged\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE INDEX idx\_audit\_history ON collaboration\_audit\_logs (collaboration\_id, logged\_at ASC);

\-- \=============================================================================  
\-- PERFORMANCE ANALYTICS DATA MANAGEMENT ARCHITECTURES  
\-- \=============================================================================

CREATE TABLE campaign\_reporting\_snapshots (  
    snapshot\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    primary\_objective campaign\_objective\_enum NOT NULL,  
      
    total\_spend\_allocated NUMERIC(12,2) NOT NULL DEFAULT 0.00,  
    total\_earned\_media\_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,  
      
    total\_verified\_impressions BIGINT NOT NULL DEFAULT 0,  
    total\_verified\_reach BIGINT NOT NULL DEFAULT 0,  
    calculated\_cpm\_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,  
    calculated\_cpe\_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,  
      
    total\_tracked\_link\_clicks BIGINT NOT NULL DEFAULT 0,  
    aggregated\_ctr\_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,  
    calculated\_cpc\_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,  
      
    attributed\_sales\_revenue NUMERIC(14,2) NOT NULL DEFAULT 0.00,  
    attributed\_conversion\_count INT NOT NULL DEFAULT 0,  
    aggregated\_conversion\_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,  
    calculated\_cac\_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,  
      
    last\_api\_sync\_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE TABLE campaign\_reporting\_timeseries\_hourly (  
    log\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    recorded\_hour TIMESTAMP WITH TIME ZONE NOT NULL,  
    hourly\_likes\_count INT NOT NULL DEFAULT 0,  
    hourly\_comments\_count INT NOT NULL DEFAULT 0,  
    hourly\_saves\_count INT NOT NULL DEFAULT 0,  
    hourly\_shares\_count INT NOT NULL DEFAULT 0,  
    hourly\_impressions\_delta INT NOT NULL DEFAULT 0,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE UNIQUE INDEX idx\_reporting\_timeseries\_hourly\_axis ON campaign\_reporting\_timeseries\_hourly (campaign\_id, recorded\_hour DESC);

CREATE TABLE campaign\_reporting\_asset\_gallery (  
    asset\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    collaboration\_id UUID NOT NULL REFERENCES campaign\_collaborations(collaboration\_id) ON DELETE CASCADE,  
    instagram\_handle VARCHAR(100) NOT NULL,  
    platform media\_platform\_enum NOT NULL,  
    media\_thumbnail\_url TEXT NOT NULL,  
    high\_res\_source\_download\_url TEXT NOT NULL,  
    engagement\_rate\_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,  
      
    saves\_count INT NOT NULL DEFAULT 0,  
    shares\_count INT NOT NULL DEFAULT 0,  
    story\_sticker\_clicks\_count INT NOT NULL DEFAULT 0,  
      
    spark\_ad\_authorization\_code VARCHAR(255) NULL,  
    is\_whitelisting\_active BOOLEAN NOT NULL DEFAULT FALSE,  
    published\_at TIMESTAMP WITH TIME ZONE NOT NULL,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE INDEX idx\_gallery\_ranking ON campaign\_reporting\_asset\_gallery (campaign\_id, engagement\_rate\_percentage DESC);

## **5.0 DATA VALIDATION REGISTRY: INTEGRATED ZOD CONFIGURATION**

TypeScript  
// \=============================================================================  
// RUNTIME DATA SPECIFICATION & VALIDATION SERVICES  
// MODULE: UNIVERSAL CAMPAIGN MANAGEMENT ARCHITECTURE  
// \=============================================================================

import { z } from 'zod';

// CORE PLATFORM ENUM PARSERS  
export const CampaignStatusSchema \= z.enum(\['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'\]);  
export const TimelineStructureSchema \= z.enum(\['FIXED\_DATES', 'DYNAMIC\_MILESTONES'\]);  
export const CampaignObjectiveSchema \= z.enum(\['BRAND\_AWARENESS', 'TRAFFIC\_CLICKS', 'SALES\_CONVERSIONS'\]);  
export const CompensationTypeSchema \= z.enum(\['FIXED\_FEE', 'NEGOTIABLE'\]);  
export const PayoutTermsSchema \= z.enum(\['IMMEDIATE', 'NET\_7', 'NET\_15', 'NET\_30'\]);  
export const MediaPlatformSchema \= z.enum(\['INSTAGRAM', 'TIKTOK', 'YOUTUBE'\]);

export const CollabStatusSchema \= z.enum(\[  
  'PROSPECT\_CURATED', 'PROSPECT\_INVITED', 'APPLICANT\_PENDING',  
  'APPLICANT\_SHORTLISTED', 'APPLICANT\_REJECTED', 'ACTIVE\_WORKFLOW',  
  'TERMINATED\_CANCELED', 'ARCHIVED\_COMPLETE'  
\]);

export const MilestoneStageSchema \= z.enum(\[  
  'STAGE\_1\_NEGOTIATION', 'STAGE\_2\_SECUREMENT', 'STAGE\_3\_LOGISTICS',  
  'STAGE\_4\_CONTENT\_REVIEW', 'STAGE\_5\_PUBLISHING', 'STAGE\_6\_FEEDBACK\_SYNC'  
\]);

export const PipelineHealthStatusSchema \= z.enum(\['ON\_TRACK', 'APPROACHING\_DEADLINE', 'ACTION\_OVERDUE', 'SYSTEM\_HOLD'\]);

export const InstagramHandleSchema \= z.string()  
  .min(1)  
  .max(100)  
  .transform((val) \=\> (val.startsWith('@') ? val : \`@${val}\`));

// \=============================================================================  
// CREATION SCHEMAS: STRUCTURAL WIZARD INTERFACES  
// \=============================================================================

export const Step1StrategySchema \= z.object({  
  campaign\_name: z.string().min(3, "Campaign names require at least 3 characters.").max(255),  
  timeline\_type: TimelineStructureSchema,  
  fixed\_start\_date: z.string().datetime().optional().nullable(),  
  fixed\_end\_date: z.string().datetime().optional().nullable(),  
  dynamic\_days\_limit: z.number().int().positive().optional().nullable(),  
  core\_objective: CampaignObjectiveSchema,  
  platform\_deliverables: z.array(z.object({  
    platform: MediaPlatformSchema,  
    formats: z.array(z.string()).min(1, "Assign at least one content format layout option.")  
  })).min(1, "The campaign framework requires target platform configuration targets.")  
}).superRefine((data, ctx) \=\> {  
  if (data.timeline\_type \=== 'FIXED\_DATES') {  
    if (\!data.fixed\_start\_date) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed parameters require an operational start date.", path: \["fixed\_start\_date"\] });  
    }  
    if (\!data.fixed\_end\_date) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed parameters require a clear completion date.", path: \["fixed\_end\_date"\] });  
    }  
    if (data.fixed\_start\_date && data.fixed\_end\_date && new Date(data.fixed\_start\_date) \>= new Date(data.fixed\_end\_date)) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Campaign initiation dates must precede specified termination dates.", path: \["fixed\_end\_date"\] });  
    }  
  }  
  if (data.timeline\_type \=== 'DYNAMIC\_MILESTONES' && \!data.dynamic\_days\_limit) {  
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dynamic milestones require an explicit days limit parameter configuration.", path: \["dynamic\_days\_limit"\] });  
  }  
});

export const Step2TargetingSchema \= z.object({  
  industry\_vertical: z.string().min(1, "Target commercial industry classification required."),  
  creator\_archetypes: z.array(z.string()).min(1, "Map at least one creator profile grouping target orientation."),  
  follower\_tiers: z.array(z.string()).min(1, "Specify targeted creator community tier ranges."),  
  audience\_age\_min: z.number().int().min(13, "Minimum configuration thresholds align with standard OAuth requirements at 13."),  
  audience\_age\_max: z.number().int().max(65),  
  audience\_gender: z.string().default("ALL"),  
  target\_locations: z.array(z.string()).min(1, "Provide active target geographic boundaries maps."),  
  disqualifying\_keywords: z.array(z.string()).optional().default(\[\])  
}).refine((data) \=\> data.audience\_age\_min \<= data.audience\_age\_max, {  
  message: "Minimum age parameters cannot cross defined maximum bounds tags.",  
  path: \["audience\_age\_min"\]  
});

export const Step3CommercialsSchema \= z.object({  
  compensation\_type: CompensationTypeSchema,  
  fixed\_fee\_amount: z.number().nonnegative().optional().default(0.00),  
  negotiable\_min\_fee: z.number().nonnegative().optional().default(0.00),  
  negotiable\_max\_fee: z.number().nonnegative().optional().default(0.00),  
  total\_campaign\_budget\_pool: z.number().positive("Campaign execution frameworks require valid tracking budgets."),  
  advance\_payment\_percentage: z.number().int().min(30, "System security rules force advance escrow parameters to at least 30% (Rule BR-01).").max(100),  
  final\_balance\_terms: PayoutTermsSchema  
}).superRefine((data, ctx) \=\> {  
  if (data.compensation\_type \=== 'FIXED\_FEE' && data.fixed\_fee\_amount \<= 0.00) {  
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed compensation models require a non-zero base creator fee.", path: \["fixed\_fee\_amount"\] });  
  }  
  if (data.compensation\_type \=== 'NEGOTIABLE') {  
    if (data.negotiable\_min\_fee \>= data.negotiable\_max\_fee) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Minimum parameters bounds must sit below maximum layout ceiling limits.", path: \["negotiable\_min\_fee"\] });  
    }  
    if (data.negotiable\_max\_fee \<= 0.00) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Negotiation tracking ceilings require a valid structural cap configuration.", path: \["negotiable\_max\_fee"\] });  
    }  
  }  
});

export const UnifiedCampaignWizardPayloadSchema \= z.object({  
  strategy: Step1StrategySchema,  
  targeting: Step2TargetingSchema,  
  commercials: Step3CommercialsSchema  
});

// \=============================================================================  
// LOGISTICS & STRUCTURAL CONTENT CONFIGURATION SPECIFICATIONS  
// \=============================================================================

export const CampaignProductInventoryInputSchema \= z.object({  
  campaign\_id: z.string().uuid(),  
  sku\_code: z.string().min(2, "Inventory SKU mapping keys cannot be empty profiles description lines.").max(150),  
  product\_name: z.string().min(1, "Product reference designations cannot verify blank values.").max(255),  
  inventory\_count: z.number().int().nonnegative("Available logistics center stock allocation counts cannot drop below zero."),  
  cost\_per\_unit: z.number().positive("Unit asset cost valuations require explicit positive pricing metrics."),  
  image\_url: z.string().url().nullable().optional()  
});

export const CampaignBriefCreationInputSchema \= z.object({  
  campaign\_id: z.string().uuid(),  
  internal\_title: z.string().min(5, "Brief reference titles require a distinct descriptive framework identifier.").max(255),  
  creative\_guidelines: z.string().min(20, "Creative workflow requirements profiles require clear production context details."),  
  required\_platforms: z.array(MediaPlatformSchema).min(1, "Campaign pipeline requirements force platform destination parameters."),  
  deliverable\_format\_tags: z.array(z.string()).min(1, "Provide explicit content asset configuration structural labels (e.g., '9:16 Reel').")  
});

// \=============================================================================  
// OPERATIONAL REPOSITORIES & CORRESPONDENCE SCHEMA LAYOUTS  
// \=============================================================================

export const PipelineCollaborationUnifiedRowSchema \= z.object({  
  collaboration\_id: z.string().uuid(),  
  campaign\_id: z.string().uuid(),  
  brief\_id: z.string().uuid(),  
  brief\_internal\_title: z.string().min(1),  
  product\_id: z.string().uuid().nullable(),  
  product\_sku\_name: z.string().nullable(),  
    
  instagram\_handle: InstagramHandleSchema,  
  creator\_email: z.string().email(),  
  match\_score: z.number().min(0).max(100),  
  vetting\_remark: z.string().nullable(),  
  rejection\_reason: z.string().nullable(),  
    
  collab\_status: CollabStatusSchema,  
  current\_milestone: MilestoneStageSchema,  
  pipeline\_health: PipelineHealthStatusSchema,  
    
  negotiation\_state: z.enum(\['BRAND\_COUNTER', 'CREATOR\_COUNTER', 'FINAL\_OFFER\_PENDING'\]).nullable(),  
  securement\_state: z.enum(\['AWAITING\_FUNDING', 'AWAITING\_SIGNATURE'\]).nullable(),  
  logistics\_state: z.enum(\['AWAITING\_DISPATCH', 'IN\_TRANSIT', 'DELIVERY\_EXCEPTION'\]).nullable(),  
  review\_state: z.enum(\['INITIAL\_DRAFT\_SUBMITTED', 'REVISION\_ROUND\_ACTIVE', 'CONTENT\_HALTED\_LOCK'\]).nullable(),  
  publishing\_state: z.enum(\['AWAITING\_LIVE\_POST', 'COMPLIANCE\_CHECK\_ACTIVE'\]).nullable(),  
    
  negotiation\_round\_count: z.number().int().min(0).max(2),  
  fulfillment\_issue\_count: z.number().int().min(0).max(2),  
  revision\_round\_count: z.number().int().min(0).max(2),  
    
  total\_quote: z.number().nonnegative(),  
  advance\_30\_value: z.number().nonnegative(),  
  balance\_70\_value: z.number().nonnegative(),  
    
  logistics\_carrier: z.string().nullable(),  
  logistics\_tracking\_number: z.string().nullable(),  
  content\_draft\_url: z.string().url().nullable(),  
  live\_published\_url: z.string().url().nullable(),  
  compliance\_verified: z.boolean(),  
    
  auto\_approval\_deadline\_72h: z.string().datetime().nullable(),  
  current\_milestone\_deadline: z.string().datetime(),  
    
  calculated\_hours\_remaining\_review: z.number().int().nullable().optional(),  
  calculated\_days\_overdue: z.number().int().nullable().optional()  
}).superRefine((data, ctx) \=\> {  
  if (data.total\_quote \> 0) {  
    const calculatedSum \= data.advance\_30\_value \+ data.balance\_70\_value;  
    if (Math.abs(data.total\_quote \- calculatedSum) \> 0.01) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escrow splits must parse cleanly to equal total contract quote amounts.", path: \["total\_quote"\] });  
    }  
  }

  if (data.current\_milestone \=== 'STAGE\_4\_CONTENT\_REVIEW' && data.auto\_approval\_deadline\_72h) {  
    const absoluteDeadline \= new Date(data.auto\_approval\_deadline\_72h).getTime();  
    const runtimeClock \= new Date().getTime();  
    const remainingDeltaHours \= Math.floor((absoluteDeadline \- runtimeClock) / (1000 \* 60 \* 60));  
    data.calculated\_hours\_remaining\_review \= remainingDeltaHours \> 0 ? remainingDeltaHours : 0;  
  }

  if (data.pipeline\_health \=== 'ACTION\_OVERDUE') {  
    const benchmarkDeadline \= new Date(data.current\_milestone\_deadline).getTime();  
    const runtimeClock \= new Date().getTime();  
    const calculatedDelayDays \= Math.floor((runtimeClock \- benchmarkDeadline) / (1000 \* 60 \* 60 \* 24));  
    data.calculated\_days\_overdue \= calculatedDelayDays \> 0 ? calculatedDelayDays : 0;  
  }  
});

// \=============================================================================  
// REPORTING MODULE DATA SCHEMAS  
// \=============================================================================

export const AwarenessMetricsStripSchema \= z.object({  
  total\_spend\_allocated: z.number().nonnegative(),  
  total\_earned\_media\_value: z.number().nonnegative(),  
  total\_verified\_impressions: z.number().int().nonnegative(),  
  total\_verified\_reach: z.number().int().nonnegative(),  
  calculated\_cpm\_rate: z.number().nonnegative(),  
  calculated\_cpe\_rate: z.number().nonnegative()  
});

export const TrafficMetricsStripSchema \= z.object({  
  total\_spend\_allocated: z.number().nonnegative(),  
  total\_earned\_media\_value: z.number().nonnegative(),  
  total\_tracked\_link\_clicks: z.number().int().nonnegative(),  
  aggregated\_ctr\_percentage: z.number().min(0).max(100),  
  calculated\_cpc\_rate: z.number().nonnegative()  
});

export const ConversionMetricsStripSchema \= z.object({  
  total\_spend\_allocated: z.number().nonnegative(),  
  total\_earned\_media\_value: z.number().nonnegative(),  
  attributed\_sales\_revenue: z.number().nonnegative(),  
  attributed\_conversion\_count: z.number().int().nonnegative(),  
  aggregated\_conversion\_rate: z.number().min(0).max(100),  
  calculated\_cac\_rate: z.number().nonnegative()  
});

export const HourlyTimeSeriesDataPointSchema \= z.object({  
  recorded\_hour: z.string().datetime(),  
  hourly\_likes\_count: z.number().int().nonnegative(),  
  hourly\_comments\_count: z.number().int().nonnegative(),  
  hourly\_saves\_count: z.number().int().nonnegative(),  
  hourly\_shares\_count: z.number().int().nonnegative(),  
  hourly\_impressions\_delta: z.number().int().nonnegative()  
});

export const PerformanceLeaderboardRowSchema \= z.object({  
  rank\_position: z.number().int().positive(),  
  collaboration\_id: z.string().uuid(),  
  instagram\_handle: InstagramHandleSchema,  
  assigned\_fee\_investment: z.number().nonnegative(),  
  delivered\_impressions\_count: z.number().int().nonnegative(),  
  cost\_per\_engagement\_value: z.number().nonnegative(),  
  roi\_performance\_index\_score: z.number().int().min(0).max(100)  
});

export const VisualAssetGalleryCardSchema \= z.object({  
  asset\_id: z.string().uuid(),  
  collaboration\_id: z.string().uuid(),  
  instagram\_handle: InstagramHandleSchema,  
  platform: MediaPlatformSchema,  
  media\_thumbnail\_url: z.string().url(),  
  high\_res\_source\_download\_url: z.string().url(),  
  engagement\_rate\_percentage: z.number().min(0).max(100),  
  saves\_count: z.number().int().nonnegative(),  
  shares\_count: z.number().int().nonnegative(),  
  story\_sticker\_clicks\_count: z.number().int().nonnegative(),  
  spark\_ad\_authorization\_code: z.string().min(1).nullable(),  
  is\_whitelisting\_active: z.boolean()  
});

export const OperationalReportingDashboardWorkspaceSchema \= z.object({  
  campaign\_id: z.string().uuid(),  
  campaign\_name: z.string().min(1),  
  primary\_objective: CampaignObjectiveSchema,  
  last\_api\_sync\_timestamp: z.string().datetime(),  
  elapsed\_time\_string: z.string().min(1),  
  roi\_summary\_strip\_payload: z.any(),  
  timeseries\_hourly\_feed: z.array(HourlyTimeSeriesDataPointSchema),  
  leaderboard\_rankings: z.array(PerformanceLeaderboardRowSchema),  
  creative\_gallery\_grid: z.array(VisualAssetGalleryCardSchema)  
}).superRefine((workspace, ctx) \=\> {  
  let objectRefinementBlock;  
  if (workspace.primary\_objective \=== 'BRAND\_AWARENESS') {  
    objectRefinementBlock \= AwarenessMetricsStripSchema.safeParse(workspace.roi\_summary\_strip\_payload);  
  } else if (workspace.primary\_objective \=== 'TRAFFIC\_CLICKS') {  
    objectRefinementBlock \= TrafficMetricsStripSchema.safeParse(workspace.roi\_summary\_strip\_payload);  
  } else {  
    objectRefinementBlock \= ConversionMetricsStripSchema.safeParse(workspace.roi\_summary\_strip\_payload);  
  }

  if (\!objectRefinementBlock.success) {  
    ctx.addIssue({  
      code: z.ZodIssueCode.custom,  
      message: \`Summary telemetry dynamic payload structural properties mismatch objective mapping: ${workspace.primary\_objective}\`,  
      path: \["roi\_summary\_strip\_payload"\]  
    });  
  }  
});

// INTERFACE EXTRACTION TYPES EXPORTS  
export type UnifiedCampaignWizardPayload \= z.infer\<typeof UnifiedCampaignWizardPayloadSchema\>;  
export type CampaignProductInventoryInput \= z.infer\<typeof CampaignProductInventoryInputSchema\>;  
export type CampaignBriefCreationInput \= z.infer\<typeof CampaignBriefCreationInputSchema\>;  
export type PipelineCollaborationUnifiedRow \= z.infer\<typeof PipelineCollaborationUnifiedRowSchema\>;  
export type OperationalReportingDashboardWorkspace \= z.infer\<typeof OperationalReportingDashboardWorkspaceSchema\>;

## **6.0 PLATFORM USER INTERACTION ENGINE CONSTRAINTS**

* **Constraint PIC-01: The Side-Drawer Navigation Rule:** Across all tabular list layouts (Prospects, Applicants, Active Collabs), clicking the view analysis asset configuration control (\[Eye Icon\]) must never trigger a standard page redirect. Instead, details render within a state-preserving Right Side Drawer Overlay module (width: 460px).  
* **Constraint PIC-02: Sticky Footer Overlay Placement:** Any modal configuration dashboard, configuration panel, or selection view containing validation actions must lock controls into a background-blended, fixed bottom sticky container. This container holds primary affirmative selection triggers on the right and negative actions on the left.  
* **Constraint PIC-03: Truncation Protection Limits:** Every automated outreach string, notification payload, or automated alert directed outside the system workspace to messaging apps must stay **under 20 words total**. This length check avoids layout truncation issues across mobile device viewports.  
* **Constraint PIC-04: Batch Selection Action Accessibility:** The headers of operational transaction grids must contain master selection checkboxes alongside batch action dropdown controls. Individual management actions remain disabled until at least one target row check is initialized.

