Absolutely. I actually think the **Campaign List** module will benefit even more from this because it's the primary discovery screen inside Universal Campaign Engine, and most user interactions are **read-heavy** rather than **write-heavy**.

This Part 6 document should become the LLM's decision matrix before selecting any function.

---

# **Universal Campaign Engine**

# **Part 6 – Campaign List Intent Mapping & Tool Selection Matrix**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** AI Engineers (Gemini \+ Cursor \+ NestJS)

---

# **Objective**

This document defines how the LLM should interpret natural language requests related to the **Campaign List** submodule.

Every request should resolve into:

User Query

↓

Intent Detection

↓

Campaign Resolution

↓

Tool Selection

↓

Backend Response

↓

UI Renderer

The LLM should **never answer campaign-specific questions from memory**. If campaign data is required, the appropriate retrieval tool must always be called.

---

# **Intent Categories**

| Intent Category | Purpose |
| ----- | ----- |
| Read | Retrieve campaign information |
| Write | Update campaign |
| Validation | Verify action eligibility |
| Navigation | Open campaign or workflow |
| Summary | Summarize campaign |
| Search | Find campaigns |
| Analytics | Campaign metrics |

---

# **1\. Campaign Overview**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| What's the status of my Summer Sale campaign? | View Campaign | `getCampaignOverview()` | Campaign Summary Card |
| Show campaign details | View Campaign | `getCampaignOverview()` | Campaign Detail Card |
| Tell me about XYZ campaign | View Campaign | `getCampaignOverview()` | Campaign Detail Card |
| Show campaign information | View Campaign | `getCampaignOverview()` | Campaign Detail Card |
| Give me campaign summary | Campaign Summary | `getCampaignOverview()` | Summary Card |

---

# **2\. Campaign Status**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Is my campaign live? | View Campaign Status | `getCampaignStatus()` | Status Card |
| What's the current status? | View Campaign Status | `getCampaignStatus()` | Status Card |
| Which stage is my campaign in? | View Campaign Stage | `getCampaignStage()` | Progress Card |
| Is this campaign still a draft? | View Campaign Status | `getCampaignStatus()` | Status Card |

---

# **3\. Campaign Checklist**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Why can't I publish this campaign? | Validation | `getCampaignChecklist()` | Checklist Card |
| What's missing? | Campaign Checklist | `getCampaignChecklist()` | Checklist Card |
| Show pending checklist items | Campaign Checklist | `getCampaignChecklist()` | Checklist Card |
| What do I need to complete? | Campaign Checklist | `getCampaignChecklist()` | Checklist Card |

---

# **4\. Publish Campaign**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Publish campaign | Publish Campaign | `validatePublishCampaign()` → `publishCampaign()` | Confirmation Card |
| Make campaign live | Publish Campaign | `validatePublishCampaign()` → `publishCampaign()` | Success Card |
| Launch campaign | Publish Campaign | `validatePublishCampaign()` → `publishCampaign()` | Success Card |
| Go live | Publish Campaign | `validatePublishCampaign()` → `publishCampaign()` | Success Card |

---

# **5\. Pause / Resume Campaign**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Pause campaign | Pause Campaign | `pauseCampaign()` | Success Card |
| Resume campaign | Resume Campaign | `resumeCampaign()` | Success Card |
| Stop campaign temporarily | Pause Campaign | `pauseCampaign()` | Success Card |

---

# **6\. Campaign Products**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Show campaign products | View Products | `getCampaignProducts()` | Product List Card |
| Which products are added? | View Products | `getCampaignProducts()` | Product Table |
| Show products in this campaign | View Products | `getCampaignProducts()` | Product Table |
| How many products are included? | View Products | `getCampaignProducts()` | Product Summary Card |

---

# **7\. Campaign Brief**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Show campaign brief | View Brief | `getCampaignBrief()` | Brief Card |
| Explain campaign brief | View Brief | `getCampaignBrief()` | Rich Text Card |
| What instructions are given? | View Brief | `getCampaignBrief()` | Rich Text Card |
| Show creator guidelines | View Brief | `getCampaignBrief()` | Brief Card |

---

# **8\. Invited Creators**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| How many creators are invited? | View Invites | `getCampaignInvites()` | Statistics Card |
| Show invited creators | View Invites | `getCampaignInvites()` | Table |
| Show accepted creators | View Invites | `getCampaignInvites()` | Table |
| Show rejected creators | View Invites | `getCampaignInvites()` | Table |
| Who joined this campaign? | View Invites | `getCampaignInvites()` | Creator Table |

---

# **9\. Campaign Metrics**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Show campaign performance | View Analytics | `getCampaignAnalytics()` | Dashboard Card |
| How many creators accepted? | View Analytics | `getCampaignAnalytics()` | KPI Card |
| What's the campaign progress? | View Analytics | `getCampaignAnalytics()` | Dashboard Card |
| Show campaign statistics | View Analytics | `getCampaignAnalytics()` | Dashboard Card |

---

# **10\. Campaign Search**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Show all draft campaigns | Search Campaigns | `listCampaigns(status="DRAFT")` | Table |
| Show active campaigns | Search Campaigns | `listCampaigns(status="LIVE")` | Table |
| Show completed campaigns | Search Campaigns | `listCampaigns(status="COMPLETED")` | Table |
| Find campaigns by name | Search Campaigns | `searchCampaigns()` | Table |
| Show campaigns created this month | Search Campaigns | `searchCampaigns()` | Table |

---

# **11\. Campaign Actions**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Duplicate this campaign | Duplicate Campaign | `duplicateCampaign()` | Confirmation Card |
| Archive campaign | Archive Campaign | `archiveCampaign()` | Confirmation Card |
| Delete campaign | Delete Campaign | `validateDeleteCampaign()` → `deleteCampaign()` | Confirmation Card |
| Rename campaign | Rename Campaign | `renameCampaign()` | Inline Form |

---

# **12\. Pending Actions**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| What should I do next? | Pending Actions | `getCampaignChecklist()` | Checklist Card |
| What's blocking this campaign? | Pending Actions | `getCampaignChecklist()` | Validation Card |
| Why can't I continue? | Pending Actions | `getCampaignChecklist()` | Validation Card |
| Show pending work | Pending Actions | `getCampaignChecklist()` | Checklist Card |

---

# **13\. Campaign Summary**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Summarize this campaign | Campaign Summary | `getCampaignOverview()` \+ `getCampaignChecklist()` | Summary Card |
| Give me campaign overview | Campaign Summary | `getCampaignOverview()` | Summary Card |
| Explain this campaign | Campaign Summary | `getCampaignOverview()` | Summary Card |
| What's happening in this campaign? | Campaign Summary | `getCampaignOverview()` \+ `getCampaignStatus()` | Summary Card |

---

# **14\. Validation Intents**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Can I publish this campaign? | Validate Publish | `validatePublishCampaign()` | Validation Card |
| Can I delete this campaign? | Validate Delete | `validateDeleteCampaign()` | Validation Card |
| Is this campaign ready? | Validate Readiness | `validatePublishCampaign()` | Validation Card |
| Why is publishing blocked? | Explain Blocker | `getCampaignChecklist()` | Validation Card |

---

# **UI Rendering Rules**

| Response Type | UI |
| ----- | ----- |
| Campaign overview | Campaign Summary Card |
| Campaign details | Campaign Detail Card |
| Campaign status | Status Card |
| Campaign stage | Progress Card |
| Checklist | Checklist Card |
| Products | Product Table / Product List Card |
| Brief | Rich Text Card |
| Invited creators | Creator Table |
| Analytics | Dashboard Card |
| Multiple campaigns | Table |
| Success | Success Card |
| Confirmation | Confirmation Card |
| Validation | Validation Card |
| User input required | Inline Form |
| Redirect required | Redirect Card |
| Empty results | Empty State Card |

---

# **LLM Rules**

The system prompt for the Campaign List module should include these rules:

1. Never answer campaign-specific questions from memory or partial conversation context.  
2. Every **Read** intent must invoke the appropriate retrieval function before generating a response.  
3. Every **Write** intent that changes campaign state must invoke the corresponding validation function first, if one exists.  
4. Every **Summary** request should fetch the latest campaign overview and any additional context (status, checklist, metrics) required to produce an accurate summary.  
5. When multiple aspects of a campaign are requested (for example, "Show me the status, products, and pending checklist"), invoke all required retrieval tools and synthesize the results into a single response.  
6. Always render structured responses using the UI component defined in this matrix instead of plain text whenever structured data is available.  
7. If the user references a campaign implicitly (e.g., "this campaign", "it", "the current one"), resolve the campaign using the active conversation context before selecting tools.  
8. If no campaign can be resolved confidently, ask the user to identify the campaign instead of guessing.

---

## **Developer Recommendation**

This document should not just live as documentation—it should become a **configuration file** (JSON/YAML/TypeScript registry) consumed by the Chat Engine.

That allows the AI Orchestrator to dynamically determine:

User Query  
      ↓  
Intent Classifier  
      ↓  
Intent Registry (this document)  
      ↓  
Tool Selection  
      ↓  
UI Renderer Selection  
      ↓  
Gemini Function Calling

Making this data-driven instead of prompt-only will improve consistency, make new intents easy to add, and reduce prompt complexity as your platform grows.

