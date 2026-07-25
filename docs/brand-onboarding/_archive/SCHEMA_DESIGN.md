# Database Schema Design: Brand Onboarding & Lifecycle

This document defines the relational structure for the brand onboarding journey (Steps 1 through 8) and initial post-onboarding lifecycle (Teams & Subscriptions), aligning with the organization-centric model.

## Core Models

### BrandProfile

The central entity for a brand's identity and strategy. Tied 1:1 to an `Organization`.

- `id`: UUID
- `organizationId`: FK -> `Organization.id`
- `domain`: String (Unique, root domain)
- `name`: String
- `logoUrl`: String?
- `tagline`: String?
- `description`: Text?
- `industry`: IndustryVertical
- `subIndustry`: String?
- `industryNiche`: String?
- `visualIdentity`: JSON (colors, fonts, tone)
- `brandValues`: String[]
- `policyFlags`: String[]
- `targetAudience`: JSON
- `isVerified`: Boolean (Default: false) - *Step 6 Completion*
- `verifiedAt`: DateTime?
- `verificationEmail`: String?
- `scanStatus`: ScanStatus (Enum)
- `deepIntelStatus`: IntelStatus (Enum) - *Step 7/8 Phase 2 Progress*
- `countryCode`: String? (Regional Context)
- `currencyCode`: String (Default: "USD")
- `planType`: PlanType (FREE_TRIAL, STARTER, etc.)
- `subscriptionStatus`: SubscriptionStatus (TRIALING, ACTIVE, etc.)
- `trialEndsAt`: DateTime?
- `deepScanCount`: Int (Usage Tracking)
- `competitorCount`: Int (Usage Tracking)
- `outreachCount`: Int (Usage Tracking)
- `isUserEdited`: JSON (Map of fields edited by user)

### Offering (Step 4)

Products, treatments, or services belonging to a brand.

- `id`: UUID
- `brandProfileId`: FK -> `BrandProfile.id`
- `type`: OfferingType
- `name`: String
- `description`: Text?
- `imageUrl`: String?
- `url`: String
- `priceAmount`: Decimal?
- `currency`: String (Default: "USD")
- `locationIds`: String[]
- `isActive`: Boolean (Default: true)
- `isDeepScanned`: Boolean (Default: false)
- `isUserEdited`: Boolean (Default: false)

### Location (Step 2/4)

Physical presence for Healthcare or Offline Services.

- `id`: UUID
- `brandProfileId`: FK -> `BrandProfile.id`
- `name`: String?
- `address`: String
- `city`: String?
- `zip`: String?
- `lat`: Float?
- `lng`: Float?
- `contactDetails`: JSON

### Competitor (Step 5)

Market rivals and strategic comparison.

- `id`: UUID
- `brandProfileId`: FK -> `BrandProfile.id`
- `name`: String
- `websiteUrl`: String
- `logoUrl`: String?
- `socialHandles`: String[]
- `whyCompetitor`: Text?
- `isActive`: Boolean (Default: true)

### VerificationCode (Step 6)

Manages the email OTP flow.

- `id`: UUID
- `identifier`: String (Email or Brand ID)
- `code`: String
- `expiresAt`: DateTime
- `attempts`: Int
- `isUsed`: Boolean

### Subscription (Step 8 Logic)

Beta subscription tracking.

- `id`: UUID
- `brandProfileId`: FK -> `BrandProfile.id`
- `stripeCustomerId`: String?
- `amount`: Float (Default: 99.00)
- `currency`: String (Default: "USD")

### TeamInvitation

Brand team collaboration management.

- `id`: UUID
- `email`: String
- `role`: String (Default: "ADMIN")
- `status`: String (PENDING, ACCEPTED, EXPIRED)
- `brandProfileId`: FK -> `BrandProfile.id`
- `token`: String (Unique invite link)
- `expiresAt`: DateTime

## Enums

- **ScanStatus**: PENDING, SURFACE_COMPLETE, VERIFIED, DEEP_SCAN_IN_PROGRESS, READY
- **IntelStatus**: PENDING, PROCESSING, COMPLETED, FAILED
- **PlanType**: FREE_TRIAL, STARTER, PROFESSIONAL, ENTERPRISE
- **SubscriptionStatus**: TRIALING, ACTIVE, PAST_DUE, CANCELED
- **OfferingType**: PRODUCT, TREATMENT, SERVICE, COLLECTION

## Relationships

- `Organization` (1) --- (1) `BrandProfile`
- `BrandProfile` (1) --- (N) `Offering`, `Location`, `Competitor`, `Subscription`, `TeamInvitation`
- `User` (N) --- (1) `Organization`
