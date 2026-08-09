Designing the AI Chat Interface as the primary Homescreen for Brands fundamentally shifts the platform from a traditional "point-and-click" dashboard to an **Intent-Driven Co-Pilot Engine**. This interface will act as the universal command line for the brand, merging conversational intelligence with actionable platform workflows.  
Here is the comprehensive product strategy and architectural exploration addressing your 8 core pillars for the **Brand Home AI Co-Pilot**.

### **1\. Core Functionalities: Information vs. Execution**

The AI must transcend text-based answers and act as an execution agent. However, to prevent critical errors, it must operate on a **Human-In-The-Loop (HITL)** paradigm for destructive or financial actions.

* **Data Summarization & Queries (Fully Automated):**  
  * *Prompt:* "Summarize the ROI of my Summer Skincare campaign."  
  * *Action:* The AI queries the database and outputs a synthesized text summary alongside a dynamically generated metric widget.  
  * *Prompt:* "Find me 5 NYC-based skincare creators with high engagement."  
  * *Action:* AI executes a search query and renders 5 interactive Creator Profile Cards directly in the chat stream.  
* **Workflow Execution (Human-in-the-Loop via Interactive Widgets):**  
  * *Prompt:* "Launch a new campaign for our Vitamin C serum."  
  * *Action:* The AI drafts the brief, but instead of silently publishing it, it renders a \[Review & Publish Campaign\] UI card inside the chat for the brand to click.  
  * *Prompt:* "Approve Sarah's content and top up the escrow by $500."  
  * *Action:* The AI queues the state transition and renders the **Top-Up Configuration Drawer** (built in Step 5\) and an \[Approve Content\] button inside the chat interface. It *never* executes financial transfers or legal approvals without an explicit click.

### **2\. Accessing Previous Chat Threads (Session Architecture)**

To maintain contextual continuity without cluttering the main canvas, the chat architecture must support stateful memory.

* **The Left-Hand Rail Drawer:** The interface will utilize a collapsible left-hand sidebar (similar to Claude/ChatGPT) containing the chat history.  
* **Temporal & Contextual Grouping:** Threads are grouped by time (*Today, Previous 7 Days, Last Month*).  
* **Thread Naming:** The AI automatically generates a title based on the first prompt (e.g., *"Summer Campaign Launch"*, *"Escrow Ledger Audit"*).  
* **Entity Binding:** Threads can be programmatically linked to specific platform entities. If a brand starts a chat *from* a specific campaign page, that thread is automatically tagged to campaign\_id, allowing the AI to maintain strict context over that specific project.

### **3\. Restrictions & Guardrails (The Moderation Layer)**

As a B2B SaaS tool, the AI must remain highly professional and tightly scoped.

* **Strict Persona System Prompt:** The system message must explicitly state: *"You are an AI Co-Pilot for The Creator Shop. Your sole purpose is to assist brands with influencer marketing, campaign management, and platform analytics. Do not answer questions outside this domain."*  
* **Graceful Refusal:** If a brand asks about politics, coding, or absurdity, the AI must fallback to: *"I am optimized exclusively for influencer marketing and platform operations on The Creator Shop. How can I assist you with your campaigns today?"*  
* **Toxicity & Profanity Filters:** All inputs and outputs must pass through a lightweight moderation API (e.g., OpenAI Moderation endpoint) before hitting the LLM or being rendered to the screen. Violations trigger an immediate hard-stop rejection.

### **4\. Measuring Success & Reinforcement Feedback**

To ensure the AI actually improves brand workflows, success must be measured both explicitly and implicitly.

* **Explicit Feedback:** Standard \[Thumbs Up / Thumbs Down\] and \[Regenerate\] icons appear below every AI response. A thumbs down opens a micro-modal asking for a specific reason (e.g., *Inaccurate Data, Unhelpful, Hallucination*).  
* **Implicit Feedback (Action Tracking):** The most powerful metric. If the AI suggests 5 creators and the brand clicks \[Shortlist\] on 3 of them, the chat was highly successful. If the AI renders a \[Top-Up Escrow\] card and the user abandons it, the prompt resolution failed.  
* **Data Harvesting:** This feedback is logged into an ai\_interaction\_logs table to continuously refine the RAG (Retrieval-Augmented Generation) pipeline.

### **5\. Usage Limits & Tiered Quotas**

API compute is expensive. Chat access must be structurally tied to the subscription tiers defined in your onboarding documents (GROWTH\_STARTER, SCALE\_PRO, ENTERPRISE\_FLYWHEEL).

* **Starter Tier:** Hard limit of 50 prompts per day.  
* **Pro Tier:** 500 prompts per day / Advanced data queries permitted.  
* **Enterprise Tier:** Unlimited usage.  
* **UI Enforcement:** When a user hits 80% of their limit, the chat input box displays a warning text: *"10 prompts remaining today."* At 100%, the input field disables and displays a CTA: \[Upgrade Plan to Unlock Unlimited AI Assistance\].

### **6\. Restricting Access to Platform Secrets (Data Segregation)**

Brands will attempt to "jailbreak" the AI to learn how your proprietary algorithms work or uncover hidden platform fees.

* **RAG Boundary Limitations:** The LLM's context window must *never* be fed the source code, the weighting formula for influencer matching, or backend infrastructure details.  
* **Output-Only Injection:** If a brand asks, "Why was this creator matched with me?", the system queries the database and only feeds the AI the *results* (e.g., "Audience overlap: 85%, Industry match: Skincare").  
* **Defensive Prompting:** The baseline system prompt must include: *"Under no circumstances will you explain the internal matching algorithm weights, backend architecture, or fee calculations beyond the publicly stated 7% collaboration fee."*

### **7\. Allowed Attachments (Multimodal Capabilities)**

Allowing attachments drastically improves brief generation and creator matching.

* **Images (PNG, JPG):** Brands can upload mood boards, product shots, or visual guidelines. The vision-model can extract aesthetic data to find creators with matching visual styles.  
* **Documents (PDF, DOCX):** Brands can upload existing PR briefs, brand guidelines, or legal requirements. The AI parses this to automatically populate the "Brand DNA" (Tab 1 of Brand Centre) or draft Campaign briefs.  
* **Data (CSV):** Brands can upload historical influencer rosters they used off-platform. The AI maps these handles to the database to automatically invite them to The Creator Shop.

### **8\. Additional Architectural Considerations for Influencer Marketing**

* **Micro-Frontend Output (Generative UI):** The AI should not output pure Markdown text. If a user asks for a creator's stats, the AI should trigger a backend tool call that renders an actual React Component (e.g., a \<CreatorStatsCard /\>) directly inside the chat feed. This keeps the interface feeling like a software dashboard, not just a text bot.  
* **Contextual Awareness of "State":** The AI must know the brand's exact financial and workflow state. If a brand says "Approve all creators," but their Escrow Available Balance is $0, the AI must instantly intercept with: *"You cannot approve these creators as your escrow balance is zero. Please top up first."*  
* **Streaming Responses (SSE):** To prevent the UI from feeling frozen while the AI fetches complex creator metrics or parses large documents, the responses must be streamed token-by-token using Server-Sent Events (SSE) with a localized typing indicator.

By treating the Chat Interface not just as a Q\&A bot, but as an **Orchestration Layer** that renders UI components and stages database actions, it becomes a true Co-Pilot for the brand.  
Would you like to proceed to mapping the Database Schema for storing these interactive chat sessions, or focus on designing the UI layout for this dynamic Homescreen canvas?  
