# **UI Copy & Layout Architecture Specifications: General Settings Module (Revised)**

**System Integration:** Settings Framework Workspace, Primary Navigation Tab  
**Document Classification:** Comprehensive UI Copy, Interaction States, and Modal Blueprints

### **1\. Main Header & Navigation Framework**

*This framework controls the top-level navigation layout for the centralized platform configuration space, reducing navigation friction by merging personal accounts and workspace parameters into a single view.*

#### **Layout Structure**

* **Main Container Frame**: Global settings console featuring a horizontal tabbed navigation track.  
* **Header Stack**: Vertical text alignment presenting the primary console header directly above a muted context description.  
* **Tabs Navigation Rail**: Horizontal anchor routing bar displaying the optimized 3-tab layout. The "General" tab utilizes a prominent high-focus active highlight to anchor the viewport.

#### **UI Copy**

* **Headline**: Settings  
* **Subline**: Manage your personal profile, workspace permissions, external integrations, and financial ledgers.  
* **Tabs Navigation Label Elements**:  
  * \[ ⚙️ General \] **(Active Tab Focus State)**  
  * \[ 🧩 Integrations \]  
  * \[ 💳 Finance & Escrow \]

### **SECTION I: PERSONAL ACCOUNT (Visible to All Users)**

*This section governs individual user identity and authentication credentials. It maps to the logged-in user session context and contains no multi-tenant corporate parameters.*

#### **Card 1: Personal Profile**

##### **Layout Structure**

* **Container Block**: Independent horizontal surface card with clean margin spacing below the main tab bar.  
* **Profile Setup Split Grid**: A two-column interactive workspace.  
  * **Left Column**: Circular avatar uploader element with a hover-triggered drag-and-drop file overlay mask.  
  * **Right Column**: Dual-column input layout positioning First Name and Last Name in a parallel horizontal row, with the Account Email input running full-width directly beneath them in a permanently locked state.

##### **UI Copy**

* **Card Header**: Personal Profile  
* **Card Description**: Update your personal identification details and profile image.  
* **Input Field Labels & Attributes**:  
  * **Field 1**: First Name  
    * *Placeholder text*: e.g., Sarah  
  * **Field 2**: Last Name  
    * *Placeholder text*: e.g., Jenkins  
  * **Field 3**: Account Email Address *(Read-Only Mode)*  
    * *Value text*: sarah.jenkins@thecreatorshop.com  
    * *Sub-input Safety Guide*: 🔒 Email address modifications are disabled. Contact system architecture support to initiate identity routing changes.  
* **Avatar Dropzone Overlay Guide**: \[Icon: Cloud Upload\] *Drag & drop an image or click to browse. Max size: 2MB (JPEG, PNG).*

#### **Card 2: Login Security**

##### **Layout Structure**

* **Container Block**: Solid background surface layout component positioned beneath Card 1\.  
* **Secure Value Tracking Row**: High-contrast layout row mapping a masked password visualization component directly adjacent to an explicit interactive modification controller trigger.

##### **UI Copy**

* **Card Header**: Login Security  
* **Card Description**: Manage the authentication password used to access your secure workspace.  
* **Security Context Visualization**:  
  * **Label**: Password  
  * **Masked String Component**: •••••••••••••••• *(Rendered in custom fixed-width spacing)*  
* **Action Element**: \[ Update Password \] *(Launches State 3 Inner Workflow)*

### **SECTION II: ORGANIZATION & TEAM (Visible/Editable by Admins & Campaign Managers)**

*This system architecture node handles tenant-level parameters. Executive accounts cannot modify fields within this section.*

#### **Card 3: Organization Details**

##### **Layout Structure**

* **Section Divider Rule**: A full-width horizontal tracking line establishing a clean structural break between personal profile cards and shared corporate data.  
* **Container Block**: High-density horizontal form container card.  
* **Form Matrix Grid**: Two-column layout grid routing organization address, localized currency mappings, and compliance indicators.

##### **UI Copy**

* **Section Header Callout**: Workspace Administration  
* **Card Header**: Organization Details  
* **Card Description**: Configure the legal billing identity, default workspace currency token mapping, and corporate tax tracking infrastructure.  
* **Input Field Labels & Attributes**:  
  * **Field 1**: Company Legal Name  
    * *Placeholder text*: e.g., Creator Shop Group LLC  
  * **Field 2**: Corporate Address Line  
    * *Placeholder text*: e.g., 442 Workspace Avenue, Suite 100, New York, NY  
  * **Field 3**: Country Location  
    * *Dropdown value selection*: United States (USD)  
  * **Field 4**: Default Operating Currency  
    * *Dropdown value selection*: USD ($) — *Note: This dictates the baseline ledger token mapping for campaign payouts.*  
  * **Field 5**: Tax ID / VAT Number  
    * *Placeholder text*: e.g., EIN 12-3456789

#### **Card 4: Brand Identity**

##### **Layout Structure**

* **Container Block**: Independent horizontal profile card with an explicit informational warning configuration block detailing root domain verification parameters.  
* **Visual Anchor Split**: Left block houses a read-only square asset brand logo preview tracking container; right block hosts the core brand identifiers formatted in a muted, disabled input layout state.

##### **UI Copy**

* **Card Header**: Brand Identity  
* **Card Description**: View the verified brand website parameters and workspace onboarding domains.  
* **Input Field Labels & Attributes**:  
  * **Field 1**: Display Brand Name  
    * *Disabled field value*: The Creator Shop  
  * **Field 2**: Parent Website URL *(Domain Authorization Root)*  
    * *Disabled field value*: thecreatorshop.com  
* **System Guardrail Callout Box**:  
  * \> 🛡️ Workspace Validation Node: Initial account setup requires an exact domain match with your parent website URL (thecreatorshop.com). Brand center variables remain locked here to protect operational integrity.

#### **Card 5: Team Management**

##### **Layout Structure**

* **Container Block**: Full-width independent configuration module housing a multi-row system table ledger.  
* **Control Header Row**: Aligns the functional tracking label and dynamic capacity meter (Seat Tracker Progress Bar) to the left boundary and places the primary invitation pipeline action item directly on the right container border.  
* **Team Roster Grid Matrix**: A 4-column structured directory table mapping personnel assets:  
  * *Column 1*: Member Identity (Avatar, Name string, Email address tag stacked vertically)  
  * *Column 2*: Security Role Allocation Token (Admin, Campaign Manager, Executive badge status indicators)  
  * *Column 3*: Authorization Processing State (Active, Pending Invite)  
  * *Column 4*: Contextual Operational Controls (Edit access layers, Revoke credentials link)

##### **UI Copy**

* **Card Header**: Team Management  
* **Card Description**: Provision platform operational access rights, manage invited seats, and review inbound team join requests.  
* **Workspace Seat Counter Tracker Label**: Capacity Tracker: 3 / 5 Active Workspace Seats Occupied  
* **Primary Interactive CTA Element**: \[ Invite New Member \] *(Action engine parameters defined in States 4 & 5\)*  
* **Table Grid Directory Labels & Static Row Value Iterations**:  
  * **Row 1 Tracking Matrix**:  
    * *Member*: \[Avatar: SJ\] **Sarah Jenkins (You)** \\n *sarah.jenkins@thecreatorshop.com*  
    * *Role Badge*: \[Pill Badge: Admin\] *(Deep Teal background theme)*  
    * *Status*: 🟢 Active Now  
    * *Actions*: \[ Manage Permissions \] *(Disabled)*  
  * **Row 2 Tracking Matrix**:  
    * *Member*: \[Avatar: MT\] **Marcus Thorne** \\n *marcus.t@thecreatorshop.com*  
    * *Role Badge*: \[Pill Badge: Campaign Manager\] *(Muted Slate background theme)*  
    * *Status*: 🟢 Active  
    * *Actions*: \[ Revoke Access \]  
  * **Row 3 Tracking Matrix**:  
    * *Member*: \[Avatar: AG\] **Agency Partner Link** \\n *collab@vanguard-agency.com* *(Allowed external domain connection)*  
    * *Role Badge*: \[Pill Badge: Executive\] *(Light Gray background theme)*  
    * *Status*: ⏳ Invite Pending  
    * *Actions*: \[ Resend Invitation \] • \[ Cancel Invite \]

### **3\. Comprehensive State Machine Matrix**

#### **State 1: Baseline Read-Only State (Pristine Dashboard View)**

* **Layout Mechanics**: All input fields across Section I and Section II render in an un-focused read-only state. Interactive text rings and hover outlines remain hidden to maintain visual cleanliness.  
* **Action Status**: The persistent screen bottom sticky bar remains completely unmounted from the DOM execution stack.

#### **State 2: Active Mutation State (Unsaved Profile/Org Changes)**

* **Layout Mechanics**: Triggered instantly when an Admin or Campaign Manager changes text values in an authorized form field. Affected elements assume an active input tracking state (1px solid **Aurora Green** focus outline).  
* **Action Status**: In strict adherence to **Constraint PIC-02**, a fixed bottom sticky footer bar transitions into the active viewport.  
* **UI Copy Control Strings**:  
  * **Left-Aligned Alert Text**: ⚠️ Unsaved Structural Modifications Detected  
  * **Action Footer Row Right-Aligned Matrix**:  
    * \[Button: Cancel & Discard Changes\] *(Ghost Text Element, resets input values to original database states)*  
    * \[Button: Save Workspace Changes\] *(Solid Aurora Green Button, triggers database write operation)*

#### **State 3: Password Modification Window (Inline Drawer Overlay)**

* **Layout Mechanics**: Invoked by selecting \[ Update Password \] in Card 2\. This control expands an active inline configuration drawer directly below the row matrix using a smooth accordion layout.  
* **UI Copy Elements**:  
  * **Field Input 1 Label**: Current Security Password  
    * *Placeholder*: ••••••••••••  
  * **Field Input 2 Label**: New Workspace Password  
    * *Placeholder*: Minimum 8 characters, 1 number  
  * **Field Input 3 Label**: Confirm New Workspace Password  
    * *Placeholder*: Re-enter your new password  
  * **Inline Real-Time Password Strength Diagnostic Row**:  
    * *Condition Unmet*: ❌ Password must exceed 8 characters and contain at least 1 alpha-numeric integer node.  
    * *Condition Met Success Badge*: ✅ Account Security Password Strength Verification: High Integrity  
  * **Drawer Actions Stack**: \[ Commit Security Update \] *(Disabled until validation matches)* • \[ Close Window \]

#### **State 4: Role-Based Access Restriction State (Executive User View)**

* **Layout Mechanics**: Automatically applied if the logged-in user session carries the Executive security role token.  
* **Action Status**: The \[ Invite New Member \] CTA button in Card 5 is converted to a disabled, greyed-out visual layout configuration state. All inline modification form elements throughout Section II are hard-locked.  
* **UI Copy Tooltip Overlay**: 🔒 Read-Only Access Layer: Executive profiles are restricted from modifying workspace settings, brand centers, active campaigns, or managing team invites. Contact your Admin to elevate permissions.

#### **State 5: Capacity Boundary Enforcement State (5-Seat Cap Exhaustion)**

* **Layout Mechanics**: Triggered dynamically when the database tracks exactly 5 active/pending members within the workspace configuration row (Adhering to **Constraint PIC-05**).  
* **Action Status**: The \[ Invite New Member \] primary CTA button changes to a disabled state for all users, regardless of role tier.  
* **UI Copy Inline Status Alert**: ⚠️ Workspace Seat Capacity Fully Exhausted (5/5 Seats Engaged). Revoke an active member or cancel a pending invitation pipeline to provision a new user seat.

### **4\. System Modals & Drawer Overlays**

#### **Modal A: Team Member Invitation Pipeline Drawer**

* **Layout Mechanics**: Launched by clicking \[ Invite New Member \] in Card 5 (provided the system isn't in State 4 or State 5). In compliance with **Constraint PIC-01**, this deployment completely bypasses screen redirection loops, smoothly translating out a **460px wide state-preserving Right-Side Drawer Overlay**.

\+-------------------------------------------------------+  
|  DRAWER: INVITE TEAM MEMBER                       \[X\] |  
|  Provision operational access infrastructure.        |  
|                                                       |  
|  Target Recipient Email Address                       |  
|  \[ agency-partner@external-domain.com              \]  |  
|  \> Notice: External domains accepted for agency access|  
|                                                       |  
|  Workspace Role Assignment Allocation                 |  
|  ( ) Admin (Full administrative and financial access)  |  
|  (\*) Campaign Manager (All access except financial)   |  
|  ( ) Executive (Read-only workspace access layer)    |  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  | \> Role Boundary Context: Campaign Managers can   |  |  
|  | edit campaigns and settings but cannot execute  |  |  
|  | billing changes or manage escrow ledger balances|  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \[ Cancel & Close \]       \[ Dispatch Safe Invite Code \]|  
\+-------------------------------------------------------+

##### **UI Copy**

* **Drawer Title Header**: Invite Team Member  
* **Drawer Subline Helper Text**: Provision secure platform workspace access parameters to internal personnel or external agency partners. Current seat selection utilizes Seat slot position \[ Current Seat Number \] of 5\.  
* **Input Label 1**: Target Recipient Email Address  
  * *Field Placeholder text*: e.g., teammate@brandworkspace.com or agency@external.com  
  * *Contextual Helper Validation Label*: 💡 Network Notice: External email domains are permitted here to facilitate seamless agency collaboration and third-party workflow integration.  
* **Selector Group Title**: Workspace Role Assignment Allocation  
  * **Option A**: Admin — *Grants complete configuration authorization, access rights modification paths, structural settings editing, and master financial/escrow ledger execution capabilities.*  
  * **Option B**: Campaign Manager — *Grants multi-tenant strategy orchestration rights, workspace preference management, and campaign brief execution paths. Financial billing frameworks and escrow wallet configurations are completely hidden.*  
  * **Option C**: Executive — *Grants localized read-only access metrics across campaigns, performance screens, and settings modules. Creating or altering dashboard configuration values is strictly blocked.*  
* **Dynamic Information Warning Card**: \> Role Boundary Context: Campaign Managers possess complete authority to edit campaigns, deploy strategy briefs, and manage overall organizational parameters. However, financial routing paths, subscription updates, escrow top-ups, and ledger configurations remain locked to protect workspace capital controls.  
* **Sticky Drawer Footer Actions Matrix**:  
  * **Left Action Trigger**: \[ Cancel & Close \]  
  * **Right Action Trigger**: \[ Dispatch Safe Invite Code \] *(Disabled until a valid email string structure is populated)*

#### **Modal B: Destructive Access Revocation Guardrail**

* **Layout Mechanics**: Centered focus modal overlay that triggers when an Admin or Campaign Manager clicks \[ Revoke Access \] within the Team Management directory card. This overlay temporarily freezes all underlying interactions.

##### **UI Copy**

* **Modal Title Alert**: ⚠️ Terminate Workspace Access Authorization?  
* **Critical Safety Micro-Copy Message**: *"You are about to securely wipe all active user tokens, dashboard sessions, and operational execution permissions mapped to this user account. The user will immediately be logged out of this organization workspace. Historical logs of their completed creative brief processes and campaign actions will remain preserved inside the ledger audit track as documented in Campaign page Workspace.docx."*  
* **Confirmation Verification Checklist Input**: \[x\] I explicitly verify that I have the administrative authority to revoke this user seat allocation and free an active user slot.  
* **Action Footer Row Controls**:  
  * **Right-Aligned Confirmation Element**: \[ Confirm Access Termination \] *(High-visibility destructive red text fill; button remains disabled until the confirmation checklist box is checked)*  
  * **Left-Aligned Dismissal Element**: \[ Cancel and Retain User Seat \]

### **5\. Mobile Adaptability Compact Layer Rules**

* **Viewport Threshold**: Evaluated on all mobile screen configurations $\\le$ 768px.  
* **Layout Conversions**:  
  * The top 3-tab navigation rail converts into a swipeable horizontal selector track.  
  * Card form matrices transition from parallel dual-column rows into clean, single-column vertical stacks.  
  * The Team Management grid table changes into a series of independent card elements. Detail vectors (such as member names and roles) collapse into a stacked text hierarchy, while operational actions compress into an easily accessible icon menu.  
  * All right-side drawer components automatically adapt to open as full-screen modal overlays, ensuring text remains clearly legible above the absolute typography floor.

