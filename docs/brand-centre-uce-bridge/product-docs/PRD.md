# **TECHNICAL INTEGRATION BRIDGE SPECIFICATION**

**System Path:** Aura Gateway / Core Platform Router / Orchestration Bridge  
**Version:** 2026.2.1  
**Security Status:** Production Ready

## **SECTION 1: SYSTEM SIGNAL INGESTION MAP & TRANSACTION ROUTING**

This section handles inbound JSON payloads broadcast by **Tab 3: Campaign Planner** inside the Brand Centre. The bridge decodes these payloads, confirms tenant system permissions, and executes transactional routing rules into the downstream Campaign Workspace database.  
\+------------------------------+  
| BRAND CENTRE: CAMPAIGN PLANNER|  
| (Green, Amber, Red Signals)  |  
\+------------------------------+  
               │  
               ▼  
\+------------------------------+  
|  AURA INTERCEPTOR GATEWAY    |   ◄── Enforces tenant verification  
\+------------------------------+  
               │  
               ▼  
\+------------------------------+  
| DATA TRANSLATION ENGINE      |   ◄── Executes JSON parsing &  
| (Industry & Lifecycle Maps)  |       industry-sector normalization  
\+------------------------------+  
               │  
               ▼  
\+------------------------------+  
| POSTGRESQL TRANSACTION POOL  |   ◄── ACID write commands across  
| (Campaigns / Products/ Briefs|       execution schema nodes  
\+------------------------------+

### **1.1 Global Enum Ingestion Normalization**

The system mapping layer intercepts incoming payloads to map the database structure to the unified execution schema across modules:  
TypeScript  
// Core conversion engine mapping onboarding fields to execution fields  
const INDUSTRY\_SECTOR\_MAP: Record\<string, "D2C\_ECOMMERCE" | "HEALTHCARE" | "AI\_SAAS" | "OFFLINE\_EXPERIENCES"\> \= {  
  "D2C\_SKINCARE": "D2C\_ECOMMERCE",  
  "D2C\_ECOMMERCE": "D2C\_ECOMMERCE",  
  "SAAS\_PRODUCT": "AI\_SAAS",  
  "AI\_SAAS": "AI\_SAAS",  
  "HEALTHCARE\_TREATMENT": "HEALTHCARE",  
  "HEALTHCARE": "HEALTHCARE",  
  "OFFLINE\_EXPERIENCE": "OFFLINE\_EXPERIENCES",  
  "OFFLINE\_EXPERIENCES": "OFFLINE\_EXPERIENCES"  
};

const LIFECYCLE\_MATURITY\_MAP: Record\<string, "DRAFT" | "LIVE" | "LIVE\_PENDING\_APPROVALS"\> \= {  
  "DRAFT\_PLANNER": "DRAFT",  
  "LIVE\_NO\_APPLICANTS": "LIVE",  
  "LIVE\_PENDING\_APPROVALS": "LIVE\_PENDING\_APPROVALS",  
  "FULLY\_COMMITTED\_ESCROW": "LIVE"  
};

### **1.2 Multi-Tier Signal Payload Interceptor Mapping**

#### **A. The Launch Signal (Green Card Framework)**

* **Strategic Intent:** Spawns a brand-new operational framework tracking engine instance.  
* **Payload Structure Constraints:** Requires brand\_id, campaign\_name, macro\_objective, and master\_budget\_limit.  
* **SQL Transaction Flow:**  
* SQL

BEGIN;  
INSERT INTO campaigns\_execution (campaign\_id, brand\_id, campaign\_name, industry\_sector, lifecycle\_state, assigned\_macro\_objective, master\_budget\_limit)  
VALUES ($1, $2, $3, $4, $5, $6, $7);  
\-- Yields generated campaign\_id for downstream child row bindings  
COMMIT;

*   
* 

#### **B. The Injection Signal (Amber Card Framework)**

* **Strategic Intent:** Appends new product specs or creative guidelines into an already executing campaign line.  
* **Payload Structure Constraints:** Requires a valid, active destination campaign\_id.  
* **SQL Transaction Flow:**  
* SQL

BEGIN;  
\-- Query current active baseline to prevent cross-contamination  
SELECT industry\_sector FROM campaigns\_execution WHERE campaign\_id \= $1 FOR UPDATE;

INSERT INTO campaign\_products\_catalog (product\_id, campaign\_id, product\_name, base\_price, positioning\_usps, compliance\_guardrails, fulfillment\_metadata)  
VALUES ($2, $1, $3, $4, $5, $6, $7);  
COMMIT;

*   
* 

#### **C. The Fast-Track Interrupt Signal (Red Card Framework)**

* **Strategic Intent:** Executes an immediate circuit-breaker pause on a targeted child-brief structure due to poor ROI or content fatigue.  
* **Payload Structure Constraints:** Requires explicit brief\_id target parameters.  
* **SQL Transaction Flow:**  
* SQL

UPDATE campaign\_strategy\_briefs  
SET is\_active \= FALSE  
WHERE brief\_id \= $1 AND campaign\_id \= $2;  
\-- Instantly halts inbound creator matching channels

*   
* 

\---

\#\# SECTION 2: STEP-BY-STEP DATA TRANSFORMATION & AUGMENTATION PIPELINE

Unstructured strategic text from the AI Planner must pass through a strict mathematical data preparation and generation layer before being saved to the database.

\#\#\# Step 1: Parent Campaign Record Instantiation (\`campaigns\_execution\`)  
1\. \*\*Dynamic Financial Splitting Algorithm:\*\*  
   \* Reads raw planner string inputs (e.g., \*"$2,500 per creator allocation"\*).  
   \* Calculates upper parameter tier, multiplies it by total target creator allocation, and derives \`master\_budget\_limit\`.  
   \* \*\*Logistics Overhead Invariant:\*\* Automatically calculates 15% of \`master\_budget\_limit\` and assigns it as \`product\_sub\_ceiling\_cap\`. The remaining 85% is reserved for creator payouts.  
2\. \*\*Timeline Structuring Framework:\*\*  
   \* Reads target completion dates. If explicit dates are absent, the system defaults to \`deadline\_type \= 'EVERGREEN'\`.  
   \* If a variable expression exists (e.g., \*"14 days from sample receipt"\*), the system writes \`deadline\_type \= 'DYNAMIC'\` and maps the exact duration integer directly into \`dynamic\_days\_offset\`.

\#\#\# Step 2: Industry-Polymorphic Product Extraction (\`campaign\_products\_catalog\`)  
The translation gateway checks the normalized \`industry\_sector\_enum\` string value to shape fields for the polymorphic JSONB column slots:

             \[ SECTOR DISPATCH CHECK \]  
                          │  
     ┌────────────┬───────┴───────┬────────────┐  
     ▼            ▼               ▼            ▼

D2C\_ECOMMERCE HEALTHCARE AI\_SAAS OFFLINE\_EXPERIENCES  
│ │ │ │  
▼ ▼ ▼ ▼  
Extract SKU Extract Clinical Extract API Extract Geo  
& Shipping Data & Licenses Sandbox Keys Tokens & Venues

\#\#\#\# A. Industry Focus: \`D2C\_ECOMMERCE\`  
\* \*\*Label Mapping:\*\* \`product\_name\` $\\leftarrow$ SKU Title, \`base\_price\` $\\leftarrow$ Manufacturer Suggested Retail Price.  
\* \*\*JSONB Schema Layout Shape:\*\*  
  \`\`\`json  
  {  
    "positioning\_usps": \["100% organic cotton weave", "Hypoallergenic dye certifications"\],  
    "compliance\_guardrails": {  
      "regulatory\_policy\_rules": "Must state FTC sponsorship disclosures audibly in opening frame.",  
      "strict\_do\_not\_say\_tokens": \["cheap", "knockoff", "imitation"\]  
    },  
    "fulfillment\_metadata": {  
      "condition\_clause": "Creator retains product after verified milestone publishing actions are complete.",  
      "shipping\_weight\_oz": 14.2  
    }  
  }

#### **B. Industry Focus: HEALTHCARE**

* **Label Mapping:** product\_name $\\leftarrow$ Approved Medical Line / Treatment Protocol, base\_price $\\leftarrow$ Estimated Out-of-Pocket Cost.  
* **JSONB Schema Layout Shape:**  
* JSON

{  
  "positioning\_usps": \["Dermatologist tested over 12-week clinical evaluations", "Non-comedogenic certification"\],  
  "compliance\_guardrails": {  
    "regulatory\_policy\_rules": "Mandatory FDA black-box warning text must display on-screen for minimum 4-second duration.",  
    "strict\_do\_not\_say\_tokens": \["cure", "miracle fix", "permanent removal", "eliminates illness"\]  
  },  
  "fulfillment\_metadata": {  
    "condition\_clause": "Samples dispatched exclusively via certified medical distribution channels. Returns prohibited.",  
    "practitioner\_signature\_required": true  
  }  
}

*   
* 

#### **C. Industry Focus: AI\_SAAS**

* **Label Mapping:** product\_name $\\leftarrow$ Enterprise Software Module / Subscription Tier, base\_price $\\leftarrow$ Annual Contract Value.  
* **JSONB Schema Layout Shape:**  
* JSON

{  
  "positioning\_usps": \["Sub-10ms query latency processing pipelines", "Zero-trust encryption models"\],  
  "compliance\_guardrails": {  
    "regulatory\_policy\_rules": "All shared screens must display explicitly authorized developer sandbox environments.",  
    "strict\_do\_not\_say\_tokens": \["unsecured leaks", "hackable database", "slow sync times"\]  
  },  
  "fulfillment\_metadata": {  
    "condition\_clause": "Automatic deprovisioning of sandbox API seats exactly 45 days after contract setup.",  
    "sandbox\_provision\_route": "https://sandbox.aura.io/dev-signup"  
  }  
}

*   
* 

#### **D. Industry Focus: OFFLINE\_EXPERIENCES**

* **Label Mapping:** product\_name $\\leftarrow$ Hospitality Venue Location Name / Ticket Activation Variant, base\_price $\\leftarrow$ Fixed Entrance Gate Value.  
* **JSONB Schema Layout Shape:**  
* JSON

{  
  "positioning\_usps": \["Panoramic view lines across central metropolitan footprints", "Michelin starred culinary menus"\],  
  "compliance\_guardrails": {  
    "regulatory\_policy\_rules": "Strict crowd-control privacy limits enforced. Must mask faces of non-consenting public participants.",  
    "strict\_do\_not\_say\_tokens": \["crowded spaces", "unsafe structures", "overpriced entry fees"\]  
  },  
  "fulfillment\_metadata": {  
    "condition\_clause": "Passes expire immediately if booking reservation is canceled within 48 hours of event.",  
    "physical\_geolocation\_address": "742 Evergreen Terrace, New York, NY 10001"  
  }  
}

*   
* 

### **Step 3: Creative Brief Structural Synthesis (campaign\_strategy\_briefs)**

The engine generates complex, rich content assets and applies structural formatting so that all descriptive blocks are stored securely and **collapsed by default** in the UI side drawers:

* **UI Accordion Initialization Flag:** Force write ui\_state\_accordion\_collapsed\_default \= TRUE.  
* **String Ingestion Filter:** Captures raw thematic lists and transforms them into standard array definitions (hook\_options, required\_hashtags, dos\_checklist).

## **SECTION 3: STRATEGIC COMPLIANCE & SAFETY GUARDRAILS ENGINE**

This execution safety module applies strict transaction constraints and validation rules to ensure data integrity during real-time operations.

### **3.1 Fulfillment Circuit Breaker Rules**

TypeScript  
export function validateProductMutationSafety(activeCollabsCount: number): boolean {  
  if (activeCollabsCount \> 0\) {  
    // Halts update operations if active creators are processing fulfillment milestones  
    throw new Error("CRITICAL\_LOCK\_VIOLATION: Data mutations are prohibited while active fulfillment records exist.");  
  }  
  return true;  
}

### **3.2 Automated Brief Modification Safeguard**

* **Constraint Dependency Rule:** Modifications to brief guidelines or payout details are instantly blocked if the active applicant list size is greater than zero (COUNT(applicant\_id) \> 0).  
* **UI Invalidation Logic:** If an update is blocked, the frontend toggle interface visually shifts opacity to 0.40, sets cursor behaviors to not-allowed, and displays the system validation message: *"Terms are locked to preserve contract integrity. Creators have already submitted applications based on these active guidelines."*

## **SECTION 4: AI INTENT ORCHESTRATION ENGINE PROMPTS**

These production-grade system prompts guide the AI engine. They instruct the model to take high-level parameters from the **Campaign Planner** and output clean, structured, and syntactically valid data structures.

### **4.1 System Generation Prompt: Deep-Brief Infrastructure Compiler**

CONTEXT:  
You are the core AI Orchestration Engine of Aura's creator management network. Your responsibility is to ingest high-level, unstructured strategic concepts from the Brand Centre's Campaign Planner and transform them into a comprehensive, production-grade JSON configuration that aligns perfectly with our database schemas and UI requirements.

INPUT VARIABLES TO PROCESS:  
\- Campaign Theme Target: {{Theme Core String}}  
\- Target Deliverable: {{Deliverable Type Enum}}  
\- Industry Classification: {{Industry Sector Enum}}

CRITICAL OPERATIONAL MATRIX BY INDUSTRY:  
1\. If industry is "D2C\_ECOMMERCE", focus heavily on product use-cases, tangible feature demonstrations, clear physical hooks, and strict compliance with FTC sponsorship guidelines.  
2\. If industry is "HEALTHCARE", maintain an authoritative, professional, and balanced tone. Every claim must read as a safe, consumer-friendly statement. You must never promise absolute medical cures, and you must include placeholder structures for mandatory safety disclaimers and regulatory guidelines.  
3\. If industry is "AI\_SAAS", translate strategic goals into concrete workflow demos. Focus on clear interface screencasts, specific software feature use-cases, developer sandbox scenarios, and strict instructions to protect user data and privacy.  
4\. If industry is "OFFLINE\_EXPERIENCES", emphasize environmental attributes, geographic markers, localized venue vibes, spatial transitions, and clear guidelines regarding public appearance waivers and background safety constraints.

OUTPUT VALIDATION STRUCTURE:  
You must output a single, well-formed, valid JSON object that adheres strictly to the layout schema defined below. Do not wrap the JSON in Markdown formatting blocks, do not include any explanatory preamble text, and do not leave any property fields empty or incomplete.

TARGET FORMAT SCHEMAS MAP:  
{  
  "brief\_name": "Provide a high-converting operational title matching the campaign theme.",  
  "content\_theme": "A clear, 3 to 5 word aesthetic focus statement.",  
  "description\_text": "A comprehensive paragraph outlining the creative narrative guidelines.",  
  "hook\_options": \[  
    "High-impact hook variation 1 (optimized for the target channel platform)",  
    "High-impact hook variation 2 (optimized for the target channel platform)"  
  \],  
  "b\_roll\_requirements": "Detailed, step-by-step instructions for capturing supporting visual footage.",  
  "audio\_strategy": "Specific instructions regarding voiceovers, background audio, or audio styles.",  
  "tone\_of\_voice": "3 explicit adjectives specifying the personality of the output content.",  
  "lighting\_requirement": "Detailed lighting specifications tailored to the target setting.",  
  "background\_setting": "Specific instructions for arranging and managing the background scene.",  
  "post\_caption\_template": "A ready-to-use template for post captions, including placeholder tokens like \[Link\] or \[Discount\].",  
  "required\_hashtags": \["\#MustBeginWithHash", "\#BrandPartnerSpecificTag"\],  
  "dos\_checklist": \[  
    "Core instruction 1 for verification success",  
    "Core instruction 2 for verification success"  
  \],  
  "donts\_restrictions": \[  
    "Explicit regulatory or visual restriction 1",  
    "Explicit regulatory or visual restriction 2"  
  \]  
}

### **4.2 System Generation Prompt: Polymorphic Catalog Normalizer**

CONTEXT:  
You are the Data Normalization Engine for Aura's product portfolio registry. Your task is to process incoming inventory descriptions and compile them into standardized database objects tailored to our supported industry verticals.

INPUT PARAMETERS:  
\- Raw Item Data String: {{Product Asset/Service Raw Description Input}}  
\- Active Industry Variable: {{Industry Sector Enum}}

CONVERSION LOGIC:  
Extract the primary marketing hooks, brand protection guardrails, and logistics operational models from the provided input string. You must generate structured data fields that correspond directly to the targeted industry context:

1\. For "D2C\_ECOMMERCE": Identify physical retail attributes, consumer benefits, packaging safety rules, and sample handling conditions.  
2\. For "HEALTHCARE": Extract clinical studies, verified benefits, strict medical constraints, and sample distribution tracking controls.  
3\. For "AI\_SAAS": Map core software capabilities, enterprise benefits, API data privacy rules, and sandbox provisioning processes.  
4\. For "OFFLINE\_EXPERIENCES": Define spatial features, event highlights, public privacy parameters, and booking expiration terms.

JSON COMPLIANCE OUTPUT LAYER:  
Return an un-wrapped, production-ready JSON map matching the definition schema below. Do not include extra text formatting, code block markers, or commentary outside the JSON data structure.

{  
  "extracted\_product\_name": "Normalized identifying title string",  
  "estimated\_base\_price": 0.00,  
  "positioning\_usps": \[  
    "Unique selling proposition statement 1",  
    "Unique selling proposition statement 2"  
  \],  
  "compliance\_guardrails": {  
    "regulatory\_policy\_rules": "Detailed description of legal, safety, or industry-specific policy requirements.",  
    "strict\_do\_not\_say\_tokens": \["forbidden\_term\_1", "forbidden\_term\_2"\]  
  },  
  "fulfillment\_metadata": {  
    "condition\_clause": "Clear operational terms for product delivery, sample returns, or access parameters."  
  }  
}

## **SECTION 5: SYSTEM ERROR BOUNDARIES & TESTING INVARIANTS**

This final block specifies error validation thresholds to prevent data corruption when syncing data from the Brand Centre to the Campaign Engine.

### **5.1 Validation Testing Assertions (Automated QA Engine)**

#### **Test Case 1: Industry Translation Sanitization**

* **Inbound Mock:** brand\_industry\_routing\_enum \= 'HEALTHCARE\_TREATMENT'  
* **Expected Test Result Pass:** The system maps this value to industry\_sector\_enum \= 'HEALTHCARE'. Any alternative values or unmapped text must trigger an explicit operational failure state: 422 Unprocessable Entity: INVALID\_INDUSTRY\_MAPPING\_VECTOR.

#### **Test Case 2: Multi-Tier Budget Leak Protection**

* **Inbound Mock:** master\_budget\_limit \= 10000.00, product\_sub\_ceiling\_cap \= 12500.00  
* **Expected Test Result Pass:** The validation engine must catch the budget mismatch, block the transaction, and throw a clear validation error: ZodValidationError: Isolation Failure: SKU allocation sub-ceilings cannot bypass master framework budgets.

#### **Test Case 3: Inbound State Dependency Lock**

* **Inbound Mock:** UPDATE campaign\_strategy\_briefs SET content\_theme \= 'New Theme' WHERE brief\_id \= \[Target\] (Given that the system registers active applications: COUNT(applicant\_id) \== 4).  
* **Expected Test Result Pass:** Database transaction processes abort immediately, rolling back modification attempts to protect the baseline record and returning error code: 509 CONTRACT\_GUIDELINES\_FROZEN.

