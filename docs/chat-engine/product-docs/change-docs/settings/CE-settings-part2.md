# **Brand Settings Module**

# **Part 2 – AI Contract, Intent Registry & Function Registry**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** Backend Developer (NestJS \+ Gemini \+ Cursor)

---

# **1\. Objective**

This document defines how the AI understands, classifies and executes requests related to the **Brand Settings** module.

Unlike other modules, Brand Settings contains multiple configuration domains. The AI must first determine **which submodule** the user is referring to, then expose only the functions relevant to that submodule.

The AI should support:

* Reading settings  
* Updating settings  
* Explaining settings  
* Validating settings  
* Managing integrations  
* Guiding users through configuration

The AI must never access the database or third-party APIs directly. All actions are executed through registered backend functions.

---

# **2\. AI Contract**

Every Brand Settings request follows the same lifecycle.

* User Message  
*   
* ↓  
*   
* Intent Detection  
*   
* ↓  
*   
* Submodule Resolution  
*   
* ↓  
*   
* Entity Resolution  
*   
* ↓  
*   
* Function Resolution  
*   
* ↓  
*   
* Backend Function Execution  
*   
* ↓  
*   
* Response Builder  
*   
* ↓  
*   
* Chat UI  
    
  ---

  # **3\. AI Intent Registry**

Create

* src/modules/settings/  
*   
* brand-settings-intents.ts


The AI Intent Registry is responsible for mapping natural language into executable intents.

---

## **General Intents**

* VIEW\_COMPANY\_PROFILE  
*   
* UPDATE\_COMPANY\_NAME  
*   
* UPDATE\_BRAND\_DESCRIPTION  
*   
* UPDATE\_WEBSITE  
*   
* UPDATE\_LOGO  
*   
* UPDATE\_CONTACT\_EMAIL  
*   
* VIEW\_GENERAL\_SETTINGS  
    
  ---

  ## **Finance Intents**

* VIEW\_FINANCE\_SETTINGS  
*   
* UPDATE\_GST  
*   
* UPDATE\_PAN  
*   
* UPDATE\_BANK\_DETAILS  
*   
* UPDATE\_BILLING\_EMAIL  
*   
* VIEW\_TAX\_INFORMATION  
*   
* VIEW\_BANK\_INFORMATION  
    
  ---

  ## **Integration Intents**

(Updated using Integration Change Document)

* VIEW\_INTEGRATION\_STATUS  
*   
* CONNECT\_INSTAGRAM  
*   
* RECONNECT\_INSTAGRAM  
*   
* DISCONNECT\_INSTAGRAM  
*   
* CONNECT\_META  
*   
* RECONNECT\_META  
*   
* DISCONNECT\_META  
*   
* DELETE\_PROVIDER\_DATA  
*   
* VIEW\_GRANTED\_PERMISSIONS  
*   
* RESOLVE\_IDENTITY\_CONFLICT  
    
  ---

  ## **Help Intents**

* EXPLAIN\_SETTING  
*   
* EXPLAIN\_INTEGRATION  
*   
* EXPLAIN\_PERMISSION  
*   
* EXPLAIN\_FINANCE\_FIELD  
    
  ---

  # **4\. Entity Registry**

Create

* brand-settings-entities.ts


The AI should recognize the following entities.

## **General**

* Company Name  
*   
* Website  
*   
* Logo  
*   
* Brand Description  
*   
* Support Email  
*   
* Contact Number  
    
  ---

  ## **Finance**

* GST  
*   
* PAN  
*   
* Billing Email  
*   
* Bank Account  
*   
* IFSC  
*   
* Account Holder  
    
  ---

  ## **Integrations**

* Instagram  
*   
* Meta Business Suite  
*   
* OAuth  
*   
* Connection  
*   
* Permission  
*   
* Insights  
*   
* Marketplace  
*   
* Identity Conflict  
    
  ---

  # **5\. Submodule Resolver**

Create

* settings-submodule-resolver.ts


Responsibilities

* Identify the correct settings submodule.  
* Route the request.  
* Load only relevant AI context.

Example

User

> Update GST Number

↓

Finance

---

User

> Connect Instagram

↓

Integrations

---

User

> Change Website

↓

General

---

# **6\. Function Registry**

Create

* brand-settings-functions.ts


Every function must be grouped by submodule.

---

## **General Functions**

* getGeneralSettings()  
*   
* updateCompanyName()  
*   
* updateWebsite()  
*   
* updateLogo()  
*   
* updateBrandDescription()  
*   
* updateContactEmail()  
    
  ---

  ## **Finance Functions**

* getFinanceSettings()  
*   
* updateGST()  
*   
* updatePAN()  
*   
* updateBillingEmail()  
*   
* updateBankDetails()  
    
  ---

  ## **Integration Functions**

* getIntegrationOverview()  
*   
* getInstagramStatus()  
*   
* connectInstagram()  
*   
* reconnectInstagram()  
*   
* disconnectInstagram()  
*   
* connectMeta()  
*   
* reconnectMeta()  
*   
* disconnectMeta()  
*   
* deleteIntegrationData()  
*   
* resolveIdentityConflict()  
    
  ---

The AI must never call backend services directly.

All execution goes through the Function Registry.

---

# **7\. Dynamic Function Exposure**

The Function Registry should expose only functions that are valid for the current context.

Example

User

> Show my GST

Expose

* getFinanceSettings()  
*   
* updateGST()


Hide

* connectInstagram()  
*   
* updateLogo()  
    
  ---

User

> Connect Instagram

Expose

* connectInstagram()  
*   
* getInstagramStatus()


Hide

* updateGST()  
*   
* updateLogo()  
    
  ---

  # **8\. Prompt Builder**

Create

* brand-settings-prompt.ts


The Prompt Builder should receive:

* Active Submodule  
* User Role  
* Relevant Context  
* Available Functions  
* Validation Summary

The AI should never receive the complete Brand Settings object unless explicitly required.

---

Example Prompt Context

* Active Module  
*   
* Finance  
*   
* Current GST  
*   
* Configured  
*   
* Billing Email  
*   
* finance@company.com  
*   
* Available Functions  
*   
* Update GST  
*   
* Update Billing Email  
    
  ---

  # **9\. RBAC**

Functions must be filtered before reaching Gemini.

Example

Administrator

* Update Company  
*   
* Update GST  
*   
* Update PAN  
*   
* Connect Instagram  
*   
* Disconnect Meta  
    
  ---

Manager

* View Settings  
*   
* Update Website  
*   
* Reconnect Integration  
    
  ---

Viewer

* View Settings Only


Gemini should never expose functions that the user cannot execute.

---

# **10\. Gemini Function Manifest**

Create

* brand-settings-function-manifest.ts


Each function should include:

* interface GeminiFunction{  
*   
* name:string;  
*   
* description:string;  
*   
* parameters:ZodSchema;  
*   
* executor:string;  
*   
* submodule:string;  
*   
* permissions:string\[\];  
*   
* }


The manifest becomes the single source of truth for Gemini Function Calling.

---

# **11\. Context Injection**

Before every Gemini request:

* Conversation  
*   
* ↓  
*   
* Submodule Resolver  
*   
* ↓  
*   
* Load Context  
*   
* ↓  
*   
* Filter Functions  
*   
* ↓  
*   
* Build Prompt  
*   
* ↓  
*   
* Gemini


Only relevant settings are injected.

---

# **12\. Conversation Memory**

Update

* interface BrandSettingsConversation{  
*   
* activeSubmodule:  
*   
* GENERAL  
*   
* FINANCE  
*   
* INTEGRATIONS  
*   
* selectedEntity:string|null;  
*   
* lastFunction:string|null;  
*   
* pendingValidation:string|null;  
*   
* }


This enables conversations like:

User

> Update it.

↓

The AI knows "it" refers to the last entity discussed.

---

# **13\. Cursor Tasks**

## **Task A — Intent Registry**

Generate

* brand-settings-intents.ts


Requirements

* Register all Brand Settings intents.  
* Group by submodule.  
* Support future tabs.  
  ---

  ## **Task B — Entity Registry**

Generate

* brand-settings-entities.ts


Requirements

* Register all supported entities.  
* Support synonyms.  
* Production-ready TypeScript.  
  ---

  ## **Task C — Function Registry**

Generate

* brand-settings-functions.ts


Requirements

* Register all backend functions.  
* Include Zod schemas.  
* Group by submodule.  
* Support Gemini Function Calling.  
  ---

  ## **Task D — Submodule Resolver**

Generate

* settings-submodule-resolver.ts


Requirements

* Detect active settings tab.  
* Route requests.  
* Lazy-load context.  
* Support future submodules.  
  ---

  ## **Task E — Prompt Builder**

Generate

* brand-settings-prompt.ts


Requirements

* Inject only relevant context.  
* Filter functions.  
* Include RBAC.  
* Build optimized Gemini prompts.  
  ---

  ## **Task F — Function Manifest**

Generate

* brand-settings-function-manifest.ts


Requirements

* Register every callable function.  
* Include Zod schemas.  
* Include permission metadata.  
* Production-ready Gemini manifest.  
  ---

  # **14\. Folder Structure**

* src/modules/settings/  
*   
* ├── brand-settings-intents.ts  
*   
* ├── brand-settings-entities.ts  
*   
* ├── brand-settings-functions.ts  
*   
* ├── brand-settings-function-manifest.ts  
*   
* ├── brand-settings-prompt.ts  
*   
* └── settings-submodule-resolver.ts  
    
  ---

  # **15\. Deliverables**

  ### **New Files**

* brand-settings-intents.ts  
*   
* brand-settings-entities.ts  
*   
* brand-settings-functions.ts  
*   
* brand-settings-function-manifest.ts  
*   
* brand-settings-prompt.ts  
*   
* settings-submodule-resolver.ts  
    
  ---

  # **16\. Functional Capabilities**

After implementation:

* Gemini understands all Brand Settings intents across General, Finance, and Integrations.  
* Requests are automatically routed to the correct submodule.  
* Only relevant context is injected into prompts.  
* Function exposure is dynamically filtered by intent, submodule, and RBAC.  
* All backend operations execute through a centralized Function Registry.  
* Future settings tabs can be added by registering new intents, entities, functions, and providers without modifying the AI Core.  
  ---

  # **17\. Developer Notes**

* The **Submodule Resolver** is the first decision point after intent detection. Never bypass it.  
* Keep **General**, **Finance**, and **Integrations** independent within the Function Registry, but expose them through a single `Brand Settings` AI module.  
* The **General** and **Finance** functions should follow the original Brand Settings specification, while **Integrations** must follow the updated Integration Change Document.  
* The **Function Manifest** should be the only interface exposed to Gemini. Gemini should never know about service implementations or repositories.  
* Design the registry to be extensible. When future tabs (e.g., Notifications, Team Members, Security) are added, developers should only register new intents, entities, and functions without changing the orchestration logic.  
* 

