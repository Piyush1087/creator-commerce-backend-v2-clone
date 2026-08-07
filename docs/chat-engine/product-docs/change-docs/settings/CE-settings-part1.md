# **Brand Settings Module**

# **Part 1 – Module Registration & AI Context**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** Backend Developer (NestJS \+ Gemini \+ Cursor)

---

# **1\. Objective**

This document defines how the **Brand Settings** module should be integrated into the Chat Engine.

Unlike Collaboration or Universal Campaign Engine, Brand Settings is a **configuration module** that allows Brands to manage organization-level settings through AI.

The Chat Engine should understand and execute requests across all Brand Settings tabs while maintaining a modular architecture.

Current sub-modules include:

* General  
* Finance  
* Integrations

The architecture must support adding future settings tabs without modifying the AI Core.

---

# **2\. Module Architecture**

Register Brand Settings as an independent AI module.

* AI Core  
* │  
* ├── Brand Center  
* │  
* ├── Universal Campaign Engine  
* │  
* ├── Collaboration  
* │  
* └── Brand Settings  
*       │  
*       ├── General  
*       ├── Finance  
*       └── Integrations


Brand Settings is **not** part of Brand Center.

It is an independent module responsible for organization configuration.

---

# **3\. Module Responsibilities**

The Brand Settings module is responsible for:

### **General**

* Company information  
* Brand assets  
* Contact details  
* Website  
* Brand description  
* Other general organization settings  
  ---

  ### **Finance**

* GST  
* PAN  
* Billing information  
* Bank details  
* Finance configuration  
  ---

  ### **Integrations**

(Updated using the latest Integration Change Document)

* Instagram Connection  
* Meta Business Suite Connection  
* OAuth lifecycle  
* Permissions  
* Connection management  
* Identity conflict resolution  
  ---

The AI module must never communicate directly with databases or third-party APIs.

All operations go through backend services.

---

# **4\. Settings Submodule Registry**

Instead of hardcoding settings tabs into the AI Core, create a **Settings Submodule Registry**.

Create

* src/modules/settings/  
*   
* settings-submodule.registry.ts


Every settings tab registers itself with this registry.

* interface SettingsSubmodule{  
*   
* id:string;  
*   
* name:string;  
*   
* contextProvider:string;  
*   
* functionProvider:string;  
*   
* validationProvider:string;  
*   
* promptProvider:string;  
*   
* stateProvider:string;  
*   
* }  
    
  ---

Example

* General  
*   
* ↓  
*   
* GeneralSettingsProvider  
*   
* Finance  
*   
* ↓  
*   
* FinanceSettingsProvider  
*   
* Integrations  
*   
* ↓  
*   
* IntegrationSettingsProvider


Future tabs can register themselves without changing the AI Core.

Examples

* Notifications  
* Team Members  
* Security  
* Billing  
* Shipping  
* Warehouses  
  ---

  # **5\. Module Registration**

Create

* brand-settings.module.ts


Responsibilities

* Register Brand Settings Module  
* Register Settings Submodule Registry  
* Register AI Context Provider  
* Register Prompt Provider  
* Register Function Registry  
* Register Validation Registry  
  ---

Registration Flow

* AI Core  
*   
* ↓  
*   
* Module Registry  
*   
* ↓  
*   
* Brand Settings Module  
*   
* ↓  
*   
* Settings Submodule Registry  
*   
* ↓  
*   
* General  
*   
* Finance  
*   
* Integrations  
    
  ---

  # **6\. AI Context Provider**

Create

* brand-settings-context.provider.ts


Responsibilities

* Load all registered settings submodules  
* Build unified Brand Settings Context  
* Merge responses from all providers  
* Filter context based on user permissions  
* Provide latest configuration state to Gemini

The Context Provider is the only source of AI context.

---

# **7\. Brand Settings Context**

* interface BrandSettingsContext{  
*   
* organizationId:string;  
*   
* organizationName:string;  
*   
* userRole:string;  
*   
* general:GeneralContext;  
*   
* finance:FinanceContext;  
*   
* integrations:IntegrationContext;  
*   
* }  
    
  ---

  ### **General Context**

* interface GeneralContext{  
*   
* companyName:string;  
*   
* website:string|null;  
*   
* brandDescription:string|null;  
*   
* contactEmail:string|null;  
*   
* logoAvailable:boolean;  
*   
* completionPercentage:number;  
*   
* }  
    
  ---

  ### **Finance Context**

* interface FinanceContext{  
*   
* gstConfigured:boolean;  
*   
* panConfigured:boolean;  
*   
* billingEmail:string|null;  
*   
* bankDetailsConfigured:boolean;  
*   
* completionPercentage:number;  
*   
* }  
    
  ---

  ### **Integration Context**

* interface IntegrationContext{  
*   
* providers:ProviderContext\[\];  
*   
* }


ProviderContext follows the Integration Change Document.

---

# **8\. Context Loading Strategy**

The Chat Engine should never send the complete settings object to Gemini.

Instead:

* User Query  
*   
* ↓  
*   
* Intent Detection  
*   
* ↓  
*   
* Identify Submodule  
*   
* ↓  
*   
* Load Required Context  
*   
* ↓  
*   
* Gemini  
    
  ---

Example

User

> Update our GST

↓

Load only

* Finance Context  
    
  ---

User

> Connect Instagram

↓

Load only

* Integration Context  
    
  ---

User

> Change company logo

↓

Load only

* General Context


This minimizes token usage while improving AI accuracy.

---

# **9\. Conversation Manager**

Extend Conversation Manager.

* interface BrandSettingsConversation{  
*   
* activeSubmodule:  
* "GENERAL"|  
* "FINANCE"|  
* "INTEGRATIONS"|null;  
*   
* lastFunction:string|null;  
*   
* pendingValidation:string|null;  
*   
* }


This enables follow-up requests.

Example

User

> Update it.

↓

The AI knows "it" refers to the GST number if the active submodule is Finance.

---

# **10\. Permission Awareness**

Every submodule should expose its own permissions.

Example

General

* Update Company Name  
*   
* Update Website  
*   
* Update Logo  
    
  ---

Finance

* Update GST  
*   
* Update PAN  
*   
* Update Billing Email  
    
  ---

Integrations

* Connect Instagram  
*   
* Reconnect Meta  
*   
* Disconnect Provider


The AI should never expose unavailable functions.

---

# **11\. Submodule Discovery**

Each submodule must expose:

* interface AISettingsProvider{  
*   
* getContext();  
*   
* getFunctions();  
*   
* getPrompt();  
*   
* getValidationRules();  
*   
* getCurrentState();  
*   
* }


The AI Core communicates only through this interface.

This keeps each settings tab independent.

---

# **12\. Cursor Tasks**

## **Task A — Module Registration**

Generate

* brand-settings.module.ts


Requirements

* Register Brand Settings as an independent AI module.  
* Register all settings submodules.  
* Production-ready NestJS module.  
  ---

  ## **Task B — Settings Submodule Registry**

Generate

* settings-submodule.registry.ts


Requirements

* Dynamic registration  
* Dependency Injection support  
* Future extensibility  
* Provider discovery  
  ---

  ## **Task C — AI Context Provider**

Generate

* brand-settings-context.provider.ts


Requirements

* Merge contexts from General, Finance and Integrations.  
* Support lazy loading.  
* Filter based on permissions.  
* Production-ready TypeScript.  
  ---

  ## **Task D — Provider Interface**

Generate

* settings-provider.interface.ts


Requirements

* Generic provider contract.  
* Reusable across every future settings tab.  
* Strong typing.  
  ---

  ## **Task E — Conversation Manager**

Modify

* conversation-manager.ts


Requirements

* Support active settings submodule.  
* Persist conversation state.  
* Clear stale state after successful execution.  
  ---

  # **13\. Folder Structure**

* src/  
*   
* modules/  
*   
* settings/  
*   
* │  
*   
* ├── brand-settings.module.ts  
*   
* ├── settings-submodule.registry.ts  
*   
* ├── settings-provider.interface.ts  
*   
* ├── brand-settings-context.provider.ts  
*   
* │  
*   
* ├── general/  
*   
* ├── finance/  
*   
* └── integrations/


Every settings tab owns its own implementation.

---

# **14\. Deliverables**

### **New Files**

* brand-settings.module.ts  
*   
* settings-submodule.registry.ts  
*   
* settings-provider.interface.ts  
*   
* brand-settings-context.provider.ts


  ### **Modified Files**

* conversation-manager.ts  
*   
* module-registry.ts  
    
  ---

  # **15\. Functional Capabilities**

After implementation:

* Brand Settings is registered as a single AI module.  
* General, Finance, and Integrations are registered as independent submodules.  
* AI dynamically discovers available settings submodules.  
* Context is loaded only for the requested settings area, reducing token usage and improving response quality.  
* Future settings tabs can be added without changing the AI Core.  
* The Conversation Manager maintains context across follow-up requests.  
* RBAC permissions are enforced before exposing functions to Gemini.  
  ---

  # **16\. Developer Notes**

* **Brand Settings is the AI module.** General, Finance, and Integrations are submodules and should never be registered independently with the AI Core.  
* **General** and **Finance** should follow the original Brand Settings PRD.  
* **Integrations** should follow the updated Integration Change Document and replace only the Integrations portion of the original PRD.  
* The `SettingsSubmoduleRegistry` is the single discovery mechanism for all settings capabilities. Avoid hardcoding submodules into the AI Core.  
* The `BrandSettingsContextProvider` should lazily load only the context required for the detected intent (e.g., Finance for GST updates, Integrations for OAuth actions), while retaining the ability to build a full context when needed.  
* All execution, validation, and state management described in Parts 2–5 should build on this registration architecture so every settings submodule behaves consistently while remaining independently maintainable.  
* 

