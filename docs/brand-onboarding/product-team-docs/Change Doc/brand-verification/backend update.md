// \============================================================================  
// UPGRADED BRANDPROFILE MODEL (v3.6 Unified Core)  
// \============================================================================  
model BrandProfile {  
  id                     String             @id @default(cuid())  
  // ... existing core fields (domain, industry, logo\_url)

  // \--- BRAND VERIFICATION & DATA SECURITY (v3.6) \---  
  is\_verified            Boolean            @default(false)  
  verified\_at            DateTime?  
  verification\_email     String?            // Stores the validated email from either OTP or Google OAuth  
    
  // NEW SECURITY COLUMN: Populated across BOTH paths (OTP & Google Sign-In)   
  // during the final workspace password creation gate.  
  accountPasswordHash    String?

  // Relation to Phase 2 data (Locked until is\_verified is true)  
  deep\_intel\_status      IntelStatus        @default(PENDING)

  // FLUID PROGRESS CHECKS: Drives individual UI checklist components dynamically  
  surface\_scan\_complete  Boolean            @default(false) // Drives "\[Checkmark\] Surface Scan"  
  brand\_identity\_curated Boolean            @default(false) // Drives "\[Checkmark\] Brand Identity"\[cite: 5\]

  // \--- SOCIAL CONNECTIONS & SYNC EXTENSIONS \---  
  meta\_connected         Boolean            @default(false)\[cite: 8\]  
  meta\_access\_token      String?            // Encrypted at rest\[cite: 8\]  
  meta\_page\_id           String?\[cite: 8\]  
  meta\_business\_id       String?\[cite: 8\]

  // \--- RELATION PLUMBING \---  
  verification\_codes     VerificationCode\[\] // Prevents orphaned logs on account lifecycles\[cite: 5\]  
  invitations            TeamInvitation\[\]   // Links pending and active seat delegations\[cite: 8\]  
}

enum IntelStatus {  
  PENDING\[cite: 5\]  
  PROCESSING\[cite: 5\]  
  COMPLETED\[cite: 5\]  
  FAILED\[cite: 5\]  
}

// \============================================================================  
// VERIFICATIONCODE MODEL (Path A Identity Auditing)  
// \============================================================================  
model VerificationCode {  
  id                  String       @id @default(cuid())\[cite: 5\]  
  brand\_id            String\[cite: 5\]  
  brand               BrandProfile @relation(fields: \[brand\_id\], references: \[id\], onDelete: Cascade)\[cite: 5\]  
    
  email               String       // Explicit column for targeted logging and audit validation\[cite: 5\]  
  code                String       // Store as a hashed value in production environment layouts\[cite: 5\]  
  expiresAt           DateTime\[cite: 5\]  
    
  // STATE COUNTERS: Decouples guessing locks from generation limits  
  failed\_attempts     Int          @default(0) // Track wrong submissions (Max 3, triggers LOCKED state)\[cite: 5\]  
  generation\_count    Int          @default(1) // Track clicks within 60 seconds (Max 3, triggers COOL-DOWN)\[cite: 5\]  
    
  createdAt           DateTime     @default(now())\[cite: 5\]

  @@index(\[brand\_id, email\])\[cite: 5\]  
}

// \============================================================================  
// ORIGINAL TEAM INVITATION MODEL   
// \============================================================================  
model TeamInvitation {  
  id          String       @id @default(cuid())\[cite: 8\]  
  email       String\[cite: 8\]  
  role        String       @default("ADMIN")\[cite: 8\]  
  status      String       @default("PENDING") // PENDING, ACCEPTED, EXPIRED\[cite: 8\]  
  brandId     String\[cite: 8\]  
  brand       BrandProfile @relation(fields: \[brandId\], references: \[id\])\[cite: 8\]  
  token       String       @unique // Secure invite link\[cite: 8\]  
  createdAt   DateTime     @default(now())\[cite: 8\]  
  expiresAt   DateTime\[cite: 8\]  
}

