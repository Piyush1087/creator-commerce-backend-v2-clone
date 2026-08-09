# **Brand Settings Module**

# **Part 5 – Validation Recovery & Guided Resolution**

**Version:** 1.0  
**Status:** Production Ready  
**Audience:** Backend Developer (NestJS \+ Gemini \+ Cursor)

---

# **1\. Objective**

This document defines how the Chat Engine should handle **validation failures, incomplete configurations, permission restrictions, and execution blockers** within the **Brand Settings** module.

This document covers **all Brand Settings submodules**:

* General  
* Finance  
* Integrations

The goal is to ensure that whenever a backend validation blocks an action, the Chat Engine guides the user to resolve the issue instead of simply displaying an error.

The AI should either:

* Allow the user to complete the missing information directly within the Chat UI, or  
* Redirect the user to the relevant Settings page if the action requires the full UI.

Once the issue is resolved, the Chat Engine should automatically retry the original action whenever possible.

---

# **2\. Validation Recovery Architecture**

User

↓

Chat Engine

↓

Gemini

↓

Brand Settings Function

↓

Backend Validation

↓

Validation Mapper

↓

Recovery Capability Registry

↓

Recovery UI

↓

Validation Passed

↓

Resume Original Action

↓

Updated Response

The existing backend validations remain unchanged.

Only the presentation layer changes.

---

# **3\. Brand Settings Validation Mapper**

Create

src/modules/settings/

brand-settings-validation-map.ts

Responsibilities

* Convert backend validation errors into AI-readable validation codes.  
* Preserve existing backend validations.  
* Remove raw backend error messages from the Chat UI.

Example

| Backend Exception | Validation Code |
| ----- | ----- |
| InvalidWebsiteException | INVALID\_WEBSITE |
| MissingGSTException | GST\_REQUIRED |
| InvalidPANException | INVALID\_PAN |
| TokenExpiredException | TOKEN\_EXPIRED |
| MissingPermissionException | PERMISSION\_REQUIRED |

---

# **4\. Recovery Capability Registry**

Create

brand-settings-recovery-capability.ts

Every validation registers how it should be resolved.

interface RecoveryCapability{

validationCode:string;

recoveryMode:"CHAT"|"REDIRECT";

component:string;

redirectRoute:string|null;

autoResume:boolean;

}

Example

\[  
{  
validationCode:"INVALID\_WEBSITE",

recoveryMode:"CHAT",

component:"WebsiteEditor",

autoResume:true  
},  
{  
validationCode:"GST\_REQUIRED",

recoveryMode:"CHAT",

component:"GSTEditor",

autoResume:true  
},  
{  
validationCode:"TOKEN\_EXPIRED",

recoveryMode:"CHAT",

component:"ReconnectInstagram",

autoResume:true  
},  
{  
validationCode:"DELETE\_RESTRICTED",

recoveryMode:"REDIRECT",

redirectRoute:"/settings/integrations",

autoResume:false  
}  
\]

The AI must never determine recovery behavior itself.

Recovery behavior is always defined by this registry.

---

# **5\. General Module Validations**

The following validations should be supported.

| Validation | Recovery |
| ----- | ----- |
| Company Name Required | Inline Company Name Editor |
| Invalid Website URL | Website Editor |
| Invalid Email | Email Editor |
| Logo Missing | Upload Logo Component |
| Brand Description Missing | Description Editor |

Example

User

> Update our website

Backend

INVALID\_WEBSITE

Chat

The website URL is invalid.

Please enter a valid website.

\[Website Input\]

\[Save\]

After saving

Refresh Context

↓

Retry Original Action

---

# **6\. Finance Module Validations**

Supported validations

| Validation | Recovery |
| ----- | ----- |
| GST Missing | GST Editor |
| Invalid GST | GST Editor |
| PAN Missing | PAN Editor |
| Invalid PAN | PAN Editor |
| Billing Email Missing | Billing Email Editor |
| Bank Details Missing | Bank Details Form |
| Invalid IFSC | Bank Details Form |

Example

User

> Enable invoices

Backend

GST\_REQUIRED

Chat

Invoices require a GST number.

Please complete it below.

\[GST Input\]

\[Save GST\]

After saving

Refresh Finance Context

↓

Resume Original Request

---

# **7\. Integration Module Validations**

Follow the updated Integration Change Document.

Supported validations

| Validation | Recovery |
| ----- | ----- |
| Token Expired | Reconnect Card |
| OAuth Failed | Retry OAuth |
| Permission Missing | Permission Upgrade Card |
| Partial Scope | Scope Upgrade Card |
| Identity Conflict | Identity Resolution Card |
| Popup Closed | Retry OAuth |
| Provider Already Connected | Show Connected Account |
| Active Campaign Dependency | Redirect |
| Delete Restricted | Redirect |

Example

User

> Connect Instagram

Backend

TOKEN\_EXPIRED

Chat

Your Instagram connection has expired.

Reconnect to continue.

\[Reconnect Instagram\]

---

# **8\. Inline Recovery Components**

The Chat Engine should reuse existing frontend components.

Supported components

### **General**

Company Name Editor

Website Editor

Email Editor

Logo Upload

Description Editor

---

### **Finance**

GST Editor

PAN Editor

Billing Email Editor

Bank Details Form

---

### **Integrations**

OAuth Card

Reconnect Card

Permission Card

Identity Conflict Card

Provider Status Card

No new frontend components should be developed unless absolutely necessary.

---

# **9\. Redirect Recovery**

Some actions cannot be completed inside the Chat Engine.

Example

Delete Integration

↓

Backend

↓

DELETE\_RESTRICTED

↓

Chat

↓

This integration is currently being used by active workflows.

\[Open Integration Settings\]

The redirect button should deep-link to the correct Settings page.

---

# **10\. Pending Action Manager**

Create

interface PendingBrandSettingsAction{

submodule:string;

entity:string;

action:string;

validationCode:string;

autoResume:boolean;

}

Whenever validation blocks execution, store the original request.

---

# **11\. Automatic Resume**

If `autoResume=true`

Execution becomes

Original Request

↓

Validation

↓

Recovery Component

↓

User Completes Input

↓

Save

↓

Refresh Context

↓

Retry Original Action

↓

Success

The user should never have to repeat the original request.

---

# **12\. Response Builder**

Update

brand-settings-response-builder.ts

Support

### **General**

* Company Card  
* Website Card  
* Logo Card  
* Email Card

---

### **Finance**

* GST Card  
* PAN Card  
* Billing Card  
* Bank Card

---

### **Integrations**

* OAuth Card  
* Permission Card  
* Provider Card  
* Identity Conflict Card  
* Recovery Card

---

### **Shared**

* Success Card  
* Error Card  
* Confirmation Card  
* Redirect Card

---

# **13\. AI Context Refresh**

After successful recovery

Refresh

Updated Submodule

↓

Brand Settings Context

↓

Conversation State

↓

Gemini Prompt

↓

Continue Conversation

Never continue using stale context.

---

# **14\. Cursor Tasks**

## **Task A — Validation Mapper**

Generate

brand-settings-validation-map.ts

Requirements

* Map backend exceptions.  
* Return normalized validation codes.  
* Production-ready TypeScript.

---

## **Task B — Recovery Capability Registry**

Generate

brand-settings-recovery-capability.ts

Requirements

* Register recovery strategies.  
* Support CHAT and REDIRECT recovery.  
* Support automatic action resumption.

---

## **Task C — Response Builder**

Modify

brand-settings-response-builder.ts

Requirements

* Render inline recovery forms.  
* Render provider recovery cards.  
* Render redirect buttons.  
* Reuse existing frontend components.

---

## **Task D — AI Orchestrator**

Modify

ai-orchestrator.service.ts

Requirements

* Pause execution on validation failure.  
* Store pending action.  
* Trigger recovery flow.  
* Resume original action after successful recovery.

---

## **Task E — Conversation Manager**

Modify

conversation-manager.ts

Requirements

* Persist pending Brand Settings action.  
* Clear pending action after successful recovery.  
* Maintain active submodule context.

---

# **15\. Folder Structure**

src/modules/settings/

├── brand-settings-validation-map.ts

├── brand-settings-recovery-capability.ts

├── brand-settings-response-builder.ts

├── general/

├── finance/

└── integrations/

---

# **16\. Deliverables**

### **New Files**

brand-settings-validation-map.ts

brand-settings-recovery-capability.ts

### **Modified Files**

brand-settings-response-builder.ts

conversation-manager.ts

ai-orchestrator.service.ts

---

# **17\. Functional Capabilities**

After implementation:

* Backend validation errors are converted into structured AI recovery flows.  
* Users can resolve missing General and Finance configuration directly inside the Chat Engine wherever feasible.  
* Integration issues (OAuth, permissions, token expiry, identity conflicts) are surfaced using guided recovery components.  
* Existing frontend forms and components are reused inside the Chat Engine.  
* Deep-link redirects are available for operations that require the full Settings interface.  
* Original user actions automatically resume after successful recovery.  
* Future Brand Settings tabs inherit the same validation framework by registering new validation mappings and recovery capabilities.

---

# **18\. Developer Notes**

* **Do not modify existing backend validation logic.** The Chat Engine should consume existing validation responses and convert them into guided recovery experiences.  
* The **Brand Settings Validation Mapper** is responsible only for normalizing backend errors into AI validation codes.  
* The **Recovery Capability Registry** is the single source of truth that determines whether a validation is resolved inline or via a redirect.  
* Whenever possible, **reuse existing General, Finance, and Integration frontend components** inside the chat. Avoid building duplicate forms or dialogs.  
* After every successful recovery, refresh only the affected submodule context and rebuild the `BrandSettingsContext` before continuing execution.  
* This framework should remain completely extensible. New Brand Settings tabs (Notifications, Security, Team Members, Shipping, Billing, etc.) should integrate by registering their validations and recovery capabilities without requiring changes to the AI orchestration layer.

