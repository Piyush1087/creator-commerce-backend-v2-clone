Also keep in mind-  
1\. we should show some samples of prompts, either in the placeholder animation or below input box  
2\. we should also give quick access linksbelow chat bar, clicking on which adds the context to the prompt box e.g. \<analytics\> icon placed below, clicking it adds it to chat context, this helps direct the chat engine to right module faster|  
much below on the page, we can also explore listing some of the most recent chats \+ \<view all\>  
Above are only suggestions. dont just agree with me  
Act as an expert AI Product Manager and Lead UX/UI Designer to start with front end strategization. 

### **Product Strategy & UX Blueprint: The Intent-Driven Homescreen**

Transitioning the Brand Homescreen into a conversational command center requires balancing open-ended user discovery with structured enterprise workflows. As an AI Product Manager and Lead UX Designer, I have evaluated your proposed concepts against the core constraints of the platform framework.  
Below is a product critique of your design suggestions, followed by the complete front-end interface architecture layout.

### **Critical PM & UX Critique of Design Hypotheses**

#### **1\. Sample Prompt Placement: Animated Placeholders vs. Persistent Chips**

* **The Hypothesis:** Use animated placeholder text loops inside the chat input box or place sample prompts underneath it.  
* **The Critique:** Animated placeholder loops can cause accessibility and cognitive friction, as they disappear mid-rotation when a user begins typing. Instead, we will implement a dual-exposure model: a clean, static placeholder inside the field (e.g., *"Ask anything about your campaigns, influencers, or escrow..."*), paired with a row of high-impact **Dynamic Intent Chips** directly above the input box. These chips serve as single-click shortcuts that populate the input box with optimized templates.

#### **2\. Module Context Anchors: Text Injection vs. Stateful Routing Tags**

* **The Hypothesis:** Place quick-access icon links (like \<analytics\>) below the chat bar that append text to the prompt string to guide the AI engine.  
* **The Critique:** Appending raw text fragments to a user's natural input can break conversational context and lead to unpredictable natural language parsing. A more precise approach is to implement **Stateful Scope Context Anchors**. Clicking these chips toggles an isolated architectural state, visually locking a dedicated validation badge *inside* the chat input bar. This signals to the user that their query is scoped, while passing an explicit router parameter directly to the multi-tenant RAG database boundary, bypassing unnecessary intent classification layers.

#### **3\. Recent Threads Feed Placement: The Unified Split-Canvas Layout**

* **The Hypothesis:** Place a listing of recent chat sessions with a "View All" redirection trigger further down the page.  
* **The Critique:** Shifting recent chat histories deep below the primary viewport folds communication context out of immediate reach, conflicting with the workflow of users managing concurrent influencer cycles. The homescreen will use a **Unified Split-Canvas Layout**. The left-hand sector houses a space-optimized history rail, while the center-right arena remains dedicated to the active conversational viewport. Below the main chat container, we place an interactive summary layout showing active escrow balances and campaign performance states, giving brands comprehensive system visibility on a single screen.

### **Architectural Layout Blueprint**

The interface grid organizes the chat window, contextual routing controls, and workspace history logs into a single, cohesive view.  
\+-----------------------------------------------------------------------------------------------+  
|  LEFT RAIL (25%)               |  CENTER-RIGHT HERO WORKSPACE ARENA (75%)                      |  
\+--------------------------------+--------------------------------------------------------------+  
|  💬 RECENT THREADS             |  UNIVERSAL CONTEXT ACTION HEADER                             |  
|  • Summer Hydration Brief      |  Current Scope: \[🌐 Global Platform Mesh\]                     |  
|  • Escrow Audit Q2             \+--------------------------------------------------------------+  
|  • Sarah Content Dispute       |                                                              |  
|                                |  CHAT INTERACTION FEED                                       |  
|  \[View All Historical Logs\]    |  • User Input                                                |  
|                                |  • Generative UI Widget Output (Active Focus Enforcement)    |  
|                                |                                                              |  
|                                \+--------------------------------------------------------------+  
|                                |  \[⚡ Campaign Template\]  \[⚡ TDS Tax Check\]  \[⚡ Audit Hold\]  |  
|                                \+--------------------------------------------------------------+  
|                                |  (🛡️ ESCROW) | Enter your intent request pipeline...          |  
|                                \+--------------------------------------------------------------+  
|                                |  ROUTE CONTEXT CHIPS:  \[⚙️ Centre\] \[📊 Analytics\] \[🪙 Escrow\] |  
\+--------------------------------+--------------------------------------------------------------+

### **Front-End Interface Implementation**

This React 18 component maps out the intent-driven homescreen layout using explicit typescript configurations and styling tokens from the **Aurora Design System v4.1**.  
TypeScript  
import React, { useState } from 'react';

// \=============================================================================  
// DESIGN SYSTEM STYLING TOKENS (AURORA v4.1 FOUNDATIONS)  
// \=============================================================================  
const designTokens \= {  
  colors: {  
    canvasBg: '\#0B0F19',       // Deep space dark background tint  
    cardSurface: '\#111827',    // Component elevation surface color  
    panelInner: '\#1F2937',     // Segmented input or border baseline  
    borderMuted: '\#374151',    // Standard spatial separating line  
    accentGreen: '\#34D399',    // Aurora Green master brand action accent  
    accentPurple: '\#7C3AED',   // Strategic structural operation accent  
    textMain: '\#FFFFFF',       // Primary crisp high-contrast text contrast  
    textMuted: '\#9CA3AF',      // Auxiliary explanatory micro-copy gray  
  },  
  typography: {  
    heading: '"Satoshi Variable", sans-serif',  
    body: '"Source Sans 3", sans-serif',  
    floorSize: '14px',         // Master structural UI font scale boundary  
  }  
};

// \=============================================================================  
// TYPE DEFINITIONS & WORKSPACE INTERFACES  
// \=============================================================================  
type PlatformScopeContext \= 'GLOBAL' | 'BRAND\_CENTRE' | 'ANALYTICS' | 'ESCROW\_SYSTEM';

interface SuggestedIntentTemplate {  
  id: string;  
  label: string;  
  templateString: string;  
  associatedScope: PlatformScopeContext;  
}

interface ChatSessionLogStub {  
  threadId: string;  
  title: string;  
  lastActiveTimestamp: string;  
  scopeContext: PlatformScopeContext;  
}

interface MessageBubble {  
  id: string;  
  sender: 'USER' | 'COPILOT\_AGENT';  
  text: string;  
  injectedWidgetFormat?: 'METRIC\_HIGHLIGHT' | 'ACTION\_ALERT\_CARD';  
  widgetData?: any;  
}

export const BrandHomeCoPilot: React.FC\<{ activeBrandId: string }\> \= ({ activeBrandId }) \=\> {  
  // \--- STATE SYSTEM HOOKS \---  
  const \[currentScope, setCurrentScope\] \= useState\<PlatformScopeContext\>('GLOBAL');  
  const \[promptInput, setPromptInput\] \= useState\<string\>('');  
  const \[isInputFocused, setIsInputFocused\] \= useState\<boolean\>(false);  
    
  const \[chatFeed, setChatFeed\] \= useState\<MessageBubble\[\]\>(\[  
    {  
      id: 'init-msg-1',  
      sender: 'COPILOT\_AGENT',  
      text: "Welcome back. I have mapped your corporate footprint rules. Staged profiles, campaign escrow accounts, and active collaboration slots are initialized. How can I accelerate your brand operations today?"  
    }  
  \]);

  const \[historicalThreads\] \= useState\<ChatSessionLogStub\[\]\>(\[  
    { threadId: 't-1', title: 'Retinol Serum Strategy Launch', lastActiveTimestamp: '2 hours ago', scopeContext: 'BRAND\_CENTRE' },  
    { threadId: 't-2', title: 'Statutory TDS Ledger Review', lastActiveTimestamp: 'Yesterday', scopeContext: 'ESCROW\_SYSTEM' },  
    { threadId: 't-3', title: '@sarah\_beauty Milestone Dispute', lastActiveTimestamp: '3 days ago', scopeContext: 'GLOBAL' },  
    { threadId: 't-4', title: 'Funnel Leak Re-Optimization', lastActiveTimestamp: '1 week ago', scopeContext: 'ANALYTICS' }  
  \]);

  const intentTemplates: SuggestedIntentTemplate\[\] \= \[  
    { id: 'st-1', label: 'Launch Retinol Campaign', templateString: 'Launch a campaign strategy brief for our new retinol serum targeting high conversion metrics.', associatedScope: 'BRAND\_CENTRE' },  
    { id: 'st-2', label: 'Audit TDS Tax Reserves', templateString: 'Show me an audit ledger statement of all statutory TDS buffer funds currently locked for Indian compliance.', associatedScope: 'ESCROW\_SYSTEM' },  
    { id: 'st-3', label: 'Analyze Funnel Drop-offs', templateString: 'Where are our primary funnel leaks this month and what is the current creative hook fatigue coefficient?', associatedScope: 'ANALYTICS' }  
  \];

  // \--- INTERACTION LOGIC ENGINES \---  
  const handleSelectTemplate \= (template: SuggestedIntentTemplate) \=\> {  
    setCurrentScope(template.associatedScope);  
    setPromptInput(template.templateString);  
  };

  const handleScopeToggle \= (targetScope: PlatformScopeContext) \=\> {  
    setCurrentScope(currentScope \=== targetScope ? 'GLOBAL' : targetScope);  
  };

  const handleExecutePromptSubmit \= (e: React.FormEvent) \=\> {  
    e.preventDefault();  
    if (\!promptInput.trim()) return;

    const userMessage: MessageBubble \= {  
      id: \`usr-${Date.now()}\`,  
      sender: 'USER',  
      text: promptInput  
    };

    // Simulated analytical response payload injection  
    let agentResponse: MessageBubble \= {  
      id: \`agt-${Date.now()}\`,  
      sender: 'COPILOT\_AGENT',  
      text: \`Processing input under context metadata track: \[${currentScope}\]. Intercepting relational data entries across live workspaces...\`  
    };

    // Contextual evaluation to structure custom layout responses  
    if (currentScope \=== 'ESCROW\_SYSTEM' || promptInput.toLowerCase().includes('tds')) {  
      agentResponseTextAndWidget(  
        "I have parsed the statutory ledgers. Below is the active tracking matrix for frozen multi-tenant escrow balances and Indian tax compliance allocations.",  
        'METRIC\_HIGHLIGHT',  
        \[  
          { label: 'Total Protected Escrow', value: 'INR 4,50,000.00' },  
          { label: 'Isolated Tax Withholding Buffer', value: 'INR 9,000.00' }  
        \],  
        agentResponse  
      );  
    } else if (currentScope \=== 'BRAND\_CENTRE' || promptInput.toLowerCase().includes('campaign')) {  
      agentResponseTextAndWidget(  
        "I have opened a new Campaign strategy template framework inside your Tab 3 Strategy Planner space. Please review the operational constraints before publishing.",  
        'ACTION\_ALERT\_CARD',  
        { title: 'Staged Campaign Strategy Core: Retinol Launch', contextInfo: 'Objective: CONVERSIONS • Allocation Model: PHASE\_1\_COLD\_START' },  
        agentResponse  
      );  
    }

    setChatFeed((prev) \=\> \[...prev, userMessage, agentResponse\]);  
    setPromptInput('');  
  };

  function agentResponseTextAndWidget(text: string, format: 'METRIC\_HIGHLIGHT' | 'ACTION\_ALERT\_CARD', data: any, responseObj: MessageBubble) {  
    responseObj.text \= text;  
    responseObj.injectedWidgetFormat \= format;  
    responseObj.widgetData \= data;  
  }

  return (  
    \<div style={{  
      width: '100%',  
      minHeight: '100vh',  
      backgroundColor: designTokens.colors.canvasBg,  
      color: designTokens.colors.textMain,  
      fontFamily: designTokens.typography.body,  
      fontSize: designTokens.typography.floorSize,  
      display: 'flex',  
      boxSizing: 'border-box'  
    }}\>  
        
      {/\* \=============================================================================  
          SECTION 1: PERSISTENT LEFT INTEGRATED WORKSPACE DRAWER (25% WIDTH)  
          \============================================================================= \*/}  
      \<div style={{  
        width: '25%',  
        borderRight: \`1px solid ${designTokens.colors.borderMuted}\`,  
        backgroundColor: '\#0E1322',  
        padding: '24px',  
        display: 'flex',  
        flexDirection: 'column',  
        boxSizing: 'border-box'  
      }}\>  
        \<div style={{ marginBottom: '24px' }}\>  
          \<h3 style={{ fontFamily: designTokens.typography.heading, fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0' }}\>The Creator Shop\</h3\>  
          \<span style={{ fontSize: '12px', color: designTokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}\>Brand Co-Pilot Hub\</span\>  
        \</div\>

        \<div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}\>  
          \<span style={{ fontSize: '12px', fontWeight: 600, color: designTokens.colors.textMuted, textTransform: 'uppercase' }}\>Recent Thread Logs\</span\>  
            
          \<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}\>  
            {historicalThreads.map((thread) \=\> (  
              \<div key={thread.threadId} style={{  
                backgroundColor: designTokens.colors.cardSurface,  
                border: \`1px solid ${designTokens.colors.borderMuted}\`,  
                borderRadius: '8px',  
                padding: '12px',  
                cursor: 'pointer',  
                transition: 'all 0.2s ease-in-out'  
              }}\>  
                \<div style={{ fontWeight: 600, color: '\#F3F4F6', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}\>{thread.title}\</div\>  
                \<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: designTokens.colors.textMuted }}\>  
                  \<span\>{thread.scopeContext}\</span\>  
                  \<span\>{thread.lastActiveTimestamp}\</span\>  
                \</div\>  
              \</div\>  
            ))}  
          \</div\>  
        \</div\>

        \<div style={{ borderTop: \`1px solid ${designTokens.colors.borderMuted}\`, paddingTop: '16px', marginTop: 'auto' }}\>  
          \<button style={{  
            width: '100%',  
            backgroundColor: 'transparent',  
            color: designTokens.colors.accentGreen,  
            border: \`1px solid ${designTokens.colors.accentGreen}\`,  
            padding: '10px',  
            borderRadius: '6px',  
            fontSize: '13px',  
            fontWeight: 600,  
            cursor: 'pointer',  
            textAlign: 'center'  
          }}\>  
            View All Historical Logs →  
          \</button\>  
        \</div\>  
      \</div\>

      {/\* \=============================================================================  
          SECTION 2: CENTER-RIGHT HERO ACTIVE CHAT WINDOW ARENA (75% WIDTH)  
          \============================================================================= \*/}  
      \<div style={{  
        width: '75%',  
        display: 'flex',  
        flexDirection: 'column',  
        height: '100vh',  
        boxSizing: 'border-box'  
      }}\>  
          
        {/\* Dynamic Navigation Scope Header Strip \*/}  
        \<div style={{  
          padding: '20px 32px',  
          borderBottom: \`1px solid ${designTokens.colors.borderMuted}\`,  
          backgroundColor: designTokens.colors.cardSurface,  
          display: 'flex',  
          justifyContent: 'space-between',  
          alignItems: 'center'  
        }}\>  
          \<div\>  
            \<span style={{ fontSize: '12px', color: designTokens.colors.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}\>Operational Viewport\</span\>  
            \<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}\>  
              \<div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: designTokens.colors.accentGreen }} /\>  
              \<strong style={{ fontFamily: designTokens.typography.heading, fontSize: '16px' }}\>  
                Active Routing Context: \<span style={{ color: designTokens.colors.accentGreen }}\>{currentScope}\</span\>  
              \</strong\>  
            \</div\>  
          \</div\>  
          \<div style={{ fontSize: '13px', color: designTokens.colors.textMuted }}\>  
            Context Lock Verification Engine v4.1  
          \</div\>  
        \</div\>

        {/\* Scrollable Active Message Stream Feed \*/}  
        \<div style={{  
          flex: 1,  
          padding: '32px',  
          overflowY: 'auto',  
          display: 'flex',  
          flexDirection: 'column',  
          gap: '24px',  
          backgroundColor: '\#090D1A'  
        }}\>  
          {chatFeed.map((msg) \=\> (  
            \<div key={msg.id} style={{  
              display: 'flex',  
              flexDirection: 'column',  
              alignItems: msg.sender \=== 'USER' ? 'flex-end' : 'flex-start',  
              width: '100%',  
              boxSizing: 'border-box'  
            }}\>  
              {/\* Message Context Header Tag \*/}  
              \<span style={{ fontSize: '11px', fontWeight: 600, color: designTokens.colors.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}\>  
                {msg.sender \=== 'USER' ? 'Authorized Brand Admin' : 'Creator Shop Co-Pilot Agent'}  
              \</span\>  
                
              {/\* Main Content Bubble \*/}  
              \<div style={{  
                maxWidth: '85%',  
                padding: '16px 20px',  
                borderRadius: '12px',  
                lineHeight: '1.6',  
                backgroundColor: msg.sender \=== 'USER' ? designTokens.colors.accentPurple : designTokens.colors.cardSurface,  
                color: '\#F3F4F6',  
                border: \`1px solid ${msg.sender \=== 'USER' ? 'transparent' : designTokens.colors.borderMuted}\`  
              }}\>  
                {msg.text}  
              \</div\>

              {/\* Generative UI Component Injection Layer \*/}  
              {msg.injectedWidgetFormat \=== 'METRIC\_HIGHLIGHT' && msg.widgetData && (  
                \<div style={{  
                  display: 'grid',  
                  gridTemplateColumns: '1fr 1fr',  
                  gap: '16px',  
                  width: '500px',  
                  maxWidth: '100%',  
                  marginTop: '12px',  
                  backgroundColor: designTokens.colors.panelInner,  
                  padding: '16px',  
                  borderRadius: '8px',  
                  border: \`1px solid ${designTokens.colors.borderMuted}\`  
                }}\>  
                  {msg.widgetData.map((m: any, idx: number) \=\> (  
                    \<div key={idx}\>  
                      \<span style={{ fontSize: '11px', color: designTokens.colors.textMuted, display: 'block', textTransform: 'uppercase' }}\>{m.label}\</span\>  
                      \<strong style={{ fontFamily: designTokens.typography.heading, fontSize: '18px', color: designTokens.colors.accentGreen, display: 'block', marginTop: '4px' }}\>{m.value}\</strong\>  
                    \</div\>  
                  ))}  
                \</div\>  
              )}

              {msg.injectedWidgetFormat \=== 'ACTION\_ALERT\_CARD' && msg.widgetData && (  
                \<div style={{  
                  width: '500px',  
                  maxWidth: '100%',  
                  marginTop: '12px',  
                  backgroundColor: designTokens.colors.panelInner,  
                  padding: '20px',  
                  borderRadius: '8px',  
                  border: \`1px dashed ${designTokens.colors.accentGreen}\`  
                }}\>  
                  \<h4 style={{ fontFamily: designTokens.typography.heading, margin: '0 0 8px 0', color: '\#FFF', fontSize: '15px' }}\>{msg.widgetData.title}\</h4\>  
                  \<p style={{ margin: '0 0 16px 0', fontSize: '13px', color: designTokens.colors.textMuted }}\>{msg.widgetData.contextInfo}\</p\>  
                    
                  {/\* Sticky Control Placement Specification Configuration \*/}  
                  \<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid \#374151', paddingTop: '12px' }}\>  
                    \<button type="button" style={{ backgroundColor: 'transparent', color: designTokens.colors.textMuted, border: \`1px solid ${designTokens.colors.borderMuted}\`, padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}\>  
                      Discard Brief  
                    \</button\>  
                    \<button type="button" style={{ backgroundColor: designTokens.colors.accentGreen, color: designTokens.colors.canvasBg, border: 'none', padding: '8px 16px', borderRadius: '6px', fontFamily: designTokens.typography.heading, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}\>  
                      Review Planner Board  
                    \</button\>  
                  \</div\>  
                \</div\>  
              )}  
            \</div\>  
          ))}  
        \</div\>

        {/\* Persistent Chat Input Interaction Console Anchor (Fixed Bottom) \*/}  
        \<div style={{  
          padding: '24px 32px 32px 32px',  
          backgroundColor: designTokens.colors.cardSurface,  
          borderTop: \`1px solid ${designTokens.colors.borderMuted}\`  
        }}\>  
            
          {/\* A. Dynamic Structural Template Shortcut Chips \*/}  
          \<div style={{ display: 'flex', gap: '10px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}\>  
            {intentTemplates.map((template) \=\> (  
              \<button  
                key={template.id}  
                type="button"  
                onClick={() \=\> handleSelectTemplate(template)}  
                style={{  
                  backgroundColor: designTokens.colors.panelInner,  
                  color: '\#D1D5DB',  
                  border: \`1px solid ${designTokens.colors.borderMuted}\`,  
                  padding: '6px 12px',  
                  borderRadius: '20px',  
                  fontSize: '12px',  
                  cursor: 'pointer',  
                  whiteSpace: 'nowrap',  
                  transition: 'all 0.2s ease'  
                }}  
              \>  
                ⚡ {template.label}  
              \</button\>  
            ))}  
          \</div\>

          {/\* B. The Contextual Guarded Form Frame \*/}  
          \<form onSubmit={handleExecutePromptSubmit} style={{  
            position: 'relative',  
            display: 'flex',  
            flexDirection: 'column',  
            backgroundColor: designTokens.colors.panelInner,  
            border: \`1px solid ${isInputFocused ? designTokens.colors.accentGreen : designTokens.colors.borderMuted}\`,  
            borderRadius: '10px',  
            padding: '8px 12px',  
            transition: 'border-color 0.2s ease-in-out'  
          }}\>  
            \<div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}\>  
                
              {/\* Isolated Internal Scope Visual Indicator Badge \*/}  
              \<div style={{  
                backgroundColor: currentScope \=== 'GLOBAL' ? '\#374151' : 'rgba(52, 211, 153, 0.1)',  
                color: currentScope \=== 'GLOBAL' ? '\#9CA3AF' : designTokens.colors.accentGreen,  
                fontSize: '11px',  
                fontWeight: 700,  
                padding: '4px 8px',  
                borderRadius: '4px',  
                textTransform: 'uppercase',  
                letterSpacing: '0.05em',  
                userSelect: 'none'  
              }}\>  
                🛡️ {currentScope}  
              \</div\>

              \<input  
                type="text"  
                value={promptInput}  
                onChange={(e) \=\> setPromptInput(e.target.value)}  
                onFocus={() \=\> setIsInputFocused(true)}  
                onBlur={() \=\> setIsInputFocused(false)}  
                placeholder="Submit your operational intent or ask questions about campaign state machine ledgers..."  
                style={{  
                  flex: 1,  
                  backgroundColor: 'transparent',  
                  border: 'none',  
                  outline: 'none',  
                  color: designTokens.colors.textMain,  
                  fontFamily: designTokens.typography.body,  
                  fontSize: designTokens.typography.floorSize,  
                  padding: '10px 4px'  
                }}  
              /\>

              \<button type="submit" style={{  
                backgroundColor: designTokens.colors.accentGreen,  
                color: designTokens.colors.canvasBg,  
                border: 'none',  
                borderRadius: '6px',  
                padding: '10px 18px',  
                fontFamily: designTokens.typography.heading,  
                fontWeight: 700,  
                fontSize: '13px',  
                cursor: 'pointer'  
              }}\>  
                Execute Run  
              \</button\>  
            \</div\>  
          \</form\>

          {/\* C. Explicit Router Token Anchors Deck \*/}  
          \<div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}\>  
            \<span style={{ fontSize: '12px', color: designTokens.colors.textMuted, fontWeight: 600, textTransform: 'uppercase' }}\>  
              Direct Context Filter:  
            \</span\>  
            \<div style={{ display: 'flex', gap: '8px' }}\>  
              \<button  
                type="button"  
                onClick={() \=\> handleScopeToggle('BRAND\_CENTRE')}  
                style={{  
                  backgroundColor: 'transparent',  
                  color: currentScope \=== 'BRAND\_CENTRE' ? designTokens.colors.accentGreen : designTokens.colors.textMuted,  
                  border: \`1px solid ${currentScope \=== 'BRAND\_CENTRE' ? designTokens.colors.accentGreen : designTokens.colors.borderMuted}\`,  
                  borderRadius: '6px',  
                  padding: '6px 12px',  
                  fontSize: '13px',  
                  cursor: 'pointer',  
                  fontWeight: 600  
                }}  
              \>  
                🎨 Brand Centre Strategy  
              \</button\>  
              \<button  
                type="button"  
                onClick={() \=\> handleScopeToggle('ANALYTICS')}  
                style={{  
                  backgroundColor: 'transparent',  
                  color: currentScope \=== 'ANALYTICS' ? designTokens.colors.accentGreen : designTokens.colors.textMuted,  
                  border: \`1px solid ${currentScope \=== 'ANALYTICS' ? designTokens.colors.accentGreen : designTokens.colors.borderMuted}\`,  
                  borderRadius: '6px',  
                  padding: '6px 12px',  
                  fontSize: '13px',  
                  cursor: 'pointer',  
                  fontWeight: 600  
                }}  
              \>  
                📊 Funnel Analytics  
              \</button\>  
              \<button  
                type="button"  
                onClick={() \=\> handleScopeToggle('ESCROW\_SYSTEM')}  
                style={{  
                  backgroundColor: 'transparent',  
                  color: currentScope \=== 'ESCROW\_SYSTEM' ? designTokens.colors.accentGreen : designTokens.colors.textMuted,  
                  border: \`1px solid ${currentScope \=== 'ESCROW\_SYSTEM' ? designTokens.colors.accentGreen : designTokens.colors.borderMuted}\`,  
                  borderRadius: '6px',  
                  padding: '6px 12px',  
                  fontSize: '13px',  
                  cursor: 'pointer',  
                  fontWeight: 600  
                }}  
              \>  
                🪙 Statutory Escrow & TDS  
              \</button\>  
            \</div\>  
          \</div\>

        \</div\>

      \</div\>  
    \</div\>  
  );  
};

### **Technical Verification Checkpoints**

Before finalizing this module for deployment on the platform home dashboard, confirm that your frontend orchestration pipeline satisfies the following requirements:

* **Active Focus Implementation:** When the AI engine injects complex layout elements (such as an interactive campaign creation wizard or data table arrays), the active viewport state must hide or collapse adjacent panels to prevent layout overcrowding.  
* **Deterministic Parameter Extraction:** The structural scope buttons (currentScope) pass exact database filtering parameters, enabling the RAG engine to bypass intent classification and query the target schema tables directly.  
* **Typographic Scaling Consistency:** All descriptive paragraphs, input placeholders, and button configurations strictly adhere to the 14px layout floor constraint across both the sidebar and main chat components.

The strategy and layout for the Brand Home AI Co-Pilot interface are complete.  
How would you like to proceed? We can implement the NestJS multi-agent backend router, or map out the automated RAG database schemas to preserve and fetch interaction history threads.  
