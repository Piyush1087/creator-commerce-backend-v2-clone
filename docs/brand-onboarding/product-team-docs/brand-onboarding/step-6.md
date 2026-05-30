// Step 1: Initial Discovery & Root Identity  
model BrandProfile {  
  id                String   @id @default(uuid())  
  domain            String   @unique // The root\_domain gatekeeper   
  brand\_name        String  
  industry\_id       String   // Mapping to D2C, Healthcare, etc. \[cite: 14, 21, 25\]  
  logo\_url          String?  
  tagline           String?  
  description       String?  @db.Text // \[cite: 39\]  
    
  // Visual Identity (Step 3\) \[cite: 41\]  
  color\_palette     String\[\] // Array of Hex codes \[cite: 42, 90\]  
  fonts             String\[\] // \[cite: 43, 94\]  
  tone\_of\_voice     Json?    // Array of {label: string, description: string} \[cite: 45\]  
  visual\_aesthetic  String\[\] // Tags like "Clean & Clinical" \[cite: 46\]  
    
  // Strategy & Compliance (Step 3 & Deep Scan Phase)  
  brand\_values      String\[\] // \[cite: 49\]  
  policy\_flags      String\[\] // Do-not-say constraints \[cite: 50\]  
    
  // Audience Persona (Step 3\) \[cite: 51\]  
  target\_audience   Json?    // { name, countries, age\_range: \[min, max\], affluence: 1-5, traits } \[cite: 52\]

  // Lifecycle States  
  is\_verified       Boolean  @default(false) // The "Deep Scan" Gate  
  scan\_status       ScanStatus @default(SURFACE\_COMPLETE)  
    
  // Relationships  
  offerings         Offering\[\]  
  competitors       Competitor\[\]  
  locations         Location\[\]  
    
  createdAt         DateTime @default(now())  
  updatedAt         DateTime @updatedAt  
}

// Step 4: Products, Treatments, and Services \[cite: 9, 13\]  
model Offering {  
  id                String   @id @default(uuid())  
  brand\_id          String  
  brand             BrandProfile @relation(fields: \[brand\_id\], references: \[id\])  
    
  type              OfferingType // PRODUCT, TREATMENT, or SERVICE \[cite: 15, 22, 26\]  
  name              String  
  description       String?  @db.Text  
  image\_url         String?  
  offering\_url      String   // For Mini-Scans and Deep Scans  
    
  // Industry Specifics \[cite: 26, 28\]  
  price\_amount      Decimal?   
  currency          String   @default("USD")  
    
  // Healthcare Mapping \[cite: 23\]  
  location\_ids      String\[\] // Linked clinic IDs  
    
  is\_active         Boolean  @default(true) // For "Remove/Undo" logic \[cite: 29\]  
  is\_manually\_edited Boolean @default(false) // Protect user edits from Deep Scan  
}

// Step 2 & 4: Physical Presence \[cite: 23, 27\]  
model Location {  
  id                String   @id @default(uuid())  
  brand\_id          String  
  brand             BrandProfile @relation(fields: \[brand\_id\], references: \[id\])  
  address           String  
  contact\_details   String?  
  city              String?  
}

// Step 5: Competitive Landscape \[cite: 1, 5\]  
model Competitor {  
  id                String   @id @default(uuid())  
  brand\_id          String  
  brand             BrandProfile @relation(fields: \[brand\_id\], references: \[id\])  
    
  name              String  
  website\_url       String  
  logo\_url          String?  
  social\_handles    String\[\] // \[cite: 7\]  
    
  // Strategic Data (Step 5 Review) \[cite: 7, 8\]  
  why\_competitor    String?  @db.Text // Comparison narrative  
    
  is\_active         Boolean  @default(true)  
}

enum ScanStatus {  
  PENDING  
  SURFACE\_COMPLETE  
  VERIFIED  
  DEEP\_SCAN\_IN\_PROGRESS  
  READY  
}

enum OfferingType {  
  PRODUCT  
  TREATMENT  
  SERVICE  
  COLLECTION  
}

import { z } from "zod";

// \--- GLOBAL ATOMS \---  
const ColorHex \= z.string().regex(/^\#(\[A-Fa-f0-9\]{6}|\[A-Fa-f0-9\]{3})$/, "Invalid Hex Code");  
const SocialLink \= z.string().url().refine(url \=\> url.includes('instagram.com') || url.includes('tiktok.com'), "Must be IG or TikTok");

// \--- STEP 2: SURFACE SCAN (The AI Draft) \---  
export const SurfaceScanSchema \= z.object({  
  brand\_name: z.string(),  
  logo\_url: z.string().url().nullable(),  
  industry: z.enum(\["D2C", "Healthcare", "Offline\_Services", "AI\_SaaS"\]),  
  root\_domain: z.string() // Captured in Step 1  
});

// \--- STEP 3: BRAND IDENTITY REVIEW \---  
export const Step3IdentitySchema \= z.object({  
  brand\_description: z.string().min(50).max(500), // \[cite: 40, 48\]  
  tagline: z.string().max(150).nullable(),  
  visual\_identity: z.object({  
    color\_palette: z.array(ColorHex).min(1).max(8), // \[cite: 42\]  
    tone\_of\_voice: z.array(z.object({  
      label: z.string(),  
      description: z.string()  
    })).max(5) // \[cite: 44, 45\]  
  }),  
  audience\_persona: z.object({  
    persona\_name: z.string().min(3),  
    age\_range: z.object({  
      min: z.number().min(13),  
      max: z.number().max(100)  
    }),  
    affluence\_score: z.number().int().min(1).max(5), // \[cite: 52\]  
    traits: z.array(z.string()).max(7)  
  })  
});

// \--- STEP 4: PRODUCTS & TREATMENTS \---  
export const Step4ProductSchema \= z.object({  
  name: z.string().min(1),  
  image\_url: z.string().url().nullable(),  
  description: z.string().max(150), // \[cite: 19, 22\]  
  offering\_url: z.string().url()  
}).refine(data \=\> {  
  // Logic handled in frontend: ensure product URL matches root domain  
  return true;   
}, "Product must belong to your domain");

// \--- STEP 5: COMPETITORS \---  
export const Step5CompetitorSchema \= z.object({  
  name: z.string(),  
  website\_url: z.string().url(),  
  why\_competitor: z.string().min(40).max(300), // \[cite: 7, 8\]  
  social\_handles: z.array(SocialLink).max(2)  
});

// \--- MASTER ONBOARDING STATE \---  
export const BrandDNASchema \= z.object({  
  step2: SurfaceScanSchema,  
  step3: Step3IdentitySchema,  
  step4: z.array(Step4ProductSchema),  
  step5: z.array(Step5CompetitorSchema)  
});

