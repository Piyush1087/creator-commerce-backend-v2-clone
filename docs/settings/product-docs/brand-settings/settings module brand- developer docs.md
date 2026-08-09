This documentation outlines the blueprint for implementing the front-end architecture of the **Brand-Side Settings Module** using React 18, TypeScript, and the **Aurora Design System v4.1**.  
It builds upon the database schemas and Zod validation layers already established. Refer back to the **Campaign page Workspace.docx** file to maintain precise UI structural paradigms.

## **Component Architectural Overview**

The settings workspace is a single-page view divided into four logical configuration zones. To guarantee absolute compliance with the **Active Focus Rule** (as detailed in our core dashboard design), clicking to interact with or edit any given configuration card **automatically collapses** all other sections. This prevents viewport clutter and keeps the user's focus on one operation at a time.  
\[Settings Module Parent Canvas\]  
   ├── Zone 1: Team Access Matrix (RBAC Display/Invite)  
   ├── Zone 2: Taxation, Compliance & Billing Profile  
   ├── Zone 3: Secure Reverse Withdrawal Node   
   └── Zone 4: Granular Notification Channel Webhooks

## **Step-by-Step Implementation Guide**

### **Step 1: Parent Canvas Layout & State Initialization**

Build the top-level parent view wrapper using the deep dark background palettes defined in the Aurora Design System tokens.

* **Initialize Active Panel State:** Instantiate a central activePanel string state variable initialized to 'BILLING\_PROFILE'.  
* **Implement Read-Only Permission Scope Enforcer:** Fetch the current user’s system token context upon component mount. If the user's role evaluates to CAMPAIGN\_MANAGER, write an interceptor loop to lock out mutating interactions across the layout:  
  * Inject a global disabled={currentUser.role \=== 'CAMPAIGN\_MANAGER'} prop down into the input primitives of **Zone 2** and **Zone 3**.  
  * Conditionally strip out and replace action element strings (e.g., swapping a "Save Changes" button for a grayed-out "Read-Only: Contact Finance Admin" label).

### **Step 2: Zone 1 Implementation — Team Access Matrix (RBAC)**

This block displays active project managers and provides an inline configuration workflow to adjust clearance parameters.  
\+-------------------------------------------------------------------------+  
| ▼ Stage 1: Team Membership & Role Access Matrix                         |  
\+-------------------------------------------------------------------------+  
|  User Name          Email Address       Assigned Role     Actions       |  
|  \---------------------------------------------------------------------  |  
|  Sarah Jenkins      s.j@company.com     \[Brand Owner ▾\]   \[Revoke\]      |  
|  Alex Rivera        a.r@company.com     \[Campaign Mgr▾\]   \[Revoke\]      |  
|                                                                         |  
|  \+ Add New Team Member                                                  |  
|  Email: \[                     \]  Role: \[Select Role ▾\]  \[Send Invite\]   |  
\+-------------------------------------------------------------------------+

* **Render Layout Table:** Structure a responsive data table parsing active user rows down into User Name, Email Address, Assigned Role, and Actions.  
* **Implement Dropdown Selectors:** For each user row, map the assigned role to a standard HTML select input populated by BrandRoleEnum options (BRAND\_OWNER, FINANCE\_ADMIN, CAMPAIGN\_MANAGER).  
* **Bind Mutating Event Handlers:** Attach an onChange listener to the dropdown selection. Dispatch a background PATCH request immediately to /api/v1/settings/team/role matching the payload defined in your backend schemas.

### **Step 3: Zone 2 Implementation — Taxation, Compliance & Billing**

This section collects billing data required to handle real-time tax calculations during subsequent milestone executions.  
\+-------------------------------------------------------------------------+  
| ▼ Stage 2: Corporate Taxation & Billing Profiles                        |  
\+-------------------------------------------------------------------------+  
|  Registered Company Name                Corporate Billing Address       |  
|  \[ Alpha Cosmetics Corporate Node    \]  \[ 101 Finance District, Bld 4 \] |  
|                                                                         |  
|  Statutory GSTIN (India Layout)         Income Tax PAN (10-Chr String)  |  
|  \[ 27AAAAA0000A1Z5                   \]  \[ ABCDE1234F                  \] |  
|                                                                         |  
|  Default Fallback TDS Tracking Mode                                     |  
|  ( ) 0.00% Exempt   ( ) 1.00% Sec 194-O   (●) 2.00% Sec 194-C Corporate |  
|                                                                         |  
|                                                     \[Save Billing Data\] |  
\+-------------------------------------------------------------------------+

* **Construct Layout Inputs:** Create a grid arrangement containing inputs for Registered Company Name, Corporate Billing Address, GSTIN, and PAN.  
* **Implement Input Sanitization Format Filters:** Link standard JavaScript transformations directly to the onChange event tracking loops to force data uniformity before Zod parsing occurs:  
  * Apply .trim().toUpperCase() string mutations instantly to both the GSTIN and PAN input elements as the user types.  
* **Inject Campaign Manager Masking Rule:** If the current user profile context matches a CAMPAIGN\_MANAGER, use partial string slices to mask sensitive fields (e.g., render the GSTIN text as 27XXXXXXXXXX1Z5 and grey out the input block).

### **Step 4: Zone 4 Implementation — Granular Notification Webhooks**

Skipping to Zone 4 to ensure all system operational alerting pathways are completely secured before wire funding methods are introduced.  
\+-------------------------------------------------------------------------+  
| ▼ Stage 4: System Alerts & Target Webhook Channel Profiles              |  
\+-------------------------------------------------------------------------+  
|  Alert Category          In-App     Email     Slack Webhook Target URL  |  
|  \---------------------------------------------------------------------  |  
|  Escrow Low Balance      \[✓\]        \[✓\]       \[https://hooks.slack...\]  |  
|  Milestone Requests      \[✓\]        \[ \]       \[                     \]  |  
|  Tax Compliance Alert    \[✓\]        \[✓\]       \[                     \]  |  
\+-------------------------------------------------------------------------+

* **Construct Configuration Matrix Table:** Map a multi-column row assembly itemizing rows for every NotificationCategoryEnum value cross-referenced against your checkboxes for In-App, Email, and Slack Webhook.  
* **Embed Dynamic URL Conditional Visibility Logic:**  
  * Place a standard text input element inside the Slack Webhook column block.  
  * Evaluate the sibling toggle status on the fly. If the checkbox for the SLACK\_WEBHOOK channel is actively marked true, use standard inline conditional rendering to transition the text input view from hidden or disabled to an active, interactive input field.  
* **Hook Frontend Client Validation:** Run the localized section validation payload through the client-side validation schema. If the toggle is active but the URL input field resolves to an empty string, block form submission and surface an inline message indicating that a target webhook URL string parameter is required.

### **Step 5: Zone 3 Implementation — Secure Reverse Withdrawal Node**

This panel sets up the verified bank account destination used to return funds to the brand if a creator contract is mutually terminated or fails a compliance check.  
\+-------------------------------------------------------------------------+  
| ▼ Stage 3: Reverse Payout & Escrow Withdrawal Beneficiary              |  
\+-------------------------------------------------------------------------+  
|  Legal Beneficiary Name                 Target Bank Institution Label   |  
|  \[ Alpha Cosmetics Private Ltd       \]  \[ HDFC Bank Ltd               \] |  
|                                                                         |  
|  Corporate Routing Number Input         Confirm Account Routing Number  |  
|  \[ \*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*                  \]  \[ \*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*            \] |  
|                                                                         |  
|  Indian Bank Routing IFSC Code Standard                                 |  
|  \[ HDFC0000123                       \]                                  |  
|                                                                         |  
|  \[✓\] I verify this account is legally authorized to receive funds.       |  
|                                                   \[Link Secure Account\] |  
\+-------------------------------------------------------------------------+

* **Structure Form Layout Fields:** Implement input fields for Beneficiary Name, Bank Name, Account Number, Confirm Account Number, and IFSC Code.  
* **Enforce Safety Matching Rules:** Ensure both account number input strings are obscured during typing (type="password").  
* **Integrate Client-Side Error Interception:** On form submission, perform a deep client-side match check. If accountNumber \!== confirmAccountNumber, block the dispatch call, clear both inputs, focus the user back onto the primary input box, and trigger a field-level error message stating that the account inputs do not match.

## **📲 Mobile Adaptability & Hamburger Compact Layer Rules**

Following the layout rules derived from **Campaign page Workspace.docx**, when the user interface container width encounters responsive mobile viewports $\\le$ 768px, the layout transitions to a vertical mobile layout:  
\[ Mobile Navigation Hamburger Menu \] ➔ Triggers Sliding Nav Drawer Overlay  
                                          └── \[ Link: Billing & Settings Hub \]

1. **Linear Structural Accordion Stacking:** The side-by-side or multi-column spacing profiles snap into a 100% full-viewport width single-column alignment block. All labels slide up cleanly directly above their input objects.  
2. **Table Field Component Flattening:** In **Zone 1** (Team Access Matrix) and **Zone 4** (Notification Grid), standard multi-column layout components flatten into modular flex-cards. Column attributes drop from the row frame, transforming into inline label/value text pairings stacked vertically within each card boundary.  
3. **Sticky Global Actions Underlay Toolbar:** All contextual panel actions, custom clearing buttons, and footer controls merge down into a singular, edge-to-edge fixed mobile footer anchor element (position: fixed; bottom: 0;). This layout ensures that a single, clear primary button tracking the context of the active focus panel is always readily reachable by the user's thumb.

