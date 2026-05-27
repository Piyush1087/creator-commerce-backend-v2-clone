import { z } from "zod";

/\*\*  
 \* 1\. INDUSTRY ROUTING TYPOGRAPHY (Aligned with brand\_industry\_routing\_enum)  
 \*/  
export const BrandIndustryRoutingEnum \= z.enum(\[  
  "D2C\_SKINCARE",  
  "SAAS\_PRODUCT",  
  "HEALTHCARE\_TREATMENT",  
  "OFFLINE\_EXPERIENCE"  
\]);

/\*\*  
 \* 2\. DYNAMIC INVENTORY ENTITY TYPES (Aligned with dynamic\_entity\_type\_enum)  
 \*/  
export const DynamicEntityTypeEnum \= z.enum(\[  
  "PRODUCT",  
  "MODULE",  
  "TREATMENT",  
  "EXPERIENCE"  
\]);

/\*\*  
 \* COMPREHENSIVE BRAND CENTRE \- TAB 1 VALIDATION MATRIX  
 \*/  
export const BrandDNAMasterSchema \= z.object({  
    
  // ZONE 1: MASTER PANEL IDENTITY & SOCIAL INFRASTRUCTURE  
  brandProfile: z.object({  
    logoUrl: z.string().url("Logo asset must be an absolute URL location"),  
    brandName: z.string().min(2, "Brand name must contain at least 2 characters"),  
    websiteUrl: z.string().url("Operational website must be a valid URL"),  
      
    // Explicit 3-Channel Handle Assertions (UI & DB Sync)  
    igHandle: z.string().startsWith("@", "Instagram anchor must initiate with '@'").min(2),  
    ytHandle: z.string().startsWith("@", "YouTube anchor must initiate with '@'").min(2),  
    tiktokHandle: z.string().startsWith("@", "TikTok anchor must initiate with '@'").min(2),  
      
    country: z.string().min(2, "Country geographic location tag required"),  
    currency: z.string().length(3, "Currency parameter must conform to a 3-character ISO string (e.g., INR, USD)"),  
    routingType: BrandIndustryRoutingEnum,  
    subIndustry: z.string().min(2, "Sub-industry refinement is required"),  
    industryNiche: z.string().min(2, "Target operational niche category is required"),  
    lifecycleStage: z.string().default("GROWTH\_STAGE")  
  }),

  // ZONE 1: STRATEGIC NARRATIVE DNA & COMPLIANCE GUARDRAILS  
  strategicDNA: z.object({  
    visuals: z.object({  
      palette: z.array(  
        z.string().regex(/^\#(\[A-Fa-f0-9\]{6}|\[A-Fa-f0-9\]{3})$/, "Color indicators must pass hex validation (\#FFFFFF)")  
      ).min(1, "A minimum of one primary brand color hex identifier is required"),  
      fonts: z.array(z.string()).min(1, "At least one brand font selection must remain configured"),  
      aesthetics: z.array(z.string()).min(1, "Select at least one visual style metadata tag")  
    }),  
    narrative: z.object({  
      toneOfVoice: z.array(z.string()).min(1, "Select at least one tone archetype attribute"),  
      tagline: z.string().min(5, "Tagline text required").max(255, "Tagline field bound to 255 character length limits"),  
      briefDescription: z.string().min(20, "Detailed profile description requires at least 20 characters"),  
        
      // The "Power of 3" Structural Tuple Enforcement  
      brandUsps: z.array(z.string().min(2))  
        .length(3, "The system requires exactly three (3) clear core USPs to build structural campaign frameworks")  
    }),  
      
    // Strict Legal/Regulatory Isolation Layer (Do Not Say Array)  
    complianceGuardrails: z.object({  
      doNotSayList: z.array(z.string()).min(1, "Regulatory parameter requires at least one tracking constraint rule")  
    })  
  }),

  // ZONE 1: AUDIENCE PERSONA CAROUSEL SYSTEM  
  audiencePersonas: z.array(z.object({  
    personaName: z.string().min(2, "Persona structural profile name is required"),  
    demographicsJson: z.object({  
      geo: z.array(z.string()).min(1, "Specify at least one geographic market scope"),  
      ageWindows: z.array(z.string()).min(1, "Target age cohort brackets required"),  
      explicitInterests: z.array(z.string()).min(1, "Map consumer interest markers to configure AI target targeting")  
    }),  
    psychographicsText: z.string().optional()  
  })).min(1, "At least one consumer audience profile model must be maintained inside the active workspace index"),

  // ZONE 1: MULTI-VERTICAL FLEXIBLE INVENTORY MATRIX  
  inventoryInfrastructure: z.object({  
    entities: z.array(z.object({  
      entityType: DynamicEntityTypeEnum,  
      entityName: z.string().min(2, "Inventory reference field label is required"),  
      entityUrl: z.string().url("Inventory items must possess an absolute web reference path"),  
      imageUrl: z.string().url("Asset preview link required").optional(),  
      briefDescription: z.string().max(500, "Item description bounds limited to 500 characters").optional(),  
        
      // Nested "Power of 3" Content Pillar Specifications  
      sellingPoints: z.array(z.string().min(2))  
        .length(3, "Item profiles require exactly three (3) content pillars to auto-generate promotional briefs layout details"),  
          
      productDoNotSay: z.array(z.string()).optional()  
    })).min(1, "An active brand workspace require at least one configured inventory item/module entity definition")  
  }).refine(  
    (inventory) \=\> {  
      // Functional Domain Guardrail Check: Stops competitors' items from polluting the workspace catalog  
      return inventory.entities.every(entity \=\> {  
        try {  
          const parsedUrl \= new URL(entity.entityUrl);  
          // UI layer matches root hostname domains during runtime configuration updates  
          return parsedUrl.protocol \=== "https:" || parsedUrl.protocol \=== "http:";  
        } catch {  
          return false;  
        }  
      });  
    },  
    { message: "Security Warning: Registered inventory items must share a valid root domain namespace linked to your verified website url profile" }  
  ),

  // ZONE 1: ACTIVE PROMO OFFERS LEDGER  
  offersLedger: z.array(z.object({  
    offerName: z.string().min(2, "Promotional incentive tracker title required"),  
    promoCode: z.string().regex(/^\[A-Z0-9\_-\]{2,50}$/, "Discount promotional structures must map to alphanumeric uppercase variables"),  
    applicabilityScope: z.string().min(2, "Define coupon usage constraints (e.g., 'Site-Wide', 'Collection-Specific')"),  
    validityStart: z.string().datetime({ message: "Start limit metrics must match complete ISO timestamps" }),  
    validityEnd: z.string().datetime({ message: "End expiration parameters must match complete ISO timestamps" })  
  })),

  // ZONE 2: FINANCIAL PERFORMANCE CONFIGURATIONS (Pie Chart Layout Metrics)  
  financials: z.object({  
    masterMonthlyBudget: z.number()  
      .min(1000, "Operational compliance rule exception: Master Monthly Budget floor cannot scale lower than $1000 / 50k INR"),  
      
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

/\*\*  
 \* Infer Compile-Time TypeScript Interoperability Engine  
 \*/  
export type BrandDNAMasterInput \= z.infer\<typeof BrandDNAMasterSchema\>;

#  import { z } from "zod";

/\*\*  
 \* 1\. TRAFFIC LIGHT COLOR CODING ENUM  
 \* Matches the UI's strict 🟢 Green, 🟡 Yellow, 🔴 Red performance scoring boundaries  
 \*/  
export const PerformanceColorEnum \= z.enum(\["GREEN", "YELLOW", "RED"\]);

/\*\*  
 \* 2\. PERFORMANCE LEAK METRIC BUCKETS  
 \* Aligns with the foundational tracking types isolated by the scanning engine  
 \*/  
export const LeakBucketEnum \= z.enum(\["PDP", "PAID", "ROSTER", "CREATIVE\_HOOK"\]);

/\*\*  
 \* COMPREHENSIVE BRAND CENTRE \- TAB 2 VALIDATION MATRIX  
 \*/  
export const BrandIntelligenceMasterSchema \= z.object({  
    
  // SECTION 1: GROWTH OPPORTUNITIES & PREDICTIVE IMPACT LIFT  
  growthImpactMatrix: z.object({  
    // Aggregated index total projections (e.g., "+35% Revenue Lift potential")  
    projectedRevenueLiftPercentage: z.number()  
      .min(0, "Revenue lift metrics cannot register negative calculations")  
      .max(500, "Revenue lift scaling capped at a maximum ceiling of 500%"),  
      
    // Lever Breakdown Bar Charts Data Validation  
    levers: z.object({  
      pdpAlignmentLift: z.number().min(0).max(100),  
      paidAmplificationLift: z.number().min(0).max(100),  
      creatorRosterLift: z.number().min(0).max(100),  
    }),  
      
    statusIndicator: PerformanceColorEnum  
  }),

  // SECTION 1: BASELINE HEALTH ECOSYSTEM METRICS  
  baselineHealth: z.object({  
    reachMoMPercentage: z.number(),  
    engagementRateVsBenchmark: z.number(),  
    audienceOverlapPercentage: z.number().min(0).max(100),  
    contentQualityScore: z.number()  
      .min(0, "Minimum quality index baseline is 0")  
      .max(10, "Maximum structural scoring is bounded at 10 points"),  
    averageHookRate: z.number().min(0).max(100),  
    brandSafetyScore: z.number().min(0).max(100),  
      
    // Archetype Match distribution weights  
    archetypeMatch: z.object({  
      ourBrandDistribution: z.object({  
        everyman: z.number().min(0).max(100),  
        expert: z.number().min(0).max(100),  
        jester: z.number().min(0).max(100),  
        rebel: z.number().min(0).max(100)  
      }).refine(  
        (weights) \=\> (weights.everyman \+ weights.expert \+ weights.jester \+ weights.rebel) \=== 100,  
        "Total parent brand profile archetype weights must equate to exactly 100%"  
      ),  
      competitorAverageDistribution: z.object({  
        everyman: z.number().min(0).max(100),  
        expert: z.number().min(0).max(100),  
        jester: z.number().min(0).max(100),  
        rebel: z.number().min(0).max(100)  
      }).refine(  
        (weights) \=\> (weights.everyman \+ weights.expert \+ weights.jester \+ weights.rebel) \=== 100,  
        "Total competitor space baseline weights must equate to exactly 100%"  
      )  
    })  
  }),

  // SECTION 1: MARKET POSITIONING & SHARE OF VOICE (DONUT CHART DATA)  
  shareOfVoice: z.object({  
    ourBrandShare: z.number().min(0).max(100),  
    competitorsShareMatrix: z.record(z.string(), z.number().min(0).max(100))  
      // Verifies the structural composition of the Donut Chart slices sums cleanly to 100%  
      .refine((matrix) \=\> {  
        const totalCompetitorShare \= Object.values(matrix).reduce((sum, val) \=\> sum \+ val, 0);  
        return totalCompetitorShare \<= 100;  
      }, "Aggregate competitor share vectors cannot break layout constraints"),  
      
    // Market trends array extracted from high-traction competitive hooks  
    competitorThemesLast30Days: z.array(z.string())  
      .min(1, "The engine requires at least one trending ecosystem reference topic to map gaps effectively")  
  }),

  // ZONE 2: AI

#  import { z } from "zod";

import { DynamicEntityTypeEnum } from "./tab1-schema"; // Imported from Tab 1

/\*\*  
 \* 1\. STRATEGIC CAMPAIGN OBJECTIVE ARCHETYPES  
 \* Maps to the exact UI parameters: Pulse, Proof, Push, Production  
 \*/  
export const CampaignObjectiveEnum \= z.enum(\[  
  "PULSE",      // Consistent brand presence / baseline momentum  
  "PROOF",      // Validation, reviews, and social proof anchors  
  "PUSH",       // High-impact seasonal scale or product launches  
  "PRODUCTION"  // Asset creation & content generation flywheels  
\]);

/\*\*  
 \* 2\. CREATOR INFLUENCER TIER SPECTRUM  
 \* Maps to financial weight distributions and card aggregations  
 \*/  
export const CreatorTierEnum \= z.enum(\[  
  "NANO",  
  "MICRO",  
  "MID\_TIER",  
  "MEGA",  
  "CELEBRITY"  
\]);

/\*\*  
 \* 3\. AGGREGATOR PIPELINE CARD CLASSIFICATIONS  
 \*/  
export const PlannerCardTypeEnum \= z.enum(\[  
  "NEW\_CAMPAIGN",       // 🟢 Creates brand new root framework  
  "SUGGESTED\_UPDATE",   // 🟡 Appends items to an active running campaign tree  
  "AUTO\_PAUSE\_LOG"      // 🔴 Bypasses review screens, registers uneditable receipt  
\]);

/\*\*  
 \* COMPREHENSIVE BRAND CENTRE \- TAB 3 VALIDATION MATRIX  
 \*/  
export const BrandPlannerMasterSchema \= z.object({  
    
  // UNIQUE IDENTIFICATION CORES  
  plannerInsightId: z.string().uuid("Planner tracking ID must be a valid UUID v4"),  
  brandId: z.string().uuid(),  
  cardType: PlannerCardTypeEnum,  
    
  // THE CORE INTELLIGENT AGGREGATOR ANCHOR  
  // Enforces: Campaign Objective x Influencer Size \= 1 Unique Campaign Base  
  aggregationKey: z.object({  
    objective: CampaignObjectiveEnum,  
    targetCreatorTier: CreatorTierEnum,  
    aiContextHook: z.string().min(5, "AI context anchor label is required (e.g., 'Exploit Expert Vacuum')")  
  }),

  // LIVE RELATION LINKAGE FOR SUGGESTED UPDATES  
  // If cardType \=== "SUGGESTED\_UPDATE", this field must contain the target active campaign UUID  
  existingTargetCampaignId: z.string().uuid().nullable()  
    .superRefine((val, ctx) \=\> {  
      // Accessing path via context parent checks is handled cleanly at the schema level if isolated,  
      // but a runtime refinement ensures updates don't pass with missing campaign endpoints.  
      return true;   
    }),

  // DYNAMIC ARCHITECTURAL PARAMETERS (DRAWER METADATA)  
  campaignMetadata: z.object({  
    audienceDemographics: z.object({  
      geoTargets: z.array(z.string()).min(1),  
      genderFocus: z.array(z.string()).min(1),  
      ageWindows: z.array(z.string()).min(1),  
      explicitInterests: z.array(z.string()).min(1)  
    }),  
      
    // Financial Bounds Gates ($2000-$5000 allocation limits)  
    operationalBudgetParameters: z.object({  
      minAllocationThreshold: z.number().min(500, "Campaign budget floor cannot scale lower than $500"),  
      maxAllocationThreshold: z.number().min(500),  
      complimentaryProductBundle: z.string().min(2, "Specify explicit product seeding accompaniment components")  
    }).refine(  
      (budget) \=\> budget.maxAllocationThreshold \>= budget.minAllocationThreshold,  
      "Maximum allocation range window must scale equal to or greater than the baseline threshold limit"  
    ),  
      
    campaignArchitectureDeadline: z.string().datetime({ message: "Target deadlines must conform to clear ISO timestamps" })  
  }),

  // CONSOLIDATED PRODUCTS & PRODUCTION BRIEFS NESTING MATRIX  
  // Nests multiple distinct assets and instructions cleanly beneath the single aggregate root base  
  assetsAndBriefsMatrix: z.array(z.object({  
    entityId: z.string().uuid(),  
    entityType: DynamicEntityTypeEnum,  
    entityName: z.string().min(2, "Asset target reference name is required"),  
      
    // Production Brief Layout Rules Array  
    productionBriefs: z.array(z.object({  
      briefId: z.string().uuid(),  
      briefName: z.string().min(5, "Brief naming conventions must maintain explicit titles"),  
      contentPillarThemeCore: z.string().min(10, "Provide clear theme

# 