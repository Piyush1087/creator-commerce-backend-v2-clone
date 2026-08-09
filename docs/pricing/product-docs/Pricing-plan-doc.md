Based on your requirements and the provided pricing structure, we need to build a comprehensive Subscription & Entitlement Engine. This system will integrate with Razorpay Subscriptions to manage the recurring billing lifecycle, handle multi-currency logic based on geography, and enforce the precise feature limits outlined in your product roadmap (e.g., 5 products for Founder's Beta, 500 outreaches for Professional).  
Here is the complete backend architecture, Prisma schema, and NestJS service implementation for Step 8\.

### **1\. Backend Infrastructure & Relational Ledger Modeling (Prisma)**

First, we need to extend the database schema to handle subscription tiers, Razorpay mapping, and feature usage counters.  
Code snippet  
// \=============================================================================  
// SUBSCRIPTION & PRICING ENUMS  
// \=============================================================================  
enum SubscriptionTier {  
  FOUNDERS\_BETA  
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
// SUBSCRIPTION MODELS  
// \=============================================================================  
model BrandSubscription {  
  subscriptionId        String             @id @default(dbgenerated("gen\_random\_uuid()")) @map("subscription\_id") @db.Uuid  
  brandId               String             @unique @map("brand\_id") @db.Uuid  
  tier                  SubscriptionTier   @default(FOUNDERS\_BETA)  
  status                SubscriptionStatus @default(TRIALING)  
  currency              Currency           @default(USD)  
    
  // Razorpay Tracking  
  razorpayCustomerId    String?            @map("razorpay\_customer\_id") @db.VarChar(255)  
  razorpaySubscriptionId String?           @unique @map("razorpay\_subscription\_id") @db.VarChar(255)  
  razorpayPlanId        String?            @map("razorpay\_plan\_id") @db.VarChar(255)  
    
  // Billing Cycle Dates  
  trialEndsAt           DateTime?          @map("trial\_ends\_at") @db.Timestamptz  
  currentPeriodStart    DateTime           @default(now()) @map("current\_period\_start") @db.Timestamptz  
  currentPeriodEnd      DateTime           @map("current\_period\_end") @db.Timestamptz  
    
  createdAt             DateTime           @default(now()) @map("created\_at") @db.Timestamptz  
  updatedAt             DateTime           @updatedAt @map("updated\_at") @db.Timestamptz  
    
  featureUsages         FeatureUsage\[\]

  @@index(\[brandId\])  
  @@index(\[status\])  
  @@map("brand\_subscriptions")  
}

// \=============================================================================  
// ENTITLEMENT & LIMITER MODELS  
// \=============================================================================  
model FeatureUsage {  
  usageId               String             @id @default(dbgenerated("gen\_random\_uuid()")) @map("usage\_id") @db.Uuid  
  subscriptionId        String             @map("subscription\_id") @db.Uuid  
  featureKey            String             @map("feature\_key") @db.VarChar(100) // e.g., 'MANAGED\_OUTREACH', 'PRODUCTS'  
  currentUsageCount     Int                @default(0) @map("current\_usage\_count")  
  resetAt               DateTime?          @map("reset\_at") @db.Timestamptz // Used for monthly resets (e.g., deep scans)  
    
  subscription          BrandSubscription  @relation(fields: \[subscriptionId\], references: \[subscriptionId\], onDelete: Cascade)

  @@unique(\[subscriptionId, featureKey\])  
  @@map("feature\_usages")  
}

### **2\. Multi-Currency Geographic Routing**

To handle the 3 geographies (India \-\> INR, US \-\> USD, Rest of World \-\> USD), we evaluate the currency during the subscription checkout initialization. Razorpay requires different plan\_ids for different currencies.  
TypeScript  
// subscription.constants.ts  
export const PLAN\_MAPPINGS \= {  
  FOUNDERS\_BETA: {  
    INR: 'plan\_inr\_founders\_9900', // Pre-created in Razorpay Dashboard (₹ equivalent of $99)  
    USD: 'plan\_usd\_founders\_99',   // Pre-created in Razorpay Dashboard ($99)   
  },  
  PROFESSIONAL: {  
    INR: 'plan\_inr\_pro\_39900',  
    USD: 'plan\_usd\_pro\_399',       // Pre-created in Razorpay Dashboard ($399) \[cite: 32\]  
  }  
};

export const FEATURE\_LIMITS \= {  
  FOUNDERS\_BETA: {  
    MAX\_RIVALS: 3,                 // \[cite: 19\]  
    MAX\_DEEP\_SCANS\_MONTHLY: 1,     // \[cite: 20\]  
    MAX\_PRODUCTS: 5,               //   
    MAX\_COLLECTIONS: 3,            //   
    MAX\_LOCATIONS: 3,              // \[cite: 24\]  
    MAX\_MANAGED\_OUTREACH: 100,     //   
  },  
  PROFESSIONAL: {  
    MAX\_RIVALS: 10,                // \[cite: 32\]  
    MAX\_DEEP\_SCANS\_MONTHLY: 5,       
    MAX\_PRODUCTS: 20,                
    MAX\_COLLECTIONS: 10,             
    MAX\_LOCATIONS: 10,               
    MAX\_MANAGED\_OUTREACH: 500,     // \[cite: 32\]  
  }  
};

### **3\. Subscription Service: Razorpay Integration & Lifecycle**

This service handles the creation of the 30-day Founder's Trial, upgrades, downgrades, and cancellations. Payment modes (Cards, UPI, Netbanking) are automatically handled by the Razorpay checkout wrapper on the frontend once the subscription ID is generated.  
TypeScript  
// subscription.service.ts  
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';  
import { PrismaService } from '../prisma/prisma.service';  
import { HttpService } from '@nestjs/axios';  
import { firstValueFrom } from 'rxjs';  
import { PLAN\_MAPPINGS, FEATURE\_LIMITS } from './subscription.constants';

@Injectable()  
export class SubscriptionService {  
  constructor(  
    private readonly prisma: PrismaService,  
    private readonly httpService: HttpService,  
  ) {}

  private getRazorpayAuth() {  
    return {  
      username: process.env.RAZORPAY\_API\_KEY\_ID ?? '',  
      password: process.env.RAZORPAY\_API\_KEY\_SECRET ?? '',  
    };  
  }

  /\*\*  
   \* Initializes the 30-Day Free Trial Founder's Beta Subscription  
   \*/  
  async createTrialSubscription(brandId: string, countryCode: string): Promise\<any\> {  
    const currency \= countryCode \=== 'IN' ? 'INR' : 'USD';  
    const planId \= PLAN\_MAPPINGS.FOUNDERS\_BETA\[currency\];

    // Calculate trial end (30 days from now)   
    const trialEndEpoch \= Math.floor(Date.now() / 1000) \+ (30 \* 24 \* 60 \* 60);

    try {  
      // 1\. Create Subscription in Razorpay  
      const rzpResponse \= await firstValueFrom(  
        this.httpService.post(  
          'https://api.razorpay.com/v1/subscriptions',  
          {  
            plan\_id: planId,  
            total\_count: 120, // 10 years recurring  
            quantity: 1,  
            start\_at: trialEndEpoch, // Defers the first charge by 30 days \[cite: 14\]  
            customer\_notify: 1,      // Razorpay notifies customer automatically \[cite: 14\]  
          },  
          { auth: this.getRazorpayAuth() }  
        )  
      );

      // 2\. Store in Database  
      const subscription \= await this.prisma.brandSubscription.create({  
        data: {  
          brandId,  
          tier: 'FOUNDERS\_BETA',  
          status: 'TRIALING',  
          currency,  
          razorpaySubscriptionId: rzpResponse.data.id,  
          razorpayPlanId: planId,  
          trialEndsAt: new Date(trialEndEpoch \* 1000),  
          currentPeriodStart: new Date(),  
          currentPeriodEnd: new Date(trialEndEpoch \* 1000),  
        }  
      });

      return {  
        subscriptionId: rzpResponse.data.id,  
        status: 'TRIALING'  
      };  
    } catch (error: any) {  
      throw new BadRequestException(\`Razorpay Subscription Error: ${error?.response?.data?.error?.description}\`);  
    }  
  }

  /\*\*  
   \* Upgrades or Downgrades an active subscription  
   \*/  
  async updateSubscriptionTier(brandId: string, targetTier: 'PROFESSIONAL' | 'ENTERPRISE'): Promise\<any\> {  
    const sub \= await this.prisma.brandSubscription.findUnique({ where: { brandId } });  
    if (\!sub || \!sub.razorpaySubscriptionId) throw new NotFoundException('Active subscription not found.');

    const targetPlanId \= PLAN\_MAPPINGS\[targetTier\]\[sub.currency\];

    try {  
      // Razorpay Upgrade/Downgrade API (charges pro-rata automatically)  
      await firstValueFrom(  
        this.httpService.patch(  
          \`https://api.razorpay.com/v1/subscriptions/${sub.razorpaySubscriptionId}\`,  
          {  
            plan\_id: targetPlanId,  
            schedule\_change\_at: 'now' // Apply immediately  
          },  
          { auth: this.getRazorpayAuth() }  
        )  
      );

      // Note: Actual DB update should ideally happen via Webhooks (subscription.updated),   
      // but optimistically updating here for UI speed.  
      await this.prisma.brandSubscription.update({  
        where: { brandId },  
        data: { tier: targetTier, razorpayPlanId: targetPlanId }  
      });

      return { status: 'UPGRADE\_SUCCESSFUL' };  
    } catch (error: any) {  
      throw new BadRequestException('Failed to update subscription tier.');  
    }  
  }

  /\*\*  
   \* Cancels a subscription immediately or at period end  
   \*/  
  async cancelSubscription(brandId: string): Promise\<any\> {  
    const sub \= await this.prisma.brandSubscription.findUnique({ where: { brandId } });  
    if (\!sub || \!sub.razorpaySubscriptionId) return;

    await firstValueFrom(  
      this.httpService.post(  
        \`https://api.razorpay.com/v1/subscriptions/${sub.razorpaySubscriptionId}/cancel\`,  
        { cancel\_at\_cycle\_end: 0 }, // 0 \= immediate, 1 \= end of cycle  
        { auth: this.getRazorpayAuth() }  
      )  
    );

    await this.prisma.brandSubscription.update({  
      where: { brandId },  
      data: { status: 'CANCELED' }  
    });  
      
    return { status: 'CANCELED' };  
  }  
}

### **4\. The Feature Counter & Limiter Engine**

To enforce limits (like restricting Founder's Beta to 5 products or 100 DM outreaches ), we create an entitlement interceptor/service that checks limits before allowing an action.  
TypeScript  
// entitlement.service.ts  
import { Injectable, ForbiddenException } from '@nestjs/common';  
import { PrismaService } from '../prisma/prisma.service';  
import { FEATURE\_LIMITS } from './subscription.constants';

@Injectable()  
export class EntitlementService {  
  constructor(private readonly prisma: PrismaService) {}

  /\*\*  
   \* Validates if a brand can perform an action, and increments the counter if allowed.  
   \*/  
  async checkAndIncrementUsage(brandId: string, featureKey: keyof typeof FEATURE\_LIMITS\['FOUNDERS\_BETA'\], incrementBy \= 1): Promise\<void\> {  
    const sub \= await this.prisma.brandSubscription.findUnique({  
      where: { brandId },  
      include: { featureUsages: true }  
    });

    if (\!sub || sub.status \=== 'CANCELED' || sub.status \=== 'HALTED') {  
      throw new ForbiddenException('Active subscription required to access this feature.');  
    }

    // Enterprise has unlimited capacity \[cite: 32\]  
    if (sub.tier \=== 'ENTERPRISE') return;

    const limit \= FEATURE\_LIMITS\[sub.tier\]\[featureKey\];  
      
    // Find or initialize usage  
    let usageRecord \= sub.featureUsages.find(f \=\> f.featureKey \=== featureKey);  
      
    if (\!usageRecord) {  
      usageRecord \= await this.prisma.featureUsage.create({  
        data: {  
          subscriptionId: sub.subscriptionId,  
          featureKey: featureKey,  
          currentUsageCount: 0,  
        }  
      });  
    }

    // Monthly Reset Logic for cyclic features (e.g., Deep Scans, Outreaches)  
    if (this.isCyclicFeature(featureKey) && usageRecord.resetAt && new Date() \> usageRecord.resetAt) {  
       usageRecord \= await this.prisma.featureUsage.update({  
         where: { usageId: usageRecord.usageId },  
         data: { currentUsageCount: 0, resetAt: this.getNextMonthDate() }  
       });  
    }

    if (usageRecord.currentUsageCount \+ incrementBy \> limit) {  
      throw new ForbiddenException(  
        \`Plan Limit Reached: Your ${sub.tier} plan restricts ${featureKey} to ${limit}. Please upgrade your plan.\`  
      );  
    }

    // Increment usage safely  
    await this.prisma.featureUsage.update({  
      where: { usageId: usageRecord.usageId },  
      data: { currentUsageCount: { increment: incrementBy } }  
    });  
  }

  private isCyclicFeature(featureKey: string): boolean {  
    return \['MAX\_DEEP\_SCANS\_MONTHLY', 'MAX\_MANAGED\_OUTREACH'\].includes(featureKey);  
  }

  private getNextMonthDate(): Date {  
    const d \= new Date();  
    d.setMonth(d.getMonth() \+ 1);  
    return d;  
  }  
}

### **Next Steps for Implementation:**

1. **Razorpay Dashboard setup:** You must log into Razorpay and create the precise Plans under the Subscriptions tab (e.g., a $99/mo plan and a ₹ equivalent plan).  
2. **Webhooks:** Map the subscription.charged webhook in your escrow-webhook.controller.ts to reset the resetAt dates in feature\_usages whenever a successful monthly recurring charge occurs.

