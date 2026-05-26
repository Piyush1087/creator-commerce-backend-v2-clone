

## **Brand DNA: About & Visual Identity**

**Tab label:** `Brand Identity` 

**Screen headline:** `Here's what we found about your brand` 

**Subline:** `Review and edit anything that looks off. This shapes everything we build for you.`

Microcopy : `You can always edit this later in the Brand Centre`

**Section: About**

* Field labels: `Brand Name`, `Brand Logo, Social Handle (s), Industry`, `Sub- Industry, Industry Niche`, `Tagline`, `Brand Description`  
* Helper under description: `This is how your brand will be introduced to influencers in campaign briefs.`

**Section: Visual Identity**

* `Colour Palette` — *We extracted these from your website. Add or remove colours.*  
* `Fonts` — *Wherever possible, creators will use this typography*  
* `Tone of voice`— *How your brand communicates.* Tags: e.g. {`Empowering: Focus on giving the user control back over their skin}.{Minimalist: Advocate for "simplifying skincare routines."}`  
* `Visual Aesthetic` — Tags: e.g. `Clean & Clinical`, `Bold & Expressive`

**Section: Brand ValuesIdentity**

*  `Brand Description`  
* `Brand Values` — Tags pulled from site copy  
* `Policy regulations (do not say)` — Potential policy flags while doing influencer collaboration


**Section: Audience Persona**

* Field labels: `Persona Name`, `Country, Age, Affluence score, Audience traits`  
* Helper under description: `We will look for audience match with prospective Creators`

**Inline edit prompt:** `✏️ Click any field to edit`

**CTA:** `Looks good, next →` **Secondary:** `← I’ll change it later`

### **1\. Interaction Logic: The "Edit & Sync" Flow**

The user sees the "Surface Scan" results. Any change they make must trigger a targeted update to the brand\_profiles table.

* **Atomic Updates:** Do not wait for the user to click "Next" to save everything. If a user edits the "Tagline," the frontend should perform an individual PATCH request to the backend. This ensures no data is lost if they drop off.  
* **The "User Overwrite" Flag:** In your database, add a boolean column is\_user\_edited. If the user changes a field (e.g., Tone of Voice), set this to true. This tells the **Phase 2 (Deep Scan)** AI: *"Do not overwrite this specific field; the user has already manually set it."*

---

### **2\. Checks and Balances (Anti-Garbage Logic)**

Since this data eventually feeds into Creator Briefs, "garbage in" means "bad creator content." We implement three types of checks:

#### **A. Length & Format Constraints (Zod Frontend Validation)**

Every input field should have an "Active Guardrail":

* **Brand Description:** Max 500 chars. If they paste 2000 words, show a warning: *"Briefs work best with concise descriptions. Please trim this down."*  
* **Logo URL:** Must be a valid image format (PNG, JPG, SVG).  
* **Hex Colors:** Must match ^\#(\[A-Fa-f0-9\]{6}|\[A-Fa-f0-9\]{3})$.

#### **B. Logical Warnings (The "AI Auditor")**

If a user adds something that contradicts their brand profile, show a soft warning (Yellow Toast):

* **Industry Mismatch:** If the user changes the industry from "Healthcare" to "D2C," show: *"💡 Changing industry will reset your Treatment/Service categories. Are you sure?"*  
* **Empty States:** If a user deletes all "Core Values," show: *"⚠️ Core Values are used to match you with the right creators. Leaving this empty may reduce match quality."*

#### **C. "Sanity" Sanitization (Backend)**

Before saving to the DB, the backend should:

* **Trim Whitespace:** Clean up accidental spaces.  
* **HTML Stripping:** Prevent users from pasting code or scripts into description fields.  
* **Sentiment/Safety Check:** (Optional) Use a lightweight regex or a quick Gemini check to ensure no offensive language is being added to the "Brand Description."

---

### **3\. Specific Field Logic for Step 3**

Based on the **Brand DNA: About & Visual Identity.docx**, here is how to handle the complex fields:

| Field | Add/Remove Logic | Check/Balance |
| :---- | :---- | :---- |
| **Colour Palette** | "Add Color" (Color Picker) / "X" to delete. | Prevent more than 8 colors (too many colors dilute brand identity). |
| **Tone of Voice** | Tag Cloud. User can type a new tag. | Use a "Suggested Tags" dropdown to steer them toward useful marketing terms (e.g., "Professional," "Whimsical"). |
| **Policy (Do Not Say)** | Bulleted list. | **Critical Check:** If they delete a policy flag found by AI, show: *"⚠️ This policy was found in your Terms. Removing it may lead to creator compliance issues."* |
| **Audience Traits** | Text tags. | Limit to 5 tags to ensure the audience definition doesn't become too broad. |

---

### **4\. Developer Instruction: The "Manual Edit" API**

The developer needs to build a dedicated endpoint for this screen:

**PATCH /api/v1/brand/identity-review**

* **Payload:** Partial JSON (e.g., { "tagline": "New Tagline" })  
* **Logic:** 1\. Validate via Zod.  
  2\. Update brand\_profiles.  
  3\. Update is\_user\_edited \= true for that specific key.  
  4\. Return 200 OK to remove the "Saving..." spinner in the UI.

### **5\. Transition to Step 4**

When the user clicks **"Looks good, next →"**:

1. Final validation check on all required fields.  
2. Transition the UI to **Step 4: Products**.

### **1\. Interaction Logic: The "Edit & Sync" Flow**

The user sees the "Surface Scan" results. Any change they make must trigger a targeted update to the brand\_profiles table.

* **Atomic Updates:** Do not wait for the user to click "Next" to save everything. If a user edits the "Tagline," the frontend should perform an individual PATCH request to the backend. This ensures no data is lost if they drop off.  
* **The "User Overwrite" Flag:** In your database, add a boolean column is\_user\_edited. If the user changes a field (e.g., Tone of Voice), set this to true. This tells the **Phase 2 (Deep Scan)** AI: *"Do not overwrite this specific field; the user has already manually set it."*

---

### **2\. Checks and Balances (Anti-Garbage Logic)**

Since this data eventually feeds into Creator Briefs, "garbage in" means "bad creator content." We implement three types of checks:

#### **A. Length & Format Constraints (Zod Frontend Validation)**

Every input field should have an "Active Guardrail":

* **Brand Description:** Max 500 chars. If they paste 2000 words, show a warning: *"Briefs work best with concise descriptions. Please trim this down."*  
* **Logo URL:** Must be a valid image format (PNG, JPG, SVG).  
* **Hex Colors:** Must match ^\#(\[A-Fa-f0-9\]{6}|\[A-Fa-f0-9\]{3})$.

#### **B. Logical Warnings (The "AI Auditor")**

If a user adds something that contradicts their brand profile, show a soft warning (Yellow Toast):

* **Industry Mismatch:** If the user changes the industry from "Healthcare" to "D2C," show: *"💡 Changing industry will reset your Treatment/Service categories. Are you sure?"*  
* **Empty States:** If a user deletes all "Core Values," show: *"⚠️ Core Values are used to match you with the right creators. Leaving this empty may reduce match quality."*

#### **C. "Sanity" Sanitization (Backend)**

Before saving to the DB, the backend should:

* **Trim Whitespace:** Clean up accidental spaces.  
* **HTML Stripping:** Prevent users from pasting code or scripts into description fields.  
* **Sentiment/Safety Check:** (Optional) Use a lightweight regex or a quick Gemini check to ensure no offensive language is being added to the "Brand Description."

---

### **3\. Specific Field Logic for Step 3**

Based on the **Brand DNA: About & Visual Identity.docx**, here is how to handle the complex fields:

| Field | Add/Remove Logic | Check/Balance |
| :---- | :---- | :---- |
| **Colour Palette** | "Add Color" (Color Picker) / "X" to delete. | Prevent more than 8 colors (too many colors dilute brand identity). |
| **Tone of Voice** | Tag Cloud. User can type a new tag. | Use a "Suggested Tags" dropdown to steer them toward useful marketing terms (e.g., "Professional," "Whimsical"). |
| **Policy (Do Not Say)** | Bulleted list. | **Critical Check:** If they delete a policy flag found by AI, show: *"⚠️ This policy was found in your Terms. Removing it may lead to creator compliance issues."* |
| **Audience Traits** | Text tags. | Limit to 5 tags to ensure the audience definition doesn't become too broad. |

---

### **4\. Developer Instruction: The "Manual Edit" API**

The developer needs to build a dedicated endpoint for this screen:

**PATCH /api/v1/brand/identity-review**

* **Payload:** Partial JSON (e.g., { "tagline": "New Tagline" })  
* **Logic:** 1\. Validate via Zod.  
  2\. Update brand\_profiles.  
  3\. Update is\_user\_edited \= true for that specific key.  
  4\. Return 200 OK to remove the "Saving..." spinner in the UI.

### **5\. Transition to Step 4**

When the user clicks **"Looks good, next →"**:

1. Final validation check on all required fields.  
2. Transition the UI to **Step 4: Products**.

