### **B. Integrated Zod Schema Engine Validation**

This TypeScript validation file models the step-by-step wizard rules. It treats deliverables as a complex collection array, resolves the Reel-amplification layout path for Stories, and validates manual entries for hooks, scripts, and themes.  
TypeScript  
import { z } from "zod";

// \=============================================================================  
// 1\. DATA MATRIX CONTEXT ENUM DEFINITIONS  
// \=============================================================================  
export const BriefStrategyModeSchema \= z.enum(\["CREATOR\_LED", "BRAND\_LED"\]);

export const DeliverableFormatSchema \= z.enum(\[  
  "REEL\_VIDEO",  
  "STORY",  
  "PHOTOSHOOT",  
  "CAROUSEL\_BANNER"  
\]);

export const VideoAspectRatioSchema \= z.enum(\["9\_16\_VERTICAL", "4\_5\_PORTRAIT"\]);  
export const VideoDurationRangeSchema \= z.enum(\["UNDER\_15S", "15\_45S", "OVER\_45S"\]);  
export const CarouselAspectRatioSchema \= z.enum(\["4\_5\_PORTRAIT", "1\_1\_SQUARE"\]);

export const AudioStrategySchema \= z.enum(\[  
  "DIRECT\_VOICEOVER",  
  "TRENDING\_MUSIC\_BACKGROUND",  
  "LOFI\_FOCUS\_BEATS",  
  "ORIGINAL\_AUDIO"  
\]);

export const LightingEnvironmentSchema \= z.enum(\[  
  "NATURAL\_DAYLIGHT",  
  "BRIGHT\_CLINICAL",  
  "WARM\_MOODY",  
  "STUDIO\_RING\_LIGHT"  
\]);

export const ToneOfVoiceSchema \= z.enum(\[  
  "AUTHORITATIVE\_EXPERT",  
  "HIGH\_ENERGY",  
  "CALMING\_ASMR",  
  "RELATABLE\_CASUAL"  
\]);

export const StoryboardSegmentTypeSchema \= z.enum(\[  
  "HOOK\_OPENER",  
  "PROBLEM\_PITCH",  
  "ACTIVE\_TECH\_REVIEW",  
  "CONVERSION\_CTA"  
\]);

// \=============================================================================  
// 2\. STEP 1: DELIVERABLE NODE ARCHITECTURE TYPE PATTERNS  
// \=============================================================================  
export const SingleDeliverableSpecSchema \= z.object({  
  format\_type: DeliverableFormatSchema,  
    
  // Conditional specifications based on selected deliverable type  
  video\_aspect\_ratio: VideoAspectRatioSchema.optional(),  
  video\_duration\_range: VideoDurationRangeSchema.optional(),  
    
  // Story variant strategy tracker  
  is\_reel\_amplification: z.boolean().default(false),  
    
  photoshoot\_quantity\_allocation: z.number().int().positive().optional(),  
    
  carousel\_aspect\_ratio: CarouselAspectRatioSchema.optional(),  
  carousel\_max\_slide\_count: z.number().int().min(1).max(10).optional(),  
}).superRefine((data, ctx) \=\> {  
  if (data.format\_type \=== "REEL\_VIDEO") {  
    if (\!data.video\_aspect\_ratio) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Aspect ratio is required for Video deliverables.", path: \["video\_aspect\_ratio"\] });  
    }  
    if (\!data.video\_duration\_range) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duration profile parameters are required for Video deliverables.", path: \["video\_duration\_range"\] });  
    }  
  }  
  if (data.format\_type \=== "PHOTOSHOOT" && \!data.photoshoot\_quantity\_allocation) {  
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Quantity allocation count metrics are required for Photoshoot specifications.", path: \["photoshoot\_quantity\_allocation"\] });  
  }  
  if (data.format\_type \=== "CAROUSEL\_BANNER") {  
    if (\!data.carousel\_aspect\_ratio) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Carousel framework layout proportions are required.", path: \["carousel\_aspect\_ratio"\] });  
    }  
    if (\!data.carousel\_max\_slide\_count) {  
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Slide limits must be set between 1 and 10 slides.", path: \["carousel\_max\_slide\_count"\] });  
    }  
  }  
});

// \=============================================================================  
// 3\. STEP 2: CREATOR CREATIVE DIRECTION SUB-SCHEMAS  
// \=============================================================================

/\*\*  
 \* Creative Direction View \- Creator-Led Content Guidelines Payload Model  
 \*/  
export const CreatorLedGuidanceSchema \= z.object({  
  content\_theme: z.string().min(1, "The creative narrative theme dropdown requires an active input string handle."),  
  description: z.string().min(1, "Theme descriptions must be populated manually by system operators."),  
  hook\_ideas: z.array(z.string().min(1)).min(1, "Provide at least one conversion optimization hook tag."),  
  recommended\_b\_rolls: z.string().min(1, "Detail required baseline footage assets or actions."),  
  creator\_dos: z.array(z.string().min(1)).min(1, "Define at least one execution target."),  
  creator\_donts: z.array(z.string().min(1)).min(1, "Establish at least one regulatory or brand protection safety parameter."),  
    
  audio\_strategy: AudioStrategySchema,  
  lighting\_requirements: LightingEnvironmentSchema,  
  background\_setting: z.string().min(1),  
  tone\_of\_voice: ToneOfVoiceSchema,  
  post\_caption: z.string().min(1),  
  hashtags\_and\_mentions: z.array(z.string().regex(/^\[@\#\]/, "Distribution anchors must match hashtag (\#) or handle (@) protocols."))  
});

/\*\*  
 \* Storyboard View \- Brand-Led Step-by-Step Production Scene Payload Model  
 \*/  
export const StoryboardSceneSegmentSchema \= z.object({  
  sequence\_index\_id: z.number().int().nonnegative(),  
  segment\_type: StoryboardSegmentTypeSchema,  
  visual\_direction: z.string().min(5, "Visual instructions must be clear and detailed."),  
  audio\_teleprompter\_script: z.string().min(1, "Enter exact script or teleprompter lines for this scene block."),  
  target\_screen\_time\_seconds: z.number().int().positive(),  
  reference\_frame\_asset\_url: z.string().url().nullable().optional()  
});

/\*\*  
 \* Multi-Deliverable Step 2 Pipeline Evaluation Node Matrix Blueprint  
 \*/  
export const DeliverableStep2GuidancePayloadSchema \= z.object({  
  deliverable\_id: z.string().uuid(),  
  format\_type: DeliverableFormatSchema,  
  is\_reel\_amplification: z.boolean().default(false),  
    
  // Optional configuration payload layers evaluated dynamically against Brief Strategy selection  
  creator\_led\_details: CreatorLedGuidanceSchema.optional(),  
  brand\_led\_storyboard: z.array(StoryboardSceneSegmentSchema).optional()  
});

// \=============================================================================  
// 4\. STEP 3: PLATFORM SNAPSHOT REGISTRY (READ-ONLY STRUCTURAL DATA VALIDATION)  
// \=============================================================================  
export const Step3LogisticsPlannerSnapshotSchema \= z.object({  
  campaign\_fulfillment\_deadline\_descriptor: z.string(),  
  fixed\_calendar\_target\_date: z.string().datetime(),  
  is\_physical\_product\_gifting\_required: z.boolean(),  
  base\_escrow\_compensation\_payout\_float: z.number().nonnegative(),  
  commission\_incentive\_percentage\_float: z.number().min(0).max(100),  
    
  link\_in\_bio\_duration\_days: z.number().int().nonnegative(),  
  paid\_ads\_boosting\_whitelist\_duration\_days: z.number().int().nonnegative(),  
  organic\_reposting\_license\_duration\_days: z.number().int().nonnegative()  
});

// \=============================================================================  
// 5\. MASTER BRIEFING WIZARD INTERFACE CORE ROUTER COMPILER  
// \=============================================================================  
export const MasterAddBriefWizardSchema \= z.object({  
  // Step 1 Payload Ingest Fields  
  campaign\_id: z.string().uuid(),  
  product\_id: z.string().uuid(),  
  brief\_name: z.string().min(2, "Brief labels require identification attributes."),  
  purpose: z.string().min(5, "A brief operational purpose context must be stated."),  
  objective: z.string().min(5, "KPI objective scopes require target declarations."),  
  target\_influencer\_archetype: z.string().min(1, "Brief tracking requires binding selection to a Parent Archetype matrix node."),  
  brief\_type: BriefStrategyModeSchema,  
  mandatory\_creator\_requirements: z.string().min(1, "Define foundational functional criteria parameters."),  
    
  // Dynamic deliverables matrix array (Allows 1 to N stacked assets within a single execution brief context)  
  deliverables\_inventory: z.array(SingleDeliverableSpecSchema).min(1, "A campaign production framework requires at least one content deliverable blueprint."),  
    
  // Step 2 Stacking Payload Sheets Mapping Loop  
  content\_guidance\_matrix: z.array(DeliverableStep2GuidancePayloadSchema),  
    
  // Step 3 Read-Only Inherited Environment Sync Verification Block  
  parent\_planner\_logistics\_snapshot: Step3LogisticsPlannerSnapshotSchema  
}).superRefine((master, ctx) \=\> {  
  // Validate that Step 2 contains matching execution profiles for every asset in Step 1  
  if (master.deliverables\_inventory.length \!== master.content\_guidance\_matrix.length) {  
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Deliverables misalignment: Content guidance metrics count does not match inventory requests.", path: \["content\_guidance\_matrix"\] });  
  }

  master.content\_guidance\_matrix.forEach((guidance, idx) \=\> {  
    // 1\. Structural Check: Ensure Creator-Led flows map correctly to required fields  
    if (master.brief\_type \=== "CREATOR\_LED" && \!guidance.is\_reel\_amplification) {  
      if (\!guidance.creator\_led\_details) {  
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: \`Content guidance fields are required for Creator-Led deliverable asset \#${idx \+ 1}.\`, path: \["content\_guidance\_matrix", idx, "creator\_led\_details"\] });  
      }  
    }  
      
    // 2\. Structural Check: Ensure Brand-Led storyboards map correctly to scene segment lists  
    if (master.brief\_type \=== "BRAND\_LED") {  
      if (\!guidance.brand\_led\_storyboard || guidance.brand\_led\_storyboard.length \=== 0\) {  
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: \`A granular storyboard scene timeline repeater array is required for Brand-Led brief deliverable asset \#${idx \+ 1}.\`, path: \["content\_guidance\_matrix", idx, "brand\_led\_storyboard"\] });  
      }  
    }  
      
    // 3\. Structural Check: Short-circuit validation overhead if a Story format is marked purely as a Reel amplification link  
    if (guidance.format\_type \=== "STORY" && guidance.is\_reel\_amplification) {  
      if (guidance.creator\_led\_details && guidance.creator\_led\_details.description.length \> 500\) {  
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Reel-amplification stories use a simplified configuration layout; reduce extended textual guidance notes.", path: \["content\_guidance\_matrix", idx, "creator\_led\_details", "description"\] });  
      }  
    }  
  });  
});

// Structural Type Inference Outputs for Codebase Architectures  
export type MasterAddBriefWizardRequest \= z.infer\<typeof MasterAddBriefWizardSchema\>;  
export type SingleDeliverableSpec \= z.infer\<typeof SingleDeliverableSpecSchema\>;  
export type DeliverableStep2GuidancePayload \= z.infer\<typeof DeliverableStep2GuidancePayloadSchema\>;  
export type StoryboardSceneSegment \= z.infer\<typeof StoryboardSceneSegmentSchema\>;  
export type Step3LogisticsPlannerSnapshot \= z.infer\<typeof Step3LogisticsPlannerSnapshotSchema\>;

