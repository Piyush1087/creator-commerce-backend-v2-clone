This update establishes the edge-case resolution architecture and technical data processing workflows for duplicate assets, along with the pure developer specification document for **The Creator Shop** onboarding pipeline.

## **🛑 EDGE-CASE LOGIC SYSTEMS (DUPLICATE ARCHITECTURE)**

### **1\. Pre-Signup Handle Already Exists as an Active User**

* **The Scenario:** A visitor enters @username on the landing page, but that handle is already claimed, verified, and mapped to an active account in the database.  
* **The Resolution Protocol:** To prevent account probing, enumeration attacks, or revealing whether a specific creator uses the platform, the backend must **not** throw an explicit error like *"This handle is taken."* Instead, it seamlessly routes the user through the standard "Approved" flow but attaches a distinct cryptographic routing flag to the session metadata.  
* **The Interception Hook:** The user progresses through the checkboxes and email provisioning as normal. The system allows them to complete email OTP verification. However, when they reach the **Meta OAuth Handshake** step, the platform explicitly cross-references the incoming authenticated Meta asset IDs.  
  * If they *cannot* prove ownership via OAuth, they cannot access the existing account data.  
  * If they *do* successfully authenticate the matching Meta asset, the system recognizes them as the rightful owner who likely forgot their login method. The system then merges or prompts a secure recovery loop to transition them into the existing workspace dashboard.

### **2\. Instagram Graph API Connected Asset Already Exists**

* **The Scenario:** A user completes Meta authentication, but the unique Instagram Business Account ID (instagram\_business\_account.id) passed back by the Graph API is already linked to a different, active user account in your database. **This must be strictly blocked** to prevent duplicate data mapping or multi-account exploitation.  
* **The Prevention Protocol:** 1\. The moment the OAuth token is returned, the backend immediately checks the unique Meta/Instagram internal platform ID against the database.  
* 2\. If a match is found, the backend short-circuits the onboarding loop immediately, drops the active session database transaction, and revokes the transient access token.  
* 3\. The interface shifts straight to the **Error Resolution Wizard (Fork B)**, stating that the specific professional profile is already tied to an active database entity, advising them to log in using their primary credentials or initiate an asset transfer request via support.

### **🔑 AUTHENTICATION DIRECTIVE: INSTAGRAM GRAPH API NATIVE LOGIN**

Following your configuration rules, **the platform bypasses full Facebook Login for Business scopes**.  
Instead, it implements the **Instagram Login Button** (using the *Instagram Graph API* product configuration in the Meta Developer Console). This approach prompts the creator with an intuitive, Instagram-branded authorization window that grants permissions strictly for professional account access (instagram\_graph\_user\_profile, instagram\_graph\_user\_media) while completely avoiding any references to a Facebook timeline or personal page during login.

# **📝 TECHNICAL DEVELOPMENT SPECIFICATION DOCUMENT**

## **🛰️ SYSTEM ARCHITECTURE & DATA FLOW**

\[Client Handle Submission\] ──► \[IP Rate Check Engine\] ──► \[Parallel AI / Gemini Ingestion\]  
                                                                     │  
                                                                     ▼  
\[Meta OAuth Response\] ◄── \[Email / OAuth Credentials\] ◄── \[Checklist Module Staging\]  
         │  
         ├───► (If Instagram ID exists) ──► \[STRICT SYSTEM BLOCK / ERROR\]  
         └───► (If Instagram ID unique) ──► \[Intentional Gateway\] ──► \[AI Deep Scan\]

## **⚡ ARCHITECTURAL SPECIFICATION BY STEP**

### **STEP 1: LANDING PAGE INPUT & NATIVE AI ROUTING MATRIX**

#### **A. Rate Limiter Tracking Engine**

* **Execution Boundary:** Max **5 validation checks per unique IP string**.  
* **Controller Flow:**  
  1. Read client IP from request contexts (x-forwarded-for parser cascade).  
  2. Query tracking cache table. If validation\_count \>= 5, abort processing immediately and return an HTTP 429 status code.  
  3. If below the cap, increment count, timestamp the record, and authorize the downstream AI query stream.

#### **B. Native AI Scoring Query Payloads**

The payload passes through **Parallel AI** or **Gemini 1.5 Flash** endpoints via structural JSON mode setups.

* **Gemini 1.5 Flash API Implementation Parameters:**  
  * **Configuration Mode:** responseMimeType: "application/json"  
  * **Target System Prompt Text:**  
  * Plaintext

You are an unauthenticated public social media analysis engine. Your task is to evaluate the validity and potential commercial tier of the input Instagram handle.

Input Handle: @{{instagramHandle}}

Perform structural semantic analysis on the input. Return a raw JSON object conforming strictly to this format:  
{  
  "is\_approved": boolean,      // True if handle represents a valid creator/business entity structure, False if personal/spam/empty.  
  "eligibility\_score": number, // An integer between 0 and 100 assessing baseline content capability.  
  "percentile\_rank": number,   // A decimal value indicating positioning tier (e.g., 94.50).  
  "detected\_vertical": string  // Must map strictly to one: 'D2C', 'SAAS\_AI', 'HEALTHCARE', 'MEDIA', 'ENTERTAINMENT', 'UNKNOWN'  
}  
Do not output markdown syntax tags, trailing explanations, or wrapped code blocks.

*   
  *   
* **Parallel AI Routing Protocol Configuration:**  
  * **Parameters:** temperature: 0.1, max\_tokens: 150.  
  * **Target System Prompt Text:**  
  * Plaintext

Analyze the unauthenticated Instagram profile handle string provided below to classify business vertical alignment and operational tiering.

Handle Core Target: @{{instagramHandle}}

Output ONLY a minified valid JSON response structure matching these fields:  
{"is\_approved": boolean, "eligibility\_score": number, "percentile\_rank": number, "detected\_vertical": "D2C" | "SAAS\_AI" | "HEALTHCARE" | "MEDIA" | "ENTERTAINMENT" | "UNKNOWN"}

*   
  * 

### **STEP 2: PRE-SIGNUP PRE-SELECTION MODULE STAGING**

* **Technical Behavior:** Captures the choices from the multi-select interface as an active string array.  
* **Process Flow:** The selections map directly onto a transient storage row linked to the onboarding session ID (creator\_onboarding\_tracks), holding the choices in cache memory until account validation occurs.

### **STEP 3: ACCOUNT MIGRATION & SECURITY CREDENTIALING**

* **Data Flexibility Rules:** The email endpoint input logic verifies only general email string composition. It accepts both personal domains (Gmail, iCloud) and corporate domains equally.  
* **OTP Cryptographic Sequence Lifecycle:**  
  1. Upon submission of account details, generate a random 6-digit numeric token string.  
  2. Hash the code string natively using a SHA-256 digest structure before writing to the validation database table.  
  3. Dispatch the raw, plain-text token code to the user via your transactional email provider.  
  4. Set an active lifespan constraint (expires\_at) of exactly 15 minutes.  
  5. Enforce an account lockout block if verification attempts exceed a threshold of 5 failures within that single session lifecycle.

### **STEP 4: INSTAGRAM GRAPH API CONNECTION HANDSHAKE**

#### **A. OAuth Handshake URL Schema**

The frontend initiates the connection using the native Instagram Graph API OAuth interface window:  
Plaintext  
https://api.instagram.com/oauth/authorize  
  ?client\_id={{INSTAGRAM\_APP\_ID}}  
  \&redirect\_uri={{SECURE\_CALLBACK\_URL}}  
  \&scope=instagram\_graph\_user\_profile,instagram\_graph\_user\_media  
  \&response\_type=code

#### **B. Server-Side Exchange Chain**

1. **Short-Lived Token Retreival:** The callback listener receives an authorization code string parameter from the redirect URI query string.  
2. **Short-to-Long Token Promotion Endpoint:** Send a backend GET request to exchange it for a long-lived access token valid for 60 days:  
3. Plaintext

GET https://graph.instagram.com/access\_token  
  ?grant\_type=ig\_exchange\_token  
  \&client\_secret={{INSTAGRAM\_APP\_SECRET}}  
  \&access\_token={{SHORT\_LIVED\_TOKEN}}

4.   
5.   
6. **Core Profile Metric Query Ingestion Engine:** Call the user node using the validated long-lived access token to ingest target business credentials:  
7. Plaintext

GET https://graph.instagram.com/v20.0/me  
  ?fields=id,username,account\_type,media\_count,followers\_count  
  \&access\_token={{LONG\_LIVED\_TOKEN}}

8.   
9. 

#### **C. Validation and Error Isolation Triggers**

* **Personal Profile Interception Rule:** If the query returns account\_type: "PERSONAL", the system blocks data ingestion. It halts the database transaction and routes the client session to the Step 4 Error Troubleshooting flow.  
* **Duplicate Identity Structural Block Rule:** Query the user table using the retrieved unique internal profile id. If that id matches an existing active account row, **abort the transaction**, reject the authorization string, and throw an explicit duplicate error state to protect data ownership boundaries.

### **STEP 5: INTENTIONAL COMPLETION & BACKGROUND SCAN TRIGGER**

* **Execution Barrier:** The pipeline deliberately stops processing here. It caches the long-lived access token values but holds off on running heavy data-scraping jobs.  
* **The Process Trigger:** The data loop initializes only after receiving a explicit POST command from the client's confirmation action.  
* **The Background Data Ingestion Sequence:** Once triggered, the backend spins up an asynchronous processing worker (via queue architectures like BullMQ or serverless background tasks) to execute the deep data sync:  
  1. Fetch historical media nodes (the last 30 posts/Reels) via the Instagram Graph API.  
  2. Ingest audience demographic profiles, location metrics, and engagement statistics.  
  3. Populate the user’s private database tables to build their live Media Kit template and train their conversational AI metrics analyst.

