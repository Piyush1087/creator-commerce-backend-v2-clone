# **Brand Settings AI Module**

# **Master Developer Implementation Guide**

**Version:** 1.0  
**Status:** Implementation Guide  
**Audience:** Backend Developer (NestJS \+ Gemini \+ Cursor)

---

# **Objective**

This document explains **how the five implementation documents should be executed** to build the complete **Brand Settings AI Module**.

This is **not another architecture document**.

This is the implementation roadmap for the developer.

The goal is to implement the Brand Settings module without breaking the existing Chat Engine architecture.

---

# **Prerequisites**

Before starting, the following components must already exist:

* AI Core  
* AI Orchestrator  
* Conversation Manager  
* Module Registry  
* Gemini Integration  
* Function Calling Framework  
* Chat Response Builder  
* Existing General Settings APIs  
* Existing Finance APIs  
* Existing Integration APIs  
* Existing Zod Validations

No existing backend logic should be rewritten.

---

# **Overall Architecture**

Chat Engine

↓

AI Core

↓

Brand Settings Module

↓

Settings Submodule Registry

↓

General

Finance

Integrations

↓

Backend Services

↓

Database / OAuth Providers

The developer should integrate Brand Settings into the existing Chat Engine instead of creating a separate AI application.

---

# **Implementation Order**

The implementation must follow this exact sequence.

Step 1

Module Registration

↓

Step 2

AI Contracts

↓

Step 3

Execution Pipeline

↓

Step 4

State Management

↓

Step 5

Validation Recovery

Do not change this order.

---

# **STEP 1 — Module Registration**

Reference

> Part 1

---

## **Goal**

Register Brand Settings as an AI module.

---

## **Developer Tasks**

Create

src/modules/settings/

brand-settings.module.ts

Create

settings-submodule.registry.ts

Create

settings-provider.interface.ts

Create

brand-settings-context.provider.ts

---

Register

Brand Settings

↓

General

Finance

Integrations

Each submodule should implement

* Context Provider  
* Function Provider  
* Validation Provider  
* State Provider

---

Modify

module-registry.ts

Register

BrandSettingsModule

---

## **Expected Result**

The AI Core should discover Brand Settings automatically.

---

# **STEP 2 — AI Contracts**

Reference

> Part 2

---

## **Goal**

Teach Gemini how Brand Settings works.

---

## **Developer Tasks**

Generate

brand-settings-intents.ts

Generate

brand-settings-entities.ts

Generate

brand-settings-functions.ts

Generate

brand-settings-function-manifest.ts

Generate

settings-submodule-resolver.ts

Generate

brand-settings-prompt.ts

---

Populate

General

Finance

Integrations

with

* Intents  
* Entities  
* Functions  
* Zod Schemas  
* RBAC

---

Register every callable backend function.

Example

updateWebsite()

updateGST()

connectInstagram()

---

## **Expected Result**

Gemini should understand every Brand Settings request.

---

# **STEP 3 — Execution Pipeline**

Reference

> Part 3

---

## **Goal**

Connect Gemini with the backend.

---

## **Generate**

brand-settings-ai.service.ts

Generate

settings-tool-executor.ts

Generate

brand-settings-chat.controller.ts

Generate

brand-settings-context-builder.ts

Generate

brand-settings-response-builder.ts

---

Modify

ai-orchestrator.service.ts

Register

Brand Settings Executor

---

Execution flow

User

↓

Gemini

↓

Function Registry

↓

Tool Executor

↓

Backend Service

↓

Response Builder

↓

Chat UI

---

## **Expected Result**

Users should now be able to execute Brand Settings operations through chat.

---

# **STEP 4 — State Management**

Reference

> Part 4

---

## **Goal**

Keep AI synchronized with backend changes.

---

Generate

brand-settings-state.manager.ts

---

Modify

conversation-manager.ts

Modify

brand-settings-context.provider.ts

Modify

brand-settings-response-builder.ts

Modify

ai-orchestrator.service.ts

---

Implement

Dirty State

Context Refresh

State Events

Conversation Context

---

Refresh Rules

General

↓

Refresh General Context

Finance

↓

Refresh Finance Context

Integrations

↓

Refresh Integration Context

---

Only refresh the affected submodule.

Avoid rebuilding the complete context unless multiple settings are updated.

---

## **Expected Result**

Gemini always receives the latest Brand Settings data.

---

# **STEP 5 — Validation Recovery**

Reference

> Part 5

---

## **Goal**

Convert backend validation failures into guided AI experiences.

---

Generate

brand-settings-validation-map.ts

Generate

brand-settings-recovery-capability.ts

---

Modify

brand-settings-response-builder.ts

Modify

conversation-manager.ts

Modify

ai-orchestrator.service.ts

---

Implement

Validation Mapper

↓

Recovery Registry

↓

Pending Action

↓

Inline Recovery

↓

Retry Original Action

---

Example

Backend

GST\_REQUIRED

↓

Chat

Please enter your GST number.

\[GST Input\]

\[Save\]

↓

Retry Original Action

---

## **Expected Result**

The Chat Engine should never stop at backend validation errors.

---

# **Folder Structure**

Final structure

src/modules/settings/

├── brand-settings.module.ts  
├── brand-settings-context.provider.ts  
├── brand-settings-state.manager.ts  
├── brand-settings-ai.service.ts  
├── brand-settings-chat.controller.ts  
├── brand-settings-prompt.ts  
├── brand-settings-functions.ts  
├── brand-settings-function-manifest.ts  
├── brand-settings-intents.ts  
├── brand-settings-entities.ts  
├── settings-submodule.registry.ts  
├── settings-provider.interface.ts  
├── settings-submodule-resolver.ts  
├── settings-tool-executor.ts  
├── brand-settings-response-builder.ts  
├── brand-settings-validation-map.ts  
├── brand-settings-recovery-capability.ts  
│  
├── general/  
│  
├── finance/  
│  
└── integrations/

---

# **Existing Files to Modify**

The following shared Chat Engine files should be extended rather than duplicated:

module-registry.ts

ai-orchestrator.service.ts

conversation-manager.ts

response-builder.ts

chat.controller.ts

Keep modifications minimal and ensure backward compatibility with Brand Center, Collaboration, and Universal Campaign Engine.

---

# **Testing Sequence**

The implementation should be tested in this order.

### **Phase 1 — Module Registration**

* AI discovers Brand Settings.  
* General, Finance, and Integrations register successfully.  
* Submodule discovery works.

---

### **Phase 2 — Intent Resolution**

Verify requests such as:

> Change our website

> Update GST

> Connect Instagram

The correct submodule should be selected.

---

### **Phase 3 — Function Execution**

Verify:

* Backend functions execute.  
* Zod validation passes.  
* Chat responses render correctly.  
* Existing APIs are reused.

---

### **Phase 4 — Context Refresh**

Verify:

* General updates refresh only General context.  
* Finance updates refresh only Finance context.  
* Integration updates refresh only Integration context.  
* Multi-setting updates rebuild the full Brand Settings context.

---

### **Phase 5 — Validation Recovery**

Test representative scenarios across all submodules.

**General**

* Invalid website  
* Missing company name  
* Invalid contact email

**Finance**

* Missing GST  
* Invalid GST  
* Invalid PAN  
* Missing bank details

**Integrations**

* Token expired  
* OAuth failure  
* Identity conflict  
* Missing permissions  
* Active dependency preventing disconnect

For each case, confirm:

* The backend validation is mapped correctly.  
* The Chat Engine presents the correct recovery UI or redirect.  
* The original action resumes automatically when `autoResume` is enabled.

---

# **Completion Checklist**

The Brand Settings AI module is complete when:

* Brand Settings is registered as a single AI module.  
* General, Finance, and Integrations are implemented as independent submodules.  
* Gemini routes requests to the correct submodule automatically.  
* All function calls execute through the centralized Function Registry and Tool Executor.  
* Existing backend services and Zod validations are reused without modification.  
* Context refreshes occur only for affected submodules.  
* Validation failures are translated into guided recovery flows.  
* Existing frontend components are reused within the Chat Engine.  
* Conversation state supports contextual follow-up requests.  
* The architecture allows future Brand Settings tabs (Notifications, Security, Team Members, Shipping, etc.) to be added by registering a new submodule, without changing the AI Core or orchestration layer.

