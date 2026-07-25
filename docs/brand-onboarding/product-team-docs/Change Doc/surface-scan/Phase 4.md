# **Engineering Documentation: Phase 4 – Stitch UI Data Binding & Checkpoint 1 API Routing**

This document details the engineering implementation for **Checkpoint 1**. It covers connecting your pre-built Stitch UI screens to your NestJS backend, setting up the API contracts, and handling user-driven schema overrides before moving the workflow to Stage 1B.

## **1\. Architectural Overview & Lifecycle State**

Checkpoint 1 is a synchronous, human-in-the-loop gate. The system halts background worker processing until the user approves or corrects the automated extraction metrics generated during Stage 1A.  
      \[Stage 1A Saves Snapshot\] ──\> Status: 'STAGE\_1A\_COMPLETE'  
                                           │  
                                           ▼  
      Stitch Frontend ──\> GET /scans/:scanId/core-identity ──\> Populates UI Form  
                                           │  
                                           ▼  
   User Reviews / Modifies ──\> POST /scans/:scanId/confirm-identity  
                                           │  
                                           ▼  
               ┌───────────────────┴───────────────────┐  
               ▼                                       ▼  
    \[Zod Payload Validates\]                 \[Taxonomy Updated in DB\]  
               │                                       │  
               └───────────────────┬───────────────────┘  
                                   │  
                                   ▼  
        Updates Status to 'CORE\_IDENTITY\_APPROVED' ──\> Triggers Stage 1B Async

## **2\. NestJS Endpoint Controller Setup**

Create the API layer at /src/modules/scan-engine/controllers/scan-checkpoint.controller.ts to manage data delivery and form ingestion.  
TypeScript  
import { Controller, Get, Post, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';  
import { ScanCheckpointService } from '../services/scan-checkpoint.service';  
import { ConfirmIdentityDto, ConfirmIdentityZodSchema } from '../dto/confirm-identity.dto';

@Controller('scans')  
export class ScanCheckpointController {  
  constructor(private readonly checkpointService: ScanCheckpointService) {}

  /\*\*  
   \* Fetches the unverified Stage 1A snapshot to populate the Stitch UI  
   \*/  
  @Get(':scanId/core-identity')  
  async getCoreIdentity(@Param('scanId', new ParseUUIDPipe()) scanId: string) {  
    return await this.checkpointService.fetchSnapshot(scanId);  
  }

  /\*\*  
   \* Processes form submission from Stitch UI, commits overrides, and moves state forward  
   \*/  
  @Post(':scanId/confirm-identity')  
  @HttpCode(HttpStatus.OK)  
  async confirmIdentity(  
    @Param('scanId', new ParseUUIDPipe()) scanId: string,  
    @Body() body: any // Validated inside service via Zod for explicit parsing  
  ) {  
    // Structural run-time validation guardrail  
    const validatedPayload \= ConfirmIdentityZodSchema.parse(body);  
    return await this.checkpointService.processConfirmation(scanId, validatedPayload);  
  }  
}

## **3\. Zod Schema for Inbound Form Payloads**

When a user modifies fields within the Stitch UI, the browser emits a flattened structure representing the user's explicit overrides. Create the validation contract at /src/modules/scan-engine/dto/confirm-identity.dto.ts.  
TypeScript  
import { z } from 'zod';  
import { IndustryEnum } from '../contracts/core-identity.schema';

export const ConfirmIdentityZodSchema \= z.object({  
  brand\_name: z.string().min(1, 'Brand name cannot be empty'),  
  brand\_logo: z.string().url('Logo must be a valid URL').nullable(),  
  industry: IndustryEnum,  
  sub\_industry: z.string().min(1, 'Sub-industry classification is required'),  
  tagline: z.string().nullable(),  
  social\_handles: z.object({  
    instagram: z.string().url().nullable().catch(null),  
    tiktok: z.string().url().nullable().catch(null),  
    facebook: z.string().url().nullable().catch(null),  
    youtube: z.string().url().nullable().catch(null),  
    linkedin: z.string().url().nullable().catch(null),  
  }),  
});

export type ConfirmIdentityDto \= z.infer\<typeof ConfirmIdentityZodSchema\>;

## **4\. Backend Orchestration & Override Resolution**

The service maps incoming form data back into the universal data container. If the user changed a field value from what Stage 1A generated, the engine flags it by setting confidence: 100, source: "USER", and edited: true.  
Implement this logic at /src/modules/scan-engine/services/scan-checkpoint.service.ts:  
TypeScript  
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';  
import { InjectRepository } from '@nestjs/typeorm';  
import { Repository } from 'typeorm';  
import { ScanEntity } from '../entities/scan.entity';  
import { ConfirmIdentityDto } from '../dto/confirm-identity.dto';  
import { CoreIdentitySnapshot } from '../contracts/core-identity.schema';

@Injectable()  
export class ScanCheckpointService {  
  constructor(  
    @InjectRepository(ScanEntity)  
    private readonly scanRepository: Repository\<ScanEntity\>,  
    // Inject Stage 1B microservice coordinator or event bus here  
    private readonly stage1bQueueProducer: any   
  ) {}

  async fetchSnapshot(scanId: string) {  
    const scan \= await this.scanRepository.findOne({ where: { id: scanId } });  
    if (\!scan) throw new NotFoundException(\`Scan sequence with ID ${scanId} not found\`);  
      
    return scan.stage1a\_snapshot;  
  }

  async processConfirmation(scanId: string, dto: ConfirmIdentityDto) {  
    const scan \= await this.scanRepository.findOne({ where: { id: scanId } });  
    if (\!scan) throw new NotFoundException(\`Scan sequence with ID ${scanId} not found\`);  
      
    const existingSnapshot \= scan.stage1a\_snapshot as CoreIdentitySnapshot;

    // Compile the authoritative snapshot by resolving user inputs  
    const authoritativeSnapshot: CoreIdentitySnapshot \= {  
      scan\_id: scanId,  
      website\_url: existingSnapshot.website\_url, // Read-Only  
      country: existingSnapshot.country,         // Read-Only  
      reporting\_currency: existingSnapshot.reporting\_currency, // Read-Only  
        
      // Dynamic evaluation wrapper loop  
      brand\_name: this.resolveField(existingSnapshot.brand\_name, dto.brand\_name),  
      brand\_logo: this.resolveField(existingSnapshot.brand\_logo, dto.brand\_logo),  
      industry: this.resolveField(existingSnapshot.industry, dto.industry),  
      sub\_industry: this.resolveField(existingSnapshot.sub\_industry, dto.sub\_industry),  
      tagline: this.resolveField(existingSnapshot.tagline, dto.tagline),  
        
      social\_handles: {  
        value: dto.social\_handles,  
        confidence: 100,  
        evidence: \[{ page\_url: 'user\_override', page\_type: 'input\_form', excerpt: 'User verified social handle payload structure manually.' }\],  
        source: 'AI', // Kept as AI wrapper signature unless explicit modifications occur  
        edited: JSON.stringify(existingSnapshot.social\_handles.value) \!== JSON.stringify(dto.social\_handles)  
      }  
    };

    // Commit changes to database and promote status flag  
    await this.scanRepository.update(scanId, {  
      authoritative\_identity: authoritativeSnapshot,  
      current\_stage: 'CORE\_IDENTITY\_APPROVED',  
      updated\_at: new Date()  
    });

    // Fire-and-forget background processing execution hook for Stage 1B  
    this.stage1bQueueProducer.dispatchTargetAcquisition(scanId, authoritativeSnapshot);

    return { success: true, nextStage: 'STAGE\_1B\_QUEUED' };  
  }

  /\*\*  
   \* Evaluates updates against automated entries to preserve data lineage  
   \*/  
  private resolveField(originalWrapper: any, incomingValue: any) {  
    const hasChanged \= originalWrapper.value \!== incomingValue;  
      
    if (hasChanged) {  
      return {  
        value: incomingValue,  
        confidence: 100, // Explicit user adjustment overrides confidence models  
        evidence: \[  
          ...originalWrapper.evidence,  
          { page\_url: 'user\_override', page\_type: 'input\_form', excerpt: \`User overrode value from "${originalWrapper.value}"\` }  
        \],  
        source: 'USER',  
        edited: true  
      };  
    }  
      
    return originalWrapper;  
  }  
}

## **5\. Stitch UI Data Binding Integration**

To hook your pre-built Stitch UI forms into these endpoints, open your component view files inside Cursor and apply the following design pattern.

### **Step A: Destructuring incoming Universal Wrappers**

When your dashboard page fetches the GET data package, map the nested properties directly to the component state values:  
TypeScript  
// Component Integration Example within your Stitch client code  
import React, { useEffect, useState } from 'react';  
import { TextInput, Dropdown, Button, Spinner } from '@/components/stitch-ui'; 

export const CheckpointForm \= ({ scanId }: { scanId: string }) \=\> {  
  const \[loading, setLoading\] \= useState(true);  
  const \[formData, setFormData\] \= useState\<any\>(null);

  useEffect(() \=\> {  
    fetch(\`/api/scans/${scanId}/core-identity\`)  
      .then(res \=\> res.json())  
      .then(data \=\> {  
        // Flatten the wrapper values for form management  
        setFormData({  
          brand\_name: data.brand\_name.value,  
          brand\_logo: data.brand\_logo.value,  
          industry: data.industry.value,  
          sub\_industry: data.sub\_industry.value,  
          tagline: data.tagline.value,  
          social\_handles: data.social\_handles.value  
        });  
        setLoading(false);  
      });  
  }, \[scanId\]);

  const handleSubmit \= async () \=\> {  
    await fetch(\`/api/scans/${scanId}/confirm-identity\`, {  
      method: 'POST',  
      headers: { 'Content-Type': 'application/json' },  
      body: JSON.stringify(formData)  
    });  
    // Route user to the waiting dashboard screen  
  };

  if (loading) return \<Spinner size\="large" /\>;

  return (  
    \<div className\="stitch-form-container"\>  
      {/\* Category A Elements: Read-Only parameters render as flat label rows \*/}  
      \<h3\>Review Verified Brand Metrics\</h3\>  
        
      \<TextInput   
        label\="Brand Name"  
        value\={formData.brand\_name}  
        onChange\={(val) \=\> setFormData({ ...formData, brand\_name: val })}  
      /\>  
        
      {/\* Category B Elements: Dropdowns match the structural database enums \*/}  
      \<Dropdown  
        label\="Target Industry Vertical"  
        value\={formData.industry}  
        options\={\[  
          { label: 'D2C Ecommerce', value: 'D2C\_ECOMMERCE' },  
          { label: 'Artificial Intelligence SaaS', value: 'AI\_SAAS' },  
          { label: 'Healthcare & Biotech', value: 'HEALTHCARE' },  
          { label: 'Offline & Local Services', value: 'OFFLINE\_SERVICES' }  
        \]}  
        onChange\={(val) \=\> setFormData({ ...formData, industry: val })}  
      /\>  
        
      \<TextInput   
        label\="Sub-Industry Taxonomy"  
        value\={formData.sub\_industry}  
        onChange\={(val) \=\> setFormData({ ...formData, sub\_industry: val })}  
      /\>  
        
      \<Button onClick\={handleSubmit} variant\="primary"\>Confirm Data & Run Deep Scan\</Button\>  
    \</div\>  
  );  
};

## **6\. Verification and Error Checking**

Run these tests locally to verify your binding configuration:

1. **Verify Mismatched Data Payload Handling:** Send an invalid payload variant via terminal execution loops to check the input filter setup:  
2. Bash

curl \-X POST http://localhost:3000/scans/YOUR-UUID-HERE/confirm-identity \\  
  \-H "Content-Type: application/json" \\  
  \-d '{"brand\_name": "", "industry": "INVALID\_ENUM\_VALUE"}'

3.   
4. *Expectation:* The server should reject the input with a 400 Bad Request status and return structural Zod validation logs detailing the parsing error.  
5. **Verify Database Auditing Log Lineage:** Check your PostgreSQL backend instance following a successful override transaction. Confirm that rows written to the authoritative\_identity target block contain updated parameters alongside the historical markers within their corresponding evidence string arrays.

