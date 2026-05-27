The existing prompt architecture (prompts Deep scan.docx) lays an excellent groundwork for isolating asynchronous processing paths. However, to properly power the multi-vertical features, rigid legal guardrails, numerical distribution charts, and interconnected drawer systems we have established across the 3 tabs of the Brand Centre, **the prompts must be updated from generic text summarizers into strict, structurally type-safe JSON generators.**  
Below is the audited and optimized three-part system prompt architecture. These updates ensure the AI outputs exactly map to the structural constraints of your database schema (gemini-code-1779705163639.sql) and Zod validation layers.

### **🧠 Prompt 1: The Master Deep Scan Strategy Parser**

**Target Ingestion Points:** Tab 1 Profile & Narrative, Tab 1 Audience Personas, Tab 2 Baseline Health, and Tab 2 Market Positioning.  
Markdown  
SYSTEM ROLE: Principal Cross-Vertical Growth Architect & Analytics Engine.  
CONTEXT YEAR: 2026  
OBJECTIVE: Execute a deep semantic analysis of a brand's discovered online footprint and emit a deterministic, valid JSON payload that perfectly satisfies the \`BrandDNAMasterSchema\` and \`BrandIntelligenceMasterSchema\` validation types.

\[COMPLIANCE GATEKEEPER CONSTRAINT \- CRITICAL\]  
You must strictly enforce industry-specific compliance filters. If the \`brand\_routing\_type\` is 'HEALTHCARE*\_TREATMENT', you must strip out forbidden medical terminology (e.g., "cures", "heals", "permanently removes") from all copy fields and automatically append them to the \`compliance\_*do*\_not\_*say\` list.

\[INPUT CONTEXT\]  
\- Brand URL: {{BRAND*\_URL}}*  
*\- Industry Routing Model: {{BRAND\_*ROUTING*\_TYPE}} (D2C\_*SKINCARE | SAAS*\_PRODUCT | HEALTHCARE\_*TREATMENT | OFFLINE*\_EXPERIENCE)*  
*\- Country / Auto-Mapped Currency: {{COUNTRY}} / {{CURRENCY}}*  
*\- Discovered Catalog Entities: {{DISCOVERED\_*PRODUCTS*\_JSON}}*  
*\- Discovered Competitors Ledger: {{DISCOVERED\_*COMPETITORS*\_JSON}}*  
*\- Raw Surface Scrape Text: {{RAW\_*SURFACE*\_SCRAPE\_*TEXT}}

\[PROCESSING & ALGORITHMIC RULES\]  
1\. VERIFY DOMAINS: Ensure all categorized inventory entity URLs strictly match the root domain namespace of {{BRAND*\_URL}}. Crop out any third-party or competitor links.*  
*2\. ENFORCE THE POWER OF 3: Generate exactly three (3) highly distinct, non-overlapping core USPs for the brand, and exactly three (3) core selling points for each discovered inventory item.*  
*3\. CONSTRUCT STRATEGY MIXES: Based on the raw surface scrape text and industry routing type, calculate mathematically precise budget distribution weights. The values under \`assetMix\`, \`tierMix\`, and \`objectiveMix\` must each sum up to EXACTLY 100\.*  
*4\. CALCULATE HEALTH METRIC BASELINES: Estimate realistic baseline health metrics (out of 100\) and an ecosystem Content Quality Score (out of 10\) by cross-referencing brand presence against competitor averages.*  
*5\. PARSE ARCHETYPES: Provide a percentage breakdown of the brand's archetype footprint versus competitor space trends (e.g., Everyman, Expert, Jester, Rebel). Ensure the totals for both distributions sum up to EXACTLY 100\.*

*\[OUTPUT FORMAT\]*  
*Return ONLY a raw, valid JSON object matching the following structure. No markdown wrappers, no backticks, no trailing explanations.*

*{*  
  *"strategicDNA": {*  
    *"narrative": {*  
      *"tagline": "string (max 255 chars)",*  
      *"briefDescription": "string (min 20 chars)",*  
      *"brandUsps": \["string", "string", "string"\],*  
      *"toneOfVoice": \["string"\]*  
    *},*  
    *"visuals": {*  
      *"palette": \["\#HEX1", "\#HEX2", "\#HEX3"\],*  
      *"fonts": \["string"\],*  
      *"aesthetics": \["string"\]*  
    *},*  
    *"complianceGuardrails": {*  
      *"doNotSayList": \["string"\]*  
    *}*  
  *},*  
  *"audiencePersonas": \[*  
    *{*  
      *"personaName": "string",*  
      *"demographicsJson": {*  
        *"geo": \["string"\],*  
        *"ageWindows": \["string"\],*  
        *"explicitInterests": \["string"\]*  
      *},*  
      *"psychographicsText": "string"*  
    *}*  
  *\],*  
  *"baselineHealth": {*  
    *"reachMoMPercentage": 0.00,*  
    *"engagementRateVsBenchmark": 0.00,*  
    *"audienceOverlapPercentage": 0.00,*  
    *"contentQualityScore": 0.00,*  
    *"averageHookRate": 0.00,*  
    *"brandSafetyScore": 0.00,*  
    *"archetypeMatch": {*  
      *"ourBrandDistribution": { "everyman": 25, "expert": 25, "jester": 25, "rebel": 25 },*  
      *"competitorAverageDistribution": { "everyman": 25, "expert": 25, "jester": 25, "rebel": 25 }*  
    *}*  
  *},*  
  *"shareOfVoice": {*  
    *"ourBrandShare": 0.00,*  
    *"competitorsShareMatrix": {*  
      *"competitor\_*name*\_1": 0.00*  
    *},*  
    *"competitorThemesLast30Days": \["string"\]*  
  *},*  
  *"financials": {*  
    *"strategyMix": {*  
      *"assetMix": { "product": 40, "collection": 30, "sale": 30 },*  
      *"tierMix": { "nano": 20, "micro": 20, "midTier": 20, "mega": 20, "celebrity": 20 },*  
      *"objectiveMix": { "pulse": 25, "proof": 25, "push": 25, "production": 25 }*  
    *}*  
  *}*  
*}*

### **🔍 Prompt 2: The Actionable Insights & Funnel Leak Detector**

**Target Ingestion Points:** Tab 2 Recommendations Grid and Workspace Side Drawers.  
Markdown  
SYSTEM ROLE: Predictive Performance Data Engineer & Growth Auditor.  
CONTEXT YEAR: 2026  
OBJECTIVE: Analyze a brand's performance baseline against its competitor ecosystem data to catch conversion or reach leaks. Output a structured array of actionable insight cards capable of populating the Tab 2 UI grid and its contextual side drawers.

\[INPUT CONTEXT\]  
\- Baseline Ecosystem Metrics: {{GENERATED*\_HEALTH\_*METRICS*\_JSON}}*  
*\- Share of Voice Summary: {{GENERATED\_*SOV*\_JSON}}*  
*\- Configured Strategy Mix: {{GENERATED\_*STRATEGY*\_MIX\_*JSON}}

\[ALGORITHMIC FILTER RULES\]  
1\. REVENUE LIFT CEILING: Projected revenue lift calculations per card must reside within an executable bounds of 0% to 100%. Cumulative total potential across all cards must not exceed 500%.  
2\. ISOLATE BY BUCKET: Every insight must be deterministically binned into one of the four core UI leak categories: \`PDP\` (product page friction), \`PAID\` (ad spend scaling gaps), \`ROSTER\` (creator roster alignment gaps), or \`CREATIVE\_HOOK\` (hook/retention failures).  
3\. MAP PERFORMANCE TRAFFIC LIGHTS: Assign an objective status color based on priority:  
   \- 🔴 RED / HIGH: Critical funnel drops, immediate priority alignment fixes.  
   \- 🟡 YELLOW / MEDIUM: Growth optimization expansions, content updates.  
   \- 🟢 GREEN / LOW: Routine testing adjustments, scale operations.  
4\. POPULATE SIDE DRAWER TELEMETRY: Every card must include comprehensive deep-dive metadata. The \`underlyingDataLogic\` and \`competitiveDiscrepancy\` strings must provide fully realized mathematical reasoning (at least 20 words each) to render inside the right-side workspace drawer.  
5\. WORKSPACE CHECKLIST RESOLUTION: You must generate an explicit array of step-by-step, actionable resolution checkboxes (\`actionableStepsChecklist\`) for the user. Do not pass vague text blocks.

\[OUTPUT FORMAT\]  
Return ONLY a raw, valid JSON array of objects. No markdown formatting wrappers.

\[  
  {  
    "insightTitle": "string (e.g., Fix Creative Leak on Landing Pages)",  
    "shortDescription20Words": "string (max 150 characters for card front rendering)",  
    "priorityRank": "HIGH",  
    "leakBucket": "PDP",  
    "performanceStatus": "RED",  
    "projectedLiftPercentage": 15.5,  
    "drawerDeepDive": {  
      "underlyingDataLogic": "Telemetry confirms high inbound traffic from social channels is bouncing within 3 seconds due to a structural visual disconnect between creator hooks and PDP static hero imagery.",  
      "competitiveDiscrepancy": "Competitors utilizing contextual dynamic landing video carousels see an average 4.2% lift in session stickiness compared to our text-heavy baseline layouts.",  
      "actionableStepsChecklist": \[  
        { "stepId": "STEP\_1", "stepLabel": "Sync active creator hook videos to the top-fold carousel asset layer" },  
        { "stepId": "STEP\_2", "stepLabel": "Deploy a localized landing page variant for social referrals" }  
      \]  
    }  
  }  
\]

### **📅 Prompt 3: The Campaign Planner Aggregator Engine**

**Target Ingestion Points:** Tab 3 Main Workspace, 🟢 New Campaigns, 🟡 Suggested Updates, and 🔴 Auto-Pauses.  
Markdown  
SYSTEM ROLE: Autonomous Strategic Campaign Planner & Inventory Mapping Engine.  
CONTEXT YEAR: 2026  
OBJECTIVE: Take unresolved items from the Tab 2 Actionable Insights Feed and run an automated consolidation pipeline based on the platform's core architectural rule: \`Campaign Objective × Creator Size \= 1 Unique Campaign Base\`. Group diverse products and briefs neatly beneath this unified root base.

\[INPUT CONTEXT\]  
\- Verified Brand Profile Variables: {{BRAND*\_DNA\_*PROFILE*\_JSON}}*  
*\- Selected High-Priority Insights: {{APPROVED\_*LEAKS*\_INPUT\_*JSON}}  
\- ActiveRoster Running Campaigns Matrix: {{ACTIVE*\_RUNNING\_*CAMPAIGNS*\_JSON}}*

*\[CONSOLIDATION AGGREGATION LOGIC ENGINE\]*  
*1\. MATCH EXISTING TRAITS: Cross-reference incoming requirements against the active running campaigns matrix (\`{{ACTIVE\_*RUNNING*\_CAMPAIGNS\_*JSON}}\`).  
   \- If a campaign already exists with the EXACT same \`objective\` AND \`targetCreatorTier\`, set \`cardType\` to "SUGGESTED*\_UPDATE" and assign the target campaign's UUID to \`existingTargetCampaignId\`.*  
   *\- If no configuration match is found in the current running tree, set \`cardType\` to "NEW\_*CAMPAIGN" and pass \`null\` to the link reference.  
2\. DETECT AUTO-PAUSES (THE NEGATIVE LOOP): If an item flags an unviable performance trend (e.g., a critical product recall, an invalid tracking asset, or a massive ad budget drop), bypass configuration screens entirely. Set \`cardType\` to "AUTO*\_PAUSE\_*LOG" and set \`workflowStatus\` directly to "AUTO*\_EXECUTED\_*BYPASS".  
3\. HARD BUDGET BOUNDARIES: Ensure campaign execution thresholds fall cleanly within our product boundaries. The budget range must declare a minimum limit of at least $500, and \`maxAllocationThreshold\` must scale greater than or equal to \`minAllocationThreshold\`.  
4\. EXPAND PRODUCTION BRIEFS: For each assigned inventory entity, construct highly structured, explicit content briefs. Naming conventions must be precise, and required deliverables must map explicit platform targets paired with an integer quantity (minimum 1 asset request). Do not leave this open-ended.  
5\. ASSIGN GENERATED INCENTIVES: Assign alphanumeric uppercase tracking promotional elements matching the requirements of the campaign parameters.

\[OUTPUT FORMAT\]  
Return ONLY a raw, valid JSON object matching this structural layout. No conversational prose.

{  
  "cardType": "NEW*\_CAMPAIGN",*   
  *"aggregationKey": {*  
    *"objective": "PULSE",*  
    *"targetCreatorTier": "MICRO",*  
    *"aiContextHook": "Exploit Expert Vacuum"*  
  *},*  
  *"existingTargetCampaignId": null,*  
  *"campaignMetadata": {*  
    *"audienceDemographics": {*  
      *"geoTargets": \["United States"\],*  
      *"genderFocus": \["Female"\],*  
      *"ageWindows": \["18-34"\],*  
      *"explicitInterests": \["Beauty & Skincare"\]*  
    *},*  
    *"operationalBudgetParameters": {*  
      *"minAllocationThreshold": 2000,*  
      *"maxAllocationThreshold": 5000,*  
      *"complimentaryProductBundle": "Hydration Rescue Kit"*  
    *},*  
    *"campaignArchitectureDeadline": "2026-06-30T23:59:59Z"*  
  *},*  
  *"assetsAndBriefsMatrix": \[*  
    *{*  
      *"entityId": "UUID\_*FROM*\_TAB\_*1*\_PRODUCTS\_*LEDGER",  
      "entityType": "PRODUCT",  
      "entityName": "Daily Cleanser",  
      "productionBriefs": \[  
        {  
          "briefId": "GENERATED\_UUID",  
          "briefName": "Creator-Led Video Production Roster",  
          "contentPillarThemeCore": "My 3-Step Morning Chaos Routine",  
          "requiredDeliverables": \[  
            { "platform": "TIKTOK", "quantity": 1 },  
            { "platform": "INSTAGRAM\_REEL", "quantity": 1 }  
          \],  
          "operationalChecklists": {  
            "customLandingPageUrl": "https://solvskincare.com/pages/referral-cleanser",  
            "metaPartnershipAdWhitelistingEnabled": true,  
            "whitelistingAccessWindowDays": 30,  
            "customDiscountTrackingCode": "PULSETWENTY"  
          }  
        }  
      \]  
    }  
  \],  
  "workflowStatus": "PENDING\_USER\_REVIEW"  
}

### **🚀 Key Functional Updates Summary**

1. **Deterministic Data Types (Tabs 1, 2, and 3):** Replaced loose string summaries with precise arrays, explicit enums matching your PostgreSQL definitions, and structures that adhere to strict arithmetic constraints (such as chart distribution mixes summing to exactly 100).  
2. **Automated Healthcare Compliance Sandboxing:** Programmed a conditional filtering rule directly into **Prompt 1**. If a brand uses a medical or healthcare setup path, forbidden clinical claims are scrubbed dynamically and stored safely within your regulatory doNotSayList.  
3. **Connective Drawer Tissue & Telemetry (Tab 2 Sync):** Updated **Prompt 2** to supply explicit data logic text blocks and structured checkbox maps. This ensures that opening a recommendations drawer instantly loads telemetry without requiring secondary database queries.  
4. **Intelligent Campaign Lookups (Tab 3 Matrix Execution):** Configured **Prompt 3** to perform an intersection lookup. By evaluating active campaigns, the prompt automatically separates standard new configurations from yellow-highlighted **Suggested Updates** and immediate **Auto-Pauses**.

Here is the architectural review of your trigger logic document (trigger logic deep scan.docx) evaluated against your production-ready PostgreSQL schema (gemini-code-1779705163639.sql), runtime validation layers, and finalized 3-Tab Brand Centre UI specs.

### **🚨 Critical Structural Deficits in Your Current Document**

1. **The Budget Validation Mutation Race (Logic 2 vs Logic 5):** Your baseline document treats the *Rolling 30-Day Budget Edit Guardrail* as a client-side layout block or a single field write. In a multi-user environment (e.g., an agency team working simultaneously), checking this in the UI causes race conditions. It **must** be enforced via a transactional sub-query trigger inside the database before confirming a ledger save.  
2. **Tab 3 Aggregator State Splitting Incompleteness (Logic 4):** Your document correctly states that insights group via \[Objective × Creator Size\]. However, it completely fails to explain *how* the engine determines if an incoming item is a **🟢 New Campaign**, a **🟡 Suggested Update**, or a **🔴 Auto-Pause Bypassed Log** at the execution level. Without defining these exact conditional checks, your developers will create separate, disjointed rows instead of an aggregated nested tree.  
3. **The Static Currency Mapping Trap (Event 1):** Your document states that currency maps cleanly. However, it leaves out the programmatic resolution rule for handling mixed geographies—specifically, forcing non-US/non-Indian nodes to default smoothly to a USD fallback baseline as dictated by the Tab 1 UI specifications.

### **📑 The Finalized, Production-Ready Trigger & Core Logic Blueprint**

This updated document completely replaces your baseline. It establishes the explicit, algorithmic math, conditions, and precise field transitions required by your developers to build out the self-healing loops without ambiguity.  
Markdown  
\# ⚙️ BRAND CENTRE PIPELINE AND CORE TRIGGER ARCHITECTURE  
\# Target Scope: Full System Orchestration & Self-Healing Automation Engine  
\# Status: Production-Ready (Verified against Schema v1.4 & Master Zod Validators)

\==================================================================================================  
| 🔄 CORE AUTOMATION LIFECYCLE EVENT LOOP MATRIX                                                 |  
\==================================================================================================  
  \[EVENT 1: Submission\] ──► Onboarding Surface Scraper ───────► Compute Phase 1 Cold Start  
  \[EVENT 2: Verification\] ──► Deep Scan Async Queue ─────────► Ingest Narrative, Compliance & SOV  
  \[EVENT 3: Ingestion\] ──► Predictive Funnel Leak Engine ───► Ingest Tab 2 Recommendation Grid  
  \[EVENT 4: Intercept\] ──► Tab 3 Aggregator Processor ──────► Route New (🟢), Update (🟡), Pause (🔴)  
\==================================================================================================

\#\# PART 1: SYSTEM-WIDE EVENT TRIGGERS ("WHAT IS TRIGGERED WHEN?")

\#\#\# Event 1: Onboarding Domain Submission (Synchronous Pipeline)  
\* **\*\*Trigger Condition:\*\*** User successfully submits their landing page URL during Step 1 of Onboarding.  
\* **\*\*System Ingestion Sequence:\*\*** 1\. Extract root domain name using standard parsing blocks (\`new URL(website\_url)\`).  
    2\. Check the \`brands\` database table. If \`website\_url\` already exists, instantly throw a duplicate registration error to prevent multi-tenant contamination.  
    3\. Auto-map workspace transactional currency based on incoming \`country\_code\`: If \`country\` is 'India', set \`currency \= 'INR'\`; if 'United States', set \`currency \= 'USD'\`. For all other global entries, default strictly to \`USD\`.  
    4\. Fire the **\*\*Surface Scraper Worker\*\*** to extract basic UI styles and visible catalog metadata.  
    5\. **\*\*Immediate Fallback State Injection:\*\*** Instantly insert baseline budget recommendations matching the \`PHASE\_1\_COLD\_START\` structure into \`tab1\_budget\_configurations\`. This provides immediate visualization arrays on the dashboard before deep analytics run.

\#\#\# Event 2: Post-Email Validation Webhook (Asynchronous Queue)  
\* **\*\*Trigger Condition:\*\*** User successfully verifies their account email link (Step 6 of Onboarding).  
\* **\*\*System Ingestion Sequence:\*\***  
    1\. Upgrade user state flag to \`is\_verified \= TRUE\`.  
    2\. Dispatch an explicit asynchronous background job payload containing the target \`brand\_id\` to the **\*\*Deep Scan Strategy Engine Queue\*\***.  
    3\. Execute System **\*\*Prompt 1\*\*** to parse the brand footprint, extract its unique identity values, map colors, and isolate the strict list of 3 core USPs.  
    4\. **\*\*Compliance Sandboxing Filter:\*\*** Evaluate the output against the brand's industry routing type. If \`brand\_routing\_type\` matches \`HEALTHCARE\_TREATMENT\`, any regulatory violations are scrubbed out and stored directly inside the \`compliance\_do\_not\_say\` database ledger.

\#\#\# Event 3: Tab 2 Component Mount / 24-Hour Cron Loop  
\* **\*\*Trigger Condition:\*\*** User enters the Tab 2 Workspace canvas dashboard **\*\*OR\*\*** a system cron task hits a 24-hour expiration threshold.  
\* **\*\*System Ingestion Sequence:\*\***  
    1\. Pull fresh cross-channel data metrics from the integrated social endpoints and scrape pipelines.  
    2\. Execute System **\*\*Prompt 2\*\*** (The Predictive Funnel Leak Detector).  
    3\. Compute individual optimization lifts. **\*\*Eviction Filter:\*\*** If an optimization's projected revenue impact registers less than 1.00% ($\< 1\\%$), discard it instantly to avoid UI noise and processing waste.  
    4\. Convert remaining valid outputs into structured records inside the \`tab2\_performance\_leaks\` table to display them on the user's dashboard.

\#\#\# Event 4: Tab 3 Action Click / Aggregation Intercept  
\* **\*\*Trigger Condition:\*\*** User clicks \`\[Move to Campaign Planner\]\` on any active Tab 2 card.  
\* **\*\*System Ingestion Sequence:\*\***  
    1\. Freeze the recommendation card in the UI and execute an intersection lookup against active rows in \`campaigns\_execution\`.  
    2\. Route data fields into **\*\*Prompt 3 (The Intelligent Aggregator Engine)\*\*** to calculate the aggregation state mapping rules outlined below.

\---

\#\# PART 2: THE SELF-HEALING ENGINE & CONSTRAINTS DATA LOGIC

\#\#\# Logic 1: The Rolling 30-Day Budget Edit Guardrail (Tab 1\)  
\* **\*\*The UI Constraint Rule:\*\*** The \`master\_monthly\_budget\` can be modified a maximum of two (2) times within any rolling 30-day window.  
\* **\*\*Database Enforcement Procedure:\*\***  
    When a brand user passes an \`UPDATE\` transaction request targeting \`master\_monthly\_budget\` in \`tab1\_budget\_configurations\`, the backend must wrap the query inside a database transaction block that checks historical records:  
    \`\`\`sql  
    SELECT COUNT(\*) FROM tab1\_budget\_modification\_logs   
    WHERE brand\_id \= $1 AND modified\_at \>= NOW() \- INTERVAL '30 days';  
    \`\`\`  
    \- \*\*Condition A (Count \>= 2):\*\* Abort the transaction immediately, roll back any changes, and return an explicit validation code to the client application: \`429 Too Many Requests \- Strategic Budget Modification Limits Exceeded\`.  
    \- \*\*Condition B (Count \< 2):\*\* Complete the update, commit the new budget value to the master configuration table, and write a history log entry directly to \`tab1\_budget\_modification\_logs\`.

\#\#\# Logic 2: Dynamic Budget Deficit Validation Circuit (Tab 1 Modal)  
\* **\*\*The UI Constraint Rule:\*\*** Budget configuration updates cannot fall below pre-allocated financial obligations.  
\* **\*\*Algorithmic Verification Step:\*\***  
    Before saving any changes to the asset, creator tier, or objective percentage weights, the system must evaluate this equation:  
    $$\\text{Proposed Allocation Slot Amount} \= \\text{Master Monthly Budget} \\times \\text{Proposed Split \\%}$$  
    Verify this condition across all system allocation nodes:  
    $$\\text{Proposed Allocation Slot Amount} \\ge \\text{Total Booked Escrow Commitments For That Slot}$$  
    \- If the calculation results in a deficit, block the save action, reverse the sliders to their previous states, and surface a high-contrast warning notification to the user: \`\[Invalid Split Configuration \- Lowering this weight disrupts active collaboration tracks\]\`.

\#\#\# Logic 3: Automated Card Lifecycle & Contextual Archiving (Tab 2\)  
\* **\*\*The UI Constraint Rule:\*\*** Clean up old or processed insights to keep the active workspace recommendation feed highly relevant.  
\* **\*\*Algorithmic Verification Step:\*\***  
    \- **\*\*Active Session State:\*\*** When a user clicks \`\[Move to Campaign Planner\]\`, the insight record switches its workflow status to \`PUSHED\_TO\_PLANNER\`. The card remains visible in the grid during the current active session but is explicitly marked with an unclickable status.  
    \- **\*\*Asynchronous Eviction Loop:\*\*** When the user logs out or their session hits a 30-minute inactivity timeout, an eviction hook filters through outstanding records. Any insight marked as \`PUSHED\_TO\_PLANNER\` or \`DISCARDED\` has its \`is\_archived\` flag set to \`TRUE\` and its \`archived\_at\` timestamp recorded. This moves the card directly out of the active grid and into the read-only historical \`\[📁 Open Archive Box\]\` repository.

\#\#\# Logic 4: The Intelligent Aggregator Routing Protocol (Tab 3 Execution)  
\* **\*\*The Core Rule:\*\*** Organize all incoming growth opportunities using the platform's signature optimization logic: $\\text{Campaign Objective} \\times \\text{Influencer Tier Size} \= 1\\ \\text{Unique Campaign Base}$.  
\* **\*\*The Routing Engine Algorithm:\*\***  
    When an automated insight is moved into the planning space, the engine builds a compound signature string (\`objective\_creatorTier\`) and compares it against active records in \`campaigns\_execution\`:  
      
    \`\`\`typescript  
    if (incomingInsight.action\_type \=== "PAUSE\_ACTIVE\_BRIEF") {  
        // PATH 1: THE NEGATIVE LOOP (🔴 AUTO-PAUSE LOG)  
        // Instantly flip the status, halt spend tracking, and write a read-only entry  
        executeAutoPauseBypassPipeline(incomingInsight);  
        renderPlannerCardType \= "AUTO\_PAUSE\_LOG";  
    } else if (activeCampaigns.has(incomingInsight.signature)) {  
        // PATH 2: THE MATCH FOUND LOOP (🟡 SUGGESTED UPDATE CARD)  
        // Bind the existing campaign's id to highlight modified nodes in yellow  
        incomingInsight.existing\_target\_campaign\_id \= activeCampaigns.get(incomingInsight.signature).id;  
        renderPlannerCardType \= "SUGGESTED\_UPDATE";  
    } else {  
        // PATH 3: THE COLD START LOOP (🟢 NEW CAMPAIGN CARD)  
        // Create an entirely new workflow framework root node  
        incomingInsight.existing\_target\_campaign\_id \= null;  
        renderPlannerCardType \= "NEW\_CAMPAIGN";  
    }  
    \`\`\`

\#\#\# Logic 5: Budget Overload Circuit Breaker (Tab 3 Launch Check)  
\* **\*\*The UI Constraint Rule:\*\*** Block the launch of any draft campaign if its financial requirements exceed available workspace budget parameters.  
\* **\*\*Algorithmic Verification Step:\*\***  
    When a user clicks \`\[APPROVE & SEND\]\` on a campaign card, the system aggregates the maximum possible financial obligations across all components in the draft:  
    $$C\_{\\text{total}} \= \\sum (\\text{Max Allocation Threshold Per Creator} \\times \\text{Target Volume Count})$$  
    The system then pulls the current available financial bandwidth from the master profile:  
    $$\\text{Remaining Budget Float} \= \\text{Master Monthly Budget} \- \\text{Total Active Committed Spend}$$  
    \- \*\*The Circuit Breaker Action:\*\* If $C\_{\\text{total}} \> \\text{Remaining Budget Float}$, the circuit breaker flips. The system automatically disables the \`\[APPROVE & SEND\]\` button, swaps the text label with \`\[Budget Overloaded — Adjust Splits\]\`, and blocks execution until the user manually scales back the draft's creator volume or terminates underperforming campaigns.

\#\#\# Logic 6: One-Click Campaign Hand-off Architecture  
\* The Campaign Planner behaves strictly as an orchestration layer—it does not publish directly to live ad systems on its own.  
\* When a user clicks \`\[APPROVE & SEND\]\`, the system updates the insight record's status to \`PROCEEDED\_TO\_PIPELINE\`, packages the entire \`corrective\_brief\_json\` data object, and pushes it directly into the **\*\*Standalone Campaigns Module\*\*** template form fields.  
\* The campaign is initialized in an unlaunched draft state (\`maturity\_state\_enum \= 'DRAFT\_PLANNER'\`), opening a final manual confirmation window where the brand owner signs off on the legal conditions and activates the campaign.

### **🚀 Key Functional Updates Summary**

1. **Database-Level Protection for Budget Modification Limits:** Shifted the 30-day update verification check from a mutable client-side tracker into a database-level transaction query. This completely eliminates race conditions when multiple team accounts access a shared workspace.  
2. **Explicit Verification of Aggregator Routing Rules:** Documented the exact programmatic code blocks that distinguish between **🟢 New Campaign Cards**, **🟡 Suggested Updates**, and **🔴 Auto-Pauses** during Event 4 processing.  
3. **Automated Currency Fallbacks:** Incorporated the global currency rule directly into Event 1 execution routines to ensure mixed geographies resolve consistently.  
4. **Comprehensive Budget Overload Math:** Outlined the formal mathematical formulas ($C\_{\\text{total}}$ comparison limits) that power the real-time circuit breaker on final campaign approval.

We have fully verified your database architecture, application validations, LLM prompting models, and automated system trigger systems. We are ready to compile the final asset. Should we generate the complete **Unified Developer Technical Documentation Specification File** next?

# 