 Yes, and I actually think this is the **most important document** of the entire package.

The previous four documents answer **what to build**.

This document answers **how to build it**.

This should become the **Developer Execution Guide**, and every future module (Wallet, Campaign Page, Add Product, Add Brief, Creator Discovery, etc.) should follow exactly the same process.

I would call it:

---

# **TCS AI Chat Engine**

# **Developer Execution Guide**

## **Universal Campaign Engine – Module Development Lifecycle**

**Version:** 1.0  
**Audience:** Backend Developer (Cursor \+ Gemini \+ NestJS)

---

# **Objective**

This document provides the implementation sequence for extending The Creator Shop AI Chat Engine.

Every new AI module must follow this lifecycle.

The developer **must not skip or reorder** these phases.

Each phase has a clear output that becomes the input for the next phase.

---

# **High Level Development Lifecycle**

Requirements Document  
        │  
        ▼  
AI Module Registration  
        │  
        ▼  
AI Contract Definition  
        │  
        ▼  
Function Registration  
        │  
        ▼  
Backend Services  
        │  
        ▼  
Execution Pipeline  
        │  
        ▼  
Conversation Management  
        │  
        ▼  
Response Mapping  
        │  
        ▼  
Testing  
        │  
        ▼  
Production Deployment

---

# **Phase 0 — Read Existing Architecture**

## **Objective**

Understand the current AI Chat Engine before implementing any module.

## **Documents to Read**

1. AI Chat Engine Architecture  
2. AI Orchestrator  
3. AI Function Registry  
4. Universal Campaign Engine Architecture  
5. Current Module Specification

## **Expected Output**

Developer understands:

* AI Core  
* Conversation Manager  
* Prompt Builder  
* Function Registry  
* AI Orchestrator  
* Response Builder

**Nothing should be coded during this phase.**

---

# **Phase 1 — Register the Module**

Reference:

**Part 1**

---

## **Goal**

Register the module without changing AI Core.

---

### **Tasks**

Create

campaign-module.ts

Register

* module  
* prompt provider  
* context provider  
* tool provider  
* response mapper  
* validation provider

Update

module-registry.ts

---

### **Deliverables**

✅ Campaign module visible inside AI Core

---

# **Phase 2 — Define AI Contract**

Reference

**Part 2**

---

## **Goal**

Teach Gemini about Campaign List.

---

### **Tasks**

Create

campaign-intents.ts

campaign-entities.ts

campaign-prompt.ts

Define

* intents  
* entities  
* synonyms  
* prompt extension  
* tool names

---

### **Deliverables**

Gemini understands

* Campaign terminology  
* Available intents  
* Available tools  
* Entity extraction

---

# **Phase 3 — Register Functions**

Reference

Function Registry

---

## **Goal**

Expose backend capabilities.

---

### **Tasks**

Create

campaign-functions.ts

Register

* listCampaigns  
* searchCampaigns  
* compareCampaigns  
* campaignSummary  
* pauseCampaign

etc.

---

Each function must define

* input DTO  
* output DTO  
* permissions  
* validation  
* backend service  
* response contract

---

### **Deliverables**

Campaign functions available inside AI Function Registry.

---

# **Phase 4 — Implement Backend Services**

Goal

Implement actual business logic.

---

Create

CampaignService

CampaignAnalyticsService

CampaignLifecycleService

CampaignSearchService

---

Responsibilities

Services

↓

Repositories

↓

Database

---

Never

Gemini

↓

Database

---

Deliverables

Business logic complete.

---

# **Phase 5 — Build AI Pipeline**

Reference

Part 3

---

Create

CampaignAIService

CampaignContextBuilder

CampaignToolExecutor

CampaignChatController

---

Responsibilities

CampaignAIService

↓

Prompt Builder

↓

Gemini

↓

Tool Executor

↓

Backend Service

↓

Response Builder

---

Deliverables

End-to-end AI execution.

---

# **Phase 6 — Integrate AI Orchestrator**

Reference

Part 4

---

Create

Execution Plan support.

---

Implement

ExecutionPlan

ExecutionStep

RetryPolicy

ConversationExecutionState

---

Responsibilities

Receive Gemini response.

↓

Resolve Function.

↓

Execute.

↓

Build Response.

---

Deliverables

Module compatible with future multi-module execution.

---

# **Phase 7 — Conversation Management**

Extend

Conversation Manager

Store

Selected Campaign

Filters

Sort

Pending Slots

Pending Confirmation

Execution State

---

Deliverables

Multi-turn conversations.

---

# **Phase 8 — Response Builder**

Reuse

Existing Response Builder.

Register

Campaign mappings.

CampaignTable

↓

Table Widget

CampaignSummary

↓

Metrics Widget

PauseCampaign

↓

Confirmation Widget

---

Deliverables

UI renders correctly.

---

# **Phase 9 — Validation**

Register

Validation Rules.

Permission Validation

↓

Schema Validation

↓

Business Validation

↓

Confirmation Validation

---

Deliverables

Every request validated before execution.

---

# **Phase 10 — Testing**

Unit Tests

* Intents  
* Entities  
* Prompt  
* Tool Registry  
* AI Service  
* Context Builder  
* Response Builder

Integration Tests

* Gemini  
* AI Orchestrator  
* Campaign Services

End-to-End Tests

Chat

↓

Gemini

↓

Function Registry

↓

Campaign Service

↓

UI

---

Deliverables

Production-ready feature.

---

# **Phase 11 — Production Checklist**

Before Merge

Developer verifies

### **AI**

* Module registered  
* Prompt registered  
* Context Builder registered  
* Intents complete  
* Entities complete  
* Functions registered

---

### **Backend**

* Services complete  
* DTOs complete  
* Validators complete  
* Permission checks complete

---

### **AI Pipeline**

* AI Service complete  
* Tool Executor complete  
* Response Builder complete  
* Conversation Manager updated

---

### **AI Orchestrator**

* Execution Plans supported  
* Confirmation workflow complete  
* Retry policy complete  
* Telemetry complete

---

### **Testing**

* Unit Tests passing  
* Integration Tests passing  
* E2E Tests passing

---

### **Deployment**

* Environment variables configured  
* Gemini credentials verified  
* Feature flag enabled (if applicable)  
* Logging enabled  
* Monitoring enabled  
* Rollback plan documented

---

# **Development Order**

This order **must** be followed:

Read Architecture  
        │  
        ▼  
Register Module  
        │  
        ▼  
Define AI Contract  
        │  
        ▼  
Register Functions  
        │  
        ▼  
Build Backend Services  
        │  
        ▼  
Build AI Pipeline  
        │  
        ▼  
Integrate AI Orchestrator  
        │  
        ▼  
Conversation Management  
        │  
        ▼  
Response Builder  
        │  
        ▼  
Validation  
        │  
        ▼  
Testing  
        │  
        ▼  
Production

---

# **Cursor Workflow**

For every phase:

1. Read the corresponding implementation specification (Part 1–4).  
2. Copy the **Cursor Prompt** from that section.  
3. Generate the code for the specified files only.  
4. Review the generated code for adherence to existing Chat Engine patterns.  
5. Run linting and unit tests.  
6. Commit only after the phase passes validation.  
7. Proceed to the next phase.

Do **not** generate multiple phases in a single Cursor session. Keeping each phase focused reduces context drift and makes code review much easier.

---

# **Future Module Development**

Every future Universal Campaign Engine module (Campaign Details, Create Campaign, Add Product, Add Brief, Wallet, Analytics, Creator Discovery, etc.) should follow this exact lifecycle:

1. Create the module specification.  
2. Register the module.  
3. Define the AI contract.  
4. Register functions in the Function Registry.  
5. Implement backend services.  
6. Integrate with the AI Orchestrator.  
7. Extend conversation state if needed.  
8. Map responses to existing UI contracts.  
9. Add validation rules.  
10. Test and deploy.

This ensures every module is built consistently, remains loosely coupled, and plugs into the Chat Engine without requiring changes to the AI Core.

---

# **One Architectural Recommendation**

Now that we've designed all four parts, I would make **one final improvement** before development begins.

Instead of having separate documents for:

* Part 1 – Module Registration  
* Part 2 – AI Contracts  
* Part 3 – Execution Pipeline  
* Part 4 – AI Orchestrator

I would package them into a **single Engineering Specification** with internal sections and stable section numbers (e.g., 1.x, 2.x, 3.x). The Developer Execution Guide would then reference those section numbers instead of separate documents.

This has three major benefits:

1. **Cursor performs better** because it can ingest one coherent specification rather than switching between multiple documents.  
2. **Versioning becomes simpler**—you release `UCE Campaign List Spec v1.1` instead of updating four independent documents.  
3. **Future modules become templates**—you can duplicate the entire specification, replace the Campaign-specific content, and retain the same engineering workflow for Wallet, Products, Briefs, and every future module.

If I were leading the architecture for **The Creator Shop**, this is the document structure I'd adopt for the entire platform because it scales cleanly as your AI capabilities grow.

