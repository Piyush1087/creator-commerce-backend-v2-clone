# Change document (read me)

Document Structure-

| Tab name | description | Actionable |
| :---- | :---- | :---- |
| use cases and edge cases | This document qualitatively captures all the possible use cases of url input box | No action needed |
| UI copy | This document captures the UI copy of the landing page | No action needed |
| URL input listening states | This document was updated to handle all possible UI states as per the use cases.  | Corresponding new stitch UI states have been created. Respective code snippet to handle the particular use case needs to be imported |
| stitch import | This document lists all the changes that need to be done related to stitch UI imports. This document captures fine details if adjustments which were either lost in import, or new refinements needed | Incorporate this as first step, before moving to backend |
| AI prompt | This document carries updated prompt for Gemini, which will make the output more reliable. Also it will handle all the possible states of url input box | Replace the existing prompt in backend with this new prompt |
| Updated zod | This file carries the zod validation ‘exclusively’ for landing page.Earlier we had setup a single zod for Step 1-5, which had suppressed/ removed a lot of impotant validations | Add this file in backend for Step 1 (When separate zods are setup for all the steps, we will remove the consolidated zod we setup for step 1-5) |
| PostGRESQL changes | This is additional backend schema which needs to be added to our current schema (as documented in Brian’s drive link) | Incorporate this update |
| Developer document | This document is a step-by-step guide for implementing the change doc | Consult this for any confusion around the various tabs |

# use cases and edge cases

# **Product Logic Document: Brand Onboarding Step 1 Journey**

This document serves as the single source of truth for the logical behavior, validation gates, and routing rules governing Step 1 of the Brand Onboarding journey. This logic integrates the baseline step instructions and the resource optimization guidelines, with structural priority governed by the system designs found in the files image\_db9da0.jpg, image\_db9dc0.jpg, image\_dba069.jpg, image\_dba089.jpg, and image\_dba0a9.jpg.  
Visual components and token names used throughout this logic follow the specifications outlined in the AURORA DESIGN SYSTEM v4.1.txt.

## **1\. System Architecture Execution Order**

To balance server resource consumption with user experience, the system evaluates all submissions using a two-tier execution pipeline. Heavy background AI operations are protected by an immediate, low-latency infrastructure gate.

### **Phase 0: The 300ms Skeleton Gate**

The moment a user submits a URL, the system displays an animated shimmer container matching the exact layout dimensions of the input component (as shown in image\_db9da0.jpg and image\_db9dc0.jpg). Within 300 milliseconds, the system runs an availability check against the backend database and caching layers before activating any external third-party tools, security scrapers, or language model classifiers.

### **Phase 1: Tri-Layer Validation & Crawling Pipeline**

If Phase 0 passes without flagging a rate limit, duplicate scan, blocklist match, or account conflict, the system advances to Phase 1\. This phase runs syntax normalizations, network connection stability tests, security audits, and automated AI industry classification in sequence.

## **2\. Core Use Cases & Expected Logical Behavior**

### **Use Case 1: Standard Brand Scan (The Happy Path)**

* **Trigger Condition:** The user submits a valid URL that has no active platform ownership conflicts, has not exceeded any rolling security thresholds, is not on a structural blocklist, and falls directly into a supported industry.  
* **System Flow & Logic:**  
  1. The system confirms the domain is clean during the Phase 0 skeleton check.  
  2. The pipeline runs the full real-time surface crawl and activates the AI industry classifier.  
  3. The system maps the domain to a supported sector: D2C, SaaS\_AI, Healthcare, or Offline\_Services.  
* **Downstream Action:** The system completes the scanning cycle successfully (matching the layout state in image\_dba069.jpg) and instantly redirects the user to the active strategy builder and results dashboard.

### **Use Case 2: Frequency & Rate-Limiting Intercept Gate**

* **Trigger Condition:** A single root domain name OR a single user IP address initiates more than 5 scans within a rolling 7-day window.  
* **System Flow & Logic:**  
  1. During the Phase 0 check, the system identifies that the 7-day rolling frequency count for that domain string or IP address is greater than 5\.  
  2. The system halts the crawling and AI categorization engines immediately to prevent resource drain.  
  3. The text input box remains interactive so the user can fix typos, but its container state changes visually using the warning parameters from the AURORA DESIGN SYSTEM v4.1.txt (switching to a Light Pink \#FFF6F6 background and Ruby Red \#CA0F1C text).  
  4. The primary scanning button changes its core function entirely, transforming into a domain verification trigger.  
* **Downstream Action:** The system blocks further automated scanning. The user cannot access real-time brand reports or deeper analysis until they successfully complete a corporate email verification process that matches the specific domain namespace.

### **Use Case 3: Duplicate Domain Entry (Cached Recovery)**

* **Trigger Condition:** A user enters a domain name that was scanned within the last 7 days, and that brand domain is currently unverified (is\_verified: false).  
* **System Flow & Logic:**  
  1. The Phase 0 check identifies a matching, unexpired domain signature in the historic log database.  
  2. The system stops any new live scraping, crawling, or AI classification steps.  
  3. The application skips all live scanning timelines and background processing animations entirely.  
* **Downstream Action:** The system retrieves the saved data models from the previous scan and loads them instantly. The user is redirected straight to the existing results dashboard without experiencing processing wait times or showing a system error.

### **Use Case 4: Live Connection & Infrastructure Failures**

* **Trigger Condition:** The entered URL encounters network-level or server-side connection issues during the initial crawling attempt. This covers client-side errors (4XX responses), server-side crashes (5XX responses), missing public DNS records, connection timeouts, or redirect loops where the domain maps to an entirely separate base domain.  
* **System Flow & Logic:**  
  1. The Phase 1 crawler attempts to reach the domain but receives a terminal failure signal or hits a strict timeout ceiling.  
  2. For domain-hijack redirects, the system checks if the landing page domain matches the input domain name; if it routes to a completely different corporate entity, it flags a redirect exception.  
  3. The system stops the onboarding pipeline and marks the input field with the status-error token (\#CA0F1C) from the AURORA DESIGN SYSTEM v4.1.txt.  
* **Downstream Action:** The primary action button converts into a retry component. The user must correct the address or wait for their hosting server to recover before they can re-initiate the brand analysis.

### **Use Case 5: Strategic Domain Blocklist Enforcement**

* **Trigger Condition:** The user inputs a URL that matches specific structural, policy, or security exclusions. This includes government websites (.gov), military platforms (.mil), social networking platforms, corporate internal communication spaces, malware/phishing tracking databases, or adult content networks.  
* **System Flow & Logic:**  
  1. The system matches the domain string or top-level extension against the platform's hard exclusion list during Phase 0\.  
  2. The system classifies the link as a structural policy threat rather than a standard operational mismatch.  
  3. The text field locks completely and displays the disabled background styling (\#F3F4F6) specified in the AURORA DESIGN SYSTEM v4.1.txt.  
* **Downstream Action:** The system hard-blocks the entry. Unlike standard unsupported businesses, these restricted domains are barred from entering secondary email waitlists, lead-generation capture paths, or account creation workflows.

### **Use Case 6: Industry & Sub-Industry Evaluation (The Regret Flow)**

* **Trigger Condition:** The target website is live and secure, but the AI classification engine determines its business model falls outside the four supported core industries (D2C, SaaS\_AI, Healthcare, Offline\_Services).  
* **System Flow & Logic:**  
  1. The Phase 1 AI classifier reviews the scraped text metadata and layout signals of the landing page.  
  2. The system confirms the business does not fit into a supported bucket, but it does not abandon the classification process. It uses an AI categorization prompt to isolate the main industry and identify the mid-level sub-industry (e.g., detecting Real Estate as the sub-industry).  
  3. The primary layout transforms into a rejection and waitlist collection state (matching the flow layout in image\_dba089.jpg).  
* **Downstream Action:** The primary scanning button changes into an industry-specific notification trigger. The system surfaces a secondary inline input container to collect the user's business email, dropping the enrichment profile directly into the platform's segmented waitlist database for future expansion.

### **Use Case 7: Active Domain & Claimed Account Shield**

* **Trigger Condition:** A user attempts to scan a domain name that is already fully active on the platform and verified by an existing account (is\_verified: true).  
* **System Flow & Logic:**  
  1. The Phase 0 logic identifies an ownership record match in the database, triggering a strict data privacy mask.  
  2. To prevent corporate espionage and data leakage, the system blocks the transmission of all brand assets, customized logotypes, or configuration summaries to unauthenticated web requests.  
  3. The system hides the identity of the current account owner completely and does not show partial email addresses or sneak-peeks.  
* **Downstream Action:** The input field transforms into a workspace conflict screen. The system blocks fresh scanning capabilities and alters the primary button to route into an access request form, allowing the user to request an invitation from the workspace administrator via an email that matches that domain namespace.

### **Use Case 8: Base Formatting & Structure Errors**

* **Trigger Condition:** The user submits text that fails basic structural validation, such as entering non-URL text strings, empty forms, or completely malformed inputs.  
* **System Flow & Logic:**  
  1. The frontend or backend validation layers catch the syntax error before any network resources are used.  
  2. The input field undergoes a structural shake animation and displays a 1px border matching the status-error hue (\#CA0F1C) from the AURORA DESIGN SYSTEM v4.1.txt (as modeled in image\_dba0a9.jpg).  
* **Downstream Action:** The pipeline pauses. The text box remains interactive and open, requiring the user to manually edit the typos before the system allows them to re-submit the form.

# UI copy

---

## **Navigation Header**

### **Primary Navigation**

\[Logo\] | How it Works | Features | Pricing | \[Login\] \[Start Your Free Scan →\]

### **Micro-copy (Below CTA)**

**Before:** "No credit card required for scan"  
 **After:** "No credit card. No commitment. Just insights to help you grow."

**Why it works:**

* Removes transactional language  
* Adds "help you grow" (partnership mindset)  
* "Just insights" \= low-pressure, value-first

### **Secondary CTA**

**Before:** "Are you Creator?"  
 **After:** "Creator? We'd love to work together →"

**Why it works:**

* Warm invitation vs. segmentation question  
* "We'd love" \= genuine enthusiasm  
* Positions platform as connector, not gatekeeper

---

## **Hero Section**

### **Main Headline (H1)**

**Before:** "Find Perfect Creators for Your Brand in Minutes"  
 **After:** "Meet the Creators Who'll Love Your Brand as Much as You Do"

**Why it works:**

* Emotional connection ("love your brand")  
* Human-centric ("meet" vs. "find")  
* Implies mutual fit, not one-way transaction  
* Removes time pressure (trust-building over urgency)

**Alternative A (More Direct):**  
 "Find Your Brand's Creative Partners in Minutes, Not Months"

* Balances warmth with efficiency promise  
* "Partners" \= collaborative relationship

**Alternative B (Problem-Aware):**  
 "You Build Amazing Things. Let's Find the Voices Who Get It."

* Validates the brand's work first  
* "Get it" \= cultural/values alignment  
* Conversational, understanding tone

---

### **Sub-headline (H2)**

**Before:** "Our AI scans your brand's DNA, builds your strategy, and connects with high-fit influencers in a few clicks."

**After:** "We learn what makes your brand special, match you with creators who share your values, and help you build relationships that actually move the needle."

**Why it works:**

* "Learn what makes you special" \= personalized attention  
* "Share your values" \= alignment over metrics  
* "Help you build relationships" \= partnership, not automation  
* "Actually move the needle" \= acknowledges past frustrations

**Alternative (More Tangible):**  
 "Share your website. We'll analyze your brand, find creators your customers already trust, and introduce you—the right way."

* "Your customers already trust" \= social proof built-in  
* "Introduce you—the right way" \= relationship facilitation

---

### **Interactive URL Input**

#### **Field Placeholder**

**Before:** "https://yourbrand.com"  
 **After:** "Your website URL (we'll take it from here)"

**Why it works:**

* Friendly instruction  
* "We'll take it from here" \= burden relief  
* Partnership language

#### **Loading State**

**Before:** \[Pulse animation\]  
 **After:** \[Pulse animation\] \+ "Getting to know your brand..."

**Why it works:**

* Humanizes AI process  
* Sets expectation of personalized analysis

#### **Success State**

**Before:** "✓ Verified"  
 **After:** "✓ Got it\! Analyzing your brand DNA..."

**Why it works:**

* Conversational acknowledgment  
* Preview of value being delivered

---

### **Primary CTA Button**

**Before:** "Launch My Campaign"  
 **After:** "Start My Free Brand Scan"

**Why it works:**

* "Free Brand Scan" \= clear, low-commitment value  
* Removes campaign pressure (may not be ready yet)  
* Educational positioning

**Alternative A:** "See Who's Right for Us"

* Collaborative "us"  
* Discovery mindset

**Alternative B:** "Show Me My Matches"

* Personalized promise  
* Implies curation already happening

---

### **Value Prop Badges (Below Button)**

**Before:**  
 ✓ 30 Day Free Trial | ✓ No Credit Card Required | ⭐ Official Meta API Partner

**After:**  
 ✨ Try free for 30 days | 💳 No credit card needed | 🤝 Meta's trusted partner

**Why it works:**

* Emoji icons \= approachable, less corporate  
* "Try" vs. "Trial" \= softer language  
* "Needed" vs. "Required" \= less legal/formal  
* "Trusted partner" vs. "Official" \= relationship over certification

**Alternative (More Benefit-Focused):**  
 🎁 30 days to explore, zero risk | 🔒 Your data stays yours | ✓ Meta-verified & secure

---

## **Immediate Proof Section**

### **Section Headline**

**Before:** \[No headline\]  
 **After:** "Here's How We Make Influencer Marketing Feel Easy"

**Why it works:**

* "Feel easy" acknowledges current difficulty  
* "We make" \= active partnership role  
* Sets up benefit-focused tabs

**Alternative:** "Three Ways We Take the Guesswork Out of Creator Marketing"

* "Guesswork" \= relatable pain point  
* Numbered promise \= specific value

---

### **Tab Labels**

**Before:** Strategy | Match | Manage  
 **After:** Understand Your Brand | Find Your People | Stay in Sync

**Why it works:**

* Action-oriented, benefit-focused  
* "Your People" \= belonging, community  
* "Stay in Sync" \= ongoing support, not just transaction

---

### **Tab 1: Understand Your Brand**

#### **Headline**

**Before:** "Deep Tissue Brand Scan"  
 **After:** "We Get to Know You (Really Know You)"

**Why it works:**

* Parenthetical emphasis \= authenticity  
* Human relationship language  
* Removes medical/technical jargon

**Alternative:** "Understanding What Makes Your Brand Tick"

* Warm, curious positioning  
* "Tick" \= personality, not just features

#### **Body Copy**

**Before:** "We generate deep intelligence about your brand—personality, products, competitor intelligence, lifecycle stage—to map your creative requirements from creators."

**After:** "Most platforms ask you to fill out 50 fields about your brand. We don't. Just share your website, and our AI learns your personality, your products, and what kind of creative partnership will actually resonate with your audience."

**Why it works:**

* Acknowledges competitor friction  
* "We don't" \= immediate relief  
* "What kind of creative partnership" \= relationship framing  
* "Actually resonate" \= outcome focus, not process

**Alternative:**  
 "Your brand has a story, a vibe, an audience who gets it. We analyze all of that—your aesthetic, your voice, your values—so we can introduce you to creators who already speak your language."

---

### **Tab 2: Find Your People**

#### **Headline**

**Before:** "Ideal Match"  
 **After:** "Meet Creators Who Already Reach Your Customers"

**Why it works:**

* "Meet" \= warm introduction  
* "Already reach" \= proven audience overlap  
* "Your customers" \= specific, relevant

**Alternative:** "Find the Voices Your Audience Already Trusts"

* Social proof built-in  
* "Voices" \= authentic creators, not "influencers"

#### **Body Copy**

**Before:** "AI filters and matches influencers on 20+ attributes—creator archetype, audience overlap, past collaboration quality, visual and audio fidelity, and your budget."

**After:** "We don't just throw you a list of everyone with a big follower count. We match you with creators based on what matters: whether their audience overlaps with yours, if their content quality matches your standards, and whether they've delivered for brands like you before."

**Why it works:**

* "We don't just" \= differentiation from competitors  
* "What matters" \= priority alignment  
* "Delivered for brands like you" \= peer social proof  
* "Your standards" \= respects brand's quality bar

**Alternative:**  
 "Forget vanity metrics. We find creators whose audiences actually look like your customers, whose content feels like your brand, and who've proven they can drive real results—all within your budget."

---

### **Callout Badge (Tab 2\)**

**Before:** "No more DMing 100 creators to get 5 responses. We pre-qualify."

**After:** "You've been ghosted enough. These creators actually want to hear from you."

**Why it works:**

* Acknowledges emotional pain point (ghosting)  
* "Actually want" \= mutual interest  
* More empathetic than transactional

---

### **Tab 3: Stay in Sync**

#### **Headline**

**Before:** "Managing Collaborations on the Go"  
 **After:** "One Simple Space for Every Conversation and Deliverable"

**Why it works:**

* "Simple" \= ease promise  
* "Space" \= less corporate than "platform"  
* "Every conversation" \= comprehensive

**Alternative:** "Keep All Your Partnerships Moving (Without the Email Chaos)"

* Acknowledges pain point  
* "Partnerships" \= relationship language

#### **Body Copy**

**Before:** "Track the complete journey of the collaboration through an intuitive chat UI."

**After:** "No more digging through email threads to find that one brief. Everything—contracts, content drafts, feedback, payments—lives in one conversation with each creator. So you can focus on building great campaigns, not managing chaos."

**Why it works:**

* Specific pain point (email archaeology)  
* "Lives in one conversation" \= natural, human framing  
* "Building great campaigns" \= aspiration  
* "Not managing chaos" \= relief from current state

**Alternative:**  
 "From your first message to final payment, every collaboration stays organized in one place. You'll always know what's next, what's pending, and what's already done—without the spreadsheet gymnastics."

---

## **Execution Advantage (FOMO Section)**

### **Section Headline**

**Before:** "Slide into the Priority DM of Your Favorite Creator"

**After:** "Get Noticed by Creators Who Usually Ignore Brand DMs"

**Why it works:**

* Acknowledges the rejection brands face  
* "Get noticed" \= aspiration  
* More honest about pain point

**Alternative A:** "Finally, a Way to Reach Creators That Doesn't Feel Like Shouting Into the Void"

* Extremely relatable pain point  
* Conversational, empathetic

**Alternative B:** "Connect with Creators Through the One Channel They Actually Check"

* Practical benefit  
* Implies insider knowledge

---

### **Benefit Blocks**

#### **Block 1: Official Meta Creator API**

**Before:** "No more 'ghosting.' Instant access to 10M+ creators through our verified partner access to Meta Creator Marketplace."

**After:** "You know that sinking feeling when you DM a creator and... nothing? We partnered with Meta to fix that. Your invites go directly into creators' priority inbox—the one they actually check—giving you access to 10M+ creators who want to work with brands."

**Why it works:**

* Starts with emotional pain point  
* "We partnered with Meta to fix that" \= problem-solving partner  
* "Want to work with brands" \= reduces rejection anxiety  
* More narrative, less feature-list

**Social Proof Addition:**  
 "Trusted by 500+ brands who were tired of being ignored"

---

#### **Block 2: Priority Placement**

**Before:** "Your invitations are flagged as high-priority. They don't get lost in the noise."

**After:** "Your message doesn't compete with 200 other DMs. It shows up at the top, marked as a verified brand partnership opportunity. Which means creators see it, read it, and respond—not ghost you."

**Why it works:**

* Quantifies the noise problem (200 DMs)  
* "Verified brand partnership" \= legitimacy  
* "Not ghost you" \= directly addresses fear

**Stat Revision:**  
 "**3x higher response rate** compared to cold Instagram DMs"

---

#### **Block 3: Contextual AI Hooks**

**Before:** "Our AI writes the invite *for* you, referencing the creator's latest content and your brand's hero feature."

**After:** "Hate writing cold outreach? Us too. Our AI crafts personalized messages that reference what the creator just posted and why your brand would resonate with their audience. It's thoughtful, not templated—because creators can smell copy-paste from a mile away."

**Why it works:**

* "Hate writing...? Us too." \= shared pain point  
* "Thoughtful, not templated" \= quality signal  
* "Creators can smell copy-paste" \= insider perspective  
* More conversational, coaching tone

**Micro-Copy Addition:**  
 "Every message is unique. Every message is you."

---

## **Trust & Security Section**

### **Section Headline**

**Before:** "Enterprise-Grade Security. Zero Account Risk."

**After:** "Your Meta Account Is Safe with Us (We Promise)"

**Why it works:**

* Direct address of biggest concern  
* "We Promise" \= human commitment, not just tech spec  
* More conversational, less corporate

**Alternative:** "We Know You're Protective of Your Business Manager. Here's Why You Can Trust Us."

* Acknowledges the emotional barrier  
* Invites explanation vs. assertion

---

### **Subheadline**

**Before:** \[None\]  
 **After:** "We get it—connecting third-party tools to your Meta account feels risky. Here's exactly how we keep your account secure and in perfect standing with Meta's policies."

**Why it works:**

* "We get it" \= empathy acknowledgment  
* "Feels risky" \= validates emotion  
* "Exactly how" \= transparency promise  
* "Perfect standing" \= reassurance

---

### **Trust Bullets**

#### **Bullet 1**

**Before:** "Official API Access: We use the Meta Graph API (v25.0) for secure, read-only/send-only permissions."

**After:** "**We're official Meta partners.** We use their Graph API with read-only permissions—meaning we can see what you choose to share, but we can never post on your behalf or access anything sensitive."

**Why it works:**

* "Official Meta partners" \= credibility first  
* "We can never" \= absolute reassurance  
* Plain language vs. technical jargon

---

#### **Bullet 2**

**Before:** "Policy Compliant: We strictly follow Meta's 200-DM-per-hour safety limits to keep your account in good standing."

**After:** "**Your account stays safe.** We follow Meta's sending limits to the letter (200 messages per hour, max). No shady tactics that could get you flagged or banned."

**Why it works:**

* "Stays safe" \= protection promise  
* "To the letter" \= precision  
* "No shady tactics" \= differentiates from black-hat tools  
* Acknowledges ban fear directly

---

#### **Bullet 3**

**Before:** "Your Data, Encrypted: We never store sensitive login credentials. Everything is handled via a secure OAuth2 handshake."

**After:** "**We never see your password.** Ever. You log in directly through Meta's secure system (OAuth2), and we only get permission to send messages on your behalf—nothing else."

**Why it works:**

* "We never see your password. Ever." \= emphatic reassurance  
* "You log in directly through Meta" \= they control the process  
* "Nothing else" \= clear limitation

---

### **Visual Element Caption**

**Before:** SSL certificate icon \+ Meta partnership certificate  
 **After:** "Meta-Verified Partnership | Bank-Level Encryption | SOC2 Certified"

**Subtext:** "We're audited by the same security standards as financial institutions. Your data is that important to us."

**Why it works:**

* Financial comparison \= relatable security benchmark  
* "Your data is that important to us" \= values statement

---

## **Features Grid**

### **Section Headline**

**Before:** \[None\]  
 **After:** "Everything You Need to Run Creator Campaigns That Actually Perform"

**Why it works:**

* "Everything you need" \= comprehensive  
* "Actually perform" \= acknowledges past disappointments  
* Outcome-focused

---

### **Feature Copy Revisions**

#### **1\. Instant Brand Profile**

**Before:** "No more manual effort of filling 50+ fields."

**After:** "**Skip the 50-field form.**  
 Just paste your URL. We'll handle the rest."

**Why it works:**

* Bold headline \= scannable  
* Action-oriented ("Skip")  
* "We'll handle the rest" \= burden relief

---

#### **2\. Campaign Planner**

**Before:** "Effortlessly plan festive campaigns with AI and launch in 1-click."

**After:** "**Plan your next campaign in 5 minutes.**  
 Holiday launch? Product drop? Our AI builds the strategy—you just approve."

**Why it works:**

* Specific time promise (5 minutes)  
* Relatable use cases  
* "You just approve" \= maintains control

---

#### **3\. Creator Detailed Profile**

**Before:** "Get comprehensive reports on creators before diving into collaboration."

**After:** "**Know exactly who you're working with.**  
 See their best work, audience demographics, and past brand partnerships before you reach out."

**Why it works:**

* "Know exactly" \= certainty  
* Lists specific insights  
* "Before you reach out" \= risk reduction

---

#### **4\. Scale Without Limits**

**Before:** "Flexible plans for brands of every size and growth stage."

**After:** "**From 5 campaigns to 500, we grow with you.**  
 Whether you're testing creators for the first time or managing hundreds of partnerships, one platform handles it all."

**Why it works:**

* Specific scale examples  
* "We grow with you" \= long-term partnership  
* "Testing creators for the first time" \= beginner-friendly

---

#### **5\. Direct Chat**

**Before:** "No more email threads. Close collaborations 60% faster."

**After:** "**Say goodbye to email chaos.**  
 Message creators, share briefs, review content—all in one chat thread. Deals close 60% faster."

**Why it works:**

* "Say goodbye" \= liberation language  
* Specific actions listed  
* Stat feels earned, not forced

---

#### **6\. Competitor Intelligence**

**Before:** "Track competitor activity and derive actionable insights for your campaigns."

**After:** "**See what's working for brands like yours.**  
 Track competitor campaigns, spot trending creators, and learn what's driving results in your industry."

**Why it works:**

* "Brands like yours" \= relevant peer learning  
* Specific benefits listed  
* "Learn" \= educational positioning

---

#### **7\. Campaign Reports**

**Before:** "Actionable insights to optimize performance and maximize marketing ROI."

**After:** "**Know what's working (and what's not).**  
 Real-time dashboards show you reach, engagement, and ROI across every creator and campaign."

**Why it works:**

* Honest framing (includes what's not working)  
* "Real-time" \= immediacy  
* Specific metrics listed

---

#### **8\. Cut Costs, Not Quality**

**Before:** "Save up to 40% by negotiating directly with influencers and choosing best-priced talent from multiple applicants."

**After:** "**Stop overpaying for the same results.**  
 Compare rates, negotiate directly, and choose from multiple qualified creators—saving an average of 40% vs. agency markups."

**Why it works:**

* "Stop overpaying" \= pain point  
* "Same results" \= quality maintained  
* "Agency markups" \= clear villain

---

#### **9\. Escrow Payments**

**Before:** "Release funds only when influencers meet all agreed-upon campaign deliverables."

**After:** "**Pay when they deliver, not before.**  
 Your budget sits safely in escrow until creators hit every milestone. No more chasing influencers who ghosted after the deposit."

**Why it works:**

* Clear benefit statement  
* "Safely in escrow" \= security  
* "Chasing influencers who ghosted" \= specific pain point

---

## **Footer**

### **Column 1: Brand & Mission**

#### **Tagline**

**Before:** "From DNA to Priority DMs. The world's first AI-native influencer engine."

**After:** "The creator marketing platform built for brands who care about real relationships, not just reach."

**Why it works:**

* "Brands who care" \= values alignment  
* "Real relationships" \= differentiator  
* "Not just reach" \= quality signal

**Alternative:** "We help good brands find great creators. And make it stupidly simple."

* Humble positioning  
* Conversational tone

---

### **Column 3: Security & Trust**

#### **Section Title**

**Before:** "Security & Trust"  
 **After:** "Your Peace of Mind"

**Why it works:**

* Emotional benefit vs. category label  
* More human, less corporate

#### **Links Copy**

**Before:** "Security Disclosure"  
 **After:** "How We Protect Your Data (Plain English)"

**Why it works:**

* Transparency signal  
* "Plain English" \= accessibility promise

---

### **Compliance Bar**

#### **Right Side**

**Before:** "Made for high-growth brands in San Francisco / London."

**After:** "Built by marketers who got tired of bad influencer tools."

**Why it works:**

* Origin story \= authenticity  
* "Got tired" \= shared frustration  
* Relatable, not geographic flex

**Alternative:** "Made with care for brands who deserve better."

* Values-driven  
* Aspirational without arrogance

---

## **Sticky CTA Bar (Scroll-Triggered)**

### **Copy**

**Before:** "Get Started Free"

**After:** "Ready to Meet Your Perfect Creators? Start Free →"

**Why it works:**

* Question \= engagement device  
* "Your perfect creators" \= personalized benefit  
* "Start free" \= low barrier

---

## **Exit Intent Modal**

### **Headline**

**Before:** "Get Free Brand Analysis"

**After:** "Before You Go: Want to See Who's Already Talking to Your Customers?"

**Why it works:**

* "Before you go" \= polite interruption  
* Curiosity hook (who's talking to your customers)  
* Specific value offer

### **Subheadline**

"Just drop your email. We'll send you a free report showing which creators are already reaching your exact audience—and how to work with them."

**CTA Button:** "Send Me the Report"

---

## **Traffic Source-Specific Headlines**

### **Facebook Ads (Cold Traffic)**

**Primary:** "Stop Wasting Budget on Creators Who Don't Convert"  
 **Alternative:** "Find Creators Your Customers Already Trust"

**Why it works:**

* Problem-aware audience  
* "Don't convert" \= outcome focus

---

### **Google Ads (High Intent)**

**Primary:** "The Influencer Marketing Platform That Actually Works"  
 **Alternative:** "Creator Marketing, Without the Headaches"

**Why it works:**

* Direct benefit claim  
* "Actually works" \= acknowledges competitor failures

---

### **Instagram Influencers (Warm Traffic)**

**Primary:** "Join 500+ Brands Who Found Their Perfect Creator Partners"  
 **Dynamic Insert:** "Just like \[Influencer Name\] recommended"

**Why it works:**

* Social proof  
* "Join" \= community belonging  
* Acknowledges referral source

---

## **Email Nurture Sequences (Post-Signup)**

### **Email 1: Welcome (Immediately)**

**Subject:** "Welcome to \[Brand\]—Let's Find Your Creators"

**Preview:** "No 47-step onboarding. Just paste your URL and we'll do the heavy lifting."

**Body Opening:**  
 "Hey there,

Thanks for trusting us with your creator marketing. We know you've probably tried other platforms (or agencies, or DIY-ing it) and ended up frustrated. We built this differently.

Here's what happens next..."

---

### **Email 2: Education (Day 2\)**

**Subject:** "How \[Brand\] is different from every other influencer platform"

**Preview:** "Hint: We actually understand your brand before recommending anyone."

---

### **Email 3: Social Proof (Day 5\)**

**Subject:** "How \[D2C Brand\] went from 0 to 50 creator partnerships in 30 days"

**Preview:** "Real results from a brand just like yours."

---

## **Voice & Tone Guidelines Summary**

### **What We Sound Like**

✅ **A trusted advisor who's been there**  
 ✅ **Warm, but not overly casual**  
 ✅ **Knowledgeable without being condescending**  
 ✅ **Honest about pain points and limitations**  
 ✅ **Partnership-oriented, not transactional**

### **What We Avoid**

❌ Hype and exaggeration  
 ❌ Technical jargon without context  
 ❌ Aggressive urgency/scarcity  
 ❌ Generic SaaS-speak  
 ❌ Talking down to brands

### **Key Phrases We Use**

* "We get it..."  
* "Here's how..."  
* "You've probably tried..."  
* "Let's fix that."  
* "Built for brands like yours"  
* "Real results, not vanity metrics"

### **Key Phrases We Avoid**

* "Revolutionize"  
* "Game-changing"  
* "Disrupt"  
* "Next-generation"  
* "Cutting-edge"  
* "Industry-leading"

---

## **A/B Testing Recommendations**

### **Test 1: Hero Headline Warmth Spectrum**

* **A (Warm):** "Meet the Creators Who'll Love Your Brand as Much as You Do"  
* **B (Balanced):** "Find Your Brand's Creative Partners in Minutes, Not Months"  
* **C (Direct):** "Stop Wasting Time on Creators Who Ghost You"

**Hypothesis:** Warmer copy builds trust but may reduce urgency. Test with different traffic sources.

---

### **Test 2: CTA Language**

* **A (Collaborative):** "See Who's Right for Us"  
* **B (Educational):** "Start My Free Brand Scan"  
* **C (Outcome):** "Show Me My Matches"

**Hypothesis:** Collaborative language improves brand recall; educational reduces friction.

---

### **Test 3: Trust Section Position**

* **A:** After Hero (immediate trust-building)  
* **B:** After Features (late-stage objection handling)

**Hypothesis:** Security-conscious buyers need early reassurance; others care more about features.

---

## **Implementation Notes**

### **Tone Calibration by Brand Vertical**

**D2C/E-commerce:**

* Slightly more direct, ROI-focused  
* "Customers" and "sales" language OK  
* Example: "Find creators who actually drive sales"

**AI/SaaS:**

* Tech-savvy but not jargon-heavy  
* Innovation language OK  
* Example: "The only platform that understands your technical audience"

**Healthcare:**

* Maximum trust and compliance emphasis  
* Conservative, professional tone  
* Example: "HIPAA-compliant creator partnerships that build patient trust"

**Offline Experiences:**

* Experiential, community language  
* Authenticity over scale  
* Example: "Find local voices who bring your community together"

---

**Document Version:** 2.0 (Copy Revision)  
 **Lead Copywriter Voice:** Trusted, Knowledgeable, Warm Partner  
 **Last Updated:** May 2026

# url input listening states

### **1\. The Input "Listening" State**

This triggers as soon as the user enters a validly structured domain (Regex check passed).

* **Guidance on Rhythmic Pulse:**  
  * **The Border:** Instead of a static color, the input border should use a **gradient shadow pulse**. It expands outward by 4-6px and contracts, mimicking a "heartbeat" or a sonar scan.  
  * **Color:** Use **Aurora Green (\#34D399)** at 40% opacity for the glow.  
  * **Speed:** A slow, breathing rhythm (approx. 2 seconds per cycle).  
* **Listening State Text (Dynamic Micro-copy):**  
  * While the pulse is active, the placeholder text or a small caption below the input cycles through:  
    * *"Locating brand servers..."*  
    * *"Analyzing industry signals..."*  
    * *"Verifying commercial DNA..."*

---

* 

### **2\. Consolidated UI Copy: Success & Rejection Scenarios**

The section below updates the operational copy structures. The primary copy blocks are extracted directly from the Stitch UI design assets (image\_dba069.jpg, image\_dba089.jpg, image\_dba0a9.jpg), followed by programmatic copy expansions designed to cover all outstanding backend validation gates.  
\================================================================================  
SECTION 2\. UI COPY: SUCCESS & REJECTION SCENARIOS  
\================================================================================

#### **\[STATE A: SUCCESSFUL BRAND VERIFICATION\]**

* **Source Asset:** image\_dba069.jpg  
* **Input Box Value:** \[User Entered URL\]  
* **Primary Action Button Text:** Launch My Campaign Now →  
* **Status Alert Subline:** 🟢 Brand Verified. Your strategy is ready to build\!  
* **Component Tokens applied:** Button uses Primary Background (\#34D399) with solid black bold typography as per AURORA DESIGN SYSTEM v4.1 rules.

#### **\[STATE B: INDUSTRY REGRET & SUB-INDUSTRY WAITLIST\]**

* **Source Asset:** image\_dba089.jpg  
* **Input Box Value:** \[unsupported-domain.com\] (e.g., realestate.com)  
* **Primary Action Button Text:** Notify me when \[Detected Sub-Industry\] launches  
* **Status Alert Subline:** ⚠️ We've identified \[unsupported-domain.com\] to be \[Detected Sub-Industry\]. Creator's Shop is currently optimized for D2C, SaaS, Healthcare, and Offline Services.  
* **Secondary Engagement Block Header:** Receive an invitation for your industry. Leave your email for early bird access.  
* **Secondary Input Field Placeholder:** email@yourdomain.com  
* **Secondary Action Button Text:** Join Waitlist  
* **Component Tokens applied:** Alert text leverages the warning format with an emphasis on legibility floor compliance.

#### **\[STATE C: CLIENT-SIDE SYNTAX ERROR\]**

* **Source Asset:** image\_dba0a9.jpg  
* **Input Box Value:** \[Malformed Input String\]  
* **Primary Action Button Text:** Analyze Website  
* **Status Alert Subline:** ⚠️ Please enter a valid website address (e.g., brand.com)  
* **Component Tokens applied:** Input text box edge throws an error indicator using status-error (\#CA0F1C) with an accompanying shake viewport animation.

#### **\[STATE D: RATE-LIMITING INTERCEPT GATE (DOMAIN/IP Overage)\]**

* **Source Asset:** *Supplemental Addition (Missing from Stitch)*  
* **Input Box Value:** \[Rate Limiting Target Domain\]  
* **Primary Action Button Text:** Verify Domain Ownership  
* **Status Alert Subline:** ⚠️ ⚠️ This brand or user has requested multiple scans in past. Verify your company email address to proceed.  
* **Component Tokens applied:** Input background transforms to Light Pink (\#FFF6F6) with text content colored in Ruby Red (\#CA0F1C) to enforce the interactive gate block without disabling form input accessibility.

#### **\[STATE E: CACHED RECOVERY RESUME\]**

* **Source Asset:** *Supplemental Addition (Missing from Stitch)*  
* **Input Box Value:** \[Cached Domain String\]  
* **Primary Action Button Text:** Resume Previous Scan Results  
* **Status Alert Subline:** 🔄 🔄 We located a recent scan  within the last 7 days. Reloading existing data  
* **Component Tokens applied:** Bypasses live scanning load times to serve cached database models immediately.

#### **\[STATE F: INFRASTRUCTURE / LIVE CONNECTION RUNTIME ERROR\]**

* **Source Asset:** *Supplemental Addition (Missing from Stitch)*  
* **Input Box Value:** \[Failing Domain String\]  
* **Primary Action Button Text:** Retry Connection Check  
* **Status Alert Subline Variants:**  
  * *For 4XX/5XX Failures:* ⚠️ Connection Refused: The platform received a server response error (\[HTTP Status Code\]) when accessing this URL. .  
  * *For DNS Resolution/Timeout Errors:* ⚠️ Connection Failure: The domain entered cannot be accessed. Please check..  
  * *For Loop/External Domain Redirect Hijacks:* ⚠️ Redirect Exception: This address routes traffic to an entirely separate destination domain. Please enter the definitive target landing page.  
* **Component Tokens applied:** Renders using custom error alert blocks adhering to a fixed 1px border profile.

#### **\[STATE G: SECURITY & HARD BLOCKLIST EXCLUSION\]**

* **Source Asset:** *Supplemental Addition (Missing from Stitch)*  
* **Input Box Value:** \[Excluded Domain String\] (e.g., .gov, .mil, malicious links)  
* **Primary Action Button Text:** Scan Restricted  
* **Status Alert Subline:** 🚫 Access Denied: This target website belongs to a restricted segment, or not supported by the platform.  
* **Component Tokens applied:** Freezes primary submission handling and locks the field state using the specified disabled background styling (\#F3F4F6).

#### **\[STATE H: CLAIMED BRAND ACCOUNT PROTECTION\]**

* **Source Asset:** *Supplemental Addition (Missing from Stitch)*  
* **Input Box Value:** \[Claimed Active Domain\]  
* **Primary Action Button Text:** Request Workspace Access  
* **Status Alert Subline:** 🔒 This brand domain has been claimed and verified by an authorized workspace administrator. Enter your professional email address to request a team invite.  
* **Component Tokens applied:** Encapsulates the privacy rules defined in the system change guidelines, preventing any raw exposure of user emails, logotypes, or active system metadata to unauthenticated web requests.

# stitch import

| Element type: url listening state | Stitch UI Name: Landing page- analyze status  |
| :---- | :---- |
| **Issue**  Currently there is a duplication of url listening states and there is a buffering animation between them.  |  |
| **Resolution**  There should be single green url listening state, as is in the stitch file |  |
| **Issue screen** ![][image1]  | **As is screen**![][image2] |

| Element type: url input states | Stitch UI Name:  Landing page- CTA clicked Landing page- analyze status Brand Verified Success State Industry Regret State (Final) URL Syntax Error State Claimed Brand Protection State Infrastructure Error State Security Blocklist State Rate-Limiting Intercept State Cached Recovery State |
| :---- | :---- |
| **Issue**  There should be different reason code based alert and errors (as described in the tab” url listening states Add email for waitlist/ or request team invite are also missing |  |
| **Resolution**  Import error and CTA button cases from each stitch file and link with validation  |  |
| **Issue screen**   | **As is screen** |

# AI prompt

## **Technical Architecture Blueprint: Prompt Step 1**

Following the rules set out in your prompting.md file, this blueprint details the 12-part system prompt structure. It is designed to act as a reliable software function, changing structured text inputs into type-safe JSON schema outputs.

### **I. Comprehensive Prompt Architecture Blueprint**

Markdown  
\# SYSTEM PROMPT: DETERMINISTIC BRAND INDUSTRY CLASSIFIER (v2.1)

\#\# 1\. ROLE & OBJECTIVE  
You are a deterministic business intelligence classification engine. Your sole responsibility is to analyze structured website metadata and text content to classify the target business domain into an explicit industry vertical and extract a precise sub-industry. Do not generate conversational introductions, conclusions, or narrative summaries. Output exclusively valid, minified JSON.

\#\# 2\. METADATA & DEFINITIONS  
\- DOMAIN*\_NAME: The root namespace of the storefront being evaluated.*  
*\- SUPPORTED\_*INDUSTRIES: Core commercial verticals actively optimized on the platform.  
\- UNSUPPORTED*\_INDUSTRIES: Known valid commercial verticals not currently optimized.*  
*\- SYSTEM\_*EXCLUSIONS: Non-commercial, restricted, or unclassifiable content archetypes.

\#\# 3\. BUSINESS RULES  
\- Every evaluation must map to exactly one high-level industry vertical enum.  
\- If an entity bridges multiple industries (e.g., a software platform designed specifically for clinics), follow the Priority Rules strictly to resolve the conflict.  
\- Do not make assumptions. Classify based strictly on the text provided inside the structural XML blocks.

\#\# 4\. GLOSSARY  
\- D2C (Direct-to-Consumer): E-commerce storefronts selling physical goods directly to end users.  
\- SaaS*\_AI: Cloud-based software applications, tooling, platforms, and AI-driven systems.*  
*\- Healthcare: Medical clinics, wellness providers, pharmaceutical retailers, or health practitioners.*  
*\- Offline\_*Services: Brick-and-mortar operations, physical trades, local consulting, and hospitality.

\#\# 5\. TAXONOMY (ENUM FIELDS)  
The output \`industry\_vertical\` field MUST match one of the following exact enum tokens:  
\- 'D2C'  
\- 'SAAS*\_AI'*  
*\- 'HEALTHCARE'*  
*\- 'OFFLINE\_*SERVICES'  
\- 'REAL*\_ESTATE'*  
*\- 'B2B\_*AGENCY'  
\- 'MEDIA'  
\- 'EDUCATION'  
\- 'ENTERTAINMENT'  
\- 'UNKNOWN'

\#\# 6\. DECISION RULES  
\- Check the \`\<meta\_description\>\` block first. If it contains a clear value proposition, use it as your primary classification baseline.  
\- Analyze the main \`\<body\>\` text token matrix to extract structural keywords confirming commercial transactions (e.g., "Add to Cart", "Book Appointment", "SaaS Login", "Our Team").  
\- If the text content contains placeholder strings ("Lorem Ipsum", "Domain Parked", "Buy this domain"), classify immediately as 'UNKNOWN'.

\#\# 7\. PRIORITY RULES (CONFLICT RESOLUTION)  
To resolve multi-vertical intersections deterministically, apply this top-down priority hierarchy:  
1\. If a platform sells a physical consumer product via its own checkout stack, it is 'D2C' (even if it uses AI features).  
2\. If a platform is a software-as-a-service application built for healthcare or offline trades, it is 'SAAS*\_AI'.*  
*3\. If an entity delivers hands-on medical care or therapeutic procedures, it is 'HEALTHCARE' (even if it operates offline facilities).*  
*4\. If an entity provides manual physical labor, local dining, or retail storefronts without proprietary software products, it is 'OFFLINE\_*SERVICES'.

\#\# 8\. CONSTRAINTS  
\- Never invent categories outside the provided enum taxonomy.  
\- If the source content is written in a language other than English, immediately return an industry classification of 'UNKNOWN' and set the sub-industry to "Foreign Language Storefront".  
\- Do not attempt to guess a classification if the content is ambiguous or insufficient; fall back directly to 'UNKNOWN'.

\#\# 9\. INPUT SPECIFICATION  
Input data is passed inside clean, delimited XML segment blocks. Example:  
\<input\_payload\>  
  \<domain\_name\>examplebrand.com\</domain\_name\>  
  \<meta\_description\>Text here\</meta\_description\>  
  \<og\_title\>Text here\</og\_title\>  
  \<body\>Cleaned semantic page text here (Max 1500 words)\</body\>  
\</input\_payload\>

\#\# 10\. FEW-SHOT EXAMPLES

\#\#\# Example 1: Clear Supported D2C  
Input:  
\<input\_payload\>  
  \<domain\_name\>evara.in\</domain\_name\>  
  \<meta\_description\>Shop premium vegan skincare products online. Free shipping on all organic face oils.\</meta\_description\>  
  \<og\_title\>Evara Skincare | Natural & Organic Skin Products\</og\_title\>  
  \<body\>Home. Shop All. Our Philosophy. Cart (0). Add to cart. Certified organic ingredients engineered for lasting glow. Contact us. Privacy policy.\</body\>  
\</input\_payload\>  
Output:  
{"chain*\_of\_*thought*\_evidence":"The meta description and body text explicitly highlight an online store selling physical goods directly to consumers using typical e-commerce components like a shopping cart and checkout indicators.","confidence\_*score":100,"industry*\_vertical":"D2C","detected\_*sub*\_industry":"Organic Skincare"}*

*\#\#\# Example 2: Intersecting Industry (SaaS for Healthcare)*  
*Input:*  
*\<input\_payload\>*  
  *\<domain\_name\>mediconnect-app.io\</domain\_name\>*  
  *\<meta\_description\>The definitive AI-powered patient scheduling software platform for modern dental clinics.\</meta\_description\>*  
  *\<og\_title\>MediConnect | Enterprise Dental SaaS\</og\_title\>*  
  *\<body\>Book a Demo. Pricing Plans. Features. Integrations. Cloud-based automated workflows that reduce front-desk admin time by 40%. Trusted by 500+ practices. Log In.\</body\>*  
*\</input\_payload\>*  
*Output:*  
*{"chain\_*of*\_thought\_*evidence":"The business offers a cloud-based software subscription application ('Book a Demo', 'Pricing Plans', 'SaaS'). Although it serves dental practices, Priority Rule \#2 dictates that software applications built for healthcare must be classified under SAAS*\_AI.","confidence\_*score":98,"industry*\_vertical":"SAAS\_*AI","detected*\_sub\_*industry":"Healthcare Scheduling Software"}

\#\#\# Example 3: Under Construction / Parked Domain Fallback  
Input:  
\<input\_payload\>  
  \<domain\_name\>futureventures.com\</domain\_name\>  
  \<meta\_description\>FutureVentures is coming soon. Powered by GoDaddy Domain Parking.\</meta\_description\>  
  \<og\_title\>futureventures.com\</og\_title\>  
  \<body\>This domain is registered. Welcome to futureventures.com. If you are the owner, log in to your dashboard. Buy this domain.\</body\>  
\</input\_payload\>  
Output:  
{"chain*\_of\_*thought*\_evidence":"The meta description and body content show explicit markers of an inactive, parked webpage with no active business operation or products.","confidence\_*score":100,"industry*\_vertical":"UNKNOWN","detected\_*sub*\_industry":"Parked Domain"}*

*\#\# 11\. STRICT OUTPUT SCHEMA (JSON)*  
*Your response must be a single, flat JSON object following this exact structural signature. No extra keys, no markdown wrappers:*  
*{*  
  *"chain\_*of*\_thought\_*evidence": string (Max 250 characters documenting your analytical deductions),  
  "confidence*\_score": integer (Range 0 to 100 representing classification certainty),*  
  *"industry\_*vertical": string (Must match an allowed enum from Section 5),  
  "detected*\_sub\_*industry": string (A clean, title-case 2-to-4 word description of the business niche)  
}

\#\# 12\. FAILURE HANDLING DEFINITION  
If the text content block is completely missing, unreadable, corrupted, or contains only server connection errors passed by the scraper, you must return:  
{"chain*\_of\_*thought*\_evidence":"The scraping payload contains no evaluable semantic content, text metadata, or structural layout identifiers.","confidence\_*score":100,"industry*\_vertical":"UNKNOWN","detected\_*sub*\_industry":"Unreadable Content"}*

### **II. Programmatic Data Processing Sequence**

To protect this prompt from long URLs that can hang the screen, the system uses a strict pipeline sequence. The AI classification prompt only runs *after* these preliminary data scrubbing steps are completed on the application server:  
\[User Form Input\]   
       │  
       ▼  
1\. Truncate & Slice Gate ──► (Cuts string at first '?' or '/' to clear tracking tokens instantly)  
       │  
       ▼  
2\. Zod Format Parser      ──► (Normalizes protocols, strips 'www.', validates root domain syntax)  
       │  
       ▼  
3\. Phase 0 Cache Check    ──► (Verifies rolling limits, active claims, and 7-day unverified cache)  
       │  
       ▼  
4\. Clean HTML Scraper     ──► (Strips \<script\>, \<style\>, and structural markup into raw text)  
       │  
       ▼  
5\. Token Ceiling Truncate ──► (Enforces a hard limit cutting body text at exactly 1,500 words)  
       │  
       ▼  
\[Deterministic Prompt Step 1 Execution\]

This ensures that by the time data is passed to the AI prompt model, it is fully sanitized and formatted. This keeps execution times predictable and avoids processing hangs or domain-hijack errors.

# Updated Zod

import { z } from "zod";

// \--- 1\. Gatekeeper Constants \---

// Hard-coded structural extensions to drop during the normalization gate  
const HARD\_BLOCKLIST\_EXTENSIONS \= \['.gov', '.mil', '.edu'\];

// Define the Industry Lists for the Gatekeeper  
const SupportedIndustries \= \["D2C", "SaaS\_AI", "Healthcare", "Offline\_Services"\] as const;  
const RegretIndustries \= \["Real\_Estate", "B2B\_Agency", "Media", "Education", "Entertainment"\] as const;  
const BlockedIndustries \= \["Gambling", "Adult", "Fraudulent\_HighRisk"\] as const;

// \--- 2\. Core Discovery Schema (Client Input) \---

export const Step1DiscoverySchema \= z.object({  
  brandUrl: z  
    .string()  
    .trim()  
    .min(1, { message: "Please enter a valid website address (e.g., brand.com)" })  
      
    // Layer 1: Force lowercase, normalize protocols, and extract root domain  
    .transform((val) \=\> {  
      let clean \= val.toLowerCase().replace(/^(https?:\\/\\/)?(www\\.)?/, '');  
      return clean.split('/')\[0\];  
    })  
      
    // Layer 2: Basic Syntax Validation  
    .refine((domain) \=\> {  
      const domainRegex \= /^\[a-z0-9\](\[a-z0-9-\]{0,61}\[a-z0-9\])?(\\.\[a-z0-9\](\[a-z0-9-\]{0,61}\[a-z0-9\])?)+$/;  
      return domainRegex.test(domain);  
    }, { message: "Please enter a valid website address (e.g., brand.com)" })  
      
    // Layer 3: Social, Marketplace & TLD Blocking (Negative Lookahead)  
    .refine((domain) \=\> {  
      // Evaluates against the already-stripped root domain  
      const regex \= /^(?\!.\*(?:facebook|instagram|twitter|tiktok|porn|casino|gamble|bet)\\.)(\[a-zA-Z0-9-\]{2,256}\\.(?\!zip|top|ru|cc|link|biz|info)(?:\[a-zA-Z\]{2,10}))$/;  
      return regex.test(domain);  
    }, { message: "Please enter a valid brand website (social media and marketplaces not supported)." })  
      
    // Layer 4: Structural Blocklist Verification  
    .refine((domain) \=\> {  
      return \!HARD\_BLOCKLIST\_EXTENSIONS.some(ext \=\> domain.endsWith(ext));  
    }, { message: "Access Denied: This target website belongs to a restricted segment." }),

  // Populated after the AI "Listen" Scan  
  detectedIndustry: z  
    .enum(\[...SupportedIndustries, ...RegretIndustries, ...BlockedIndustries, "Unknown"\])  
    .optional(),

  // Permission checks required before Modal 2  
  hasAcceptedRoadmap: z.boolean().default(false),  
});

// \--- 3\. Sub-Industry Waitlist Schema (Secondary Capture) \---

export const IndustryWaitlistSchema \= z.object({  
  email: z  
    .string()  
    .trim()  
    .email({ message: "Please enter a valid business email address." }),  
  detectedSubIndustry: z  
    .string()  
    .min(1)  
});

// \--- 4\. AI Classification Output Schema (Webhook/API Response) \---

export const AiClassificationOutputSchema \= z.object({  
  chain\_of\_thought\_evidence: z.string().max(250),  
  confidence\_score: z.number().int().min(0).max(100),  
  industry\_vertical: z.enum(\[  
    'D2C', 'SAAS\_AI', 'HEALTHCARE', 'OFFLINE\_SERVICES',   
    'REAL\_ESTATE', 'B2B\_AGENCY', 'MEDIA', 'EDUCATION',   
    'ENTERTAINMENT', 'UNKNOWN'  
  \]),  
  detected\_sub\_industry: z.string().trim()  
});

// \--- 5\. Type Inferences \---  
export type Step1DiscoveryInput \= z.infer\<typeof Step1DiscoverySchema\>;  
export type IndustryWaitlistInput \= z.infer\<typeof IndustryWaitlistSchema\>;  
export type AiClassificationOutput \= z.infer\<typeof AiClassificationOutputSchema\>;

# PostGRESQL changes

Here is the updated PostgreSQL schema script. I have integrated classification\_evidence directly into the first ALTER TABLE statement for the discovery\_leads table so that all modifications to that table happen in a single execution.  
SQL  
\-- 1\. Update the core discovery leads table to track sub-industries, session caching, and classification evidence  
ALTER TABLE discovery\_leads   
ADD COLUMN detected\_sub\_industry VARCHAR(100) DEFAULT NULL,  
ADD COLUMN temporary\_payload JSONB DEFAULT NULL,  
ADD COLUMN expires\_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,  
ADD COLUMN signup\_completed BOOLEAN DEFAULT FALSE,  
ADD COLUMN classification\_evidence VARCHAR(250) DEFAULT NULL;

\-- 2\. Update the brand profile system to support ownership tracking  
ALTER TABLE brand\_profiles  
ADD COLUMN is\_verified BOOLEAN DEFAULT FALSE;

\-- 3\. Create a low-latency tracking table for rolling rate limit evaluation  
CREATE TABLE scan\_attempts\_log (  
    id SERIAL PRIMARY KEY,  
    domain\_name VARCHAR(255) NOT NULL,  
    ip\_address INET NOT NULL,  
    attempted\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- 4\. Create indexes to keep Phase 0 skeleton gate checks under 300ms  
CREATE INDEX idx\_scan\_attempts\_routing ON scan\_attempts\_log (domain\_name, ip\_address, attempted\_at);  
CREATE INDEX idx\_discovery\_cache\_lookup ON discovery\_leads (normalized\_domain, signup\_completed, expires\_at);

### **Merge Instructions for Existing Database:**

* **Non-Destructive Migration:** Run the ALTER TABLE commands directly against your production database. Setting defaults to FALSE or NULL prevents existing onboarding paths from breaking.  
* **Transient Data Cleanup:** Set up a background worker task (using pg\_cron or an application-level queue like BullMQ) to run every hour. The task should safely delete unverified records using this query:

SQL  
DELETE FROM discovery\_leads WHERE signup\_completed \= FALSE AND expires\_at \< NOW();

# Developer document

### **2\. Developer Action Guide: Step-by-Step Implementation Sequence**

This runbook defines the procedural integration roadmap for a full-stack developer to merge the Step 1 Master PRD, Change Document v2.1, and the newly introduced Stitch UI designs.  
\================================================================================  
DEVELOPER RUNBOOK: STEP 1 INTEGRATION FLOW (v2.1)  
\================================================================================

#### **Step 1: Database Migration & Index Baseline**

* Execute the PostgreSQL structural modifications script (adding sub-industry tracking, scan log counters, and classification evidence text fields).  
* Apply indices on (domain\_name, ip\_address, attempted\_at) and (normalized\_domain, signup\_completed, expires\_at) to secure the strict 300ms execution target for Phase 0 checks.

#### **Step 2: Input Pre-Processing & Truncation Layer**

* Implement the URL split rule inside the input box event router or controller middleware. Ensure any pasted input is sliced at the first ? or / indicator to strip heavy extensions (fbclid, tracking parameters) immediately.  
* Apply frontend debouncing (150ms–300ms) on text pasting to isolate processing from the main thread and prevent rendering lockups.

#### **Step 3: Zod Structural Parsing Gates**

* Bind the input string validator to the API entry point route. Reject malformed addresses or inputs containing blocked extensions (.gov, .mil, .edu) using localized error states (triggering the input field shake and text box component shift to Ruby \#CA0F1C).

#### **Step 4: Phase 0 Redis/SQL Multi-Tier Lookahead Middleware**

* Before calling any scraping queues or external AI endpoints, execute a read-only lookahead utility to cross-reference constraints:  
  * *Branch A:* If an identical verified account signature is active, halt processing and route the user to the secure workspace shield interface (blocking data exposure).  
  * *Branch B:* If an unverified scan exists under 7 days old, drop the generation pipeline entirely and load the cached payload model directly.  
  * *Branch C:* If rolling domain or IP counters exceed 5 submissions inside a 7-day period, change the interface token settings to Light Pink (\#FFF6F6) and transform the button into an interactive email verification form.

#### **Step 5: Web Scraper Formatting & Context Token Ceilings**

* Build a layout content cleaner inside the crawling worker. Strip out all structural tags (\<script\>, \<style\>, canvas tracking vectors), isolate the metadata header structures into distinct XML variables (\<meta\_description\>, \<og\_title\>), and apply a strict token limit cutting body text at exactly 1,500 words.

#### **Step 6: AI API Pipeline Hook & Structured Output Mapping**

* Pass the sanitized XML payload block directly to the **Prompt Step 1** model configuration at a strict temperature \= 0.  
* Route the AI output string straight into AiClassificationOutputSchema.safeParse(). If parsing fails or the response hits the fallback definition (UNKNOWN), trigger the dedicated "Content-Level Failure" interface state mapping to a parked or coming-soon layout.

#### **Step 7: UI Router & Switch Assembly (Integrating New Stitch Designs)**

* Wire up the frontend layout controller to dynamically render the specific application panel matching the system state payload returned by your database or AI controller:  
  * *State A (Success):* Render the Emerald green state (\#34D399) and load the active dynamic strategy.  
  * *State B (Regret/Waitlist):* Expose the mid-level sub-industry string inside the structural text component and append the inline early-access email subscription wrapper.  
  * *State C (Parked Domain / Unknown):* Fall back to the newly introduced design layout alerting users that content could not be evaluated due to missing storefront components.  
  * *State D (Foreign Language / Unsupported Country):* Gracefully drop the domain context into the standardized waitlist collection panel for subsequent pipeline localization.

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>