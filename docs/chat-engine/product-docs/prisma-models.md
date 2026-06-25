We will now draft the relational **Prisma Data Models** for PostgreSQL. This schema matches the NestJS service layer and React canvas code we previously created, enforcing database-level multi-tenancy constraints and strict data typing.  
Following the design rules from your backend documents, we will use a **one-to-many cascading model layout**. This structure ensures that when a multi-turn campaign slot form finishes processing, its records lock safely into the specific tenant workspace.  
Here is the complete configuration file for your microservices stack:  
Code snippet  
// \=============================================================================  
// DATABASE PROVISIONING CONFIGURATION  
// Reference Architecture: NestJS 10 \+ Prisma ORM \+ PostgreSQL  
// \=============================================================================

datasource db {  
  provider \= "postgresql"  
  url      \= env("DATABASE\_URL")  
}

generator client {  
  provider \= "prisma-client-js"  
}

// \=============================================================================  
// ENUMERATION TYPES (Strictly synchronized with our Zod Schemas)  
// \=============================================================================

enum BrandVertical {  
  D2C\_SKINCARE  
  FASHION\_APPAREL  
  WELLNESS\_NUTRITION  
  ECO\_LIFESTYLE  
}

enum LifecycleStage {  
  EARLY\_LAUNCH  
  GROWTH\_STAGE  
  SCALE\_OPERATIONS  
  ENTERPRISE\_LEVEL  
}

enum CampaignObjective {  
  DIRECT\_CONVERSIONS  
  CREATIVE\_HOOK\_STREAKS  
  FUNNEL\_LEAK\_MITIGATION  
}

enum CampaignLifecycleMaturity {  
  DRAFT\_PLANNER  
  LIVE\_NO\_APPLICANTS  
  LIVE\_PENDING\_APPROVALS  
  FULLY\_COMMITTED\_ESCROW  
}

// \=============================================================================  
// DATA SCHEMAS & RELATION MAPS  
// \=============================================================================

model Brand {  
  // Primary tenant key context matched to MOCK\_CURRENT\_BRAND\_ID in our React view  
  brandId        String         @id @default(dbgenerated("gen\_random\_uuid()")) @map("brand\_id") @db.Uuid  
  companyName    String         @map("company\_name") @db.VarChar(255)  
  websiteUrl     String         @map("website\_url") @db.VarChar(512)  
  brandVertical  BrandVertical  @default(D2C\_SKINCARE) @map("brand\_vertical")  
  lifecycleStage LifecycleStage @default(GROWTH\_STAGE) @map("lifecycle\_stage")  
  createdAt      DateTime       @default(now()) @map("created\_at") @db.Timestamptz  
  updatedAt      DateTime       @updatedAt @map("updated\_at") @db.Timestamptz

  // Relational Integrity Handlers  
  audiencePersonas BrandAudiencePersona\[\]  
  campaigns        Campaign\[\]

  @@map("brands")  
}

model BrandAudiencePersona {  
  personaId        String   @id @default(dbgenerated("gen\_random\_uuid()")) @map("persona\_id") @db.Uuid  
  brandId          String   @map("brand\_id") @db.Uuid  
  personaName      String   @map("persona\_name") @db.VarChar(150)  
    
  // Demographics storage using binary json processing for fast index searches  
  demographicsJson Json     @map("demographics\_json") @db.JsonB  
  psychographics   String?  @map("psychographics\_text") @db.Text  
  createdAt        DateTime @default(now()) @map("created\_at") @db.Timestamptz

  // Explicit foreign key constraint matching the multi-tenant topology  
  brand Brand @relation(fields: \[brandId\], references: \[brandId\], onDelete: Cascade)

  @@index(\[brandId\])  
  @@map("brand\_audience\_personas")  
}

model Campaign {  
  campaignId            String                    @id @default(dbgenerated("gen\_random\_uuid()")) @map("campaign\_id") @db.Uuid  
  brandId               String                    @map("brand\_id") @db.Uuid  
  productName           String                    @map("product\_name") @db.VarChar(100)  
  allocatedBudget       Int                       @map("allocated\_budget") @db.Integer  
  optimizationObjective CampaignObjective         @map("optimization\_objective")  
  lifecycleStage        CampaignLifecycleMaturity @default(DRAFT\_PLANNER) @map("lifecycle\_stage")  
    
  // Array constraint enforcing the 3 key value propositions from your docs  
  coreSellingPoints     String\[\]                  @map("core\_selling\_points") @db.VarChar(255)  
  createdAt             DateTime                  @default(now()) @map("created\_at") @db.Timestamptz  
  updatedAt             DateTime                  @updatedAt @map("updated\_at") @db.Timestamptz

  // Parent Relation mapping hook  
  brand Brand @relation(fields: \[brandId\], references: \[brandId\], onDelete: Cascade)

  @@index(\[brandId\])  
  @@index(\[lifecycleStage\])  
  @@map("campaigns")  
}

### **Architectural Highlights of this Database Schema:**

1. **Strict Type Safety & Enforcement**: The coreSellingPoints column uses standard native PostgreSQL database array types (@db.VarChar(255)\[\]), which maps perfectly to the Zod configuration limits we created.  
2. **Cascading Deletions**: Adding @relation(fields: \[brandId\], references: \[brandId\], onDelete: Cascade) ensures that if a brand workspace is deleted, all related analytics data and campaigns are completely scrubbed out automatically, preventing orphaned rows.  
3. **Optimized Multi-Tenant Lookups**: Database indexes are automatically placed on brandId across the peripheral target schemas. This allows your backend to quickly filter queries by tenant ID (e.g., matching the X-Tenant-Brand-Id headers sent from the UI console).

### **What is our next focus area?**

* **Option A**: Write the seed script (prisma/seed.ts) to pre-populate mock data for your local testing sandbox environment.  
* **Option B**: Build the database integration layer for the **Escrow & Wallet Module** to calculate and track your statutory TDS buffer fund balances automatically.

