# Schema Comparison: Product Proposal vs. Backend Implementation

This document outlines the differences between the conceptual schema in the product documentation (Steps 1-8) and the finalized backend implementation in `schema.prisma`.

## Overview of Changes

The backend implementation adopts an **Organization-centric** architecture, ensuring that brand team members share access to the profile, offerings, and subscription data. We have also added specific models and fields to support the operational requirements of the 8-step flow (OTP verification, usage tracking, and team management).

## Detailed Comparison

### 1. The Core Model: `BrandProfile`

**Backend Enhancements:**
- **Org Linkage:** Tied to an `Organization` model to support multi-user teams.
- **Verification Details (Step 6):** Added `verifiedAt` and `verificationEmail` to track the exact timestamp and authority for domain ownership.
- **Deep Intel Status (Step 7):** Added `deepIntelStatus` (Enum: PENDING, PROCESSING, COMPLETED, FAILED) to track the strategic AI analysis separately from the surface scan.
- **Regional & Subscription Context (Step 8):** Added `countryCode`, `currencyCode`, `planType`, and `subscriptionStatus` to finalize the onboarding journey.
- **Usage Tracking:** Added `deepScanCount`, `competitorCount`, and `outreachCount` as a beta buffer to manage platform costs.
- **Audit Trail:** Uses `isUserEdited` (JSON) to protect manual user edits from being overwritten by subsequent AI scans.

### 2. Verification Management (Step 6)

**Backend Model: `VerificationCode`**
- Provides the persistence layer for the 6-digit OTP flow.
- Supports an `identifier` (flexible for email or ID) and `attempts` tracking for security and rate limiting.

### 3. Team & Subscription Lifecycle (Step 8)

**Backend Model: `TeamInvitation`**
- Not explicitly detailed in the step-by-step UI docs but required for the "Invite Team" functionality at the end of onboarding.
- Uses secure tokens and role-based access.
- Is basic integration as per onboarding document and will be updated.

**Backend Model: `Subscription`**
- A simplified version of the billing ecosystem to handle the "Beta" phase where credit cards aren't required yet.
- Is basic integration as per onboarding document and will be updated.

## Summary

The implementation fully realizes the product's vision while adding the necessary backend infrastructure to handle asynchronous AI jobs (Deep Intel), security (OTP), and team collaboration (Invitations).
