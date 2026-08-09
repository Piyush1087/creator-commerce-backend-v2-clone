// \============================================================================  
// 1\. STATE ENUMS FOR DYNAMIC DATA PRESENTATION  
// \============================================================================

enum DesignTheme {  
  MINIMAL\_STARK  
  EDITORIAL\_LUXE  
  CYBER\_TECH  
  VIBRANT\_KINETIC  
  PASTEL\_MINIMAL  
}

enum IndustryVertical {  
  D2C  
  SAAS\_AI  
  HEALTHCARE  
  MEDIA  
  ENTERTAINMENT  
  UNKNOWN  
}

// \============================================================================  
// 2\. INTERFACE DATA LAYOUT MODELS  
// \============================================================================

model UserProfile {  
  id                   String            @id @default(uuid())  
  userId               String            @unique @map("user\_id")  
  user                 User              @relation(fields: \[userId\], references: \[id\], onDelete: Cascade)  
    
  // Custom Metadata Layer Cached from Meta Graph Scans  
  displayName          String?           @map("display\_name") @db.VarChar(150)  
  totalReachCache      Int               @default(0) @map("total\_reach\_cache")  
  engagementRateCache  Decimal           @default(0.00) @map("engagement\_rate\_cache") @db.Decimal(5, 2\)  
  topLocationCache     String?           @map("top\_location\_cache") @db.VarChar(100)  
    
  // Workspace Layout Configuration Toggles (Visibility Settings Sandbox)  
  showTotalReach       Boolean           @default(true) @map("show\_total\_reach")  
  showEngagementRate   Boolean           @default(true) @map("show\_engagement\_rate")  
  showViewsMetric      Boolean           @default(true) @map("show\_views\_metric")  
  showRatesColumn      Boolean           @default(true) @map("show\_rates\_column")  
    
  // Structural Design Parameters  
  activeTheme          DesignTheme       @default(MINIMAL\_STARK) @map("active\_theme")  
  aiGeneratedTagline   String?           @map("ai\_generated\_tagline") @db.Text  
  customBioOverride    String?           @map("custom\_bio\_override") @db.Text  
    
  // Direct Static Price Parameters   
  shortFormVideoRate   Decimal           @default(0.00) @map("short\_form\_video\_rate") @db.Decimal(12, 2\)  
  storyBundleRate      Decimal           @default(0.00) @map("story\_bundle\_rate") @db.Decimal(12, 2\)  
    
  pastBrandLogos       String\[\]          @default(\[\]) @map("past\_brand\_logos") // S3 Public Asset URLs  
    
  createdAt            DateTime          @default(now()) @map("created\_at")  
  updatedAt            DateTime          @updatedAt @map("updated\_at")

  @@map("user\_profiles")  
}

model HistoricChatThread {  
  id                String            @id @default(uuid())  
  userId            String            @map("user\_id")  
  user              User              @relation(fields: \[userId\], references: \[id\], onDelete: Cascade)  
    
  threadTitle       String            @map("thread\_title") @db.VarChar(255)  
  lastActiveAt      DateTime          @default(now()) @map("last\_active\_at")  
  messagesJson      Json              @map("messages\_json") // Implements structural chat conversation arrays  
    
  createdAt         DateTime          @default(now()) @map("created\_at")  
  updatedAt         DateTime          @updatedAt @map("updated\_at")

  @@index(\[userId\])  
  @@index(\[lastActiveAt\])  
  @@map("historic\_chat\_threads")  
}

model MetricPostPulse {  
  id                String            @id @default(uuid())  
  userId            String            @map("user\_id")  
  user              User              @relation(fields: \[userId\], references: \[id\], onDelete: Cascade)  
    
  // Immutable Platform Keys Copied from Meta API Nodes  
  metaPostId        String            @unique @map("meta\_post\_id") @db.VarChar(150)  
  postType          String            @map("post\_type") @db.VarChar(50) // e.g., 'REEL', 'IMAGE'  
  mediaThumbnailUrl String            @map("media\_thumbnail\_url") @db.Text  
  captionContent    String?           @map("caption\_content") @db.Text  
  publishedAt       DateTime          @map("published\_at")  
    
  // Velocity Performance Analytics Scalars  
  viewsCount        Int               @default(0) @map("views\_count")  
  impressionsCount  Int               @default(0) @map("impressions\_count")  
  savesCount        Int               @default(0) @map("saves\_count")  
  sharesCount       Int               @default(0) @map("shares\_count")  
  engagementDelta   Decimal           @map("engagement\_delta") @db.Decimal(7, 2\) // e.g., \+420.00%  
    
  // Processing Output from Parallel AI / Gemini Analysis Layers  
  aiPerformanceNote String?           @map("ai\_performance\_note") @db.Text  
    
  createdAt         DateTime          @default(now()) @map("created\_at")  
  updatedAt         DateTime          @updatedAt @map("updated\_at")

  @@index(\[userId\])  
  @@index(\[publishedAt\])  
  @@map("metric\_post\_pulses")  
}  
