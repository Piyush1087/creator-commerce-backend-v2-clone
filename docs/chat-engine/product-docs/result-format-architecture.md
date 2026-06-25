as a next step, let's define types of possible result formats that will be required across all these use cases.  
also include a use case, where subsequent answer is required from user (e.g. launch a campaign for retinol serum\>"What should be the budget" and "what should be the objective" 

### **Result Format Architecture & Slot-Filling State Engine**

To support the full range of use cases across the Brand Co-Pilot engine, the chat response structure cannot rely on flat Markdown strings. It requires a structured **Generative UI JSON Payload** returned by the NestJS backend and parsed by the React application.  
This layout maps out the data-driven output formatting engine that dynamically intercepts LLM intents and transforms them into interactive UI states.

### **Part 1: Exhaustive Discriminating Union of Result Formats**

Below is the complete, type-safe TypeScript specification and corresponding Zod validation models defining every allowable UI format inside the chat viewport.  
TypeScript  
import { z } from 'zod';

// \=============================================================================  
// 1\. RESULT FORMAT ENUMERATIONS  
// \=============================================================================  
export type ResponseFormatType \=   
  | 'CONVERSATIONAL\_NARRATIVE'  
  | 'METRIC\_HIGHLIGHT\_GRID'  
  | 'TABULAR\_AUDIT\_DATA'  
  | 'POLYMORPHIC\_ENTITY\_CAROUSEL'  
  | 'INTERACTIVE\_EXECUTION\_WIDGET'  
  | 'SLOT\_FILLING\_CLARIFICATION';

// \=============================================================================  
// 2\. SUB-COMPACT DATA SCHEMAS FOR GENERATIVE UI  
// \=============================================================================

// Metric Item Schema  
export const MetricItemSchema \= z.object({  
  label: z.string(),  
  value: z.string(),  
  changePercentage: z.number().optional(),  
  statusColor: z.enum(\['GREEN', 'YELLOW', 'RED', 'NEUTRAL'\]),  
});

// Data Table Schema  
export const DataTableSchema \= z.object({  
  headers: z.array(z.string()),  
  rows: z.array(z.record(z.string(), z.union(\[z.string(), z.number(), z.boolean()\]))),  
  actionButtonLabel: z.string().optional(),  
  targetEntityId: z.string().uuid().optional(),  
});

// Polymorphic Entity Card Schema (for Influencers, Campaigns, Products)  
export const EntityCardSchema \= z.object({  
  entityId: z.string().uuid(),  
  title: z.string(),  
  subtitle: z.string(),  
  imageUrl: z.string().url().optional(),  
  metadataPills: z.array(z.string()),  
  primaryMetric: z.string().optional(),  
  actionType: z.enum(\['SHORTLIST', 'VIEW\_PROFILE', 'SELECT\_PRODUCT', 'EDIT\_BRIEF'\]),  
});

// Interactive Execution Form Widget Schema  
export const ExecutionWidgetSchema \= z.object({  
  formTargetRoute: z.string(),  
  idempotencyKey: z.string().uuid(),  
  prefilledFields: z.record(z.string(), z.any()),  
  requiredZodValidationSchemaName: z.string(),  
  primaryActionLabel: z.string(),  
  cancelActionLabel: z.string(),  
});

// Stateful Multi-Turn Slot Filling Clarification Schema  
export const SlotFillingSchema \= z.object({  
  intentWorkspaceContext: z.string(), // e.g., "CAMPAIGN\_LAUNCH"  
  stagedPayload: z.record(z.string(), z.any()), // Temporarily accumulated uncommitted attributes  
  missingSlots: z.array(z.object({  
    fieldName: z.string(),  
    uiLabel: z.string(),  
    inputType: z.enum(\['TEXT', 'NUMBER', 'SINGLE\_SELECT', 'DATE'\]),  
    selectOptions: z.array(z.string()).optional(),  
    placeholderText: z.string(),  
  })),  
});

// \=============================================================================  
// 3\. THE UNIFIED DISCRIMINATING MASTER INTERFACE  
// \=============================================================================  
export const CoPilotChatPayloadSchema \= z.object({  
  messageId: z.string().uuid(),  
  threadId: z.string().uuid(),  
  timestamp: z.string().datetime(),  
  formatType: z.enum(\[  
    'CONVERSATIONAL\_NARRATIVE',  
    'METRIC\_HIGHLIGHT\_GRID',  
    'TABULAR\_AUDIT\_DATA',  
    'POLYMORPHIC\_ENTITY\_CAROUSEL',  
    'INTERACTIVE\_EXECUTION\_WIDGET',  
    'SLOT\_FILLING\_CLARIFICATION'  
  \]),  
  narrativeText: z.string(), // Always populated as structural screen-reader or conversational backbone  
    
  // Conditionally populated based on formatType  
  metricGridData: z.array(MetricItemSchema).optional(),  
  tableData: DataTableSchema.optional(),  
  carouselEntities: z.array(EntityCardSchema).optional(),  
  executionWidget: ExecutionWidgetSchema.optional(),  
  slotFillingData: SlotFillingSchema.optional(),  
});

export type CoPilotChatPayload \= z.infer\<typeof CoPilotChatPayloadSchema\>;

### **Part 2: Multi-Turn Conversational Slot-Filling State Machine**

When a brand user submits an incomplete intent, such as **"Launch a campaign for retinol serum"**, the backend validation layer scans the required variables using structural Zod specifications. Finding missing dependencies, it refuses to commit database changes, switches the response type, and builds a progressive clarification interface.

#### **The Transactional State Flow Sequence**

\[User Input\] ──► "Launch a campaign for retinol serum"  
                     │  
                     ▼  
\[Intent Parser\] ──► Intent Detected: CAMPAIGN\_LAUNCH  
                     │  
                     ▼  
\[Zod Validator\] ──► Checks Master Campaign Schema  
                     │  
                     ├── Missing: budget\_allocation  
                     └── Missing: marketing\_objective  
                     │  
                     ▼  
\[State Machine\] ──► Stashes Partial Parameters in Cache Table  
                     │  
                     ▼  
\[Generative UI\] ──► Returns SLOT\_FILLING\_CLARIFICATION Payload

### **Part 3: Complete Technical Implementation**

Here is the React interface designed to parse the response formats using structural components and inline tokens from the **Aurora Design System v4.1**.  
TypeScript  
import React, { useState } from 'react';  
import { CoPilotChatPayload } from './copilot.types';

// \=============================================================================  
// DESIGN SYSTEM STYLING TOKENS (AURORA v4.1 SPECIFICATIONS)  
// \=============================================================================  
const theme \= {  
  canvasBg: '\#0B0F19',  
  cardSurface: '\#111827',  
  innerBox: '\#1F2937',  
  accentGreen: '\#34D399',  
  textMuted: '\#9CA3AF',  
  textMain: '\#FFFFFF',  
  fontHeading: '"Satoshi Variable", sans-serif',  
  fontBody: '"Source Sans 3", sans-serif',  
  floorSize: '14px',  
};

export const GenerativeUIResponseRenderer: React.FC\<{  
  payload: CoPilotChatPayload;  
  onSubmitReply: (threadId: string, intermediateState: any) \=\> void;  
}\> \= ({ payload, onSubmitReply }) \=\> {  
    
  // Localized state container to preserve interactive slot inputs safely  
  const \[slotFormValues, setSlotFormValues\] \= useState\<Record\<string, string\>\>({});  
  const \[isSubmitting, setIsSubmitting\] \= useState(false);

  const handleSlotInputChange \= (fieldName: string, value: string) \=\> {  
    setSlotFormValues((prev) \=\> ({ ...prev, \[fieldName\]: value }));  
  };

  const handleSlotFormSubmit \= (e: React.FormEvent) \=\> {  
    e.preventDefault();  
    if (\!payload.slotFillingData) return;

    // Validate that every pending data slot has an assigned value before submitting  
    const allFilled \= payload.slotFillingData.missingSlots.every(  
      (slot) \=\> slotFormValues\[slot.fieldName\]?.trim() \!== ''  
    );

    if (\!allFilled) return;

    setIsSubmitting(true);  
      
    // Package current inputs with stashed backend state parameters  
    const comprehensiveNextState \= {  
      intentContext: payload.slotFillingData.intentWorkspaceContext,  
      accumulatedPayload: {  
        ...payload.slotFillingData.stagedPayload,  
        ...slotFormValues,  
      },  
    };

    onSubmitReply(payload.threadId, comprehensiveNextState);  
  };

  return (  
    \<div style={{  
      backgroundColor: theme.cardSurface,  
      border: \`1px solid \#1F2937\`,  
      borderRadius: '12px',  
      padding: '20px',  
      marginBottom: '16px',  
      color: theme.textMain,  
      fontFamily: theme.fontBody,  
      fontSize: theme.floorSize  
    }}\>  
      {/\* Narrative Component Layer \*/}  
      \<p style={{ margin: '0 0 16px 0', lineHeight: '1.6', color: '\#E5E7EB' }}\>  
        {payload.narrativeText}  
      \</p\>

      {/\* \=============================================================================  
          FORMAT ROUTING CONDITION 1: METRIC HIGHLIGHT GRIDS  
          \============================================================================= \*/}  
      {payload.formatType \=== 'METRIC\_HIGHLIGHT\_GRID' && payload.metricGridData && (  
        \<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}\>  
          {payload.metricGridData.map((metric, idx) \=\> (  
            \<div key={idx} style={{ backgroundColor: theme.innerBox, padding: '16px', borderRadius: '8px', borderLeft: \`3px solid ${metric.statusColor \=== 'GREEN' ? theme.accentGreen : '\#F59E0B'}\` }}\>  
              \<span style={{ fontSize: '11px', textTransform: 'uppercase', color: theme.textMuted, display: 'block', letterSpacing: '0.05em' }}\>{metric.label}\</span\>  
              \<strong style={{ fontFamily: theme.fontHeading, fontSize: '20px', display: 'block', marginTop: '4px' }}\>{metric.value}\</strong\>  
            \</div\>  
          ))}  
        \</div\>  
      )}

      {/\* \=============================================================================  
          FORMAT ROUTING CONDITION 2: TABULAR AUDIT DATA  
          \============================================================================= \*/}  
      {payload.formatType \=== 'TABULAR\_AUDIT\_DATA' && payload.tableData && (  
        \<div style={{ overflowX: 'auto', marginTop: '12px', borderRadius: '8px', border: '1px solid \#374151' }}\>  
          \<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}\>  
            \<thead\>  
              \<tr style={{ backgroundColor: '\#151D30', borderBottom: '1px solid \#374151' }}\>  
                {payload.tableData.headers.map((h, i) \=\> (  
                  \<th key={i} style={{ padding: '12px', fontSize: '12px', fontWeight: 600, color: theme.textMuted }}\>{h}\</th\>  
                ))}  
              \</tr\>  
            \</thead\>  
            \<tbody\>  
              {payload.tableData.rows.map((row, rIdx) \=\> (  
                \<tr key={rIdx} style={{ borderBottom: '1px solid \#1F2937', backgroundColor: rIdx % 2 \=== 0 ? theme.cardSurface : '\#161E2E' }}\>  
                  {payload.tableData\!.headers.map((h, cIdx) \=\> (  
                    \<td key={cIdx} style={{ padding: '12px', color: '\#F3F4F6' }}\>{String(row\[h\] ?? '')}\</td\>  
                  ))}  
                \</tr\>  
              ))}  
            \</tbody\>  
          \</table\>  
        \</div\>  
      )}

      {/\* \=============================================================================  
          FORMAT ROUTING CONDITION 3: MULTI-TURN SLOT-FILLING PROMPTING (THE SYSTEM CASE)  
          \============================================================================= \*/}  
      {payload.formatType \=== 'SLOT\_FILLING\_CLARIFICATION' && payload.slotFillingData && (  
        \<form onSubmit={handleSlotFormSubmit} style={{ marginTop: '16px', backgroundColor: theme.innerBox, padding: '20px', borderRadius: '8px', border: \`1px dashed \#374151\` }}\>  
          \<h4 style={{ fontFamily: theme.fontHeading, margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600, color: theme.accentGreen }}\>  
            Required Briefing Strategy Configuration  
          \</h4\>  
            
          \<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}\>  
            {payload.slotFillingData.missingSlots.map((slot) \=\> (  
              \<div key={slot.fieldName} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}\>  
                \<label style={{ fontSize: '13px', fontWeight: 600, color: '\#D1D5DB' }}\>{slot.uiLabel}\</label\>  
                  
                {slot.inputType \=== 'SINGLE\_SELECT' && slot.selectOptions ? (  
                  \<select  
                    style={{ width: '100%', padding: '10px 14px', backgroundColor: theme.cardSurface, border: '1px solid \#4B5563', borderRadius: '6px', color: '\#FFF', outline: 'none' }}  
                    value={slotFormValues\[slot.fieldName\] || ''}  
                    onChange={(e) \=\> handleSlotInputChange(slot.fieldName, e.target.value)}  
                    required  
                  \>  
                    \<option value=""\>-- Choose Objective Target Option \--\</option\>  
                    {slot.selectOptions.map((opt) \=\> (  
                      \<option key={opt} value={opt}\>{opt}\</option\>  
                    ))}  
                  \</select\>  
                ) : (  
                  \<input  
                    type={slot.inputType \=== 'NUMBER' ? 'number' : 'text'}  
                    placeholder={slot.placeholderText}  
                    style={{ width: '100%', padding: '10px 14px', backgroundColor: theme.cardSurface, border: '1px solid \#4B5563', borderRadius: '6px', color: '\#FFF', outline: 'none' }}  
                    value={slotFormValues\[slot.fieldName\] || ''}  
                    onChange={(e) \=\> handleSlotInputChange(slot.fieldName, e.target.value)}  
                    required  
                  /\>  
                )}  
              \</div\>  
            ))}  
          \</div\>

          {/\* Sticky Action Footer Matching Placement Configurations \*/}  
          \<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid \#374151', paddingTop: '16px' }}\>  
            \<button  
              type="button"  
              style={{ backgroundColor: 'transparent', color: theme.textMuted, border: '1px solid \#4B5563', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}  
              disabled={isSubmitting}  
            \>  
              Discard Action  
            \</button\>  
            \<button  
              type="submit"  
              style={{ backgroundColor: theme.accentGreen, color: theme.canvasBg, border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontFamily: theme.fontHeading, fontWeight: 700 }}  
              disabled={isSubmitting}  
            \>  
              {isSubmitting ? 'Processing Strategy Engine...' : 'Confirm Parameters & Proceed'}  
            \</button\>  
          \</div\>  
        \</form\>  
      )}  
    \</div\>  
  );  
};

### **Part 4: Practical Execution Simulation Sandbox**

This mock payload illustrates how the system intercepts a partial command like *"Launch a campaign for retinol serum"* and returns an interactive slot-filling widget.  
TypeScript  
const sampleSlotFillingResponsePayload: CoPilotChatPayload \= {  
  messageId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",  
  threadId: "8c7b6a5d-4c3b-2a1a-0f9e-8d7c6b5a4f3e",  
  timestamp: "2026-06-02T13:20:00Z",  
  formatType: "SLOT\_FILLING\_CLARIFICATION",  
  narrativeText: "I've initialized a Campaign draft framework for your new 'Retinol Serum' launch. To finalize and stage the brief inside your Tab 3 Strategy Planner, please specify your intended financial allocation model and structural performance objectives below.",  
  slotFillingData: {  
    intentWorkspaceContext: "CAMPAIGN\_LAUNCH",  
    stagedPayload: {  
      productName: "Retinol Serum",  
      extractedIndustry: "D2C\_SKINCARE",  
      lifecycleStage: "DRAFT\_PLANNER"  
    },  
    missingSlots: \[  
      {  
        fieldName: "budget\_allocation",  
        uiLabel: "Target Financial Phase 1 Capital Budget (INR / Lowest Denomination Value)",  
        inputType: "NUMBER",  
        placeholderText: "e.g. 50000.00"  
      },  
      {  
        fieldName: "marketing\_objective",  
        uiLabel: "Core Performance Focus Area Track",  
        inputType: "SINGLE\_SELECT",  
        selectOptions: \[  
          "DIRECT\_ACTION\_CONVERSIONS",  
          "AWARENESS\_HOOK\_STREAKS",  
          "FUNNEL\_LEAK\_MITIGATION"  
        \],  
        placeholderText: "Select dominant campaign objective orientation"  
      }  
    \]  
  }  
};

This structure allows the application to handle open-ended conversational prompts, isolate missing schema tokens, and gather required information through inline form modules before writing changes to the production database.  
Would you like to move forward with mapping out the relational database schema to record and persist these multi-format interaction history threads, or look at building the client-side Chat Home layout container?

