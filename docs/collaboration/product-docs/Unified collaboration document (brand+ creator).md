# backend schema

\-- \--- 1\. GLOBAL ENUMS \---  
\-- Updated to align Stage Names with Campaign Module (Item B)  
CREATE TYPE collaboration\_stage AS ENUM (  
  'STAGE\_1\_NEGOTIATION',  
  'STAGE\_2\_SECUREMENT',  
  'STAGE\_3\_LOGISTICS',  
  'STAGE\_4\_CONTENT\_REVIEW',  
  'STAGE\_5\_PUBLISHING',  
  'STAGE\_6\_FEEDBACK\_SYNC'  
);

CREATE TYPE payout\_mode AS ENUM ('ESCROW', 'MANUAL', 'BARTER');

\-- Updated to align Industry Verticals with Campaign Module (Item A)  
CREATE TYPE industry\_type AS ENUM (  
  'D2C\_ECOMMERCE',   
  'HEALTHCARE\_CLINICAL',   
  'AI\_SAAS',   
  'OFFLINE\_EXPERIENCES'  
);

CREATE TYPE fulfillment\_issue\_type AS ENUM ('DAMAGED', 'INVALID\_CODE', 'LOST', 'TECH\_ERROR', 'NO\_SHOW');

\-- \--- 2\. CORE COLLABORATION TABLE \---  
CREATE TABLE collaborations (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  brand\_id UUID NOT NULL,  
  creator\_id UUID NOT NULL,  
  campaign\_id UUID NOT NULL,  
  brief\_id UUID NOT NULL,  
    
  \-- Workflow Steering  
  current\_stage collaboration\_stage DEFAULT 'STAGE\_1\_NEGOTIATION',  
  payout\_mode payout\_mode DEFAULT 'ESCROW',  
  industry industry\_type NOT NULL,  
    
  \-- Logic Gate Counters (Hard-Stops)  
  negotiation\_round INT DEFAULT 0,      \-- Max 2  
  fulfillment\_issue\_count INT DEFAULT 0, \-- Max 2 (Stage 3\)  
  revision\_count INT DEFAULT 0,          \-- Max 2 (Stage 4\)  
    
  \-- Chat & System Metadata  
  unread\_count INT DEFAULT 0,  
  last\_message\_snippet TEXT,  
  last\_message\_at TIMESTAMP,  
  stage\_updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,  
    
  \-- Global Status Flags  
  is\_paused BOOLEAN DEFAULT FALSE,  
  is\_terminated BOOLEAN DEFAULT FALSE,  
  created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,  
  updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP  
);

\-- \--- 3\. COMMERCIALS & NEGOTIATION \---  
CREATE TABLE collaboration\_commercials (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  collaboration\_id UUID REFERENCES collaborations(id) ON DELETE CASCADE,  
    
  \-- Negotiation History  
  initial\_quote DECIMAL(12, 2),        \-- Original quote from Creator  
  brand\_counter\_offer DECIMAL(12, 2),  \-- The one-time Brand counter  
  final\_quote DECIMAL(12, 2),          \-- Final agreed total  
  product\_retail\_value DECIMAL(12, 2), \-- Complimentary product value  
  is\_final\_offer BOOLEAN DEFAULT FALSE,  
    
  \-- Payment Split  
  advance\_30\_amount DECIMAL(12, 2),  
  balance\_70\_amount DECIMAL(12, 2),  
    
  \-- Securement Proofs  
  creator\_bank\_details\_id UUID,          
  escrow\_vault\_id VARCHAR(255),  
  escrow\_status VARCHAR(50),           \-- AWAITING\_FUNDS, FUNDED, etc.  
  advance\_receipt\_url TEXT,            \-- For Manual Mode  
  final\_receipt\_url TEXT               \-- For Manual Mode  
);

\-- \--- 4\. LOGISTICS & FULFILLMENT \---  
CREATE TABLE collaboration\_logistics (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  collaboration\_id UUID REFERENCES collaborations(id) ON DELETE CASCADE,  
    
  \-- Multi-Industry Tracking (Item C: Kept Intact as per Unified Collaboration Core)  
  tracking\_id VARCHAR(255),            \-- D2C  
  courier\_name VARCHAR(100),           \-- D2C  
  digital\_access\_credentials TEXT,     \-- SaaS Keys/Links  
  redemption\_code VARCHAR(100),        \-- Healthcare/Offline  
    
  \-- Status  
  is\_received\_confirmed BOOLEAN DEFAULT FALSE,  
  confirmed\_at TIMESTAMP,  
  last\_reported\_issue fulfillment\_issue\_type,  
  issue\_description TEXT  
);

\-- \--- 5\. PRODUCTION HUB \---  
CREATE TABLE collaboration\_media (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  collaboration\_id UUID REFERENCES collaborations(id) ON DELETE CASCADE,  
    
  phase VARCHAR(50),                   \-- 'SCRIPTING' or 'MEDIA'  
  version\_number INT DEFAULT 1,        \-- Tracks Round 1 vs Round 2  
  media\_url TEXT NOT NULL,  
  deliverable\_type VARCHAR(50),        \-- Reel, Story, etc.  
    
  \-- Brand Review  
  status VARCHAR(20) DEFAULT 'PENDING',-- APPROVED, REJECTED  
  brand\_feedback TEXT,  
  auto\_approval\_deadline TIMESTAMP     \-- 72-hour Hard Stop clock  
);

\-- \--- 6\. FINALIZATION & ARCHIVAL \---  
CREATE TABLE collaboration\_finalization (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  collaboration\_id UUID REFERENCES collaborations(id) ON DELETE CASCADE,  
    
  \-- Compliance Gate  
  live\_post\_url TEXT,  
  partnership\_ad\_code VARCHAR(100),  
  is\_compliance\_verified BOOLEAN DEFAULT FALSE,  
    
  \-- Double-Blind Reviews  
  creator\_rating INT CHECK (creator\_rating BETWEEN 1 AND 5),  
  creator\_review\_text TEXT,  
  brand\_rating INT CHECK (brand\_rating BETWEEN 1 AND 5),  
  brand\_review\_text TEXT,  
  reviews\_visible BOOLEAN DEFAULT FALSE  
);

# unified zod validation

### **3\. Unified Master Zod Structure (The Source of Truth)**

This schema should live in a shared `types/` or `validation/` folder and be used by the backend API to govern the entire collaboration.

// Location: shared/validation/collaboration.master.ts  
import { z } from 'zod';

// \--- Shared Constants & Enums \---  
export const WorkflowStageEnum \= z.enum(\[  
  'NEGOTIATION', 'SECUREMENT', 'LOGISTICS', 'PRODUCTION', 'POSTING', 'ARCHIVAL', 'TERMINATED'  
\]);

export const PayoutModeEnum \= z.enum(\['ESCROW', 'MANUAL', 'BARTER'\]);

// \--- The Master Engine \---  
export const MasterCollabSchema \= z.object({  
  id: z.string().uuid(),  
  stage: WorkflowStageEnum,  
  payout\_mode: PayoutModeEnum,  
    
  // STAGE 1 & 2: Financial Integrity  
  commercials: z.object({  
    total\_quote: z.number().positive(),  
    advance\_30: z.number(),  
    balance\_70: z.number(),  
    round\_count: z.number().max(2), // Total rounds allowed across both parties  
  }).refine((data) \=\> Math.abs((data.advance\_30 \+ data.balance\_70) \- data.total\_quote) \< 0.01, {  
    message: "Financial Split Mismatch: 30% \+ 70% must equal Total Quote",  
    path: \['total\_quote'\]  
  }),

  // STAGE 3: Logistics (Two-Strike Deadlock)  
  logistics: z.object({  
    fulfillment\_issue\_count: z.number().max(2),  
    is\_received\_confirmed: z.boolean(),  
  }).superRefine((data, ctx) \=\> {  
    if (data.fulfillment\_issue\_count \>= 2 && \!data.is\_received\_confirmed) {  
      ctx.addIssue({  
        code: z.ZodIssueCode.custom,  
        message: "LOGISTICS\_DEADLOCK: Two delivery/access attempts failed. Terminal state.",  
      });  
    }  
  }),

  // STAGE 4: Production (Two-Revision Hard-Stop)  
  production: z.object({  
    revision\_count: z.number().max(2),  
    auto\_approval\_deadline: z.date(),  
    status: z.enum(\['PENDING', 'APPROVED', 'REJECTED'\]),  
  }).superRefine((data, ctx) \=\> {  
    if (data.revision\_count \>= 2 && data.status \=== 'REJECTED') {  
      ctx.addIssue({  
        code: z.ZodIssueCode.custom,  
        message: "PRODUCTION\_HARD\_STOP: Final revision rejected. Must terminate.",  
      });  
    }  
  }),

  // STAGE 5: Compliance Gate  
  compliance: z.object({  
    is\_link\_verified: z.boolean(),  
    is\_70\_payout\_released: z.boolean(),  
  }).refine(data \=\> \!(data.is\_70\_payout\_released && \!data.is\_link\_verified), {  
    message: "Final payout is locked until content compliance is verified."  
  })  
});

# Tab 4

// Location: shared/validation/collaboration.master.ts  
import { z } from 'zod';

// \--- Shared Constants & Enums \---  
export const WorkflowStageEnum \= z.enum(\[  
  'NEGOTIATION', 'SECUREMENT', 'LOGISTICS', 'PRODUCTION', 'POSTING', 'ARCHIVAL', 'TERMINATED'  
\]);

export const PayoutModeEnum \= z.enum(\['ESCROW', 'MANUAL', 'BARTER'\]);

export const IndustryTypeEnum \= z.enum(\['D2C', 'SAAS', 'HEALTHCARE'\]);

// \--- The Master Engine \---  
export const MasterCollabSchema \= z.object({  
  id: z.string().uuid(),  
  brand\_id: z.string().uuid(),  
  creator\_id: z.string().uuid(),  
  campaign\_id: z.string().uuid(),  
  brief\_id: z.string().uuid(),  
  stage: WorkflowStageEnum,  
  payout\_mode: PayoutModeEnum,  
  industry: IndustryTypeEnum,

  // STAGE 1 & 2: Financial Integrity & Commercials  
  commercials: z.object({  
    initial\_quote: z.number().nonnegative().optional(),  
    brand\_counter\_offer: z.number().nonnegative().optional(),  
    final\_quote: z.number().nonnegative().optional(),  
    total\_quote: z.number().nonnegative(), // Changed to nonnegative to allow 0 for BARTER mode  
    advance\_30: z.number().nonnegative(),  
    balance\_70: z.number().nonnegative(),  
    round\_count: z.number().int().min(0).max(2), // Max 2 negotiation rounds total across parties  
    is\_final\_offer: z.boolean().default(false),  
    creator\_bank\_details\_id: z.string().uuid().optional().nullable(),  
  }).refine((data) \=\> Math.abs((data.advance\_30 \+ data.balance\_70) \- data.total\_quote) \< 0.01, {  
    message: "Financial Split Mismatch: 30% \+ 70% must equal Total Quote",  
    path: \['total\_quote'\]  
  }),

  // STAGE 3: Logistics (Two-Strike Deadlock)  
  logistics: z.object({  
    fulfillment\_issue\_count: z.number().int().min(0).max(2),  
    is\_received\_confirmed: z.boolean(),  
    tracking\_id: z.string().trim().min(1, "Tracking ID cannot be empty").optional().nullable(),  
    courier\_name: z.string().optional().nullable(),  
    digital\_access\_credentials: z.string().optional().nullable(),  
    redemption\_code: z.string().optional().nullable(),  
  }).superRefine((data, ctx) \=\> {  
    if (data.fulfillment\_issue\_count \>= 2 && \!data.is\_received\_confirmed) {  
      ctx.addIssue({  
        code: z.ZodIssueCode.custom,  
        message: "LOGISTICS\_DEADLOCK: Two delivery/access attempts failed. Terminal state.",  
        path: \['fulfillment\_issue\_count'\]  
      });  
    }  
  }),

  // STAGE 4: Production (Two-Revision Hard-Stop & 9:16 Canvas Check)  
  production: z.object({  
    revision\_count: z.number().int().min(0).max(2),  
    auto\_approval\_deadline: z.date(),  
    status: z.enum(\['PENDING', 'APPROVED', 'REJECTED'\]),  
    deliverable\_type: z.string().optional().nullable(), // e.g., 'Reel', 'Story', etc.  
    media\_url: z.string().url("Must be a valid media asset URL").optional().nullable(),  
    is\_aspect\_ratio\_verified: z.boolean().default(false),  
  }).superRefine((data, ctx) \=\> {  
    // Revision guardrail termination state check  
    if (data.revision\_count \>= 2 && data.status \=== 'REJECTED') {  
      ctx.addIssue({  
        code: z.ZodIssueCode.custom,  
        message: "PRODUCTION\_HARD\_STOP: Final revision rejected. Must terminate.",  
        path: \['status'\]  
      });  
    }

    // Section 5 Media rule: Video uploads must be verified for 9:16 aspect ratio (if Reel/Story)  
    if (data.deliverable\_type && \['reel', 'story'\].includes(data.deliverable\_type.toLowerCase())) {  
      if (data.media\_url && \!data.is\_aspect\_ratio\_verified) {  
        ctx.addIssue({  
          code: z.ZodIssueCode.custom,  
          message: "Media Aspect Mismatch: Video uploads must be verified for a 9:16 aspect ratio if specified as a Reel or Story.",  
          path: \['is\_aspect\_ratio\_verified'\]  
        });  
      }  
    }  
  }),

  // STAGE 5: Compliance Gate & Domain Verification  
  compliance: z.object({  
    live\_url: z.string().url("Must be a valid URL string").optional().nullable(),  
    is\_link\_verified: z.boolean(),  
    is\_70\_payout\_released: z.boolean(),  
  }).superRefine((data, ctx) \=\> {  
    // Section 5 Verification rule: live\_url must be a valid Instagram, TikTok, or YouTube domain  
    if (data.live\_url) {  
      const permittedDomains \= \[/instagram\\.com/i, /tiktok\\.com/i, /youtube\\.com/i\];  
      const hasValidDomain \= permittedDomains.some((regex) \=\> regex.test(data.live\_url\!));  
        
      if (\!hasValidDomain) {  
        ctx.addIssue({  
          code: z.ZodIssueCode.custom,  
          message: "Domain Verification Failed: live\_url must resolve to a valid Instagram, TikTok, or YouTube domain.",  
          path: \['live\_url'\]  
        });  
      }  
    }

    // Escrow payout release gate check  
    if (data.is\_70\_payout\_released && \!data.is\_link\_verified) {  
      ctx.addIssue({  
        code: z.ZodIssueCode.custom,  
        message: "Final payout is locked until content compliance is verified.",  
        path: \['is\_70\_payout\_released'\]  
      });  
    }  
  })  
}).superRefine((data, ctx) \=\> {  
  // FR 1.3 Barter Logic Constraint: total\_quote and splits must equal 0  
  if (data.payout\_mode \=== 'BARTER') {  
    if (data.commercials.total\_quote \!== 0 || data.commercials.advance\_30 \!== 0 || data.commercials.balance\_70 \!== 0\) {  
      ctx.addIssue({  
        code: z.ZodIssueCode.custom,  
        message: "Barter Mode Violation: If payout mode is BARTER, total quote and financial splits must equal 0.",  
        path: \['commercials', 'total\_quote'\]  
      });  
    }  
  }

  // FR 2.3 Manual Payout Bank Lock: Requires registered bank details  
  if (data.payout\_mode \=== 'MANUAL' && \!data.commercials.creator\_bank\_details\_id) {  
    ctx.addIssue({  
      code: z.ZodIssueCode.custom,  
      message: "Bank Lock Violation: Creator bank account details are mandatory to accept a Manual Payout collaboration workflow.",  
      path: \['commercials', 'creator\_bank\_details\_id'\]  
    });  
  }

  // Section 5 Logistics rule: tracking\_id is mandatory if industry\_type \== D2C  
  if (data.industry \=== 'D2C' && \!data.logistics.tracking\_id) {  
    ctx.addIssue({  
      code: z.ZodIssueCode.custom,  
      message: "Logistics Enforcer: A tracking\_id is strictly required when the collaboration runs in the D2C industry vertical.",  
      path: \['logistics', 'tracking\_id'\]  
    });  
  }  
});

# FRD

# **Functional Requirement Document (FRD): Unified Collaboration Engine**

## **1\. Document Overview**

**Project Name:** Universal Collaboration Engine (Unified View)

**Version:** 2.0 (Synchronized Brand & Creator Logic)

**Status:** Finalized for Development

**Key Objective:** To automate a high-trust, milestone-based journey where the Brand's "Review Hub" and the Creator's "Action Portal" operate on a synchronized state machine.

---

## **2\. User Roles & Permissions**

* **Brand Manager:** Approves applications, funds payments, verifies logistics dispatch, reviews content, and provides ratings.  
* **Creator:** Proposes quotes, confirms logistics receipt, submits scripts/media, and provides social proof.  
* **System (Stitch/Backend):** Enforces hard-stops (revisions/strikes), manages the 72-hour auto-approval clock, and handles 30/70 escrow distribution.

---

## **3\. Functional Requirements by Stage**

### **Stage 1: Negotiation & Commercials**

**Objective:** Finalize the commercial quote and payout method.

* **FR 1.1 (One-Strike Rule):** System shall allow only one counter-offer per party. If the Brand counters and the Creator counters back, that value is marked is\_final\_offer.  
* **FR 1.2 (Financial Split):** System must automatically calculate and display a 30% Advance and 70% Final Payout based on the total\_quote.  
* **FR 1.3 (Barter Logic):** If payout\_mode \== BARTER, the system shall force total\_quote to 0 and bypass Stage 2\.

### **Stage 2: Securement**

**Objective:** Fund the collaboration to trigger the legal agreement.

* **FR 2.1 (Escrow):** Upon 100% funding by Brand, System auto-releases 30% to Creator.  
* **FR 2.2 (Manual):** System requires Brand to upload advance\_receipt\_url and Creator to confirm receipt before moving to Stage 3\.  
* **FR 2.3 (Bank Lock):** Creator cannot "Accept" a Manual Payout collaboration without registered bank details in the system.

### **Stage 3: Logistics & Fulfillment**

**Objective:** Ensure the Creator has the tools (Product/SaaS Access) to film.

* **FR 3.1 (Multi-Industry Branching):** System pulls industry\_type to show either Shipping (D2C), Digital Keys (SaaS), or Redemption Codes (Healthcare).  
* **FR 3.2 (The 2-Strike Deadlock):** If the Creator reports a fulfillment issue twice (e.g., "Code doesn't work" x2), the System triggers a **Logistics Deadlock** and offers a cancellation path.  
* **FR 3.3 (Production Lock):** The "Upload Content" button remains disabled until the Creator clicks "Confirm Receipt/Access."

### **Stage 4: Content Production & Review**

**Objective:** Manage the creative output via a structured revision engine.

* **FR 4.1 (72-Hour Clock):** If the Brand does not action a media submission within 72 hours, the System triggers **Auto-Approval**.  
* **FR 4.2 (The Hard-Stop):** System allows a maximum of 2 revision rounds. If the Brand rejects Version 2, the System triggers a **Termination State**.  
* **FR 4.3 (Kill-Fee):** In the event of a Hard-Stop termination, the Creator retains the 30% advance as a "Kill-Fee," and the 70% is refunded to the Brand.

### **Stage 5: Final Posting & Analytics**

**Objective:** Verify public content and release final funds.

* **FR 5.1 (Compliance Gate):** For Awareness campaigns, the 70% payout is cryptographically locked until a valid live\_post\_url is submitted and verified.  
* **FR 5.2 (Objective Bypass):** If campaign\_objective \== PRODUCTION\_ONLY, the system bypasses link verification and moves directly to final settlement.

### **Stage 6: Feedback & Archival**

**Objective:** Post-mortem review and project wrap-up.

* **FR 6.1 (Double-Blind Reviews):** Ratings and reviews are hidden (Blind State) until both parties submit or 48 hours pass.  
* **FR 6.2 (The Vault):** System generates a permanent "Project Archive" containing the executed contract, high-res assets, and payment receipts.

---

## **4\. Business Rules & Logic Table**

| Rule ID | Name | Logic Description |
| :---- | :---- | :---- |
| **BR-01** | **Auto-Approval** | If content is submitted and Brand takes no action for 72 hours, System triggers auto-approval and stages 70% payout. |
| **BR-02** | **Negotiation Lock** | Once negotiation\_round \== 2, the "Counter Offer" button is disabled for both parties. |
| **BR-03** | **Logistics Strike** | fulfillment\_issue\_count \>= 2 triggers a terminal cancellation state to protect Brand's time and Creator's schedule. |
| **BR-04** | **Hard-Stop Rule** | Termination after 2 content rejections grants the Creator the 30% advance but prevents any commercial use of the assets. |
| **BR-05** | **Usage Rights** | Legal usage rights are only active if compliance\_status \== VERIFIED and 70% payout is processed. |

---

## **5\. Data & Validation Requirements (Zod)**

* **Financials:** total\_quote must equal advance\_30 \+ balance\_70.  
* **Logistics:** tracking\_id is mandatory if industry\_type \== D2C.  
* **Media:** Video uploads must be verified for 9:16 aspect ratio (if Reel/Story).  
* **Verification:** live\_url must be a valid Instagram, TikTok, or YouTube domain.

---

## **6\. Success Criteria**

1. **Zero-Leakage Financials:** No final 70% release without compliance verification.  
2. **Creative Guardrails:** No collaboration exceeds 2 revision rounds.  
3. **Logistics Safety:** Automated termination for failed product/access delivery.  
4. **Audit Trail:** Every stage generates a synchronized system message in the chat feed.

