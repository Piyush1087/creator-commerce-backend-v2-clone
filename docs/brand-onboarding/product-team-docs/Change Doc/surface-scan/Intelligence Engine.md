

---

# **Creator Shop Intelligence Engine – Final Scan Architecture**

User enters Website URL  
        │  
        ▼  
═══════════════════════════════════════════════  
STAGE 0  
Gatekeeper (Gemini)  
═══════════════════════════════════════════════

Objective  
• Validate website  
• Identify supported business  
• Predict Industry  
• Predict Sub-industry

Output

✓ Supported / Unsupported  
✓ Industry  
✓ Sub-industry  
✓ Confidence

        │  
        ▼

If Unsupported

→ Unsupported Journey

If Supported

↓

═══════════════════════════════════════════════  
STAGE 1  
Website Acquisition  
(Zyte \+ Playwright)  
═══════════════════════════════════════════════

Phase A  
Core Identity Acquisition

↓

Checkpoint 1  
Core Identity Review

↓

Phase B  
Remaining Website Acquisition

↓

Stage 2  
Surface Intelligence

↓

Checkpoint 2  
Surface Review

↓

Stage 3  
Deep Acquisition

↓

Stage 4  
Deep Intelligence

↓

Stage 5  
Campaign Planning

---

# **Stage 0 — Gatekeeper**

### **Engine**

Gemini

### **Objective**

Only determine

* Supported?  
* Industry  
* Sub-industry

Nothing else.

No crawling.

No extraction.

---

# **Stage 1 — Website Acquisition**

This stage is divided into two phases.

---

## **Phase A — Core Identity Acquisition**

Immediately after the Gatekeeper approves the website, Zyte \+ Playwright perform a **minimal crawl**.

### **Objective**

Acquire only the information required for the user to verify the business identity.

### **Inputs**

* Website URL  
* Industry (from Gatekeeper)  
* Sub-industry (from Gatekeeper)

### **Outputs**

* Brand Name  
* Logo  
* Website URL  
* Industry *(from Gatekeeper)*  
* Sub-industry *(from Gatekeeper)*  
* Primary Geography  
* Primary Language  
* Primary Market  
* Website Currency  
* Social Handles  
* Homepage Metadata  
* Evidence

Notice that **Industry and Sub-industry shown on this screen are still Gemini's predictions**. The crawler does not infer them.

---

# **Checkpoint 1 — Core Identity Review**

This becomes the **first and only business confirmation step**.

The user reviews:

### **AI-inferred**

* Industry  
* Sub-industry

### **Deterministically extracted**

* Brand Name  
* Logo  
* Social Handles  
* Geography

The user may edit:

* Industry  
* Sub-industry  
* Brand Display Name  
* Logo (if required)  
* Social Handles  
* Geography

Once the user clicks **Confirm**, all of these become the authoritative business identity for the remainder of the scan.

---

# **Why this works better**

This solves the problem we identified.

Previously:

Gatekeeper

↓

Industry Review

↓

Crawler

The user was reviewing only two fields.

Now:

Gatekeeper

↓

Crawler (Phase A)

↓

Single Core Identity Review

The user reviews everything together in one screen.

---

# **What happens after confirmation?**

At this point the platform now knows with certainty:

Industry

Sub-industry

Brand Name

Logo

Geography

Social Handles

Now the execution strategy can be finalized.

The MCP Planner receives the **confirmed** Industry and Sub-industry—not the Gatekeeper's prediction.

That means if the user changes:

Industry

Healthcare

↓

Offline Services

the remaining crawl immediately switches to the Offline Services acquisition strategy.

No work has been wasted because only the lightweight Core Identity Acquisition has run.

---

# **Phase B — Remaining Website Acquisition**

Now the crawler continues using the **confirmed** business identity.

The MCP Planner determines:

* Which pages should be crawled  
* Crawl priority  
* Expected page type  
* Expected entities

The parallel acquisition pipeline then extracts:

* Offerings  
* Collections  
* PDPs  
* Pricing  
* Locations  
* Reviews  
* Testimonials  
* Blogs  
* Policies  
* Images  
* Videos  
* Structured data

---

## **Final Stage Flow**

| Stage | Engine | Purpose |
| ----- | ----- | ----- |
| **Stage 0** | Gemini | Business qualification (Supported, Industry, Sub-industry) |
| **Stage 1A** | Zyte \+ Playwright | Core Identity Acquisition |
| **Checkpoint 1** | User | Confirm complete Core Identity (Industry, Sub-industry, Brand Name, Logo, Geography, Social Handles) |
| **Stage 1B** | Zyte \+ Playwright \+ MCP Planner | Remaining website acquisition using the confirmed Industry/Sub-industry |
| **Stage 2** | Gemini | Surface Intelligence |
| **Checkpoint 2** | User | Confirm Surface Intelligence (Brand DNA, Offerings, Competitors) |
| **Stage 3** | Zyte \+ APIs | Deep Acquisition |
| **Stage 4** | Gemini | Deep Intelligence |
| **Stage 5** | AI \+ Business Logic | Campaign Planning |

I believe this is the cleanest architecture because it preserves the separation of responsibilities while eliminating an unnecessary user checkpoint. The user now makes **one consolidated "Core Identity" confirmation** before any industry-specific crawling or AI reasoning begins, ensuring that all downstream acquisition and intelligence are based on confirmed business facts.

# **Creator Shop Intelligence Engine**

# **Stage 2 – Canonical Output Contract**

## **Engineering Specification v1.0**

---

# **Purpose**

This document defines the **canonical data contract** for Stage 2 (Surface Intelligence).

It is the single source of truth for:

* Gemini prompts  
* Backend services  
* PostgreSQL mapping  
* Zod validation  
* Frontend rendering  
* Deep Acquisition  
* Deep Intelligence

No prompt, backend service or frontend component should introduce fields outside this specification.

---

# **Scope**

Stage 2 is responsible for transforming the normalized evidence generated during Stage 1 into structured business entities.

Stage 2:

* identifies business entities  
* reasons over website evidence  
* generates structured AI outputs  
* assigns confidence and evidence  
* prepares entities for user confirmation

Stage 2 does **not**:

* crawl websites  
* parse HTML  
* scrape competitors  
* analyze Instagram  
* perform PDP audits  
* benchmark competitors  
* generate campaign recommendations

---

# **Canonical Principles**

## **1\. Entity-first Architecture**

Creator Shop operates on structured business entities.

AI produces entities—not paragraphs.

---

## **2\. Single Source of Truth**

Every module consumes and produces the same canonical entities.

No duplicate structures.

---

## **3\. Evidence-first Intelligence**

Every AI-generated field must be backed by website evidence.

No unsupported inference.

---

## **4\. Confidence Required**

Every AI-generated field must include a confidence score.

Confidence is stored internally and never displayed to end users.

---

## **5\. User Confirmation**

Only user-confirmed entities proceed to Deep Acquisition.

Deleted or rejected entities remain only in audit history.

---

## **6\. Surface Before Deep**

Stage 2 identifies entities.

Deep stages enrich, analyze and benchmark them.

---

# **Universal AI Field Contract**

Every AI-generated field must follow this structure.

{  
  "value": "...",  
  "confidence": 92,  
  "evidence": \[  
    {  
      "pageUrl": "...",  
      "pageType": "...",  
      "excerpt": "..."  
    }  
  \],  
  "source": "AI",  
  "edited": false  
}

---

# **Canonical Modules**

Stage 2 produces four modules.

Brand DNA

Offerings

Competitors

Surface Metadata

---

# **Module 1 — Brand DNA**

## **Industry Niche**

| Property | Value |
| ----- | ----- |
| Generated By | AI |
| Editable | No |
| Mandatory | Yes |
| Evidence | Required |
| Confidence | Required |
| Deep Scan Input | Yes |

---

## **Brand Positioning**

| Property | Value |
| ----- | ----- |
| Generated By | AI |
| Editable | Yes |
| Mandatory | Yes |
| Evidence | Required |
| Confidence | Required |
| Deep Scan Input | Yes |

---

## **Brand Narrative**

| Property | Value |
| ----- | ----- |
| Generated By | AI |
| Editable | Yes |
| Mandatory | Yes |
| Evidence | Required |
| Confidence | Required |
| Deep Scan Input | Yes |

---

## **Core Value Proposition**

| Property | Value |
| ----- | ----- |
| Generated By | AI |
| Editable | Yes |
| Mandatory | Yes |
| Evidence | Required |
| Confidence | Required |
| Deep Scan Input | Yes |

---

## **Key Differentiators**

| Property | Value |
| ----- | ----- |
| Generated By | AI |
| Editable | Yes |
| Mandatory | Yes |
| Evidence | Required |
| Confidence | Required |
| Deep Scan Input | Yes |

---

## **Tone of Voice**

| Property | Value |
| ----- | ----- |
| Generated By | AI |
| Editable | Yes |
| Mandatory | Yes |
| Evidence | Required |
| Confidence | Required |
| Deep Scan Input | Yes |

---

## **Visual Aesthetic**

| Property | Value |
| ----- | ----- |
| Generated By | AI |
| Editable | Yes |
| Mandatory | Yes |
| Evidence | Required |
| Confidence | Required |
| Deep Scan Input | Yes |

---

## **Audience Personas**

Minimum: **2**

Maximum: **6**

Each persona contains:

| Field | Mandatory |
| ----- | ----- |
| Persona Name | Yes |
| Age Range | Yes |
| Gender | Yes |
| Geography | Yes |
| Affluence Score | Yes |
| Traits | Yes |

Editable: Yes

Evidence: Required

Confidence: Required

Deep Scan Input: Yes

---

# **Visual Identity**

## **Deterministic (Crawler)**

* Logo  
* Primary Colours  
* Typography

Generated by Stage 1\.

Read-only.

---

## **AI Generated**

* Visual Aesthetic

Editable.

---

# **Module 2 — Offerings**

Stage 2 identifies business entities only.

Deep Scan enriches them.

---

## **Offering**

Each offering contains:

| Field | Mandatory |
| ----- | ----- |
| Name | Yes |
| Landing Page URL | Yes |
| Type | Yes |

Editable: Yes

Evidence: Required

Confidence: Required

Deep Scan Input: Yes

---

## **Collections**

Industry dependent.

Each collection contains:

| Field | Mandatory |
| ----- | ----- |
| Name | Yes |
| Landing Page URL | Yes |

---

## **Offers**

Each offer contains:

| Field | Mandatory |
| ----- | ----- |
| Offer Title | Yes |
| Offer URL | Optional |

---

## **Locations**

Applicable for Healthcare and Offline Services.

Each location contains:

| Field | Mandatory |
| ----- | ----- |
| Location Name | Yes |
| City | Yes |
| State / Province | Optional |
| Country | Optional |
| Google Maps URL | Optional |

---

## **Plans & Access**

Applicable for AI / SaaS.

Each plan contains:

| Field | Mandatory |
| ----- | ----- |
| Plan Name | Yes |
| Landing Page URL | Optional |

Examples include:

* Free Plan  
* Free Trial  
* Starter  
* Professional  
* Enterprise  
* Contact Sales

---

# **Module 3 — Competitors**

Stage 2 identifies competitor candidates only.

Deep benchmarking occurs in later stages.

Each competitor contains:

| Field | Mandatory |
| ----- | ----- |
| Brand Name | Yes |
| Website URL | Yes |

Editable: Yes

Evidence: Required

Confidence: Required

Deep Scan Input: Yes

---

# **Module 4 — Surface Metadata**

Internal module.

Not displayed in UI.

Contains:

* Prompt Version  
* Prompt ID  
* AI Model  
* Scan Timestamp  
* Scan Duration  
* Overall Confidence  
* Entity Counts  
* Manual Override Count  
* Scan Status

---

# **Validation Rules**

## **Brand DNA**

Mandatory:

* Industry Niche  
* Brand Positioning  
* Brand Narrative  
* Core Value Proposition  
* Key Differentiators  
* Tone of Voice  
* Visual Aesthetic  
* Minimum 2 Audience Personas

---

## **Offerings**

### **D2C / E-commerce**

Minimum:

* 1 Offering

---

### **AI / SaaS**

Minimum:

* 1 Offering  
* 1 Plan or Access Method

---

### **Healthcare**

Minimum:

* 1 Treatment / Service  
* 1 Location

---

### **Offline Services**

Minimum:

* 1 Service  
* 1 Location

---

## **Competitors**

Minimum:

* 1 Competitor

Recommended:

* 3–5 Competitors

Maximum:

* 10 Competitors

---

# **Output Ownership**

| Module | Owner |
| ----- | ----- |
| Brand DNA | Prompt A |
| Offerings | Prompt B |
| Competitors | Prompt C |
| Surface Metadata | Backend |

---

# **Entity Lifecycle**

Stage 1

↓

Candidate Entity

↓

Stage 2

↓

AI Entity

↓

User Review

↓

Confirmed Entity

↓

Deep Acquisition

↓

Deep Intelligence

---

# **Data Source Mapping**

| Field Type | Source |
| ----- | ----- |
| Deterministic Website Data | Stage 1 Crawler |
| AI Reasoning | Stage 2 Gemini |
| User Corrections | Onboarding UI |
| Final Confirmed Data | PostgreSQL |
| Enriched Intelligence | Deep Scan |

---

# **Prompt Mapping**

| Prompt | Output |
| ----- | ----- |
| Prompt A | Brand DNA |
| Prompt B | Offerings |
| Prompt C | Competitors |

Each prompt is independently executable and independently retryable.

---

# **Versioning**

Every Stage 2 execution must store:

* Prompt ID  
* Prompt Version  
* AI Model  
* Context Version  
* Output Contract Version  
* Scan Timestamp

---

# **Handover to Deep Acquisition**

Only confirmed entities are passed forward.

Deep Acquisition receives:

* Confirmed Brand DNA  
* Confirmed Offerings  
* Confirmed Collections  
* Confirmed Offers  
* Confirmed Locations  
* Confirmed Plans & Access  
* Confirmed Competitors

Deleted or rejected entities must never be included in downstream processing.

---

# **Engineering Principles**

1. Stage 2 reasons only on normalized evidence produced by Stage 1\.  
2. Every AI-generated field must include evidence and confidence.  
3. Stage 2 identifies entities; Deep stages enrich and analyze them.  
4. Every prompt has a single responsibility and produces only its assigned module.  
5. All prompts must conform to the canonical output contract defined in this document.  
6. Only user-confirmed entities progress to Deep Acquisition and Deep Intelligence.  
7. Prompt versions, output contract versions and AI model versions must be stored with every scan for traceability.  
8. Backend services own context preparation, validation, retries and output merging; Gemini owns semantic reasoning and structured JSON generation.  
9. No prompt may introduce fields or structures outside this canonical contract.  
10. This document is the authoritative contract for all Stage 2 outputs and supersedes any prompt-specific assumptions.

---

# **Creator Shop Intelligence Engine**

# **Stage 2 Context Contract**

## **Engineering Specification v1.0**

---

# **Purpose**

Define the standardized input package supplied to every Surface Intelligence prompt.

This document specifies:

* MCP orchestration  
* Zyte responsibilities  
* Playwright responsibilities  
* Gemini responsibilities  
* Context Builder  
* Context Package schema  
* Snapshot persistence  
* Versioning  
* Refresh behaviour

This is the canonical interface between acquisition and reasoning.

---

# **High-Level Architecture**

User URL

↓

Stage 0  
Gatekeeper

↓

Checkpoint 1

↓

Stage 1  
Acquisition

↓

Context Builder

↓

Brand Intelligence Snapshot

↓

Prompt-specific Context Builder

↓

Prompt A  
Brand DNA

Prompt B  
Offerings

Prompt C  
Competitors

↓

Surface Intelligence

---

# **Stage 1 Responsibilities**

## **Zyte**

Responsible for structured website acquisition.

Acquire:

* Sitemap  
* Navigation  
* Internal URLs  
* Structured metadata  
* Canonical URLs  
* Images  
* OpenGraph  
* Schema.org  
* Robots  
* Page metadata

No reasoning.

---

## **Playwright**

Responsible for browser rendering.

Acquire:

* JavaScript-rendered content  
* Lazy-loaded images  
* Hidden navigation  
* Dynamic menus  
* Infinite scroll  
* Client-side rendered text  
* DOM screenshots (optional)  
* API responses if required

No reasoning.

---

## **MCP (Gemini)**

MCP becomes the orchestration intelligence.

It does **not** generate Brand DNA.

It decides

**what should be crawled next.**

---

# **MCP Responsibilities**

After homepage acquisition:

Determine:

What pages exist?

↓

Which pages are relevant?

↓

Which pages should be crawled?

↓

How should they be classified?

---

Example

Homepage

↓

Gemini

↓

Products

Treatments

Pricing

About

Collections

Blog

Locations

FAQ

↓

Crawler

↓

Only crawl those.

---

This minimizes unnecessary crawling.

---

# **Stage 1 Output**

Stage 1 should never output raw HTML.

Instead produce

Normalized Website Evidence

---

# **Context Builder**

Purpose

Convert acquisition results into AI-ready business context.

Responsibilities

* Merge crawler outputs  
* Remove duplicate information  
* Normalize URLs  
* Rank pages  
* Extract entities  
* Compress repetitive text  
* Generate summaries  
* Prepare prompt-specific payloads

No semantic reasoning.

---

# **Core Context**

Every prompt receives this.

## **1\. Execution Context**

Scan ID

Brand ID

Snapshot Version

Prompt Version

Timestamp

Language

---

## **2\. Confirmed Brand Identity**

Brand Name

Website

Industry

Sub-industry

Industry Niche (if confirmed)

Country

Reporting Currency

Primary Market Currency

Social Handles

---

## **3\. Website Summary**

Generated by Context Builder.

Homepage Summary

About Summary

Navigation Summary

Business Summary

Top Categories

Top Keywords

---

## **4\. Website Assets**

Logo

Colours

Fonts

Hero Images

Videos

Icons

---

# **Prompt-specific Context**

## **Prompt A**

Receives

Core Context

Homepage Summary

About Summary

Brand Story

Messaging Pages

Website Assets

---

## **Prompt B**

Receives

Core Context

Candidate Offerings

Candidate Collections

Candidate Offers

Candidate Locations

Candidate Plans

Relevant PDP Pages

---

## **Prompt C**

Receives

Core Context

Homepage

About

Candidate Competitors

Top Category Pages

---

# **Candidate Entity Contract**

Every candidate entity follows

ID

Type

Name

URL

Summary

Evidence

Images

Discovery Source

Examples

* Offering  
* Collection  
* Offer  
* Location  
* Plan

---

# **Page Contract**

Every crawled page is normalized.

Page URL

Page Type

Title

Summary

Structured Sections

Images

Metadata

Internal Links

Never send HTML to Gemini.

---

# **Brand Intelligence Snapshot**

Persist every successful scan.

Snapshot contains:

## **Acquisition Layer**

* Website Summary  
* Website Assets  
* Candidate Entities  
* Crawl Metadata

---

## **Surface Layer**

* Brand DNA  
* Offerings  
* Competitors

---

## **Deep Layer (future)**

* PDP Audit  
* Similarweb Signals  
* Instagram Intelligence  
* Meta Ads Intelligence

---

## **AI Metadata**

Prompt Versions

Model Versions

Confidence

Evidence Statistics

Scan Duration

Retry Count

---

# **Refresh Logic**

A new snapshot is created when:

* User requests Refresh  
* Industry changes  
* Competitor changes  
* Offering changes  
* Website changes  
* Instagram connects  
* Meta APIs connect  
* Deep Scan reruns

Snapshots are immutable.

Only one snapshot is marked

Current

---

# **Engineering Principles**

1. Zyte and Playwright acquire data; they never reason.  
2. Gemini MCP decides crawl strategy but does not generate business intelligence.  
3. Context Builder owns normalization and summarization.  
4. Prompts consume structured context only.  
5. Every successful scan creates a new immutable Brand Intelligence Snapshot.  
6. All downstream AI features consume the latest approved snapshot instead of re-crawling the website.  
7. Raw crawler outputs remain available for debugging but are never passed directly to prompts.  
8. Context packages are versioned independently of prompts and database schemas.

---

## **One refinement before implementation**

I would **not** store just one monolithic JSON blob for the Brand Intelligence Snapshot. Instead, model it as a **composite snapshot** with named sections (`core_context`, `surface_context`, `deep_context`, `social_context`, `metadata`). Each section should carry its own version, timestamp, and checksum. That way, when Instagram reconnects or Similarweb data is refreshed, you only regenerate the affected section rather than rebuilding the entire snapshot. This keeps rescans faster, preserves provenance, and gives future AI modules a stable, modular interface while still presenting the application with a single logical "latest snapshot."

# **Creator Shop Intelligence Engine**

# **AI Runtime Contracts v1.0**

## **Purpose**

This document defines the runtime interface between the Creator Shop backend and every AI module.

It standardizes:

* AI inputs  
* AI outputs  
* object contracts  
* enumerations  
* validation  
* versioning

This document is the canonical API between the backend and any LLM.

---

# **Runtime Flow**

Stage 1 Acquisition  
        │  
        ▼  
Context Builder  
        │  
        ▼  
AI Runtime Input Contract  
        │  
        ▼  
Gemini  
        │  
        ▼  
AI Runtime Output Contract  
        │  
        ▼  
Output Validator  
        │  
        ▼  
PostgreSQL

---

# **AI Runtime Contract Structure**

Every AI module has four contracts.

Input Contract

↓

Output Contract

↓

Validation Contract

↓

Version Contract

---

# **Runtime Contract A**

# **Surface Intelligence — Brand DNA**

---

## **Input Object**

SurfaceBrandDNAInput {

    execution\_context

    brand\_identity

    website\_summary

    website\_assets

    messaging\_pages

    relevant\_pages

}

---

## **execution\_context**

{

scan\_id

brand\_id

snapshot\_version

prompt\_version

language

scan\_timestamp

}

---

## **brand\_identity**

Everything confirmed during Checkpoint 1\.

{

brand\_name

website

industry

sub\_industry

country

reporting\_currency

primary\_market\_currency

social\_handles

}

Notice

Industry

is confirmed.

Not AI predicted.

---

## **website\_summary**

{

homepage\_summary

about\_summary

navigation\_summary

business\_summary

top\_keywords

top\_categories

}

---

## **website\_assets**

{

logo

colours

fonts

hero\_images

videos

icons

}

---

## **messaging\_pages**

\[

{

url

title

summary

page\_type

}

\]

Only pages relevant to messaging.

---

## **relevant\_pages**

Normalized page objects.

\[

{

url

page\_type

summary

sections

images

}

\]

No HTML.

---

# **Output Contract**

SurfaceBrandDNAOutput {

brand\_dna

metadata

}

---

## **brand\_dna**

{

industry\_niche

brand\_positioning

brand\_narrative

core\_value\_proposition

key\_differentiators

tone\_of\_voice

visual\_aesthetic

audience\_personas

}

---

Every field

inherits

Universal Field Wrapper.

---

## **Universal Field Wrapper**

{

value

confidence

evidence

source

edited

}

---

## **Audience Persona**

{

name

age\_range

gender

geography

affluence\_score

traits

}

---

# **Validation Contract**

Output Validator checks:

✓ valid JSON

✓ all mandatory fields

✓ minimum personas

✓ enums valid

✓ no duplicate personas

✓ confidence exists

✓ evidence exists

✓ conforms to output contract

---

# **Version Contract**

Every execution stores

{

prompt\_id

prompt\_version

runtime\_contract\_version

context\_contract\_version

output\_contract\_version

model

}

---

# **Runtime Contract B**

# **Surface Intelligence — Offerings**

---

## **Input**

SurfaceOfferingsInput {

execution\_context

brand\_identity

candidate\_offerings

candidate\_collections

candidate\_offers

candidate\_locations

candidate\_plans

relevant\_pages

}

---

## **Output**

SurfaceOfferingsOutput {

offerings

collections

offers

locations

plans

metadata

}

---

Every entity

↓

Universal Entity Wrapper.

---

# **Runtime Contract C**

# **Surface Intelligence — Competitors**

---

## **Input**

SurfaceCompetitorInput {

execution\_context

brand\_identity

homepage

about

website\_summary

candidate\_competitors

}

---

## **Output**

SurfaceCompetitorOutput {

competitors

metadata

}

---

# **Universal Metadata**

Every output

contains

{

prompt\_version

runtime\_contract\_version

confidence

generated\_at

processing\_time

}

---

# **Enumerations**

## **Tone of Voice**

Educational

Scientific

Friendly

Premium

Minimalist

Playful

Authoritative

Technical

Community Driven

---

## **Visual Style**

Minimalist

Clinical

Luxury

Modern

Natural

Lifestyle

Corporate

Vibrant

---

## **Offering Type**

Contextual by Industry.

Examples

D2C

Product

Bundle

Collection

Healthcare

Treatment

Package

Consultation

SaaS

Software

Platform

API

Module

Plan

---

# **Validation Pipeline**

Every runtime execution.

Context Builder

↓

Prompt

↓

JSON

↓

Output Validator

↓

Schema Validator

↓

Business Validator

↓

Persist

---

# **Failure Behaviour**

If JSON fails

↓

Retry Prompt.

---

If Schema fails

↓

Reject.

Retry.

---

If Business Validation fails

↓

Return

Needs Review.

---

# **Future Compatibility**

The runtime contracts are intentionally model-agnostic.

Any LLM (Gemini, GPT, Claude, etc.) must consume the same input contracts and produce the same output contracts. This isolates AI model changes from the rest of the platform and ensures that backend services, PostgreSQL schemas, and frontend components remain stable as the underlying AI technology evolves.

---

# **My recommendation before moving to Prompt A**

After stepping back and reviewing the architecture, I believe we have now defined **all permanent contracts** in the system:

1. **Stage 2 Context Contract** – what the AI receives.  
2. **Stage 2 Canonical Output Contract** – the business entities the platform recognizes.  
3. **AI Runtime Contracts** – the request/response interface between the backend and the AI.  
4. **Instruction Matrix** – the business rules for generating each field.

These four documents form the foundation of the AI layer. From this point onward, **Prompt A is no longer an architecture exercise**—it is an implementation of these contracts. That is exactly where you want to be before investing time in prompt tuning, because future prompt improvements will modify reasoning while leaving the surrounding system unchanged. I would now consider the architecture frozen and move into implementation of the production prompts.

---

# **Creator Shop AI Prompt Engineering Standard (`prompting.md`)**

## **1\. Purpose**

This document defines the mandatory engineering standards for every AI prompt used within Creator Shop.

It is the single source of truth for prompt construction across:

* Surface Intelligence  
* Deep Acquisition  
* Deep Intelligence  
* Campaign Planning  
* Future AI modules

All prompts must conform to this specification.

---

# **2\. AI Design Philosophy**

The intelligence engine follows five core principles.

## **2.1 Evidence First**

The AI reasons only from the supplied evidence.

Never:

* use pre-trained memory  
* use world knowledge  
* use assumptions  
* invent missing information

If evidence is insufficient,

return

UNKNOWN

with low confidence.

---

## **2.2 Deterministic Outputs**

The same inputs should produce nearly identical outputs.

Avoid:

* creative language  
* optional interpretations  
* multiple valid JSON structures

---

## **2.3 Entity-first Reasoning**

The AI identifies structured business entities.

Never produce long descriptive paragraphs when structured entities are possible.

---

## **2.4 Explainable Intelligence**

Every AI conclusion must reference supporting evidence.

---

## **2.5 Confidence-aware**

Every generated field includes confidence.

Confidence is based on evidence quality.

Not model certainty.

---

# **3\. Prompt Architecture**

Every prompt must follow exactly this structure.

1\. Metadata

2\. Role

3\. Objective

4\. Available Context

5\. Available Evidence

6\. Business Rules

7\. Industry-specific Rules

8\. Field Instructions

9\. Negative Rules

10\. Confidence Rules

11\. Evidence Rules

12\. Self Validation

13\. Output Contract

14\. JSON

No exceptions.

---

# **4\. Prompt Metadata**

Every prompt begins with

prompt\_id:

prompt\_name:

version:

stage:

module:

owner:

depends\_on:

produces:

Example

prompt\_id: surface\_brand\_dna

version: 1.0.0

stage: surface

module: brand\_dna

owner: creator\_shop

depends\_on:  
  \- stage1\_context\_v1

produces:  
  \- brand\_dna\_v1

---

# **5\. Context Rules**

AI only receives the Context Package prepared by the backend.

Never assume access to:

* HTML  
* DOM  
* CSS  
* JavaScript  
* Browser

The backend owns context preparation.

---

# **6\. Reasoning Pipeline**

Every prompt must execute this reasoning sequence.

## **Step 1**

Understand Business

↓

## **Step 2**

Validate Evidence

↓

## **Step 3**

Identify Entities

↓

## **Step 4**

Classify Entities

↓

## **Step 5**

Generate Fields

↓

## **Step 6**

Assign Confidence

↓

## **Step 7**

Attach Evidence

↓

## **Step 8**

Self Validate

↓

## **Step 9**

Generate JSON

The AI should not skip or reorder steps.

---

# **7\. Evidence Rules**

Every field must satisfy:

Evidence

↓

Reasoning

↓

Output

Never

Output

↓

Evidence

---

Evidence hierarchy

1. Explicit website statement  
2. Structured schema  
3. Navigation  
4. Cross-page consistency  
5. Weak inference

Never infer when explicit evidence contradicts it.

---

# **8\. Confidence Framework**

Confidence measures evidence quality.

Not AI certainty.

Suggested scale:

| Score | Meaning |
| ----- | ----- |
| 95–100 | Explicitly stated multiple times |
| 85–94 | Explicitly stated once |
| 70–84 | Strong inference from multiple signals |
| 50–69 | Weak inference |
| \<50 | Insufficient evidence |

Never assign high confidence to inferred data.

---

# **9\. Field Generation Rules**

Every field must define:

* source  
* evidence  
* confidence

Mandatory.

---

If field cannot be generated

Return

UNKNOWN

Never invent.

---

# **10\. Entity Rules**

Every entity must be:

* unique  
* normalized  
* deduplicated  
* evidence-backed

Duplicate entities must be merged.

---

# **11\. Industry Rules**

Prompts must never hardcode D2C assumptions.

Always use the confirmed:

* Industry  
* Sub-industry  
* Industry Niche

Industry-specific logic should switch behavior accordingly.

---

# **12\. Negative Rules**

The AI must never:

* hallucinate competitors  
* hallucinate products  
* invent social handles  
* infer pricing  
* infer traffic  
* use historical knowledge  
* search beyond supplied evidence  
* modify user-confirmed fields

---

# **13\. Business Rules**

Surface Intelligence

↓

identifies

Deep Acquisition

↓

collects

Deep Intelligence

↓

analyzes

Campaign Planner

↓

recommends

Prompts must never perform responsibilities belonging to another stage.

---

# **14\. Output Rules**

Outputs must:

* conform exactly to the Canonical Output Contract  
* preserve field order  
* preserve data types  
* never add undocumented fields  
* never omit mandatory fields

---

# **15\. Self Validation**

Before returning JSON, the AI must internally verify:

✓ Required fields exist.

✓ Mandatory entities exist.

✓ Confidence assigned.

✓ Evidence attached.

✓ No duplicate entities.

✓ Industry rules followed.

✓ Output matches schema.

If validation fails,

correct internally before responding.

---

# **16\. JSON Rules**

Return

only

valid JSON.

No markdown.

No explanations.

No comments.

No surrounding text.

---

# **17\. Failure Behaviour**

If evidence is insufficient:

Return:

UNKNOWN

with:

* low confidence  
* empty evidence array if applicable  
* no hallucinated values

Do not guess.

---

# **18\. Prompt Quality Checklist**

Every prompt must satisfy:

* Single responsibility  
* Uses Context Package only  
* Evidence-backed outputs  
* Canonical Output Contract compliant  
* Deterministic  
* Industry-aware  
* Self-validating  
* Versioned  
* Retry-safe

---

# **19\. Engineering Principles**

1. AI never crawls.  
2. Backend prepares context.  
3. AI reasons only on supplied evidence.  
4. Every prompt has one responsibility.  
5. Every output is evidence-backed.  
6. Confidence reflects evidence quality.  
7. User-confirmed data overrides AI inference.  
8. Deep stages enrich rather than rediscover entities.  
9. Every prompt is independently executable and retryable.  
10. The Canonical Output Contract is the single source of truth.

---

# **20\. Standard Prompt Template**

Every Creator Shop prompt must use this skeleton:

Prompt Metadata

Role

Objective

Context

Evidence

Reasoning Pipeline

Business Rules

Industry Rules

Field Instructions

Negative Rules

Confidence Rules

Evidence Rules

Self Validation

Output Contract

JSON Output

---

## **Why this version is better than the previous `prompting.md`**

The earlier version focused on **how to write good prompts**. This version establishes **how the entire AI system should behave**. It separates architectural responsibilities, standardizes prompt structure, defines evidence and confidence consistently, and aligns every prompt with the canonical output contract you've just finalized. It also remains model-agnostic, so whether you use Gemini today or another LLM in the future, the engineering standard—and therefore the behavior of your intelligence engine—remains unchanged.

# **Now, let's move to the Instruction Matrix.**

This is, in my opinion, the single most valuable document before Prompt A.

Unlike the prompt, this document is written **for humans**.

It defines exactly how every Brand DNA field should be generated.

The prompt is then assembled from this matrix.

---

# **Stage 2 — Brand DNA Instruction Matrix**

## **Purpose**

Define deterministic generation rules for every Brand DNA field.

Every field has:

* one objective  
* one reasoning method  
* one evidence priority  
* one output format  
* one set of constraints

This prevents prompt ambiguity.

---

| Field | Objective | Primary Evidence | Secondary Evidence | Reasoning Logic | Output Format | Constraints |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| **Industry Niche** | Identify the most specific niche within the confirmed Industry/Sub-industry. | Homepage, About, Services/Products | Navigation, FAQs | Use explicit positioning and offering descriptions. Select the dominant niche; don't invent one. | Single string | Must align with confirmed Industry/Sub-industry. Not editable. |
| **Brand Positioning** | Summarize how the brand wants to be perceived. | Homepage hero, About | Brand story, taglines | Identify recurring positioning themes. Summarize, don't rewrite. | Single sentence | ≤30 words. No marketing embellishment. |
| **Brand Narrative** | Explain the brand story and mission. | About page | Founder story, Homepage | Combine mission, origin and purpose into a concise narrative. | Short paragraph | ≤120 words. Evidence-backed only. |
| **Core Value Proposition** | State the primary customer benefit. | Homepage hero, Product/Service messaging | About page | Answer: "Why should a customer choose this brand?" | Single sentence | ≤25 words. Avoid slogans. |
| **Key Differentiators** | Identify what makes the brand distinct. | Homepage, Product/Service pages | FAQs, About | Extract explicit differentiators. Remove duplicates. | Array (3–6 items) | One concept per item. No repetition. |
| **Tone of Voice** | Classify communication style. | Homepage copy, Blog, About | CTAs | Map language style to predefined taxonomy. | Enum array | 2–5 values. Use approved taxonomy only. |
| **Visual Aesthetic** | Classify overall visual style. | Homepage imagery, Colour palette, Typography | Product imagery | Combine deterministic assets with page composition to infer visual style. | Enum array | 2–5 values. Use approved taxonomy only. |
| **Audience Personas** | Identify the primary customer segments. | Homepage messaging, Offerings, FAQs | Testimonials, Blog | Infer target audience from explicit messaging and offering focus. Group similar users into distinct personas. | Array of persona objects | Minimum 2, maximum 4 AI-generated personas. No duplicates. |

---

# **Audience Persona Matrix**

| Field | Objective | Rules |
| ----- | ----- | ----- |
| **Persona Name** | Assign a memorable label. | Should describe the segment, not a demographic ("Busy Professionals", "First-time IVF Patients"). |
| **Age Range** | Estimate primary age band. | Use explicit evidence where available; otherwise infer conservatively. |
| **Gender** | Identify dominant gender, if applicable. | Use "All" where evidence does not indicate a preference. |
| **Geography** | Identify the primary customer geography. | Derived from messaging and service availability, not company headquarters. |
| **Affluence Score** | Estimate purchasing power. | Based on pricing signals, positioning and offering type. |
| **Traits** | Describe motivations and behaviours. | 3–6 predefined traits. No free-form paragraphs. |

---

# **Tone of Voice Matrix**

| Attribute | Definition |
| ----- | ----- |
| Educational | Focuses on teaching and explaining. |
| Scientific | Evidence-driven and clinical. |
| Friendly | Warm, approachable and conversational. |
| Premium | Sophisticated and aspirational. |
| Minimalist | Clear, concise and uncluttered. |
| Playful | Informal and energetic. |
| Authoritative | Expert-led and confident. |
| Technical | Detailed and feature-oriented. |
| Community Driven | Emphasises belonging and participation. |

---

# **Visual Aesthetic Matrix**

| Attribute | Definition |
| ----- | ----- |
| Minimalist | Clean layouts with ample whitespace. |
| Clinical | Trust-focused, sterile, professional. |
| Luxury | Premium finishes and aspirational imagery. |
| Modern | Contemporary design patterns. |
| Vibrant | Bold colours and energetic visuals. |
| Natural | Earthy palettes and organic imagery. |
| Lifestyle | Real-world usage and aspirational contexts. |
| Corporate | Business-focused, formal presentation. |

---

# **Confidence Assignment Rules**

| Confidence | Rule |
| ----- | ----- |
| 95–100 | Multiple explicit evidence sources support the field. |
| 85–94 | Single explicit evidence source. |
| 70–84 | Strong inference from multiple consistent signals. |
| 50–69 | Weak inference. |
| \<50 | Insufficient evidence. Return `UNKNOWN` where appropriate. |

---

# **Evidence Priority**

Every field should follow the same evidence hierarchy:

1. Explicit website statements.  
2. Structured website sections (Homepage, About, Services).  
3. Cross-page consistency.  
4. Supporting imagery or design.  
5. Conservative inference.

No field should rely on general world knowledge or model memory.

---

I consider this **Instruction Matrix** to be more valuable than the prompt itself. The prompt becomes a mechanical transformation of these rules into Gemini instructions. If, six months from now, you decide to change how **Brand Positioning** or **Audience Personas** should be generated, you'll update one row in this matrix rather than rewriting a 700-line prompt. This also makes prompt reviews much easier because business logic and prompt wording remain cleanly separated.

