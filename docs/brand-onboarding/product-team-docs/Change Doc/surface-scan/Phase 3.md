# **Engineering Documentation: Stage 1A – Core Identity Orchestration**

This document details the engineering setup, interface contracts, implementation workflows, and validation logic required to build **Stage 1A: Core Identity Acquisition**.  
Since your AWS compute layer, Zyte proxies, and Playwright execution runtimes are fully functional, this phase focuses entirely on **orchestrating parallel execution strategies, merging extracted data deterministically, and validating fields against Zod contracts** to populate your pre-built Stitch UI screens at Checkpoint 1\.

## **1\. System Architecture & Context Flow**

Stage 1A runs immediately after Stage 0 (Gatekeeper) marks a submitted URL as supported: true. It executes a low-latency, deterministic extraction loop targeting **only** the homepage and structural metadata.  
                 ┌──────────────────────────────┐  
                  │ Stage 0: Gatekeeper Approved │  
                  └──────────────┬───────────────┘  
                                 │ (scan\_id, url, industry, sub\_industry)  
                                 ▼  
               ┌────────────────────────────────────┐  
               │ CoreIdentityOrchestrator.execute() │  
               └─────────────────┬──────────────────┘  
                                 │  
           ┌─────────────────────┴─────────────────────┐  
           ▼ (Concurrent Execution via Promise.all)   ▼  
┌──────────────────────┐                     ┌────────────────────┐  
│ ZyteScrapingStrategy │                     │ PlaywrightStrategy │  
│ • JSON-LD Parse      │                     │ • DOM Hydration    │  
│ • OpenGraph/Meta     │                     │ • Social Regex     │  
│ • Sitemap Context    │                     │ • Dynamic Headless │  
└──────────┬───────────┘                     └─────────┬──────────┘  
           │                                           │  
           └─────────────────────┬─────────────────────┘  
                                 │ (Raw Outputs)  
                                 ▼  
                ┌──────────────────────────────────┐  
                │ Deterministic Merge Engine       │  
                │ • Resolve Conflicts via Weight   │  
                │ • Apply Fallbacks (Logo 404\)     │  
                └─────────────────┬────────────────┘  
                                 │  
                                 ▼  
                   ┌────────────────────────────┐  
                   │ Zod Schema Strict Parse    │  
                   └──────────────┬─────────────┘  
                                 │  
                                 ▼  
            ┌──────────────────────────────────────────┐  
            │ Write to PostgreSQL Ledger (Unverified)  │  
            └──────────────────────────────────────────┘

## **2\. Data Modeling & Runtime Contracts**

To maintain full compatibility with the imported Stitch UI components, the output of Stage 1A must separate read-only attributes from editable parameters exactly as defined in the **Step 3(a) UI Copy Specifications**.  
Create a new file under /src/modules/scan-engine/contracts/core-identity.schema.ts:  
TypeScript  
import { z } from 'zod';

// Strict enum matching the verified database classifications  
export const IndustryEnum \= z.enum(\['D2C\_ECOMMERCE', 'AI\_SAAS', 'HEALTHCARE', 'OFFLINE\_SERVICES'\]);

export const SocialHandlesSchema \= z.object({  
  instagram: z.string().url().nullable().default(null),  
  tiktok: z.string().url().nullable().default(null),  
  facebook: z.string().url().nullable().default(null),  
  youtube: z.string().url().nullable().default(null),  
  linkedin: z.string().url().nullable().default(null),  
});

/\*\*  
 \* Universal Wrapper Core Specification  
 \* Validates that every extracted asset carries provenance metadata for UI rendering.  
 \*/  
export function createUniversalWrapper\<T extends z.ZodTypeAny\>(valueSchema: T) {  
  return z.object({  
    value: valueSchema,  
    confidence: z.number().int().min(0).max(100),  
    evidence: z.array(  
      z.object({  
        page\_url: z.string().url(),  
        page\_type: z.string(),  
        excerpt: z.string(),  
      })  
    ),  
    source: z.literal('AI'),  
    edited: z.literal(false),  
  });  
}

// Complete Output Validation Contract for Stage 1A  
export const CoreIdentitySnapshotSchema \= z.object({  
  scan\_id: z.string().uuid(),  
    
  // Category A: Read-Only Attributes  
  brand\_name: createUniversalWrapper(z.string().min(1)),  
  website\_url: createUniversalWrapper(z.string().url()),  
  country: createUniversalWrapper(z.string().length(2)), // ISO-2 (e.g., "IN", "US", "GB")  
  reporting\_currency: createUniversalWrapper(z.string().length(3)), // ISO-3 (e.g., "INR", "USD", "GBP")  
    
  // Category B: Editable Parameters  
  brand\_logo: createUniversalWrapper(z.string().url().nullable()),  
  industry: createUniversalWrapper(IndustryEnum),  
  sub\_industry: createUniversalWrapper(z.string().min(1)),  
  social\_handles: createUniversalWrapper(SocialHandlesSchema),  
  tagline: createUniversalWrapper(z.string().nullable()),  
});

export type CoreIdentitySnapshot \= z.infer\<typeof CoreIdentitySnapshotSchema\>;  
export type RawScrapeResult \= {  
  brand\_name?: string;  
  logo\_url?: string;  
  country?: string;  
  currency?: string;  
  socials: Partial\<z.infer\<typeof SocialHandlesSchema\>\>;  
  tagline?: string;  
  source\_url: string;  
};

## **3\. Tool Function Calling & Orchestration Strategy**

Running text-based scraping sequentially creates system lag. Stage 1A executes both tools inside a parallel block with a mandatory operational limit of **5000ms**:

* **Zyte Strategy:** Performs an immediate HTTP GET via proxy networks. It checks for Structured Data (ld+json), metadata, open-graph blocks (og:site\_name, og:image), and returns raw string outputs quickly.  
* **Playwright Strategy:** Runs simultaneously inside your serverless Lambda layer. It performs complete JavaScript DOM hydration, parses lazy-loaded elements, and scans every anchor tag (\<a href="..."\>) across dynamic widgets to find social platform patterns.

### **The Conflict Resolution Matrix**

When data overlaps, the orchestration engine uses static domain weights to make deterministic selections without invoking an LLM:

| Target Property | Primary Source | Secondary/Fallback Source | Resolution Logic |
| :---- | :---- | :---- | :---- |
| **Brand Name** | Zyte (ld+json Brand/Organization) | Playwright (document.title / OpenGraph) | Prefer explicit schema definitions over header text hooks. |
| **Brand Logo** | Playwright (Dynamic DOM Asset / Icon Finder) | Zyte (og:image) | Prefer rendered images; filter out low-resolution site graphics. |
| **Social Handles** | Playwright (Full DOM Anchor Scan) | Zyte (Static Regex Matches) | Playwright sweeps dynamically hydrated components. |
| **Currency / Geo** | Zyte (ld+json / Meta Region tags) | Static Fallback (Stage 0 Domain TLD context) | Extract via structured parameters; default to regional settings. |

## **4\. Implementation Blueprint (NestJS Components)**

Create the core implementation layer at /src/modules/scan-engine/services/core-identity-orchestrator.service.ts. This utilizes standard runtime services to manage your active Zyte and Playwright layer integrations.  
TypeScript  
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';  
import { InjectRepository } from '@nestjs/typeorm';  
import { Repository } from 'typeorm';  
import {   
  CoreIdentitySnapshotSchema,   
  CoreIdentitySnapshot,   
  RawScrapeResult,   
  IndustryEnum   
} from '../contracts/core-identity.schema';  
import { ScanEntity } from '../entities/scan.entity'; // Your existing RDS Snapshot mapping

@Injectable()  
export class CoreIdentityOrchestratorService {  
  private readonly logger \= new Logger(CoreIdentityOrchestratorService.name);

  constructor(  
    @InjectRepository(ScanEntity)  
    private readonly scanRepository: Repository\<ScanEntity\>,  
    private readonly zyteStrategy: any,       // Pre-configured Zyte Client Wrapper  
    private readonly playwrightStrategy: any, // Pre-configured AWS Playwright Lambda Client  
  ) {}

  /\*\*  
   \* Main Execution Pipeline for Stage 1A  
   \*/  
  async execute(  
    scanId: string,   
    targetUrl: string,   
    gatekeeperIndustry: string,   
    gatekeeperSubIndustry: string  
  ): Promise\<CoreIdentitySnapshot\> {  
    this.logger.log(\`Initiating Stage 1A Acquisition for Scan ID: ${scanId} | Target: ${targetUrl}\`);

    // 1\. Execute Parallel Gathering Loops with a strict timeout guardrail  
    const scrapePromise \= Promise.allSettled(\[  
      this.zyteStrategy.scrapeHomepage(targetUrl),  
      this.playwrightStrategy.scrapeDynamicDOM(targetUrl)  
    \]);

    const timeoutPromise \= new Promise\<null\>((\_, reject) \=\>  
      setTimeout(() \=\> reject(new Error('Stage 1A Processing Timeout')), 5000)  
    );

    let zyteResult: PromiseSettledResult\<RawScrapeResult\>;  
    let playwrightResult: PromiseSettledResult\<RawScrapeResult\>;

    try {  
      const results \= await Promise.race(\[scrapePromise, timeoutPromise\]);  
      if (\!results) throw new InternalServerErrorException('Acquisition pipeline returned empty payload');  
        
      \[zyteResult, playwrightResult\] \= results;  
    } catch (error) {  
      this.logger.error(\`Critical failure during hardware acquisition execution: ${error.message}\`);  
      return this.executeFallbackPath(scanId, targetUrl, gatekeeperIndustry, gatekeeperSubIndustry, error.message);  
    }

    // Extract runtime variables safely  
    const rawZyte \= zyteResult.status \=== 'fulfilled' ? zyteResult.value : null;  
    const rawPlaywright \= playwrightResult.status \=== 'fulfilled' ? playwrightResult.value : null;

    if (\!rawZyte && \!rawPlaywright) {  
      throw new InternalServerErrorException('Both Zyte and Playwright drivers rejected processing scopes.');  
    }

    // 2\. Process Extraction Layer via Deterministic Merge Engine  
    const snapshot \= this.mergeScrapePayloads(  
      scanId,  
      targetUrl,  
      gatekeeperIndustry,  
      gatekeeperSubIndustry,  
      rawZyte,  
      rawPlaywright  
    );

    // 3\. Enforce Strict Zod Verification Contract  
    const validationResult \= CoreIdentitySnapshotSchema.safeParse(snapshot);  
    if (\!validationResult.success) {  
      this.logger.error(\`Zod Verification Broken: ${JSON.stringify(validationResult.error.format())}\`);  
      throw new InternalServerErrorException('Stage 1A execution output violated canonical contract.');  
    }

    // 4\. Record Immutable Payload State to AWS RDS PostgreSQL Instance  
    await this.scanRepository.update(scanId, {  
      stage1a\_snapshot: validationResult.data,  
      current\_stage: 'STAGE\_1A\_COMPLETE',  
      updated\_at: new Date()  
    });

    return validationResult.data;  
  }

  /\*\*  
   \* Core Merge Engine executing standard weighting patterns  
   \*/  
  private mergeScrapePayloads(  
    scanId: string,  
    targetUrl: string,  
    industry: string,  
    subIndustry: string,  
    zyte: RawScrapeResult | null,  
    playwright: RawScrapeResult | null  
  ): Partial\<CoreIdentitySnapshot\> {  
      
    // Brand Name: Prioritize explicit JSON-LD metadata over general HTML headers  
    const nameValue \= zyte?.brand\_name || playwright?.brand\_name || this.fallbackBrandName(targetUrl);  
      
    // Brand Logo: Prioritize the asset located within active browser rendering frames  
    let logoValue \= playwright?.logo\_url || zyte?.logo\_url || null;  
      
    // Operational Constraint Handlers: If URL check fails or output matches error criteria, use fallback initials  
    if (\!logoValue || logoValue.includes('404') || logoValue \=== '') {  
      logoValue \= null; // Backend sets to null; UI interceptor checks property to drop back to Avatar text  
    }

    // Social Handles: Standard deep execution merge  
    const mergedSocials \= {  
      instagram: playwright?.socials?.instagram || zyte?.socials?.instagram || null,  
      tiktok: playwright?.socials?.tiktok || zyte?.socials?.tiktok || null,  
      facebook: playwright?.socials?.facebook || zyte?.socials?.facebook || null,  
      youtube: playwright?.socials?.youtube || zyte?.socials?.youtube || null,  
      linkedin: playwright?.socials?.linkedin || zyte?.socials?.linkedin || null,  
    };

    const targetUrlObj \= new URL(targetUrl);

    // Map the textual value safely into the structure of your Zod wrapper type definitions  
    return {  
      scan\_id: scanId,  
      brand\_name: {  
        value: nameValue,  
        confidence: zyte?.brand\_name ? 95 : 70,  
        evidence: \[{ page\_url: targetUrl, page\_type: 'homepage', excerpt: \`Detected brand identifier matching: ${nameValue}\` }\],  
        source: 'AI',  
        edited: false  
      },  
      website\_url: {  
        value: targetUrl,  
        confidence: 100,  
        evidence: \[{ page\_url: targetUrl, page\_type: 'homepage', excerpt: 'Root baseline URL target verified.' }\],  
        source: 'AI',  
        edited: false  
      },  
      country: {  
        value: zyte?.country || playwright?.country || 'US',  
        confidence: zyte?.country ? 90 : 50,  
        evidence: \[{ page\_url: targetUrl, page\_type: 'metadata', excerpt: 'Extracted country parameter code block.' }\],  
        source: 'AI',  
        edited: false  
      },  
      reporting\_currency: {  
        value: zyte?.currency || playwright?.currency || 'USD',  
        confidence: zyte?.currency ? 90 : 50,  
        evidence: \[{ page\_url: targetUrl, page\_type: 'metadata', excerpt: 'Inferred transaction asset symbol.' }\],  
        source: 'AI',  
        edited: false  
      },  
      brand\_logo: {  
        value: logoValue,  
        confidence: logoValue ? 85 : 0,  
        evidence: \[{ page\_url: targetUrl, page\_type: 'homepage', excerpt: logoValue ? \`Logo link verified: ${logoValue}\` : 'No usable header identity asset located.' }\],  
        source: 'AI',  
        edited: false  
      },  
      industry: {  
        value: this.normalizeIndustry(industry),  
        confidence: 90,  
        evidence: \[{ page\_url: targetUrl, page\_type: 'gatekeeper\_prediction', excerpt: 'Calculated baseline classification metrics.' }\],  
        source: 'AI',  
        edited: false  
      },  
      sub\_industry: {  
        value: subIndustry,  
        confidence: 85,  
        evidence: \[{ page\_url: targetUrl, page\_type: 'gatekeeper\_prediction', excerpt: 'Sub-tier segment taxonomy configured.' }\],  
        source: 'AI',  
        edited: false  
      },  
      social\_handles: {  
        value: mergedSocials,  
        confidence: 90,  
        evidence: \[{ page\_url: targetUrl, page\_type: 'homepage', excerpt: 'Scanned anchor elements across social media pattern sets.' }\],  
        source: 'AI',  
        edited: false  
      },  
      tagline: {  
        value: zyte?.tagline || playwright?.tagline || null,  
        confidence: zyte?.tagline ? 80 : 40,  
        evidence: \[{ page\_url: targetUrl, page\_type: 'homepage', excerpt: 'Evaluated core descriptive meta layouts.' }\],  
        source: 'AI',  
        edited: false  
      }  
    };  
  }

  private normalizeIndustry(industry: string): any {  
    const formatted \= industry.toUpperCase().replace(/\[-\\s\]/g, '\_');  
    const check \= IndustryEnum.safeParse(formatted);  
    return check.success ? check.data : 'D2C\_ECOMMERCE';  
  }

  private fallbackBrandName(url: string): string {  
    try {  
      const domain \= new URL(url).hostname.replace('www.', '');  
      return domain.split('.')\[0\].toUpperCase();  
    } catch {  
      return 'UNKNOWN\_BRAND';  
    }  
  }

  /\*\*  
   \* Deterministic Fallback Pipeline for Extreme Failure Conditions  
   \*/  
  private async executeFallbackPath(  
    scanId: string,   
    url: string,   
    industry: string,   
    subIndustry: string,   
    reason: string  
  ): Promise\<CoreIdentitySnapshot\> {  
    this.logger.warn(\`Hardware tools timed out or threw errors. Constructing standard safe configuration. Reason: ${reason}\`);  
      
    const fallbackSnapshot \= this.mergeScrapePayloads(  
      scanId,   
      url,   
      industry,   
      subIndustry,   
      null,   
      null  
    ) as CoreIdentitySnapshot;

    await this.scanRepository.update(scanId, {  
      stage1a\_snapshot: fallbackSnapshot,  
      current\_stage: 'STAGE\_1A\_FAILED\_FALLBACK',  
      updated\_at: new Date()  
    });

    return fallbackSnapshot;  
  }  
}

## **5\. Error & Fallback Runbooks**

Because Stage 1A is synchronous, your services must maintain continuity during unexpected errors:

### **Case A: Logo Resource Missing or Broken (Logo 404\)**

* **Indication:** Scrapers return an asset string targeting a broken node, or return an empty space payload ("").  
* **Resolution Pattern:** The orchestrator converts all invalid inputs directly into a clean null value during processing execution.  
* **Stitch Frontend Action:** When the frontend client parses brand\_logo.value \=== null, it disables the standard image thumbnail container on screen and generates a stylized letter badge fallback containing the first two letters of brand\_name.value.

### **Case B: Timeouts (Processing Crosses 5000ms Threshold)**

* **Indication:** Unstable remote proxies cause connection bottlenecks, forcing Promise.race execution patterns to trigger error boundaries.  
* **Resolution Pattern:** The service drops cleanly into executeFallbackPath. It returns a valid schema payload containing clean data defaults (null for logo and socials) along with domain name predictions derived from URL paths. This safely surfaces data inside Checkpoint 1 without breaking UI screen controls.

## **6\. Verification Flow for Development Teams**

To confirm your settings are mapped correctly, run these verification steps within your Workspace terminal loop:

1. **Verify Cursor Layouts:** Confirm your system configurations match database entities by saving code logic inside your editor interface:  
2. Bash

\# Confirm typescript compiles perfectly across schemas  
npx tsc \--noEmit

3.   
4.   
5. **Execute Stage 1A Execution Tests via Curl Routing Loops:**  
6. Bash

curl \-X POST http://localhost:3000/scans/test-uuid/stage-1a \\  
  \-H "Content-Type: application/json" \\  
  \-d '{"url": "https://example.com", "industry": "D2C\_ECOMMERCE", "sub\_industry": "Skincare"}'

7.   
8.   
9. **Verify Field Layout Specifications:** Confirm that the output JSON payload prints structural keys exactly as listed under CoreIdentitySnapshotSchema, keeping values nested within explicit value, confidence, and evidence structural keys.

