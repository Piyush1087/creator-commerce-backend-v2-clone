### **Step 10: Operational Razorpay Setup & Subscription Configuration Runbook**

This runbook defines the exact configuration parameters, dashboard mutations, and webhook routing vectors required to activate the multi-currency pricing plans detailed in the product matrix. Since Razorpay treats currencies as isolated primitives, you must configure individual plan handles for each geographical zone to support the 30-day free trial footprint.

### **1\. Plan Definition & Currency Mapping Schema**

You must provision separate plans within your **Razorpay Live Dashboard** (Subscriptions \-\> Plans \-\> Create Plan). Use the following structural parameters to match the system's high-precision calculation layers:  
Track A: Founder’s Beta Plan (The "Hero" Tier)

* **Billing Frequency**: Monthly (1 Month)  
* **Trial Period Config**: Defer billing by exactly 30 Days using the start\_at Unix timestamp parameter in your API initialization script to enforce the **No Credit Card Required** workflow.  
* **Geographic Plan IDs**:  
  * **India Node (INR)**:  
    * *Amount*: ₹8,500.00 (Calculated using structural spot conversion parity for the targeted $99 valuation)  
    * *Dashboard Token Prefix*: plan\_inr\_founders\_9900  
  * **United States & Rest of World Nodes (USD)**:  
    * *Amount*: $99.00  
    * *Dashboard Token Prefix*: plan\_usd\_founders\_99

Track B: Professional Plan

* **Billing Frequency**: Monthly (1 Month)  
* **Trial Period Config**: 0 Days (Immediate capture upon checkout transition)  
* **Geographic Plan IDs**:  
  * **India Node (INR)**:  
    * *Amount*: ₹34,000.00 (₹ equivalent of the $399 core tier benchmark)  
    * *Dashboard Token Prefix*: plan\_inr\_pro\_39900  
  * **United States & Rest of World Nodes (USD)**:  
    * *Amount*: $399.00  
    * *Dashboard Token Prefix*: plan\_usd\_pro\_399

### **2\. State-Preserving Webhook Orchestration**

To maintain a zero-leakage entitlement pipeline, navigate to **Account & Settings** \-\> **Webhooks** in Razorpay and ensure the following events route directly to your unified ingestion endpoint (https://api.yourdomain.com/api/v1/webhooks/subscription).  
Every payload parsing event must trigger a transactional write state inside the database layer:  
                 ┌────────────────────────────────────────┐  
                  │      Razorpay Inbound Webhook          │  
                  └───────────────────┬────────────────────┘  
                                      │  
           ┌──────────────────────────┼──────────────────────────┐  
           ▼                          ▼                          ▼  
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐  
│ subscription.auth  │     │ subscription.charg │     │ subscription.updt  │  
└──────────┬─────────┘     └──────────┬─────────┘     └──────────┬─────────┘  
           │                          │                          │  
           ▼                          ▼                          ▼  
 ┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐  
 │ Transition state │       │ Reset feature    │       │ Recalculate caps │  
 │ TRIAL \-\> ACTIVE  │       │ usage counters   │       │ on tier changes  │  
 └──────────────────┘       └──────────────────┘       └──────────────────┘

* subscription.authenticated  
  * *System Event Handler Action*: Fired when the brand links a verified payment mode at the conclusion of their 30-day preview window. Instantly transition subscription\_status\_enum from TRIALING to ACTIVE.  
* subscription.charged  
  * *System Event Handler Action*: Confirms recurring ledger captured funds successfully. Your worker service must intercept this array, generate a new row inside escrow\_transaction\_ledger, and reset all cyclic keys inside feature\_usages to 0.  
* subscription.updated  
  * *System Event Handler Action*: Triggered automatically by user-initiated tier modifications (Upgrades/Downgrades). The payload containing the modified plan\_id must immediately force an internal configuration reload to adjust active capacity ceilings (e.g., shifting outreach parameters from 100 to 500 lines).  
* subscription.cancelled  
  * *System Event Handler Action*: Terminates feature engine processing routes. Sets active subscription status flags strictly to CANCELED.

### **3\. Subscription Management Processing Logic**

When handling client mutations through your backend controller architecture, execute the following operational pipelines to ensure data consistency across database boundaries:

#### **Pipeline 1: The "No-Card" Trial Instantiation**

Because the Founder's Beta requires zero payment friction upfront , your application must delay Razorpay subscription creation until the user approaches day 25 of their preview.

1. Bootstrap the local workspace database entity with status TRIALING.  
2. Seed the feature\_usages parameters with the explicit baseline constants allocated for the Beta group: Max 3 rivals , 1 deep scan monthly , 5 products , 3 collections , 3 locations , and 100 managed outreaches.  
3. Fire a scheduled notification job precisely 5 days prior to expiration to collect automated card authorizations.

#### **Pipeline 2: Upgrade / Downgrade Pro-Rata Flow**

1. When a user requests a tier change, dispatch a PATCH command directly to the Razorpay Subscription entity endpoint: /v1/subscriptions/{id}.  
2. Provide the new target plan\_id and pass schedule\_change\_at: "now".  
3. Razorpay evaluates the remaining fractional credit from the brand's prior tier, computes a pro-rata invoice differentiation value, and charges the difference on the ledger line automatically.  
4. On webhook receipt, clear out out-of-bounds inventory assets if down-regulated (e.g., locking access to items 6 through 20 if dropping from Professional back down to Founder's tracking parameters).

#### **Pipeline 3: Structural Cancellation Boundary Handling**

1. Execute immediate cancellation states or flag for cycle end termination (cancel\_at\_cycle\_end: 1).  
2. If processing an absolute cancellation command, preserve structural historical generation assets (AI-generated Brand DNA and Creative Brief layouts).  
3. Freeze outbound campaign operational routes, block new product or location entity indexing, and redirect active sessions straight to the billing configuration dashboard.

