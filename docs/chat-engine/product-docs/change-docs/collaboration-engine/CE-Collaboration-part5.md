I think this updated approach is significantly stronger than the previous version. One thing I would add before the document is a design principle that should guide the entire implementation:

> **The Chat Engine should never be a dead end. Every blocked action must immediately present the user with a path to resolution—either by completing the required step directly within the chat or by deep-linking them to the exact screen where the action can be completed. Once the prerequisite is satisfied, the original action should resume automatically without requiring the user to repeat it.**

That philosophy is reflected throughout the document below.

---

# **Collaboration Engineering Specification**

# **Part 5 – Workflow Validation Recovery & Guided Resolution**

**Version:** 2.0  
**Status:** Production Ready  
**Audience:** Backend Developer (NestJS \+ Gemini \+ Cursor)

---

# **1\. Objective**

This document defines how the Collaboration module handles workflow validation failures inside the AI Chat Engine.

Instead of exposing backend validation errors, the Chat Engine should:

* Detect workflow blockers.  
* Convert blockers into structured recovery flows.  
* Allow users to resolve blockers directly from chat whenever possible.  
* Redirect users to the relevant Collaboration screen when chat completion is not possible.  
* Automatically resume the original workflow after the prerequisite has been completed.

This document only changes the user experience.

It **does not** modify:

* Existing backend validations.  
* Existing workflow rules.  
* Existing Collaboration services.  
* Existing AI Core architecture.

---

# **2\. Design Principle**

The Chat Engine must never leave the user at a dead end.

Whenever an action is blocked:

1. Detect the backend validation.  
2. Determine how the validation can be resolved.  
3. Present the appropriate recovery UI.  
4. Complete the missing step.  
5. Resume the original workflow automatically.

Users should never need to remember what they were doing or execute the original command again.

---

# **3\. Supported Workflow Actions**

This document applies to all Collaboration actions that may be blocked by workflow validations.

Accept Collaboration

Accept Quote

Decline Quote

Counter Offer

Mark Product Shipped

Mark Product Received

Upload Deliverables

Approve Content

Reject Content

Request Revision

Complete Compliance

Complete Collaboration

Each action may have one or more workflow prerequisites.

---

# **4\. Current Flow**

User

↓

Clicks Action

↓

Collaboration Service

↓

Validation Error

↓

Error Toast

This experience should be replaced.

---

# **5\. New Recovery Flow**

User

↓

Chat Engine

↓

AI Orchestrator

↓

Collaboration Service

↓

Workflow Validation

↓

Recovery Capability Registry

↓

Chat Recovery  
or  
Deep Link Recovery

↓

Validation Passed

↓

Resume Original Action

↓

Success

The workflow pauses instead of failing.

---

# **6\. Workflow Validation Response**

Instead of returning

{  
  "success": false,  
  "message": "Action cannot be completed."  
}

Return

{  
  "success": false,  
  "code": "WORKFLOW\_BLOCKED",  
  "action": "APPROVE\_CONTENT",  
  "blockingItems": \[  
    {  
      "id": "shipmentPending",  
      "title": "Shipment has not been marked as dispatched"  
    }  
  \]  
}

The backend identifies the blocker.

Gemini only explains it.

---

# **7\. Recovery Capability Registry**

Create

collaboration-recovery-capability.ts

Every workflow validation must define how it can be resolved.

interface RecoveryCapability {

validationCode:string;

recoveryMode:"CHAT"|"REDIRECT";

chatComponent?:string;

redirectRoute?:string;

resumeAction:boolean;

}

Example

\[  
{  
validationCode:"SHIPMENT\_PENDING",

recoveryMode:"CHAT",

chatComponent:"ShipmentTrackingForm",

resumeAction:true  
},  
{  
validationCode:"DELIVERABLE\_TIMELINE\_MISSING",

recoveryMode:"REDIRECT",

redirectRoute:"/collaboration/:id/timeline",

resumeAction:true  
}  
\]

The Chat Engine must never decide the recovery strategy.

It reads the Recovery Capability Registry.

---

# **8\. Recovery Modes**

## **Recovery Mode A – Complete Within Chat**

If the missing step can be completed using an existing Collaboration action, the Chat Engine should render the corresponding UI inside the chat.

Examples

| Validation | Chat Component |
| ----- | ----- |
| Shipment Pending | Shipment Tracking Form |
| Content Not Submitted | Deliverable Upload |
| Quote Pending | Quote Response Card |
| Revision Requested | Upload Revised Content |
| Compliance Pending | Compliance Form |

Example

Shipment Required

Before approving content, please mark the shipment as dispatched.

Tracking URL

Courier Partner

\[Mark as Shipped\]

After submission

Shipment Updated

↓

Validation Rechecked

↓

Approve Content Automatically

↓

Success

The user remains inside the chat throughout the workflow.

---

## **Recovery Mode B – Redirect to Collaboration**

Some workflow steps require a full application interface.

In these cases, the Chat Engine should provide a deep link.

Examples

| Validation | Redirect |
| ----- | ----- |
| Edit Deliverable Timeline | Collaboration Timeline |
| Configure Deliverables | Deliverables Screen |
| Update Pricing | Pricing Screen |
| Edit Collaboration Brief | Brief Screen |

Example

This action requires updating the Deliverable Timeline.

\[Open Collaboration Timeline\]

The button opens the exact Collaboration page.

---

# **9\. Chat Component Contract**

When the recovery mode is CHAT, the backend should return a component definition.

interface ChatRecoveryComponent {

componentType:string;

title:string;

description:string;

props:Record\<string, unknown\>;

submitAction:string;

}

Example

{  
  "componentType":"ShipmentTrackingForm",  
  "title":"Mark Product as Shipped",  
  "description":"Enter shipment details to continue.",  
  "props":{  
      "trackingUrl":"",  
      "courier":""  
  },  
  "submitAction":"markShipment"  
}

The frontend renders the existing Collaboration UI component.

No duplicate business logic should exist inside the Chat Engine.

---

# **10\. Recovery Execution Flow**

### **Chat Recovery**

Approve Content

↓

Backend Validation

↓

Shipment Pending

↓

Render Shipment Form

↓

Submit Shipment

↓

markShipment()

↓

Validation Passed

↓

Resume Approve Content

↓

Success

### **Redirect Recovery**

Approve Content

↓

Backend Validation

↓

Timeline Missing

↓

Open Timeline

↓

User Updates Timeline

↓

Return To Chat

↓

Validation Passed

↓

Resume Approve Content

---

# **11\. Workflow Pause & Auto Resume**

When a validation blocks execution, the current workflow should be paused.

interface PendingWorkflow {

executionPlanId:string;

collaborationId:string;

originalAction:string;

blockingItems:string\[\];

autoResume:boolean;

}

The execution plan remains active.

It is never discarded.

---

# **12\. Resume Flow**

Whenever a recovery action completes

Recovery Action

↓

Workflow Updated

↓

Validation Rechecked

↓

All Blockers Cleared

↓

Resume Original Action

↓

Return Updated Response

The user should never have to repeat the original command.

---

# **13\. Conversation Refresh**

After every successful recovery

Refresh:

* Collaboration Context  
* Workflow Stage  
* Collaboration Status  
* Available Functions  
* Prompt Context

Gemini must always receive the refreshed workflow state.

---

# **14\. Workflow Validation Mapper**

Create

collaboration-validation-map.ts

Purpose

Translate existing backend exceptions into structured AI recovery responses.

Example mappings

| Backend Exception | Validation Code |
| ----- | ----- |
| ShipmentPendingException | SHIPMENT\_PENDING |
| ContentNotSubmittedException | CONTENT\_NOT\_SUBMITTED |
| RevisionLimitReachedException | REVISION\_LIMIT |
| InvalidWorkflowStageException | INVALID\_STAGE |
| CompliancePendingException | COMPLIANCE\_PENDING |
| CollaborationClosedException | COLLABORATION\_CLOSED |

Do not modify backend validators.

Only map them.

---

# **15\. Cursor Tasks**

## **Task A — Recovery Capability Registry**

Generate

collaboration-recovery-capability.ts

Requirements

* Register every Collaboration validation.  
* Define recovery mode.  
* Define recovery component or redirect.  
* Support auto-resume.

---

## **Task B — Workflow Validation Mapper**

Generate

collaboration-validation-map.ts

Requirements

* Map existing backend workflow exceptions.  
* Return structured AI recovery objects.  
* Preserve existing validations.

---

## **Task C — Response Builder**

Update

collaboration-response-builder.ts

Requirements

* Detect workflow blockers.  
* Render chat recovery components.  
* Render redirect buttons.  
* Render recovery checklist.  
* Support progress updates.

---

## **Task D — AI Orchestrator**

Modify

ai-orchestrator.service.ts

Requirements

* Pause execution on workflow blockers.  
* Store pending workflow.  
* Resume automatically after recovery.  
* Refresh collaboration context.

---

## **Task E — Conversation Manager**

Extend conversation state.

Requirements

* Persist pending workflow.  
* Persist recovery state.  
* Refresh AI context after every recovery action.

---

# **16\. Deliverables**

### **New Files**

src/modules/collaboration/

collaboration-validation-map.ts

collaboration-recovery-capability.ts

### **Modified Files**

collaboration-response-builder.ts

conversation-manager.ts

ai-orchestrator.service.ts

### **Functional Capabilities**

After implementation:

* Existing backend workflow validations remain unchanged.  
* Workflow blockers are converted into structured recovery flows.  
* Users can complete supported actions directly inside the chat.  
* Unsupported actions redirect users to the exact Collaboration screen.  
* Existing Collaboration UI components are reused inside the chat.  
* Pending workflows automatically resume after prerequisites are completed.  
* The AI Core and backend workflow architecture remain unchanged.

---

# **17\. Developer Notes**

* The Chat Engine must **never implement business logic**. All workflow decisions remain in the existing Collaboration services.  
* **Reuse existing frontend components** inside the chat whenever a workflow step is chat-capable (for example, shipment details, quote actions, deliverable upload, or compliance forms). Do not build duplicate forms specifically for the Chat Engine.  
* Redirect only when the existing workflow cannot reasonably be completed inside the chat.  
* The **Recovery Capability Registry** should be the single source of truth that determines whether a validation is resolved through an embedded chat component or a deep link.  
* Every recovery action must finish by re-validating the workflow, refreshing the collaboration context, and automatically resuming the original pending action if no blockers remain.

This approach keeps the Chat Engine as the primary interaction layer while preserving your existing Collaboration architecture and making the experience feel seamless for both Brands and Creators.

---

# **18\. Implementation note — `autoResume` + silent return-to-chat (v2 Nest co-pilot)**

## Contract

When a Collaboration HITL confirm is blocked by workflow validation:

* Keep the staged slot session and the same `idempotencyKey`.
* Return a `VALIDATION_CHECKLIST` with:
  * `autoResume: true` when prerequisites are fixable (wrong stage after user advances, missing tracking, content not ready yet, etc.).
  * `autoResume: false` for terminal / non-retryable cases (terminated collab, permission denied, already completed).
  * `idempotencyKey` on the checklist payload.
  * Optional `deepLinkPath` to `/brand/collaborations?thread=…`.

## Frontend behavior (no extra backend APIs)

* Manual **Try again** uses the existing HITL confirm endpoint.
* When the brand returns to co-pilot (thread load / tab visible), the FE may **silently** re-call that confirm **once** per `idempotencyKey` if `autoResume` is true.
* No toast. HITL confirm semantics are unchanged — silent resume only updates the UI if the backend now accepts the action.
* Modules do not need chat listeners on collaboration tables; re-validation happens only via the pending HITL confirm.

## Rule for future Collaboration / Chat Engine workflows

Any new validation-recovery flow **must** set `autoResume` explicitly for silent return-to-chat eligibility.

If a future change doc describes recovery / deep-link fix-then-continue but **omits** `autoResume`, add it to the doc before coding (or remind the owner).

