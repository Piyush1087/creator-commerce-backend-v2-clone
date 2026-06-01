**Tab 1: Brand DNA**.  
.

### **\[FRAMEWORK CONSTRAINT: PERSISTENT SHELL\]**

Universal Sidebar (Desktop):   
Universal Header:  (Desktop)  
Mobile Wrapper: Universal Header, sticky footer and hamburger menu

### **\[DYNAMIC CANVAS: TAB 1 BRAND DNA\]**

Trigger Logic: Render this view default during onboarding initialization or when the user explicitly mounts "Tab 1: Brand DNA".   
| \[MODULE CANVAS ROOT: BRAND CENTRE INTERACTION PANEL\]                                             Breadcrumb: Brand Centre / Tab 1: Brand DNA (Active Breadcrumb Label)  
\========================================================================  
\[DESKTOP NAVIGATION SWITCHER BAR\]  
Layout: Flexible row container mounted directly below breadcrumbs.   
Styling: Dark-themed segmented container matching canvas borders, height 48px.  
| 🟢 Active Tab Toggle (Green Accent Underline): 🎨 Tab 1: Brand DNA  
| ⚪ Inactive Tab Toggle (Hover Pointer State):  🧠 Tab 2: Intelligence & Gaps  
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

Interaction Logic: All Zones are collapsible. Zone 1 is expanded by default. Only one zone can be expanded at a time.

### **Zone 1: Brand DNA (collapsible, Expanded by Default)**

Visibility Logic: Section 1 (Brand Profile) remains always visible even when Zone 1 is collapsed. Action: \[Caret Icon\] (Toggle Expand/Collapse)

#### **Section 1: Brand Profile**

Header: Core Identity Primary Action Bar (Right-Aligned): Action: \[Icon: Pencil\] Edit | \[Icon: External Link\] View Public Profile (Text in Green) Logic: Pencil icon triggers inline editing for applicable fields. Data Fields:

* Logo: \[Image Thumbnail\]  
* Brand Name: {{ company\_name }} (e.g., Solv Skincare)  
* Website Link: {{ website\_url }} (Non-editable) (Hyperlink Text in Green)  
* Social Handles: \[Icon: IG\] {{ ig\_handle }} | \[Icon: YT\] {{ yt\_handle }} | \[Icon: TikTok\] {{ tiktok\_handle }}  
* Market Setup: {{ country\_code }} / {{ currency }} (e.g., IN / INR) (Currency auto-mapped by system)  
* Industry Categorization: {{ industry }} \> {{ sub\_industry }} \> {{ niche }} (Non-editable)  
* Lifecycle Stage: {{ lifecycle\_stage }} (e.g., SCALING\_TIER\_2)

#### **Section 2: About the Brand**

Header: Brand Narrative  
Data Fields:

* Tagline: {{ brand\_tagline }}  
* Brief Description: {{ brief\_description }} Action: \[Ghost Button\] View More Details Logic: Clicking "View More Details" opens a right-side drawer. Side Drawer Content (Editable):  
  * Brand Identity: Logo, Brand Name, Tagline, Brand Description.  
  * Unique Selling Points: 1\. {{ USP\_1 }}, 2\. {{ USP\_2 }}, 3\. {{ USP\_3 }}  
  * Compliance: Policy Regulations / {Do Not Say} List.  
  * Action: \[Primary Button (Green)\] Save Changes

#### **Section 3: Brand Identity Matrix**

Header: Aesthetics & Audience Layout: 3-Column Grid \+ Bottom Carousel Column 1: Color Palette & Fonts

* Colors: Display hex circles. \[Icon: Trash\] to remove. \[Icon: \+ Add (Green)\] opens hex code input modal.  
* Fonts: Display active fonts. \[Icon: Trash\] to remove. \[Icon: \+ Add (Green)\] opens font dropdown. Column 2: Tone of Voice & Visual Aesthetics  
* Tone/Visuals: Rendered as dynamic token tags. \[Icon: Trash\] to remove.  
* Input: \[Input Bar\] Type and press enter to add... Column 3 & Bottom Span: Audience Personas Carousel  
* Card Layout: AI-Calculated Persona Name (e.g., "Urban Millennial Skintellectuals").  
* Card Data: Location, Age Range, Affluence Score, Audience Traits.  
* Action: \[Icon: Trash\] to remove. \[Icon: \+ Add (Green)\] to open parameter input modal.  
* Validation: Empty saves are discarded; reverts to last saved state.

#### **Section 4: Focus Products (D2C SKUs)**

Header: Hero Products (Max 5\) Layout: Horizontal Carousel of Product Cards. Card Data: \[Product Image\] \+ {{ product\_name }} (Hyperlinked to PDP in Green). Card Actions: \[Icon: Eye (Top Right)\] to view/edit. \[Icon: Trash (Bottom Right)\] to remove. Global Action: \[Primary Button (Green)\] \+ Add Product Add Product Workflow:

1. Modal opens: \[Input Bar\] Enter PDP URL. (Validation: Must match verified brand domain, no 404s) .  
2. AI Scans URL \-\> Fetches Image & Name \-\> User clicks \[Confirm (Green)\] \-\> Adds to carousel. Product Side Drawer (On Eye Click):  
* Fields (Editable): Image, Name, PDP URL, Price, Brief Description, 3 USPs, {Do Not Say} List, Applicable Offers (Pulled from Section 6).  
* Validation: No fields can be empty except offers. \[Primary Button (Green)\] Confirm Changes.

#### **Section 5: Focus Collections (Categories)**

Header: Key Collections (Max 3\) Layout: Horizontal Carousel of Collection Cards. Card Data: \[Collection Image\] \+ {{ collection\_name }} (Hyperlinked to category page in Green). Card Actions: \[Icon: Eye (Top Right)\] to view/edit. \[Icon: Trash (Bottom Right)\] to remove. Global Action: \[Primary Button (Green)\] \+ Add Collection Add Collection Workflow:

1. Modal opens: \[Input Bar\] Enter Collection URL. (Validation: Must match brand domain, no 404s) .  
2. AI Scans URL \-\> Fetches Image & Name \-\> User clicks \[Confirm (Green)\] \-\> Adds to carousel. Collection Side Drawer (On Eye Click):  
* Fields (Editable): Image, Name, URL, Description, 3 USPs, {Do Not Say} List, Applicable Offers.  
* Validation: No fields empty except offers. \[Primary Button (Green)\] Confirm Changes.

#### **Section 6: Offers & Discount Codes**

Header: Active Promotions Layout: Horizontal Carousel of Offer Cards. Card Data: {{ offer\_name }} | {{ offer\_code }} | {{ brief\_description }}. Card Actions: \[Icon: Eye (Top Right)\] to view/edit. Offer Side Drawer (On Eye Click):

* Fields (Editable): Name (Mandatory), Description (Mandatory), Code, Applicability (Sitewide / Specific Product / Specific Collection), Entity Link, Validity Dates, T\&C.  
* Action: \[Primary Button (Green)\] Confirm Changes.

#### **Section 7: Competitor Radar**

Header: Market Competitors (Max 3\) Layout: Horizontal Carousel of Competitor Cards. Card Data: \[Competitor Logo\] \+ {{ competitor\_name }} (Hyperlinked to their website in Green) \+ {{ reason\_for\_competition }}. Card Actions: \[Icon: Trash (Bottom Right)\] to remove. Global Action: \[Primary Button (Green)\] \+ Add Competitor Add Competitor Workflow:

1. Modal opens: \[Input Bar\] Enter Competitor URL. (Validation: Cannot be own domain, no 404s) .  
2. AI Scans URL \-\> Fetches Name & Logo \-\> User clicks \[Confirm (Green)\] \-\> Adds to carousel.

### **Zone 2: Strategic Budget Management**

Header: Financial Orchestration  
Action: \[Caret Icon\] (Toggle Expand/Collapse)

#### **Section 1: Budget Ceiling & Utilization**

Header: Overall Spend Limits  
Data Fields:

* Monthly Budget: {{ master\_monthly\_budget }} /mo (e.g., ₹85,000 /mo) (Dynamic text in Green)  
* Utilization: {{ utilization\_percentage }}% (Booked \+ Spent / Total) Rendered as a progress bar (Fill in Green). Action: \[Icon: Pencil\] Edit Budget Validation Logic: Cannot fall below already booked amounts. Minimum threshold enforced at ₹50,000 / $1000. Limit of 2 edits per 30-day rolling window.

#### **Section 2: AI-Calculated Budget Distribution Mix**

Header: Strategic Allocation Layout: 3 Data-Driven Pie Charts

* Chart 1 (Asset Mix): % Product vs. % Collection vs. % Sitewide Sale.  
* Chart 2 (Influencer Tier): % Nano vs. % Micro vs. % Mega vs. % Celebrity.  
* Chart 3 (Campaign Objective): % Pulse vs. % Proof vs. % Push vs. % Production. Action: \[Ghost Button (Green Text)\] Know how the budget split is planned Logic: Opens Strategic Adjustment Modal.

Adjustment Modal Content:

* Header: Influencer Marketing Framework Alignment  
* AI Explanation: Text describing the strategic reasoning behind the current mix and the factors influencing adjustments.  
* Alert Banner (Amber/Yellow): "⚠️ Changing the mix may impact ongoing prospects. Live and committed collaborations remain secure and are not impacted."  
* Sliders (Editable): Adjust Asset Allocation, Influencer Tiers, and Campaign Objectives.  
* Validation check during slide: Individual campaign bucket budgets cannot drop below ₹30,000 / $500. UI blocks slider if threshold is hit.  
* Action: \[Primary Button (Green)\] Confirm New Allocation

### **Zone 3: Account & Setup Infrastructure**

Header: Integrations & Usage Action: \[Caret Icon\] (Toggle Expand/Collapse) Layout: 2 Equal Columns.

#### **Section 1: Account Infrastructure**

Header: Plan & Financials

* Escrow Status: \[Status Badge: ACTIVE (Green)\]  
  * Action Link: \[Text Link\] Setup/Manage Escrow →  
* Current Plan: {{ subscription\_tier }} (e.g., Growth Brand Tier)  
* Usage Metric: Outreach Quota \[{{ used\_quota }} / {{ total\_quota }}\] (e.g., \[42/100\])  
  * Action: \[Primary Button (Green)\] Upgrade Plan

#### **Section 2: Setup Infrastructure**

Header: Integrations & Team

* Meta Connection Status: \[Status Badge: ACTIVE (Green)\]  
  * Action Link: \[Text Link\] Setup/Manage Meta Accounts →  
* Team Management: Invite Team Member / Agency User  
  * Action Link: \[Text Link\] Setup/Manage Team →

# Dynamic Industry Routing  To accommodate the platform scaling across different verticals, **Section 4** and **Section 5** have been engineered with **Dynamic Industry Routing**. The UI automatically adapts its headers, taxonomy, and data fields based on the {{ industry }} variable established during onboarding.

*(Note: Sections 1, 2, 3, 6, and 7 remain universally applicable as defined in the previous D2C layout. The variations below replace the standard D2C "Products" and "Collections" blocks).*

### **\[DYNAMIC CANVAS: TAB 1 BRAND DNA \- INDUSTRY VARIATIONS\]**

### **Zone 1: Brand DNA (Expanded by Default)**

#### **Section 4: Dynamic Offerings (Maps to "Products")**

*Visibility Logic: The engine renders one of the following four blocks based on* {{ industry }}*.*  
**\[IF INDUSTRY \= D2C / E-COMMERCE\]**  
Header: Hero Products (Max 5\)  
Layout: Horizontal Carousel of Product Cards.  
Card Data: \[Product Image\] \+ {{ product\_name }} (Hyperlinked to PDP in Green).  
Card Actions: \[Icon: Eye (Top Right)\] to view/edit. \[Icon: Trash (Bottom Right)\] to remove.  
Global Action: \[Primary Button (Green)\] \+ Add Product  
Side Drawer (On Eye Click):

* Fields (Editable): Image, Name, PDP URL, Price, Brief Description, 3 USPs, {Do Not Say} List, Applicable Offers.  
* Action: \[Primary Button (Green)\] Confirm Changes.

**\[IF INDUSTRY \= AI / SAAS\]**  
Header: Core Platforms & Modules (Max 5\)  
Layout: Horizontal Carousel of Platform Cards.  
Card Data: \[Dashboard Screenshot / Icon\] \+ {{ module\_name }} (Hyperlinked to Feature Page in Green).  
Card Actions: \[Icon: Eye (Top Right)\] to view/edit. \[Icon: Trash (Bottom Right)\] to remove.  
Global Action: \[Primary Button (Green)\] \+ Add Module  
Side Drawer (On Eye Click):

* Fields (Editable): Screenshot/Icon, Module Name, Feature URL, Starting Price (e.g., $99/mo or 'Custom'), Brief Description, 3 Key Capabilities (USPs), {Do Not Say} List (e.g., "Guaranteed 10x ROI"), Applicable Offers.  
* Action: \[Primary Button (Green)\] Confirm Changes.

**\[IF INDUSTRY \= HEALTHCARE & WELLNESS\]**  
Header: Treatments & Programs (Max 5\)  
Layout: Horizontal Carousel of Service Cards.  
Card Data: \[Treatment Image\] \+ {{ treatment\_name }} (Hyperlinked to Service Page in Green).  
Card Actions: \[Icon: Eye (Top Right)\] to view/edit. \[Icon: Trash (Bottom Right)\] to remove.  
Global Action: \[Primary Button (Green)\] \+ Add Treatment  
Side Drawer (On Eye Click):

* Fields (Editable): Image, Treatment Name, Booking URL, Consultation/Procedure Fee, Brief Description, 3 Patient Benefits (USPs), {Do Not Say} List (e.g., "FDA Approved", "100% Painless", "Cures disease"), Applicable Offers.  
* Action: \[Primary Button (Green)\] Confirm Changes.

**\[IF INDUSTRY \= OFFLINE EXPERIENCES (Hospitality/Events/Retail)\]**  
Header: Experiences & Venues (Max 5\)  
Layout: Horizontal Carousel of Experience Cards.  
Card Data: \[Venue/Event Image\] \+ {{ experience\_name }} (Hyperlinked to Booking Page in Green).  
Card Actions: \[Icon: Eye (Top Right)\] to view/edit. \[Icon: Trash (Bottom Right)\] to remove.  
Global Action: \[Primary Button (Green)\] \+ Add Experience  
Side Drawer (On Eye Click):

* Fields (Editable): Image, Experience Name, Ticket/Booking URL, Price per Pax/Night, Brief Description, 3 Highlight Features (USPs), {Do Not Say} List (e.g., "Unlimited alcohol", "Guaranteed celebrity appearances"), Applicable Offers.  
* Action: \[Primary Button (Green)\] Confirm Changes.

#### **Section 5: Dynamic Groupings (Maps to "Collections")**

*Visibility Logic: The engine renders one of the following four blocks based on* {{ industry }}*.*  
**\[IF INDUSTRY \= D2C / E-COMMERCE\]**  
Header: Key Collections (Max 3\)  
Layout: Horizontal Carousel of Collection Cards.  
Card Data: \[Collection Image\] \+ {{ collection\_name }} (Hyperlinked to category page in Green).  
Card Actions: \[Icon: Eye (Top Right)\] to view/edit. \[Icon: Trash (Bottom Right)\] to remove.  
Global Action: \[Primary Button (Green)\] \+ Add Collection  
Side Drawer (On Eye Click):

* Fields (Editable): Image, Name, URL, Description, 3 USPs, {Do Not Say} List, Applicable Offers.  
* Action: \[Primary Button (Green)\] Confirm Changes.

**\[IF INDUSTRY \= AI / SAAS\]**  
Header: Subscription Plans & Tiers (Max 3\)  
Layout: Horizontal Carousel of Tier Cards.  
Card Data: \[Tier Icon\] \+ {{ plan\_name }} (e.g., Enterprise Scale) (Hyperlinked to Pricing Page in Green).  
Card Actions: \[Icon: Eye (Top Right)\] to view/edit. \[Icon: Trash (Bottom Right)\] to remove.  
Global Action: \[Primary Button (Green)\] \+ Add Subscription Tier  
Side Drawer (On Eye Click):

* Fields (Editable): Icon, Plan Name, Pricing URL, Brief Description, 3 Core Value Props (USPs), {Do Not Say} List, Applicable Offers (e.g., "2 Months Free on Annual").  
* Action: \[Primary Button (Green)\] Confirm Changes.

**\[IF INDUSTRY \= HEALTHCARE & WELLNESS\]**  
Header: Specialties & Departments (Max 3\)  
Layout: Horizontal Carousel of Department Cards.  
Card Data: \[Specialty Image\] \+ {{ specialty\_name }} (e.g., Cosmetic Dermatology) (Hyperlinked to Department Page in Green).  
Card Actions: \[Icon: Eye (Top Right)\] to view/edit. \[Icon: Trash (Bottom Right)\] to remove.  
Global Action: \[Primary Button (Green)\] \+ Add Specialty  
Side Drawer (On Eye Click):

* Fields (Editable): Image, Specialty Name, URL, Description, 3 Pillar Services (USPs), {Do Not Say} List, Applicable Offers.  
* Action: \[Primary Button (Green)\] Confirm Changes.

**\[IF INDUSTRY \= OFFLINE EXPERIENCES (Hospitality/Events/Retail)\]**  
Header: Locations & Properties (Max 3\)  
Layout: Horizontal Carousel of Property Cards.  
Card Data: \[Location Image\] \+ {{ property\_name }} (e.g., Downtown Studio) (Hyperlinked to Location Page in Green).  
Card Actions: \[Icon: Eye (Top Right)\] to view/edit. \[Icon: Trash (Bottom Right)\] to remove.  
Global Action: \[Primary Button (Green)\] \+ Add Location  
Side Drawer (On Eye Click):

* Fields (Editable): Image, Property Name/City, Maps URL, Brief Description, 3 Location Perks (USPs), {Do Not Say} List, Applicable Offers.  
* Action: \[Primary Button (Green)\] Confirm Changes.

### **Universal Validation Logic for Sections 4 & 5**

* **Domain Security:** When a user enters a URL in the "Add" modal across *any* industry, the system validates that the URL domain matches the {{ website\_url }} verified in Section 1\.  
* **AI Extraction:** On passing the domain check, the AI Web Scraper automatically fetches the respective Image/Screenshot and Title, prompting the user to click \[Confirm (Green)\] before adding it to the carousel.

# 