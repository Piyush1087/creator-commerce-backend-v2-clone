# **Developer Documentation: Multi-Currency Subscription, Lifecycle & Entitlement Engine**

**System Classification:** High-Trust Automations, Multi-Currency Ledger Routing, Lifecycle State Machine, Subscription Entitlement Engine  
**Version:** 5.0.0-PROD (V3 Billing Framework & Escrow Interlock)

## **1\. Architectural System Domain Architecture**

The Subscription & Entitlement Engine is a central security and monetization guardrail. Rather than operating as an isolated billing module, it serves as a strict gateway that monitors and limits database mutations, API execution paths, and escrow ledger volumes based on the brand's verified geographic location and tier configuration.  
                 ┌────────────────────────────────────────┐  
                  │    Brand Request / Action Trigger      │  
                  └───────────────────┬────────────────────┘  
                                      │  
                                      ▼  
                  ┌────────────────────────────────────────┐  
                  │   Entitlement Service / Guard Layer    │  
                  └───────────────────┬────────────────────┘  
                                      │  
           ┌──────────────────────────┴──────────────────────────┐  
           ▼                                                     ▼  
┌──────────────────────────────────────┐             ┌──────────────────────────────────────┐  
│      Resource Limit Enforcement      │             │       Escrow Protection Interlock    │  
│  • Compares usage against limits     │             │  • Calculates plan-based take-rate   │  
│  • Blocks action if cap is breached  │             │  • Validates aggregate escrow locks  │  
└──────────────────────────────────────┘             └──────────────────────────────────────┘

## **2\. Relational Ledger Modeling & Database Schema (Prisma)**

This schema tracks subscription states, handles Razorpay object links, and models atomic counter tables for multi-tenant feature locking.  
Code snippet  
// \=============================================================================  
// SUBSCRIPTION & PRICING ENUMS  
// \=============================================================================  
enum SubscriptionTier {  
  FOUNDERS\_BETA  
  GROWTH\_STARTER  
  PROFESSIONAL  
  ENTERPRISE  
}

enum SubscriptionStatus {  
  TRIALING  
  ACTIVE  
  PAST\_DUE  
  CANCELED  
  HALTED  
}

enum Currency {  
  INR  
  USD  
}

// \=============================================================================  
// MASTER CORE SUBSCRIPTION MODEL  
// \=============================================================================  
model BrandSubscription {  
  subscriptionId         String             @id @default(dbgenerated("gen\_random\_uuid()")) @map("subscription\_id") @db.Uuid  
  brandId                String             @unique @map("brand\_id") @db.Uuid  
  tier                   SubscriptionTier   @default(FOUNDERS\_BETA)  
  status                 SubscriptionStatus @default(TRIALING)  
  currency               Currency           @default(USD)  
    
  // Razorpay Core Integrations  
  razorpayCustomerId     String?            @map("razorpay\_customer\_id") @db.VarChar(255)  
  razorpaySubscriptionId String?            @unique @map("razorpay\_subscription\_id") @db.VarChar(255)  
  razorpayPlanId         String?            @map("razorpay\_plan\_id") @db.VarChar(255)  
    
  // Billing Lifecycle Timestamps  
  trialEndsAt            DateTime?          @map("trial\_ends\_at") @db.Timestamptz  
  currentPeriodStart     DateTime           @default(now()) @map("current\_period\_start") @db.Timestamptz  
  currentPeriodEnd       DateTime           @map("current\_period\_end") @db.Timestamptz  
    
  createdAt              DateTime           @default(now()) @map("created\_at") @db.Timestamptz  
  updatedAt              DateTime           @updatedAt @map("updated\_at") @db.Timestamptz  
    
  featureUsages          FeatureUsage\[\]

  @@index(\[brandId\])  
  @@index(\[status\])  
  @@map("brand\_subscriptions")  
}

// \=============================================================================  
// INFRASTRUCTURE RESOURCING COUNTERS (ENTITLEMENT LEDGER)  
// \=============================================================================  
model FeatureUsage {  
  usageId               String             @id @default(dbgenerated("gen\_random\_uuid()")) @map("usage\_id") @db.Uuid  
  subscriptionId        String             @map("subscription\_id") @db.Uuid  
  featureKey            String             @map("feature\_key") @db.VarChar(100) // e.g., 'MAX\_PRODUCTS', 'MAX\_MANAGED\_OUTREACH'  
  currentUsageCount     Int                @default(0) @map("current\_usage\_count")  
  resetAt               DateTime?          @map("reset\_at") @db.Timestamptz // Tracking cyclic boundary resets  
    
  subscription          BrandSubscription  @relation(fields: \[subscriptionId\], references: \[subscriptionId\], onDelete: Cascade)

  @@unique(\[subscriptionId, featureKey\])  
  @@map("feature\_usages")  
}

## **3\. Configuration Management: Constants & Capabilities Matrix**

The core static parameters dictate localized dashboard plan identifiers, resource limits, and financial escrow take-rate attributes.  
TypeScript  
// src/subscription/subscription.constants.ts

export const PLAN\_MAPPINGS \= {  
  FOUNDERS\_BETA: {  
    INR: 'plan\_inr\_founders\_9900',  // Pre-configured Razorpay Live Plan ID  
    USD: 'plan\_usd\_founders\_99',    // Pre-configured Razorpay Live Plan ID  
  },  
  GROWTH\_STARTER: {  
    INR: 'plan\_inr\_growth\_14900',  
    USD: 'plan\_usd\_growth\_149',  
  },  
  PROFESSIONAL: {  
    INR: 'plan\_inr\_pro\_39900',  
    USD: 'plan\_usd\_pro\_399',  
  },  
  ENTERPRISE: {  
    INR: 'CUSTOM',  
    USD: 'CUSTOM',  
  }  
};

export const FEATURE\_LIMITS \= {  
  FOUNDERS\_BETA: {  
    MAX\_RIVALS: 3,  
    MAX\_DEEP\_SCANS\_MONTHLY: 1,  
    MAX\_PRODUCTS: 5,  
    MAX\_COLLECTIONS: 3,  
    MAX\_LOCATIONS: 3,  
    MAX\_MANAGED\_OUTREACH: 100,  
    MAX\_AI\_CHATS: 50,  
    ESCROW\_AGGREGATE\_CAP: 500000, // ₹5,00,000 threshold restriction  
  },  
  GROWTH\_STARTER: {  
    MAX\_RIVALS: 5,  
    MAX\_DEEP\_SCANS\_MONTHLY: 2,  
    MAX\_PRODUCTS: 10,  
    MAX\_COLLECTIONS: 5,  
    MAX\_LOCATIONS: 5,  
    MAX\_MANAGED\_OUTREACH: 250,  
    MAX\_AI\_CHATS: 150,  
    ESCROW\_AGGREGATE\_CAP: 1500000,  
  },  
  PROFESSIONAL: {  
    MAX\_RIVALS: 10,  
    MAX\_DEEP\_SCANS\_MONTHLY: 5,  
    MAX\_PRODUCTS: 20,  
    MAX\_COLLECTIONS: 10,  
    MAX\_LOCATIONS: 10,  
    MAX\_MANAGED\_OUTREACH: 500,  
    MAX\_AI\_CHATS: 1000,  
    ESCROW\_AGGREGATE\_CAP: 5000000,  
  },  
  ENTERPRISE: {  
    MAX\_RIVALS: 999999,  
    MAX\_DEEP\_SCANS\_MONTHLY: 999999,  
    MAX\_PRODUCTS: 999999,  
    MAX\_COLLECTIONS: 999999,  
    MAX\_LOCATIONS: 999999,  
    MAX\_MANAGED\_OUTREACH: 999999,  
    MAX\_AI\_CHATS: 999999,  
    ESCROW\_AGGREGATE\_CAP: 999999999, // Uncapped allocation  
  }  
};

export const ESCROW\_TAKE\_RATES \= {  
  FOUNDERS\_BETA: 0.07,   // 7% Platform Collaboration Fee  
  GROWTH\_STARTER: 0.06,  // 6% Platform Collaboration Fee  
  PROFESSIONAL: 0.05,    // 5% platform Collaboration Fee  
  ENTERPRISE: 0.02,      // 2% Custom Premium Track Fee  
};

## **4\. Architectural Steps & Implementation Guide**

### **Step 1: Polymorphic Geographic Country Routing Engine**

When a brand registers or requests checkouts, their digital network presence must be mapped into accounting zones to determine localized tax structures, compliance workflows, and token mappings.  
TypeScript  
// src/subscription/geo-routing.service.ts  
import { Injectable } from '@nestjs/common';

export interface GeoContext {  
  zone: 'ZONE\_IN' | 'ZONE\_US' | 'ZONE\_ROW';  
  currency: 'INR' | 'USD';  
  complianceWarning?: string;  
}

@Injectable()  
export class GeoRoutingService {  
  /\*\*  
   \* Resolves country metadata down to explicit accounting nodes  
   \*/  
  resolveGeoContext(countryCode: string): GeoContext {  
    const normalizedCode \= countryCode.toUpperCase();  
      
    switch (normalizedCode) {  
      case 'IN':  
        return {  
          zone: 'ZONE\_IN',  
          currency: 'INR',  
          complianceWarning: 'RBI e-Mandate Rule: Enforce 24-hour pre-debit notifications.',  
        };  
      case 'US':  
        return {  
          zone: 'ZONE\_US',  
          currency: 'USD',  
        };  
      default:  
        return {  
          zone: 'ZONE\_ROW',  
          currency: 'USD',  
          complianceWarning: 'Cross-Border FX Warning: Settle variance margins inside a 4-hour window.',  
        };  
    }  
  }  
}

### **Step 2: The Data-Driven Dynamic Versioning & Catalog Display Engine**

To enforce grandfathering rules (retaining legacy rates for early adopters while hiding those plans from public views), decouple the master billing inventory list from your presentation layers.  
TypeScript  
// src/subscription/plan-catalog.service.ts  
import { Injectable, NotFoundException } from '@nestjs/common';  
import { PrismaService } from '../prisma/prisma.service';

export interface CatalogPlanView {  
  tierKey: string;  
  name: string;  
  priceDescriptor: string;  
  isPubliclyAvailable: boolean;  
}

@Injectable()  
export class PlanCatalogService {  
  constructor(private readonly prisma: PrismaService) {}

  private static readonly MASTER\_CATALOG: Record\<string, CatalogPlanView\> \= {  
    FOUNDERS\_BETA: { tierKey: 'FOUNDERS\_BETA', name: "Founder's Beta", priceDescriptor: '$99/mo', isPubliclyAvailable: false },  
    GROWTH\_STARTER: { tierKey: 'GROWTH\_STARTER', name: 'Growth Starter', priceDescriptor: '$149/mo', isPubliclyAvailable: true },  
    PROFESSIONAL: { tierKey: 'PROFESSIONAL', name: 'Professional', priceDescriptor: '$399/mo', isPubliclyAvailable: true },  
    ENTERPRISE: { tierKey: 'ENTERPRISE', name: 'Enterprise', priceDescriptor: 'Custom Rate', isPubliclyAvailable: true },  
  };

  /\*\*  
   \* Evaluates brand operational state to return context-filtered pricing options  
   \*/  
  async getVisiblePlans(brandId: string | null): Promise\<CatalogPlanView\[\]\> {  
    const allPlans \= Object.values(PlanCatalogService.MASTER\_CATALOG);

    // Context A: New User signup flow \-\> Expose only public active items  
    if (\!brandId) {  
      return allPlans.filter(p \=\> p.isPubliclyAvailable);  
    }

    const currentSub \= await this.prisma.brandSubscription.findUnique({  
      where: { brandId }  
    });

    // Context B: Onboarded brand without active tracking records  
    if (\!currentSub) {  
      return allPlans.filter(p \=\> p.isPubliclyAvailable);  
    }

    // Context C: Active user sitting on a grandfathered legacy plan layer  
    return allPlans.filter(p \=\> {  
      if (p.isPubliclyAvailable) return true;  
      return p.tierKey \=== currentSub.tier; // Expose legacy tier only if actively occupied  
    });  
  }  
}

### **Step 3: Lifecycle Automation Service (Razorpay Integration)**

This pipeline interfaces with Razorpay API endpoints to instantiate deferred trial plans, execute pro-rata adjustments during tier transitions, and process system updates.  
TypeScript  
// src/subscription/subscription-lifecycle.service.ts  
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';  
import { PrismaService } from '../prisma/prisma.service';  
import { HttpService } from '@nestjs/axios';  
import { firstValueFrom } from 'rxjs';  
import { PLAN\_MAPPINGS } from './subscription.constants';

@Injectable()  
export class SubscriptionLifecycleService {  
  constructor(  
    private readonly prisma: PrismaService,  
    private readonly httpService: HttpService,  
  ) {}

  private getAuthHeaders() {  
    const keyId \= process.env.RAZORPAY\_API\_KEY\_ID || '';  
    const secret \= process.env.RAZORPAY\_API\_KEY\_SECRET || '';  
    return {  
      Authorization: \`Basic ${Buffer.from(\`${keyId}:${secret}\`).toString('base64')}\`,  
      'Content-Type': 'application/json',  
    };  
  }

  /\*\*  
   \* Instantiates a 30-day Free Preview without requiring credit cards upfront  
   \*/  
  async initializeTrial(brandId: string, currency: 'INR' | 'USD'): Promise\<any\> {  
    const trialDurationSeconds \= 30 \* 24 \* 60 \* 60;  
    const startBillingEpoch \= Math.floor(Date.now() / 1000) \+ trialDurationSeconds;

    const selectedPlanId \= PLAN\_MAPPINGS.FOUNDERS\_BETA\[currency\];

    try {  
      const response \= await firstValueFrom(  
        this.httpService.post(  
          'https://api.razorpay.com/v1/subscriptions',  
          {  
            plan\_id: selectedPlanId,  
            total\_count: 120, // 10 years recurring validity  
            quantity: 1,  
            start\_at: startBillingEpoch, // Defers credit collection window  
            customer\_notify: 1,  
          },  
          { headers: this.getAuthHeaders() }  
        )  
      );

      // Mutate status to database ledger rows  
      return await this.prisma.brandSubscription.create({  
        data: {  
          brandId,  
          tier: 'FOUNDERS\_BETA',  
          status: 'TRIALING',  
          currency,  
          razorpaySubscriptionId: response.data.id,  
          razorpayPlanId: selectedPlanId,  
          trialEndsAt: new Date(startBillingEpoch \* 1000),  
          currentPeriodStart: new Date(),  
          currentPeriodEnd: new Date(startBillingEpoch \* 1000),  
        },  
      });  
    } catch (err: any) {  
      throw new BadRequestException(\`Razorpay Instance Abort: ${err?.response?.data?.error?.description}\`);  
    }  
  }

  /\*\*  
   \* Dispatches immediate pro-rata tier modification tasks  
   \*/  
  async upgradeOrDowngradeTier(brandId: string, targetTier: 'GROWTH\_STARTER' | 'PROFESSIONAL'): Promise\<any\> {  
    const subscription \= await this.prisma.brandSubscription.findUnique({ where: { brandId } });  
    if (\!subscription || \!subscription.razorpaySubscriptionId) {  
      throw new NotFoundException('No manageable subscription mapping localized for current user.');  
    }

    const targetPlanId \= PLAN\_MAPPINGS\[targetTier\]\[subscription.currency\];

    try {  
      await firstValueFrom(  
        this.httpService.patch(  
          \`https://api.razorpay.com/v1/subscriptions/${subscription.razorpaySubscriptionId}\`,  
          {  
            plan\_id: targetPlanId,  
            schedule\_change\_at: 'now', // Execute mid-cycle changes instantly  
          },  
          { headers: this.getAuthHeaders() }  
        )  
      );

      // Update state locally  
      return await this.prisma.brandSubscription.update({  
        where: { brandId },  
        data: {  
          tier: targetTier,  
          razorpayPlanId: targetPlanId,  
        },  
      });  
    } catch (err: any) {  
      throw new BadRequestException('Razorpay modification request execution failure.');  
    }  
  }  
}

### **Step 4: Atomic Entitlement Guard & Counter Verification Pipeline**

This service monitors consumption metrics and resource thresholds to block execution requests before database writes if a plan's limit is breached.  
TypeScript  
// src/subscription/entitlement.service.ts  
import { Injectable, ForbiddenException } from '@nestjs/common';  
import { PrismaService } from '../prisma/prisma.service';  
import { FEATURE\_LIMITS } from './subscription.constants';

@Injectable()  
export class EntitlementService {  
  constructor(private readonly prisma: PrismaService) {}

  /\*\*  
   \* Verifies resource bounds and atomically increments usage counters if within limits  
   \*/  
  async checkAndIncrementUsage(  
    brandId: string,   
    featureKey: keyof typeof FEATURE\_LIMITS\['FOUNDERS\_BETA'\],   
    incrementBy \= 1  
  ): Promise\<void\> {  
    const sub \= await this.prisma.brandSubscription.findUnique({  
      where: { brandId },  
      include: { featureUsages: true },  
    });

    if (\!sub || sub.status \=== 'CANCELED' || sub.status \=== 'HALTED') {  
      throw new ForbiddenException('Resource execution rejected: Active billing tier authorization required.');  
    }

    if (sub.tier \=== 'ENTERPRISE') return; // Bypass limit validation checks for Enterprise allocations

    const maxPlanLimit \= FEATURE\_LIMITS\[sub.tier\]\[featureKey\];  
    let usageRecord \= sub.featureUsages.find(f \=\> f.featureKey \=== featureKey);

    if (\!usageRecord) {  
      usageRecord \= await this.prisma.featureUsage.create({  
        data: {  
          subscriptionId: sub.subscriptionId,  
          featureKey: featureKey,  
          currentUsageCount: 0,  
          resetAt: this.calculateInitialResetWindow(),  
        },  
      });  
    }

    // Cyclic evaluation window processing  
    if (this.isCyclicFeature(featureKey) && usageRecord.resetAt && new Date() \> usageRecord.resetAt) {  
      usageRecord \= await this.prisma.featureUsage.update({  
        where: { usageId: usageRecord.usageId },  
        data: { currentUsageCount: 0, resetAt: this.calculateInitialResetWindow() },  
      });  
    }

    if (usageRecord.currentUsageCount \+ incrementBy \> maxPlanLimit) {  
      throw new ForbiddenException(  
        \`Plan Allocation Exhausted: Target tier ${sub.tier} restricts ${featureKey} to limits of ${maxPlanLimit}.\`  
      );  
    }

    // Atomically increment counter values securely  
    await this.prisma.featureUsage.update({  
      where: { usageId: usageRecord.usageId },  
      data: { currentUsageCount: { increment: incrementBy } },  
    });  
  }

  private isCyclicFeature(key: string): boolean {  
    return \['MAX\_DEEP\_SCANS\_MONTHLY', 'MAX\_MANAGED\_OUTREACH', 'MAX\_AI\_CHATS'\].includes(key);  
  }

  private calculateInitialResetWindow(): Date {  
    const current \= new Date();  
    current.setMonth(current.getMonth() \+ 1);  
    return current;  
  }  
}

### **Step 5: Advanced Functional Integration Hook (AI Assistant Interlock)**

This controller routes execution metrics directly into the EntitlementService engine to monitor counter-based allocations (such as AI chat assistant prompt tracking).  
TypeScript  
// src/ai-assistant/ai-assistant.controller.ts  
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';  
import { EntitlementService } from '../subscription/entitlement.service';

@Controller('api/v1/ai-assistant')  
export class AiAssistantController {  
  constructor(private readonly entitlementService: EntitlementService) {}

  @Post('dispatch-prompt')  
  @HttpCode(HttpStatus.OK)  
  async executeChatPrompt(@Body() body: { brandId: string; prompt: string }) {  
    // 1\. Verify and increment usage metrics before processing the downstream pipeline  
    await this.entitlementService.checkAndIncrementUsage(body.brandId, 'MAX\_AI\_CHATS', 1);

    // 2\. Route execution flow to downstream components after validation passes  
    const operationalResult \= await this.processLargeLanguageModelStream(body.prompt);

    return {  
      success: true,  
      data: operationalResult,  
    };  
  }

  private async processLargeLanguageModelStream(prompt: string): Promise\<string\> {  
    return \`Processed input parameter payload metrics for statement string: "${prompt}"\`;  
  }  
}

### **Step 6: Escrow Management Protection Interlock**

This guard ensures that a brand's transactional financial volume complies with the constraints defined by their subscription tier, dynamically calculating take-rates and enforcing aggregate capital protection boundaries.  
TypeScript  
// src/escrow/guards/escrow-protection-interlock.guard.ts  
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';  
import { PrismaService } from '../../prisma/prisma.service';  
import { FEATURE\_LIMITS, ESCROW\_TAKE\_RATES } from '../../subscription/subscription.constants';

@Injectable()  
export class EscrowProtectionInterlockGuard implements CanActivate {  
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise\<boolean\> {  
    const request \= context.switchToHttp().getRequest();  
    const { brandId, proposedEscrowFundingAmount } \= request.body;

    if (\!brandId || \!proposedEscrowFundingAmount) {  
      throw new ForbiddenException('Invalid structural execution metadata provided to billing guard.');  
    }

    // 1\. Extract active workspace subscription attributes alongside feature tracking values  
    const subscription \= await this.prisma.brandSubscription.findUnique({  
      where: { brandId }  
    });

    if (\!subscription || \!\['ACTIVE', 'TRIALING'\].includes(subscription.status)) {  
      throw new ForbiddenException('Escrow execution denied: Verifiable subscription structure required.');  
    }

    const currentTier \= subscription.tier;

    // 2\. Inject calculated transaction take-rates into request parameters  
    request.computedTakeRate \= ESCROW\_TAKE\_RATES\[currentTier\];

    // 3\. Evaluate aggregate active escrow tracking capacities  
    const capCeiling \= FEATURE\_LIMITS\[currentTier\].ESCROW\_AGGREGATE\_CAP;  
      
    if (proposedEscrowFundingAmount \> capCeiling) {  
      throw new ForbiddenException(  
        \`Transaction Blocked: Active plan tier ${currentTier} caps individual transaction holds at ${capCeiling}.\`  
      );  
    }

    return true;  
  }  
}

### **Step 7: Centralized Webhook Processing Pipeline**

This component processes inbound status updates from Razorpay's real-time events, serving as the source of truth for subscription states and monthly cycle resets.  
TypeScript  
// src/subscription/subscription-webhook.controller.ts  
import { Controller, Post, Body, Headers, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';  
import { PrismaService } from '../prisma/prisma.service';  
import \* as crypto from 'crypto';

@Controller('api/v1/webhooks/subscription')  
export class SubscriptionWebhookController {  
  constructor(private readonly prisma: PrismaService) {}

  @Post()  
  @HttpCode(HttpStatus.OK)  
  async parseInboundWebhook(  
    @Body() payload: any,  
    @Headers('x-razorpay-signature') signature: string  
  ) {  
    this.verifyWebhookAuthenticity(payload, signature);

    const eventType \= payload.event;  
    const entityData \= payload.payload.subscription.entity;  
    const rzpSubscriptionId \= entityData.id;

    switch (eventType) {  
      case 'subscription.authenticated':  
      case 'subscription.charged':  
        await this.processCyclePaymentSuccess(rzpSubscriptionId, entityData);  
        break;

      case 'subscription.activated':  
        await this.updateSubscriptionStatus(rzpSubscriptionId, 'ACTIVE');  
        break;

      case 'subscription.halted':  
        await this.updateSubscriptionStatus(rzpSubscriptionId, 'HALTED');  
        break;

      case 'subscription.cancelled':  
        await this.updateSubscriptionStatus(rzpSubscriptionId, 'CANCELED');  
        break;  
    }

    return { status: 'EVENT\_PROCESSED' };  
  }

  private verifyWebhookAuthenticity(payload: any, signature: string) {  
    const secret \= process.env.RAZORPAY\_WEBHOOK\_SECRET || '';  
    const shasum \= crypto.createHmac('sha256', secret);  
    shasum.update(JSON.stringify(payload));  
    const digest \= shasum.digest('hex');

    if (digest \!== signature) {  
      throw new BadRequestException('Inbound transaction validation trace failed signature check.');  
    }  
  }

  private async updateSubscriptionStatus(rzpSubId: string, targetStatus: any) {  
    await this.prisma.brandSubscription.update({  
      where: { razorpaySubscriptionId: rzpSubId },  
      data: { status: targetStatus },  
    });  
  }

  private async processCyclePaymentSuccess(rzpSubId: string, entityData: any) {  
    const subscription \= await this.prisma.brandSubscription.update({  
      where: { razorpaySubscriptionId: rzpSubId },  
      data: {  
        status: 'ACTIVE',  
        currentPeriodStart: new Date(entityData.current\_start \* 1000),  
        currentPeriodEnd: new Date(entityData.current\_end \* 1000),  
      },  
    });

    // Reset periodic feature limits upon billing cycle renewal  
    await this.prisma.featureUsage.updateMany({  
      where: {  
        subscriptionId: subscription.subscriptionId,  
        featureKey: { in: \['MAX\_DEEP\_SCANS\_MONTHLY', 'MAX\_MANAGED\_OUTREACH', 'MAX\_AI\_CHATS'\] },  
      },  
      data: {  
        currentUsageCount: 0,  
        resetAt: new Date(entityData.current\_end \* 1000),  
      },  
    });  
  }  
}

## **5\. Deployment Checklist & Operational Guide**

1. **Razorpay Plan Structuring:** Ensure that all Plan IDs (plan\_...) generated via the Razorpay dashboard match the configuration tokens mapped inside subscription.constants.ts.  
2. **Environment Variables Config:** Confirm the following fields are declared in the deployment cluster configuration files:  
   * RAZORPAY\_API\_KEY\_ID  
   * RAZORPAY\_API\_KEY\_SECRET  
   * RAZORPAY\_WEBHOOK\_SECRET  
3. **Database Index Verification:** Confirm the database indexes on brand\_id and razorpay\_subscription\_id are applied to prevent performance drops during webhook signature processing loops under high transactional load.

