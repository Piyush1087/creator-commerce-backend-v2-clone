

### **PART B: Integrated Zod Schema Engine Validation**

TypeScript  
import { z } from "zod";

// \=============================================================================  
// 1\. CORE SHARED PRIMITIVES & ENUM PARSERS  
// \=============================================================================  
export const CampaignStatusSchema \= z.enum(\['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'\]);  
export const TimelineStructureSchema \= z.enum(\['FIXED\_DATES', 'DYNAMIC\_MILESTONES'\]);  
export const CampaignObjectiveSchema \= z.enum(\['BRAND\_AWARENESS', 'TRAFFIC\_CLICKS', 'SALES\_CONVERSIONS'\]);  
export const CompensationTypeSchema \= z.enum(\['FIXED\_FEE', 'NEGOTIABLE'\]);  
export const PayoutTermsSchema \= z.enum(\['IMMEDIATE', 'NET\_7', 'NET\_15', 'NET\_30'\]);  
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
export const MediaPlatformSchema \= z.enum(\['INSTAGRAM', 'TIKTOK', 'YOUTUBE'\]);

export const InstagramHandleSchema \= z.string()  
  .min(1)  
  .max(100)  
  .transform((val) \=\> (val.startsWith("@") ? val : \`@${val}\`));

// \=============================================================================  
// 2\. CREATE CAMPAIGN MULTI-STEP VERIFICATION PIPELINE (MODULE 6\)  
// \=============================================================================  
export const Step1StrategySchema \= z.object({  
  campaign\_name: z.string().min(3, "Campaign naming profiles require at least 3 characters.").max(255),  
  timeline\_type: TimelineStructureSchema,  
  fixed\_start\_date: z.string().datetime().optional().nullable(),  
  fixed\_end\_date: z.string().datetime().optional().nullable(),  
  dynamic\_days\_limit: z.number().int().positive().optional().nullable(),  
  core\_objective: CampaignObjectiveSchema,  
  platform\_deliverables: z.array(z.object({  
    platform: MediaPlatformSchema,  
    formats: z.array(z.string()).min(1, "Assign at least one deliverable layout variant.")  
  })).min(1, "The campaign build must specify platform deliverables targets.")  
}).superRefine((data, ctx) \=\> {  
  if (data.timeline\_type \=== 'FIXED\_DATES') {  
    if (\!data.fixed\_start\_date) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed configurations require a clear start timeline context.", path: \["fixed\_start\_date"\] });  
    }  
    if (\!data.fixed\_end\_date) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed configurations require a clear termination deadline.", path: \["fixed\_end\_date"\] });  
    }  
    if (data.fixed\_start\_date && data.fixed\_end\_date && new Date(data.fixed\_start\_date) \>= new Date(data.fixed\_end\_date)) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Campaign initiation timelines must precede specified end parameters.", path: \["fixed\_end\_date"\] });  
    }  
  }  
  if (data.timeline\_type \=== 'DYNAMIC\_MILESTONES' && \!data.dynamic\_days\_limit) {  
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dynamic execution tracks require explicitly defined baseline days limits.", path: \["dynamic\_days\_limit"\] });  
  }  
});

export const Step2TargetingSchema \= z.object({  
  industry\_vertical: z.string().min(1, "Target enterprise industry categorization required."),  
  creator\_archetypes: z.array(z.string()).min(1, "Map at least one creator demographic target profile orientation."),  
  follower\_tiers: z.array(z.string()).min(1, "Specify targeted creator community scale ranges."),  
  audience\_age\_min: z.number().int().min(13, "Minimum tracking limits match standard OAuth privacy definitions at 13."),  
  audience\_age\_max: z.number().int().max(65),  
  audience\_gender: z.string().default("ALL"),  
  target\_locations: z.array(z.string()).min(1, "Provide targeted operational territory distribution maps."),  
  disqualifying\_keywords: z.array(z.string()).optional().default(\[\])  
}).refine((data) \=\> data.audience\_age\_min \<= data.audience\_age\_max, {  
  message: "Minimum parameters framework cannot overtake defined max boundaries.",  
  path: \["audience\_age\_min"\]  
});

export const Step3CommercialsSchema \= z.object({  
  compensation\_type: CompensationTypeSchema,  
  fixed\_fee\_amount: z.number().nonnegative().optional().default(0.00),  
  negotiable\_min\_fee: z.number().nonnegative().optional().default(0.00),  
  negotiable\_max\_fee: z.number().nonnegative().optional().default(0.00),  
  total\_campaign\_budget\_pool: z.number().positive("Campaign fiscal execution bounds must track valid monetary balances."),  
  advance\_payment\_percentage: z.number().int().min(30, "System protection locks force advance escrow thresholds to at least 30% (Rule BR-01).").max(100),  
  final\_balance\_terms: PayoutTermsSchema  
}).superRefine((data, ctx) \=\> {  
  if (data.compensation\_type \=== 'FIXED\_FEE' && data.fixed\_fee\_amount \<= 0.00) {  
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed compensation models require positive creator fee settings.", path: \["fixed\_fee\_amount"\] });  
  }  
  if (data.compensation\_type \=== 'NEGOTIABLE') {  
    if (data.negotiable\_min\_fee \>= data.negotiable\_max\_fee) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Minimum boundaries must be strictly less than maximum budget caps.", path: \["negotiable\_min\_fee"\] });  
    }  
    if (data.negotiable\_max\_fee \<= 0.00) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Negotiation ceiling configurations require valid caps.", path: \["negotiable\_max\_fee"\] });  
    }  
  }  
});

export const IntegratedCampaignWizardPayloadSchema \= z.object({  
  strategy: Step1StrategySchema,  
  targeting: Step2TargetingSchema,  
  commercials: Step3CommercialsSchema  
});

// \=============================================================================  
// 3\. INVENTORY PRODUCT & CONTENT BRIEF MODULES (MODULE 3 & 4\)  
// \=============================================================================  
export const CampaignProductInventoryInputSchema \= z.object({  
  campaign\_id: z.string().uuid(),  
  sku\_code: z.string().min(2, "Inventory SKU tracking elements cannot be empty descriptions.").max(150),  
  product\_name: z.string().min(1, "Product reference designations cannot render blank.").max(255),  
  inventory\_count: z.number().int().nonnegative("Available logistics distribution stock totals cannot fall below zero."),  
  cost\_per\_unit: z.number().positive("Unit asset cost valuations require valid positive currency metrics."),  
  image\_url: z.string().url().nullable().optional()  
});

export const CampaignBriefCreationInputSchema \= z.object({  
  campaign\_id: z.string().uuid(),  
  internal\_title: z.string().min(5, "Brief operational tracking titles require clear descriptions.").max(255),  
  creative\_guidelines: z.string().min(20, "Creative structural outlines must offer comprehensive production context."),  
  required\_platforms: z.array(MediaPlatformSchema).min(1, "Campaign frameworks require target platform routing definitions."),  
  deliverable\_format\_tags: z.array(z.string()).min(1, "Provide explicit content asset configuration tags (e.g., '9:16 Reel').")  
});

// \=============================================================================  
// 4\. THE MASTER OPERATIONS GRID LIFECYCLE SCHEMA (MODULE 1, 2, & 5\)  
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
    
  // Runtime Dynamic Computations  
  calculated\_hours\_remaining\_review: z.number().int().nullable().optional(),  
  calculated\_days\_overdue: z.number().int().nullable().optional()  
}).superRefine((data, ctx) \=\> {  
  // Enforce Zero-Leakage Financial Balances (Rule BR-01 / BR-05)  
  if (data.total\_quote \> 0) {  
    const calculatedSum \= data.advance\_30\_value \+ data.balance\_70\_value;  
    if (Math.abs(data.total\_quote \- calculatedSum) \> 0.01) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escrow splits must scale cleanly to equal complete structural quote sums.", path: \["total\_quote"\] });  
    }  
  }

  // 72-Hour Auto-Approval Expiry Evaluation (Rule BR-01)  
  if (data.current\_milestone \=== 'STAGE\_4\_CONTENT\_REVIEW' && data.auto\_approval\_deadline\_72h) {  
    const absoluteDeadline \= new Date(data.auto\_approval\_deadline\_72h).getTime();  
    const runtimeClock \= new Date().getTime();  
    const remainingDeltaHours \= Math.floor((absoluteDeadline \- runtimeClock) / (1000 \* 60 \* 60));  
    data.calculated\_hours\_remaining\_review \= remainingDeltaHours \> 0 ? remainingDeltaHours : 0;  
  }

  // Overdue Deadline Delta Tracking Calculations  
  if (data.pipeline\_health \=== 'ACTION\_OVERDUE') {  
    const benchmarkDeadline \= new Date(data.current\_milestone\_deadline).getTime();  
    const runtimeClock \= new Date().getTime();  
    const calculatedDelayDays \= Math.floor((runtimeClock \- benchmarkDeadline) / (1000 \* 60 \* 60 \* 24));  
    data.calculated\_days\_overdue \= calculatedDelayDays \> 0 ? calculatedDelayDays : 0;  
  }  
});

// \=============================================================================  
// 5\. THE REAL-TIME PERFORMANCE ANALYTICS DASHBOARD (MODULE 5 \- REPORTING)  
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
    
  // Polymorphic Target Summary Payload Elements  
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
      message: \`Summary properties profile mismatch for structural targets mapping objective constraints: ${workspace.primary\_objective}\`,  
      path: \["roi\_summary\_strip\_payload"\]  
    });  
  }  
});

// \=============================================================================  
// 6\. TOP LEVEL UNIFIED MODULE INTERFACE TYPE BOUNDARIES  
// \=============================================================================  
export type IntegratedCampaignWizardPayload \= z.infer\<typeof IntegratedCampaignWizardPayloadSchema\>;  
export type CampaignProductInventoryInput \= z.infer\<typeof CampaignProductInventoryInputSchema\>;  
export type CampaignBriefCreationInput \= z.infer\<typeof CampaignBriefCreationInputSchema\>;  
export type PipelineCollaborationUnifiedRow \= z.infer\<typeof PipelineCollaborationUnifiedRowSchema\>;  
export type OperationalReportingDashboardWorkspace \= z.infer\<typeof OperationalReportingDashboardWorkspaceSchema\>;

