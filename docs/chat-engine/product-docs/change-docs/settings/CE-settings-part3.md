# **Brand Settings Module**

# **Part 3 – AI Execution Pipeline & Function Calling**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** Backend Developer (NestJS \+ Gemini \+ Cursor)

---

# **1\. Objective**

This document defines how the Chat Engine executes requests for the **Brand Settings** module.

The execution pipeline is responsible for:

* Understanding the user's request.  
* Resolving the correct Brand Settings submodule.  
* Loading the required context.  
* Executing backend functions.  
* Returning structured UI responses.  
* Refreshing the AI context.

The AI should never directly modify settings or communicate with third-party services. Every action must go through existing backend services.

---

# **2\. Execution Architecture**

* User  
*   
* ↓  
*   
* Chat Engine  
*   
* ↓  
*   
* Gemini  
*   
* ↓  
*   
* Brand Settings Function Registry  
*   
* ↓  
*   
* AI Orchestrator  
*   
* ↓  
*   
* Settings Tool Executor  
*   
* ↓  
*   
* Submodule Service  
*   
* ↓  
*   
* Database / External Provider  
*   
* ↓  
*   
* Response Builder  
*   
* ↓  
*   
* Chat UI


This execution flow is common for **General**, **Finance**, and **Integrations**.

---

# **3\. Execution Components**

Create

* src/modules/settings/  
*   
* brand-settings-ai.service.ts  
*   
* settings-tool-executor.ts  
*   
* brand-settings-context-builder.ts  
*   
* brand-settings-response-builder.ts  
*   
* brand-settings-chat.controller.ts


Each component has a single responsibility.

---

# **4\. Brand Settings AI Service**

Create

* brand-settings-ai.service.ts


Responsibilities

* Receive requests from Chat Controller.  
* Load Brand Settings Context.  
* Build Gemini prompt.  
* Execute Gemini Function Calling.  
* Forward function execution to AI Orchestrator.  
* Return structured responses.

The AI Service should never contain business logic.

---

# **5\. Chat Controller**

Create

* brand-settings-chat.controller.ts


Responsibilities

* Receive chat requests.  
* Authenticate user.  
* Resolve organization.  
* Route requests to Brand Settings AI Service.  
* Return Chat UI payloads.

Example endpoint

* POST  
*   
* /chat/settings  
    
  ---

  # **6\. Settings Tool Executor**

Create

* settings-tool-executor.ts


Responsibilities

* Resolve backend function.  
* Validate Zod schema.  
* Execute service method.  
* Normalize response.  
* Trigger context refresh.

The Tool Executor should never contain business logic.

---

# **7\. Submodule Routing**

Before executing any function, determine which submodule owns the request.

* User  
*   
* ↓  
*   
* Intent Detection  
*   
* ↓  
*   
* Submodule Resolver  
*   
* ↓  
*   
* General  
*   
* Finance  
*   
* Integrations  
*   
* ↓  
*   
* Function Registry  
*   
* ↓  
*   
* Tool Executor


This routing should happen before Gemini selects the function.

---

# **8\. Function Execution Examples**

## **Example 1 — General**

User

> Change our website to [www.creatorshop.com](http://www.creatorshop.com/)

Execution

* Gemini  
*   
* ↓  
*   
* updateWebsite()  
*   
* ↓  
*   
* General Settings Service  
*   
* ↓  
*   
* Database Updated  
*   
* ↓  
*   
* Response Builder  
*   
* ↓  
*   
* Chat UI  
    
  ---

  ## **Example 2 — Finance**

User

> Update our GST number

Execution

* Gemini  
*   
* ↓  
*   
* updateGST()  
*   
* ↓  
*   
* Finance Service  
*   
* ↓  
*   
* Database Updated  
*   
* ↓  
*   
* Response Builder  
*   
* ↓  
*   
* Chat UI  
    
  ---

  ## **Example 3 — Integrations**

User

> Connect Instagram

Execution

* Gemini  
*   
* ↓  
*   
* connectInstagram()  
*   
* ↓  
*   
* Integration Service  
*   
* ↓  
*   
* OAuth URL  
*   
* ↓  
*   
* Response Builder  
*   
* ↓  
*   
* Chat UI


The existing OAuth flow must be reused.

---

# **9\. Function Calling Contract**

Every function should implement the same request contract.

* interface BrandSettingsFunctionRequest{  
*   
* organizationId:string;  
*   
* userId:string;  
*   
* submodule:string;  
*   
* functionName:string;  
*   
* payload:any;  
*   
* }  
    
  ---

Every response should implement

* interface BrandSettingsFunctionResponse{  
*   
* success:boolean;  
*   
* submodule:string;  
*   
* message:string;  
*   
* status:string;  
*   
* data:any;  
*   
* }


This provides a common execution interface across all submodules.

---

# **10\. Response Builder**

Create

* brand-settings-response-builder.ts


Responsibilities

* Convert backend responses into chat UI.  
* Render success messages.  
* Render setting cards.  
* Render confirmation cards.  
* Render integration cards.  
* Render inline edit forms.  
* Render redirect buttons.

The Response Builder should never contain business logic.

---

# **11\. Supported Chat Components**

The Response Builder should support reusable UI components.

### **General**

* Company Information Card  
*   
* Website Card  
*   
* Logo Card  
*   
* Brand Description Card  
    
  ---

  ### **Finance**

* GST Card  
*   
* PAN Card  
*   
* Billing Card  
*   
* Bank Details Card  
    
  ---

  ### **Integrations**

* Integration Status Card  
*   
* OAuth Card  
*   
* Permission Card  
*   
* Reconnect Card  
*   
* Identity Conflict Card


All components should reuse the existing frontend implementation.

---

# **12\. Context Refresh**

After every successful execution:

Refresh

* General Context  
*   
* ↓  
*   
* Finance Context  
*   
* ↓  
*   
* Integration Context  
*   
* ↓  
*   
* Conversation State  
*   
* ↓  
*   
* Gemini Context


The Chat Engine should never continue with stale settings.

---

# **13\. Conversation State**

Extend

* interface BrandSettingsConversation{  
*   
* activeSubmodule:string|null;  
*   
* selectedEntity:string|null;  
*   
* lastExecutedFunction:string|null;  
*   
* pendingValidation:string|null;  
*   
* }


This enables follow-up conversations.

Example

User

> Update it.

↓

AI knows which field was previously selected.

---

# **14\. Execution Pipeline**

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
* Load Context  
*   
* ↓  
*   
* Filter Functions  
*   
* ↓  
*   
* Gemini Function Calling  
*   
* ↓  
*   
* Settings Tool Executor  
*   
* ↓  
*   
* Backend Service  
*   
* ↓  
*   
* Validation  
*   
* ↓  
*   
* Response Builder  
*   
* ↓  
*   
* Chat UI  
*   
* ↓  
*   
* Refresh Context


Every Brand Settings request follows this pipeline.

---

# **15\. Cursor Tasks**

## **Task A — AI Service**

Generate

* brand-settings-ai.service.ts


Requirements

* Load context.  
* Execute Gemini.  
* Support Function Calling.  
* No business logic.  
  ---

  ## **Task B — Tool Executor**

Generate

* settings-tool-executor.ts


Requirements

* Validate Zod schemas.  
* Route execution.  
* Execute backend functions.  
* Normalize responses.  
* Refresh context.  
  ---

  ## **Task C — Chat Controller**

Generate

* brand-settings-chat.controller.ts


Requirements

* Authenticate user.  
* Route requests.  
* Return Chat UI payloads.  
  ---

  ## **Task D — Response Builder**

Generate

* brand-settings-response-builder.ts


Requirements

* Render all supported cards.  
* Render inline edit components.  
* Render integration components.  
* Render confirmation UI.  
* Production-ready TypeScript.  
  ---

  ## **Task E — Context Builder**

Generate

* brand-settings-context-builder.ts


Requirements

* Refresh all submodule contexts.  
* Support lazy loading.  
* Refresh conversation context.  
* Rebuild Gemini context.  
  ---

  # **16\. Folder Structure**

* src/modules/settings/  
*   
* ├── brand-settings-ai.service.ts  
*   
* ├── settings-tool-executor.ts  
*   
* ├── brand-settings-context-builder.ts  
*   
* ├── brand-settings-response-builder.ts  
*   
* └── brand-settings-chat.controller.ts  
    
  ---

  # **17\. Deliverables**

  ### **New Files**

* brand-settings-ai.service.ts  
*   
* settings-tool-executor.ts  
*   
* brand-settings-context-builder.ts  
*   
* brand-settings-response-builder.ts  
*   
* brand-settings-chat.controller.ts


  ### **Modified Files**

* ai-orchestrator.service.ts  
*   
* conversation-manager.ts  
    
  ---

  # **18\. Functional Capabilities**

After implementation:

* Brand Settings requests are automatically routed to the correct submodule.  
* All execution flows through a centralized Tool Executor and AI Orchestrator.  
* Backend responses are normalized into reusable Chat Engine UI components.  
* Context is refreshed after every successful action.  
* General, Finance, and Integrations share a common execution architecture while keeping their business logic isolated.  
* The execution framework is extensible, allowing future Brand Settings submodules to plug into the same pipeline without changes to the AI Core.  
  ---

  # **19\. Developer Notes**

* The **Settings Tool Executor** is the only component responsible for invoking backend services. Gemini should never call service classes directly.  
* **General**, **Finance**, and **Integrations** should each have their own service implementations, but all must conform to the common function request and response contracts.  
* Reuse existing frontend components (settings forms, integration cards, confirmation dialogs) when rendering responses in the Chat Engine.  
* Always refresh the relevant submodule context after a successful write operation, then rebuild the `BrandSettingsContext` before the next Gemini interaction.  
* This execution pipeline should remain submodule-agnostic. Future tabs such as **Notifications**, **Security**, **Team Members**, or **Shipping** should integrate by registering their functions and context providers, without requiring changes to the orchestration or execution layers.  
* 

