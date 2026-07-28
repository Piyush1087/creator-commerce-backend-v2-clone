

> **Whenever the AI executes an action from Campaign List and the backend returns a validation failure, the AI should understand the validation, present it as a checklist, and guide the user to resolve it without leaving the chat.**

This document should only cover the validations that originate from **Campaign List actions**.

---

# **UCE-01 – Campaign List Engineering Implementation Specification**

# **Part 5 – Campaign List Validation Recovery**

**Version:** 1.0  
**Module:** Universal Campaign Engine → Campaign List

---

# **1\. Objective**

This document defines how the Chat Engine should handle validation failures triggered from Campaign List actions.

The goal is to prevent generic backend error messages from being shown in chat.

Instead, every validation failure should be converted into an actionable checklist that the AI can guide the user through.

This document only applies to actions initiated from the Campaign List screen.

---

# **2\. Supported Campaign List Actions**

The following actions are covered by this document:

Go Live Campaign  
Pause Campaign  
Resume Campaign  
Archive Campaign  
Duplicate Campaign  
Delete Campaign

Each action may return one or more validation failures.

---

# **3\. Current Flow**

User  
    ↓  
Campaign List  
    ↓  
Click "Go Live"  
    ↓  
CampaignLifecycleService  
    ↓  
Validation Error  
    ↓  
Show Error Toast

This flow should be replaced.

---

# **4\. New Flow**

User  
      ↓  
Campaign List  
      ↓  
Go Live  
      ↓  
CampaignLifecycleService  
      ↓  
Validation Service  
      ↓  
Validation Response  
      ↓  
AI Response Builder  
      ↓  
Interactive Checklist

The action is paused instead of failed.

---

# **5\. Validation Response Contract**

Instead of returning

{  
  "success": false,  
  "message": "Campaign cannot be made live."  
}

Return

{  
  "success": false,  
  "code": "CAMPAIGN\_NOT\_READY",  
  "action": "GO\_LIVE",  
  "blockingItems": \[  
    {  
      "id": "brief",  
      "title": "Campaign Brief"  
    },  
    {  
      "id": "products",  
      "title": "Products"  
    },  
    {  
      "id": "budget",  
      "title": "Budget"  
    }  
  \]  
}

The backend is responsible for identifying the missing requirements.

The AI must not infer them.

---

# **6\. Validation Mapping**

Create

campaign-list-validation-map.ts

Purpose:

Convert existing validation errors into AI-readable responses.

Example

| Existing Validation | Chat Validation |
| ----- | ----- |
| CampaignBriefMissingException | brief |
| ProductsMissingException | products |
| BudgetMissingException | budget |
| TimelineMissingException | timeline |
| InvalidAudienceException | audience |

Do **not** modify the existing validators.

Only map them.

---

# **7\. AI Behaviour**

When the Chat Engine receives

{  
  "code": "CAMPAIGN\_NOT\_READY",  
  "blockingItems": \[  
    "brief",  
    "products",  
    "budget"  
  \]  
}

It should respond:

> Your campaign isn't ready to go live yet.

> Let's complete the remaining setup first.

☐ Campaign Brief

☐ Products

☐ Budget

After these are completed, I'll automatically continue making your campaign live.

---

# **8\. Repair Actions**

Every validation item must map to an existing Campaign tool.

| Validation | Tool |
| ----- | ----- |
| brief | openCampaignBrief |
| products | openCampaignProducts |
| budget | openCampaignBudget |
| timeline | openCampaignTimeline |
| audience | openCampaignAudience |

The Chat Engine should invoke these existing tools.

No new repair logic should be introduced.

---

# **9\. Execution Pause**

The current execution plan should be stored.

Example

interface CampaignListPausedAction {

action:"GO\_LIVE";

campaignId:string;

pendingItems:string\[\];

}

The execution is paused.

It is not cancelled.

---

# **10\. Resume Flow**

Whenever one checklist item is completed

Campaign Brief Saved

↓

Recheck Validation

↓

Remaining Items

↓

Update Checklist

When all required validations pass

Resume Go Live

↓

CampaignLifecycleService.goLive()

The user should not have to click "Go Live" again.

---

# **11\. Chat UI Contract**

Introduce a new response type

interface CampaignValidationChecklist {

title:string;

action:string;

items:ChecklistItem\[\];

autoResume:boolean;

}

Example UI

Campaign Setup Required

✓ Campaign Name

✓ Objective

☐ Campaign Brief

☐ Products

☐ Budget

\[Continue Setup\]

The checklist should update dynamically after each completed action.

---

# **12\. Cursor Tasks**

### **Task 1**

Create

campaign-list-validation-map.ts

Requirements

* Map existing backend validation exceptions.  
* Do not change validators.  
* Return AI-readable validation objects.

---

### **Task 2**

Update Response Builder

Requirements

* Detect Campaign List validation responses.  
* Render a checklist instead of an error message.  
* Support progress updates.

---

### **Task 3**

Update AI Orchestrator

Requirements

* Pause execution on Campaign List validation failures.  
* Store pending action.  
* Resume automatically after all blocking items are complete.

---

# **13\. Deliverables**

After implementation:

* Existing backend validators remain unchanged.  
* Campaign List actions no longer return raw validation errors.  
* Validation failures become interactive chat checklists.  
* Existing execution plans are resumed automatically.  
* No changes to the AI Core or Function Registry are required.

---

## **One improvement specific to Campaign List**

One thing I would add specifically for **Campaign List** is a **Validation Capability per Action**, rather than one generic validation mapper.

For example:

CampaignListCapabilities \= {  
  GO\_LIVE: {  
    validator: validateGoLive,  
    mapper: mapGoLiveErrors,  
    repairActions: \[...\]  
  },  
  PAUSE: {  
    validator: validatePause,  
    mapper: mapPauseErrors,  
    repairActions: \[...\]  
  },  
  ARCHIVE: {  
    validator: validateArchive,  
    mapper: mapArchiveErrors,  
    repairActions: \[...\]  
  }  
}

This keeps the implementation tightly scoped to Campaign List and makes it easy to extend. When you later implement **Campaign Details**, **Create Campaign**, or **Add Product**, each sub-module can have its own validation capability without introducing platform-wide complexity or modifying the existing architecture.

