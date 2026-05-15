# Brand Onboarding Journey (Backend)

This document outlines the backend implementation and flow for the 8-step brand onboarding process.

## Journey Overview

1.  **Step 1: Root Identity Capture** - Capturing the website URL and initial triage.
2.  **Step 2: Surface Scan** - AI-driven extraction of logos, names, and basic product/competitor lists (Low latency).
3.  **Step 3: Brand DNA Review** - User reviews and refines brand identity, visual style, and audience persona.
4.  **Step 4: Product Catalogue** - User manages products, treatments, or services identified during the scan.
5.  **Step 5: Competitive Landscape** - User confirms top competitors and the "Why" behind the rivalry.
6.  **Step 6: Domain Verification** - Email-based OTP verification to prove domain ownership.
7.  **Step 7: Deep Intel Scan** - Post-verification background processing for deep strategy extraction (USPs, KSPs, Compliance).
8.  **Step 8: Completion & Dashboard** - Finalizing the profile and unlocking full platform features.

## Architecture

- **Organization-Centric**: A `BrandProfile` is owned by an `Organization`.
- **User Roles**: Brand users are linked to an `Organization`.
- **Atomic Updates**: Field-level updates during review steps to prevent data loss.
- **Scan Phases**:
    - **Surface Scan**: Rapid, top-level discovery (Steps 2-5).
    - **Deep Scan**: Thorough analysis triggered after Step 6 (Verification).

## Database Schema

See [SCHEMA_DESIGN.md](./SCHEMA_DESIGN.md) for detailed model definitions.

## Implementation tracking

See [IMPLEMENTATION_TRACKING.md](./IMPLEMENTATION_TRACKING.md) for phased work, decisions, and checklist items (sync with product docs under `docs/product-team-docs/brand-onboarding`). Prompt + scan pipeline cheat sheet: [SURFACE_SCAN_AND_PROMPTS.md](./SURFACE_SCAN_AND_PROMPTS.md).

## API entry points

- [ENTRY_RESOLVER.md](./ENTRY_RESOLVER.md) — read-only `POST /api/v1/discovery/resolve` before `validate`.
- [AI_GUARDRAILS.md](./AI_GUARDRAILS.md) — Parallel + Gemini safety and hygiene (living).
- [SURFACE_SCAN_AND_PROMPTS.md](./SURFACE_SCAN_AND_PROMPTS.md) — **where to edit prompts**, how Parallel/Gemini scan runs, cache vs `force`, and check order.

## Frontend (v2) — deferred checklist

- [FRONTEND_REQUIREMENTS.md](./FRONTEND_REQUIREMENTS.md) — env usage without secrets, removal of mocks and **fallback** static data, and **Step 4 catalogue** templates (D2C / Healthcare / Offline + industry mapping).
