# **Engineering Documentation: Phase 6 – Core PromptBuilderService & Prompt A (Brand DNA) Implementation**

This phase configures the core semantic engine of your scan workflow. It builds the modular backend compilation architecture (PromptBuilderService) and executes **Prompt A** to produce structured, citation-backed **Brand DNA** entities. Because your backend is hosted on AWS, this setup avoids long-lived server lockups by streaming or running as a discrete event step inside your NestJS compute container.

## **1\. Directory Blueprint & Template Architecture**

To manage prompt layouts cleanly, organize your prompt markdown text assets in your project root using this structure:  
Plaintext  
/src/modules/intelligence/prompts/surface/brand\_dna/  
  ├── core.md  
  ├── developer.md  
  └── contract.md

### **Core Instructions (**core.md**)**

Markdown  
\# MISSION  
You are an expert brand analyst. Your task is to dissect a company's text-based website context to discover its precise industry niche, market positioning, communication tone, and target customer personas.

\# STRATEGY RULES  
1\. Rely ONLY on the provided text context payload. Do not guess or assume details.  
2\. If details are not explicitly supported by clear evidence, assign a low confidence score.  
3\. Keep the industry niche tight and specific (e.g., "Direct-to-Consumer Clear Aligner Orthodontics", not just "Healthcare").

### **System Directives (**developer.md**)**

Markdown  
\# SYSTEM LEVEL DIRECTIVES  
\* You must return a single, valid JSON object matching the exact structure defined in the contract.  
\* Do NOT wrap your output in markdown syntax like \`\`\`json ... \`\`\` blocks.  
\* Do not include conversational text, trailing characters, or structural code comments.  
\* Parse all array structures cleanly.

### **Type Contract Specifications (**contract.md**)**

Markdown  
\# OUTPUT FORMAT CONTRACT  
Your entire response must match the schema structure defined below. Every single field or array element MUST follow the Universal Field Wrapper format:

{  
  "brand*\_dna": {*  
    *"industry\_*niche": {  
      "value": "string",  
      "confidence": number (0-100),  
      "evidence": \[{"page\_url": "string", "page\_type": "string", "excerpt": "string"}\],  
      "source": "AI",  
      "edited": false  
    },  
    "tone\_of\_voice": \["string"\],  
    "audience\_personas": \[  
      {  
        "name": "string",  
        "age\_range": "string",  
        "gender": "string",  
        "geography": "string",  
        "affluence\_score": "string",  
        "traits": \["string"\],  
        "confidence": number (0-100),  
        "evidence": \[{"page\_url": "string", "page\_type": "string", "excerpt": "string"}\],  
        "source": "AI",  
        "edited": false  
      }  
    \]  
  }  
}

## **2\. PromptBuilderService Implementation**

Create this component at /src/modules/intelligence/services/prompt-builder.service.ts. This service reads your text files dynamically, handles file system lookups, and compiles them alongside your text context payload.  
TypeScript  
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';  
import \* as fs from 'fs/promises';  
import \* as path from 'path';

@Injectable()  
export class PromptBuilderService {  
  private readonly logger \= new Logger(PromptBuilderService.name);

  /\*\*  
   \* Compiles scattered markdown prompt templates into a single instruction set  
   \*/  
  async buildPrompt(promptFolder: string, runtimeContext: any): Promise\<string\> {  
    const baseDir \= path.join(process.cwd(), 'src/modules/intelligence/prompts/surface', promptFolder);  
      
    try {  
      const \[core, developer, contract\] \= await Promise.all(\[  
        fs.readFile(path.join(baseDir, 'core.md'), 'utf8'),  
        fs.readFile(path.join(baseDir, 'developer.md'), 'utf8'),  
        fs.readFile(path.join(baseDir, 'contract.md'), 'utf8'),  
      \]);

      return \[  
        core,  
        developer,  
        contract,  
        '\#\#\# RUNTIME CONTEXT DATA PAYLOAD',  
        JSON.stringify(runtimeContext, null, 2)  
      \].join('\\n\\n');  
    } catch (error) {  
      this.logger.error(\`Failed to read prompt blocks from ${baseDir}: ${error.message}\`);  
      throw new InternalServerErrorException('System failed to bundle intelligence prompt templates.');  
    }  
  }  
}

## **3\. Brand DNA Execution Engine (Prompt A)**

Create this component at /src/modules/intelligence/services/brand-dna-engine.service.ts. It pulls the runtime context from the database, builds the final text prompt package, and triggers the Gemini call using explicit JSON parameters.  
TypeScript  
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';  
import { InjectRepository } from '@nestjs/typeorm';  
import { Repository } from 'typeorm';  
import { GoogleGenAI } from '@google/genai';  
import { ScanEntity } from '../../scan-engine/entities/scan.entity';  
import { PromptBuilderService } from './prompt-builder.service';

@Injectable()  
export class BrandDnaEngineService {  
  private readonly logger \= new Logger(BrandDnaEngineService.name);  
  private readonly ai \= new GoogleGenAI({ apiKey: process.env.GEMINI\_API\_KEY });

  constructor(  
    @InjectRepository(ScanEntity)  
    private readonly scanRepository: Repository\<ScanEntity\>,  
    private readonly promptBuilder: PromptBuilderService,  
  ) {}

  /\*\*  
   \* Triggers Prompt A to process and save Brand DNA data  
   \*/  
  async extractBrandDna(scanId: string): Promise\<any\> {  
    this.logger.log(\`Starting Prompt A execution for Scan ID: ${scanId}\`);

    const scan \= await this.scanRepository.findOne({ where: { id: scanId } });  
    if (\!scan || \!scan.runtime\_context) {  
      throw new InternalServerErrorException(\`Scan context missing or incomplete for ID: ${scanId}\`);  
    }

    // 1\. Compile template blocks with normalized context  
    const fullPrompt \= await this.promptBuilder.buildPrompt('brand\_dna', scan.runtime\_context);

    try {  
      // 2\. Execute Gemini call with fixed JSON parameters  
      const response \= await this.ai.models.generateContent({  
        model: 'gemini-2.5-pro',  
        contents: fullPrompt,  
        config: {  
          responseMimeType: 'application/json',  
          temperature: 0.2, // Keeps outputs consistent across scans  
        },  
      });

      const responseText \= response.text?.trim();  
      if (\!responseText) {  
        throw new Error('Gemini model returned an empty text payload.');  
      }

      // 3\. Structural sanity parsing  
      const brandDnaJson \= JSON.parse(responseText);

      // 4\. Save the raw output snapshot to your database  
      await this.scanRepository.update(scanId, {  
        brand\_dna\_raw: brandDnaJson,  
        current\_stage: 'STAGE\_2\_BRAND\_DNA\_COMPLETE',  
        updated\_at: new Date(),  
      });

      this.logger.log(\`Prompt A successfully saved for Scan ID: ${scanId}\`);  
      return brandDnaJson;  
    } catch (error) {  
      this.logger.error(\`Prompt A generation failed: ${error.message}\`);  
        
      await this.scanRepository.update(scanId, {  
        current\_stage: 'STAGE\_2\_BRAND\_DNA\_FAILED',  
        error\_logs: \`Prompt A Error: ${error.message}\`,  
        updated\_at: new Date(),  
      });  
        
      throw new InternalServerErrorException(\`Brand DNA analysis failed: ${error.message}\`);  
    }  
  }  
}

## **4\. Operational Considerations for Development Teams**

* **Handling Large Sites:** If your text payload exceeds Gemini's context constraints, create a chunking or summary step in your text context service before executing this service.  
* **Prompt Alignment:** Ensure your templates in /src/modules/intelligence/prompts/ match the names expected by this.promptBuilder.buildPrompt('brand\_dna', ...) exactly.  
* **Execution Monitoring:** Watch your AWS compute logs during the AI generation process. Set your server connection limits high enough to comfortably handle typical Gemini processing times without throwing premature runtime errors.

