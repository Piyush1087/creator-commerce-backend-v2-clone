**Tab 3: Campaign Planner**.  
This tab serves as the intelligent aggregation layer, utilizing the **Green** differential theme for primary orchestration actions while clearly differentiating between *New Campaigns* (Green), *Additions* (Yellow), and *Auto-Pauses* (Red).

### **\[FRAMEWORK CONSTRAINT: PERSISTENT SHELL\]**

Universal Sidebar (Desktop): Render as a fixed, dark-themed left-aligned container (80px width).  
Universal Header: Fixed top-bar containing \[Upgrade (Green Primary Button)\], Search Insights input bar, Notification Bell, and User Profile dropdown.  
Mobile Wrapper: Fix the Universal Header to the top and provide a universal sticky footer for primary mobile actions.

### **\[DYNAMIC CANVAS: TAB 3 CAMPAIGN PLANNER\]**

Trigger Logic: Render this view when the user explicitly mounts "Tab 3: Campaign Planner" or is routed here from a Tab 2 Insight Card.  
Breadcrumb: Brand Centre / Tab 3: Campaign Planner (Active Breadcrumb Underline in Green)  
\========================================================================  
\[DESKTOP NAVIGATION SWITCHER BAR\]  
Layout: Flexible row container mounted directly below breadcrumbs.   
Styling: Dark-themed segmented container matching canvas borders, height 48px.  
| ⚪ Inactive Tab Toggle (Green Accent Underline): 🎨 Tab 1: Brand DNA  
| ⚪ Inactive Tab Toggle (Hover Pointer State):  🧠 Tab 2: Intelligence & Gaps  
| 🟢 Active Tab Toggle (Hover Pointer State):  📅 Tab 3: Campaign Planner \[3 Pending\]  
\----------------------------------------------------------------------------------------------------

\[MOBILE ADAPTIVE NAVIGATION ELEMENT\]  
Trigger: Tapping the active breadcrumb row header ("Brand Centre / Tab 1...") slides a Modal Bottom-Sheet menu up from the screen footer container.  
Bottom-Sheet Multi-Choice Links:  
  • 🎨 Tab 1: Brand DNA                      (\>)  
  • 🧠 Tab 2: Intelligence & Gaps            (\>)  
  • 📅 Tab 3: Campaign Planner \[3 Pending\]   (\>)  
Action Button: \[Ghost Button\] Cancel and Close Drawer Overlay  
\========================================================================

Dashboard Meta-Data: Status: Drafts Pending Review | Consolidation Engine: ACTIVE (Text in Green) | Date: {{ current\_month }} (e.g., May 2026\)  
Helper Text (Top of Page): *"The system intelligently consolidates your approved insights. Rather than launching 15 separate briefs, it groups tasks automatically by \[Objective × Influencer Size\] into unified master campaigns."*

### **Zone 1: Main Campaign Planner Dashboard**

Visibility Logic: Default view upon entering Tab 3\. Displays the feed of aggregated drafts waiting for human-in-the-loop review.

#### **Section 1: Ready-to-Launch Master Campaigns**

Header: Orchestrated Drafts  
Helper Text: Insights with entirely new Objective/Tier combinations have been grouped into fresh master campaigns.  
**Card Archetype 1: New Campaign (Green Badge)**

* Header Tag: \[Badge: 🟢 NEW CAMPAIGN (Green Outline)\]  
* Title: {{ campaign\_name }} (e.g., Mint Eyeliner promo)  
* Consolidation Summary:  
  * \[Icon: Target\] Objective: {{ objective\_type }} (e.g., Pulse)  
  * \[Icon: User\] Target Tier: {{ influencer\_tier }} (e.g., Nano/Micro Creators)  
* Attached Configurations:  
  * 📦 1 Product Assigned: {{ product\_name }} (e.g., Rapid Clear Spot Gel)  
  * 📝 2 Production Briefs: {{ brief\_count\_summary }} (e.g., Myth-Busting & Routine Integration)  
* **Action Row Panel (Bottom of Card):**  
* Left-Aligned Action: \[Ghost Button (Red Text)\] Discard ❌  
  * *Interaction Logic:* Plays an eviction animation, wiping the draft from the active planner session.  
* Right-Aligned Actions: \[Ghost Button\] View Details 📄 | \[Primary Button (Green)\] Launch Campaign 🚀  
  * *Interaction Logic for View Details:* Freezes background scroll and slides open the Right-Side Strategy Drawer populated with Card 1 metrics.  
  * *Interaction Logic for Launch:* Hand-off click. Deep-links the user directly to Step 3 of the external **Create Campaign Module** workstation with pre-populated values.


#### **Section 2: Intelligent Additions to Live Campaigns**

Header: Pipeline Suggestions  
Helper Text: These insights map to an already active campaign. The system proposes injecting these new directives directly into your existing workflow.  
**Card Archetype 2: Suggested Update (Yellow Badge)**

* Header Tag: \[Badge: 🟡 SUGGESTED UPDATE (Amber Outline)\]  
* Title: Append to {{ existing\_campaign\_name }} (e.g., Append to: Mint Eyeliner promo Campaign )  
* Injection Summary:  
  * Adding: 📦 1 New Product (e.g., Routine Reset Bundle)  
  * Adding: 📝 1 Corrective Brief (e.g., PDP Conversion Fix: Before/After Hook)  
* **Action Row Panel (Bottom of Card):**  
* Left-Aligned Action: \[Ghost Button (Red Text)\] Discard ❌  
  * *Interaction Logic:* Plays an eviction animation, wiping the draft from the active planner session.  
* Right-Aligned Actions: \[Ghost Button\] View Details 📄 | \[Primary Button (Green)\] Launch Campaign 🚀  
  * *Interaction Logic for View Details:* Freezes background scroll and slides open the Right-Side Strategy Drawer populated with Card 1 metrics.  
  * *Interaction Logic for Launch:* Hand-off click. Deep-links the user directly to Step 3 of the external **Create Campaign Module** workstation with pre-populated values.


#### **Section 3: Automated Fast-Track Actions (Read-Only Log)**

Header: Auto-Executed Pauses & Security Actions  
Helper Text: Negative optimization insights bypass manual review to instantly stop budget leakage.  
**Card Archetype 3: Auto-Pause Summary (Red Badge)**

* Header Tag: \[Badge: 🔴 IMMEDIATE SYSTEM ACTIONS SUMMARY (Red Outline)\]  
* Status Banner: ⚠️ Bypassed review to prevent immediate budget waste. Process executed.  
* Log Item 1: 🛑 Paused Brief: {{ brief\_id/name }} (e.g., "Ingredient Deep Dive" (Creative Fatigue \> 28 Days))  
* Log Item 2: 🛑 Paused Product: {{ product\_id/name }} (e.g., Focus shifted from "Glow Serum")  
* Action Panel (Bottom of Card):  
  * \[Ghost Button\] Acknowledge Receipt *(Dismisses card from view)*

### **Zone 2: Contextual Right-Side Strategy Drawer**

* **Trigger Logic:** Mounted instantly when a user clicks \[View Details 📄\] on Card 1 or Card 2 inside the main dashboard view. Slides out from the right workspace boundary to fill 40% of screen width.  
* **Dismissal Logic:** Clicking the \[X Close Drawer\] button or tapping the dimmed layout background unmounts the drawer and unlocks the main dashboard view.

**\[DRAWER TOP STRIP\]**

* **Header:** Strategy Overview Workspace  
* **Dynamic Title Field:** Master Shell: "SUMMER PULSE AWARENESS"  
* **Action Button (Right-Aligned):** \[X Close Drawer\]

**\[DRAWER MAIN PANEL BODY\]**

**Sub-Section 1: Core Strategy Blueprint**

* 🎯 **Campaign Objective:** Pulse (Brand Awareness)  
* 👥 **Influencer Attributes & Persona Targeting:** \* *Archetype Profile:* Everyman  
  * *Creator Tier Range:* Mid-Size (50k-100k Followers)  
  * *Audience Demographics:* United States Geo | Female | Age Windows 18-34 | Explicit Beauty & Skincare Interests.  
* 💰 **Operational Budget Parameters:** $2,000 \- $5,000 allocation threshold per contracted creator \+ Complimentary Hydration Product Bundle.  
* 📅 **Campaign Architecture Deadline:** Fixed Target Date (June 30, 2026).

**Sub-Section 2: Consolidated Products & Briefs Matrix**

👉 **ASSET ASSIGNMENT 1: \[Product A: Daily Cleanser\]**

* └── 📝 **Production Brief 1 Layout:** Creator-Led Video  
  * *Content Pillar / Theme Core:* "My 3-Step Morning Chaos Routine"  
  * *Required Deliverables:* 1x TikTok Video, 1x Instagram Reel  
  * *Operational Checklists:* Custom Link-in-Bio localized landing page configuration | Meta Partnership Ad Whitelisting Authorization enabled (30-day rolling access window).

👉 **ASSET ASSIGNMENT 2: \[Product B: Exfoliating Toner\]**

* └── 📝 **Production Brief 2 Layout:** Brand-Led Comparison  
  * *Content Pillar / Theme Core:* "Texture Test: Real vs. Filtered Skin"  
  * *Required Deliverables:* 1x Instagram Reel, 3x Instagram Stories with embedded Swipe-Up Links  
  * *Operational Checklists:* Custom Discount Code tracking parameters generated (PULSETWENTY).

**\[DRAWER FOOTER BAR \- STICKY FIXED TO BOTTOM OF DRAWER\]**

* **Left Action:** \[Ghost Button\] Close Workspace Drawer  
* **Right Action:** \[Primary Button (Green)\] Proceed to Setup Pipeline  
  * *Logic:* Closes the drawer and automatically routes the layout profile into its corresponding configuration wizard module based on the card archetype.

# 