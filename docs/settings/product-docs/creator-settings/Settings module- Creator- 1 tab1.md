# **UI Copy & Layout Architecture Specifications: Creator Profile & Workspace Settings Module**

System Integration: Settings Framework Workspace, Primary Navigation Tab  
Document Classification: Comprehensive UI Copy, Interaction States, and Modal Blueprints

## **1\. Main Header & Navigation Framework**

This framework controls the top-level navigation layout for the centralized platform configuration space, reducing navigation friction by merging personal accounts, logistics, and workspace parameters into a single view.

### **Layout Structure**

* **Main Container Frame:** Global settings console featuring a horizontal tabbed navigation track.  
* **Header Stack:** Vertical text alignment presenting the primary console header directly above a muted context description.  
* **Tabs Navigation Rail:** Horizontal anchor routing bar displaying the optimized 3-tab layout. The "Profile & Workspace" tab utilizes a prominent high-focus active highlight to anchor the viewport.

### **UI Copy**

* **Headline:** Settings  
* **Subline:** Manage your creator identity, secure shipping logistics, team workspace access, and linked social performance nodes.  
* **Tabs Navigation Label Elements:**  
  * \[ ⚙️ Profile & Workspace \] (Active Tab Focus State)  
  * \[ 🧩 Social Channels \]  
  * \[ 💰 Payouts & Tax \]

## **SECTION I: PERSONAL IDENTITY & LOGISTICS (Visible to All Users)**

This section governs individual creator identity parameters and physical fulfillment tracks. It maps directly to the logged-in user session context.

### **Card 1: Creator Profile**

#### **Layout Structure**

* **Container Block:** Independent horizontal surface card with clean margin spacing below the main tab bar.  
* **Profile Setup Split Grid:** A two-column interactive workspace.  
  * **Left Column:** Circular avatar uploader element with a hover-triggered drag-and-drop file overlay mask.  
  * **Right Column:** Dual-column input layout positioning First Name and Last Name in a parallel horizontal row, with the Account Email input running full-width directly beneath them in a permanently locked state.

#### **UI Copy**

* **Card Header:** Creator Profile  
* **Card Description:** Update your public identification details, legal name, and profile image.  
* **Input Field Labels & Attributes:**  
  * **Field 1:** First Name  
    * *Placeholder text:* e.g., Sarah  
  * **Field 2:** Last Name  
    * *Placeholder text:* e.g., Jenkins  
  * **Field 3:** Account Email Address (Read-Only Mode)  
    * *Value text:* sarah.jenkins@creatorspace.com  
  * **Sub-input Safety Guide:** 🔒 Email address modifications are disabled. Contact network architecture support to initiate identity routing changes.  
  * **Avatar Dropzone Overlay Guide:** \[Icon: Cloud Upload\] Drag & drop an image or click to browse. Max size: 2MB (JPEG, PNG).

### **Card 2: Login Security**

#### **Layout Structure**

* **Container Block:** Solid background surface layout component positioned beneath Card 1\.  
* **Secure Value Tracking Row:** High-contrast layout row mapping a masked password visualization component directly adjacent to an explicit interactive modification controller trigger.

#### **UI Copy**

* **Card Header:** Login Security  
* **Card Description:** Manage the authentication password used to access your secure creative workspace.  
* **Security Context Visualization:**  
  * **Label:** Password  
  * **Masked String Component:** •••••••••••••••• (Rendered in custom fixed-width spacing)  
  * **Action Element:** \[ Update Password \] (Launches State 3 Inner Workflow)

### **Card 3: Logistics & Shipping Address**

#### **Layout Structure**

* **Container Block:** Independent horizontal form container card optimized for physical item tracking.  
* **Form Matrix Grid:** Two-column layout grid routing recipient details, exact geographic destinations, and special handling instructions to support brand product sampling campaigns.

#### **UI Copy**

* **Card Header:** Shipping Logistics  
* **Card Description:** Provide your verified shipping address to receive physical product samples, PR packages, and campaign merchandise from brand partners.  
* **Input Field Labels & Attributes:**  
  * **Field 1:** Recipient Legal Name  
    * *Placeholder text:* e.g., Sarah Jenkins  
  * **Field 2:** Street Address Line 1  
    * *Placeholder text:* e.g., 742 Creative Studio Way, Apt 4B  
  * **Field 3:** Street Address Line 2 (Optional)  
    * *Placeholder text:* e.g., Suite, Unit, Building  
  * **Field 4:** City  
    * *Placeholder text:* e.g., Los Angeles  
  * **Field 5:** State / Province  
    * *Placeholder text:* e.g., California  
  * **Field 6:** Postal Code / ZIP  
    * *Placeholder text:* e.g., 90028  
  * **Field 7:** Country  
    * *Dropdown value selection:* United States (US)  
  * **Field 8:** Delivery Instructions (Optional)  
    * *Placeholder text:* e.g., Leave package with the front desk concierge or call box \#402.

## **SECTION II: WORKSPACE & TEAM ADMINISTRATION (Visible/Editable by Owners & Managers)**

This system architecture node handles tenant-level parameters, allowing management agencies or assistants to co-manage a creator's portal.

### **Card 4: Workspace Identity**

#### **Layout Structure**

* **Section Divider Rule:** A full-width horizontal tracking line establishing a clean structural break between personal logistics cards and shared workspace parameters.  
* **Container Block:** High-density horizontal configuration card.  
* **Form Input Row:** Single-column layout routing the operational organization name.

#### **UI Copy**

* **Section Header Callout:** Workspace Administration  
* **Card Header:** Organization Details  
* **Card Description:** Configure the operational identity and business name for your production team or management agency.  
* **Input Field Labels & Attributes:**  
  * **Field 1:** Organization Name  
    * *Placeholder text:* e.g., Sarah Jenkins Media Group

### **Card 5: Team Management**

#### **Layout Structure**

* **Container Block:** Full-width independent configuration module housing a multi-row system table ledger.  
* **Control Header Row:** Aligns the functional tracking label and dynamic capacity meter (Seat Tracker Progress Bar) to the left boundary and places the primary invitation pipeline action item directly on the right container border.  
* **Team Roster Grid Matrix:** A 4-column structured directory table mapping personnel assets:  
  * **Column 1:** Member Identity (Avatar, Name string, Email address tag stacked vertically).  
  * **Column 2:** Security Role Allocation Token (Owner, Manager, Assistant badge status indicators).  
  * **Column 3:** Authorization Processing State (Active, Pending Invite).  
  * **Column 4:** Contextual Operational Controls (Edit access layers, Revoke credentials link).

#### **UI Copy**

* **Card Header:** Team Management  
* **Card Description:** Provision platform operational access rights, manage invited team seats, and review inbound agency join requests.  
* **Workspace Seat Counter Tracker Label:** Capacity Tracker: 1 / 5 Active Workspace Seats Occupied  
* **Primary Interactive CTA Element:** \[ Invite New Member \] (Action engine parameters defined in States 4 & 5\)  
* **Table Grid Directory Labels & Static Row Value Iterations:**  
  * **Row 1 Tracking Matrix:**  
    * *Member:* \[Avatar: SJ\] Sarah Jenkins (You) \\n sarah.jenkins@creatorspace.com  
    * *Role Badge:* \[Pill Badge: Owner\] (Deep Teal background theme)  
    * *Status:* 🟢 Active Now  
    * *Actions:* \[ Manage Permissions \] (Disabled)  
  * **Row 2 Tracking Matrix:**  
    * *Member:* \[Avatar: TM\] Tom Matthews \\n tom@vanguard-talent.com (External management partner)  
    * *Role Badge:* \[Pill Badge: Manager\] (Muted Slate background theme)  
    * *Status:* 🟢 Active  
    * *Actions:* \[ Revoke Access \]  
  * **Row 3 Tracking Matrix:**  
    * *Member:* \[Avatar: AL\] Alex Lee \\n alex.assistant@gmail.com  
    * *Role Badge:* \[Pill Badge: Assistant\] (Light Gray background theme)  
    * *Status:* ⏳ Invite Pending  
    * *Actions:* \[ Resend Invitation \] • \[ Cancel Invite \]

## **3\. Comprehensive State Machine Matrix**

### **State 1: Baseline Read-Only State (Pristine Dashboard View)**

* **Layout Mechanics:** All input fields across Section I and Section II render in an un-focused read-only state. Interactive text rings and hover outlines remain hidden to maintain visual cleanliness.  
* **Action Status:** The persistent screen bottom sticky bar remains completely unmounted from the DOM execution stack.

### **State 2: Active Mutation State (Unsaved Profile/Logistics Changes)**

* **Layout Mechanics:** Triggered instantly when text values are modified in any authorized form field. Affected elements assume an active input tracking state (1px solid Aurora Green focus outline).  
* **Action Status:** A fixed bottom sticky footer bar transitions into the active viewport.  
* **UI Copy Control Strings:**  
  * *Left-Aligned Alert Text:* ⚠️ Unsaved Core Workspace Modifications Detected  
  * *Action Footer Row Right-Aligned Matrix:*  
    * \[Button: Cancel & Discard Changes\] (Ghost Text Element, resets input values to original database states)  
    * \[Button: Save Profile Changes\] (Solid Aurora Green Button, triggers database write operation)

### **State 3: Password Modification Window (Inline Drawer Overlay)**

* **Layout Mechanics:** Invoked by selecting \[ Update Password \] in Card 2\. This control expands an active inline configuration drawer directly below the row matrix using a smooth accordion layout.  
* **UI Copy Elements:**  
  * *Field Input 1 Label:* Current Security Password  
    * *Placeholder:* ••••••••••••  
  * *Field Input 2 Label:* New Account Password  
    * *Placeholder:* Minimum 8 characters, 1 number  
  * *Field Input 3 Label:* Confirm New Account Password  
    * *Placeholder:* Re-enter your new password  
  * *Inline Real-Time Password Strength Diagnostic Row:*  
    * *Condition Unmet:* ❌ Password must exceed 8 characters and contain at least 1 alpha-numeric integer node.  
    * *Condition Met Success Badge:* ✅ Account Security Password Strength Verification: High Integrity  
  * *Drawer Actions Stack:* \[ Commit Security Update \] (Disabled until validation matches) • \[ Close Window \]

### **State 4: Role-Based Access Restriction State (Assistant User View)**

* **Layout Mechanics:** Automatically applied if the logged-in user session carries the Assistant security role token.  
* **Action Status:** The \[ Invite New Member \] CTA button in Card 5 is converted to a disabled, greyed-out visual layout configuration state. All inline modification form elements throughout Section II are hard-locked.  
* **UI Copy Tooltip Overlay:** 🔒 Read-Only Access Layer: Assistant profiles are restricted from modifying workspace branding, updating logistical tracking destinations, or managing team invites. Contact the account Owner to elevate permissions.

### **State 5: Capacity Boundary Enforcement State (5-Seat Cap Exhaustion)**

* **Layout Mechanics:** Triggered dynamically when the database tracks exactly 5 active/pending members within the workspace configuration row.  
* **Action Status:** The \[ Invite New Member \] primary CTA button changes to a disabled state for all users, regardless of role tier.  
* **UI Copy Inline Status Alert:** ⚠️ Workspace Seat Capacity Fully Exhausted (5/5 Seats Engaged). Revoke an active member or cancel a pending invitation pipeline to provision a new team seat.

## **4\. System Modals & Drawer Overlays**

### **Modal A: Team Member Invitation Pipeline Drawer**

* **Layout Mechanics:** Launched by clicking \[ Invite New Member \] in Card 5 (provided the system isn't in State 4 or State 5). This deployment completely bypasses screen redirection loops, smoothly translating out a 460px wide state-preserving Right-Side Drawer Overlay.

\+-------------------------------------------------------+  
|  DRAWER: INVITE TEAM MEMBER                       \[X\] |  
|  Provision operational access infrastructure.        |  
|                                                       |  
|  Target Recipient Email Address                       |  
|  \[ manager-partner@external-agency.com             \]  |  
|  \> Notice: External domains accepted for agency use   |  
|                                                       |  
|  Workspace Role Assignment Allocation                 |  
|  ( ) Owner (Full administrative and financial access)  |  
|  (\*) Manager (All access except channel deletion)     |  
|  ( ) Assistant (Read-only workspace access layer)     |  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  | \> Role Boundary Context: Workspace Managers can  |  |  
|  | edit shipping, view campaigns and social analytics|  |  
|  | but cannot execute payment method updates.       |  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \[ Cancel & Close \]       \[ Dispatch Safe Invite Code \]|  
\+-------------------------------------------------------+

#### **UI Copy**

* **Drawer Title Header:** Invite Team Member  
* **Drawer Subline Helper Text:** Provision secure platform workspace access parameters to production assistants, editors, or external management partners. Current seat selection utilizes Seat slot position \[ Current Seat Number \] of 5\.  
* **Input Label 1:** Target Recipient Email Address  
  * *Field Placeholder text:* e.g., teammate@creativeworkspace.com or agent@talentagency.com  
* **Contextual Helper Validation Label:** 💡 Network Notice: External email domains are permitted here to facilitate seamless talent manager collaboration and third-party workflow integration.  
* **Selector Group Title:** Workspace Role Assignment Allocation  
  * **Option A:** Owner — Grants complete configuration authorization, data rights modification paths, structural settings editing, and master payout ledger execution capabilities.  
  * **Option B:** Manager — Grants multi-tenant coordination rights, preference management, and campaign dashboard access. Critical payout bank validation nodes are hidden.  
  * **Option C:** Assistant — Grants localized read-only access metrics across live performance statistics, brief lists, and shipping statuses. Altering dashboard configuration values is blocked.  
* **Dynamic Information Warning Card:** \> Role Boundary Context: Workspace Managers possess complete authority to verify briefs, manage shipping profiles, and review inbound sponsorships. However, secondary financial routing paths, payout destination updates, and master token disconnects remain locked to protect your capital controls.  
* **Sticky Drawer Footer Actions Matrix:**  
  * *Left Action Trigger:* \[ Cancel & Close \]  
  * *Right Action Trigger:* \[ Dispatch Safe Invite Code \] (Disabled until a valid email string structure is populated)

### **Modal B: Destructive Access Revocation Guardrail**

* **Layout Mechanics:** Centered focus modal overlay that triggers when an Owner or Manager clicks \[ Revoke Access \] within the Team Management directory card. This overlay temporarily freezes all underlying interactions.

#### **UI Copy**

* **Modal Title Alert:** ⚠️ Terminate Workspace Access Authorization?  
* **Critical Safety Micro-Copy Message:** "You are about to securely wipe all active user tokens, dashboard sessions, and operational execution permissions mapped to this user account. The user will immediately be logged out of this creator workspace. Historical logs of their completed brand communications, package confirmations, and optimization adjustments will remain preserved inside the ledger audit track."  
* **Confirmation Verification Checklist Input:** \[x\] I explicitly verify that I have the administrative authority to revoke this user seat allocation and free an active user slot.  
* **Action Footer Row Controls:**  
  * *Right-Aligned Confirmation Element:* \[ Confirm Access Termination \] (High-visibility destructive red text fill; button remains disabled until the confirmation checklist box is checked)  
  * *Left-Aligned Dismissal Element:* \[ Cancel and Retain User Seat \]

## **5\. Mobile Adaptability Compact Layer Rules**

* **Viewport Threshold:** Evaluated on all mobile screen configurations $\\le$ 768px.  
* **Layout Conversions:**  
  * The top settings navigation rail converts into a swipeable horizontal selector track.  
  * Card form matrices (including Profile and Shipping fields) transition from parallel dual-column rows into clean, single-column vertical stacks.  
  * The Team Management grid table changes into a series of independent card elements. Detail vectors (such as member names and roles) collapse into a stacked text hierarchy, while operational actions compress into an easily accessible icon touch menu.  
  * All right-side drawer components automatically adapt to open as full-screen modal overlays, ensuring text remains clearly legible above the absolute typography floor.

