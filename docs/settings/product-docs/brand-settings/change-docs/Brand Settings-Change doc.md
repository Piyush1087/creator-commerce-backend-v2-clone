# Integrations

This is how the new journey looks like:

* Brands social handles are stored from the website during initial scan.  
* In the social sync step of onboarding, brands are asked to connect their Instagram, where they can either give the Basics permissions or Basics and Insights permissions. The third option with brands is that they can skip.  
    
  Case 1: Brands connected their Instagram account but with basic permissions  
* Top section will show the Instagram connection status as partially connected  
  * There will be a cta  as reconnect, this will be to give both the permissions after reconnections. Reconnection journey be handled in the backend, which will basically remove the connection and create a new one with Instagram. Brands will also be shown the benefits of giving Insights permissions.  
  * If the access token expired for some reason, then the they will see the reconnect cta along with a message highlighting why we asking to reconnect  
* Bottom section will be the Meta business suite connection for the Creator Marketplace, which will Give following capabilities to brands: Targeted outreach, Automated Influencer discovery and enhanced tracking of campaigns.


	Case 2: Brands connected their Instagram during onboarding with both the permissions

* Top section will Show the Instagram connection status as connected with both the permissions tick marked.  
* Bottom section will be the Meta business suite connection for the Creator Marketplace, which will Give following capabilities to brands: Targeted outreach, Automated Influencer discovery and enhanced tracking of campaigns.

	Case 3: Brands skipped the Instagram connection step during onboarding.

* When brand lands on the integration tab within settings:  
  * The Meta business suite connection for for creator marketplace will appear as the top section   
  * Bottom section will be Instagram connection section for basic and Insights permissions   
*   
* We also want to give two more options for each connection, first is disconnect and other is delete data, but we don’t want to put them in front.  
* Make sure approperiate information and incentives for each connections are highlighted and all the states are mentioned.

# Use cases

# **Architectural Specification & Use Cases: Integrations Module (Brand Settings)**

## **1\. System Journey & Layout Mapping Matrix**

The platform dynamically adjusts the layout, section hierarchy, and action triggers on the **Settings \> Integrations** tab based on the brand's onboarding social sync selection.

| Onboarding Entry State | Top Section Layout | Bottom Section Layout | Primary CTAs & Visual Indicators |
| :---- | :---- | :---- | :---- |
| **Case 1: Instagram Connected (Basic Permissions Only)** | **Instagram Connection Card**  • Status: 🟡 Partially Connected  • Scraped Handle: @handle | **Meta Business Suite Card**  • Status: 🔘 Not Connected  • Focus: Creator Marketplace Sync | **Top:** \[ Reconnect to Enable Insights \]  **Bottom:** \[ Connect Meta Business Suite \]  *Highlights Insights benefits & Creator Marketplace capabilities*. |
| **Case 2: Instagram Connected (Basics \+ Insights)** | **Instagram Connection Card**  • Status: 🟢 Connected  • Permissions: \[✓\] Basics \[✓\] Insights | **Meta Business Suite Card**  • Status: 🔘 Not Connected  • Focus: Creator Marketplace Sync | **Top:** \[ ⚙️ Manage Connection \] (Drawer) **Bottom:** \[ Connect Meta Business Suite \]  *Direct messaging & discovery incentives highlighted*. |
| **Case 3: Skipped Onboarding Connection** | **Meta Business Suite Card (Primary)**  • Status: 🔘 Not Connected  • Dual Scope Recommendation | **Instagram Connection Card (Fallback)**  • Visual Divider: — OR —  • Scope: Basics & Insights | **Top:** \[ Connect Meta Business Suite → \]  **Bottom:** \[ Connect Instagram Standalone \]  *Positions Meta Suite as primary recommendation*. |

## **2\. Detailed Use Cases & Lifecycle Execution**

### **Case 1: Onboarding Entry — Instagram Connected (Basic Permissions Only)**

* **UC-INT-01: Render Partially Connected State**  
  * **User Context:** The brand authenticated Instagram during onboarding but only granted basic profile permissions (instagram\_basic).  
  * **UI Layout:**  
    1. **Top Section:** Instagram Card displays status badge 🟡 Partially Connected alongside the verified handle (e.g., @thecreatorshop). The card explicitly lists active permissions (\[✓\] Basics) alongside missing capabilities (\[ \] Insights).  
    2. **Incentive Banner:** Displays a highlight callout: *"Grant Insights permissions to import engagement statistics, reel views, and post performance analytics directly into campaign dashboards."*  
    3. **Bottom Section:** Meta Business Suite Card renders in an unconnected state, highlighting Creator Marketplace capabilities: **Targeted Outreach**, **Automated Influencer Discovery**, and **Enhanced Campaign Tracking**.  
* **UC-INT-02: Instagram Reconnection Flow (Scope Expansion)**  
  * **User Action:** The user clicks \[ Reconnect to Enable Insights \] in the top section.  
  * **System Execution:**  
    1. The backend invalidates the existing single-scope access token.  
    2. Launches Meta OAuth requesting both instagram\_basic and instagram\_manage\_insights scopes.  
    3. Upon successful callback, the system replaces the token record in the database (access\_token\_encrypted).  
    4. The top section UI updates to 🟢 Connected with both checkboxes ticked (\[✓\] Basics \[✓\] Insights).  
* **UC-INT-03: Basic Connection Token Expiration Handling**  
  * **Trigger:** The stored basic access token expires or is revoked externally from Meta account settings.  
  * **UI Layout:** The top section transitions into an amber warning frame displaying ⚠️ Action Required: Token Expired.  
  * **Micro-copy:** *"Your authentication token has expired. Reconnect your account to restore data synchronization."*  
  * **User Action:** Clicks \[ Reconnect Account \] to trigger OAuth re-authorization without corrupting historical workspace data.

### **Case 2: Onboarding Entry — Instagram Connected (Basics \+ Insights)**

* **UC-INT-04: Render Fully Connected Instagram State**  
  * **User Context:** The brand authenticated Instagram during onboarding and granted both **Basics** and **Insights** permissions.  
  * **UI Layout:**  
    * **Top Section:** Instagram Card displays status badge 🟢 Connected alongside two explicit tick marks: \[✓\] Basic Profile Access and \[✓\] Engagement & Performance Insights. Primary CTAs are replaced with a discreet \[ ⚙️ Manage Connection \] secondary button.  
    * **Bottom Section:** Meta Business Suite Card displays as an available upgrade path.  
    * **Incentive Banner:** Highlights: *"Unlock Direct Messaging: Connect Meta Business Suite below to dispatch automated outreach into creator priority inboxes and leverage AI persona discovery."*

### **Case 3: Onboarding Entry — Skipped Connection Step**

* **UC-INT-05: Render Skipped Onboarding Layout**  
  * **User Context:** The brand skipped social authentication during onboarding.  
  * **UI Layout:**  
    * **Top Section (Primary Card):** Meta Business Suite Card is positioned at the top of the tab as the primary recommendation. It highlights dual capability: Graph API tracking *plus* Meta Creator Marketplace functionality.  
    * **Visual Divider:** An — OR — divider separates the top and bottom sections.  
    * **Bottom Section (Secondary Card):** Standalone Instagram Connection Card is rendered as a secondary option for brands wanting read-only profile metrics without direct messaging capabilities.

### **Shared Core Operations: Meta Business Suite & Secondary Actions**

* **UC-INT-06: Connect Meta Business Suite (Creator Marketplace Handshake)**  
  * **User Action:** User clicks \[ Connect Meta Business Suite \] (from any entry state).  
  * **System Execution:** Launches combined OAuth sequence requesting Graph API and Creator Marketplace permissions. Upon completion, Creator Marketplace capabilities unlock:  
    1. **Targeted Outreach:** Direct Message (DM) dispatch straight into creator priority inboxes.  
    2. **Automated Influencer Discovery:** AI persona engine scans audience demographics matching Brand DNA.  
    3. **Enhanced Campaign Tracking:** Ingests live post, story, and reel performance metrics.  
* **UC-INT-07: Secondary Discreet Actions (Drawer Execution)**  
  * **Design Rule:** Disconnect and Data Deletion triggers must **not** be placed prominently on the primary interface card.  
  * **User Action:** User clicks \[ ⚙️ Manage Connection \] on an active connection card.  
  * **System Execution:** Bypasses screen redirection and opens a 460px right-side drawer. The bottom "Danger Zone" inside the drawer exposes two discreet actions:  
    1. \[ Disconnect Integration \]: Prompts Modal B confirmation. Sets is\_active \= FALSE and pauses API webhooks while preserving historical campaign metrics and escrow audit logs.  
    2. \[ Delete Ingested Social Data \]: Prompts strict deletion verification. Purges cached performance analytics, audience demographics, and Graph API logs from database storage.

## **3\. Comprehensive Edge Cases & System Guardrails**

* **EC-01: Scraped Domain Handle vs. Authenticated OAuth Identity Mismatch**  
  * **Scenario:** During initial setup, the automated domain scan saved @nike\_us. During settings setup, the user authenticates a Meta account registered under @nike\_global.  
  * **System Mitigation:** The backend compares Inbound\_OAuth\_Handle \!== Saved\_Brand\_Handle. Token activation is held in a PENDING\_RESOLVE state and triggers **Modal A (Identity Conflict Resolution)**. The user must explicitly choose to \[ Overwrite & Use New Identity \] or \[ Cancel Handshake \].  
* **EC-02: Partial Permission Selection during Meta Business Suite Setup**  
  * **Scenario:** A brand initiates Meta Business Suite connection but manually unchecks Creator Marketplace / Direct Messaging scopes inside Meta's native consent popup.  
  * **System Mitigation:** The backend inspects granted scopes via Meta's /debug\_token endpoint. It sets the Graph API layer to 🟢 Connected but flags Creator Marketplace as 🟡 Basic Access. An inline warning appears: *"Messaging permissions were withheld in Meta settings. Reconnect to enable automated DM outreach."*  
* **EC-03: Attempted Disconnection or Data Deletion during Active Campaigns**  
  * **Scenario:** A user opens the \[ ⚙️ Manage Connection \] drawer and clicks \[ Disconnect Integration \] or \[ Delete Ingested Social Data \] while campaigns are executing in Stage 2 through Stage 5\.  
  * **System Mitigation:** The system checks UceCampaign records for active stages. If active contracts depend on live post verification or escrow milestones, the system blocks the action and renders an error modal: *"Cannot disconnect or purge social data while campaigns are actively running. Conclude active campaigns before modifying API integrations."*  
* **EC-04: Mid-Flight OAuth Abort or Popup Window Closure**  
  * **Scenario:** A user clicks \[ Reconnect \] to upgrade permissions but closes the browser popup window before completing Meta authorization.  
  * **System Mitigation:** The system uses a **Staging Token Pattern**. The original active token remains operational in the database until an incoming OAuth callback successfully completes and exchanges a valid replacement token.  
* **EC-05: Direct Messaging Execution Attempt on Standalone Instagram Connection**  
  * **Scenario:** A brand connected on standalone Instagram (Case 1 or Case 2\) attempts to trigger automated DM outreach in Stage 1 of a campaign.  
  * **System Mitigation:** The campaign engine verifies connection capabilities. Recognizing that standalone Instagram lacks DM access, the system disables the dispatch button and prompts an inline upgrade modal: *"Direct Messaging requires Meta Business Suite integration. Upgrade your connection in Settings to enable automated DM outreach."*  
* **EC-06: API Token Invalidation During Active Background DM Queue Execution**  
  * **Scenario:** A Meta access token expires or is revoked mid-way through a background queue dispatching automated outreach messages.  
  * **System Mitigation:** The background queue worker catches the 401 Unauthorized API response, safely pauses the remaining message queue, marks the connection state as ⚠️ Action Required: Token Expired, and sends an in-app alert prompting re-authentication.

# UI Copy

# **UI Copy Specifications: Integrations Module (Brand Settings)**

## **1\. Top Level & Main Header Framework**

### **Primary Header Stack**

* **Headline:** Settings  
* **Subline:** Manage your personal profile, workspace permissions, external integrations, and financial ledgers.

### **Navigation Rail Tabs**

* \[ ⚙️ General \]  
* \[ 🧩 Integrations \] *(Active Focus)*  
* \[ 💳 Billing \]

## **2\. Pre-Connection Discovery Banner**

* **Status Badge:** \[ Pill Badge: ⚠️ UNVERIFIED DEEP DISCOVERY \]  
* **Context Text:** "Our AI-driven website analysis has identified the following target profile handle associated with your organization's parent domain: @\[Captured\_Handle\]."  
* **System Callout Notice:**  
* \> 💡 System Requirement: Authenticate your profile below via Meta OAuth to activate performance tracking, AI persona discovery, and outreach synchronization.

## **3\. Case 1: Instagram Partially Connected View (Basics Only)**

### **Top Section — Instagram Connection Card**

* **Card Title:** Instagram Profile Connection  
* **Status Indicator:** Identity State: 🟡 Partially Connected  
* **Account Handle Display:** Connected Account: @\[Scraped\_Handle\]  
* **Permissions Checklist Matrix:**  
  * \[✓\] Basic Profile Access  
  * \[ \] Engagement & Performance Insights  
* **Value-Add Callout Box:**  
* \> 💡 Value Add: Reconnect to grant Insights permissions to enhance your profile for a better campaign configuration.  
* **Action CTAs:**  
  * Primary Button: \[ Reconnect to Enable Insights \]  
  * Secondary Button: \[ ⚙️ Manage Connection \]

### **Bottom Section — Meta Business Suite Card**

* **Card Title:** Meta Business Suite — Creator Marketplace  
* **Status Indicator:** Identity State: 🔘 Not Connected  
* **Subline:** Unlock Creator Marketplace to automate outreach and discovery pipelines.  
* **Capabilities Unlocked List:**  
  * 📨 Targeted Outreach: Dispatch automated DMs directly to creator priority inboxes.  
  * ✨ Automated Influencer Discovery: AI persona engine matches Brand DNA with creator demographics.  
  * 📈 Enhanced Campaign Tracking: Unified metric ingestion across active campaigns.  
* **Action CTA:** \[ Connect Meta Business Suite → \]

## **4\. Case 2: Instagram Connected View (Basics \+ Insights)**

### **Top Section — Instagram Connection Card**

* **Card Title:** Instagram Profile Connection  
* **Status Indicator:** Identity State: 🟢 Connected  
* **Account Handle Display:** Connected Account: @\[Scraped\_Handle\]  
* **Permissions Checklist Matrix:**  
  * \[✓\] Basic Profile Access  
  * \[✓\] Insights Access  
* **Action CTA:** \[ ⚙️ Manage Connection \]

### **Bottom Section — Meta Business Suite Card**

* **Card Title:** Meta Business Suite — Creator Marketplace  
* **Status Indicator:** Identity State: 🔘 Not Connected  
* **Subline:** Connect Meta Business Suite to enable Direct Messaging and Creator Marketplace features.  
* **Capabilities Unlocked List:**  
  * 📨 Targeted Outreach: Dispatch automated DMs directly to creator priority inboxes.  
  * ✨ Automated Influencer Discovery: AI persona engine matches Brand DNA with creator demographics.  
  * 📈 Enhanced Campaign Tracking: Unified metric ingestion across active campaigns.  
* **Action CTA:** \[ Connect Meta Business Suite → \]

## **5\. Case 3: Skipped Onboarding Connection View**

### **Top Section (Primary Option) — Meta Business Suite Card**

* **Card Title:** Meta Business Suite — Creator Marketplace (Primary)  
* **Status Indicator:** Identity State: 🔘 Not Connected  
* **Subline:** Complete Dual Access: Graph API Tracking \+ Meta Creator Marketplace  
* **Capabilities Unlocked List:**  
  * 📨 Targeted Outreach: Dispatch automated DMs directly to creator priority inboxes.  
  * ✨ Automated Influencer Discovery: AI persona engine matches Brand DNA with creator demographics.  
  * 📈 Enhanced Campaign Tracking: Unified metric ingestion across active campaigns.  
* **Action CTA:** \[ Connect Meta Business Suite → \]

### **Visual Section Divider**

## — OR —

### **Bottom Section (Secondary Fallback) — Standalone Instagram Card**

* **Card Title:** Instagram Profile Connection (Secondary Fallback)  
* **Status Indicator:** Identity State: 🔘 Not Connected  
* **Subline:** Standalone Profile Logs (Basic Profile Data & Performance Analytics Only)  
* **Scope Notes:**  
  * 📈 Performance Optimization Tracking: Grants basic, read-only metric ingestion paths to import creative content analytics and historical asset engagement statistics.  
  * ⚠️ Automation Limit: Does not support automated AI-driven creator matchmaking configurations or automated Direct Message communication delivery pipelines.  
* **Action CTA:** \[ Connect Instagram Standalone \]

## **6\. System Exception & Token Expired States**

* **Status Badge:** ⚠️ Action Required: Token Expired  
* **Warning Message Copy:** "Your authentication token has expired. Reconnect your account to restore data synchronization."  
* **Action CTA:** \[ Reconnect Account \]

## **7\. Drawers & System Modals UI Copy**

### **Drawer A: Manage Connection Panel (Right-Side Drawer)**

* **Drawer Header:** Manage Connection  
* **Drawer Subline:** Review permission layers and connection lifecycle.  
* **Permissions Checklist Section:**  
  * **Checkbox 1 Title:** Sync Creator Campaign Metric Logs  
    * *Description:* Ingest view counts, reel reach, story views, and post metrics.  
  * **Checkbox 2 Title:** Profile Discovery Engine Ingestion  
    * *Description:* Allow algorithm to analyze connected audience demographics.  
* **Danger Zone Section:**  
  * **Section Title:** DANGER ZONE  
  * **Section Subline:** Discreet administrative operations for this account.  
  * **Item 1 Action:** \[ Disconnect Integration \]  
    * *Description:* Revokes API tokens & pauses live webhooks.  
  * **Item 2 Action:** \[ Delete Ingested Social Data \]  
    * *Description:* Permanently purges cached analytics & logs.  
* **Drawer Footer CTAs:**  
  * Left Button: \[ Close Panel \]  
  * Right Button: \[ Save Integration Settings \]

### **Modal A: Identity Conflict Resolution Overlay**

* **Modal Title:** ⚠️ Meta Identity Conflict Detected  
* **Modal Subline:** The inbound authenticated Meta handle does not match the active Instagram handle parameters tracked in your Brand Center settings.  
* **Identity Vector Labels:**  
  * Active Platform Identity Vector: @\[Current\_Platform\_Handle\]  
  * Inbound Authenticated Identity Vector: @\[Inbound\_OAuth\_Handle\]  
* **Explanatory Body Copy:** "All active campaign briefs, creator negotiation pipelines, escrow milestones, and verification logs depend on maintaining a single, consistent identity track. Overwriting this context will alter your global profile parameters."  
* **Action CTAs:**  
  * Primary Button: \[ Overwrite & Use New Identity \]  
  * Secondary Button: \[ Cancel Handshake & Reconnect Correct Profile \]

### **Modal B: Connection Termination Confirmation Overlay**

* **Modal Title:** ⚠️ Sever Meta Ecosystem Data Sync?  
* **Warning Body Copy:** "You are about to terminate active communication tracks, data webhooks, and performance ingestion pipelines established with the Meta API. The platform will lose the capability to execute automated influencer matching or monitor active campaign reels. Historical data logs will remain locked in read-only tracking states."  
* **Verification Checkbox Label:** \[x\] I explicitly verify that I have the administrative authority to sever this integration architecture and pause active outreach pipelines.  
* **Action CTAs:**  
  * Confirm Button: \[ Disconnect Integration & Sever Webhooks \] *(Destructive Red)*  
  * Cancel Button: \[ Maintain Active Connection State \]

## **8\. Pipeline & Evolution Extensions (Roadmap Section)**

### **Card A (Left Grid Column)**

* **Card Header:** Gmail Workspace Sync  
* **Status Badge:** \[ Pill Badge: IN PIPELINE \]  
* **Description:** Link your official corporate communication node to manage email-based influencer negotiation pipelines and contract routing tables straight from your dashboard workspace.

### **Card B (Right Grid Column)**

* **Card Header:** Shopify Commerce & Analytics Hub  
* **Status Badge:** \[ Pill Badge: ROADMAP \]  
* **Description:** Integrate online storefront infrastructure and conversion pixel tracking models to match localized creator campaigns directly to gross product sales metrics.

# Zod

# **Zod Validation Schema Change Document: Integrations Updates**

This document outlines all new Zod schemas, modifications, enums, and type exports required in brandSettings.schema.ts to support the new Integrations workflow.

## **1\. New Enums to Add**

Add the following enums to standardize integration platforms, connection states, permission scopes, and drawer action types:  
TypeScript  
export const IntegrationProviderEnum \= z.enum(\[  
  'META\_BUSINESS\_SUITE',  
  'INSTAGRAM',  
\]);

export const IntegrationStatusEnum \= z.enum(\[  
  'CONNECTED',           // Fully Connected  
  'PARTIALLY\_CONNECTED', // Basic profile access only  
  'TOKEN\_EXPIRED',       // Action Required: Token Expired  
  'DISCONNECTED',        // Unconnected / Skipped Onboarding  
\]);

export const IntegrationScopeEnum \= z.enum(\[  
  'BASIC\_PROFILE',  
  'ENGAGEMENT\_INSIGHTS', // Reel views, story reach, post engagement  
  'TARGETED\_OUTREACH',   // Direct DMs  
\]);

export const ManageConnectionActionEnum \= z.enum(\[  
  'RECONNECT',  
  'DISCONNECT\_INTEGRATION',  
  'DELETE\_INGESTED\_DATA',  
\]);

## **2\. New Schemas to Add (Zone 5: Integrations & OAuth)**

### **A.** IntegrationConnectionSchema

Validates platform integration configurations, connection statuses, handle formatting, scopes, and token expirations.  
TypeScript  
export const IntegrationConnectionSchema \= z.object({  
  id: z.string().uuid({ message: 'Integration ID must be a valid RFC4122 UUID.' }),  
  provider: IntegrationProviderEnum,  
  status: IntegrationStatusEnum,  
  currentPlatformHandle: z  
    .string()  
    .min(1, { message: 'Platform handle is required.' })  
    .startsWith('@', { message: 'Handle must start with "@".' }),  
  inboundOauthHandle: z  
    .string()  
    .startsWith('@', { message: 'Inbound handle must start with "@".' })  
    .nullable()  
    .optional(),  
  scopes: z.array(IntegrationScopeEnum).default(\[\]),  
  tokenExpiresAt: z.string().datetime({ message: 'Must be a valid ISO date-time string.' }).nullable().optional(),  
});

### **B.** ManageConnectionActionSchema

Handles actions triggered inside the **Manage Connection** drawer, enforcing a required safety confirmation on data deletion requests.  
TypeScript  
export const ManageConnectionActionSchema \= z.object({  
  integrationId: z.string().uuid({ message: 'Target integration ID must be a valid UUID.' }),  
  action: ManageConnectionActionEnum,  
  confirmDeleteData: z.boolean().optional().default(false),  
}).refine((data) \=\> {  
  if (data.action \=== 'DELETE\_INGESTED\_DATA' && \!data.confirmDeleteData) {  
    return false;  
  }  
  return true;  
}, {  
  message: 'Explicit confirmation required to execute "Delete Ingested Social Data".',  
  path: \['confirmDeleteData'\],  
});

### **C.** IdentityConflictResolutionSchema

Validates choices made in the handle mismatch modal when an incoming OAuth handle conflicts with the currently configured platform handle.  
TypeScript  
export const IdentityConflictResolutionSchema \= z.object({  
  integrationId: z.string().uuid({ message: 'Integration ID must be a valid UUID.' }),  
  currentPlatformHandle: z.string().startsWith('@'),  
  inboundOauthHandle: z.string().startsWith('@'),  
  resolution: z.enum(\['OVERWRITE\_HANDLE', 'CANCEL\_CONNECT'\]),  
});

## **3\. Existing Schema Modifications**

### MasterBrandSettingsPayloadSchema

Update the parent aggregation object to accept an array of integration configurations.

#### **Before:**

TypeScript  
export const MasterBrandSettingsPayloadSchema \= z.object({  
  brandId: z.string().uuid({ message: 'The parent context brand routing parameter must be an explicit UUID.' }),  
  billingProfile: BrandBillingProfileSchema,  
  withdrawalAccount: BrandWithdrawalAccountSchema.optional(),  
  notificationPreferences: z.array(NotificationSettingLineSchema),  
});

#### **After:**

TypeScript  
export const MasterBrandSettingsPayloadSchema \= z.object({  
  brandId: z.string().uuid({ message: 'The parent context brand routing parameter must be an explicit UUID.' }),  
  billingProfile: BrandBillingProfileSchema,  
  withdrawalAccount: BrandWithdrawalAccountSchema.optional(),  
  notificationPreferences: z.array(NotificationSettingLineSchema),  
  integrations: z.array(IntegrationConnectionSchema).optional().default(\[\]), // \<--- ADDED  
});

## **4\. Type Exports to Add**

Append the following inferred TypeScript DTO and enum types at the end of the file:  
TypeScript  
export type IntegrationProvider \= z.infer\<typeof IntegrationProviderEnum\>;  
export type IntegrationStatus \= z.infer\<typeof IntegrationStatusEnum\>;  
export type IntegrationScope \= z.infer\<typeof IntegrationScopeEnum\>;  
export type IntegrationConnectionDto \= z.infer\<typeof IntegrationConnectionSchema\>;  
export type ManageConnectionActionDto \= z.infer\<typeof ManageConnectionActionSchema\>;  
export type IdentityConflictResolutionDto \= z.infer\<typeof IdentityConflictResolutionSchema\>;

# Backend schema

# **Database Schema Change Document: Integrations Module Update**

This document details the database schema extension required for settings.sql to support the new **Integrations Module** workflows, including Meta OAuth token storage, scope configurations, handle tracking, token lifecycle statuses, and indexing strategies.

## **1\. New PostgreSQL Enum Factories**

Add the following type definitions to enforce strict database-level validation for providers, connection states, and permission scope matrices:  
SQL  
\-- \=============================================================================  
\-- ENUM FACTORIES (INTEGRATIONS EXTENSION)  
\-- \=============================================================================  
CREATE TYPE "IntegrationProvider" AS ENUM (  
    'META\_BUSINESS\_SUITE',   
    'INSTAGRAM'  
);

CREATE TYPE "IntegrationStatus" AS ENUM (  
    'CONNECTED',           \-- Basics \+ Insights / Business Suite Sync (Case 2\)  
    'PARTIALLY\_CONNECTED', \-- Basic Profile Access Only (Case 1\)  
    'TOKEN\_EXPIRED',       \-- Token Expired / Re-authentication Needed  
    'DISCONNECTED'         \-- Unconnected / Skipped Onboarding (Case 3\)  
);

CREATE TYPE "IntegrationScope" AS ENUM (  
    'BASIC\_PROFILE',  
    'ENGAGEMENT\_INSIGHTS', \-- Analytics & Post Performance  
    'TARGETED\_OUTREACH'    \-- Automated DM Dispatch  
);

## **2\. New Table Definition:** brand\_integrations

Add **Table 5** to house active OAuth connections, encrypted token credentials, handle parameters, and scope configurations. Foreign key relationships mirror the existing cascading design pattern (ON DELETE CASCADE).  
SQL  
\-- \=============================================================================  
\-- TABLE 5: BRAND SOCIAL INTEGRATIONS & OAUTH CREDENTIALS  
\-- \=============================================================================  
CREATE TABLE IF NOT EXISTS "brand\_integrations" (  
    "integration\_id" UUID NOT NULL DEFAULT gen\_random\_uuid(),  
    "brand\_id" UUID NOT NULL,  
    "provider" "IntegrationProvider" NOT NULL,  
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',  
    "current\_platform\_handle" VARCHAR(255) NOT NULL, \-- Active handle e.g. @thecreatorshop  
    "inbound\_oauth\_handle" VARCHAR(255) NULL,        \-- Captured during OAuth handshake for conflict checks  
    "access\_token\_encrypted" TEXT NULL,               \-- Application/KMS encrypted OAuth token  
    "refresh\_token\_encrypted" TEXT NULL,              \-- Application/KMS encrypted refresh token  
    "granted\_scopes" "IntegrationScope"\[\] NOT NULL DEFAULT '{}',  
    "token\_expires\_at" TIMESTAMPTZ NULL,  
    "is\_active" BOOLEAN NOT NULL DEFAULT TRUE,  
    "created\_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT\_TIMESTAMP,  
    "updated\_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT\_TIMESTAMP,  
    CONSTRAINT "brand\_integrations\_pkey" PRIMARY KEY ("integration\_id"),  
    CONSTRAINT "fk\_integrations\_brand" FOREIGN KEY ("brand\_id") REFERENCES "brands"("brand\_id") ON DELETE CASCADE,  
    CONSTRAINT "uq\_brand\_provider\_pair" UNIQUE ("brand\_id", "provider")  
);

## **3\. High-Performance Indexing Strategy**

Apply these partial and composite indexes to accelerate DM queue execution checks, background token refresh crons, and status queries:  
SQL  
\-- Fast query execution for active integration lookups during campaign dispatch  
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx\_brand\_integrations\_lookup"   
ON "brand\_integrations" ("brand\_id", "provider", "status")   
WHERE "is\_active" \= TRUE;

\-- Accelerated lookup for token health-check background processes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx\_integrations\_token\_expiration"   
ON "brand\_integrations" ("status", "token\_expires\_at")   
WHERE "status" IN ('CONNECTED', 'PARTIALLY\_CONNECTED');

## **4\. Architectural Security & Implementation Constraints**

1. **Token Encryption at Rest (KMS Shield):**  
2. The access\_token\_encrypted and refresh\_token\_encrypted fields must be encrypted at the application layer (e.g., AWS KMS or AES-256-GCM) prior to database insertion or update queries.  
3. **Disconnection vs. Purge Operations:**  
   * \[ Disconnect Integration \]**:** Executes an UPDATE brand\_integrations SET is\_active \= FALSE, status \= 'DISCONNECTED', access\_token\_encrypted \= NULL WHERE integration\_id \= $1. Keeps historical campaign logs intact.  
   * \[ Delete Ingested Social Data \]**:** Purges cached performance data, audience demographic tables, and Graph API logs linked to brand\_id.  
4. **Role-Based Access Masking (RBAC):**  
5. When the backend serves brand\_integrations payloads to users with the CAMPAIGN\_MANAGER or EXECUTIVE role, access\_token\_encrypted and refresh\_token\_encrypted must be stripped entirely from the response object.  
6. **Cascade Cleanup:**  
7. In compliance with the workspace architecture, deleting a parent record from brands(brand\_id) automatically purges all connected integration tokens and scope history via ON DELETE CASCADE.

