## **Architectural Strategy: Consolidated vs. Separate**

From an engineering perspective, the most maintainable approach is to **consolidate them into a single validation file** (e.g., src/lib/validations/marketplace.ts), but export them as **distinct, modular sub-schemas**.

### **The Engineering Rationale:**

* **Data Cross-Pollination:** Screen 1 (The Feed Filters) and Screen 2 (The Submission Wizard) share core parameters like platformContentFormat or ID string types. Consolidating them eliminates duplicate primitives.  
* **Frictionless Public Onboarding:** While Screen 3 is a public route, its final conversion payload is an email that triggers the same account provisioning pipeline as the authenticated views. Keeping its schema inside the same ecosystem makes updating authentication rules simple.

## **The Master Zod Validation Ecosystem**

Here is the complete, modular production Zod specification mapping directly to your frontend components, wizard states, and PostgreSQL layout.  
TypeScript  
import { z } from "zod";

// \==========================================  
// CORE PLATFORM PRIMITIVES & SHARED ENUMS  
// \==========================================

export const PlatformContentFormatEnum \= z.enum(\[  
  "INSTAGRAM\_REEL",  
  "INSTAGRAM\_STORY",  
  "TIKTOK\_VIDEO",  
  "YOUTUBE\_SHORTS",  
\]);

export const ProductionTimelineEnum \= z.enum(\[  
  "URGENT\_PIPELINE", // \< 7 Days Remaining  
  "STANDARD\_RUNWAY", // \< 15 Days Remaining  
\]);

export const CreatorTierEnum \= z.enum(\[  
  "NANO",  
  "MICRO",  
  "MID",  
\]);

// \==========================================  
// SCREEN 1: FILTER & SORTING CONTROL STRIP  
// \==========================================

export const marketplaceFilterSchema \= z.object({  
  searchQuery: z  
    .string()  
    .trim()  
    .max(100, "Search queries cannot exceed 100 characters")  
    .optional(),  
  niche: z.string().optional(),  
  deliverableType: PlatformContentFormatEnum.optional(),  
  campaignStructure: z.string().optional(),  
  showMatchEligibleOnly: z.boolean().default(false),  
    
  // Advanced Dynamic 2-Step Drawer Filter Arrays  
  creatorTier: z.array(CreatorTierEnum).default(\[\]),  
  targetGeography: z  
    .string()  
    .length(2, "Country filter must be an ISO-2 string format")  
    .optional(),  
  productionTimeline: z.array(ProductionTimelineEnum).default(\[\]),  
});

export type MarketplaceFilterInput \= z.infer\<typeof marketplaceFilterSchema\>;

// \==========================================  
// SCREEN 2: APPLICATION JOURNEY WIZARD  
// \==========================================

export const campaignApplicationWizardSchema \= z.object({  
  // Step 1: Product Selection  
  productId: z  
    .string()  
    .uuid("Invalid asset execution path token mapping (Must be valid UUID)"),  
      
  // Step 2: Brief Selection  
  briefTrackId: z  
    .string()  
    .uuid("Invalid creative blueprint token tracking mapping"),  
      
  // Step 3: Terms & Conditions Popup  
  agreedCompensationFee: z  
    .number({ coerce: true })  
    .positive("Contract baseline floor compensation must be a positive value"),  
  termsAccepted: z  
    .literal(true, {  
      errorMap: () \=\> ({ message: "You must explicitly accept the collaboration execution mandates" }),  
    }),  
});

export type CampaignApplicationWizardInput \= z.infer\<typeof campaignApplicationWizardSchema\>;

// \==========================================  
// SCREEN 3: PUBLIC BRAND CONVERSION GATEWAY  
// \==========================================

export const publicBrandConversionSchema \= z.object({  
  email: z  
    .string({ required\_error: "Professional email validation is mandatory" })  
    .trim()  
    .lowercase()  
    .email("Please provide a valid professional email address configuration format")  
    .max(255, "Email routing address strings cannot exceed 255 characters"),  
});

export type PublicBrandConversionInput \= z.infer\<typeof publicBrandConversionSchema\>;

## **UI implementation Notes**

1. **Screen 1 Optimization:** The showMatchEligibleOnly flag should be decoupled from the client-side array updates. If the user session is unauthenticated, pass marketplaceFilterSchema.partial() to prevent rigid schema blocks from intercepting guest exploration states.  
2. **Screen 2 Progressive Multi-Step Validation:** You don't have to wait for Step 3 to execute validation. You can selectively validate steps as the creator advances using Zod's .pick() method:  
3. TypeScript

// Validates Step 1 only when hitting 'Next' on the Product Canvas  
const step1Result \= campaignApplicationWizardSchema.pick({ productId: true }).safeParse({ productId });

4.   
5. 

Now that the foundational discovery layout, invitation handshake mechanics, backend PostgreSQL records, and validation layers are locked in place, should we proceed to the tracking workspace—specifically building out the \*\*Campaigns Tab\*\* where creators track their "Applied", "Active", and "Completed" milestone pipelines?

