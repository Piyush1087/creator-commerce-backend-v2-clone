## **Brand DNA: Products**

**Tab label:** `Focus Products` 

**Screen headline:** `Your product catalogue` 

**Subline:** `We've pulled your top sellers, new launches, and active collections. Edit or reorder as needed.`

**Sections:**

**State:** `Industry` **is** `D2C/ e-commerce`

* `🏆 Top Sellers` — *Products with the most visibility on your site* `{Product image, Product name}`  
* `📦 Collections` — *Product groupings we detected*  `{Collection image, Collection name}`  
* `🏷️ Discount Codes & Offers` — *Active promotions we found*

**State:** `Industry` **is** `D2C/ e-commerce`

* `🏆 Top Sellers` — *Products with the most visibility on your site* `{Product name , Product short description}`  
*   
* `🏷️`  `Free Trial/Offer Name, Description, Coupon Code`

**State:** `Industry` **is** `Healthcare`

* `🏆 Treatment & Services` — *Treatments with the most visibility on your site* `{Treatment name , Treatment short description}`  
* `Locations (multi) & Contact Details`  
* `🏷️`  `Consultation Offer, Description, Coupon Code`

**State:** `Industry` **is** `Offline services`

* `🏆 Services` — *Services with the most visibility on your site* `{Service Image, Service Name, Starting Price}`  
* `Locations (multi) & Contact Details`  
* `🏷️`  `Offer Name, Description, Referral Code`

**Edit state ():** `Add , Remove` 

**Inline tip:** `💡 These Products/ services are your key business drivers and will be focus of creator collaborations.`

**CTA:** `Next →`

**CTA**

For **Step 4: Products**, Zod validation is the primary line of defense against "cross-domain" pollution and industry-specific data gaps.

Because the "Add a Product" feature triggers a mini-scan, the validation must ensure that any manually added URL belongs to the brand and that the resulting data matches the specific industry requirements (e.g., Price for Offline Services).

### **The Step 4 Master Schema**

TypeScript

import { z } from "zod";

// 1\. URL GATEKEEPING (Domain Verification)  
const ProductUrlSchema \= z.string()  
  .url("Please enter a valid URL")  
  .refine((url) \=\> {  
    // Logic: Extract hostname from input and compare to stored brand root domain  
    // Example: input 'https://thesolvedskin.com/product' vs root 'thesolvedskin.com'  
    try {  
      const urlHost \= new URL(url).hostname.replace('www.', '');  
      // This 'brandRootDomain' would be passed from your Step 1/Step 2 state  
      return urlHost \=== brandRootDomain.replace('www.', '');  
    } catch {  
      return false;  
    }  
  }, {  
    message: "Security Error: You can only add products from your own website domain."  
  });

// 2\. INDUSTRY-SPECIFIC PRODUCT SCHEMAS  
const D2CProductSchema \= z.object({  
  name: z.string().min(1, "Product name is required"),  
  image\_url: z.string().url().nullable(),  
  description: z.string().max(150, "Keep descriptions short for creator mobile view").nullable(),  
});

const HealthcareTreatmentSchema \= z.object({  
  name: z.string().min(1, "Treatment name is required"),  
  description: z.string().max(250, "Detailed treatments need clear descriptions").min(10),  
  location\_ids: z.array(z.string()).min(1, "Assign this treatment to at least one clinic location"),  
});

const OfflineServiceSchema \= z.object({  
  name: z.string().min(1),  
  image\_url: z.string().url().nullable(),  
  starting\_price: z.object({  
    amount: z.number().positive("Price must be a positive number"),  
    currency: z.string().length(3).default("USD"),  
  }).nullable(), // Nullable only if the UI handles "Price on Enquiry"  
});

// 3\. PROMO & OFFER VALIDATION  
const PromoSchema \= z.object({  
  title: z.string().min(1, "Offer title required"),  
  description: z.string().max(100),  
  code: z.string().nullable(), // Nullable for auto-applied discounts  
  link: z.string().url().optional(),  
});

// 4\. THE COMPOSITE VALIDATOR  
export const Step4CatalogueSchema \= z.object({  
  industry: z.enum(\["D2C", "Healthcare", "Offline\_Services", "AI\_SaaS"\]),  
  products: z.array(z.union(\[  
    D2CProductSchema,  
    HealthcareTreatmentSchema,  
    OfflineServiceSchema  
  \])),  
  promos: z.array(PromoSchema),  
});

---

### **Strategic Validations for the Developer**

#### **1\. The "Domain Lock" Logic**

The .refine method on the URL is your most important "Hard Error." It prevents "Garbage In" by ensuring the user doesn't accidentally (or intentionally) paste a link to a competitor's site or an Amazon affiliate link.

#### **2\. Character Limits for Creators**

Note the max(150) on descriptions. Since these products appear in a mobile app for Creators, Zod ensures the brand manager doesn't paste a 1,000-word product manual. This keeps the Campaign Brief "Creator-friendly."

#### **3\. Healthcare Location Mapping**

For **Healthcare**, the schema includes location\_ids. In Step 4, the user must link a treatment to a clinic location found in Step 2\. Zod validates that every treatment has at least one associated location so lead-generation doesn't fail later.

#### **4\. The "Add Manual" Fallback**

If the AI scan of a URL fails to find an image or a name, the developer should use safeParse. If it fails, the UI should stay in the "Editing" card mode and highlight the missing fields (e.g., "We couldn't find a name for this link, please enter it manually").

### **UI Feedback Loop**

* **On Paste:** Validate URL domain immediately.  
* **On Scan Success:** Validate the resulting object against the industry-specific schema.  
* **On "Next" Click:** Validate the entire catalogue (Ensure at least one product/treatment exists).

**Next Step: Step 5: Competitors. Shall we look at how to validate the "Why are they a competitor" narrative to ensure it provides actual value for the AI campaign strategy?**

