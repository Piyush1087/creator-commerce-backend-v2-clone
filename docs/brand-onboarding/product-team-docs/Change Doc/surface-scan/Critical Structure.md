This document establishes a phenomenal master framework. Shifting the engineering perspective from a sequential text-scraping checklist to an **entity-relationship data model backed by a strict provenance ("Evidence") layer** is the exact architecture required to make a multi-tenant platform highly scalable and deterministic.  
However, based on our final objective—specifically, calculating precise conversion metric lifts, tracking competitor product benchmarks, and implementing data branching post-Meta OAuth handshake—there are critical architectural omissions and status mismatches in this schema.  
Here is the technical critique and the exact structural updates needed to finalize this master schema for your development database.

## **🛡️ Critical Structural Deficits in the Baseline Schema**

### **1\. The "Mandatory Status" Mismatch for PDP Auditing**

* **The Deficit:** Under Commercial Offerings, the schema marks fields like Price, Reviews Count, and Ratings as *Optional*, and completely misses layout attributes.  
* **The Risk:** If these fields return null, Prompt 2 (The Funnel Leak Detector) cannot mathematically calculate a conversion health score or determine whether a page is missing social proof markers.  
* **The Fix:** Elevate structural and trust layout elements to *Mandatory* for the brand's primary scanned offerings.

### **2\. The Walled Garden Paradox: Meta Ads (Connected)**

* **The Deficit:** Under Meta Ads (Connected), the schema marks fields like Creatives, Images, and Videos as *Optional*.  
* **The Risk:** If a brand authenticates their Meta Ads account, analyzing their existing visual asset baseline is the *entire purpose* of identifying creative hooks and ad spend scaling gaps. If these are optional, your background sync engine won't know whether to enforce ingestion validation blocks.  
* **The Fix:** Change asset-level media objects to *Mandatory IF Source Type \= META\_CONNECTED*.

### **3\. Competitor Data Source Gaps**

* **The Deficit:** The Competitor Intelligence table notes that data sources are bounded strictly to the competitor's website and Similarweb. It completely leaves out the **Instagram Business Discovery API**, which we previously established is the only legitimate, API-compliant method to compute your Tab 2 Share of Voice (SOV) matrix and competitor 30-day theme vectors.

## **📑 The Finalized, Production-Ready Master Data Schema**

Below are the updated, expanded tables incorporating true PDP metrics, explicit type bounds, and the exact data schema structures required by your developers.

### **1\. Updated Commercial Offerings (PDP Depth)**

Renamed from "Products" to align with your vertical routing constraints (Products, Modules, Treatments, Experiences).

| Owner Entity | Entity Type | Data Source | Data / Fields | Mandatory | Refresh Frequency | Used In |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Brand** | Offering | Website / Scraper | Offering Name, PDP URL, Category | ✅ | Initial \+ Weekly | Brand DNA / Workspace |
| **Brand** | Offering | Website / Scraper | Price | ✅ | Weekly | Budget Sliders / Matrix |
| **Brand** | Offering | Scraper Audit | has\_social\_proof (Boolean) | ✅ | Weekly | Tab 2 PDP Leak Engine |
| **Brand** | Offering | Scraper Audit | has\_video\_ugc (Boolean) | ✅ | Weekly | Tab 2 UGC Lift Potential |
| **Brand** | Offering | Scraper Audit | review\_count, average\_rating | ✅ | Weekly | Tab 2 Baseline Health Score |
| **Brand** | Offering | Scraper Audit | clinical\_claims\_list (Array) | ✅ | Weekly | Tab 1 Regulatory Sandbox |

### **2\. Instagram & Meta Ads Connection Architecture**

*This structure cleanly handles the pre- and post-connection branching logic in your backend.*

| Owner Entity | Entity Type | Data Source | Data / Fields | Mandatory | Sync Behavior | Used In |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Brand** | Instagram Profile | Graph API | true\_reach, true\_impressions, demographics\_json | ✅ *Post-OAuth* | Auto-Trigger Sync | Tab 2 Baseline Matrix |
| **Brand** | Instagram Profile | Graph API | 30\_day\_media\_objects (Captions, Reels) | ✅ *Post-OAuth* | Auto-Trigger Sync | Tab 1 Archetype Scoring |
| **Brand** | Paid Media | Marketing API | spend, ctr, roas, ad\_objectives | ✅ *Post-OAuth* | Daily Cron Loop | Tab 3 Auto-Pauses / Planner |
| **Brand** | Paid Media | Marketing API | active\_creative\_text\_matrix | ✅ *Post-OAuth* | Daily Cron Loop | Tab 2 Creative Hook Engine |

### **3\. Upgraded Competitor Intelligence (Policy Compliant)**

| Owner Entity | Entity Type | Data Source | Data / Fields | Mandatory | Refresh Frequency | Used In |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Competitor** | Core Profile | Similarweb API | monthly\_traffic, traffic\_source\_share | ✅ | Monthly | Budget Sizing Forecast |
| **Competitor** | Social Footprint | **IG Business Discovery** | public\_follower\_count, public\_engagement | ✅ | Bi-Weekly | Tab 2 Share of Voice (SOV) |
| **Competitor** | Content DNA | **IG Business Discovery** | 30\_day\_captions\_token\_matrix | ✅ | Bi-Weekly | Competitor Themes Array |
| **Competitor** | Offering Audit | Scraper Audit | top\_3\_pdp\_urls, bundle\_pricing\_structures | ✅ | Monthly | Drawer Discrepancy Text |
| **Competitor** | Offering Audit | Scraper Audit | competitor\_conversion\_hooks (Array) | ✅ | Monthly | Tab 2 Optimization Cards |

### **4\. AI-Derived Intelligence Layer (Database Views & Vector Targets)**

*These structural rows represent fields compiled exclusively via System Prompts 1, 2, and 3 using the clean metadata inputs collected above.*

| Owner Entity | Entity Type | Derived Field Token | Inputs Array | DB Data Type |
| :---- | :---- | :---- | :---- | :---- |
| **Brand** | Brand DNA | brand\_usps | Website Scrape \+ About Text | VARCHAR(255)\[\] (Length: 3\) |
| **Brand** | Brand DNA | archetype\_match\_distribution | Scraped Text \+ Public IG Captions | JSONB (Sums to 100%) |
| **Brand** | Intelligence | content\_quality\_score | Scraper Booleans \+ Engagement Data | NUMERIC(4,2) (Scale 1–10) |
| **Brand** | Intelligence | pdp\_quality\_score | has\_social\_proof \+ Layout Gaps | INT (Scale 0–100) |
| **Brand** | Intelligence | total\_revenue\_lift | PDP Gaps \+ Roster Misalignments | NUMERIC(5,2) (Percentage) |
| **Brand** | Campaign | orchestrated\_brief\_json | Opportunity Insights \+ Asset Matrix | JSONB (Nests Products & Briefs) |

## **🛠️ Refined Evidence & Provenance Schema (Prisma Blueprint)**

Your recommendation to incorporate an **Evidence Layer** is completely spot-on. To make this operational in a PostgreSQL/Prisma stack, the Evidence layer shouldn't just be an unstructured table—it must map as a strict polymorphic relation across your tables. This ensures that every field mutation has an un-forgeable audit trail.  
Here is the exact TypeScript block to add to your Prisma validation codebase:  
TypeScript  
import { z } from "zod";

export const IngestionSourceTypeEnum \= z.enum(\[  
  "WEBSITE\_SURFACE\_SCRAPE",  
  "WEBSITE\_DEEP\_AUDIT",  
  "META\_OAUTH\_GRAPH\_API",  
  "META\_AD\_LIBRARY\_API",  
  "SIMILARWEB\_TRAFFIC\_API",  
  "AI\_SYNTHESIZED\_GEMINI"  
\]);

export const FieldProvenanceSchema \= z.object({  
  evidenceId: z.string().uuid(),  
  targetTable: z.string(),       // e.g., "BrandProfile"  
  targetField: z.string(),       // e.g., "brandUsps"  
  extractedValue: z.string(),    // The raw literal value or stringified JSON stored  
  sourceType: IngestionSourceTypeEnum,  
  sourceUrl: z.string().url().nullable(),  
  confidenceScore: z.number().min(0).max(100),  
  isUserModified: z.boolean().default(false), // CRITICAL: If TRUE, the auto-sync loop skips overwrites\!  
  generatedByModel: z.string().nullable(),    // e.g., "gemini-1.5-pro"  
  updatedAt: z.string().datetime()  
});

### **Why this design updates your execution capabilities:**

1. **Protected User Overrides:** By storing isUserModified: true in your provenance table, your NestJS data sync handler knows exactly which fields to bypass when a brand hooks up their live Instagram account. Your UI will never overwrite human updates with machine API data.  
2. **Deterministic Confidence-Based Action Gates:** If Prompt 1 evaluates a PDP and returns an audit confidence score below 75 (confidenceScore \< 75), your backend can intercept the trigger lifecycle and route the card directly into a manual confirmation view rather than pushing it onto the live planner.

Now that the master schema successfully tracks granular product audits, multi-tenant promo codes, and structural data provenance, should we construct the explicit backend synchronization handlers next, or move on to the code logic specifications for your NestJS app?

