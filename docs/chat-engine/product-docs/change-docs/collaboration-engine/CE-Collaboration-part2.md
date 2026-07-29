After going through the Collaboration documents, I think **Part 2 is actually more important than Part 1**.

For Campaign List, Part 2 mostly defined **intents and entities**.

For Collaboration, Part 2 needs to define **how Gemini behaves throughout the entire collaboration lifecycle**.

Unlike Campaign List, the available actions change based on:

* Current collaboration stage  
* User persona (Brand / Creator)  
* Collaboration status  
* Pending approvals  
* Backend permissions

So instead of exposing all collaboration functions, the AI Contract should expose only what is valid for the current collaboration.

This keeps prompts small, reduces hallucinations and matches how enterprise AI agents work.

---

# **Collaboration Engineering Specification**

# **Part 2 – AI Contract, Context & Function Exposure**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** Backend Developer (NestJS \+ Gemini \+ Cursor)

---

# **1\. Objective**

This document defines how the Collaboration module communicates with Gemini.

The AI Contract determines:

* What context Gemini receives.  
* Which functions Gemini can access.  
* Which actions are available to the current user.  
* How collaboration state influences AI behavior.  
* How Brand and Creator personas are differentiated.

This document does **not** implement backend business logic.

---

# **2\. AI Contract Overview**

The Collaboration AI Contract consists of five components.

Collaboration Context  
        │  
        ▼  
Persona Context  
        │  
        ▼  
Workflow Context  
        │  
        ▼  
Available Functions  
        │  
        ▼  
Prompt Extension

Every AI request should be built from these components.

---

# **3\. Collaboration Context**

Create

src/modules/collaboration/ai/

collaboration-ai-context.ts

Purpose

Provide Gemini with the minimum information required to understand the active collaboration.

interface CollaborationAIContext {

organizationId:string;

campaignId:string;

collaborationId:string;

conversationId:string;

brandId:string;

creatorId:string;

currentStage:string;

currentStatus:string;

currentPersona:"BRAND"|"CREATOR";

}

The AI Context should never include unrelated business data.

---

# **4\. Persona Context**

Gemini must behave differently depending on the current user.

Supported personas

enum Persona {

BRAND,

CREATOR

}

Persona controls

* wording  
* available actions  
* available tools  
* response style

Persona is supplied by the backend.

Gemini must never infer it.

---

# **5\. Workflow Context**

The backend provides the current collaboration workflow state.

interface WorkflowContext {

stage:string;

status:string;

pendingApproval:boolean;

pendingAction:string;

}

Example

{  
"stage":"CONTENT\_REVIEW",

"status":"PENDING\_BRAND\_APPROVAL",

"pendingApproval":true  
}

Gemini must use this information instead of reasoning about workflow progression.

---

# **6\. Supported Collaboration Intents**

Create

collaboration-intents.ts

Register supported intents.

const CollaborationIntents \= \[

"VIEW\_COLLABORATION",

"VIEW\_STATUS",

"SEND\_MESSAGE",

"ACCEPT",

"DECLINE",

"COUNTER",

"UPLOAD\_CONTENT",

"REQUEST\_REVISION",

"APPROVE\_CONTENT",

"REJECT\_CONTENT",

"MARK\_SHIPPED",

"MARK\_RECEIVED",

"VIEW\_TIMELINE"

\];

Intent detection only identifies user goals.

Business validation remains in backend services.

---

# **7\. Collaboration Entities**

Create

collaboration-entities.ts

Supported entities

Campaign

Creator

Brand

Deliverable

Shipment

Content

Revision

Deadline

Collaboration Status

Timeline

These entities improve prompt understanding.

They do not replace backend identifiers.

---

# **8\. Function Exposure**

Gemini should never receive every Collaboration function.

The backend should expose only functions valid for the current workflow state.

Example

Negotiation

acceptInvite()

declineInvite()

counterOffer()

viewCampaign()

Content Review

approveContent()

requestRevision()

viewSubmission()

Compliance

verifySubmission()

completeCollaboration()

Unavailable functions must not be exposed.

---

# **9\. Prompt Extension**

Create

collaboration-prompt.ts

The prompt should include:

* collaboration summary  
* current stage  
* persona  
* available actions  
* collaboration status

Example

Current Module:  
Collaboration

Current Persona:  
Brand

Current Stage:  
Content Review

Available Actions:  
Approve Content  
Request Revision  
View Submission

No business rules should be embedded in the prompt.

---

# **10\. AI Response Rules**

Gemini must:

* Explain current collaboration state.  
* Recommend valid actions.  
* Invoke registered tools.  
* Wait for backend responses.  
* Never assume workflow progression.

Gemini must not:

* Change collaboration stage.  
* Approve submissions.  
* Release payments.  
* Determine deadlines.  
* Override backend validations.

---

# **11\. Function Registration Contract**

Create

collaboration-functions.ts

Each function must define:

{

tool:string;

description:string;

permissions:string\[\];

inputSchema:string;

outputSchema:string;

backendService:string;

}

Only registered functions may be executed.

---

# **12\. Prompt Assembly Flow**

User  
      │  
      ▼  
Conversation Manager  
      │  
      ▼  
Collaboration Context  
      │  
      ▼  
Workflow Context  
      │  
      ▼  
Persona Context  
      │  
      ▼  
Available Functions  
      │  
      ▼  
Prompt Builder  
      │  
      ▼  
Gemini

This ensures Gemini always receives a consistent context.

---

# **13\. Cursor Tasks**

## **Task A – Collaboration AI Context**

Generate

collaboration-ai-context.ts

Requirements

* Strongly typed context model.  
* Include collaboration, workflow and persona information.  
* No business logic.  
* Production-ready TypeScript.

---

## **Task B – Collaboration Intents**

Generate

collaboration-intents.ts

Requirements

* Register all Collaboration intents.  
* Export intent definitions.  
* Follow existing AI Contract conventions.

---

## **Task C – Collaboration Entities**

Generate

collaboration-entities.ts

Requirements

* Register Collaboration entities.  
* Keep entities independent from backend models.  
* Production-ready TypeScript.

---

## **Task D – Prompt Provider**

Generate

collaboration-prompt.ts

Requirements

* Build prompt extension.  
* Inject collaboration context.  
* Inject persona.  
* Inject workflow state.  
* Inject available functions.  
* No business logic.

---

## **Task E – Function Provider**

Generate

collaboration-functions.ts

Requirements

* Register AI-callable Collaboration functions.  
* Reference backend services only.  
* Do not implement business logic.  
* Follow existing Function Registry structure.

---

# **14\. Deliverables**

### **New Files**

src/modules/collaboration/ai/

collaboration-ai-context.ts

collaboration-intents.ts

collaboration-entities.ts

collaboration-functions.ts

collaboration-prompt.ts

### **Functional Capabilities**

After implementation:

* Collaboration-specific AI context is available.  
* Brand and Creator personas are supported.  
* Workflow state is injected into every AI request.  
* Gemini only sees valid Collaboration functions.  
* Intents and entities are registered.  
* Prompt generation remains independent of backend logic.

---

# **Developer Notes**

* Do not expose all Collaboration tools to Gemini. Expose only the subset allowed by the current workflow stage and user persona.  
* Keep prompts declarative. They should describe the current collaboration, not contain business rules.  
* Reuse the existing AI Function Registry and Prompt Builder introduced in the Chat Engine architecture.  
* Avoid duplicating validation or authorization logic in prompts; those remain backend responsibilities.

This completes **Part 2** and prepares the Collaboration module for **Part 3**, where the execution pipeline will connect Gemini, the Function Registry, the AI Orchestrator, and the Collaboration backend services into an end-to-end workflow.

