Perfect. Now we move into what is arguably the **most important implementation document**.

* **Part 1** registered the module.  
* **Part 2** defined the AI contract.  
* **Part 3** will implement the entire execution pipeline.

This is where the developer will spend most of their time, and it should leave **zero ambiguity**.

Unlike Parts 1 and 2, Part 3 should define actual implementation patterns, service responsibilities, conversation state, function calling, response building, and integration with the existing Chat Engine.

---

# **UCE-01 – Campaign List Engineering Implementation Specification**

## **Part 3 – AI Execution Pipeline & Backend Integration**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** Backend Developer (NestJS \+ Gemini \+ Cursor)

---

# **1\. Objective**

This document defines how a Campaign List request flows from the chat interface to the backend and back.

This document covers:

* Intent execution  
* Context injection  
* Gemini function calling  
* Backend orchestration  
* Service execution  
* Response mapping  
* Conversation state  
* Human-in-the-loop workflow

No business rules should exist in Gemini.

---

# **2\. Execution Flow**

Every Campaign request must follow this pipeline.

User  
   │  
   ▼  
Conversation Manager  
   │  
   ▼  
Campaign Context Builder  
   │  
   ▼  
Prompt Builder  
   │  
   ▼  
Gemini API  
   │  
   ▼  
Tool Selection  
   │  
   ▼  
Tool Executor  
   │  
   ▼  
Campaign Service  
   │  
   ▼  
Response Builder  
   │  
   ▼  
Chat UI

The pipeline must not be modified.

---

# **3\. Controller Implementation**

## **File**

campaign-chat.controller.ts

---

## **Responsibility**

The controller should:

* Receive chat requests  
* Validate authentication  
* Load conversation state  
* Build campaign context  
* Invoke Gemini  
* Execute tool  
* Build response  
* Persist conversation state  
* Return response

The controller must never:

* Query the database directly  
* Execute business logic  
* Build prompts  
* Format UI responses

---

### **Cursor Prompt**

Create CampaignChatController.

Requirements:

\- NestJS Controller  
\- JWT authentication  
\- Dependency Injection  
\- Reuse existing Chat Controller architecture  
\- Delegate all business logic to services  
\- Return shared AI response contract  
\- No direct database access  
\- No prompt generation inside controller

Generate production-ready TypeScript.

---

# **4\. Campaign AI Service**

## **File**

campaign-ai.service.ts

---

## **Responsibility**

This service orchestrates the AI workflow.

Responsibilities:

* Build prompt  
* Send request to Gemini  
* Validate structured response  
* Resolve tool  
* Execute backend service  
* Build final response

The service should never:

* Access repositories directly  
* Perform permission checks  
* Contain campaign business logic

---

### **Public Methods**

processMessage()

executeTool()

buildResponse()

handleClarification()

handleConfirmation()

---

### **Cursor Prompt**

Generate CampaignAIService.

Follow the existing AI Service pattern.

Responsibilities:

\- Build Campaign prompt  
\- Call shared Gemini client  
\- Parse structured response  
\- Execute registered tool  
\- Build shared response contract

Generate production-ready NestJS code.

---

# **5\. Context Builder**

## **File**

campaign-context-builder.ts

---

### **Required Context**

interface CampaignContext {

organizationId

brandId

userId

role

selectedCampaign

filters

sort

permissions

conversationState

}

---

### **Responsibilities**

Fetch only the minimum required context.

Do not load:

* Wallet history  
* Creator data  
* Analytics datasets  
* Billing

---

### **Cursor Prompt**

Generate CampaignContextBuilder.

Follow existing ContextBuilder implementation.

Fetch only Campaign context.

Return strongly typed DTO.

Support dependency injection.

Generate production-ready TypeScript.

---

# **6\. Gemini Function Calling**

Gemini must return a structured tool call.

Example schema:

{  
  "intent": "LIST\_CAMPAIGNS",  
  "tool": "listCampaigns",  
  "confidence": 0.98,  
  "entities": {  
    "status": "ACTIVE"  
  },  
  "requiresConfirmation": false,  
  "requiresClarification": false  
}

No natural language parsing should be required after the Gemini response.

---

# **7\. Tool Executor**

## **File**

tool-executor.ts

---

### **Responsibility**

Resolve the tool returned by Gemini and invoke the corresponding backend service.

Example:

listCampaigns  
        │  
        ▼  
CampaignService.getCampaignList()

The Tool Executor should:

* Validate tool existence  
* Validate required entities  
* Invoke backend service  
* Handle execution errors  
* Return typed results

---

### **Cursor Prompt**

Create ToolExecutor.

Reuse existing Tool Registry.

Resolve Gemini tool calls.

Invoke registered NestJS services.

Return strongly typed responses.

Generate production-ready TypeScript.

---

# **8\. Response Builder**

Reuse the shared Response Builder.

Campaign module should only provide mappings.

Example:

| Tool | Response Contract |
| ----- | ----- |
| listCampaigns | CampaignTable |
| campaignSummary | Narrative \+ Metrics |
| compareCampaigns | ComparisonTable |
| pauseCampaign | ConfirmationWidget |

The Campaign module must never generate raw frontend payloads.

---

# **9\. Conversation State**

Extend the shared Conversation Manager with Campaign-specific state.

interface CampaignConversationState {

currentIntent

selectedCampaign

selectedCampaignIds

activeFilters

activeSort

pendingSlots

pendingConfirmation

lastTool

}

State must be updated after every successful interaction.

---

# **10\. Clarification Flow**

When Gemini identifies missing information:

User  
   │  
   ▼  
Intent Detected  
   │  
Missing Required Entity  
   │  
   ▼  
Slot Filling Engine  
   │  
Collect User Input  
   │  
Resume Intent

No backend tool should execute until all required slots are collected.

---

# **11\. Human-in-the-Loop Flow**

All write operations follow this sequence:

User  
   │  
   ▼  
Gemini  
   │  
Tool Selected  
   │  
Validation  
   │  
Confirmation Widget  
   │  
User Confirms  
   │  
Execute Tool  
   │  
Success Response

Applies to:

* Pause Campaign  
* Resume Campaign  
* Archive Campaign  
* Duplicate Campaign  
* Bulk Actions

---

# **12\. Error Handling**

Handle the following consistently:

| Error | Action |
| ----- | ----- |
| Unknown intent | Fallback to general assistant |
| Missing slot | Trigger Slot Filling |
| Tool not found | Log and return generic error |
| Permission denied | Return permission response |
| Validation failed | Return validation response |
| Gemini timeout | Retry using shared retry policy |
| Backend failure | Return generic failure message and log error |
| Invalid Gemini JSON | Reject response and retry once |

No module-specific error format should be introduced.

---

# **13\. Logging & Telemetry**

Capture the following for every request:

* Thread ID  
* Organization ID  
* User ID  
* Active Intent  
* Tool Selected  
* Confidence Score  
* Gemini Latency  
* Backend Latency  
* Response Contract  
* Validation Result  
* Confirmation Status  
* Error (if any)

Reuse the existing telemetry framework.

---

# **14\. Expected Files**

### **New Files**

campaign-ai.service.ts

campaign-chat.controller.ts

tool-executor.ts

### **Modified Files**

conversation-manager.ts

response-builder.ts

tool-registry.ts

---

# **15\. Cursor Tasks**

### **Task A – Campaign Chat Controller**

Generate:

* `campaign-chat.controller.ts`

Requirements:

* Extend existing Chat Controller pattern.  
* No business logic.  
* Authenticate user.  
* Delegate to CampaignAIService.  
* Return shared response contract.

---

### **Task B – Campaign AI Service**

Generate:

* `campaign-ai.service.ts`

Requirements:

* Build prompt.  
* Call shared Gemini client.  
* Validate structured JSON.  
* Resolve tool.  
* Execute backend service.  
* Return shared response.

---

### **Task C – Tool Executor**

Generate:

* `tool-executor.ts`

Requirements:

* Resolve tool from registry.  
* Execute service.  
* Validate tool input.  
* Handle errors.  
* Return typed result.

---

### **Task D – Conversation State**

Extend the existing Conversation Manager.

Requirements:

* Store Campaign-specific state.  
* Support multi-turn conversations.  
* Support slot filling.  
* Support confirmation flow.  
* Preserve compatibility with existing modules.

---

# **16\. Deliverables**

At the end of Part 3, the following should exist:

### **New Components**

* CampaignChatController  
* CampaignAIService  
* ToolExecutor

### **Extended Components**

* Conversation Manager  
* Tool Registry  
* Response Builder

### **Functional Capabilities**

* End-to-end execution pipeline from chat to backend.  
* Structured Gemini function calling.  
* Tool execution through backend services.  
* Shared response contracts.  
* Campaign conversation state.  
* Clarification and confirmation workflows.  
* Unified error handling and telemetry.

---

## **Recommendation before Part 4**

Before implementing tests, I recommend introducing a **Function Calling Manifest** shared across all AI modules. Instead of each module defining tools independently, maintain a central manifest that lists every tool, its JSON schema, required permissions, backend service, response contract, and owning module. Campaign List would simply register its tools into this manifest. This approach scales much better as you add Wallet, Analytics, Creator Discovery, and other modules, while keeping Gemini configuration and backend execution in sync.

