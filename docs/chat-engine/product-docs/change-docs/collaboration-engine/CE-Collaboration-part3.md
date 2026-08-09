After studying the Collaboration documents, I think **Part 3 is where the actual Collaboration Engine comes alive**.

Unlike Campaign List, Collaboration isn't a simple request → function → response flow.

Every action changes the **state of the collaboration** and often triggers updates for the other participant. The execution pipeline therefore needs to be **workflow-aware** rather than just function-aware.

I would **not** create separate pipelines for Brand and Creator. There should be a single execution pipeline with persona-specific routing.

---

# **Collaboration Engineering Specification**

# **Part 3 – AI Execution Pipeline & Workflow Processing**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** Backend Developer (NestJS \+ Gemini \+ Cursor)

---

# **1\. Objective**

This document defines how AI requests are executed within the Collaboration module.

The execution pipeline is responsible for:

* Processing user requests.  
* Building collaboration-aware AI context.  
* Executing Collaboration functions.  
* Synchronizing workflow state.  
* Returning structured responses to the Chat UI.

This document does **not** define workflow rules or validations. Those remain within Collaboration services.

---

# **2\. Execution Pipeline Overview**

Every Collaboration request follows the same execution pipeline.

User  
    │  
    ▼  
Conversation Manager  
    │  
    ▼  
Collaboration Context Builder  
    │  
    ▼  
Prompt Builder  
    │  
    ▼  
Gemini API  
    │  
    ▼  
Function Registry  
    │  
    ▼  
AI Orchestrator  
    │  
    ▼  
Collaboration Service  
    │  
    ▼  
Workflow Engine  
    │  
    ▼  
Response Builder  
    │  
    ▼  
Chat UI

The AI never communicates directly with Collaboration services.

---

# **3\. Create AI Pipeline**

Create

src/modules/collaboration/ai/

collaboration-ai.service.ts

collaboration-tool-executor.ts

collaboration-context-builder.ts

collaboration-response-builder.ts

collaboration-chat.controller.ts

---

# **4\. Collaboration AI Service**

Create

collaboration-ai.service.ts

Responsibilities

* Receive chat requests.  
* Build AI context.  
* Invoke Gemini.  
* Receive function calls.  
* Forward execution to the AI Orchestrator.  
* Return structured responses.

Never

* Execute business logic.  
* Access repositories.  
* Modify workflow state.

---

# **5\. Collaboration Context Builder**

Create

collaboration-context-builder.ts

The Context Builder prepares the information sent to Gemini.

Context includes:

* Collaboration ID  
* Campaign ID  
* Persona  
* Current workflow stage  
* Current collaboration status  
* Available AI functions  
* Pending actions

It must not include:

* Complete campaign data  
* Historical conversations  
* Analytics  
* Wallet transactions

---

# **6\. Tool Executor**

Create

collaboration-tool-executor.ts

Responsibilities

* Receive Gemini function call.  
* Validate function exists.  
* Forward execution to AI Orchestrator.  
* Return structured response.

Never

* Execute services directly.  
* Apply workflow rules.

---

# **7\. AI Response Builder**

Create

collaboration-response-builder.ts

Responsibilities

Convert backend responses into Chat UI responses.

Supported response types

* Text  
* Confirmation  
* Collaboration Summary  
* Timeline  
* Checklist  
* Action Cards  
* Success  
* Error

No business logic.

---

# **8\. Chat Controller**

Create

collaboration-chat.controller.ts

Responsibilities

* Receive chat requests.  
* Authenticate user.  
* Resolve collaboration.  
* Call CollaborationAIService.  
* Return response.

No AI logic.

---

# **9\. Function Execution Flow**

User

↓

Gemini

↓

Function Registry

↓

AI Orchestrator

↓

Collaboration Service

↓

Workflow Engine

↓

Response Builder

↓

Chat UI

The AI never bypasses the Orchestrator.

---

# **10\. Workflow Synchronization**

Every function execution may update the collaboration workflow.

Example

Brand

↓

Approve Content

↓

ContentReviewService

↓

Workflow Engine

↓

Stage Updated

↓

Notify Creator

↓

Refresh Chat Context

Workflow state is always updated by backend services.

---

# **11\. Event Handling**

Every successful Collaboration action produces a workflow event.

Examples

COLLABORATION\_CREATED

CONTENT\_SUBMITTED

CONTENT\_APPROVED

CONTENT\_REJECTED

REVISION\_REQUESTED

SHIPMENT\_CONFIRMED

PAYMENT\_RELEASED

COLLABORATION\_COMPLETED

Events are consumed by:

* Conversation Manager  
* Notification Service  
* Response Builder

Gemini never creates events.

---

# **12\. Response Contract**

Every Collaboration function returns

interface CollaborationAIResponse {

success:boolean;

message:string;

updatedStage?:string;

updatedStatus?:string;

events:string\[\];

uiComponents:unknown\[\];

}

The Response Builder converts this into Chat UI components.

---

# **13\. Conversation Refresh**

Whenever a workflow event changes collaboration state:

Workflow Updated

↓

Conversation Manager

↓

Reload Collaboration Context

↓

Update Prompt Context

↓

Continue Conversation

Gemini always receives the latest workflow state.

---

# **14\. Cursor Tasks**

## **Task A – Collaboration AI Service**

Generate

collaboration-ai.service.ts

Requirements

* Receive chat requests.  
* Build AI context.  
* Invoke Gemini.  
* Pass execution to AI Orchestrator.  
* Return AI response.  
* No business logic.

---

## **Task B – Context Builder**

Generate

collaboration-context-builder.ts

Requirements

* Load active collaboration.  
* Load workflow state.  
* Load persona.  
* Return AI context.  
* Production-ready TypeScript.

---

## **Task C – Tool Executor**

Generate

collaboration-tool-executor.ts

Requirements

* Resolve AI functions.  
* Execute through AI Orchestrator.  
* Return structured responses.  
* Do not call services directly.

---

## **Task D – Response Builder**

Generate

collaboration-response-builder.ts

Requirements

* Convert backend responses into UI contracts.  
* Support text, cards, confirmations, checklists and timeline responses.  
* No business logic.

---

## **Task E – Chat Controller**

Generate

collaboration-chat.controller.ts

Requirements

* NestJS controller.  
* Authenticate user.  
* Resolve collaboration.  
* Call AI service.  
* Return structured response.

---

# **15\. Deliverables**

### **New Files**

src/modules/collaboration/ai/

collaboration-ai.service.ts

collaboration-context-builder.ts

collaboration-tool-executor.ts

collaboration-response-builder.ts

collaboration-chat.controller.ts

### **Functional Capabilities**

After implementation:

* End-to-end AI execution pipeline for Collaboration.  
* AI context generated for every request.  
* Gemini executes only registered Collaboration functions.  
* Workflow state synchronized after every action.  
* Responses converted into Chat UI components.  
* AI remains isolated from backend business logic.

---

# **Developer Notes**

* Every Collaboration request must pass through the existing **Function Registry** and **AI Orchestrator**.  
* The Collaboration module should never execute business logic directly from the AI layer.  
* Workflow state is always owned by Collaboration backend services and refreshed after every successful action.  
* Keep the execution pipeline generic so future collaboration capabilities (disputes, milestones, arbitration, additional deliverable types) plug into the same flow without changing the AI Core.

This completes **Part 3** and establishes the execution layer that connects Gemini, the AI Function Registry, the AI Orchestrator, and the Collaboration backend into a production-ready workflow. The next document (Part 4\) will focus on **workflow orchestration, multi-step execution, timers, cross-user synchronization, and recovery of long-running collaboration processes**.

