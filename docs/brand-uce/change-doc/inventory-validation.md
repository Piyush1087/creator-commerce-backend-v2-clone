It replaces **Module 3: Inventory Product & Content Brief Modules** in your Zod file.

Specifically, instruct your developer to substitute the **CampaignProductInventoryInputSchema** object and its corresponding TypeScript type export **CampaignProductInventoryInput** with the updated snippet.

### **Exact Section Code Replacement**

#### **REMOVE THIS (OLD CODE):**

TypeScript  
export const CampaignProductInventoryInputSchema \= z.object({  
  campaign\_id: z.string().uuid(),  
  sku\_code: z.string().min(2, "Inventory SKU tracking elements cannot be empty descriptions.").max(150),  
  product\_name: z.string().min(1, "Product reference designations cannot render blank.").max(255),  
  inventory\_count: z.number().int().nonnegative("Available logistics distribution stock totals cannot fall below zero."),  
  cost\_per\_unit: z.number().positive("Unit asset cost valuations require valid positive currency metrics."),  
  image\_url: z.string().url().nullable().optional()  
});

#### **REPLACE WITH THIS (NEW CODE):**

TypeScript  
export const CampaignProductInputSchema \= z.object({  
  campaign\_id: z.string().uuid(),  
  sku\_code: z.string().min(2, "SKU tracking elements cannot be empty.").max(150),  
  product\_name: z.string().min(1, "Product name cannot be blank.").max(255),  
  cost\_per\_unit: z.number().positive("Unit asset cost valuations require valid positive currency metrics."),  
  image\_url: z.string().url().nullable().optional()  
});

### **Type Export Replacement (Section 6 at the bottom)**

#### **REMOVE THIS:**

TypeScript  
export type CampaignProductInventoryInput \= z.infer\<typeof CampaignProductInventoryInputSchema\>;

#### **REPLACE WITH THIS:**

TypeScript  
export type CampaignProductInput \= z.infer\<typeof CampaignProductInputSchema\>;  
