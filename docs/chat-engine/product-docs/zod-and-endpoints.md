Following your technical directives from gemini.md v2 (which requires **Zod as the single source of truth** for both frontend and backend validation, and a **Prisma/NestJS/PostgreSQL** architecture), we will now design the complete Zod runtime validation layer and the API endpoint contracts.  
This bridges your React 18 Canvas module directly to your multi-tenant PostgreSQL tables (brands, brand\_audience\_personas, and the campaign execution matrices).

### **1\. The Single Source of Truth Validation Engine (**shared/schemas/campaign.schema.ts**)**

This Zod schema maps exactly to the dynamic multi-turn slot form on your canvas. It enforces structural numeric formatting, strict text-length limits, and uppercase routing enumerations.  
TypeScript  
import { z } from 'zod';

// Strict Enums mirroring PostgreSQL/Prisma Schema Architecture  
export const CampaignObjectiveEnum \= z.enum(\[  
  'DIRECT\_CONVERSIONS',  
  'CREATIVE\_HOOK\_STREAKS',  
  'FUNNEL\_LEAK\_MITIGATION'  
\]);

export const CampaignLifecycleMaturityEnum \= z.enum(\[  
  'DRAFT\_PLANNER',  
  'LIVE\_NO\_APPLICANTS',  
  'LIVE\_PENDING\_APPROVALS',  
  'FULLY\_COMMITTED\_ESCROW'  
\]);

/\*\*  
 \* Single Source of Truth Schema for Campaign Context Validation  
 \* Implements strict constraints defined in gemini.md v2  
 \*/  
export const CreateCampaignSchema \= z.object({  
  brandId: z.string().uuid({ message: "Multi-tenant context identifier must be a valid UUID v4" }),  
  product: z.string()  
    .min(2, { message: "Product designation must contain at least 2 characters" })  
    .max(100, { message: "Product designation cannot exceed 100 characters to prevent buffer issues" }),  
  budget: z.preprocess(  
    (val) \=\> (typeof val \=== 'string' ? parseInt(val, 10) : val),  
    z.number()  
      .int({ message: "Budget allocation must be an exact integer" })  
      .positive({ message: "Budget allocation must be greater than zero" })  
      .max(10000000, { message: "Budget allocation exceeds authorized local operational thresholds" })  
  ),  
  objective: CampaignObjectiveEnum,  
  lifecycleStage: CampaignLifecycleMaturityEnum.default('DRAFT\_PLANNER'),  
  // Explicit compliance with three-point constraints array from backend docs  
  sellingPoints: z.array(z.string().min(5).max(255))  
    .min(1, { message: "Campaign architecture requires at least one core value proposition" })  
    .max(3, { message: "Campaign limits restrict marketing messages to 3 strict points maximum" })  
});

// Infer TypeScript compile-time types cleanly from runtime schemas  
export type CreateCampaignInput \= z.infer\<typeof CreateCampaignSchema\>;  
export type CampaignObjective \= z.infer\<typeof CampaignObjectiveEnum\>;

### **2\. NestJS Backend Data Transfer Object (DTO) & Controller**

This backend controller handles the endpoint that your React UI hits when a brand admin fills out the input slots and clicks **"Confirm Parameters & Proceed"**.

#### backend/src/campaigns/dto/create-campaign.dto.ts

TypeScript  
import { CreateCampaignInput, CampaignObjective } from 'shared/schemas/campaign.schema';

// Standard clean Class-wrapped type anchor for NestJS Dependency Injection pipes  
export class CreateCampaignDto implements CreateCampaignInput {  
  brandId\!: string;  
  product\!: string;  
  budget\!: number;  
  objective\!: CampaignObjective;  
  lifecycleStage?: 'DRAFT\_PLANNER' | 'LIVE\_NO\_APPLICANTS' | 'LIVE\_PENDING\_APPROVALS' | 'FULLY\_COMMITTED\_ESCROW';  
  sellingPoints\!: string\[\];  
}

#### backend/src/campaigns/campaigns.controller.ts

TypeScript  
import { Controller, Post, Body, UsePipes, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';  
import { CreateCampaignDto } from './dto/create-campaign.dto';  
import { CreateCampaignSchema } from 'shared/schemas/campaign.schema';  
import { CampaignsService } from './campaigns.service';

/\*\*  
 \* Global Custom Zod Validation Pipe  
 \* Bypasses class-validator to ensure 100% compliance with shared types  
 \*/  
class ZodValidationPipe {  
  constructor(private schema: typeof CreateCampaignSchema) {}  
    
  transform(value: any) {  
    const parseResult \= this.schema.safeParse(value);  
    if (\!parseResult.success) {  
      // Maps Zod structured error trees into localized API response codes  
      throw new BadRequestException({  
        statusCode: HttpStatus.BAD\_REQUEST,  
        message: 'Zod Validation Pipeline Failure',  
        errors: parseResult.error.format()  
      });  
    }  
    return parseResult.data;  
  }  
}

@Controller('api/v1/campaigns')  
export class CampaignsController {  
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post('initialize')  
  @HttpCode(HttpStatus.CREATED)  
  @UsePipes(new ZodValidationPipe(CreateCampaignSchema))  
  async initializeCampaignSlot(@Body() dto: CreateCampaignDto) {  
    return await this.campaignsService.executeCreationPipeline(dto);  
  }  
}

### **3\. Database Sync Service (Prisma ORM Layer)**

This execution service saves data to the tables directly in PostgreSQL, wrapping the action inside a transactional sandbox frame.

#### backend/src/campaigns/campaigns.service.ts

TypeScript  
import { Injectable, InternalServerErrorException } from '@nestjs/common';  
import { PrismaService } from '../prisma/prisma.service';  
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()  
export class CampaignsService {  
  constructor(private readonly prisma: PrismaService) {}

  async executeCreationPipeline(data: CreateCampaignDto) {  
    try {  
      // Execute operation inside a multi-tenant isolation context  
      return await this.prisma.$transaction(async (tx) \=\> {  
        // 1\. Verify existence of the tenant workspace  
        const tenantExists \= await tx.brand.findUnique({  
          where: { brand\_id: data.brandId }  
        });

        if (\!tenantExists) {  
          throw new Error('Tenant execution isolation error: brand\_id context missing.');  
        }

        // 2\. Map camelCase DTO parameters to standard snake\_case PostgreSQL schema properties  
        return await tx.campaign.create({  
          data: {  
            brand\_id: data.brandId,  
            product\_name: data.product,  
            allocated\_budget: data.budget,  
            optimization\_objective: data.objective,  
            lifecycle\_stage: data.lifecycleStage || 'DRAFT\_PLANNER',  
            core\_selling\_points: data.sellingPoints  
          }  
        });  
      });  
    } catch (error: any) {  
      throw new InternalServerErrorException({  
        message: 'PostgreSQL Relational DB Write Failure',  
        error: error.message || error  
      });  
    }  
  }  
}

### **4\. Client API Connector Module for Frontend Component Integration**

To tie this backend architecture directly to your active React Canvas interface, replace the temporary setTimeout logs inside your component with this type-safe fetch routine.  
TypeScript  
import { CreateCampaignInput, CreateCampaignSchema } from 'shared/schemas/campaign.schema';

/\*\*  
 \* Client-Side API Gateway Layer  
 \* Communicates with the validation controller and returns typed transactional promises  
 \*/  
export async function sendCampaignParameters(payload: CreateCampaignInput): Promise\<{ success: boolean; data?: any; error?: string }\> {  
  // 1\. Pre-validate locally on the client interface to eliminate unnecessary server hits  
  const clientCheck \= CreateCampaignSchema.safeParse(payload);  
  if (\!clientCheck.success) {  
    const errorDetails \= clientCheck.error.errors.map(err \=\> \`${err.path.join('.')}: ${err.message}\`).join(', ');  
    return { success: false, error: \`Client-side validation blocked: ${errorDetails}\` };  
  }

  try {  
    const response \= await fetch('/api/v1/campaigns/initialize', {  
      method: 'POST',  
      headers: {  
        'Content-Type': 'application/json',  
        'X-Tenant-Brand-Id': payload.brandId // Structural tenant routing header context  
      },  
      body: JSON.stringify(clientCheck.data),  
    });

    const body \= await response.json();

    if (\!response.ok) {  
      return {   
        success: false,   
        error: body.message || \`Server rejected request transaction with code ${response.status}\`   
      };  
    }

    return { success: true, data: body };  
  } catch (err: any) {  
    return {   
      success: false,   
      error: err.message || 'Network communication channel degradation encountered.'   
    };  
  }  
}

### **Ready to advance?**

We can now **link this API data fetching layer directly to the interactive React component template on your canvas** so it saves real inputs to your server, or we can move on to drafting your underlying Prisma data models. Which path would you prefer?  
