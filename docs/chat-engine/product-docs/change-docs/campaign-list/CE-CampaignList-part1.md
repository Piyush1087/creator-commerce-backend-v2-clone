Perfect. Before we start, I'm going to establish one rule for the rest of the project.

> **This document will never ask the developer to make an architectural decision.** Every decision will already be made. The developer's responsibility is only to implement it using Cursor.

Since this will become the blueprint for all future UCE modules (Create Campaign, Campaign Page, Add Product, Add Brief, Wallet, etc.), we're going to define a reusable implementation pattern.

---

# **UCE-01 – Campaign List Engineering Implementation Specification**

## **Part 1 – AI Module Architecture & Gemini Configuration**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** Backend Developer (NestJS \+ Cursor \+ Gemini API)  
**Dependencies:** Existing AI Chat Engine, Gemini API, AWS Infrastructure

---

# **1\. Objective**

This document defines the implementation of the **Campaign List AI Extension**.

This document **does not redesign** the Chat Engine.

Instead, it extends the existing architecture by registering Campaign List as a new AI module.

The implementation must:

* Follow the existing Chat Engine architecture.  
* Reuse all shared AI components.  
* Keep all business logic in backend services.  
* Keep the AI responsible only for intent detection, entity extraction, reasoning, and tool selection.

No new AI framework or orchestration layer should be introduced.

---

# **2\. Development Rules**

These rules are mandatory.

### **Rule 1**

Never modify the AI Core.

Only register a new module.

---

### **Rule 2**

Never duplicate an existing component.

Reuse:

* Conversation Manager  
* Intent Router  
* Slot Filling Engine  
* Response Builder  
* Validation Pipeline  
* Prompt Builder  
* Context Builder  
* Tool Registry

---

### **Rule 3**

The Campaign module owns only Campaign functionality.

It must not implement Wallet logic, Creator logic, Analytics logic, or Brand logic.

Those modules expose services that Campaign consumes.

---

### **Rule 4**

The LLM never accesses the database.

Every request follows:

Gemini

↓

Tool

↓

NestJS Service

↓

Repository

↓

Database

---

### **Rule 5**

Gemini must always return structured JSON.

Natural language responses should never be parsed.

---

# **3\. Module Registration**

Campaign List becomes a new AI Module.

AI Core

│

├── Brand Centre

├── Universal Campaign Engine

│      ├── Campaign List

│      ├── Create Campaign

│      ├── Campaign Details

│      ├── Products

│      └── Brief

├── Wallet

├── Analytics

└── Creator Discovery

Campaign List is **not** a standalone AI.

It is a child module of Universal Campaign Engine.

---

# **4\. Files to Create**

src/modules/campaign/ai/

campaign-module.ts

campaign-intents.ts

campaign-context-builder.ts

campaign-prompt.ts

campaign-tools.ts

campaign-entities.ts

campaign-response-map.ts

campaign-slot-map.ts

campaign-validation.ts

---

# **5\. Files to Modify**

src/ai/module-registry.ts

src/ai/prompt-builder.ts

src/ai/context-builder.ts

src/ai/tool-registry.ts

src/ai/intent-router.ts

No other AI Core files should be modified.

---

# **6\. Campaign Module Contract**

Create the following interface.

export interface AIModule {

id: string;

name: string;

description: string;

supportedIntents: AIIntent\[\];

contextProvider: ContextProvider;

promptProvider: PromptProvider;

toolProvider: ToolProvider;

responseMapper: ResponseMapper;

slotProvider: SlotProvider;

validationProvider: ValidationProvider;

}

Every future AI module must implement this contract.

---

# **7\. Module Registration**

Create

campaign-module.ts

It must export

export const CampaignModule: AIModule \= {

id: "uce-campaign-list",

name: "Campaign List",

description:

"AI module responsible for campaign discovery, filtering, comparison and lifecycle actions.",

supportedIntents:

CampaignIntents,

contextProvider:

CampaignContextBuilder,

promptProvider:

CampaignPrompt,

toolProvider:

CampaignTools,

responseMapper:

CampaignResponseMap,

slotProvider:

CampaignSlotMap,

validationProvider:

CampaignValidation

}

No implementation logic should exist inside this file.

Its only responsibility is registration.

---

# **8\. Update Module Registry**

Modify

module-registry.ts

Register the Campaign module.

Pseudo flow

registerModule(

CampaignModule

);

No other modules should be modified.

---

# **9\. Gemini Configuration**

Use Gemini for:

* Intent Detection  
* Entity Extraction  
* Reasoning  
* Tool Selection  
* Response Generation

Do **not** use Gemini for:

* Database queries  
* Permission validation  
* Campaign lifecycle execution  
* Budget calculation  
* Analytics computation

Those remain backend responsibilities.

---

# **10\. Gemini Model Configuration**

Use the same Gemini model configured in the existing Chat Engine.

Do **not** introduce a different model for Campaign List unless explicitly approved.

Inherit the existing:

* authentication  
* API client  
* retry strategy  
* timeout  
* logging  
* rate limiting

Campaign List should be another consumer of the shared Gemini client.

---

# **11\. Prompt Composition**

The final prompt sent to Gemini should be assembled in this order:

Core System Prompt  
        ↓  
Campaign Prompt Extension  
        ↓  
Conversation History  
        ↓  
Campaign Context  
        ↓  
Current User Message

The Campaign Prompt Extension must only be included when the active module is `uce-campaign-list`.

---

# **12\. Conversation Context**

Before every Gemini request, build a Campaign-specific context.

The context should include:

* Organization ID  
* Brand ID  
* User ID  
* User Role  
* Current Campaign (if selected)  
* Active Filters  
* Active Sort  
* Current Page (if applicable)  
* User Permissions

Do **not** include:

* Wallet transactions  
* Brand invoices  
* Creator profile data  
* Analytics datasets  
* Billing history

The goal is to minimize prompt size while providing the information required for reasoning.

---

# **13\. Conversation State**

Extend the existing Conversation Manager with the following Campaign-specific state.

interface CampaignConversationState {

currentModule: "uce-campaign-list";

activeIntent?: string;

selectedCampaign?: string;

selectedCampaignIds?: string\[\];

activeFilters?: Record\<string, unknown\>;

activeSort?: string;

pendingSlots?: string\[\];

confirmationPending?: boolean;

lastExecutedTool?: string;

}

Reuse the existing persistence mechanism. Do not introduce a new state store.

---

# **14\. Expected Folder Structure**

src/  
└── modules/  
    └── campaign/  
        ├── ai/  
        │   ├── campaign-module.ts  
        │   ├── campaign-intents.ts  
        │   ├── campaign-context-builder.ts  
        │   ├── campaign-prompt.ts  
        │   ├── campaign-tools.ts  
        │   ├── campaign-entities.ts  
        │   ├── campaign-response-map.ts  
        │   ├── campaign-slot-map.ts  
        │   └── campaign-validation.ts  
        ├── controllers/  
        ├── services/  
        ├── dto/  
        ├── validators/  
        ├── interfaces/  
        └── tests/

This structure must be followed so that all future Universal Campaign Engine sub-modules have a consistent layout.

---

# **15\. Cursor Task – Module Registration**

### **Objective**

Register the Campaign List module without modifying the AI Core.

### **Files to Create**

* `campaign-module.ts`

### **Files to Modify**

* `module-registry.ts`

### **Cursor Prompt**

You are working on The Creator Shop AI Chat Engine built with NestJS.

Your task is to register a new AI module called "Campaign List" under the Universal Campaign Engine.

Requirements:  
\- Reuse the existing AI Core architecture.  
\- Do not modify the AI Core implementation.  
\- Implement the AIModule interface.  
\- Register the module in the existing module registry.  
\- Reference (do not implement) the following providers:  
  \- CampaignContextBuilder  
  \- CampaignPrompt  
  \- CampaignTools  
  \- CampaignResponseMap  
  \- CampaignSlotMap  
  \- CampaignValidation  
\- Follow the existing coding conventions and dependency injection patterns.  
\- Generate production-ready TypeScript with proper exports and typing.  
\- Do not generate placeholder code or TODO comments.

---

# **16\. Deliverables for Part 1**

At the end of this phase, the following should exist:

### **New Files**

* `campaign-module.ts`

### **Modified Files**

* `module-registry.ts`

### **Defined Contracts**

* `AIModule` implementation for Campaign List.  
* Campaign-specific conversation state interface.

### **Configuration**

* Campaign List registered as a child module of the Universal Campaign Engine.  
* Prompt composition sequence defined.  
* Gemini usage rules established.  
* Folder structure created.

---

## **Review Notes**

Before moving to **Part 2**, verify:

* Campaign List appears in the AI Module Registry.  
* No AI Core logic has been modified.  
* The shared Gemini client is reused.  
* Conversation state has been extended without creating a parallel state management system.  
* The folder structure matches the specification.

---

### **My recommendation for Part 2**

Part 2 should be the most detailed section of the entire specification because it defines the **AI contract**. We'll specify every intent, entity, Gemini prompt, tool definition, function schema, request/response DTO, and Cursor prompt. Once Part 2 is complete, roughly 60–70% of the implementation complexity will be fully defined, and the remaining sections will mostly wire those contracts into the backend.

