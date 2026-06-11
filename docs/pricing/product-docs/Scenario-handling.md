Next document steps for following scenarios and how to integrate them in current architecture-  
1\. If a new pricing plan is launched  
2\. how to keep 2 different sets of users active on different sets of pricing plans (e.g. current Founder's plan is discontinued for future users. but existing users are continued on the founder's pan itself. 3 new pricing plans are launched. new users see only the new pricing plans but existing users see founder's plan+ 3 new pricing plans)  
3\. another feature on the platform is added to counter based limitations (e.g. \# of chats user can do with AI chat assistant)

This architectural blueprint and operational runbook outlines the exact integration patterns, code adjustments, and migration routes for your three advanced subscription scenarios.

### **Scenario 1: Operational Flow for Launching a New Pricing Plan**

When a new pricing tier is released, the deployment path must follow a synchronized sequence across Razorpay, the database layer, and the application's rule configurations to prevent runtime entitlement failures.

#### **Step 1.1: Razorpay Dashboard Provisioning**

1. Navigate to your **Razorpay Live Dashboard** \-\> **Subscriptions** \-\> **Plans** \-\> **Create Plan**.  
2. Define the new plan name, billing interval (e.g., monthly), and description.  
3. Generate distinct Plan IDs for your geographic tiers:  
   * **INR Pricing Node**: e.g., plan\_inr\_growth\_starter\_xxxx  
   * **USD Pricing Node**: e.g., plan\_usd\_growth\_starter\_xxxx

#### **Step 1.2: Database Enum Extension (Prisma Migration)**

If your tier names are statically bounded via Postgres Enums, append the new tier to your schema using a zero-downtime, append-only migration file:  
Code snippet  
// prisma/schema.prisma  
enum SubscriptionTier {  
  FOUNDERS\_BETA  
  GROWTH\_STARTER // \<-- Append new tier here to prevent breaking historical rows  
  PROFESSIONAL  
  ENTERPRISE  
}

Execute a safe database migration to inject the new value without locking active subscription rows:  
SQL  
ALTER TYPE "SubscriptionTier" ADD VALUE 'GROWTH\_STARTER';

#### **Step 1.3: Application Constant & Limit Mapping Update**

Update your core entitlement registry to support the new plan’s feature ceilings and Razorpay ID bindings:  
TypeScript  
// subscription.constants.ts  
export const PLAN\_MAPPINGS \= {  
  FOUNDERS\_BETA: { INR: 'plan\_inr\_founders\_9900', USD: 'plan\_usd\_founders\_99' },  
  GROWTH\_STARTER: { INR: 'plan\_inr\_growth\_xxxx', USD: 'plan\_usd\_growth\_xxxx' }, // \<-- New Map  
  PROFESSIONAL: { INR: 'plan\_inr\_pro\_39900', USD: 'plan\_usd\_pro\_399' },  
  ENTERPRISE: { INR: 'CUSTOM', USD: 'CUSTOM' }  
};

export const FEATURE\_LIMITS \= {  
  FOUNDERS\_BETA: { MAX\_PRODUCTS: 5, MAX\_MANAGED\_OUTREACH: 100, MAX\_AI\_CHATS: 50 },  
  GROWTH\_STARTER: { MAX\_PRODUCTS: 10, MAX\_MANAGED\_OUTREACH: 250, MAX\_AI\_CHATS: 150 }, // \<-- New Limits  
  PROFESSIONAL: { MAX\_PRODUCTS: 20, MAX\_MANAGED\_OUTREACH: 500, MAX\_AI\_CHATS: 1000 },  
};

### **Scenario 2: Plan Versioning & Grandfathering Engine (Dual-Visibility Architecture)**

To discontinue the Founder's Beta plan for future signups while preserving it for existing subscribers, you must decouple your **Subscription State** from your **Catalog Visibility Engine**.  
  New User Signup Sequence                Existing Grandfathered User Sequence  
┌────────────────────────────┐            ┌────────────────────────────────────┐  
│   Requests Pricing Page    │            │   Requests Up/Downgrade Catalog    │  
└──────────────┬─────────────┘            └─────────────────┬──────────────────┘  
               │                                            │  
               ▼                                            ▼  
┌────────────────────────────┐            ┌────────────────────────────────────┐  
│   PlanCatalogService       │            │   PlanCatalogService               │  
│   Filters out hidden plan  │            │   Detects existing 'FOUNDERS\_BETA' │  
└──────────────┬─────────────┘            └─────────────────┬──────────────────┘  
               │                                            │  
               ▼                                            ▼  
┌────────────────────────────┐            ┌────────────────────────────────────┐  
│ Shows Only:                │            │ Shows:                             │  
│ 1\. Growth Starter          │            │ 1\. Founder's Beta (Active)         │  
│ 2\. Professional            │            │ 2\. Growth Starter                  │  
│ 3\. Enterprise              │            │ 3\. Professional                    │  
└────────────────────────────┘            └────────────────────────────────────┘

#### **Step 2.1: Implement a Data-Driven Plan Catalog Service**

Create a standalone catalog controller layer that evaluates a workspace's historical subscription context before returning the pricing matrix:  
TypeScript  
// plan-catalog.service.ts  
import { Injectable } from '@nestjs/common';  
import { PrismaService } from '../prisma/prisma.service';

interface CatalogPlan {  
  tierId: string;  
  name: string;  
  priceString: string;  
  isPubliclyAvailable: boolean;  
}

@Injectable()  
export class PlanCatalogService {  
  constructor(private readonly prisma: PrismaService) {}

  private static readonly MASTER\_CATALOG: Record\<string, CatalogPlan\> \= {  
    FOUNDERS\_BETA: { tierId: 'FOUNDERS\_BETA', name: "Founder's Beta", priceString: '$99/mo', isPubliclyAvailable: false }, // \<-- Grandfathered  
    GROWTH\_STARTER: { tierId: 'GROWTH\_STARTER', name: 'Growth Starter', priceString: '$149/mo', isPubliclyAvailable: true },  
    PROFESSIONAL: { tierId: 'PROFESSIONAL', name: 'Professional', priceString: '$399/mo', isPubliclyAvailable: true },  
    ENTERPRISE: { tierId: 'ENTERPRISE', name: 'Enterprise', priceString: 'Custom', isPubliclyAvailable: true },  
  };

  /\*\*  
   \* Evaluates brand state context to determine precise catalog exposure constraints  
   \*/  
  async getVisiblePlansForBrand(brandId: string | null): Promise\<CatalogPlan\[\]\> {  
    // Scenario A: Unauthenticated/New User Flow  
    if (\!brandId) {  
      return Object.values(PlanCatalogService.MASTER\_CATALOG).filter(plan \=\> plan.isPubliclyAvailable);  
    }

    // Fetch active subscription state  
    const currentSubscription \= await this.prisma.brandSubscription.findUnique({  
      where: { brandId }  
    });

    // Scenario B: Brand exists but has no active subscription yet  
    if (\!currentSubscription) {  
      return Object.values(PlanCatalogService.MASTER\_CATALOG).filter(plan \=\> plan.isPubliclyAvailable);  
    }

    // Scenario C: Active user with a grandfathered account layout  
    const userCurrentTier \= currentSubscription.tier;

    return Object.values(PlanCatalogService.MASTER\_CATALOG).filter(plan \=\> {  
      // Always show plans flagged for public release  
      if (plan.isPubliclyAvailable) return true;  
        
      // Expose a grandfathered plan ONLY if the user currently occupies that specific tier  
      return plan.tierId \=== userCurrentTier;  
    });  
  }  
}

#### **Step 2.2: Frontend Dynamic UI Alignment**

Your pricing page layout component must query this dynamic endpoint instead of hardcoding items. Following the **Active Focus Rule**, if an existing user is viewing the page, their active grandfathered plan renders highlighted with an indicator ("*Your Active Grandfathered Rate*"), while new signups are safely routed entirely past it.

### **Scenario 3: Adding a New Counter-Based Limitation (e.g., AI Chats)**

To introduce a feature ceiling like restricting the number of conversational prompts with an AI assistant, you must register the configuration metrics and hook the interceptor block cleanly into your execution pathway.

#### **Step 3.1: Register the Feature Key Constant**

Update your application's global configuration map to include the new capacity ceiling boundaries:  
TypeScript  
// subscription.constants.ts  
export const FEATURE\_LIMITS \= {  
  FOUNDERS\_BETA: {  
    MAX\_PRODUCTS: 5,               // From original PRD mapping  
    MAX\_MANAGED\_OUTREACH: 100,     // From original PRD mapping  
    MAX\_AI\_CHATS: 50,              // \<-- Added constraint for the AI chat assistant module  
  },  
  PROFESSIONAL: {  
    MAX\_PRODUCTS: 20,              // From original PRD mapping  
    MAX\_MANAGED\_OUTREACH: 500,     // From original PRD mapping  
    MAX\_AI\_CHATS: 1000,            // Increased capacity threshold  
  }  
};

#### **Step 3.2: Secure the Ingestion Path inside the AI Controller**

Inject the EntitlementService guard rails directly into your functional routing layers. If a user attempts an execution that threatens their allocated volume cap, the system halts processing instantly with a clean ForbiddenException.  
TypeScript  
// ai-chat.controller.ts  
import { Controller, Post, Body, Req, UseGuards, ForbiddenException } from '@nestjs/common';  
import { EntitlementService } from '../subscription/entitlement.service';

@Controller('api/v1/ai-assistant')  
export class AiAssistantController {  
  constructor(private readonly entitlementService: EntitlementService) {}

  @Post('dispatch-prompt')  
  async handleIncomingChatRequest(@Body() payload: { prompt: string; brandId: string }) {  
    // 1\. Enforce hard-boundary verification check before passing data streams to LLM nodes  
    // Passing incrementBy \= 1 checks current limits and increments securely if approved  
    await this.entitlementService.checkAndIncrementUsage(payload.brandId, 'MAX\_AI\_CHATS', 1);

    // 2\. Propose execution mechanics downstream if entitlement checks out safely  
    const aiResponseText \= await this.executeAIPipeline(payload.prompt);

    return {  
      success: true,  
      data: aiResponseText  
    };  
  }

  private async executeAIPipeline(prompt: string): Promise\<string\> {  
    // Mock execution context for deep strategy extraction routines  
    return \`Strategic validation verified for prompt: ${prompt}\`;  
  }  
}

#### **Step 3.3: Verify Reset Lifecycles via the Webhook Router**

Ensure that cyclic tracking metrics clear out automatically on monthly billing iterations. Update your centralized Razorpay webhook processor to include the feature key reset directive on subscription.charged events:  
TypeScript  
// subscription-webhook.processor.ts  
async handleSubscriptionCharged(payload: any): Promise\<void\> {  
  const rzpSubscriptionId \= payload.entity.id;

  const targetSub \= await this.prisma.brandSubscription.findUnique({  
    where: { razorpaySubscriptionId: rzpSubscriptionId }  
  });

  if (\!targetSub) return;

  // Atomically flush transactional counters back down to 0 on successful renewal  
  await this.prisma.featureUsage.updateMany({  
    where: {   
      subscriptionId: targetSub.subscriptionId,  
      featureKey: { in: \['MAX\_MANAGED\_OUTREACH', 'MAX\_AI\_CHATS'\] } // \<-- Added to cyclic reset routing  
    },  
    data: {   
      currentUsageCount: 0,  
      resetAt: new Date(Date.now() \+ (30 \* 24 \* 60 \* 60 \* 1000)) // Push ahead 30 days  
    }  
  });  
}

