# **ARCHITECTURAL DEVELOPER DOCUMENTATION: MARKETPLACE & CORE PIPELINES**

This document outlines the step-by-step implementation strategy for building out the Marketplace Feed, Dynamic Campaign Detail Application Wizard, and the Public Brand Collaboration Landing Page.

## **1\. Architectural Resolution: Public Brand Page Generation Engine (AI vs. Calculation)**

Before detailing the execution steps, we must resolve a critical technical trade-off: **Should an AI prompt run dynamically to generate the page elements and design system rules, or should a standard programmatic calculation handle it?**

### **The Engineering Recommendation**

We implement a **Hybrid Deterministic Execution Model**. Running a live AI prompt loop at page-load runtime to calculate layout styles or text variants must be avoided for four key reasons:

1. **Latency Overheads:** Live AI generation adds massive time-to-first-byte latency, driving up bounce rates.  
2. **Visual Consistency:** LLMs lack layout determinism; variations can break DOM element spacing or contrast safety rules.  
3. **Escalating Run-Costs:** Offloading a basic public page-view loop to an LLM creates unnecessary recurring API costs.  
4. **Data Leakage Risks:** Runtime text generation risks violating strict brand compliance guardrails (do\_not\_say\_list).

### **The Layout Blueprint Execution**

* **Visual Layout & Branding (Programmatic Calculation):** Primary themes, custom fonts, and item layouts are injected instantly at runtime via deterministic data binding. The frontend reads the exact token arrays stored inside the brand's profile record and populates CSS custom properties dynamically:  
* CSS

:root {  
  \--theme-primary: currentColor; /\* Calculated directly from hex code arrays \*/  
  \--theme-heading-font: var(--brand-dna-font);  
}

*   
* 

\*   \*\*Copywriting Narrative (Asynchronous Offline AI Compilation):\*\* The only true AI application runs \*\*once, asynchronously, at the moment the brand saves changes to their Brand Centre\*\*. The background worker processes the demographics data and unique selling points (USPs), generates the seamless narrative text block, and commits it directly to the database. The public-facing page simply reads this pre-rendered string via a standard cache layer.

\---

\#\# 2\. Phase 1: Core Authentication Gating & Routing Middleware

Implement an edge middleware router (\`/src/middleware/marketplace-guard.ts\`) to intercept traffic heading toward the discovery workspace and manage access across identity tiers.

  \[ INBOUND ENDPOINT REQUEST \]  
                │  
     Validate Active Session?  
      ├─── NO  ──► Redirect to Public Gate Layout (State A)  
      └─── YES ──► Check Profile Tokens  
                    ├─── null Handle  ──► Lock Apply Capabilities (State B)  
                    └─── valid Handle ──► Unlock Full Capabilities (State C)

\#\#\# Edge Implementation Steps  
1\. \*\*Session Handshake:\*\* Check for an active server-side JWT session cookie. If missing, drop the user session into \*\*State A (Unauthenticated Guest)\*\*.  
2\. \*\*Identity Attribute Mapping:\*\* For verified sessions, extract user account telemetry data to confirm if \`is\_social\_connected\` evaluates to true.   
3\. \*\*Capability Flag Injection:\*\* Inject access flags directly into the shared application request context payload:  
    \*   \`can\_apply\_globally \= true\` (State C)  
    \*   \`can\_apply\_globally \= false\` (State B \- social tokens missing)

\---

\#\# 3\. Phase 2: Screen 1 — High-Density Search Grid & Affinity Calculations

\#\#\# Step 1: Base Feed Data Query Pipeline  
Build a high-performance database extraction service using targeted projection maps to isolate sensitive operational values.  
\*   \*\*Enforce Scope Isolations:\*\* Append restrictive conditional clauses to filter out internal management properties like total master budgets or maximum internal payment caps.  
\*   \*\*Visibility Boundary Filtering:\*\* Enforce strict server-side queries to screen out unavailable records based on active account attributes:  
    \`\`\`sql  
    WHERE visibility\_scope \= 'EVERYONE'  
       OR (visibility\_scope \= 'ELIGIBLE\_ONLY' AND creator\_matches\_criteria \= true)  
       OR (visibility\_scope \= 'INVITE\_ONLY' AND is\_invited \= true)

### **Step 2: Live Affinity Matrix Score Compilations**

To display the matching badges on the campaign cards, calculate real-time match scores for qualified creators using normalized alignment scoring functions.  
$$S\_{\\text{match}} \= (\\omega\_1 \\cdot A\_{\\text{geo}}) \+ (\\omega\_2 \\cdot A\_{\\text{demo}}) \+ (\\omega\_3 \\cdot A\_{\\text{niche}})$$  
Where:

* $A\_{\\text{geo}}$ represents regional match alignment ($1$ for verified match, $0$ for mismatch).  
* $A\_{\\text{demo}}$ represents demographic audience distribution overlap scores extracted from the target JSONB profile structure.  
* $A\_{\\text{niche}}$ evaluates thematic relevance across industry parameters.  
* The system applies standard significance weights ($\\omega\_1 \= 0.4$, $\\omega\_2 \= 0.4$, $\\omega\_3 \= 0.2$) to output a final score percentage bounded between $0\\%$ and $100\\%$.

## **4\. Phase 3: Screen 2 — Dynamic Detail Portal & Multi-Step Wizard Flow**

This layer converts standard brand configurations into an interactive application wizard interface.  
\[ CLICK APPLY BUTTON \]  
          │  
          ▼  
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐  
│  STEP 1: PRODUCT │ ───► │  STEP 2: BRIEF   │ ───► │   STEP 3: T\&C    │  
│  Select D2C SKU  │      │  Select Track    │      │ Lock Down Escrow │  
└──────────────────┘      └──────────────────┘      └──────────────────┘

### **Step 1: Real-Time Token Tracking Configuration**

On initial mount, verify incoming URL search parameter sets (?invite\_token=). If verified, bypass standard automated demographic restrictions and swap the default interface CTA with \[Claim Exclusive Invitation\].

### **Step 2: Sequential State Wizard Mechanics**

Manage application inputs sequentially using a structured front-end state layout tracking model:

* **Step 1 (Product Selection Module):** Fetch items linked to the campaign from the data layer. Render selection tiles with disabled states for options where current storage counts evaluate to zero (inventory\_allocation\_count \== 0).  
* **Step 2 (Creative Track Filtering):** Once a product is selected, clear unrelated records and dynamically re-render the creative track list based on the chosen item ID (campaign\_brief\_tracks WHERE product\_id \== selected\_id).  
* **Step 3 (Legal Review Overlay):** Mount the final terms layout container as a modal window overlay. Bind the submit button to a secure POST tracking route (/api/collaboration/submit). Block duplicate submissions by enforcing a row-level isolation check across unique identifiers (unique\_creator\_campaign\_collaboration).

## **5\. Phase 4: Error Handling & Operational Edge Cases Matrix**

To ensure system stability, implement explicit runtime exception routines for these critical edge cases:

| Operational Failure Vector | Root Detection Mechanism | Graceful Resolution Strategy |
| :---- | :---- | :---- |
| **Logistics Inventory Depletion** | Race condition where inventory count drops to 0 mid-application wizard. | API rejects database write transaction. Reverts wizard view state to Step 1, updates item states, and shows message: *"Selected item variant allocation has been exhausted. Please select alternative campaign configuration parameters."* |
| **Invalid Access Attempt** | Authenticated user attempts to directly access an INVITE\_ONLY route via URL injection. | API layout layer captures null matching validation row, intercepts page rendering, and substitutes standard contents with a secure **403 Forbidden Access Screen Layout Canvas**. |
| **Token Session Expiry** | Creator remains inactive in the application wizard until their OAuth or server token expires. | Wizard state is cached locally in sessionStorage. Intercept submit failures, open a seamless re-authentication login overlay window, refresh the active session, and resume processing. |

