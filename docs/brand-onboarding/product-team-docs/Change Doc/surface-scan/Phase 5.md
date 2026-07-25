# **Engineering Documentation: Phase 5 – Stage 1B: MCP Planner Prompting & Text Context Builder**

This document details the engineering setup, prompt architecture, and processing pipelines required to implement **Stage 1B: Remaining Website Acquisition**. This stage uses the Gemini Model Context Protocol (MCP) to plan a highly targeted internal web crawl, executes parallel scrapes using your existing Zyte \+ Playwright infrastructure, and normalizes the results into a text-only runtime context.

## **1\. Architectural Overview & Context Flow**

Stage 1B kicks off asynchronously the moment the user hits "Confirm" at Checkpoint 1 (CORE\_IDENTITY\_APPROVED). Instead of crawling the whole website blindly, Gemini acts as a routing director (MCP Planner) to select only high-value pages, saving proxy bandwidth and processing time.  
     \[Authoritative Identity Committed\] ──\> Status: 'CORE\_IDENTITY\_APPROVED'  
                                                   │  
                                                   ▼  
            ┌──────────────────────────────────────────────┐  
            │ McpPlannerService.generateCrawlStrategy()    │  
            │ • Consumes Authoritative Taxonomy & Links    │  
            │ • Returns Prioritized Array of Target URLs   │  
            └──────────────────────┬───────────────────────┘  
                                   │  
                                   ▼  
            ┌──────────────────────────────────────────────┐  
            │ Parallel Extraction Engine                   │  
            │ • Loops through Target URLs concurrently      │  
            │ • Executes Zyte / Playwright drivers         │  
            └──────────────────────┬───────────────────────┘  
                                   │  
                                   ▼  
            ┌──────────────────────────────────────────────┐  
            │ TextContextBuilderService.build()            │  
            │ • Strips out HTML boilerplate, scripts, css   │  
            │ • Maps content schemas into page-type nodes  │  
            └──────────────────────┬───────────────────────┘  
                                   │  
                                   ▼  
          Writes clean \`runtime\_context.json\` to PostgreSQL Ledger   
              ──\> Status Promoted to: 'STAGE\_1B\_COMPLETE'

## **2\. The MCP Planner Prompt Implementation**

Create the template directory at /src/modules/scan-engine/prompts/mcp\_planner.md. This prompt forces Gemini to act as an MCP orchestration layer, evaluating the available root paths against the target industry layout.  
Markdown  
\# ROLE AND OBJECTIVE  
You are the Gemini MCP Planner acting as a tactical routing director for a targeted corporate website scraper. Your job is to select the most relevant sub-pages of a website to analyze a company's brand identity, product offerings, pricing model, and competitors.

\# INPUT DATA  
\* Authoritative Industry Vertical: {{industry}}  
\* Authoritative Sub-Industry Taxonomy: {{sub*\_industry}}*  
*\* Homepage Link Inventory:*   
*{{link\_*inventory}}

\# CRITICAL TARGET PRIORITIES  
Depending on the industry, prioritize selecting links that match these page types:  
1\. Brand/Identity: About Us, Core Values, Team, Philosophy.  
2\. Offerings: Pricing, Products, Services, Solutions, Collections, Subscriptions.  
3\. Market Context: Case Studies, Testimonials, Clients, Partners.

\# CONSTRAINT RULES  
\* Select a MAXIMUM of 7 high-value URLs.  
\* Do not select blog posts, support articles, privacy policies, terms of service, or login/signup portals.  
\* Output MUST be a raw, minified JSON array of absolute URL strings. No markdown code blocks, no conversational preamble.

\# OUTPUT FORMAT REQUIRED  
\["https://example.com/about", "https://example.com/pricing", "https://example.com/products/features"\]

## **3\. NestJS Code Implementation**

### **Step A: The MCP Planner Service**

Create this service at /src/modules/scan-engine/services/mcp-planner.service.ts. It reads the prompt template, injects the user-confirmed homepage structural linkages, and invokes Gemini to get the targeted crawl plan.  
TypeScript  
import { Injectable, Logger } from '@nestjs/common';  
import { GoogleGenAI } from '@google/genai';  
import \* as fs from 'fs/promises';  
import \* as path from 'path';

@Injectable()  
export class McpPlannerService {  
  private readonly logger \= new Logger(McpPlannerService.name);  
  private readonly ai \= new GoogleGenAI({ apiKey: process.env.GEMINI\_API\_KEY });

  async generateCrawlStrategy(  
    industry: string,  
    subIndustry: string,  
    discoveredUrls: string\[\]  
  ): Promise\<string\[\]\> {  
    this.logger.log(\`Generating targeted crawl strategy for industry: ${industry}\`);

    const templatePath \= path.join(process.cwd(), 'src/modules/scan-engine/prompts/mcp\_planner.md');  
    let promptTemplate \= await fs.readFile(templatePath, 'utf8');

    // Inject live runtime attributes into template placeholders  
    const formattedPrompt \= promptTemplate  
      .replace('{{industry}}', industry)  
      .replace('{{sub\_industry}}', subIndustry)  
      .replace('{{link\_inventory}}', JSON.stringify(discoveredUrls, null, 2));

    try {  
      const response \= await this.ai.models.generateContent({  
        model: 'gemini-2.5-pro',  
        contents: formattedPrompt,  
        config: {  
          responseMimeType: 'application/json',  
          temperature: 0.1, // Near-deterministic execution constraint  
        },  
      });

      const targetUrls: string\[\] \= JSON.parse(response.text.trim());  
        
      if (\!Array.isArray(targetUrls)) {  
        throw new Error('MCP response did not return a valid array array structure.');  
      }

      this.logger.log(\`MCP Planner successfully selected ${targetUrls.length} targeted paths.\`);  
      return targetUrls;  
    } catch (error) {  
      this.logger.error(\`MCP Planner runtime failure: ${error.message}. Dropping back to defaults.\`);  
      // Safe fallback strategy: return the first 5 discovered paths if the planner fails  
      return discoveredUrls.slice(0, 5);  
    }  
  }  
}

### **Step B: The Text Context Builder Service**

Create this service at /src/modules/scan-engine/services/text-context-builder.service.ts. This module takes raw page extracts from your Zyte \+ Playwright scraping array, strips out all HTML structural syntax, and outputs a clean text payload.  
TypeScript  
import { Injectable } from '@nestjs/common';  
import \* as cheerio from 'cheerio';

export interface NormalizedPageEvidence {  
  url: string;  
  page\_type: string;  
  clean\_text: string;  
}

@Injectable()  
export class TextContextBuilderService {  
  /\*\*  
   \* Transforms messy crawled pages into a lightweight text payload  
   \*/  
  public cleanRawScrapePayloads(rawPages: Array\<{ url: string; html: string }\>): NormalizedPageEvidence\[\] {  
    return rawPages.map((page) \=\> {  
      const $ \= cheerio.load(page.html);

      // 1\. Remove non-content visual structure tags  
      $('script, style, svg, nav, footer, iframe, noscript, header, head, link, meta').remove();

      // 2\. Extract textual strings from content nodes  
      let pageText \= $('body')  
        .text()  
        .replace(/\\s+/g, ' ') // Collapse multiple whitespace breaks into a single space  
        .trim();

      return {  
        url: page.url,  
        page\_type: this.inferPageTypeFromUrl(page.url),  
        clean\_text: pageText,  
      };  
    });  
  }

  private inferPageTypeFromUrl(url: string): string {  
    const path \= new URL(url).pathname.toLowerCase();  
    if (path.includes('about')) return 'about';  
    if (path.includes('pricing') || path.includes('plan')) return 'pricing';  
    if (path.includes('product') || path.includes('service') || path.includes('shop')) return 'offerings';  
    return 'general\_context';  
  }  
}

### **Step C: The Stage 1B Coordinator Workflow**

Create this central orchestrator file at /src/modules/scan-engine/services/stage1b-coordinator.service.ts.  
TypeScript  
import { Injectable, Logger } from '@nestjs/common';  
import { InjectRepository } from '@nestjs/typeorm';  
import { Repository } from 'typeorm';  
import { ScanEntity } from '../entities/scan.entity';  
import { McpPlannerService } from './mcp-planner.service';  
import { TextContextBuilderService } from './text-context-builder.service';

@Injectable()  
export class Stage1bCoordinatorService {  
  private readonly logger \= new Logger(Stage1bCoordinatorService.name);

  constructor(  
    @InjectRepository(ScanEntity)  
    private readonly scanRepository: Repository\<ScanEntity\>,  
    private readonly mcpPlanner: McpPlannerService,  
    private readonly contextBuilder: TextContextBuilderService,  
    private readonly zyteStrategy: any,       // Existing configured scraping layer  
    private readonly playwrightStrategy: any,   // Existing configured execution layer  
  ) {}

  async dispatchTargetAcquisition(scanId: string, authoritativeIdentity: any): Promise\<void\> {  
    this.logger.log(\`Beginning Stage 1B targeted acquisition for Scan ID: ${scanId}\`);

    try {  
      // 1\. Fetch initial structural context found during Stage 1A extraction loops  
      const scanRecord \= await this.scanRepository.findOne({ where: { id: scanId } });  
      const homepageLinks \= scanRecord.discovered\_root\_links || \[\];

      // 2\. Run the MCP Planner to identify high-value target URLs  
      const targetUrls \= await this.mcpPlanner.generateCrawlStrategy(  
        authoritativeIdentity.industry.value,  
        authoritativeIdentity.sub\_industry.value,  
        homepageLinks  
      );

      // 3\. Execute parallel crawl loops over targeted tracks  
      const crawlPromises \= targetUrls.map(async (url) \=\> {  
        try {  
          // Use Zyte for structure, fallback to Playwright dynamically if page is blank  
          let html \= await this.zyteStrategy.fetchHtml(url);  
          if (\!html || html.length \< 500) {  
            html \= await this.playwrightStrategy.fetchDynamicHtml(url);  
          }  
          return { url, html };  
        } catch (err) {  
          this.logger.error(\`Skipping path crawl execution for ${url}: ${err.message}\`);  
          return null;  
        }  
      });

      const rawCrawlResults \= (await Promise.all(crawlPromises)).filter((res) \=\> res \!== null);

      // 4\. Compress raw markup data blocks into clean text strings  
      const normalizedContext \= this.contextBuilder.cleanRawScrapePayloads(rawCrawlResults);

      // 5\. Commit runtime\_context.json directly to PostgreSQL instance ledger  
      await this.scanRepository.update(scanId, {  
        runtime\_context: normalizedContext, // Saved as structural jsonb block  
        current\_stage: 'STAGE\_1B\_COMPLETE',  
        updated\_at: new Date()  
      });

      this.logger.log(\`Stage 1B complete. Runtime text context package packed for Scan ID: ${scanId}\`);  
    } catch (criticalError) {  
      this.logger.error(\`Fatal crash in Stage 1B processing line: ${criticalError.message}\`);  
      await this.scanRepository.update(scanId, {  
        current\_stage: 'STAGE\_1B\_FAILED',  
        error\_logs: criticalError.message,  
        updated\_at: new Date()  
      });  
    }  
  }  
}

## **4\. Verification and Error Checking**

Run these localized workspace verification routines to confirm your Stage 1B setup functions correctly:

1. **Verify Prompt Rendering via Cursor Integration:** Open Cursor and prompt: *"Verify that the* McpPlannerService *correctly reads* mcp\_planner.md *template markers and maps variables safely without compilation errors."*  
2. **Validate Clean Content Output:** Run an integration test loop and inspect the saved data record within your database environment. Verify that your runtime\_context column is completely clear of open-ended styling structures (css, style), inline tracking code loops (script), and layout headers/footers. It should contain only raw, clean string arrays mapped directly to internal target page URLs.

