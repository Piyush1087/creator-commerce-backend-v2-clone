import { z } from "zod";

// \============================================================================  
// SYSTEM ENUMS CONFIGURATIONS  
// \============================================================================

export const DesignThemeEnum \= z.enum(\[  
  "MINIMAL\_STARK",  
  "EDITORIAL\_LUXE",  
  "CYBER\_TECH",  
  "VIBRANT\_KINETIC",  
  "PASTEL\_MINIMAL"  
\]);

// \============================================================================  
// HOME DASHBOARD: CO-PILOT CONVERSATION SCHEMA  
// \============================================================================

export const copilotMessageInputSchema \= z.object({  
  threadId: z.string().uuid().optional(), // Null forces a new dynamic conversation thread creation  
  promptMessage: z  
    .string()  
    .trim()  
    .min(1, { message: "Prompt query string cannot be empty parameters." })  
    .max(2000, { message: "Prompt context limits scale up to 2000 characters maximum." }),  
});

export type CopilotMessageInput \= z.infer\<typeof copilotMessageInputSchema\>;

// \============================================================================  
// MEDIA KIT ENGINE: WORKSPACE SANDBOX UPDATE SCHEMA  
// \============================================================================

export const mediaKitSaveSchema \= z.object({  
  // Dynamic Custom Content Strings  
  customBioOverride: z.string().trim().max(1000).nullable().optional(),  
    
  // Style and Form Layout Controls  
  activeTheme: DesignThemeEnum,  
    
  // Interface Component Binary Visibility Toggles  
  showTotalReach: z.boolean().default(true),  
  showEngagementRate: z.boolean().default(true),  
  showViewsMetric: z.boolean().default(true),  
  showRatesColumn: z.boolean().default(true),  
    
  // Financial Quote Boundary Formatting Valuations  
  shortFormVideoRate: z  
    .number()  
    .min(0)  
    .max(1000000, { message: "Rate constraint boundaries scale safely up to $1M." }),  
  storyBundleRate: z  
    .number()  
    .min(0)  
    .max(1000000),  
      
  // Public Media Management  
  pastBrandLogos: z.array(z.string().url()).max(20, { message: "Limit logo references up to 20 images max." }),  
});

export type MediaKitSaveInput \= z.infer\<typeof mediaKitSaveSchema\>;

// \============================================================================  
// PERFORMANCE ANALYTICS ENGINE: CONTEXT INGESTION QUERY SCHEMA  
// \============================================================================

export const analyticsFilterQuerySchema \= z.object({  
  limitCount: z.coerce.number().int().min(1).max(10).default(5), // Restricts tracking matrix scanning up to 10 nodes max  
});

export type AnalyticsFilterQueryInput \= z.infer\<typeof analyticsFilterQuerySchema\>;  
