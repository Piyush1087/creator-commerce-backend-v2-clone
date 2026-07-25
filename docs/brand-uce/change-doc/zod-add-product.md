

### **B. Integrated Zod Schema Engine Validation**

This TypeScript module maps, intercepts, and cleanly validates incoming requests for the Add a Product drawer router. It uses a **Discriminated Union** strategy based on the selected asset\_type to dynamically evaluate schema criteria at runtime.  
TypeScript  
import { z } from "zod";

// \=============================================================================  
// 1\. COMPACT CORE DOMAIN MATRIX LOGIC  
// \=============================================================================  
export const AssetClassificationSchema \= z.enum(\[  
  "INDIVIDUAL\_PRODUCT\_SKU",  
  "CURATED\_COLLECTION\_LINE",  
  "CORE\_BRAND\_IDENTITY",  
  "ACTIVE\_SALE\_PROMOTION"  
\]);

export const PromotionApplicabilitySchema \= z.enum(\[  
  "SITEWIDE",  
  "SPECIFIC\_PRODUCT",  
  "SPECIFIC\_COLLECTION"  
\]);

// \=============================================================================  
// 2\. DISCRIMINATED WORKSPACE PIPELINE TARGET SUB-SCHEMAS  
// \=============================================================================

/\*\*  
 \* PATH A: INDIVIDUAL\_PRODUCT\_SKU Binding Pipeline Data Verification  
 \*/  
export const LinkProductAssetPayloadSchema \= z.object({  
  asset\_type: z.literal("INDIVIDUAL\_PRODUCT\_SKU"),  
  campaign\_id: z.string().uuid("Campaign verification identifier framework requires a clean UUID structure."),  
  product\_name: z.string().min(1, "Asset naming properties require structural label identities."),  
  price: z.number().positive("Item retail pricing thresholds cannot settle below or equal to zero assets."),  
  pdp\_url: z.string().url("Product Detail Page parameter requires standard URL domain protocols."),  
  thumbnail\_asset\_url: z.string().url().nullable(),  
  brief\_description: z.string().min(10, "Provide context-rich descriptive summaries from your Brand Centre DNA records."),  
    
  // Enforces Tab 1 configuration rule: Max 3 Unique Selling Points entries array  
  unique\_selling\_points: z.array(z.string().min(2))  
    .min(1, "Provide at least one Core Unique Selling Point.")  
    .max(3, "Brand DNA operational guidelines cap allowable USPs at 3 items."),  
      
  compliance\_do\_not\_say\_tokens: z.array(z.string()),  
  is\_sync\_locked: z.boolean().default(true)  
});

/\*\*  
 \* PATH B: CURATED\_COLLECTION\_LINE Binding Pipeline Data Verification  
 \*/  
export const LinkCollectionAssetPayloadSchema \= z.object({  
  asset\_type: z.literal("CURATED\_COLLECTION\_LINE"),  
  campaign\_id: z.string().uuid(),  
  collection\_name: z.string().min(1),  
  collection\_pdp\_url: z.string().url(),  
  collection\_thumbnail\_url: z.string().url().nullable(),  
  short\_description: z.string().min(10),  
  collection\_usps: z.array(z.string()).max(3),  
    
  // System enforces that collections contain at least one underlying child product link ID  
  linked\_product\_ids: z.array(z.string().uuid())  
    .min(1, "Curated collections require at least one attached child Product SKU ID value.")  
});

/\*\*  
 \* PATH C: CORE\_BRAND\_IDENTITY Binding Pipeline Data Verification  
 \*/  
export const LinkBrandIdentityPayloadSchema \= z.object({  
  asset\_type: z.literal("CORE\_BRAND\_IDENTITY"),  
  campaign\_id: z.string().uuid(),  
  brand\_id: z.string().uuid(),  
  corporate\_legal\_name: z.string().min(1),  
  brand\_mission\_statement: z.string().min(10),  
  global\_tone\_adjectives: z.array(z.string()).min(1)  
});

/\*\*  
 \* PATH D: ACTIVE\_SALE\_PROMOTION Binding Pipeline Data Verification  
 \*/  
export const LinkPromotionPayloadSchema \= z.object({  
  asset\_type: z.literal("ACTIVE\_SALE\_PROMOTION"),  
  campaign\_id: z.string().uuid(),  
  offer\_name: z.string().min(2, "Operational promotion names require tracking handles."),  
  brief\_description: z.string().min(5),  
  offer\_code: z.string().min(1, "Voucher transactions require alphanumeric tracking tokens."),  
  applicability: PromotionApplicabilitySchema,  
    
  // Conditionally checked downstream context mapping identifier link  
  target\_linked\_entity\_id: z.string().uuid().nullable(),  
    
  // Validation window limits constraints parameters  
  start\_date\_iso: z.string().datetime("Start window must track to valid ISO date formats."),  
  expiration\_date\_iso: z.string().datetime("Expiration parameter must track to valid ISO date formats."),  
    
  t\_and\_c\_footnote: z.string().min(5, "Include minimal regulatory compliance Terms & Conditions text."),  
  entity\_deep\_link\_url: z.string().url("Promotion destination route requires clean path URL formatting.")  
}).refine((data) \=\> {  
  return Date.parse(data.expiration\_date\_iso) \> Date.parse(data.start\_date\_iso);  
}, {  
  message: "Promotion invalidation expiration window bounds must be set logically after start date thresholds.",  
  path: \["expiration\_date\_iso"\]  
});

// \=============================================================================  
// 3\. MASTER INTEGRATED POLYMORPHIC DROPDOWN ROUTER COMPILER  
// \=============================================================================  
export const MasterAddAssetDrawerSchema \= z.discriminatedUnion("asset\_type", \[  
  LinkProductAssetPayloadSchema,  
  LinkCollectionAssetPayloadSchema,  
  LinkBrandIdentityPayloadSchema,  
  LinkPromotionPayloadSchema  
\]);

// Structural Type Inference Outputs for Application Shell Implementations  
export type LinkProductAssetPayload \= z.infer\<typeof LinkProductAssetPayloadSchema\>;  
export type LinkCollectionAssetPayload \= z.infer\<typeof LinkCollectionAssetPayloadSchema\>;  
export type LinkBrandIdentityPayload \= z.infer\<typeof LinkBrandIdentityPayloadSchema\>;  
export type LinkPromotionPayload \= z.infer\<typeof LinkPromotionPayloadSchema\>;  
export type MasterAddAssetDrawerRequest \= z.infer\<typeof MasterAddAssetDrawerSchema\>;

