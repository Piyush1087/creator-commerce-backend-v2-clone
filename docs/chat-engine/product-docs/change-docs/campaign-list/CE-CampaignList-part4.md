I think Part 4 is where we should stop thinking about **Campaign List** and start thinking about the **future platform**.

Looking at everything we've designed so far, there's one thing missing from the original Chat Engine architecture:

> **An orchestration layer.**

Today, Campaign List only needs one module. Tomorrow, a user might say:

> "Pause all campaigns that have spent more than 80% of their budget and refund the remaining amount to my wallet."

That request spans:

* Campaign  
* Analytics  
* Wallet

The AI should not know how to execute that.

An **Orchestrator** should.

This is why enterprise AI systems (Microsoft Copilot, Salesforce Agentforce, Atlassian Rovo, ServiceNow AI Agents, etc.) all have an orchestration layer sitting between the LLM and the business modules.

**I recommend introducing it now**, even if it only routes to Campaign today. The implementation will be very thin today but will save a major refactor later.

---

# **UCE-01 – Campaign List Engineering Implementation Specification**

# **Part 4 – AI Orchestrator, Multi-Module Execution & Conversation Management**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** Backend Engineering Team

---

# **1\. Objective**

This document introduces the AI Orchestrator.

The AI Orchestrator is responsible for coordinating all AI-driven backend execution.

It does **not** replace Gemini.

It sits between Gemini and the backend.

Responsibilities:

* Route tool execution  
* Coordinate multiple modules  
* Manage execution state  
* Execute sequential workflows  
* Handle confirmations  
* Handle retries  
* Maintain conversation context

---

# **2\. Updated Architecture**

                   User  
                      │  
                      ▼  
                React Chat UI  
                      │  
                      ▼  
            Conversation Manager  
                      │  
                      ▼  
                Prompt Builder  
                      │  
                      ▼  
                 Gemini API  
                      │  
             Structured Response  
                      │  
                      ▼  
               AI Orchestrator  
                      │  
     ┌────────────────┼────────────────┐  
     ▼                ▼                ▼  
 Campaign         Brand Centre      Wallet  
     ▼                ▼                ▼  
 Services         Services         Services  
     ▼                ▼                ▼  
 Repositories     Repositories     Repositories  
                      │  
                      ▼  
                   Database

Gemini never invokes backend services directly.

Gemini only instructs the Orchestrator.

---

# **3\. AI Orchestrator**

Create

src/ai/orchestrator/ai-orchestrator.service.ts

---

## **Responsibilities**

The Orchestrator must

* Receive Gemini response  
* Validate response  
* Resolve functions  
* Execute functions  
* Handle confirmations  
* Handle slot filling  
* Coordinate multiple modules  
* Return unified response

The Orchestrator must never

* Generate prompts  
* Call Gemini  
* Access repositories  
* Contain business logic

---

# **4\. Execution Pipeline**

Every request must follow this pipeline.

User

↓

Gemini

↓

AI Function Registry

↓

AI Orchestrator

↓

Module Service

↓

Response Builder

↓

Chat UI

---

# **5\. Multi-Step Execution**

The Orchestrator should support execution plans.

Example

User

Pause campaign Summer Sale

↓

Gemini

↓

Execution Plan

↓

pauseCampaign

↓

CampaignLifecycleService.pause()

↓

Response Builder

---

Future Example

Pause Campaign

↓

Refund Wallet

↓

Notify Team

The Orchestrator should support sequential execution without redesign.

---

# **6\. Execution Plan Contract**

Create

interface ExecutionPlan {

steps: ExecutionStep\[\];

requiresConfirmation: boolean;

conversationId: string;

}

---

Execution Step

interface ExecutionStep {

stepId: string;

module: string;

tool: string;

parameters: unknown;

status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

}

This structure will allow future workflows without changing the Orchestrator.

---

# **7\. Single Module Execution**

Campaign List today generates one execution step.

Example

{  
  "steps": \[  
    {  
      "module": "campaign",  
      "tool": "listCampaigns",  
      "parameters": {  
        "status": "ACTIVE"  
      }  
    }  
  \]  
}

---

# **8\. Future Multi-Module Example**

User

Pause my campaign and refund remaining budget.

Gemini returns

{  
  "steps": \[  
    {  
      "module": "campaign",  
      "tool": "pauseCampaign"  
    },  
    {  
      "module": "wallet",  
      "tool": "refundRemainingBudget"  
    }  
  \]  
}

The Orchestrator executes:

1. Pause Campaign  
2. Verify success  
3. Refund Wallet  
4. Build unified response

---

# **9\. Retry Policy**

Each execution step must support retry metadata.

interface RetryPolicy {

maxRetries: number;

retryDelayMs: number;

retryableErrors: string\[\];

}

Retry only for transient failures.

Business validation failures must not retry.

---

# **10\. Confirmation Workflow**

If any execution step requires confirmation:

1. Pause execution.  
2. Store execution plan.  
3. Send confirmation widget.  
4. Resume execution after user confirmation.

The plan should resume from the pending step rather than rebuilding the entire request.

---

# **11\. Conversation Continuation**

Persist:

interface ConversationExecutionState {

executionPlanId: string;

currentStep: number;

completedSteps: string\[\];

pendingSteps: string\[\];

status: "ACTIVE" | "WAITING\_CONFIRMATION" | "COMPLETED" | "FAILED";

}

This enables reliable multi-turn execution.

---

# **12\. Cross-Module Dependencies**

Modules communicate only through service interfaces.

Examples:

| Source Module | Dependency | Through |
| ----- | ----- | ----- |
| Campaign | Wallet | `WalletService` |
| Campaign | Analytics | `AnalyticsService` |
| Campaign | Brand | `BrandService` |
| Wallet | Campaign | `CampaignService` |

No module may call another module's repositories directly.

---

# **13\. Error Handling**

The Orchestrator owns execution errors.

Standard states:

| Status | Meaning |
| ----- | ----- |
| PENDING | Awaiting execution |
| RUNNING | Currently executing |
| SUCCESS | Completed successfully |
| FAILED | Permanent failure |
| WAITING\_CONFIRMATION | User action required |
| CANCELLED | User cancelled execution |

Each failed step must record:

* Step ID  
* Tool  
* Module  
* Error code  
* Error message  
* Retry count

---

# **14\. Telemetry**

Capture telemetry at both request and step levels.

### **Request**

* Conversation ID  
* User ID  
* Organization ID  
* Total latency  
* Total steps  
* Overall result

### **Step**

* Module  
* Tool  
* Start time  
* End time  
* Duration  
* Status  
* Retry count

---

# **15\. Cursor Tasks**

## **Task A – AI Orchestrator**

Files

src/ai/orchestrator/ai-orchestrator.service.ts

Prompt

Create AIOrchestratorService for The Creator Shop AI Chat Engine.

Requirements:

\- Follow NestJS service architecture.  
\- Receive structured Gemini responses.  
\- Resolve tools using the AI Function Registry.  
\- Build and execute Execution Plans.  
\- Support single-step and multi-step execution.  
\- Handle confirmation workflows.  
\- Resume paused execution plans.  
\- Delegate business logic to module services.  
\- Return the shared AI response contract.  
\- Generate production-ready TypeScript.

---

## **Task B – Execution Plan Models**

Files

src/ai/orchestrator/models/execution-plan.ts

src/ai/orchestrator/models/execution-step.ts

src/ai/orchestrator/models/retry-policy.ts

src/ai/orchestrator/models/conversation-execution-state.ts

Prompt

Generate strongly typed TypeScript models for the AI Orchestrator.

Include:

\- ExecutionPlan  
\- ExecutionStep  
\- RetryPolicy  
\- ConversationExecutionState

Follow project naming conventions.

Generate production-ready code.

---

## **Task C – Integrate Function Registry**

Prompt

Modify the AI Orchestrator to consume the centralized AI Function Registry.

Requirements:

\- Resolve functions by tool name.  
\- Validate permissions.  
\- Validate input schemas.  
\- Execute registered backend services.  
\- Use response contracts from the Function Registry.  
\- Do not import module services directly outside the registry resolution process.

---

# **16\. Deliverables**

At the end of Part 4:

### **New Components**

* AIOrchestratorService  
* ExecutionPlan  
* ExecutionStep  
* RetryPolicy  
* ConversationExecutionState

### **Updated Components**

* Conversation Manager  
* Function Registry  
* Response Builder

### **Functional Capabilities**

* Single-step execution  
* Multi-step execution  
* Confirmation pause/resume  
* Cross-module orchestration  
* Retry support  
* Unified telemetry  
* Future-ready execution model

---

# **Architectural Recommendation (Important)**

This is the point where I would **depart slightly from your original Chat Engine document**.

Instead of asking Gemini to return a single tool:

{  
  "tool": "listCampaigns"  
}

I recommend standardizing on an **Execution Plan**, even for one-step requests:

{  
  "executionPlan": {  
    "steps": \[  
      {  
        "module": "campaign",  
        "tool": "listCampaigns",  
        "parameters": {  
          "status": "ACTIVE"  
        }  
      }  
    \]  
  }  
}

That may seem like extra structure today, but it avoids redesigning the AI contract when you introduce modules like Wallet, Payments, Products, Briefs, Creator Discovery, and Analytics. The AI contract remains stable while the platform grows, and the Orchestrator simply executes more steps. This is the architecture I would choose for a long-term, enterprise-scale Creator Shop platform.

