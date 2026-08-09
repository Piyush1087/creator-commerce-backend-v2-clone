

# **Collaboration Module**

# **Part 6 – Intent Mapping & Tool Selection Matrix**

## **Objective**

This document defines how the LLM should interpret user queries for the **Collaboration Module**.

Every user request should resolve into:

User Query

↓

Intent

↓

Entity Resolution

↓

Tool Selection

↓

Backend Response

↓

UI Renderer

The LLM should **never answer from memory** for collaboration-specific data.

If an intent requires backend data, the appropriate retrieval tool must always be called.

---

# **Intent Categories**

| Intent Category | Purpose |
| ----- | ----- |
| Read | Fetch information |
| Write | Modify workflow |
| Validation | Check if an action can proceed |
| Navigation | Redirect user |
| Summary | Summarize collaboration |
| Analytics | Aggregate information |

---

# **1\. Collaboration Status**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| What's the status of XYZ collaboration? | View Collaboration Status | `getCollaborationOverview()` | Status Card |
| Show me collaboration details | View Collaboration Details | `getCollaborationOverview()` | Detail Card |
| Where is this collaboration stuck? | View Current Stage | `getCurrentStage()` | Timeline Card |
| What's pending? | View Pending Action | `getPendingActions()` | Checklist Card |
| Who has the next action? | View Workflow Owner | `getPendingActions()` | Timeline Card |

---

# **2\. Quote**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| What quote did the creator send? | View Quote | `getQuoteDetails()` | Quote Card |
| Show me the quoted amount | View Quote | `getQuoteDetails()` | Quote Card |
| Has the creator sent a quote? | View Quote Status | `getQuoteDetails()` | Status Card |
| Accept the quote | Accept Quote | `acceptQuote()` | Success Card |
| Reject the quote | Reject Quote | `rejectQuote()` | Confirmation Card |
| Why can't I accept the quote? | Validate Quote | `validateQuoteAction()` | Validation Card |

---

# **3\. Shipment**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Has the product been shipped? | View Shipment | `getShipmentDetails()` | Shipment Card |
| Show tracking URL | View Shipment | `getShipmentDetails()` | Shipment Card |
| What's the tracking number? | View Shipment | `getShipmentDetails()` | Shipment Card |
| Update tracking URL | Update Shipment | `updateShipmentTracking()` | Inline Form |
| Mark as shipped | Ship Product | `markShipment()` | Success Card |
| Why can't I mark it shipped? | Validate Shipment | `validateShipmentAction()` | Validation Card |

---

# **4\. Creator Content**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Show content submitted by XYZ | View Content | `getContentSubmission()` | Content Card |
| Open creator content | View Content | `getContentSubmission()` | Media Card |
| Has the creator uploaded content? | View Content Status | `getContentSubmission()` | Status Card |
| Approve content | Approve Content | `approveContent()` | Success Card |
| Reject content | Reject Content | `rejectContent()` | Confirmation Card |
| Why can't I reject content? | Validate Content | `validateContentAction()` | Validation Card |

---

# **5\. Deliverables**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Show campaign deliverables | View Deliverables | `getDeliverables()` | Table |
| Which deliverables are pending? | View Deliverables | `getDeliverables()` | Checklist |
| Has every deliverable been completed? | View Completion | `getDeliverables()` | Progress Card |

---

# **6\. Timeline**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Show collaboration timeline | View Timeline | `getTimeline()` | Timeline |
| What happened so far? | View Timeline | `getTimeline()` | Timeline |
| Show activity history | View Timeline | `getTimeline()` | Timeline |

---

# **7\. Creator Information**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Who is the creator? | View Creator | `getCreatorProfile()` | Creator Card |
| Show creator profile | View Creator | `getCreatorProfile()` | Creator Card |
| Show creator Instagram | View Creator | `getCreatorProfile()` | Creator Card |

---

# **8\. Messages & Collaboration Conversation**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Show conversation with creator | View Conversation | `getConversationHistory()` | Chat View |
| Show latest messages | View Conversation | `getConversationHistory()` | Chat View |
| What did the creator say? | View Conversation | `getConversationHistory()` | Chat View |

---

# **9\. Pending Actions**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| What should I do next? | View Pending Action | `getPendingActions()` | Checklist |
| Show pending work | View Pending Action | `getPendingActions()` | Checklist |
| What's blocking this collaboration? | View Blockers | `getPendingActions()` | Validation Card |

---

# **10\. Workflow Summary**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Summarize this collaboration | Collaboration Summary | `getCollaborationOverview()` \+ `getTimeline()` | Summary Card |
| Give me a quick summary | Collaboration Summary | `getCollaborationOverview()` \+ `getPendingActions()` | Summary Card |
| Explain what's happening | Collaboration Summary | `getCollaborationOverview()` \+ `getPendingActions()` | Summary Card |

---

# **11\. Search & Listing**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Show all pending collaborations | List Collaborations | `listCollaborations(status="PENDING")` | Table |
| Show collaborations waiting for shipment | Filter Collaborations | `listCollaborations(stage="SHIPMENT")` | Table |
| Show collaborations waiting for content | Filter Collaborations | `listCollaborations(stage="CONTENT")` | Table |
| Show rejected collaborations | Filter Collaborations | `listCollaborations(status="REJECTED")` | Table |

---

# **12\. Analytics**

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| How many collaborations are pending? | Collaboration Analytics | `getCollaborationAnalytics()` | KPI Card |
| How many creators are waiting? | Collaboration Analytics | `getCollaborationAnalytics()` | KPI Card |
| Show collaboration statistics | Collaboration Analytics | `getCollaborationAnalytics()` | Dashboard Card |

---

# **13\. Validation Intents**

These intents should **always call validation tools before executing write operations**.

| Sample Query | Intent | Tool(s) | UI |
| ----- | ----- | ----- | ----- |
| Can I approve this content? | Validate Action | `validateContentAction()` | Validation Card |
| Can I ship this product? | Validate Action | `validateShipmentAction()` | Validation Card |
| Can I accept this quote? | Validate Action | `validateQuoteAction()` | Validation Card |
| Why can't I proceed? | Explain Blocker | `getPendingActions()` | Validation Card |

---

# **UI Rendering Rules**

| Response Type | Preferred UI |
| ----- | ----- |
| Single object (Quote, Shipment, Creator, Content) | Card |
| Multiple records | Table |
| Sequential events | Timeline |
| Pending tasks | Checklist |
| Media | Media Card |
| Long conversation | Chat View |
| Aggregated metrics | KPI / Dashboard Card |
| Success response | Success Card |
| Confirmation required | Confirmation Card |
| Validation error | Validation Card |
| User input required | Inline Form |
| Navigation required | Redirect Card |
| No matching data | Empty State Card |

---

# **LLM Rules**

The system prompt should include these mandatory rules:

1. Never answer collaboration-specific questions from memory.  
2. For every **Read** intent, call the appropriate retrieval tool before responding.  
3. For every **Write** intent, validate the action before execution if a validation tool exists.  
4. For every **Summary** intent, retrieve the latest collaboration state instead of relying on previously injected context.  
5. If multiple entities are requested (e.g., "Show me the quote and shipment status"), execute all required retrieval tools before generating a combined response.  
6. Always render responses using the UI component defined in this matrix instead of falling back to plain text when structured data is available.

---

I recommend adopting this as a **platform-wide standard**. Every module (Campaigns, Collaboration, Brand Settings, Wallet, Brand Center, etc.) should have its own Part 6 Intent Mapping document. That gives the LLM a deterministic mapping from natural language → intent → tool → UI, which significantly improves function-calling reliability without changing the backend architecture.

