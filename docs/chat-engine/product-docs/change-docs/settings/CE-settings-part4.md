# **Brand Settings Module**

# **Part 4 – State Management & Synchronization**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** Backend Developer (NestJS \+ Gemini \+ Cursor)

---

# **1\. Objective**

This document defines how the Chat Engine manages, synchronizes, and refreshes the state of the **Brand Settings** module.

Unlike workflow-driven modules such as Collaboration or Campaigns, Brand Settings is a **configuration module**. The Chat Engine must always operate on the latest organization configuration and automatically refresh its AI context whenever a setting changes.

The state management layer ensures:

* AI always works with the latest configuration.  
* Follow-up conversations remain context-aware.  
* Multiple settings tabs remain synchronized.  
* Future settings tabs can plug into the same architecture.  
  ---

  # **2\. State Architecture**

The Brand Settings module maintains one unified state composed of independent submodule states.

* Brand Settings State  
*   
* │  
*   
* ├── General State  
*   
* ├── Finance State  
*   
* └── Integration State


Each submodule owns its state independently while exposing a normalized contract to the Chat Engine.

---

# **3\. State Manager**

Create

* src/modules/settings/  
*   
* brand-settings-state.manager.ts


Responsibilities

* Maintain Brand Settings state.  
* Synchronize submodule states.  
* Detect state changes.  
* Publish updates.  
* Trigger AI Context refresh.

This becomes the single state manager for the Brand Settings module.

---

# **4\. State Contract**

Every submodule must expose the following interface.

* interface SettingsState{  
*   
* submodule:string;  
*   
* status:string;  
*   
* lastUpdated:Date;  
*   
* completionPercentage:number;  
*   
* isDirty:boolean;  
*   
* metadata:any;  
*   
* }


Each submodule can extend this contract with additional metadata.

---

# **5\. General State**

* interface GeneralState extends SettingsState{  
*   
* companyName:string;  
*   
* website:string|null;  
*   
* logoAvailable:boolean;  
*   
* brandDescriptionAvailable:boolean;  
*   
* contactEmail:string|null;  
*   
* }


Example

* Company Name  
*   
* The Creator Shop  
*   
* Website  
*   
* Configured  
*   
* Logo  
*   
* Configured  
*   
* Completion  
*   
* 100%  
    
  ---

  # **6\. Finance State**

* interface FinanceState extends SettingsState{  
*   
* gstConfigured:boolean;  
*   
* panConfigured:boolean;  
*   
* bankConfigured:boolean;  
*   
* billingEmailConfigured:boolean;  
*   
* }


Example

* GST  
*   
* Configured  
*   
* PAN  
*   
* Configured  
*   
* Bank  
*   
* Missing  
*   
* Completion  
*   
* 75%  
    
  ---

  # **7\. Integration State**

The Integration state follows the updated Integration Change Document.

* interface IntegrationState extends SettingsState{  
*   
* providers:ProviderState\[\];  
*   
* }


ProviderState

* interface ProviderState{  
*   
* provider:string;  
*   
* status:string;  
*   
* connectedAccount:string|null;  
*   
* permissions:string\[\];  
*   
* lastSynced:Date;  
*   
* }


The Chat Engine never communicates directly with Instagram or Meta. The backend remains the source of truth.

---

# **8\. State Synchronization Flow**

* User Action  
*   
* ↓  
*   
* Backend Function  
*   
* ↓  
*   
* Database Updated  
*   
* ↓  
*   
* Brand Settings State Manager  
*   
* ↓  
*   
* Brand Settings Context Builder  
*   
* ↓  
*   
* Conversation Manager  
*   
* ↓  
*   
* Gemini  
*   
* ↓  
*   
* Updated Chat Response


Every successful write operation follows this synchronization flow.

---

# **9\. Dirty State Management**

Whenever a configuration changes, mark the corresponding submodule as dirty.

Example

* User  
*   
* ↓  
*   
* Update GST  
*   
* ↓  
*   
* Finance State  
*   
* ↓  
*   
* Dirty  
*   
* ↓  
*   
* Refresh Finance Context  
*   
* ↓  
*   
* Clean


Dirty state prevents Gemini from using outdated context.

---

# **10\. Context Refresh Strategy**

Refresh only the affected submodule whenever possible.

Example

### **Update Website**

Refresh

* General Context  
    
  ---

  ### **Update GST**

Refresh

* Finance Context  
    
  ---

  ### **Connect Instagram**

Refresh

* Integration Context  
    
  ---

If multiple settings are updated in one execution, rebuild the full Brand Settings Context.

---

# **11\. Multi-Submodule Synchronization**

The state manager must ensure changes in one submodule never overwrite another.

Example

* General  
*   
* Configured  
*   
* Finance  
*   
* Configured  
*   
* Integrations  
*   
* Connecting


Updating General must not refresh or reset Finance or Integrations.

---

# **12\. Conversation State**

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
* lastExecutedFunction:string|null;  
*   
* pendingValidation:string|null;  
*   
* lastViewedSetting:string|null;  
*   
* }


Example

User

> Change it again.

↓

The AI knows:

* Active submodule  
* Previously selected setting  
* Previous function  
* Current context  
  ---

  # **13\. State Transition Events**

Every submodule should publish normalized events.

* SETTING\_UPDATED  
*   
* SETTING\_CREATED  
*   
* SETTING\_REMOVED  
*   
* CONFIGURATION\_COMPLETED  
*   
* CONFIGURATION\_INCOMPLETE  
*   
* PROVIDER\_CONNECTED  
*   
* PROVIDER\_DISCONNECTED  
*   
* PROVIDER\_RECONNECTED  
*   
* PROVIDER\_TOKEN\_EXPIRED


These events are consumed by:

* Conversation Manager  
* Context Builder  
* Response Builder  
* AI Orchestrator  
  ---

  # **14\. Context Refresh Rules**

Refresh AI Context after:

### **General**

* Company Name Updated  
* Website Updated  
* Logo Updated  
* Contact Updated  
  ---

  ### **Finance**

* GST Updated  
* PAN Updated  
* Billing Email Updated  
* Bank Details Updated  
  ---

  ### **Integrations**

* Provider Connected  
* Provider Reconnected  
* Provider Disconnected  
* OAuth Completed  
* Permissions Updated  
* Identity Conflict Resolved

Read-only requests should not trigger a context refresh.

---

# **15\. State Recovery**

If synchronization fails:

* Backend Updated  
*   
* ↓  
*   
* State Refresh Failed  
*   
* ↓  
*   
* Retry Context Refresh  
*   
* ↓  
*   
* Notify Chat Engine  
*   
* ↓  
*   
* Prevent Further Execution


The AI must never continue with stale settings data.

---

# **16\. Cursor Tasks**

## **Task A — State Manager**

Generate

* brand-settings-state.manager.ts


Requirements

* Maintain module state.  
* Detect dirty state.  
* Publish updates.  
* Trigger context refresh.  
  ---

  ## **Task B — Context Builder**

Modify

* brand-settings-context.provider.ts


Requirements

* Refresh only affected submodule.  
* Support full context rebuild.  
* Merge refreshed contexts.  
  ---

  ## **Task C — AI Orchestrator**

Modify

* ai-orchestrator.service.ts


Requirements

* Trigger refresh after successful writes.  
* Prevent execution with stale context.  
* Notify Conversation Manager.  
  ---

  ## **Task D — Conversation Manager**

Modify

* conversation-manager.ts


Requirements

* Track active submodule.  
* Store latest settings context.  
* Clear dirty state after refresh.  
  ---

  ## **Task E — Response Builder**

Modify

* brand-settings-response-builder.ts


Requirements

* Render refreshed setting cards.  
* Reflect updated configuration state.  
* Support state transition notifications.  
  ---

  # **17\. Folder Structure**

* src/modules/settings/  
*   
* ├── brand-settings-state.manager.ts  
*   
* ├── brand-settings-context.provider.ts  
*   
* ├── brand-settings-response-builder.ts  
*   
* ├── general/  
*   
* ├── finance/  
*   
* └── integrations/  
    
  ---

  # **18\. Deliverables**

  ### **New Files**

* brand-settings-state.manager.ts


  ### **Modified Files**

* brand-settings-context.provider.ts  
*   
* brand-settings-response-builder.ts  
*   
* conversation-manager.ts  
*   
* ai-orchestrator.service.ts  
    
  ---

  # **19\. Functional Capabilities**

After implementation:

* Brand Settings maintains a unified state while keeping General, Finance, and Integrations independent.  
* AI Context always reflects the latest backend configuration.  
* Dirty state detection prevents Gemini from operating on stale data.  
* Only affected submodules are refreshed, improving performance and reducing unnecessary context rebuilding.  
* Conversation state supports intelligent follow-up interactions across settings.  
* Future Brand Settings tabs can integrate with the same state management architecture without modifying the AI Core.  
  ---

  # **20\. Developer Notes**

* **Brand Settings State Manager** is the only component responsible for synchronizing configuration state across all settings submodules.  
* Each submodule (**General**, **Finance**, **Integrations**) owns its own state and exposes it through the common `SettingsState` contract.  
* Always perform **incremental context refreshes** when a single submodule changes. Reserve full context rebuilds for operations that affect multiple settings simultaneously.  
* The **Conversation Manager** should store conversational context only; persistent configuration state must remain in backend services and be reloaded through the Context Provider.  
* The **Integrations** state should continue following the updated Integration Change Document while remaining part of the unified Brand Settings state.  
* This architecture allows future settings tabs (Notifications, Team Members, Security, Shipping, Billing, etc.) to participate simply by registering a new state provider with the `Brand Settings State Manager`, without requiring changes to the AI orchestration or execution pipeline.  
* 

