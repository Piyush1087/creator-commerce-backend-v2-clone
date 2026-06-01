**Tab 2: Intelligence & Funnel Gaps**   
\[FRAMEWORK CONSTRAINT: PERSISTENT SHELL\]  
Universal Sidebar (Desktop): Render as a fixed, dark-themed left-aligned container (80px width).  
Universal Header: Fixed top-bar containing \[Upgrade (Green Primary Button)\], Search Insights input bar, Notification Bell, and User Profile dropdown.  
Mobile Wrapper: Fix the Universal Header to the top and provide a universal sticky footer for primary mobile actions.

### **\[DYNAMIC CANVAS: TAB 2 INTELLIGENCE & GAPS\]**

Trigger Logic: Render this view when the user explicitly mounts "Tab 2: Intelligence & Gaps". Breadcrumb: Brand Centre / Tab 2: Intelligence & Gaps (Active Breadcrumb Underline in Green)   
\========================================================================  
\[DESKTOP NAVIGATION SWITCHER BAR\]  
Layout: Flexible row container mounted directly below breadcrumbs.   
Styling: Dark-themed segmented container matching canvas borders, height 48px.  
| ⚪ Inactive Tab Toggle (Green Accent Underline): 🎨 Tab 1: Brand DNA  
| 🟢 Active Tab Toggle (Hover Pointer State):  🧠 Tab 2: Intelligence & Gaps  
| ⚪ Inactive Tab Toggle (Hover Pointer State):  📅 Tab 3: Campaign Planner \[3 Pending\]  
\----------------------------------------------------------------------------------------------------

\[MOBILE ADAPTIVE NAVIGATION ELEMENT\]  
Trigger: Tapping the active breadcrumb row header ("Brand Centre / Tab 1...") slides a Modal Bottom-Sheet menu up from the screen footer container.  
Bottom-Sheet Multi-Choice Links:  
  • 🎨 Tab 1: Brand DNA                      (\>)  
  • 🧠 Tab 2: Intelligence & Gaps            (\>)  
  • 📅 Tab 3: Campaign Planner \[3 Pending\]   (\>)  
Action Button: \[Ghost Button\] Cancel and Close Drawer Overlay  
\========================================================================

Dashboard Meta-Data: System Status: ACTIVE (Text in Green) | Data Refreshed: {{ refresh\_date }} (e.g., May 2026\) | Date Range: Last 30 Days Interaction Logic: Tab 2 contains 2 collapsible zones. Only one zone can be expanded at a time. Zone 1 is collapsed by default.

### **Zone 1: Intelligence & Performance Dashboard**

Header: Influencer Performance & Alignment Dashboard (Last 30 Days) Visibility Logic: Collapsed by default. Action: \[Caret Icon\] (Toggle Expand/Collapse) Global Legend: \[Icon: Green Dot\] On Track / High Potential | \[Icon: Yellow Dot\] Needs Optimization | \[Icon: Red Dot\] Critical Risk / Underperforming

#### **Section 1: Growth Opportunities & Predictive Impact**

This section will be always visible when Zone 1 is collapsed  
Header: Predictive Impact & Revenue Levers Helper Text: This section isolates our current baseline ("As-Is") and projects the immediate revenue lift available if we optimize our creator alignments and distribution channels. Layout: 2-Column Grid  
Column 1: Impact Matrix

* Header: 📈 IMPACT INDEX  
* Metric: \[Status Indicator: Green Dot\] {{ total\_revenue\_lift }} (e.g., \+35% Revenue Lift) (Text in Green)  
* Insight Text: "Optimizing creator-to-product alignment and scaling the top 15% of performing assets into Meta Whitelisted Ads will unlock a 35% lift in previously leaking revenue."

Column 2: Lever Breakdown (Bar Chart)

* Header: Individual Revenue Lift Potential  
* Lever 1: \[Status Indicator: Green Dot\] PDP Alignment | \[Progress Bar Fill: Green\] {{ pdp\_lift }} (e.g., \+15.5%)  
  * Context: (Low conversion fix)  
* Lever 2: \[Status Indicator: Yellow Dot\] Instagram Perf. | \[Progress Bar Fill: Yellow\] {{ ig\_lift }} (e.g., \+9.5%)  
  * Context: (Hook rate optimization)  
* Lever 3: \[Status Indicator: Green Dot\] Meta Ad Boost | \[Progress Bar Fill: Green\] {{ meta\_lift }} (e.g., \+10.0%)  
  * Context: (Paid amplification)

#### **Section 2: Baseline, Influencer Health & Brand Integrity**

Header: Ecosystem Health & Quality Helper Text: A deep-dive comparison tracking our core brand metrics against the actual quality and alignment scores of the creators we contracted over the last 30 days. Layout: 3-Column Grid  
Column 1: Brand Base Metrics

* Metric 1: 📢 REACH  
  * Value: \[Status Indicator: Green Dot\] {{ reach\_metric }} (e.g., 1.2M) ( 📈 {{ reach\_growth }} vs MoM)  
* Metric 2: \[Status Indicator: Yellow Dot\] ENGAGEMENT RATE  
  * Value: Avg: {{ engagement\_rate }} (e.g., 4.1%)  
  * Benchmark: (Industry Benchmark: {{ industry\_benchmark }} e.g., 3.2%)  
* Metric 3: \[Status Indicator: Green Dot\] FOLLOWER GROWTH  
  * Value: {{ follower\_growth }} (e.g., \+4.5k New Followers)  
* Metric 4: 👥 CREATOR VOLUME  
  * Value: {{ active\_collabs }} (e.g., 24 Active Collaborations)

Column 2: Influencer Cohort Health

* Metric 1: 👥 AUDIENCE OVERLAP  
  * Value: \[Status Indicator: Yellow Dot\] Avg: {{ audience\_match }} (e.g., 32% Niche Match)  
  * Target: \[Target: 25%-40% for growth\]  
* Metric 2: 🎭 ARCHETYPE MATCH  
  * Breakdown: {{ primary\_archetype\_match }} (e.g., 60% "The Everyman") | {{ secondary\_archetype\_match }} (e.g., 30% "The Expert/Sage") | {{ tertiary\_archetype\_match }} (e.g., 10% "The Jester/Entertainer")  
* Metric 3: \[Status Indicator: Green Dot\] CONTENT ALIGNMENT INDEX  
  * Value: {{ alignment\_index }} (e.g., 78% Aesthetic & Tone Match)  
  * Context: (Up 5% after new brief guidelines)

Column 3: Quality & Risk

* Metric 1: ✨ CONTENT QUALITY RATING  
  * Value: \[Status Indicator: Green Dot\] Score: {{ quality\_score }} (e.g., 8.2 / 10\)  
  * Breakdown: Visuals: High-Fi | Messaging: Relatable | \[Status Indicator: Yellow Dot\] Average Hook Rate: {{ hook\_rate }} (e.g., 38%)  
* Metric 2: 🛡 BRAND SAFETY SCORE  
  * Value: \[Status Indicator: Green Dot\] {{ safety\_percentage }} (e.g., 98.4% Compliant)  
  * Flags: 🚨 Flags: {{ safety\_flags }} (e.g., 1 instance of unapproved profanity (Post since archived).)

#### **Section 3: Competitive Intelligence & Landscape Matrix**

Header: Market Share & Semantic Positioning Helper Text: How our brand voice slices through the market. This section highlights our Share of Voice alongside structural discrepancies between our strategy and our competitors. Layout: 3-Column Grid  
Column 1: Share of Voice (SOV)

* Visual: \[Render Donut Chart\]  
* Legend Mapping:  
  * \[Status Indicator: Yellow Dot\] Our Brand: {{ brand\_sov }} (e.g., 28%)  
  * \[Status Indicator: Green Dot\] Competitor A: {{ comp\_a\_sov }} (e.g., 42%)  
  * \[Status Indicator: Red Dot\] Competitor B: {{ comp\_b\_sov }} (e.g., 18%)  
  * \[Status Indicator: Purple Dot\] Others: {{ others\_sov }} (e.g., 12%)

Column 2: Archetype Matrix

* Header: Top Archetypes in the Space:  
* Block 1: 🏢 OUR BRAND:  
  * Primary: {{ brand\_primary\_archetype }} (e.g., The Everyman \- 60%)  
  * Secondary: {{ brand\_secondary\_archetype }} (e.g., The Expert \- 30%)  
* Block 2: ⚔️ COMPETITORS (AVERAGE):  
  * Primary: {{ comp\_primary\_archetype }} (e.g., The Jester \- 45%)  
  * Secondary: {{ comp\_secondary\_archetype }} (e.g., The Rebel \- 35%)  
* Takeaway Callout (High-Visibility Box): *Takeaway: Competitors lean into loud entertainment; we own the 'trustworthy expert' narrative.*

Column 3: Comp. Content Pillars

* Header: Competitor Themes (Last 30d):  
* Theme 1: {{ comp\_theme\_1 }} (e.g., 1\. "De-influencing / Dupes")  
  * Context: (Massive spike in traction)  
* Theme 2: {{ comp\_theme\_2 }} (e.g., 2\. "Aggressive Unboxings")  
  * Context: (Fast-paced ASMR style)  
* Theme 3: {{ comp\_theme\_3 }} (e.g., 3\. "Shock-Value Challenges")  
  * Context: (High reach, low conversion)  
* Takeaway Callout (High-Visibility Box): *Takeaway: Competitors win on shock value; we win on utility.*

### **Zone 2: AI-Driven Actionable Insights**

Header: AI-Driven Actionable Insights  
Visibility Logic: Expanded view.  
Action: \[Caret Icon\] (Toggle Expand/Collapse)

#### **Section 1: Recommendations Feed Controls**

Header: Actionable Opportunities  
Helper Text: Prioritized, data-backed interventions designed to immediately correct funnel leaks or scale high-performing assets.  
Layout: Top Control Strip

* Filter Dropdown 1: \[Filter: View Unresolved (11) ▾\] (Active state outlined in Green)  
* Filter Dropdown 2: \[Sort By: Impact (High to Low) ▾\]  
* Archive Access (Right-Aligned): \[Icon: Folder\] Open Archive Box (4)  
  * Logic: Opens the repository of insights that were either dismissed or already moved to the planner (kept for a rolling 30 days).

#### **Section 2: Insight Cards (Default / Collapsed State)**

Layout: Full-width list format, rendering cards based on priority filters.  
**Card Archetype 1: Funnel Correction (e.g., PDP Leak)**

* Title: \[Icon: Lightbulb (Green)\] Fix Creative Leak on Landing Pages  
* Tags: \[Badge: 🔴 HIGH PRIORITY\] | \[Badge: 📦 PDP ALIGNMENT\]  
* Description: 📝 High traffic from Instagram is bouncing. Sync creator hooks with PDP imagery to hold customer attention and fix conversions.  
* Actions: \[Primary Button (Green)\] Move to Campaign Planner | \[Ghost Button\] Read more 🔽

**Card Archetype 2: Scaling Opportunity (e.g., Paid Amplification)**

* Title: \[Icon: Rocket (Green)\] Scale Winning Assets into Paid  
* Tags: \[Badge: 🔴 HIGH PRIORITY\] | \[Badge: 🚀 PAID META\]  
* Description: 📝 The top 15% of organic creator posts out-perform our brand ads. Whitelist these high-performers on Meta to maximize ROAS.  
* Actions: \[Primary Button (Green)\] Move to Campaign Planner | \[Ghost Button\] Read more 🔽

#### **Section 3: Right-Side Workspace Drawer (Expanded Insights Mode)**

#### **Trigger Logic: Mounted instantly when a user clicks `[Read more ▾]` on an active insight card. Slides out from the right margin (occupying 40% of screen width). Dismissal Logic: Clicking the `[X Close Drawer]` button or tapping the dimmed background overlay unmounts the drawer and restores full focus to the main feed.**

#### **\[DRAWER HEADER BLOCK\]**

* #### **Title: Opportunity Deep-Dive**

* #### **Target Entity: `{{ insight_title }}` (e.g., Fix Creative Leak on Landing Pages)**

* #### **Metadata Pill Stack: `[Badge: 🔴 HIGH IMPACT]` | `[Badge: 📦 PDP ALIGNMENT]` | `[Badge: Est. Lift: +18.5% (Text in Green)]`**

#### **\[DRAWER BODY WORKSPACE\]**

#### **Sub-Section 1: The Funnel Friction Breakdown (The 'Why')**

* #### **Header: 🧠 Underling Data Logic & Telemetry**

* #### **Body Text: `"Data streams from SimilarWeb and Meta proxy layers indicate that 78% of mobile traffic arriving from Instagram discovery links bounces within the first 4.2 seconds of landing on the 'Routine Reset Bundle' PDP. There is a visual and emotional disconnect: consumers are moving from high-trust, relatable creator hooks on social feeds to a static, sterile checkout layout missing authentic community social proof."`**

#### **Sub-Section 2: Market Intercept Evidence**

* #### **Header: 📊 Competitive Discrepancy**

* #### **Body Text: `"Competitor Benchmarking shows that alternative brands in your market niche are executing dedicated 'Before & After' landing page streams. This structural variation gives them a +12% baseline conversion premium on identical media traffic sources."`**

#### **Sub-Section 3: Executable Mitigation Protocol (The 'Fix')**

* #### **Header: 🛠 Step-by-Step Production Directives**

* #### **Step 1: `[Checkbox]` `"Generate and deploy a highly targeted Creator UGC production brief focused on the 72-hour product texture change window."`**

* #### **Step 2: `[Checkbox]` `"Embed the approved asset directly into the PDP layout as a sticky interactive video container above the fold to capture immediate post-click intent."`**

* #### **Step 3: `[Checkbox]` `"Enforce a strict Skincare Compliance check to swap raw efficacy strings with safe barrier-calming terminology before deployment."`**

#### **\[DRAWER FOOTER ACTION ROW \- STICKY TO BOTTOM OF DRAWER\]**

* #### **Left Action: `[Ghost Button (Red Text)] Dismiss & Archive Opportunity`**

* #### **Right Action: `[Primary Button (Green)] Approve & Move to Campaign Planner`**

#### **Section 4: System Action Workflows & State Changes**

Trigger Logic: Executed when the user clicks \[Move to Campaign Planner\].  
**Phase 1: Visual Interaction (Immediate Feedback)**

1. **Button Swap:** The clicked button instantly changes its label to \[Icon: Checkmark\] Moved to Campaign Planner and the background transitions to a solid success state (Green).  
2. **Animation:** The card border briefly flashes Green.  
3. **Transition:** After a 1.5-second delay, the card smoothly shrinks and slides out of the active list array.

**Phase 2: Archiving & Eviction Logic**

* **Active View Eviction:** The card is removed from the "Unresolved" feed. If the user refreshes, logs out, or is inactive for 30 minutes, the card does not reappear in the main grid.  
* **The Destination:** The card is routed directly into the \[📁 Open Archive Box\].  
* **Historical Trail:** Inside the Archive Box, the card persists as a read-only log item stamped with Moved by {{ user\_name }} on {{ date }}. It is kept for a rolling 30 days before systematic deletion.

**Phase 3: Platform Automation (Data Mapping to Tab 3\)**  
*System Background Action:* While the UI is animating, the backend immediately builds a structured draft in **Tab 3: Campaign Planner**.

* **Brief Name Mapping:** Insight Title (e.g., Fix Creative Leak on Landing Pages) maps to the Campaign Brief Name.  
* **Objective Mapping:** The 20-Word Description maps directly into the Creative Direction / Objective summary field in the planner.  
* **Priority Mapping:** The Impact Type (e.g., 🔴 HIGH) applies a systemic P1 / Immediate priority badge to the newly created brief draft.  
* **Cross-Functional Notification (Optional Routing):** The Bucket Assignment tags the brief for the appropriate team (e.g., a 📦 PDP tag flags the E-comm team; a 🚀 PAID tag flags the Media Buying team).

# 