## **Brand DNA: Competitors**

**Tab label:** `Competitors` 

**Screen headline:** `Your product catalogue` 

**Subline:** `We will analyze digital footprints and creator activations of your competitors and incorporate learnings in our campaigns`

**Sections:**

Carousel

* Field labels: `Competitor Logo, Competitor Name, Social Handle (s), Competitor link, Why are they competitor` e.g {Minimalist: Minimalist is the "gold standard" for affordable clinical skincare in India. Anyone looking at The Solved Skin is likely comparing it to the efficacy and price of Minimalist.}

### **5\. Zod Validation for Step 5**

TypeScript  
export const Step5CompetitorSchema \= z.object({  
  competitors: z.array(z.object({  
    name: z.string().min(1, "Competitor name is required"),  
    website\_url: z.string().url().refine(url \=\> {  
      const host \= new URL(url).hostname;  
      return \!\['amazon.com', 'google.com', 'facebook.com'\].some(d \=\> host.includes(d));  
    }, "Please enter a direct brand website."),  
      
    logo\_url: z.string().url().nullable(),  
      
    // Strategic Narrative Validation  
    why\_competitor: z.string()  
      .min(40, "Please provide a bit more detail on why they are a rival.")  
      .max(300, "Keep the comparison concise."),  
        
    social\_links: z.array(z.string().url()).max(2)  
  })).max(5, "Focusing on your top 5 rivals provides the best AI strategy results.")  
});

---

### **6\. Developer Documentation: Step 5 Finalization**

**Key Instructions:**

1. **Phase 2 Trigger (Reminder):** After the user completes Step 5 and clicks "Finish DNA," the UI must check the **Email Verification Status**.  
2. **Verified:** Immediately trigger the **Deep Scan** (Phase 2\) background job to start analyzing the full product KSPs and Competitor social strategies.  
3. **Unverified:** Redirect to a "Verify your Email to unlock your Campaign Strategy" screen. The Deep Scan remains paused until the verification webhook hits.  
4. **Logo Fallback:** If the AI scan for a competitor fails to find a logo, use a placeholder with the first letter of the competitor's name in a brand-neutral color.

**Next Step:** Would you like to review the **"Onboarding Complete"** state, where the user waits for the Deep Scan to finish after verifying their email?

