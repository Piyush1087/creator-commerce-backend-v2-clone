### **🛠️ PostgreSQL DDL Database Schema Migration Script**

This script instantiates the database schema extensions required to run the onboarding funnel for **The Creator Shop**, cleanly building upon the schema models you uploaded.  
It introduces custom tracking types, setting strict parameter limits to prevent user abuse (the **5-validation cap** via IP footprint logging), caching public meta-structures, mapping interactive checkboxes to relational database fields, and preserving an entry point for your future premium subscription engine.  
SQL  
// \============================================================================  
// 1\. EXTRA CORES & STATE MACHINE ENUMS  
// \============================================================================

enum OnboardingStatus {  
  HANDLE\_INPUTTED  
  ELIGIBILITY\_CALCULATED  
  FEATURES\_STAGED  
  ACCOUNT\_CREATED  
  OTP\_VERIFIED  
  META\_OAUTH\_SUCCESS  
  AI\_ENGINE\_SYNCED  
  WAITLISTED  
}

enum ActivatedModule {  
  MESSY\_DMS\_TO\_DEALS  
  BUILDING\_UPDATING\_MEDIA\_KIT  
  POST\_PERFORMANCE\_PRICING  
  CONTRACT\_ESCROW\_SECURITY  
}

// \============================================================================  
// 2\. CORE TRACKING, SECURITY, AND SYSTEM BOUNDARY MODELS  
// \============================================================================

model CreatorOnboardingTrack {  
  id                    String             @id @default(uuid())  
  instagramHandle       String             @map("instagram\_handle") @db.VarChar(150)  
    
  // Unique immutable identifier extracted from the native Instagram Graph API   
  // to intercept and strictly block duplicate account mappings deterministically.  
  instagramMetaId       String?            @unique @map("instagram\_meta\_id") @db.VarChar(100)  
    
  status                OnboardingStatus   @default(HANDLE\_INPUTTED)  
    
  // Diagnostic Evaluation Metrics (Populated by Gemini Flash / Parallel AI)  
  eligibilityScore      Int                @default(0) @map("eligibility\_score")  
  percentileRank        Decimal?           @map("percentile\_rank") @db.Decimal(5, 2\)  
  isApproved            Boolean            @default(false) @map("is\_approved")  
  detectedVertical      IndustryVertical   @default(UNKNOWN) @map("detected\_vertical")  
    
  // Security layout flag to intercept claimed active profiles via hidden recovery route  
  isExistingUserRoute   Boolean            @default(false) @map("is\_existing\_user\_route")  
    
  // List tracking interactive modules selected in the pre-signup wizard checklist  
  stagedModules         ActivatedModule\[\]  @default(\[\]) @map("staged\_modules")  
    
  // Network Security Anti-Abuse Trace Footprints  
  clientIp              String             @map("client\_ip") @db.VarChar(100)  
  userAgent             String?            @map("user\_agent") @db.Text  
    
  // Multi-tier Relational Integrity Mapping  
  userId                String?            @unique @map("user\_id")  
  user                  User?              @relation(fields: \[userId\], references: \[id\], onDelete: Cascade)  
  waitlistLeadId        String?            @unique @map("waitlist\_lead\_id")  
  waitlistLead          WaitlistLead?      @relation(fields: \[waitlistLeadId\], references: \[id\], onDelete: SetNull)  
    
  createdAt             DateTime           @default(now()) @map("created\_at")  
  updatedAt             DateTime           @updatedAt @map("updated\_at")

  @@index(\[instagramHandle\])  
  @@index(\[status\])  
  @@index(\[clientIp\])  
  @@index(\[createdAt\])  
  @@map("creator\_onboarding\_tracks")  
}

model IpValidationLimit {  
  clientIp         String   @id @map("client\_ip") @db.VarChar(100)  
  validationCount  Int      @default(1) @map("validation\_count")  
  firstAttemptAt   DateTime @default(now()) @map("first\_attempt\_at")  
  lastAttemptAt    DateTime @default(now()) @map("last\_attempt\_at")

  @@map("ip\_validation\_limits")  
}

model EmailOtpVerification {  
  id             String   @id @default(uuid())  
  email          String   @db.VarChar(255)  
  hashedOtp      String   @map("hashed\_otp") @db.VarChar(128)  
  attemptsCount  Int      @default(0) @map("attempts\_count")  
  maxAttempts    Int      @default(5) @map("max\_attempts")  
  expiresAt      DateTime @map("expires\_at")  
  createdAt      DateTime @default(now()) @map("created\_at")

  @@index(\[email\])  
  @@map("email\_otp\_verifications")  
}

### **📋 Complete Journey Summary Blueprint**

Here is the exact structural orchestration of **The Creator Shop** pre-signup onboarding flow architecture established across our workshop configurations:

1. **The Hero Check:** The user lands and types an open handle (@) into a responsive input element. The background running via **Parallel AI or Gemini Flash** queries metrics or parses patterns, tracking usage metrics to actively lock inputs if an IP session breaks beyond **5 total validations**.  
2. **The Status Forking Split:** \* **Approved tracks** show dynamic stats and high percentile scoring layout states.  
   * **Rejected/personal accounts** gracefully pivot to an exclusivity waiting list layout.  
3. **The Simplified Module Selection Modal:** Approved users bypass long, complicated dashboard previews. They are shown a single, clean checklist card with clear checkboxes. They pick the target tools they wish to stage for deployment (or use the one-click Select All macro action).  
4. **The Split Authentication Card:** A 50/50 split horizontal column layout locks a background visualization screen on the left, capturing their *Staged Engine Modules*. The right panel accepts personal or corporate email credentials, routing users straight into an active 6-box inline OTP verification screen.  
5. **The Pre-OAuth Privacy Bridge Modal:** Right before jumping users to Facebook's external popup domain, a compact security brief eliminates high drop-off risks by clarifying that permissions are strictly **100% Read-Only** and that **The Creator Shop** never intercepts personal login information.  
6. **The Meta OAuth Resolution Engine:** Valid login redirects present a list of eligible creator assets. If the profile connected is a personal page, a built-in troubleshooting tab array changes instantly to show clear, human instructions on how to switch to a Professional account in 30 seconds.  
7. **The Intentionally Paused Activation Gateway:** Once connected, the interface pauses to summarize the system configuration, giving the user a prominent activation CTA button to click. This deliberate action highlights the premium value of the backend compute cycles, setting up an open transition point for future premium pricing modules before launching the background background loop.

