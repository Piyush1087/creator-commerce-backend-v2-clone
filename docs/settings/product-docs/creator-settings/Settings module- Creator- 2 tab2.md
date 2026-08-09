# **UI Copy & Layout Architecture Specifications: Social Channels Settings Module**

System Integration: Settings Framework Workspace, Primary Navigation Tab  
Document Classification: Comprehensive UI Copy, Interaction States, and Modal Blueprints

## **1\. Main Header & Navigation Framework**

This framework controls the top-level navigation layout for the centralized platform configuration space, tracking the OAuth handshake state for external platform profiles.

### **Layout Structure**

* **Main Container Frame:** Global settings console featuring a horizontal tabbed navigation track.  
* **Header Stack:** Vertical text alignment presenting the primary console header directly above a muted context description.  
* **Tabs Navigation Rail:** Horizontal anchor routing bar displaying the optimized 3-tab layout. The "Social Channels" tab utilizes a prominent high-focus active highlight to anchor the viewport.

### **UI Copy**

* **Headline:** Settings  
* **Subline:** Manage your creator identity, secure shipping logistics, team workspace access, and linked social performance nodes.  
* **Tabs Navigation Label Elements:**  
  * \[ ⚙️ Profile & Workspace \]  
  * \[ 🧩 Social Channels \] (Active Tab Focus State)  
  * \[ 💰 Payouts & Tax \]

## **SECTION I: EXTERNAL CONTENT NETWORKS (Visible to All Users)**

This section hosts the discrete channel integrations, authorization loops, and live data telemetry syncs for the creator's target content distribution platforms.

### **Card 1: Meta Graph API Integration (Instagram Business/Creator)**

#### **Layout Structure**

* **Container Block:** Independent horizontal surface card with clean margin spacing below the main tab bar.  
* **Integration Channel Matrix:** A two-column interactive workspace row.  
  * **Left Column:** Unified branding lockup featuring the channel logo, core tracking scope labels, and historical synchronization metrics.  
  * **Right Column:** Dynamic state action triggers that cycle from connection buttons to credential renewal links based on active OAuth validation parameters.

#### **UI Copy**

* **Card Header:** Instagram Business Channel  
* **Card Description:** Link your Instagram Professional or Creator account via Meta OAuth to verify audience demographics, track content reach, and unlock brand campaign access.  
* **Connection Status Identifiers & Action Elements:**  
  * **State A: Disconnected Channel View**  
    * *Status Badge:* ⚪ Not Connected  
    * *Contextual Instruction Note:* Grant permission to pull impressions, reel metrics, and audience geography data.  
    * *Primary Interactive CTA Button:* \[ Link Instagram Account \] (Triggers Facebook/Meta OAuth Login Flow)  
  * **State B: Active Integration View**  
    * *Connected Handle Display:* @sarah\_jenkins\_creates  
    * *Status Badge:* 🟢 Syncing Live Data  
    * *Telemetry Baseline Metadata Row:* Last updated: Today at 14:22 UTC • Token Life Indicator: Verified Valid  
    * *Secondary Interactive Action Link:* \[ Disconnect Channel \]

### **Card 2: TikTok Creator Node Sync**

#### **Layout Structure**

* **Container Block:** Solid background surface layout component positioned directly beneath Card 1\.  
* **Integration Channel Matrix:** Mirroring the standardized two-column horizontal profile row layout for consistent scannability.

#### **UI Copy**

* **Card Header:** TikTok Creator Profile  
* **Card Description:** Authenticate your TikTok Creator account to automatically feed post performance, video views, and video engagement rates directly to active brand brief tracking systems.  
* **Connection Status Identifiers & Action Elements:**  
  * **State A: Disconnected Channel View**  
    * *Status Badge:* ⚪ Not Connected  
    * *Contextual Instruction Note:* Authorize data sharing via TikTok Login Kit to verify organic profile engagement trends.  
    * *Primary Interactive CTA Button:* \[ Link TikTok Account \]  
  * **State B: Active Integration View**  
    * *Connected Handle Display:* @sarah\_creates\_clips  
    * *Status Badge:* 🟢 Syncing Live Data  
    * *Telemetry Baseline Metadata Row:* Last updated: Yesterday at 08:05 UTC • Token Life Indicator: Verified Valid  
    * *Secondary Interactive Action Link:* \[ Disconnect Channel \]

### **Card 3: YouTube Google OAuth Configuration**

#### **Layout Structure**

* **Container Block:** Solid background surface layout component positioned directly beneath Card 2\.  
* **Integration Channel Matrix:** Standardized two-column row featuring advanced scope warnings due to specific Google API read permissions.

#### **UI Copy**

* **Card Header:** YouTube Channel Node  
* **Card Description:** Establish secure Read-Only infrastructure paths to your YouTube Content Studio. Enables tracking for video duration, long-form viewer retention, and YouTube Shorts monetization performance.  
* **Connection Status Identifiers & Action Elements:**  
  * **State A: Disconnected Channel View**  
    * *Status Badge:* ⚪ Not Connected  
    * *Contextual Instruction Note:* Connect your Google Workspace or YouTube brand channel account.  
    * *Primary Interactive CTA Button:* \[ Link YouTube Channel \]  
  * **State B: Active Integration View**  
    * *Connected Channel Display:* Sarah Jenkins Vlogs (UCxxXxx...xxX)  
    * *Status Badge:* 🟢 Syncing Live Data  
    * *Telemetry Baseline Metadata Row:* Last updated: June 12, 2026 at 19:10 UTC • Token Life Indicator: Verified Valid  
    * *Secondary Interactive Action Link:* \[ Disconnect Channel \]

## **SECTION II: FUTURE EXPANSIONS & DISCOVERY ENGINE (Future Product Roadmap)**

This section embeds upcoming communications integration modules using a grayscale mask layer to showcase future features while keeping the current interface clean.

### **Card 4: Platform Extended Integrations (Roadmap Track)**

#### **Layout Structure**

* **Section Divider Rule:** A full-width horizontal tracking line establishing a clear structural break between active social connection metrics and the forthcoming platform extensions.  
* **Container Block:** Embedded card housing upcoming integrations, styled with a strict grayscale filter layer and disabled interactions (opacity 0.45).

#### **UI Copy**

* **Section Header Callout:** Planned Platform Extensions  
* **Card Header:** Google Workspace & Gmail Pitch Sync (Forthcoming)  
* **Card Description:** Unlock direct inbound pitch monitoring. This feature safely parses brand partnership inquiries hitting your creator email inbox and organizes them into an automated workflow pipeline.  
* **Grayscale Status Indicator Badge:** 🔒 Future Platform Extension — Launch Target: Q4 2026  
* **Disabled Action Anchor:** \[ Integration Locked \]

## **3\. Comprehensive State Machine Matrix**

### **State 1: Baseline Disconnected State (Pristine Onboarding View)**

* **Layout Mechanics:** Channel rows show grey status badges and active connection indicators. No active performance data streams display.  
* **Action Status:** Main buttons initiate external popup authorization hooks.

### **State 2: Active Connection Lifecycle (OAuth Handshake Verification)**

* **Layout Mechanics:** Triggered during active external redirection loops. The selected channel container updates with an translucent mask layer containing a spinning progress element.  
* **Action Status:** Form interaction targets lock temporarily to prevent multi-click handshake failures.  
* **UI Copy Control Strings:**  
  * *Centering Overlay Process Status:* \[Icon: Processing Spinner\] Executing Secure OAuth Token Handshake Registry. Do not close this browser terminal window...

### **State 3: Broken Credential Warning State (Token Expired / Scope Revoked)**

* **Layout Mechanics:** Triggered if background token checks return a 401/403 API response, or if authentication expires. The channel container shifts to a high-contrast alert design (1px solid Warning Amber boundary).  
* **Action Status:** The main connection button updates to a high-priority action button to prompt immediate credential renewal.  
* **UI Copy Control Strings:**  
  * *Status Badge Display:* 🔴 Authentication Connection Broken  
  * *Critical Error Alert Description:* Warning: The secure API access token for this profile has expired or been revoked from your external app security portal. Brand brief indexing pipelines are paused.  
  * *Primary Interactive CTA Button:* \[ Re-Authenticate Connection Now \] (Launches immediate patch loop)  
  * *Inline Auxiliary Option:* \[ Remove Broken Connection Profile \]

### **State 4: Role-Based Access Restriction State (Assistant User View)**

* **Layout Mechanics:** Automatically applied if the logged-in user session carries the Assistant security role token.  
* **Action Status:** All primary connection CTA buttons and secondary disconnection links are converted to a disabled layout configuration state.  
* **UI Copy Tooltip Overlay:** 🔒 Read-Only Access Layer: Assistant profiles are restricted from altering external social API integrations or disconnecting active content platforms. Contact the account Owner to modify linked channels.

## **4\. System Modals & Drawer Overlays**

### **Modal A: Disconnect Channel Confirmation Guardrail**

* **Layout Mechanics:** Centered focus modal overlay that triggers when an Owner or Manager clicks \[ Disconnect Channel \] on any active integration card. This overlay temporarily freezes all underlying interactions to prevent accidental disruptions to ongoing data streams.

\+-------------------------------------------------------+  
|  MODAL: SEVER EXTERNAL DATA CONNECTION            \[X\] |  
|  Confirm social media channel removal.                |  
|                                                       |  
|  You are about to sever the secure API connection to  |  
|  the following profile resource node:                 |  
|  Target Handle: @sarah\_jenkins\_creates (Instagram)     |  
|                                                       |  
|  \+-------------------------------------------------+  |  
|  | \> Impact Warning: Removing this connection will |  |  
|  | hide your live view metrics, clear ongoing      |  |  
|  | campaign reporting tracking records, and halt   |  |  
|  | active brand payments requiring metric verification.|  |  
|  \+-------------------------------------------------+  |  
|                                                       |  
|  \[ Cancel and Keep Connected \]   \[ Confirm Disconnect \]|  
\+-------------------------------------------------------+

#### **UI Copy**

* **Modal Title Alert:** ⚠️ Sever Secure External Data Connection?  
* **Critical Safety Micro-Copy Message:** "You are about to remove the authorized API token connection for this channel handler. The platform will immediately stop pulling engagement metrics, viewership metrics, and audience demographics."  
* **Dynamic Information Warning Card:** \> Impact Warning: Removing this connection will hide your live view metrics, clear ongoing campaign reporting tracking records, and halt active brand payments requiring metric verification.  
* **Action Footer Row Controls:**  
  * *Right-Aligned Confirmation Element:* \[ Confirm Disconnect \] (High-visibility destructive red text fill)  
  * *Left-Aligned Dismissal Element:* \[ Cancel and Keep Connected \]

## **5\. Mobile Adaptability Compact Layer Rules**

* **Viewport Threshold:** Evaluated on all mobile screen configurations $\\le$ 768px.  
* **Layout Conversions:**  
  * The 3-tab sub-navigation layout shifts into a swipeable horizontal selector track.  
  * Social integration cards drop their two-column layout grid. Brand icon assets, account handles, and system performance metadata stack into a single vertical sequence.  
  * Primary connection CTA buttons stretch to match full-width container parameters, adjusting to a **48px minimum height profile** to optimize for mobile touch targets.  
  * Status badges shift position, stacking neatly below the main channel name headers to optimize narrow mobile screen spaces.

