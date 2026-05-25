### **Change Requirement Document: Landing Page "Early-Gate" & Resource Optimization (v2.1)**

#### **1\. Functional Objective**

To evolve the Landing Page interaction from a basic availability check into a multi-tiered security and resource-optimization gate. This update intercepts unauthorized scans, prevents redundant AI data processing for existing or high-frequency domains, and provides clear organizational paths for verified brand owners.

#### **2\. Comprehensive Use Case Matrix**

| Scenario | Trigger / Detection | Strategic Logic | UI Response (Aurora Design System) |
| :---- | :---- | :---- | :---- |
| **Verified Brand Account** | is\_verified: true in BrandProfile table. | Prevent unauthorized "Surface Scans" and redundant deep analysis on established accounts. | **Headline:** "This brand is already active". **Subline:** "An account for \[domain\] already exists...". **Visuals:** Ruby Red text on Light Pink background. |
| **Recent Unverified Scan** | is\_verified: false AND age \< 7 days. | Reuse cached surface scan data to save processing costs and reduce user wait time. | **Headline:** "Resume your scan." **Subline:** "We found a recent scan for \[domain\]..." **Action:** Skip animation and redirect to results page. |
| **Domain-Level Limit** | count(scans) \> 5 for a single domain in 7 days. | Protect high-interest domains from malicious or redundant scraping cycles. | **Gate:** "This brand has been analyzed multiple times recently. Please verify your email to access results." |
| **IP-Based Limit** | count(scans) \> 5 from a single IP address in 7 days. | Mitigate automated "Surface Scans" and bulk-checking from a single source. | **Gate:** Both Surface and Deep scans are hard-blocked until email verification is completed. |

#### **3\. Data Integrity & Privacy Policy**

* **Modification Discard:** Any manual changes made to AI results by unverified users are considered transient. If signup is not completed, these modifications must be deleted within a set time-frame to prevent database pollution.  
* **Open Visibility for Unverified:** To facilitate conversion, surface scan results for unverified brands remain visible. Users returning within 7 days will see the original, unmodified AI results.  
* **Data Leakage Prevention:** The API must strictly return only status booleans to unauthenticated users. It must never leak verified brand details, logos, or user emails.  
* **Organizational Access:** Verified accounts must provide clear pathways for "Requesting Access" (internal team members) or "Claiming Ownership" (dispute resolution).

#### **4\. Technical Implementation & Design Fidelity**

* **Skeleton State:** The "Start Scan" button must show a **Skeleton Loader** for \~300ms during the check to maintain a premium "Aurora" feel without sacrificing perceived speed.  
* **Subdomain Logic:** The system must normalize URLs (e.g., www.evara.in and evara.in) to the root domain to prevent bypasses.  
* **Typography:** All error messages, sublines, and instructions must maintain a minimum **14px floor** to preserve legibility and design depth.

### **Developer Documentation: Multi-Tiered Brand Check (v2.1)**

This developer documentation outlines the expanded logic for the **Existing Brand Check** and **Resource Optimization Gate** to be implemented at the Landing Page touchpoint. It builds upon previous versions to handle unverified sessions, volume thresholds, and organizational access.

---

#### **1\. Functional Objective**

To prevent unauthorized "Surface Scans" and optimize AI resource consumption by intercepting requests based on domain verification status, scan frequency, and source IP activity.

#### **2\. Logic Flow & Interaction**

The check occurs immediately after the user clicks "Start Scan" on the Landing Page.

| Step | Component | Action |
| :---- | :---- | :---- |
| 1 | Frontend | Captures URL and extracts hostname (e.g., evara.in). |
| 2 | API Call | Triggers GET /api/v1/brands/check-availability?domain=evara.in. |
| 3 | Backend | **Multi-tier Query:**  1\. Check BrandProfile for domain AND is\_verified: true. 2\. Check BrandProfile for domain AND is\_verified: false (within last 7 days). 3\. Check total scan count for domain in last 7 days. 4\. Check total scan count for requester IP in last 7 days. |
| 4 | Response | Returns status code based on highest priority match (Conflict, Threshold, or Available). |
| 5 | Frontend | Renders the corresponding UI state or proceeds to scan. |

---

#### **3\. UI Implementation & Copy Matrix**

In the event of a hit, the Landing Page input must transform according to the **Aurora Design System**.

* **Scenario 1: Verified Brand Account**  
  * **Error Headline:** This brand is already active  
  * **Error Subline:** An account for evara.in already exists. If you are the owner, please log in.  
  * **Primary CTA:** Login to evara.in →  
  * **Secondary Actions:** Request Access to Admin | Claim Ownership (Support Ticket).  
* **Scenario 2: Recent Unverified Scan (Resume State)**  
  * **Error Headline:** Resume your scan  
  * **Error Subline:** We found a recent scan for evara.in. Your results are ready to view.  
  * **Action:** Redirect directly to Results Page; skip all scan animations.  
* **Scenario 3: Domain or IP Threshold Hit**  
  * **Gate Headline:** Verification required  
  * **Gate Subline:** This brand has been analyzed multiple times recently. Please verify your email to access the latest results.  
  * **Requirement:** Verify email before Surface or Deep scan execution.

**Visuals (Aurora Tokens):**

* **Input Background:** Light Pink (\#FFF6F6).  
* **Text/Icon Color:** Ruby Red (\#CA0F1C).  
* **Typography:** Exactly **14px** floor for all subline and error text.

---

#### **4\. Technical Guardrails**

* **A. "Early-Gate" Performance**  
  * **Skeleton State:** The "Start Scan" button must show a **Skeleton Loader** during the availability check (\~300ms) to maintain the premium feel.  
  * **Non-Destructive:** This check must remain a **"Read-Only"** operation. Do not initialize a new record until availability is confirmed.  
* **B. Security & Privacy**  
  * **Data Leakage Prevention:** The API must only return status booleans (exists: true/false). It **must not** return brand details (logos, names, user emails) to unauthenticated users.  
  * **Unverified Modification Cleanup:** Manual changes made by unverified users must be discarded **X minutes** after the session ends if signup is not completed.  
* **C. Edge Cases**  
  * **Rate Limiting:** Implement a Redis-based rate limiter to track IP-to-scan counts (Threshold \= 5 per 7 days).  
  * **Subdomain Logic:** Normalize www.evara.in and evara.in to the same root domain to prevent bypasses.

---

#### **5\. Definition of Done for v2.1**

* \[ \] API check-availability updated in NestJS to handle verification, domain counts, and IP limits.  
* \[ \] Frontend interceptor updated to handle "Resume," "Login," and "Verify Email" states.  
* \[ \] UI states mapped 1:1 to **Aurora Design System** tokens (Ruby Red/Light Pink/14px).  
* \[ \] Automated task implemented to discard unverified manual modifications.  
* \[ \] Unit tests covering all four matrix scenarios (Verified, Resume, Domain-Limit, IP-Limit).  
  * 

### 

