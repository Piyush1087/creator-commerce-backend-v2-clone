## **3\. 📝 WORKSPACE DEVELOPMENT SPECIFICATION DOCUMENT**

### **⚡ THE CHAT RESPONSE STRUCTURE**

To maintain rapid processing pipelines, conversational state objects written to HistoricChatThread.messagesJson must match this structure:

JSON  
\[  
  {  
    "role": "user",  
    "timestamp": "2026-07-03T03:45:00Z",  
    "content": "Draft a brand pitch framework using my top Reel stats"  
  },  
  {  
    "role": "assistant",  
    "timestamp": "2026-07-03T03:45:03Z",  
    "content": "Subject: High-Impact Content Collaboration Request...\\n\\nHello \[Brand Team\]..."  
  }  
\]

### **STEP 1: HOME SCREEN (AI COMMAND CENTER CORE ENGINE)**

#### **A. Initial Ingestion AI Generation Prompt (Executed Once Post-OAuth Ingestion)**

The backend triggers this system payload call against the **Gemini 1.5 Flash** or **Parallel AI** ingestion layer immediately when constructing the user dashboard context for the first time.

* **API Configuration Context:** temperature: 0.2, responseMimeType: "text/plain".  
* **Target Custom LLM Ingestion Prompt Structure:**  
* Plaintext

You are the dedicated internal Business AI Co-Pilot for our platform. Your task is to process the raw synced Meta metrics profile configuration array provided below and construct an immediate, direct onboarding welcome insight strategy statement for the creator's dashboard view.

Creator Input Handle Data Profile:  
\- Instagram Handle Reference: @{{instagramHandle}}  
\- Extracted Target Content Vertical Classification: {{detectedVertical}}  
\- Computed Platform Baseline Multiplier Score: {{eligibilityScore}}  
\- Rolling 30-Day Mean Base Engagement Rate: {{engagementRateCache}}%  
\- Core Target Historical Post Analytics Sync Array Payload:  
  {{historicPostPulseDataJson}}

Instructions Strategy Core Requirements:  
1\. Direct Address: Address the creator immediately using their baseline profile context parameters.  
2\. Data Isolation Point: Pinpoint the exact media post ID tracking element that displayed the highest execution delta deviation relative to baseline trends (e.g., maximum views count acceleration, or high save/share ratios).  
3\. Structural Monetary Pricing Guidance: Propose a logical dedicated short-form brand integration baseline price value target range matched to their specific performance metrics tier.  
4\. Tone Matrix formatting rule: Keep the text concise, clear, data-informed, and production-driven. Avoid introductory pleasantries, generic salutations, or markdown syntax code block wrapping wrappers. 

*   
* 

#### **B. Workspace Prompt Repository Strategy (History Management)**

* **Mobile Execution Boundary:** Mobile screens display *only* the current active chat instance screen container. The repository list array is requested via GET /api/chat/threads and parsed exclusively inside an on-demand slide-out right-to-left drawer modal wrapper triggered by a persistent history button layout icon.  
* **Desktop Multi-Panel Execution Matrix:** Desktop templates utilize a persistent internal secondary nested panel (width: 25%) that reads the history endpoint array to allow immediate chat view switching.

### **STEP 2: CREATOR LIVE MEDIA KIT ENGINE (SANDBOX CONTROLLER SETUP)**

\[UI Editing Sandbox\] ──► \[Zod Validation Validation Check\] ──► \[Atomic Profile Write\]  
        │                                                                │  
        └───────────────── (Real-Time Layout State Sync) ───────────────┼──► \[Public Iframe Preview\]

#### **A. Visibility Toggles Architecture Handling**

* When a user clicks a visibility state checkbox to disabled (e.g., changing showViewsMetric to false), the controller writes that parameter directly into the atomic data row corresponding to UserProfile.  
* The public rendering router reads UserProfile variables during public data fetch operations. If an visibility flag is marked false, the controller strictly strips the associated data metric array values out of the outgoing server payload to prevent data manipulation via client-side inspection tools.

#### **B. Real-Time Editing Validation Pipeline (WYSIWYG Sandbox Loop)**

1. Changes to the text fields, prices, or themes fire immediate asynchronous state dispatches into the frontend validation context loop.  
2. The validation engine screens inputs against the standard parameters defined inside mediaKitSaveSchema.  
3. If valid, the sandbox updates the local component schema, causing the adjacent real-time desktop preview iframe window to update instantly without executing full database persistence calls.  
4. Global persistence occurs explicitly when the system detects a save action command triggered via \[ Save Structural Updates & Sync Changes \].

### **STEP 3: PERFORMANCE ANALYTICS ENGINE (DYNAMIC CONTENT PULSE)**

#### **A. Micro-Velocity Computational Matrix Calculations**

Instead of processing static historical values, the backend runs data checks over the creator's recent post metrics cache table arrays (MetricPostPulse) to extract actionable momentum values.

* **Algorithmic Calculation Logic Loop (Execution Equation):**  
  For each target post entry fetched, compute the localized raw performance deviation multiplier mapping relative to the rolling historical platform baseline mean:  
  $$EngagementRatio\_{Post} \= \\frac{SavesCount \+ SharesCount \+ CommentsCount}{ImpressionsCount}$$  
  $$VelocityDelta \= \\left( \\frac{EngagementRatio\_{Post}}{EngagementRateCache} \- 1 \\right) \\times 100$$  
* **Interface Execution Trigger Layer:** If $VelocityDelta \> 50.00\\%$, the database model assigns a high-priority velocity metric state flag string automatically ("🔥 Over-performing by X%"). If the deviation trends negative, it triggers a warning metric indicator ("⚠️ Under-performing by X%").

#### **B. Localized AI Micro-Analysis Engine Processing Loop**

The system pushes the computed calculation metrics data vectors through an automated LLM inference pipeline loop to build targeted post summary insights.

* **API Configuration Setup Configuration Parameters:** Gemini 1.5 Flash, max\_tokens: 60, temperature: 0.1.  
* **System Prompt Structural Ingestion Framework:**  
* Plaintext

Analyze this single short-form media post asset metric tracking signature. Construct a sharp, production-ready diagnostic insight tip phrase strictly bounded within 15 words limit length.

Target Metrics Signature:  
\- Post Media Core Format Type: {{postType}}  
\- Post Computed Execution Speed Velocity Delta Scalar: {{engagementDelta}}%  
\- Post Specific Saves Cache Value: {{savesCount}}  
\- Post Specific Shares Cache Value: {{sharesCount}}

Instructions: State exactly what algorithmic mechanism drove this tracking outcome signature or provide a clear tactical adjustment response step. Do not insert pleasantries or introductory phrases.

*   
*   
* **Output Cache Mapping Execution Engine:** Write the short text returned by the LLM run directly into the aiPerformanceNote property column on the target MetricPostPulse table row. The app UI prints this string instantly below the velocity tracking visualization labels inside the main content pulse timeline grid view.

