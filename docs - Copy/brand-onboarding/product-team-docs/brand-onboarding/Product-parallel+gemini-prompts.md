### **1\. Data Architecture: The Three-Tier Industry Schema**

We will update our "clean slate" backend to store these attributes.

**Table: brand\_discovery (Updated)**

* **industry**: The primary vertical (e.g., D2C, AI/SaaS, Healthcare, Offline Services).  
* **sub\_industry**: A mid-level category (e.g., for D2C: "Beauty & Wellness"; for SaaS: "Productivity Tools").  
* **industry\_niche**: A granular identifier used for creator matching (e.g., "Eco-friendly Skincare" or "Notion Templates").  
* **is\_supported**: Boolean (Determines if the brand passes Step 1).

---

### **2\. Identification Logic: Step-by-Step**

#### **Phase A: Landing Page (The Industry Gate)**

* **Method**: Lightweight Semantic Scan (Gemini 1.5 Flash).  
* **Timing**: Occurs during the "rhythmic pulse" animation before Modal 1 appears.  
* **Prompt Goal**: Identify only the high-level **Industry**.  
* **Logic**:  
  * If the AI identifies the URL as **Healthcare**, it marks is\_supported: true and triggers the "Brand Verified" check.  
  * If it identifies it as **Real Estate**, it marks is\_supported: false, captures the industry in the database for your intelligence reports, and triggers the "Regret State" UI.

#### **Phase B: Real-Time Scan (Sub-Industry & Niche)**

* **Method**: Deep Intelligence Scan (Parallel.ai \+ Gemini).  
* **Timing**: Triggered during the Step 2 "Scanning" animation ("Extracting Tone," "Auditing Products").  
* **Action**: The AI crawls product descriptions (PDPs) and metadata to define the sub-industry and niche.  
* **Example Outcome**:  
  * **Industry**: D2C.  
  * **Sub-Industry**: Sustainable Apparel.  
  * **Industry Niche**: Bamboo-based Activewear for Yoga.

---

### **3\. The Intelligence Logic for Rejected Industries**

To help you decide which industry to open next, every rejection is treated as a "Silent Lead."

**Table: market\_intelligence\_rejections**

* **rejected\_url**: The domain entered.  
* **detected\_industry**: (e.g., Real Estate, EdTech, Non-Profit).  
* **attempt\_count**: How many times this domain or industry has been entered.

---

### **4\. Prompt Engineering for Identification**

While the user sees the Step 1 "Pulse," the following prompt runs to determine the path:

**System Prompt: industry\_classifier**

"Analyze the landing page of {{brand\_url}}.

**Task 1**: Categorize it into one of these: \[D2C, AI/SaaS, Healthcare, Offline Services, Other\].

**Task 2**: If 'Other', specify the industry (e.g., 'Real Estate').

**Constraint**: Return ONLY the high-level Industry for the gatekeeper logic

### **Revised Parallel.ai Surface Scan Prompts**

#### **Prompt 1: The Identity & Persona Shell (Powers Step 3\)**

* **Target URLs:** {{url}}, {{url}}/about  
* **Objective:** Extract the brand’s "Visual & Verbal Surface."  
* **Prompt Instruction:**

"Analyze the homepage and about page of {{url}}.

1. **Identity:** Find official Brand Name, Logo URL, and Social Media links (IG/TikTok).  
2. **Description:** Extract the 'Tagline' and a 'Short Brand Description' (max 200 chars).  
3. **Visuals:** Identify the dominant hex color codes and primary font families used in headers.  
4. **Tone & Aesthetic:** Provide 3 tags for 'Tone of Voice' (e.g., Playful, Clinical) and 2 tags for 'Visual Aesthetic' (e.g., Clean, Bold).  
5. **Audience:** Based on landing page imagery, suggest a 'Persona Name' and target 'Age Range'.  
   **Refusal:** If any field is missing, return null. Do not look for 'Do Not Say' or 'Values' yet."

#### **Prompt 2: The Product/Service Inventory (Powers Step 4\)**

* **Target URLs:** {{url}}/shop, {{url}}/collections, {{url}}/services, or {{url}}/treatments  
* **Objective:** Identify the "Top Shelf" items for the catalog view.  
* **Prompt Instruction:**

"Crawl the main navigation menu and the primary shop/services page.

1. **Inventory:** List the first 6 products or services found. For each, extract: **Name**, **Image URL**, and **Starting Price**.  
2. **Categorization:** Identify 2-3 'Collections' or 'Service Categories' (e.g., 'Bestsellers', 'Skincare', 'Dental Surgery').  
3. **Active Offers:** Find the name and coupon code for any visible banner offers (e.g., '10% off', 'Free Trial').  
4. **Healthcare/Offline:** If addresses are visible in the footer, extract the City and Name of the locations.  
   **Constraint:** Do not click into individual product pages. Extract only from the list view."

#### **Prompt 3: The Competitor & Niche Map (Powers Step 5\)**

* **Target URLs:** {{url}} (Metadata/SEO tags), Search Engine API (via Parallel.ai)  
* **Objective:** Find industry rivals to populate the Step 5 carousel.  
* **Prompt Instruction:**

"Based on the brand name {{brand\_name}} and industry {{industry}}, identify 4-5 direct competitors.

1. **Data Points:** For each, find the **Name**, **Logo URL**, and **Website URL**.  
2. **Context:** Provide a 1-sentence 'Why they are a competitor' (e.g., 'Direct rival in affordable clinical skincare').  
   **Refusal:** If clear competitors cannot be identified via site metadata or linked ecosystem, return an empty array."

---

### **How this fulfills Steps 3, 4, and 5 (Sneak Peek Logic)**

| UI Screen | Data Required | Parallel.ai Fulfillment |
| :---- | :---- | :---- |
| **Step 3: Identity** | Colors, Fonts, Tone Tags, Description | **Prompt 1** provides the shell for the user to review. |
| **Step 4: Products** | Image \+ Name carousel | **Prompt 2** fetches the "Surface" list without expensive PDP crawls. |
| **Step 5: Competitors** | Logo \+ Name \+ "Why" tag | **Prompt 3** identifies the market rivals. |

### **The "Deep Scan" Trigger Logic**

By limiting extraction here, your developer saves \~70% of the AI processing cost. The **Deep Scan** (extracting the USPs, KSPs, and "Do Not Say" list) is only triggered when the user clicks **"Looks good, next →"** at the end of Step 3\.

**Strategic Benefit:** In Step 2, the user sees a "Processing..." screen for only 8-10 seconds (the time it takes to crawl 3-4 top-level pages). Because you aren't asking Gemini to summarize 10 different product pages yet, the "Surface Scan" feels instantaneous to the user.

**Should we update the Zod validation to include these specific "Surface" fields for the Developer Documentation?**

Gemini prompt   
**The Revised Gemini Surface Scan Prompt**

**System Role:** \> "You are the **Brand Discovery Engine**. Your goal is to identify the 'Identity Shell' of a business. You must provide structured JSON for visual identity, product inventory, and competitor mapping. **Strict Refusal Logic:** If data is missing, return `null`. Do not guess features, prices, or values that are not explicitly stated."

**The Prompt Body:**

"Analyze the provided crawl data for `{{brand_name}}`. Generate a JSON response for the following three sections:

**1\. Visual & Verbal Identity (Step 3 Preview):**

* Extract the official logo URL and social media links.  
* Identify the **Primary Hex Colors** and **Fonts** used on the site.  
* Generate 3 **Tone of Voice** tags (e.g., 'Clinical', 'Approachable').  
* Generate 2 **Visual Aesthetic** tags (e.g., 'Minimalist', 'Vibrant').  
* Identify the **Audience Persona**: Name (e.g., 'The Urban Skincare Enthusiast'), Age Range, and 3 Traits.

**2\. Product/Service Inventory (Step 4 Preview):**

* List up to 6 flagship products or services.  
* For each, extract only: `name`, `image_url`, and `starting_price` (if visible).  
* Categorize them by **Specialty** (for Healthcare) or **Collection** (for D2C).  
* **Note:** Do not write descriptions or USPs yet.

**3\. Competitor Mapping (Step 5 Preview):**

* Based on the brand's industry and metadata, identify 3-5 competitors.  
* For each: Provide `name`, `website_url`, and a **Logo URL**.  
* Write a 1-sentence **'Why they are a competitor'** (e.g., 'Direct rival in premium organic haircare').

**Output Format:** Strict JSON following the `Step2SurfaceScanSchema`

Backeend suggestion

Check current backend and make sure all required and fetched values are there if not update schema only after discusses about additional fields