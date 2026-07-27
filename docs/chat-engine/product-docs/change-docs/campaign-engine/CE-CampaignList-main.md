# **UCE-01 – AI Chat Engine Extension Specification**

## **Universal Campaign Engine – Campaign List**

**Version:** 1.0  
**Status:** Ready for Development  
**Parent Module:** Universal Campaign Engine (UCE)  
**Sub-Module ID:** UCE-01  
**Depends On:** AI Chat Engine Architecture v1.0

---

# **1\. Overview**

## **Objective**

Extend the existing AI Chat Engine to support the **Campaign List** sub-module within the Universal Campaign Engine.

This document only defines the AI behaviour required for Campaign List. All common chat functionality including:

* Conversation Management  
* Thread Management  
* Intent Detection Pipeline  
* Slot Filling Engine  
* Human-in-the-loop Workflow  
* Response Contracts  
* Validation Pipeline

are inherited from the core Chat Engine Architecture.

---

## **Supported Operations**

### **Read Operations**

* View campaign list  
* Search campaigns  
* Filter campaigns  
* Sort campaigns  
* View campaign summary  
* Compare campaigns  
* View campaign performance  
* View campaign financials

### **Write Operations**

* Pause campaign  
* Resume campaign  
* Archive campaign  
* Duplicate campaign  
* Bulk campaign actions

All write operations must follow the Human-in-the-loop confirmation workflow defined in the Chat Engine.

---

## **Dependencies**

| Module | Purpose |
| ----- | ----- |
| Brand Centre | Brand Context |
| Campaign Engine | Campaign Data |
| Wallet | Budget Information |
| Escrow | Reserved Budget |
| Analytics | Campaign KPIs |
| Creator Module | Creator Statistics |

---

# **2\. AI Capability Matrix**

| Capability | Intent | Type | Confirmation | Response |
| ----- | ----- | ----- | ----- | ----- |
| List Campaigns | LIST\_CAMPAIGNS | Read | No | Campaign Table |
| Search Campaigns | SEARCH\_CAMPAIGNS | Read | No | Campaign Table |
| Filter Campaigns | FILTER\_CAMPAIGNS | Read | No | Campaign Table |
| Sort Campaigns | SORT\_CAMPAIGNS | Read | No | Campaign Table |
| Campaign Summary | CAMPAIGN\_SUMMARY | Read | No | Narrative \+ Metrics |
| Campaign Performance | CAMPAIGN\_PERFORMANCE | Read | No | Metrics Dashboard |
| Compare Campaigns | COMPARE\_CAMPAIGNS | Read | No | Comparison Table |
| Campaign Financials | CAMPAIGN\_FINANCIALS | Read | No | Financial Metrics |
| Pause Campaign | PAUSE\_CAMPAIGN | Write | Yes | Confirmation Widget |
| Resume Campaign | RESUME\_CAMPAIGN | Write | Yes | Confirmation Widget |
| Archive Campaign | ARCHIVE\_CAMPAIGN | Write | Yes | Confirmation Widget |
| Duplicate Campaign | DUPLICATE\_CAMPAIGN | Write | Yes | Confirmation Widget |
| Bulk Campaign Action | BULK\_CAMPAIGN\_ACTION | Write | Yes | Bulk Review Widget |

---

# **3\. Intent Specifications**

## **LIST\_CAMPAIGNS**

### **User Examples**

* Show my campaigns  
* Show active campaigns  
* Open campaign list  
* List all campaigns  
* Show running campaigns

### **Required Entities**

None

### **Missing Slots**

None

### **Backend Tool**

CampaignService.getCampaignList()

### **Response Contract**

Campaign Data Table

---

## **SEARCH\_CAMPAIGNS**

### **User Examples**

* Search skincare campaigns  
* Find Diwali campaigns  
* Show awareness campaigns  
* Find campaigns ending next month

### **Required Entities**

Optional

* Campaign Name  
* Campaign Type  
* Product  
* Status  
* Date

### **Missing Slots**

None

### **Backend Tool**

CampaignService.searchCampaigns()

### **Response Contract**

Filtered Campaign Table

---

## **CAMPAIGN\_SUMMARY**

### **User Examples**

* Summarize Summer Sale  
* Give campaign overview  
* Explain campaign performance

### **Required Entities**

Campaign Name

### **Missing Slots**

Campaign Name

### **Backend Tool**

CampaignAnalyticsService.getSummary()

### **Response Contract**

Narrative \+ Metrics

---

## **CAMPAIGN\_PERFORMANCE**

### **User Examples**

* Show campaign performance  
* Show ROI  
* Which campaign performed best?  
* Show campaign KPIs

### **Backend Tool**

CampaignAnalyticsService.getPerformance()

### **Response Contract**

Metric Cards \+ Narrative

---

## **COMPARE\_CAMPAIGNS**

### **User Examples**

* Compare Summer Sale with Winter Sale  
* Compare Campaign A and Campaign B  
* Which campaign performed better?

### **Required Entities**

Minimum two campaigns

### **Missing Slots**

Campaign Selection

### **Backend Tool**

CampaignAnalyticsService.compareCampaigns()

### **Response Contract**

Comparison Table

---

## **CAMPAIGN\_FINANCIALS**

### **User Examples**

* Show campaign budget  
* Campaign spending  
* Budget utilization  
* Remaining budget

### **Backend Tool**

CampaignFinanceService.getCampaignFinancials()

### **Response Contract**

Financial Metrics

---

## **PAUSE\_CAMPAIGN**

### **User Examples**

* Pause campaign  
* Stop Summer Sale

### **Required Entity**

Campaign Name

### **Missing Slots**

Campaign Name

### **Backend Tool**

CampaignLifecycleService.pauseCampaign()

### **Response Contract**

Confirmation Widget

---

## **RESUME\_CAMPAIGN**

### **User Examples**

* Resume campaign  
* Restart Summer Sale

### **Required Entity**

Campaign Name

### **Backend Tool**

CampaignLifecycleService.resumeCampaign()

### **Response Contract**

Confirmation Widget

---

## **ARCHIVE\_CAMPAIGN**

### **User Examples**

* Archive campaign  
* Close campaign

### **Required Entity**

Campaign Name

### **Backend Tool**

CampaignLifecycleService.archiveCampaign()

### **Response Contract**

Confirmation Widget

---

## **DUPLICATE\_CAMPAIGN**

### **User Examples**

* Duplicate Summer Sale  
* Clone campaign

### **Required Entities**

* Campaign Name  
* New Campaign Name

### **Missing Slots**

New Campaign Name

### **Backend Tool**

CampaignLifecycleService.duplicateCampaign()

### **Response Contract**

Confirmation Widget

---

## **BULK\_CAMPAIGN\_ACTION**

### **User Examples**

* Pause all expired campaigns  
* Archive completed campaigns  
* Resume paused campaigns

### **Backend Tool**

CampaignLifecycleService.bulkAction()

### **Response Contract**

Bulk Review Widget

---

# **4\. Entity Extraction**

| Entity | Type | Required | Validation |
| ----- | ----- | ----- | ----- |
| Campaign ID | UUID | Optional | Existing Campaign |
| Campaign Name | String | Optional | Existing Campaign |
| Campaign Status | Enum | Optional | Active, Paused, Completed, Archived, Draft |
| Campaign Type | Enum | Optional | Brand Defined |
| Product | String | Optional | Existing Product |
| Objective | Enum | Optional | Existing Objective |
| Date Range | Date Range | Optional | Valid Dates |
| Budget | Number | Optional | Positive Value |
| Sort By | Enum | Optional | Supported Sort Options |
| Filter | Object | Optional | Supported Filters |

---

# **5\. Context Requirements**

The Campaign List extension should only receive the following context from the AI Core.

## **Required**

* Brand ID  
* Organization ID  
* User Role  
* Campaign Metadata  
* Campaign KPIs  
* Active Filters  
* Current Campaign Selection  
* User Permissions

## **Not Required**

* Brand DNA  
* Creator Profiles  
* Wallet Ledger  
* Billing History  
* Subscription Details  
* Escrow Transactions

The AI Core is responsible for injecting only the required context.

---

# **6\. Tool Mapping**

| Intent | Backend Service | Method |
| ----- | ----- | ----- |
| LIST\_CAMPAIGNS | CampaignService | getCampaignList() |
| SEARCH\_CAMPAIGNS | CampaignService | searchCampaigns() |
| FILTER\_CAMPAIGNS | CampaignService | filterCampaigns() |
| SORT\_CAMPAIGNS | CampaignService | sortCampaigns() |
| CAMPAIGN\_SUMMARY | CampaignAnalyticsService | getSummary() |
| CAMPAIGN\_PERFORMANCE | CampaignAnalyticsService | getPerformance() |
| COMPARE\_CAMPAIGNS | CampaignAnalyticsService | compareCampaigns() |
| CAMPAIGN\_FINANCIALS | CampaignFinanceService | getFinancials() |
| PAUSE\_CAMPAIGN | CampaignLifecycleService | pauseCampaign() |
| RESUME\_CAMPAIGN | CampaignLifecycleService | resumeCampaign() |
| ARCHIVE\_CAMPAIGN | CampaignLifecycleService | archiveCampaign() |
| DUPLICATE\_CAMPAIGN | CampaignLifecycleService | duplicateCampaign() |
| BULK\_CAMPAIGN\_ACTION | CampaignLifecycleService | bulkAction() |

---

# **7\. Response Contract Mapping**

This module must only use response contracts already defined in the Chat Engine.

| Intent | Response Contract |
| ----- | ----- |
| LIST\_CAMPAIGNS | Data Table |
| SEARCH\_CAMPAIGNS | Data Table |
| FILTER\_CAMPAIGNS | Data Table |
| SORT\_CAMPAIGNS | Data Table |
| CAMPAIGN\_SUMMARY | Narrative \+ Metric Cards |
| CAMPAIGN\_PERFORMANCE | Metric Dashboard |
| COMPARE\_CAMPAIGNS | Comparison Table |
| CAMPAIGN\_FINANCIALS | Financial Metrics |
| PAUSE\_CAMPAIGN | Confirmation Widget |
| RESUME\_CAMPAIGN | Confirmation Widget |
| ARCHIVE\_CAMPAIGN | Confirmation Widget |
| DUPLICATE\_CAMPAIGN | Confirmation Widget |
| BULK\_CAMPAIGN\_ACTION | Bulk Review Widget |

No custom response types should be introduced.

---

# **8\. Slot Filling**

| Intent | Required Slots |
| ----- | ----- |
| CAMPAIGN\_SUMMARY | Campaign Name |
| COMPARE\_CAMPAIGNS | Campaign A, Campaign B |
| PAUSE\_CAMPAIGN | Campaign Name |
| RESUME\_CAMPAIGN | Campaign Name |
| ARCHIVE\_CAMPAIGN | Campaign Name |
| DUPLICATE\_CAMPAIGN | Campaign Name, New Campaign Name |
| BULK\_CAMPAIGN\_ACTION | Action, Campaign Selection |

The existing Slot Filling Engine is responsible for collecting missing information.

---

# **9\. Validation Rules**

## **Read Operations**

Validate:

* User belongs to Organization  
* User has Campaign access

---

## **Write Operations**

Validate:

* Campaign exists  
* Campaign belongs to current Organization  
* Campaign is editable  
* Campaign lifecycle permits requested action  
* User has required permission

Execution proceeds only after successful validation and explicit user confirmation.

---

# **10\. Cross-Module Dependencies**

| Module | Data Required |
| ----- | ----- |
| Brand Centre | Brand Name, Brand Category |
| Wallet | Campaign Budget |
| Escrow | Reserved Budget |
| Analytics | ROI, KPIs, Performance Metrics |
| Creator Module | Creator Count, Invitations |

The Campaign List extension consumes data from these modules through backend services. It must not implement or duplicate business logic owned by other modules.

---

# **11\. Conversation Flows**

## **Flow 1 – List Campaigns**

User  
   │  
   ▼  
Intent Detection  
   │  
LIST\_CAMPAIGNS  
   │  
CampaignService.getCampaignList()  
   │  
Campaign Response  
   │  
Data Table

---

## **Flow 2 – Campaign Summary**

User  
   │  
Campaign Summary  
   │  
Campaign Selected?  
   │  
Yes  
   │  
Analytics Service  
   │  
Summary Response  
   │  
Narrative \+ Metrics

---

## **Flow 3 – Pause Campaign**

User  
   │  
PAUSE\_CAMPAIGN  
   │  
Campaign Selected?  
   │  
Validation  
   │  
Confirmation Widget  
   │  
User Confirms  
   │  
CampaignLifecycleService.pauseCampaign()  
   │  
Success Response

---

## **Flow 4 – Bulk Action**

User  
   │  
Bulk Action  
   │  
Campaign Selection  
   │  
Validation  
   │  
Bulk Review Widget  
   │  
User Confirms  
   │  
Execute  
   │  
Success Response

---

# **12\. Prompt Extension**

When the active scope is **Campaign List**, append the following prompt extension to the Core System Prompt.

## **AI Responsibilities**

The AI should:

* Understand campaign terminology.  
* Recognize campaign lifecycle states.  
* Understand campaign KPIs.  
* Interpret campaign filters.  
* Explain campaign performance.  
* Assist users in managing campaigns.

The AI must never:

* Execute lifecycle actions without confirmation.  
* Invent campaign data.  
* Assume campaign selection when multiple campaigns match.  
* Bypass validation rules.  
* Override business permissions.

---

## **Domain Terminology**

Understand platform-specific terminology including:

* Campaign Status  
* Campaign Objective  
* Budget Utilization  
* Creator Count  
* Active Campaign  
* Draft Campaign  
* Completed Campaign  
* Archived Campaign  
* EMV  
* Engagement Rate  
* ROI  
* Deliverables

---

## **Developer Checklist**

* Register all Campaign List intents.  
* Add entity extraction mappings.  
* Configure context injection.  
* Implement backend tool mappings.  
* Map all response contracts.  
* Configure slot-filling requirements.  
* Implement validation rules.  
* Register Campaign List prompt extension.  
* Add telemetry for all supported intents.  
* Implement unit and integration tests for all read and write operations.

---

### **Notes**

This specification intentionally **extends** the existing AI Chat Engine Architecture and does not redefine shared components such as conversation management, slot filling, response rendering, validation pipelines, or human-in-the-loop workflows. It should be used as the implementation contract for the Campaign List sub-module and serve as the baseline template for future Universal Campaign Engine sub-modules.

