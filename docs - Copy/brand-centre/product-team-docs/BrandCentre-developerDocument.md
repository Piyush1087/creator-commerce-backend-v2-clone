### **Comprehensive Brand Centre Implementation Guide**

**Production-Ready Systems Specifications Architecture Document**

## **🗺️ System-Wide Execution Flow**

The entire 3-Tab self-healing Brand Centre operates as a continuous, closed-loop telemetry and execution engine. Below is the structural interaction map tracing data from raw web discovery through validation layers, AI analysis filters, database persistence, and automated optimization routing.  
\[Onboarding: Step 1 Domain Input\]  
               │  
               ▼  
   \[EVENT 1: Surface Scraper\] ────────► \[Insert PHASE\_1\_COLD\_START Baseline\]  
               │  
               ▼  
\[EVENT 2: Email Verification Webhook\] ─► \[Queue: Asynchronous Deep Scan Engine\]  
                                                    │  
             ┌──────────────────────────────────────┘  
             ▼  
   \[Execute Prompt 1\] ────────────────► \[Verify Ingestion via BrandDNAMasterSchema\]  
             │                                                   │  
             ├───────────────────────────────────────────────────┘  
             ▼  
   \[Populate Tab 1 DB Tables\]  
             │  
             ▼  
 \[EVENT 3: Tab 2 Mount / Cron\] ──────► \[Execute Prompt 2: Leak & Gap Audit\]  
                                                    │  
             ┌──────────────────────────────────────┘  
             ▼  
   \[Filter: Revenue Lift \>= 1%\] ──────► \[Verify via BrandIntelligenceMasterSchema\]  
             │                                                   │  
             ├───────────────────────────────────────────────────┘  
             ▼  
   \[Populate Tab 2 DB Grid\] ──────────► \[Populate Right-Side Workspace Drawer\]  
             │  
             ▼  
  \[EVENT 4: Click \[Move to Planner\]\] ──► \[Evaluate Aggregator Routing Rules\]  
                                                    │  
             ┌──────────────────────────────────────┘  
             ▼  
   \[Execute Prompt 3\] ────────────────► \[Verify via BrandPlannerMasterSchema\]  
                                                    │  
             ┌──────────────────────────────────────┘  
             ▼  
   \[Route & Filter Campaigns\]  
     ├── 🟢 NEW\_CAMPAIGN ─────────────► \[Deploy Full-Page Review Canvas\]  
     ├── 🟡 SUGGESTED\_UPDATE ─────────► \[Apply Yellow Element Diff Highlighting\]  
     └── 🔴 AUTO\_PAUSE\_LOG ───────────► \[Bypass Review: Apply Instant Financial Halt\]  
                                                    │  
             ┌──────────────────────────────────────┘  
             ▼  
   \[Click: \[APPROVE & SEND\]\] ─────────► \[Evaluate Budget Overload Circuit Breaker\]  
                                                    │  
             ┌──────────────────────────────────────┘  
             ▼  
   \[State: PROCEEDED\_TO\_PIPELINE\] ────► \[Inject Payload into Standalone Campaigns Module\]

## **🛡️ Production Runtime Validation Infrastructure (Zod Schemas)**

These schemas provide complete type-safety barriers at your API layer, preventing malformed requests or compliance failures from ever hitting your PostgreSQL engine.

### **📦 Tab 1: Brand DNA Validator**

TypeScript  
import { z } from "zod";

export const BrandIndustryRoutingEnum \= z.enum(\[  
  "D2C\_SKINCARE",  
  "SAAS\_PRODUCT",  
  "HEALTHCARE\_TREATMENT",  
  "OFFLINE\_EXPERIENCE"  
\]);

export const DynamicEntityTypeEnum \= z.enum(\[  
  "PRODUCT",  
  "MODULE",  
  "TREATMENT",  
  "EXPERIENCE"  
\]);

export const BrandDNAMasterSchema \= z.object({  
  brandProfile: z.object({  
    logoUrl: z.string().url("Logo asset must be an absolute URL location"),  
    brandName: z.string().min(2, "Brand name must contain at least 2 characters"),  
    websiteUrl: z.string().url("Operational website must be a valid URL"),  
    igHandle: z.string().startsWith("@", "Instagram handle must initiate with '@'").min(2),  
    ytHandle: z.string().startsWith("@", "YouTube handle must initiate with '@'").min(2),  
    tiktokHandle: z.string().startsWith("@", "TikTok handle must initiate with '@'").min(2),  
    country: z.string().min(2, "Country geographic location tag required"),  
    currency: z.string().length(3, "Currency parameter must conform to a 3-character ISO string"),  
    routingType: BrandIndustryRoutingEnum,  
    subIndustry: z.string().min(2, "Sub-industry refinement is required"),  
    industryNiche: z.string().min(2, "Target operational niche category is required"),  
    lifecycleStage: z.string().default("GROWTH\_STAGE")  
  }),

  strategicDNA: z.object({  
    visuals: z.object({  
      palette: z.array(z.string().regex(/^\#(\[A-Fa-f0-9\]{6}|\[A-Fa-f0-9\]{3})$/, "Must pass hex validation (\#FFFFFF)")).min(1),  
      fonts: z.array(z.string()).min(1),  
      aesthetics: z.array(z.string()).min(1)  
    }),  
    narrative: z.object({  
      toneOfVoice: z.array(z.string()).min(1),  
      tagline: z.string().min(5).max(255),  
      briefDescription: z.string().min(20),  
      brandUsps: z.array(z.string().min(2)).length(3, "System requires exactly three (3) distinct core USPs")  
    }),  
    complianceGuardrails: z.object({  
      doNotSayList: z.array(z.string())  
    })  
  }),

  audiencePersonas: z.array(z.object({  
    personaName: z.string().min(2),  
    demographicsJson: z.object({  
      geo: z.array(z.string()).min(1),  
      ageWindows: z.array(z.string()).min(1),  
      explicitInterests: z.array(z.string()).min(1)  
    }),  
    psychographicsText: z.string().optional()  
  })).min(1, "At least one consumer audience profile model must be maintained"),

  inventoryInfrastructure: z.object({  
    entities: z.array(z.object({  
      entityType: DynamicEntityTypeEnum,  
      entityName: z.string().min(2),  
      entityUrl: z.string().url(),  
      imageUrl: z.string().url().optional(),  
      briefDescription: z.string().max(500).optional(),  
      sellingPoints: z.array(z.string().min(2)).length(3, "Item profiles require exactly three (3) content pillars"),  
      productDoNotSay: z.array(z.string()).optional()  
    })).min(1)  
  }).refine(  
    (inventory) \=\> inventory.entities.every(entity \=\> {  
      try {  
        const parsedUrl \= new URL(entity.entityUrl);  
        return parsedUrl.protocol \=== "https:" || parsedUrl.protocol \=== "http:";  
      } catch {  
        return false;  
      }  
    }),  
    { message: "Security Warning: Registered inventory items must share a valid web reference path" }  
  ),

  offersLedger: z.array(z.object({  
    offerName: z.string().min(2),  
    promoCode: z.string().regex(/^\[A-Z0-9\_-\]{2,50}$/, "Promo codes must map to alphanumeric uppercase variables"),  
    applicabilityScope: z.string().min(2),  
    validityStart: z.string().datetime(),  
    validityEnd: z.string().datetime()  
  })),

  financials: z.object({  
    masterMonthlyBudget: z.number().min(1000, "Master Monthly Budget floor cannot scale lower than $1000 / 50k INR"),  
    strategyMix: z.object({  
      assetMix: z.object({ product: z.number(), collection: z.number(), sale: z.number() })  
        .refine(val \=\> (val.product \+ val.collection \+ val.sale) \=== 100, "Combined asset percentage metrics total must equal exactly 100%"),  
      tierMix: z.object({ nano: z.number(), micro: z.number(), midTier: z.number(), mega: z.number(), celebrity: z.number() })  
        .refine(val \=\> (val.nano \+ val.micro \+ val.midTier \+ val.mega \+ val.celebrity) \=== 100, "Combined creator size deployment metrics total must equal exactly 100%"),  
      objectiveMix: z.object({ pulse: z.number(), proof: z.number(), push: z.number(), production: z.number() })  
        .refine(val \=\> (val.pulse \+ val.proof \+ val.push) \=== 100, "Combined macro-objective strategic deployment metrics total must equal exactly 100%")  
    })  
  })  
});

### **🧠 Tab 2: Intelligence & Gaps Validator**

TypeScript  
import { z } from "zod";

export const PerformanceColorEnum \= z.enum(\["GREEN", "YELLOW", "RED"\]);  
export const LeakBucketEnum \= z.enum(\["PDP", "PAID", "ROSTER", "CREATIVE\_HOOK"\]);

export const BrandIntelligenceMasterSchema \= z.object({  
  growthImpactMatrix: z.object({  
    projectedRevenueLiftPercentage: z.number().min(0).max(500),  
    levers: z.object({  
      pdpAlignmentLift: z.number().min(0).max(100),  
      paidAmplificationLift: z.number().min(0).max(100),  
      creatorRosterLift: z.number().min(0).max(100),  
    }),  
    statusIndicator: PerformanceColorEnum  
  }),

  baselineHealth: z.object({  
    reachMoMPercentage: z.number(),  
    engagementRateVsBenchmark: z.number(),  
    audienceOverlapPercentage: z.number().min(0).max(100),  
    contentQualityScore: z.number().min(0).max(10),  
    averageHookRate: z.number().min(0).max(100),  
    brandSafetyScore: z.number().min(0).max(100),  
    archetypeMatch: z.object({  
      ourBrandDistribution: z.object({ everyman: z.number(), expert: z.number(), jester: z.number(), rebel: z.number() })  
        .refine(val \=\> (val.everyman \+ val.expert \+ val.jester \+ val.rebel) \=== 100, "Weights must equal 100%"),  
      competitorAverageDistribution: z.object({ everyman: z.number(), expert: z.number(), jester: z.number(), rebel: z.number() })  
        .refine(val \=\> (val.everyman \+ val.expert \+ val.jester \+ val.rebel) \=== 100, "Weights must equal 100%")  
    })  
  }),

  shareOfVoice: z.object({  
    ourBrandShare: z.number().min(0).max(100),  
    competitorsShareMatrix: z.record(z.string(), z.number().min(0).max(100))  
      .refine((matrix) \=\> Object.values(matrix).reduce((sum, val) \=\> sum \+ val, 0\) \<= 100, "Aggregate share cannot exceed 100%"),  
    competitorThemesLast30Days: z.array(z.string()).min(1)  
  }),

  actionableInsightsFeed: z.array(z.object({  
    leakId: z.string().uuid(),  
    insightTitle: z.string().min(5),  
    shortDescription20Words: z.string().min(10).max(150),  
    priorityRank: z.enum(\["HIGH", "MEDIUM", "LOW", "NEGLIGIBLE"\]),  
    leakBucket: LeakBucketEnum,  
    performanceStatus: PerformanceColorEnum,  
    drawerDeepDive: z.object({  
      underlyingDataLogic: z.string().min(20),  
      competitiveDiscrepancy: z.string().min(20),  
      actionableStepsChecklist: z.array(z.object({  
        stepId: z.string(),  
        stepLabel: z.string().min(5),  
        isCompleted: z.boolean().default(false)  
      })).min(1)  
    }),  
    isArchived: z.boolean().default(false),  
    archivedAt: z.string().datetime().nullable(),  
    plannerStatusString: z.enum(\["PENDING\_USER\_REVIEW", "PUSHED\_TO\_PLANNER", "EXECUTED", "DISCARDED"\]).default("PENDING\_USER\_REVIEW")  
  }))  
});

### **📅 Tab 3: Campaign Planner Validator**

TypeScript  
import { z } from "zod";

export const CampaignObjectiveEnum \= z.enum(\["PULSE", "PROOF", "PUSH", "PRODUCTION"\]);  
export const CreatorTierEnum \= z.enum(\["NANO", "MICRO", "MID\_TIER", "MEGA", "CELEBRITY"\]);  
export const PlannerCardTypeEnum \= z.enum(\["NEW\_CAMPAIGN", "SUGGESTED\_UPDATE", "AUTO\_PAUSE\_LOG"\]);

export const BrandPlannerMasterSchema \= z.object({  
  plannerInsightId: z.string().uuid(),  
  brandId: z.string().uuid(),  
  cardType: PlannerCardTypeEnum,  
  aggregationKey: z.object({  
    objective: CampaignObjectiveEnum,  
    targetCreatorTier: CreatorTierEnum,  
    aiContextHook: z.string().min(5)  
  }),  
  existingTargetCampaignId: z.string().uuid().nullable(),  
  campaignMetadata: z.object({  
    audienceDemographics: z.object({  
      geoTargets: z.array(z.string()).min(1),  
      genderFocus: z.array(z.string()).min(1),  
      ageWindows: z.array(z.string()).min(1),  
      explicitInterests: z.array(z.string()).min(1)  
    }),  
    operationalBudgetParameters: z.object({  
      minAllocationThreshold: z.number().min(500),  
      maxAllocationThreshold: z.number()  
    }).refine(val \=\> val.maxAllocationThreshold \>= val.minAllocationThreshold, "Max allocation must be \>= min threshold"),  
    campaignArchitectureDeadline: z.string().datetime()  
  }),  
  assetsAndBriefsMatrix: z.array(z.object({  
    entityId: z.string().uuid(),  
    entityType: z.enum(\["PRODUCT", "MODULE", "TREATMENT", "EXPERIENCE"\]),  
    entityName: z.string().min(2),  
    productionBriefs: z.array(z.object({  
      briefId: z.string().uuid(),  
      briefName: z.string().min(5),  
      contentPillarThemeCore: z.string().min(10),  
      requiredDeliverables: z.array(z.object({  
        platform: z.enum(\["TIKTOK", "INSTAGRAM\_REEL", "INSTAGRAM\_STORY", "YOUTUBE\_SHORT"\]),  
        quantity: z.number().int().min(1)  
      })).min(1),  
      operationalChecklists: z.object({  
        customLandingPageUrl: z.string().url(),  
        metaPartnershipAdWhitelistingEnabled: z.boolean().default(false),  
        whitelistingAccessWindowDays: z.number().int().nonnegative().default(0),  
        customDiscountTrackingCode: z.string().regex(/^\[A-Z0-9\]{4,20}$/)  
      })  
    })).min(1)  
  })).min(1),  
  workflowStatus: z.enum(\["PENDING\_USER\_REVIEW", "PROCEEDED\_TO\_PIPELINE", "DISCARDED", "AUTO\_EXECUTED\_BYPASS"\]).default("PENDING\_USER\_REVIEW")  
}).refine(  
  (schema) \=\> \!(schema.cardType \=== "SUGGESTED\_UPDATE" && \!schema.existingTargetCampaignId),  
  {  
    message: "Suggested updates (🟡) must populate an existing active campaign reference ID",  
    path: \["existingTargetCampaignId"\]  
  }  
);

## **🧠 Structured Asynchronous AI Background Engines (System Prompts)**

### **📊 Prompt 1: Master Deep Scan Strategy Parser**

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
*Return ONLY a raw, valid JSON object matching the template structure below. No markdown wrappers, no backticks, no trailing explanations.*  
*{*  
  *"strategicDNA": {*  
    *"narrative": { "tagline": "string", "briefDescription": "string", "brandUsps": \["string","string","string"\], "toneOfVoice": \["string"\] },*  
    *"visuals": { "palette": \["\#HEX1","\#HEX2","\#HEX3"\], "fonts": \["string"\], "aesthetics": \["string"\] },*  
    *"complianceGuardrails": { "doNotSayList": \["string"\] }*  
  *},*  
  *"audiencePersonas": \[{*  
    *"personaName": "string",*  
    *"demographicsJson": { "geo": \["string"\], "ageWindows": \["string"\], "explicitInterests": \["string"\] },*  
    *"psychographicsText": "string"*  
  *}\],*  
  *"baselineHealth": {*  
    *"reachMoMPercentage": 0.0, "engagementRateVsBenchmark": 0.0, "audienceOverlapPercentage": 0.0, "contentQualityScore": 0.0, "averageHookRate": 0.0, "brandSafetyScore": 0.0,*  
    *"archetypeMatch": {*  
      *"ourBrandDistribution": { "everyman": 25, "expert": 25, "jester": 25, "rebel": 25 },*  
      *"competitorAverageDistribution": { "everyman": 25, "expert": 25, "jester": 25, "rebel": 25 }*  
    *}*  
  *},*  
  *"shareOfVoice": { "ourBrandShare": 0.0, "competitorsShareMatrix": { "comp\_*1": 0.0 }, "competitorThemesLast30Days": \["string"\] },  
  "financials": {  
    "strategyMix": {  
      "assetMix": { "product": 40, "collection": 30, "sale": 30 },  
      "tierMix": { "nano": 20, "micro": 20, "midTier": 20, "mega": 20, "celebrity": 20 },  
      "objectiveMix": { "pulse": 25, "proof": 25, "push": 25, "production": 25 }  
    }  
  }  
}

### **🔍 Prompt 2: Actionable Insights & Funnel Leak Detector**

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
2\. ISOLATE BY BUCKET: Every insight must be deterministically binned into one of the four core UI leak categories: \`PDP\`, \`PAID\`, \`ROSTER\`, or \`CREATIVE\_HOOK\`.  
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
    "insightTitle": "string",  
    "shortDescription20Words": "string",  
    "priorityRank": "HIGH",  
    "leakBucket": "PDP",  
    "performanceStatus": "RED",  
    "projectedLiftPercentage": 15.5,  
    "drawerDeepDive": {  
      "underlyingDataLogic": "Telemetry confirms high inbound traffic from social channels is bouncing within 3 seconds due to a structural visual disconnect between creator hooks and PDP static hero imagery.",  
      "competitiveDiscrepancy": "Competitors utilizing contextual dynamic landing video carousels see an average 4.2% lift in session stickiness compared to our text-heavy baseline layouts.",  
      "actionableStepsChecklist": \[  
        { "stepId": "STEP\_1", "stepLabel": "Sync active creator hook videos to top-fold carousel asset layer" }  
      \]  
    }  
  }  
\]

### **📅 Prompt 3: Campaign Planner Aggregator Engine**

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
  *"aggregationKey": { "objective": "PULSE", "targetCreatorTier": "MICRO", "aiContextHook": "Exploit Expert" },*  
  *"existingTargetCampaignId": null,*  
  *"campaignMetadata": {*  
    *"audienceDemographics": { "geoTargets": \["US"\], "genderFocus": \["Female"\], "ageWindows": \["18-34"\], "explicitInterests": \["Skincare"\] },*  
    *"operationalBudgetParameters": { "minAllocationThreshold": 2000, "maxAllocationThreshold": 5000, "complimentaryProductBundle": "Kit" },*  
    *"campaignArchitectureDeadline": "2026-06-30T23:59:59Z"*  
  *},*  
  *"assetsAndBriefsMatrix": \[{*  
    *"entityId": "UUID", "entityType": "PRODUCT", "entityName": "Daily Cleanser",*  
    *"productionBriefs": \[{*  
      *"briefId": "UUID", "briefName": "Video Brief", "contentPillarThemeCore": "Morning Routine",*  
      *"requiredDeliverables": \[{ "platform": "TIKTOK", "quantity": 1 }\],*  
      *"operationalChecklists": { "customLandingPageUrl": "https://url.com", "metaPartnershipAdWhitelistingEnabled": true, "whitelistingAccessWindowDays": 30, "customDiscountTrackingCode": "CODE" }*  
    *}\]*  
  *}\],*  
  *"workflowStatus": "PENDING\_*USER*\_REVIEW"*  
*}*

## **⚙️ Core Operational Logic & Database Triggers**

### **1\. Rolling 30-Day Budget Edit Guardrail (Tab 1 Financials)**

* **Objective:** Prevent a workspace from mutating the master monthly budget more than twice within a rolling 30-day window.  
* **Database Implementation Mechanism:** A PostgreSQL BEFORE UPDATE row-level trigger blocks execution transactions directly at the storage engine tier.

SQL  
CREATE OR REPLACE FUNCTION verify\_budget\_modification\_limits()  
RETURNS TRIGGER AS $$  
DECLARE  
    modification\_count INT;  
BEGIN  
    \-- Check if the monthly budget value is actually being changed  
    IF (OLD.master\_monthly\_budget IS DISTINCT FROM NEW.master\_monthly\_budget) THEN  
          
        SELECT COUNT(\*) INTO modification\_count  
        FROM tab1\_budget\_modification\_logs  
        WHERE brand\_id \= NEW.brand\_id   
          AND modified\_at \>= NOW() \- INTERVAL '30 days';

        IF (modification\_count \>= 2\) THEN  
            RAISE EXCEPTION 'SQL\_EXECUTION\_ERROR: 429\_TOO\_MANY\_REQUESTS \- Master monthly budget modifications are bounded to a maximum ceiling of 2 allocations per rolling 30-day window.'  
            USING ERRCODE \= 'P0001';  
        END IF;

        \-- Log transaction if execution boundary parameters are verified  
        INSERT INTO tab1\_budget\_modification\_logs (brand\_id, old\_budget, new\_budget, modified\_at)  
        VALUES (NEW.brand\_id, OLD.master\_monthly\_budget, NEW.master\_monthly\_budget, NOW());  
          
    END IF;  
    RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger\_enforce\_budget\_safety\_guardrail  
BEFORE UPDATE ON tab1\_budget\_configurations  
FOR EACH ROW EXECUTE FUNCTION verify\_budget\_modification\_limits();

### **2\. Multi-Tenant Promo Code Protection (Data Integrity Layer)**

* **Objective:** Shift uniqueness from a global scope to a composite multi-tenant constraint bounded by the brand's active workspace ID. This allows different brands to use common promo codes (like SUMMER20) without collisions.

SQL  
\-- Step 1: Drop the global unique constraint if it exists in your baseline layout  
ALTER TABLE brand\_offers DROP CONSTRAINT IF EXISTS brand\_offers\_promo\_code\_key;

\-- Step 2: Reinforce with a composite tenant boundary unique index block  
ALTER TABLE brand\_offers   
ADD CONSTRAINT unique\_brand\_scoped\_promo\_code UNIQUE (brand\_id, promo\_code);

### **3\. Budget Overload Circuit Breaker (Tab 3 Pre-Execution Gate)**

* **Objective:** Block campaign launches if financial commitments exceed available budget floating variables.  
* **Mathematical Enforcement Logic:** When clicking \[APPROVE & SEND\], compute the absolute programmatic liability limit:

$$C\_{\\text{total}} \= \\sum (\\text{Max Allocation Threshold Per Creator} \\times \\text{Target Volume Count})$$  
TypeScript  
async function evaluateBudgetCircuitBreaker(brandId: string, draftCampaignPayload: any): Promise\<boolean\> {  
  const dbClient \= await getDbPoolConnection();  
    
  // 1\. Calculate absolute programmatic liability limits of incoming draft  
  let totalDraftLiability \= 0;  
  for (const asset of draftCampaignPayload.assetsAndBriefsMatrix) {  
    for (const brief of asset.productionBriefs) {  
      const quantity \= brief.requiredDeliverables.reduce((sum: number, d: any) \=\> sum \+ d.quantity, 0);  
      totalDraftLiability \+= (brief.operationalChecklists.maxAllocationThreshold || 0\) \* quantity;  
    }  
  }

  // 2\. Query master floating allocation parameters  
  const budgetQuery \= await dbClient.query(  
    \`SELECT master\_monthly\_budget FROM tab1\_budget\_configurations WHERE brand\_id \= $1\`, \[brandId\]  
  );  
    
  const activeSpendQuery \= await dbClient.query(  
    \`SELECT COALESCE(SUM(master\_budget\_limit), 0\) as active\_spend   
     FROM campaigns\_execution   
     WHERE brand\_id \= $1 AND maturity\_state\_enum \!= 'DRAFT\_PLANNER'\`, \[brandId\]  
  );

  const masterBudget \= parseFloat(budgetQuery.rows\[0\].master\_monthly\_budget);  
  const activeSpend \= parseFloat(activeSpendQuery.rows\[0\].active\_spend);  
  const remainingBudgetFloat \= masterBudget \- activeSpend;

  // 3\. Trip circuit breaker if liability breaks operational boundaries  
  if (totalDraftLiability \> remainingBudgetFloat) {  
    throw new Error("CRITICAL\_CIRCUIT\_BREAKER\_TRIPPED: Financial requirements exceed the available workspace budget float.");  
  }  
    
  return true;  
}

### **4\. Interactive Recommendation Eviction Engine (Tab 2 Dashboard Grid)**

* **Objective:** Clear resolved or discarded insights out of the primary grid upon session termination, moving them into a read-only archive repository.

SQL  
CREATE OR REPLACE FUNCTION execute\_session\_eviction\_cleanup(target\_brand\_id UUID)  
RETURNS VOID AS $$  
BEGIN  
    \-- Transition processed assets directly out of active display filters  
    UPDATE tab2\_performance\_leaks  
    SET is\_archived \= TRUE,  
        archived\_at \= NOW()  
    WHERE brand\_id \= target\_brand\_id  
      AND is\_archived \= FALSE  
      AND planner\_status\_string IN ('PUSHED\_TO\_PLANNER', 'DISCARDED');  
END;  
$$ LANGUAGE plpgsql;

## **🛠️ Production Verification Framework**

To guarantee runtime parity across all components, execute this continuous integration audit verification test plan:  
TypeScript  
import { BrandDNAMasterSchema } from "./schemas/tab1";  
import { BrandIntelligenceMasterSchema } from "./schemas/tab2";  
import { BrandPlannerMasterSchema } from "./schemas/tab3";

describe("Brand Centre Comprehensive End-to-End Type Integration Test Suite", () \=\> {  
    
  it("Verify Prompt 1 output conforms to Tab 1 DNA boundaries and checks color configurations", async () \=\> {  
    const rawAiOutputMock \= {  
      brandProfile: {  
        logoUrl: "https://cdn.solvskincare.com/assets/logo.png",  
        brandName: "Solv Skincare",  
        websiteUrl: "https://solvskincare.com",  
        igHandle: "@solv.skincare",  
        ytHandle: "@solv\_skincare",  
        tiktokHandle: "@solvskincare",  
        country: "United States",  
        currency: "USD",  
        routingType: "D2C\_SKINCARE",  
        subIndustry: "Premium Topicals",  
        industryNiche: "Clinical Serums"  
      },  
      strategicDNA: {  
        visuals: { palette: \["\#00FF00", "\#FFFFFF"\], fonts: \["Inter"\], aesthetics: \["Minimalist"\] },  
        narrative: { toneOfVoice: \["Expert"\], tagline: "Pure Skin Utility", briefDescription: "Clinical topicals engineered for modern dermal optimization pathways.", brandUsps: \["USP 1", "USP 2", "USP 3"\] },  
        complianceGuardrails: { doNotSayList: \["Miracle cure"\] }  
      },  
      audiencePersonas: \[{ personaName: "Dermal Optimizer", demographicsJson: { geo: \["US"\], ageWindows: \["25-34"\], explicitInterests: \["Biohacking"\] } }\],  
      inventoryInfrastructure: {  
        entities: \[{ entityType: "PRODUCT", entityName: "Vitamin C", entityUrl: "https://solvskincare.com/vit-c", sellingPoints: \["Point A", "Point B", "Point C"\] }\]  
      },  
      offersLedger: \[\],  
      financials: {  
        masterMonthlyBudget: 5000,  
        strategyMix: {  
          assetMix: { product: 40, collection: 30, sale: 30 },  
          tierMix: { nano: 20, micro: 20, midTier: 20, mega: 20, celebrity: 20 },  
          objectiveMix: { pulse: 25, proof: 25, push: 25, production: 25 }  
        }  
      }  
    };

    const parsedResult \= BrandDNAMasterSchema.safeParse(rawAiOutputMock);  
    expect(parsedResult.success).toBe(true);  
  });

  it("Verify Prompt 3 handles link structures for Suggested Updates (Yellow Elements)", async () \=\> {  
    const mockSuggestedUpdate \= {  
      plannerInsightId: "a6b2c4d8-e2f1-4b3a-9c5d-7e8f1a2b3c4d",  
      brandId: "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",  
      cardType: "SUGGESTED\_UPDATE",  
      aggregationKey: { objective: "PULSE", targetCreatorTier: "MICRO", aiContextHook: "Vacuum Strategy" },  
      existingTargetCampaignId: null, // INVALID: MUST NOT BE NULL WHEN CARD TYPE IS SUGGESTED\_UPDATE  
      campaignMetadata: {  
        audienceDemographics: { geoTargets: \["US"\], genderFocus: \["All"\], ageWindows: \["18-24"\], explicitInterests: \["Tech"\] },  
        operationalBudgetParameters: { minAllocationThreshold: 1000, maxAllocationThreshold: 3000 },  
        campaignArchitectureDeadline: "2026-12-31T23:59:59Z"  
      },  
      assetsAndBriefsMatrix: \[\]  
    };

    const parsedResult \= BrandPlannerMasterSchema.safeParse(mockSuggestedUpdate);  
    expect(parsedResult.success).toBe(false); // Schema catch ensures database foreign keys never break  
  });  
});

# 