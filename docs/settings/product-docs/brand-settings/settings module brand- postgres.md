To seamlessly integrate the **Brand-Side Settings Module** with your platform's existing database architecture, we need to extend the database schema. This module must securely house corporate tax configurations (GST/TDS), billing profiles, team permission matrices (Role-Based Access Control), notification channel triggers, and reverse-payout bank accounts.  
Based on the required architectural footprint and security requirements, here is the additional production-ready PostgreSQL schema setup.

### **1\. PostgreSQL Schema Definition Extensions (**settings.prisma **/** settings.sql**)**

SQL  
\-- \=============================================================================  
\-- ENUM FACTORIES (TYPE-SAFETY BOUNDARIES)  
\-- \=============================================================================  
CREATE TYPE "BrandRole" AS ENUM ('BRAND\_OWNER', 'FINANCE\_ADMIN', 'CAMPAIGN\_MANAGER');  
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN\_APP', 'SLACK\_WEBHOOK');  
CREATE TYPE "NotificationCategory" AS ENUM ('ESCROW\_LOW\_BALANCE', 'MILESTONE\_RELEASE\_REQUEST', 'TAX\_COMPLIANCE\_ALERT', 'CAMPAIGN\_BUDGET\_OVERRUN');

\-- \=============================================================================  
\-- TABLE 1: BRAND TEAM ACCESS CONTROL (RBAC MATRIX)  
\-- \=============================================================================  
CREATE TABLE IF NOT EXISTS "brand\_team\_members" (  
    "membership\_id" UUID NOT NULL DEFAULT gen\_random\_uuid(),  
    "brand\_id" UUID NOT NULL,  
    "user\_id" UUID NOT NULL, \-- References your platform's core global user table  
    "role" "BrandRole" NOT NULL DEFAULT 'CAMPAIGN\_MANAGER',  
    "is\_active" BOOLEAN NOT NULL DEFAULT TRUE,  
    "joined\_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT\_TIMESTAMP,  
    "updated\_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT\_TIMESTAMP,  
    CONSTRAINT "brand\_team\_members\_pkey" PRIMARY KEY ("membership\_id"),  
    CONSTRAINT "fk\_team\_brand" FOREIGN KEY ("brand\_id") REFERENCES "brands"("brand\_id") ON DELETE CASCADE,  
    CONSTRAINT "uq\_brand\_user\_pair" UNIQUE ("brand\_id", "user\_id")  
);

\-- \=============================================================================  
\-- TABLE 2: TAXATION & RECONCILIATION PROFILES (FINANCIAL COMPLIANCE)  
\-- \=============================================================================  
CREATE TABLE IF NOT EXISTS "brand\_billing\_profiles" (  
    "profile\_id" UUID NOT NULL DEFAULT gen\_random\_uuid(),  
    "brand\_id" UUID NOT NULL UNIQUE,  
    "registered\_company\_name" VARCHAR(255) NOT NULL,  
    "corporate\_billing\_address" TEXT NOT NULL,  
    "gstin" VARCHAR(15) NULL, \-- Indian 15-character statutory GST Identity Number  
    "pan" VARCHAR(10) NULL,    \-- Indian 10-character Permanent Account Number for TDS tracking  
    "default\_tds\_percentage" NUMERIC(5, 2) NOT NULL DEFAULT 2.00, \-- Default fallback profile percentage  
    "currency\_preference" VARCHAR(3) NOT NULL DEFAULT 'INR',  
    "updated\_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT\_TIMESTAMP,  
    CONSTRAINT "brand\_billing\_profiles\_pkey" PRIMARY KEY ("profile\_id"),  
    CONSTRAINT "fk\_billing\_brand" FOREIGN KEY ("brand\_id") REFERENCES "brands"("brand\_id") ON DELETE CASCADE  
);

\-- \=============================================================================  
\-- TABLE 3: REVERSE PAYOUT / WITHDRAWAL BENEFICIARY CONFIGURATION  
\-- \=============================================================================  
CREATE TABLE IF NOT EXISTS "brand\_withdrawal\_accounts" (  
    "account\_id" UUID NOT NULL DEFAULT gen\_random\_uuid(),  
    "brand\_id" UUID NOT NULL,  
    "beneficiary\_name" VARCHAR(255) NOT NULL,  
    "bank\_name" VARCHAR(255) NOT NULL,  
    "account\_number\_encrypted" TEXT NOT NULL, \-- Hardware or application-layer encrypted  
    "ifsc\_code" VARCHAR(11) NOT NULL,  
    "is\_verified\_payout\_destination" BOOLEAN NOT NULL DEFAULT FALSE,  
    "created\_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT\_TIMESTAMP,  
    "updated\_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT\_TIMESTAMP,  
    CONSTRAINT "brand\_withdrawal\_accounts\_pkey" PRIMARY KEY ("account\_id"),  
    CONSTRAINT "fk\_withdrawal\_brand" FOREIGN KEY ("brand\_id") REFERENCES "brands"("brand\_id") ON DELETE CASCADE  
);

\-- \=============================================================================  
\-- TABLE 4: GRANULAR NOTIFICATION FREQUENCY & CHANNEL CONFIGURATIONS  
\-- \=============================================================================  
CREATE TABLE IF NOT EXISTS "brand\_notification\_settings" (  
    "setting\_id" UUID NOT NULL DEFAULT gen\_random\_uuid(),  
    "brand\_id" UUID NOT NULL,  
    "category" "NotificationCategory" NOT NULL,  
    "channel" "NotificationChannel" NOT NULL,  
    "is\_enabled" BOOLEAN NOT NULL DEFAULT TRUE,  
    "slack\_webhook\_url" TEXT NULL, \-- Populated if channel is 'SLACK\_WEBHOOK'  
    "updated\_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT\_TIMESTAMP,  
    CONSTRAINT "brand\_notification\_settings\_pkey" PRIMARY KEY ("setting\_id"),  
    CONSTRAINT "fk\_notifications\_brand" FOREIGN KEY ("brand\_id") REFERENCES "brands"("brand\_id") ON DELETE CASCADE,  
    CONSTRAINT "uq\_brand\_category\_channel" UNIQUE ("brand\_id", "category", "channel")  
);

### **2\. High-Performance Indexing Strategy (**indexes.sql**)**

To protect performance during nested transactional calculations and high-frequency webhook notifications, apply these indexes concurrently:  
SQL  
\-- Fast query execution over RBAC scoping validations  
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx\_brand\_team\_user\_role"   
ON "brand\_team\_members" ("user\_id", "brand\_id", "role");

\-- Accelerated lookup for notification message dispatch layers  
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx\_brand\_notification\_lookup"   
ON "brand\_notification\_settings" ("brand\_id", "category")   
WHERE "is\_enabled" \= TRUE;

### **3\. Structural Security & Architectural Integration Mapping**

When writing the backend application code to interface with these new schema elements, ensure the following constraints are systematically enforced:

1. **The Masked Read-Only Shield**: When the frontend requests details from brand\_withdrawal\_accounts or brand\_billing\_profiles, the application service must evaluate the role inside brand\_team\_members. If the matching role is CAMPAIGN\_MANAGER, the backend must intercept the payload and mask the account\_number\_encrypted, gstin, and pan fields before transmission.  
2. **Dynamic Cross-Table Data Validation**: In your collaboration\_escrow\_locks insertion engine, swap out hardcoded default values and perform an intermediate cross-table query against brand\_billing\_profiles.default\_tds\_percentage based on the parent brand\_id. This dynamically assigns the correct statutory tax footprint to newly instantiated contract agreements.  
3. **Automated Auditing via Cascade Actions**: All setting tables feature foreign key constraints mapped directly to your primary brands(brand\_id) record hook using ON DELETE CASCADE. If a corporate enterprise brand profile node is expunged or de-provisioned, the database layer cleanly reclaims storage space across compliance profiles and team attachments instantly without generating orphaned data structures.

