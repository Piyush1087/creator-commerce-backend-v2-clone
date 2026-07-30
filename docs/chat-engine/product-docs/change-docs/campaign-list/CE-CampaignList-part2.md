Yes, and before we continue, I want to make one important architectural improvement.

After writing Part 1, I realized that **Part 2 is where the AI behavior is actually defined**. This section will become the reference not only for Cursor, but also for prompt engineering, tool registration, and future modules.

So instead of simply documenting "Intents" and "Entities", we're going to define the **AI Contract**.

Every intent will include:

* Intent Definition  
* Natural Language Examples  
* Required Entities  
* Gemini Decision Rules  
* Tool(s) Available  
* Input DTO  
* Output DTO  
* Response Contract  
* Error Conditions  
* Cursor Prompt  
* Files Generated

This means Cursor doesn't have to infer anything.

---

# **UCE-01 – Campaign List Engineering Implementation Specification**

## **Part 2 – AI Contracts (Intent, Entities, Tools & Gemini Configuration)**

**Version:** 1.0  
**Status:** Production Ready

---

# **1\. Objective**

This document defines how Gemini should understand Campaign List requests and how they should be translated into backend tool execution.

Gemini is responsible only for:

* Intent Detection  
* Entity Extraction  
* Reasoning  
* Tool Selection  
* Response Generation

Gemini must **never** execute business logic.

---

# **2\. Campaign Intents**

Create the following file

campaign-intents.ts

---

## **Supported Intents**

export enum CampaignIntent {

LIST\_CAMPAIGNS,

SEARCH\_CAMPAIGNS,

FILTER\_CAMPAIGNS,

SORT\_CAMPAIGNS,

CAMPAIGN\_SUMMARY,

CAMPAIGN\_PERFORMANCE,

COMPARE\_CAMPAIGNS,

CAMPAIGN\_FINANCIALS,

PAUSE\_CAMPAIGN,

RESUME\_CAMPAIGN,

ARCHIVE\_CAMPAIGN,

DUPLICATE\_CAMPAIGN,

BULK\_CAMPAIGN\_ACTION

}

No additional intents should be created.

---

# **3\. Intent Definitions**

## **LIST\_CAMPAIGNS**

### **Description**

Returns campaigns belonging to the current organization.

---

### **Example Utterances**

Show my campaigns

Open campaign list

List campaigns

Show all campaigns

What campaigns are running?

---

### **Required Entities**

None

---

### **Optional Entities**

Status

Sort

Pagination

---

### **Tool**

listCampaigns

---

### **Response Contract**

CampaignTable

---

### **Cursor Prompt**

Create LIST\_CAMPAIGNS intent.

Follow existing intent architecture.

Return strongly typed intent definition.

Generate production-ready TypeScript.

---

## **SEARCH\_CAMPAIGNS**

Description

Search campaigns by metadata.

---

Examples

Search skincare campaigns

Find Diwali campaigns

Find awareness campaigns

---

Entities

Campaign Name

Objective

Product

Status

Date

---

Tool

searchCampaigns

---

Response

CampaignTable

---

## **FILTER\_CAMPAIGNS**

Supported Filters

Status

Objective

Budget

Date

Product

Owner

Tool

filterCampaigns

---

## **SORT\_CAMPAIGNS**

Supported Sorts

Newest

Oldest

Budget

Performance

ROI

End Date

Tool

sortCampaigns

---

## **CAMPAIGN\_SUMMARY**

Entities

Campaign Name

Tool

campaignSummary

Returns

Narrative

Metrics

KPIs

---

## **CAMPAIGN\_PERFORMANCE**

Returns

Performance Metrics

ROI

Reach

Engagement

Conversions

---

## **COMPARE\_CAMPAIGNS**

Requires

Campaign A

Campaign B

Tool

compareCampaigns

---

## **CAMPAIGN\_FINANCIALS**

Returns

Budget

Spent

Remaining

Utilization

---

## **Write Intents**

Supported

Pause

Resume

Archive

Duplicate

Bulk Actions

Every write intent

MUST

trigger

Human In The Loop.

---

# **4\. Entity Definitions**

Create

campaign-entities.ts

---

## **Campaign Name**

Type

String

Example

Summer Sale

---

## **Campaign Status**

Enum

ACTIVE

PAUSED

DRAFT

COMPLETED

ARCHIVED

Synonyms

Running

Live

Finished

Closed

---

## **Campaign Objective**

Enum

Awareness

Sales

Traffic

UGC

Launch

---

## **Product**

String

---

## **Budget**

Number

---

## **Date Range**

ISO Date Range

---

# **5\. Gemini Prompt Extension**

Create

campaign-prompt.ts

System Prompt

You are The Creator Shop AI Assistant.

Current Module

Campaign List

Your responsibilities

• Help users discover campaigns.

• Help users compare campaigns.

• Help users understand campaign performance.

• Help users manage campaigns safely.

Rules

Never hallucinate campaign data.

Never assume campaign selection.

Always request clarification if multiple campaigns match.

Never execute lifecycle actions without confirmation.

Always return valid structured JSON.

Use only registered tools.

Never access unavailable data.

---

# **6\. Tool Definitions**

Create

campaign-tools.ts

---

## **Tool**

listCampaigns

Description

Returns campaigns.

Backend

CampaignService.getCampaignList()

Input DTO

interface ListCampaignsInput {

organizationId: string;

filters?: CampaignFilters;

sort?: CampaignSort;

pagination?: Pagination;

}

Output DTO

interface ListCampaignsOutput {

campaigns: Campaign\[\];

total: number;

page: number;

pageSize: number;

}

Errors

PERMISSION\_DENIED

INVALID\_FILTER

INTERNAL\_ERROR

---

## **Tool**

searchCampaigns

Backend

CampaignSearchService.search()

Input

SearchQuery

Organization

Filters

Returns

CampaignTable

---

## **Tool**

compareCampaigns

Backend

CampaignAnalytics.compare()

Input

Campaign A

Campaign B

Returns

Comparison

---

## **Tool**

pauseCampaign

Backend

CampaignLifecycle.pause()

Confirmation

Required

---

Repeat the same structure for:

* resumeCampaign  
* archiveCampaign  
* duplicateCampaign  
* bulkCampaignAction  
* campaignFinancials  
* campaignSummary  
* campaignPerformance  
* filterCampaigns  
* sortCampaigns

---

# **7\. Gemini Tool Selection Rules**

Gemini should select exactly one tool unless the intent explicitly requires multiple backend operations.

Rules:

1. Prefer the most specific tool that satisfies the user's request.  
2. If required entities are missing, return a slot-filling request instead of invoking a tool.  
3. Never chain write operations in a single response.  
4. Never invoke lifecycle tools (`pauseCampaign`, `resumeCampaign`, etc.) without explicit user confirmation.  
5. If multiple campaigns match a query, ask the user to disambiguate before invoking a tool.

---

# **8\. Response Mapping**

| Tool | Response |
| ----- | ----- |
| listCampaigns | CampaignTable |
| searchCampaigns | CampaignTable |
| filterCampaigns | CampaignTable |
| sortCampaigns | CampaignTable |
| campaignSummary | Narrative \+ Metrics |
| campaignPerformance | KPI Dashboard |
| compareCampaigns | Comparison Table |
| campaignFinancials | Financial Metrics |
| pauseCampaign | Confirmation Widget |
| resumeCampaign | Confirmation Widget |
| archiveCampaign | Confirmation Widget |
| duplicateCampaign | Confirmation Widget |
| bulkCampaignAction | Bulk Review Widget |

Reuse the existing response contracts from the Chat Engine.

---

# **9\. Cursor Tasks**

### **Task A – Intents**

Generate:

* `campaign-intents.ts`

Prompt:

Implement CampaignIntent enum using the existing Intent Registry pattern.

Register every Campaign List intent.

Follow project coding standards.

Generate production-ready TypeScript.

---

### **Task B – Entities**

Generate:

* `campaign-entities.ts`

Prompt:

Create strongly typed Campaign entity definitions.

Support enum validation.

Support synonym mapping.

Follow existing Entity Extraction implementation.

---

### **Task C – Prompt**

Generate:

* `campaign-prompt.ts`

Prompt:

Generate the Campaign List prompt extension exactly as defined in this specification.

Return production-ready prompt constants.

Follow the Prompt Builder architecture.

---

### **Task D – Tools**

Generate:

* `campaign-tools.ts`

Prompt:

Create the Campaign Tool Registry.

Implement every tool definition.

Define input/output DTOs.

Reference existing NestJS services.

Do not implement business logic.

Generate production-ready TypeScript.

---

# **10\. Deliverables**

At the end of Part 2, the developer should have:

### **New Files**

* `campaign-intents.ts`  
* `campaign-entities.ts`  
* `campaign-prompt.ts`  
* `campaign-tools.ts`

### **Defined Contracts**

* Intent definitions  
* Entity definitions  
* Prompt extension  
* Tool registry  
* DTO contracts  
* Tool selection rules  
* Response mappings

### **Review Checklist**

* All Campaign intents are registered.  
* Gemini prompt extension is complete.  
* Every tool has a defined input and output contract.  
* Entity enums and synonym mappings are implemented.  
* Tool selection rules prevent unsafe operations.  
* Response mappings align with the shared Chat Engine contracts.

---

## **My recommendation before moving to Part 3**

One enhancement I'd make is to replace the generic `campaign-tools.ts` with a **fully typed Tool Manifest**, where each tool includes its JSON schema (compatible with Gemini function calling), permission requirements, validation hooks, backend service mapping, and expected response contract. This becomes the single source of truth for both the AI layer and Cursor, eliminating duplication between prompts, DTOs, and backend registrations. It's the pattern I'd use for every future module in The Creator Shop.

