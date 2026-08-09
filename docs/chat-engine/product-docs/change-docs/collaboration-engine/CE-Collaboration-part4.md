After reviewing the Collaboration documents, I think **Part 4 is where Collaboration differs the most from Campaign List**.

Campaign List used the AI Orchestrator mainly to coordinate tool execution.

Collaboration, however, is a **long-running workflow**. A collaboration may last days or weeks, involve both Brand and Creator, include timers, approvals, revisions, logistics, and payment milestones. The Orchestrator therefore needs to manage **workflow progression**, while the business rules and stage transitions remain owned by the backend services described in the FRD.

I would not create a second orchestration framework. Instead, extend the existing AI Orchestrator so Collaboration becomes another module that plugs into it.

---

# **Collaboration Engineering Specification**

# **Part 4 – Workflow Orchestrator & State Management**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** Backend Developer (NestJS \+ Gemini \+ Cursor)

---

# **1\. Objective**

This document defines how the AI Orchestrator manages Collaboration workflows.

The Orchestrator is responsible for:

* Coordinating Collaboration function execution.  
* Tracking workflow state.  
* Managing long-running conversations.  
* Synchronizing Brand and Creator interactions.  
* Pausing and resuming workflows.  
* Refreshing AI context after state changes.

The Orchestrator **does not** own workflow rules, stage transitions, validations, or business logic. Those remain within Collaboration backend services.

---

# **2\. Orchestration Overview**

User  
    │  
    ▼  
Gemini  
    │  
    ▼  
AI Function Registry  
    │  
    ▼  
AI Orchestrator  
    │  
    ▼  
Collaboration Services  
    │  
    ▼  
Workflow Engine  
    │  
    ▼  
Conversation Manager  
    │  
    ▼  
Response Builder  
    │  
    ▼  
Chat UI

The AI Orchestrator coordinates execution.

The Collaboration services decide what happens.

---

# **3\. Collaboration Orchestrator**

Reuse the existing

src/ai/orchestrator/

Extend it with Collaboration support.

Create

src/modules/collaboration/orchestrator/

collaboration-workflow-adapter.ts

collaboration-state-sync.ts

collaboration-event-handler.ts

---

# **4\. Responsibilities**

The Collaboration adapter is responsible for:

* Resolving Collaboration functions.  
* Executing functions through the AI Orchestrator.  
* Refreshing workflow context.  
* Synchronizing conversation state.  
* Returning updated context to Gemini.

The adapter must never:

* Execute repositories.  
* Determine workflow stages.  
* Override backend validations.

---

# **5\. Workflow Execution**

Every Collaboration request follows the same execution sequence.

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

Updated Collaboration State

↓

Conversation Manager

↓

Response Builder

↓

Chat UI

---

# **6\. Workflow State Synchronization**

After every successful action, reload the active collaboration.

Create

collaboration-state-sync.ts

Responsibilities

* Reload collaboration.  
* Reload workflow stage.  
* Reload collaboration status.  
* Reload pending actions.  
* Update Conversation Manager.

Gemini must always receive refreshed state.

---

# **7\. Collaboration Events**

The Collaboration backend emits workflow events.

Examples (derived from the Collaboration workflow)

COLLABORATION\_CREATED

QUOTE\_ACCEPTED

COUNTER\_OFFER\_SENT

SHIPMENT\_MARKED

PRODUCT\_RECEIVED

CONTENT\_SUBMITTED

REVISION\_REQUESTED

CONTENT\_APPROVED

CONTENT\_REJECTED

COMPLIANCE\_COMPLETED

PAYMENT\_TRIGGERED

COLLABORATION\_COMPLETED

The AI Orchestrator listens for these events and refreshes AI context.

---

# **8\. Event Handler**

Create

collaboration-event-handler.ts

Responsibilities

* Receive Collaboration events.  
* Refresh conversation state.  
* Trigger context refresh.  
* Notify Response Builder.  
* Prepare updated AI responses.

Do not implement business logic.

---

# **9\. Execution Context**

Extend the existing ExecutionPlan with Collaboration metadata.

interface CollaborationExecutionContext {

executionPlanId:string;

collaborationId:string;

campaignId:string;

persona:"BRAND"|"CREATOR";

workflowStage:string;

workflowStatus:string;

}

No business entities should be stored beyond execution context.

---

# **10\. Conversation Synchronization**

Whenever workflow state changes:

Workflow Updated

↓

Conversation Manager

↓

Refresh Collaboration Context

↓

Refresh Available Functions

↓

Refresh Prompt Context

↓

Continue Conversation

The AI should never continue using stale collaboration data.

---

# **11\. Multi-Step Execution**

Some Collaboration actions naturally involve multiple backend steps.

Example

Approve Content

↓

Execute Approval

↓

Workflow Updated

↓

Refresh Collaboration State

↓

Refresh Available Actions

↓

Return Updated Chat Response

The Orchestrator coordinates these steps.

The Collaboration service performs them.

---

# **12\. Response Refresh**

After every successful execution:

Function Success

↓

Reload Context

↓

Reload Workflow

↓

Build Updated Response

↓

Render Updated UI

The Chat UI should always reflect the latest collaboration state.

---

# **13\. Cursor Tasks**

## **Task A — Workflow Adapter**

Generate

collaboration-workflow-adapter.ts

Requirements

* Integrate Collaboration with the existing AI Orchestrator.  
* Resolve Collaboration functions.  
* Refresh workflow context.  
* No business logic.

---

## **Task B — State Synchronization**

Generate

collaboration-state-sync.ts

Requirements

* Reload collaboration state after every successful action.  
* Update Conversation Manager.  
* Refresh AI context.  
* Production-ready TypeScript.

---

## **Task C — Event Handler**

Generate

collaboration-event-handler.ts

Requirements

* Consume Collaboration workflow events.  
* Trigger context refresh.  
* Notify Response Builder.  
* No workflow decisions.

---

## **Task D — AI Orchestrator Integration**

Modify the existing AI Orchestrator.

Requirements

* Register Collaboration adapter.  
* Support Collaboration execution context.  
* Refresh context after execution.  
* Preserve compatibility with existing modules.

---

# **14\. Deliverables**

### **New Files**

src/modules/collaboration/orchestrator/

collaboration-workflow-adapter.ts

collaboration-state-sync.ts

collaboration-event-handler.ts

### **Modified Files**

src/ai/orchestrator/

ai-orchestrator.service.ts

execution-plan.ts

### **Functional Capabilities**

After implementation:

* Collaboration integrates with the existing AI Orchestrator.  
* Workflow state is refreshed after every successful action.  
* Brand and Creator conversations remain synchronized.  
* Workflow events automatically refresh AI context.  
* Multi-step Collaboration actions are coordinated through the Orchestrator.  
* Existing Chat Engine architecture remains unchanged.

---

# **Developer Notes**

* Do not create a second orchestration framework specifically for Collaboration. Extend the existing AI Orchestrator introduced earlier.  
* The Orchestrator should coordinate execution only; all workflow rules, timers, approvals, revisions, and stage transitions remain in the Collaboration backend exactly as defined in the uploaded FRD and workflow documents.  
* Every successful Collaboration action must refresh the collaboration context before the next AI response is generated.  
* Keep the integration modular so future Collaboration capabilities can be added by registering new functions and events rather than changing the AI Core.

This completes **Part 4** and gives Collaboration the orchestration layer needed for long-running, stateful conversations while remaining fully compatible with the Chat Engine architecture you've already established. The remaining document (Part 5\) should focus on **Collaboration validation recovery**, where workflow blockers (missing deliverables, pending approvals, unmet prerequisites, etc.) are transformed into guided chat experiences instead of backend errors.

