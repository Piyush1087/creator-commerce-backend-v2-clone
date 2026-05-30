  
This is alternative approach, where we split the data extraction step 2 to surface level (product name etc.) and detailed scan postbrand email verification

### **1\. The Benefit of Splitting: "Surface Scan" vs. "Deep Audit"**

| Feature | Phase 1: Surface Scan (Step 2\) | Phase 2: Deep Audit (Post-Verification) |
| :---- | :---- | :---- |
| **Goal** | Identify the brand's "Inventory" (Who are you? What do you sell? Who are your rivals?) | Extract "Strategy" (Why does it sell? What are the hooks? What is the compliance?) |
| **UI Need** | Powers the sneak peeks in Steps 3, 4, and 5\. | Powers the Add a Product details and Campaign Briefs later. |
| **Cost** | Low (Parallel.ai only crawls top-level pages). | High (Deep PDP crawls \+ intense Gemini synthesis). |
| **Speed** | 5–10 seconds (Instant gratification). | 20–40 seconds (Background process). |
| **Risk** | Zero dollar loss if the user fails email verification. | Full investment only in verified, high-intent users. |

### **2\. Revised Step 2 Strategy: The Discovery Phase**

In Step 2, we change our Parallel.ai \+ Gemini prompts to focus on **Discovery** only. We are building the "Identity Shell."

#### **Phase 1 Extraction Fields (The "Identity Shell"):**

1. **Brand Identity:** Name, Logo, Social Handles, Industry, Tagline.  
2. **Product Inventory:** A list of Product/Treatment **Names** and **Images** only (No USPs/KSPs yet).  
3. **Competitor Inventory:** A list of Competitor **Names**, **Logos**, and **Links** (No "Why they are a competitor" yet).

---

### **3\. Updated Developer Orchestration for Step 2**

The developer will now treat Step 2 as a **Discovery Pipeline**. The "Deep Audit" prompts we discussed previously are moved to a background worker that triggers only once the brand is verified.

#### **Step 2: The "Discovery" Handoff**

1. **Parallel.ai Crawler:** \* Target: Homepage, /About, /Collections (or /Services), and Meta/Social links.  
   * Objective: Just "find" the items.  
2. **Gemini Synthesizer:**  
   * Instruction: "Return a JSON list of products found (Name \+ Image) and competitors suggested by the site metadata. Do not analyze descriptions."  
3. **Database Storage:**  
   * The brand\_offerings table is created with name and image\_url. The narrative and price\_points remain null for now.

---

### **4\. Updated Zod Validation (Phase 1 Only)**

Since we are only doing a "Surface Scan," the Zod validation becomes much leaner. This prevents Step 2 from failing if deep data (like a USP) is missing.

TypeScript  
// SURFACE SCAN SCHEMA (Step 2 Only)  
export const DiscoverySchema \= z.object({  
  brand\_identity: z.object({  
    name: z.string(),  
    logo\_url: z.string().url().nullable(),  
    social\_handles: z.array(z.string().url()),  
  }),  
  // For Step 4 Sneak Peak  
  product\_sneak\_peak: z.array(z.object({  
    name: z.string(),  
    image\_url: z.string().url().nullable(),  
  })).min(1), // Ensure we found at least one thing to show  
  // For Step 5 Sneak Peak  
  competitor\_sneak\_peak: z.array(z.object({  
    name: z.string(),  
    logo\_url: z.string().url().nullable(),  
    url: z.string().url(),  
  })).max(5)  
});

---

### **5\. Transition to "Deep Scan" (Post-Verification)**

Once the user completes **Step 2 (Verification)** and moves into the **Step 3-4-5 Review**, the backend triggers the second half of the AI budget:

1. **Trigger:** User verifies email OR clicks "Looks good, next →" on Step 3\.  
2. **Action:** The "Deep Audit" prompts (from our previous sessions) are sent to Parallel.ai to crawl the specific Product URLs the user just confirmed.  
3. **Result:** By the time the user reaches the **Campaign Workspace**, the brand\_offerings.narrative (USPs/KSPs) and compliance\_rules are fully populated.

### **Summary of Benefit for You:**

* **Speed:** Step 2 becomes lightning fast because it’s just looking for logos and titles.  
* **Conversion:** You get the user into the "Aha\!" moment (seeing their brand identity and products in your UI) much faster.  
* **Protection:** You don't pay Gemini to summarize 10 product pages for a user who hasn't even verified their email.

To ensure your backend acts as a high-fidelity "Brand Library," the data must be stored in a relational structure that separate core identity from tactical offerings. This allows the system to call "Locations" for an offline brand but ignore them for a pure SaaS brand.

### **The "Master Library" Backend Schema**

The developer should implement a **Relational Master-Detail Schema**. This ensures that the results from the **Step 2 Parallel Scan** are stored once and can be reused by the **Brand Centre**, **Add a Product**, or **Campaign Brief** modules.

#### **1\. Table: brands (The Core DNA)**

* **id**: UUID (Primary Key)  
* **industry\_id**: ENUM (Healthcare, SaaS, Offline, D2C)  
* **identity\_data**: JSONB  
  * *Stores:* brand\_name, logo\_url, social\_handles, industry\_niche.  
* **strategy\_dna**: JSONB  
  * *Stores:* mission\_statement, core\_values\[\], brand\_tone.  
* **compliance\_guardrails**: JSONB  
  * *Stores:* do\_not\_say\[\] (The high-contrast policy regulations extracted by Gemini).

#### **2\. Table: brand\_locations (Infrastructure Layer)**

*This handles your requirement for multi-location clinics or service venues.*

* **id**: UUID  
* **brand\_id**: FK (References brands.id)  
* **location\_name**: String (e.g., "Downtown Wellness Center")  
* **address\_data**: JSONB (street, city, zip, lat\_long)  
* **contact\_meta**: JSONB (phone, email, operating\_hours, booking\_url)  
* **site\_specialties**: Array (e.g., \["Dermatology", "General Surgery"\])

#### **3\. Table: brand\_offerings (Asset Layer)**

*The master repository for the "Add a Product" carousel.*

* **id**: UUID  
* **brand\_id**: FK  
* **source\_url**: String (The exact Product/Treatment URL found by Parallel.ai)  
* **offering\_type**: String (Treatment, Product, Service, SaaS\_Plan)  
* **identity**: JSONB (name, image\_url, price\_data)  
* **narrative**: JSONB  
  * *Stores:* primary\_usp, key\_selling\_points\[\], audience\_segment.  
* **category\_tag**: String (e.g., "Cosmetic Dentistry") — *Links a treatment to a healthcare specialty.*  
* **promos**: JSONB (Extracted codes or consultation offers).

---

### **Mapping Table: From Parallel.ai Output → Backend Storage**

The developer must use this mapping to route the Gemini-synthesized JSON into the database:

| Parallel.ai Data Source | Gemini Transformation | Database Column |
| :---- | :---- | :---- |
| **Header/Footer Text** | Identifies official name/socials | brands.identity\_data |
| **"About Us" Page** | Synthesizes 3 Core Values | brands.strategy\_dna |
| **"Terms/Policy" Page** | Extracts restricted phrases | brands.compliance\_guardrails |
| **"Locations" Page** | Parses addresses & hours | brand\_locations |
| **"/Products" Page** | Lists URLs, names, and images | brand\_offerings.identity |
| **"Product/Service" URL** | Writes USP & 3 KSPs | brand\_offerings.narrative |

---

### **Execution Workflow for the Developer**

To keep the UI responsive, the developer should implement a **Stream-to-DB** logic.

1. **Orchestration:** The developer launches three parallel threads (Identity, Locations, Products).  
2. **Sequential Synthesis:** As each Parallel.ai crawl finishes, it hits Gemini for formatting.  
3. **Atomic Updates:** The developer performs "Upserts" (Update or Insert) into the database.  
   * *Example:* If Pipeline A finishes first, the brand\_profiles table is populated immediately. The user sees "Brand DNA Found" on the UI while Pipeline C is still crawling products.  
4. **The "Add a Product" Call:** When the user enters the next module, the frontend simply queries:  
   SELECT \* FROM brand\_offerings WHERE brand\_id \= {{id}}  
   The carousel is populated instantly because the work was done in the background.

import { z } from "zod";

// 1\. BRAND IDENTITY & VISUALS (Powers Step 3\)  
const Step3DiscoverySchema \= z.object({  
  brand\_name: z.string().min(1),  
  logo\_url: z.string().url().nullable(),  
  social\_handles: z.array(z.string().url()).default(\[\]),  
  industry\_niche: z.string().min(1),  
  tagline: z.string().max(150).nullable(),  
  brand\_description: z.string().max(500).nullable(),  
    
  // Visuals for Step 3 Preview  
  visual\_identity: z.object({  
    colors: z.array(z.string().regex(/^\#/)).max(5), // Hex codes  
    fonts: z.array(z.string()).max(3),  
    tone\_tags: z.array(z.string()).max(3), // e.g. \["Empowering", "Minimalist"\]  
    aesthetic\_tags: z.array(z.string()).max(3), // e.g. \["Clean", "Clinical"\]  
  }),

  // Audience Sneak Peek  
  audience\_persona: z.object({  
    persona\_name: z.string().nullable(),  
    age\_range: z.string().nullable(),  
    traits: z.array(z.string()).max(5),  
  }).nullable(),  
});

// 2\. PRODUCT/SERVICE SNEAK PEEK (Powers Step 4\)  
const Step4DiscoverySchema \= z.object({  
  name: z.string(),  
  image\_url: z.string().url().nullable(),  
  price\_label: z.string().optional(), // e.g., "Starting at $50"  
  category\_tag: z.string().nullable(), // Specialty (Healthcare) or Collection (D2C)  
});

// 3\. COMPETITOR SNEAK PEEK (Powers Step 5\)  
const Step5DiscoverySchema \= z.object({  
  name: z.string(),  
  logo\_url: z.string().url().nullable(),  
  website\_url: z.string().url(),  
  context\_tag: z.string().max(200).nullable(), // "Why they are a competitor"  
});

// MASTER STEP 2 OUTPUT  
export const Step2SurfaceScanSchema \= z.object({  
  brand: Step3DiscoverySchema,  
  products: z.array(Step4DiscoverySchema).min(1), // Must find at least 1 product  
  competitors: z.array(Step5DiscoverySchema).max(5),  
});

Instruct your developer to use **`db.upsert()`** logic.

* **Step 2** creates the record using the **Discovery Schema**.  
* **Post-Verification** updates the *same* record with the strategic content.

This prevents duplicate products and ensures that any manual edits the user makes in Step 3 or 4 are not overwritten by the Deep Scan (the AI should only fill in `null` fields).

# **Developer Documentation: Step 2 – Surface Scan Discovery**

## **1\. Execution Strategy: "Discovery vs. Audit"**

Step 2 is now a **Surface Scan**. It focuses on **Inventory** (What exists?) rather than **Strategy** (Why it matters?).

* **Parallel.ai Task:** Crawl only top-level pages (Home, About, Shop/Service List).  
* **Gemini Task:** Identify names, images, and visual tags.  
* **Timing:** Must complete in \< 10 seconds.  
* **Cost Logic:** Minimizes token spend before brand verification.

## **2\. Updated API Orchestration**

The developer must trigger three parallel "Surface" threads.

### **Thread A: Brand Identity & Visuals (Step 3\)**

* **Source:** `{{domain}}`, `{{domain}}/about`  
* **Objective:** Extract logo, tagline, brand description, colors, fonts, and tone tags.

### **Thread B: Product/Service Catalog (Step 4\)**

* **Source:** `{{domain}}/shop`, `{{domain}}/services`, or `{{domain}}/treatments`  
* **Objective:** Find the top 6 product/service **names**, **images**, and **categories**.  
* **Constraint:** Do not follow links to individual product pages.

### **Thread C: Market Context (Step 5\)**

* **Source:** `{{domain}}` SEO metadata \+ Industry Search.  
* **Objective:** Identify 3-5 competitor **names**, **logos**, and **URLs**.

---

## **3\. Revised Zod Validation (The Quality Gate)**

Every JSON payload from the AI must be validated against this schema before the database `INSERT`.

TypeScript  
import { z } from "zod";

export const SurfaceScanSchema \= z.object({  
  // Section 1: Identity Shell (Powers Step 3\)  
  identity: z.object({  
    name: z.string().min(1),  
    logo\_url: z.string().url().nullable(),  
    social\_handles: z.array(z.string().url()).max(3),  
    tagline: z.string().max(150).nullable(),  
    description: z.string().max(500).nullable(),  
    visuals: z.object({  
      colors: z.array(z.string().regex(/^\#/)).max(5), // Hex codes  
      fonts: z.array(z.string()).max(3),  
      tone\_tags: z.array(z.string()).max(3),  
    })  
  }),

  // Section 2: Product Sneak Peek (Powers Step 4\)  
  products: z.array(z.object({  
    name: z.string(),  
    image\_url: z.string().url().nullable(),  
    category: z.string().nullable(), // Specialty for Healthcare  
    starting\_price: z.string().optional().nullable(),  
  })).min(1),

  // Section 3: Competitor Sneak Peek (Powers Step 5\)  
  competitors: z.array(z.object({  
    name: z.string(),  
    logo\_url: z.string().url().nullable(),  
    website\_url: z.string().url(),  
    context\_tag: z.string().max(200).nullable(), // "Why they are a competitor"  
  })).max(5)  
});

---

## **4\. Backend Implementation (The "Master Tables")**

Do not change the database schema. Perform an `upsert` logic. Step 2 will fill the basic columns; Phase 2 (Deep Scan) will fill the strategic columns later.

* **Action:** `INSERT` into `brand_profiles`, `brand_locations`, and `brand_offerings`.  
* **State Management:** Set a column `is_deep_scanned = false`.  
* **Zero Inventing:** If the AI finds only 1 selling point, save 1\. If it finds 0, save an empty array. Do not allow the AI to "hallucinate" USPs at this stage.

---

## **5\. Parallel.ai \+ Gemini Prompts (Refusal First)**

### **Parallel.ai Configuration**

Plaintext  
"Mode": "Broad Discovery"  
"Depth": 1 (Top-level only)  
"Instruction": "Find lists and visual metadata. Do not navigate to individual detail pages."

### **Gemini System Instruction**

Plaintext  
"Role": "Surface Extractor"  
"Constraint": "Zero Inventing. If a logo or price is not explicitly in the raw text, return null.   
Extract 3 tone tags based on adjective frequency.   
Identify 6 products by looking for image+title pairs on the /shop or /services page."

---

## **6\. UI Synchronization & Transitions**

1. **Loader State:** Show "Reading your brand's digital footprint..."  
2. **Verification Gate:** Once the Surface Scan is saved to the DB, the UI triggers the **Brand Verification Modal** (e.g., Email code or Social login).  
3. **Handoff:** Only after verification is successful does the frontend allow the user to proceed to **Step 3: Brand Identity Review**.  
4. **Deep Scan Trigger:** At the end of Step 3 (when the user clicks "Looks good"), launch the **Background Job** for the Deep Scan (Analysis of USPs, KSPs, and Compliance).

## **7\. Error States for Developer**

* **No Products Found:** If `products` array is empty, trigger an "Input Manually" UI state for Step 4\.  
* **Logo 404:** If the extracted logo URL is broken, default to a "Brand Initials" avatar in Step 3\.  
* **Industry Mismatch:** If the site content contradicts the industry selected in Step 1, flag the record for user re-confirmation.

