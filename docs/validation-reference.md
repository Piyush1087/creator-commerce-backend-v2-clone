# Validation reference

**Date:** 2026-06-08

---

## auth

### API (`class-validator`)

| DTO | Field | Rules |
| --- | --- | --- |
| `LoginDto` | `email` | required, valid email |
| | `otp` | required string, length exactly 6 |
| | `role` | optional enum `UserRole` |
| `CompleteBrandRegistrationDto` | `brandProfileId` | required UUID |

---

## brand-onboarding

### Zod

**`IndustryGateGeminiSchema`** (Step 1 — Gemini industry gate)

| Field | Rules |
| --- | --- |
| `highLevelIndustry` | enum: `D2C`, `SAAS_AI`, `HEALTHCARE`, `OFFLINE_SERVICES`, `OTHER` |
| `otherIndustryDetail` | optional, max 160 chars, nullable |

**`Step2SurfaceScanGeminiSchema`** (Step 2 — Gemini surface scan)

| Field | Rules |
| --- | --- |
| `suggestedIndustry` | Prisma `IndustryVertical` enum |
| `brand.name` | min 1, max 200 |
| `brand.logoUrl` | optional URL, nullable |
| `brand.socialLinks` | array of URLs, max 8 (LLM-normalized) |
| `brand.tagline` | optional, max 300, nullable |
| `brand.shortDescription` | optional, max 500, nullable |
| `brand.subIndustry` | optional, max 200, nullable |
| `brand.industryNiche` | optional, max 200, nullable |
| `brand.primaryHexColors` | hex `#RGB` or `#RRGGBB`, max 5 |
| `brand.headingFont` / `bodyFont` | optional, max 120, nullable |
| `brand.toneTags` | string array, max 3 items, each max 80 chars |
| `brand.aestheticTags` | string array, max 2 items |
| `brand.audience.personaName` | optional, max 120 |
| `brand.audience.ageMin` / `ageMax` | optional int 13–99 |
| `brand.audience.traits` | string array, max 3 |
| `products[]` | max 6 items |
| `products[].type` | `OfferingType` enum |
| `products[].name` | min 1, max 200 |
| `products[].url` | valid URL |
| `products[].imageUrl` | optional URL |
| `products[].startingPriceLabel` | optional, max 120 |
| `products[].collectionOrCategory` | optional, max 200 |
| `activeOffers[]` | max 8; `name` max 200; `couponCode` max 80; `description` max 400 |
| `competitors[]` | max 5; `name` min 1 max 200; `websiteUrl` URL; `logoUrl` optional URL; `whyCompetitor` max 500 |
| `locations[]` | max 12; `address` max 500; `city` max 120; `zip` max 40 |

### API (`class-validator`)

| DTO | Field | Rules |
| --- | --- | --- |
| `DiscoverValidateRequestDto` | `url` | required string, trim, length 1–2048 |
| `DiscoverWaitlistRequestDto` | `email` | required email, max 320, trim + lowercase |
| | `industry` | required `IndustryVertical` enum |
| | `discoveryLeadId` | optional UUID v4 |
| | `marketIntelligenceLogId` | optional UUID v4 |
| | `sourceUrl` | optional string, trim, max 2048 |
| `SendBrandVerificationDto` | `email` | valid email, max 254 |
| `VerifyBrandVerificationDto` | `email` | valid email, max 254 |
| | `otp` | string, length exactly 6 |
| `SurfaceScanRequestDto` | `leadId` | UUID v4 |
| | `force` | optional boolean |
| `PatchBrandProfileDto` | `name` | optional, max 200 |
| | `tagline` | optional, max 300 |
| | `description` | optional, max 12000 |
| | `logoUrl` | optional URL or null |
| | `industry` | optional `IndustryVertical` |
| | `subIndustry` / `industryNiche` | optional, max 200 |
| | `visualIdentity` | optional object |
| | `brandValues` / `policyFlags` | optional string arrays |
| | `targetAudience` | optional object |

---

## brand-centre

### Zod

**`DeepScanPrompt1Schema`** (worker — Gemini deep scan)

| Section | Rules |
| --- | --- |
| `brandProfile` | optional; `logoUrl` URL; social handles optional strings |
| `strategicDNA.narrative.tagline` | min 5, max 255 |
| | `briefDescription` min 20 |
| | `brandUsps` exactly 3 strings, each min 2 |
| | `toneOfVoice` min 1 item |
| `strategicDNA.visuals` | `palette`, `fonts`, `aesthetics` each min 1 |
| `strategicDNA.complianceGuardrails.doNotSayList` | min 1 item |
| `audiencePersonas[]` | min 1; `personaName` min 2; demographics `geo`, `ageWindows`, `explicitInterests` each min 1 |
| `inventoryInfrastructure.entities[]` | min 1 when present; `entityType` enum PRODUCT/MODULE/TREATMENT/EXPERIENCE/COLLECTION; `entityName` min 2; `entityUrl` URL; `sellingPoints` exactly 3 strings min 2 |
| `offersLedger[]` | `offerName`/`promoCode`/`applicabilityScope` min 2; `validityStart`/`validityEnd` datetime |
| `growthImpactMatrix.projectedRevenueLiftPercentage` | 0–500 |
| `growthImpactMatrix.levers.*` | each 0–100 |
| `growthImpactMatrix.statusIndicator` | GREEN / YELLOW / RED |
| `baselineHealth.audienceOverlapPercentage` | 0–100 |
| `baselineHealth.contentQualityScore` | 0–10 |
| `baselineHealth.averageHookRate` | 0–100 |
| `baselineHealth.brandSafetyScore` | 0–100 |
| `baselineHealth.archetypeMatch.*` | four weights must sum to 100 |
| `shareOfVoice.ourBrandShare` | 0–100 |
| `financials.masterMonthlyBudget` | min 1 |
| `financials.strategyMix.assetMix` | product + collection + sale = 100 |
| `financials.strategyMix.tierMix` | nano + micro + midTier + mega + celebrity = 100 |
| `financials.strategyMix.objectiveMix` | pulse + proof + push + production = 100 |

**`IntelligenceLeakCardSchema`** / **`IntelligencePrompt2Schema`**

| Field | Rules |
| --- | --- |
| `insightTitle` | min 5 |
| `shortDescription20Words` | min 10, max 150 |
| `priorityRank` | HIGH / MEDIUM / LOW / NEGLIGIBLE |
| `leakBucket` | PDP / PAID / ROSTER / CREATIVE_HOOK |
| `performanceStatus` | GREEN / YELLOW / RED |
| `projectedLiftPercentage` | 1–100 |
| `drawerDeepDive.underlyingDataLogic` | min 20 |
| `drawerDeepDive.competitiveDiscrepancy` | min 20 |
| `drawerDeepDive.actionableStepsChecklist[]` | min 1; `stepLabel` min 5 |

**`PlannerPrompt3Schema`** (worker — planner cards)

| Field | Rules |
| --- | --- |
| `cardType` | NEW_CAMPAIGN / SUGGESTED_UPDATE / AUTO_PAUSE_LOG |
| `aggregationKey.objective` | PULSE / PROOF / PUSH / PRODUCTION |
| `aggregationKey.targetCreatorTier` | NANO / MICRO / MID_TIER / MEGA / CELEBRITY |
| `aggregationKey.aiContextHook` | min 5 |
| `existingTargetCampaignId` | UUID nullable; required non-null when `cardType` = SUGGESTED_UPDATE |
| `campaignMetadata.audienceDemographics.*` | geo/gender/age/interests arrays min 1 |
| `operationalBudgetParameters.minAllocationThreshold` | min 500 |
| `operationalBudgetParameters.maxAllocationThreshold` | min 500, ≥ min |
| `campaignArchitectureDeadline` | datetime |
| `assetsAndBriefsMatrix[]` | min 1; `entityName` min 2; `productionBriefs[]` min 1; `briefName` min 5; `contentPillarThemeCore` min 10; `requiredDeliverables[]` min 1 with `quantity` int ≥ 1 |
| `workflowStatus` | optional enum PENDING_USER_REVIEW / PROCEEDED_TO_PIPELINE / DISCARDED / AUTO_EXECUTED_BYPASS |

### API (`class-validator`)

| DTO | Field | Rules |
| --- | --- | --- |
| `PatchDnaProfileDto` | `logoUrl` | optional URL |
| | `brandName` | optional, min 2 |
| | social handles / `lifecycleStage` | optional strings |
| `PatchDnaNarrativeDto` | `tagline` | optional, 5–255 |
| | `briefDescription` | optional, min 20 |
| | `brandUsps` / `toneOfVoice` / `doNotSayList` | optional string arrays |
| `PatchDnaIdentityDto` | `palette` / `fonts` / `aesthetics` | optional string arrays |
| `CreatePersonaDto` | `personaName` | min 2 |
| | `demographicsJson` | required object |
| | `psychographicsText` | optional string |
| `UpdatePersonaDto` | all fields optional |
| `ScanUrlDto` | `url` | min 8 |
| `CreateOfferingDto` | `kind` | `primary` or `collection` |
| | `type` | `OfferingType` enum |
| | `name` | min 2 |
| | `url` | string |
| | `imageUrl` | optional URL |
| | `sellingPoints` / `doNotSay` | optional string arrays |
| `UpdateOfferingDto` | all optional |
| `CreateOfferDto` | `offerName` / `promoCode` / `applicabilityScope` | min 2 |
| | `validityStart` / `validityEnd` | strings |
| `CreateCompetitorDto` | `name` min 2; `websiteUrl` string; `logoUrl` optional URL |
| `PatchBudgetMixesDto` | `assetMix` / `tierMix` / `objectiveMix` | nested numbers (sums enforced in service) |
| `PatchBudgetCeilingDto` | `masterMonthlyBudget` | number |
| `PatchLeakDto` | `actionableStepsChecklist` | optional nested steps with `stepId`, `stepLabel`, `isCompleted` |
| | `isArchived` | optional boolean |
| `LeaksQueryDto` | `filter` | optional `active` or `archived` |
| `PatchPlannerCardDto` | `workflowStatus` | optional `PlannerWorkflowStatus` enum |

---

## brand-uce

### Zod

**Enums:** `UceCampaignStatus` DRAFT/ACTIVE/PAUSED/COMPLETED · `UceTimelineStructure` FIXED_DATES/DYNAMIC_MILESTONES · `UceCampaignObjective` BRAND_AWARENESS/TRAFFIC_CLICKS/SALES_CONVERSIONS · `UceCompensationType` FIXED_FEE/NEGOTIABLE · `UcePayoutTerms` IMMEDIATE/NET_7/NET_15/NET_30 · `UceMediaPlatform` INSTAGRAM/TIKTOK/YOUTUBE

**`Step1StrategySchema`**

| Field | Rules |
| --- | --- |
| `campaign_name` | min 3, max 255 |
| `timeline_type` | enum |
| `fixed_start_date` / `fixed_end_date` | optional ISO datetime; required when FIXED_DATES; start < end |
| `dynamic_days_limit` | optional positive int; required when DYNAMIC_MILESTONES |
| `core_objective` | enum |
| `platform_deliverables[]` | min 1; each has `platform` enum + `formats[]` min 1 |

**`Step2TargetingSchema`**

| Field | Rules |
| --- | --- |
| `industry_vertical` | min 1 |
| `creator_archetypes[]` | min 1 |
| `follower_tiers[]` | min 1 |
| `audience_age_min` | int ≥ 13 (FE: ≥ 18) |
| `audience_age_max` | int ≤ 65 |
| | `audience_age_min` ≤ `audience_age_max` |
| `audience_gender` | string, default ALL |
| `target_locations[]` | min 1 |
| `disqualifying_keywords` | optional string array, default [] |

**`Step3CommercialsSchema`**

| Field | Rules |
| --- | --- |
| `compensation_type` | enum |
| `fixed_fee_amount` | ≥ 0, default 0; must be > 0 when FIXED_FEE |
| `negotiable_min_fee` / `negotiable_max_fee` | ≥ 0; min < max; max > 0 when NEGOTIABLE |
| `total_campaign_budget_pool` | positive |
| `advance_payment_percentage` | int 30–100 |
| `final_balance_terms` | enum |

**`IntegratedCampaignWizardPayloadSchema`:** `strategy` + `targeting` + `commercials` (all above)

### API (`class-validator`)

| DTO | Field | Rules |
| --- | --- | --- |
| `ListCampaignsQueryDto` | `status` | optional `UceCampaignStatus` |
| | `search` | optional, max 255 |
| | `objective` | optional BRAND_AWARENESS / TRAFFIC_CLICKS / SALES_CONVERSIONS |
| `CreateCampaignWizardDto` | `strategy` / `targeting` / `commercials` | passthrough; **Zod validated in service** |
| `PatchCampaignStatusDto` | `status` | `UceCampaignStatus` enum |
| `PatchCampaignMasterDto` | `campaign_name` | optional, 3–255 |
| `CreateCampaignBriefDto` | `internal_title` | 5–255 |
| | `creative_guidelines` | min 20 |
| | `required_platforms[]` | min 1, each `UceMediaPlatform` |
| | `deliverable_format_tags[]` | min 1 strings |
| `UpdateCampaignBriefDto` | same fields, all optional with same min sizes when present |
| `CreateCampaignProductDto` | `sku_code` 2–150; `product_name` 1–255; `inventory_count` int ≥ 0; `cost_per_unit` ≥ 0.01; `image_url` optional URL |
| `UpdateCampaignProductDto` | same, all optional |
| `PipelineQueryDto` | `brief_id` optional UUID; `stage` optional `UceMilestoneStage`; `health` optional `UcePipelineHealthStatus`; `search` max 100 |
| `CreateProspectDto` | `brief_id` UUID; `product_id` optional UUID; `instagram_handle` 1–100; `creator_email` email; `match_score` optional 0–100 |
| `RejectApplicantDto` | `rejection_reason` 3–255 |
| `ApproveApplicantDto` | `product_id` optional UUID; `total_quote` optional ≥ 0 |
| `AddTrackingDto` | `logistics_carrier` 2–100; `logistics_tracking_number` 3–150 |
| `SubmitContentDraftDto` | `content_draft_url` URL |
| `ReviewContentDto` | `action` approve / request_revision / reject |
| `PublishLivePostDto` | `live_published_url` URL |
| `RecordFulfillmentIssueDto` | `remark` optional, max 255 |
| `PatchCollaborationStatusDto` | `collab_status` `UceCollabStatus` enum |
| `InviteProspectDto` | `outreach_message` optional, max 500 |

---

## brand-centre-uce-bridge

### Zod

**`InboundLaunchSignalSchema`** (`signal_type`: `LAUNCH_NEW_FRAMEWORK`)

| Field | Rules |
| --- | --- |
| `brand_id` | UUID |
| `campaign_name` | 3–255 |
| `industry_sector` | D2C_ECOMMERCE / HEALTHCARE / AI_SAAS / OFFLINE_EXPERIENCES |
| `assigned_macro_objective` | PRODUCTION / PULSE / PROOF_PUSH |
| `raw_budget_expression` | min 5 (parsed: rate × creators) |
| `timeline_expression` | min 4 (parsed: evergreen / fixed date / N days) |

**`InboundInjectSignalSchema`** (`signal_type`: `INJECT_ASSET_LINE`)

| Field | Rules |
| --- | --- |
| `campaign_id` | UUID |
| `product_name` | min 1 |
| `estimated_base_price` | ≥ 0 |
| `raw_strategic_context` | min 10 |
| `creative_briefs[]` | min 1; `brief_name` 3–150; `deliverable_type` enum REEL_VIDEO/TIKTOK_POST/YOUTUBE_SHORTS/IG_STORIES/UGC_RAW_ASSET; `compensation_type` FIXED_FEE/BARTER/REVENUE_SHARE/HYBRID_MILESTONE |

**`InboundInterruptSignalSchema`** (`signal_type`: `FAST_TRACK_INTERRUPT`)

| Field | Rules |
| --- | --- |
| `campaign_id` | UUID |
| `target_entity_type` | PRODUCT / BRIEF |
| `target_entity_uuid` | UUID |

**`UnifiedBridgeSignalProcessorSchema`:** discriminated union on `signal_type` (one of above)

---

## collaboration

### Zod

**`MasterCollabSchema`** (domain state machine)

| Area | Rules |
| --- | --- |
| IDs | `id`, `brand_id`, `creator_id`, `campaign_id`, `brief_id` — UUID |
| `stage` | NEGOTIATION / SECUREMENT / LOGISTICS / PRODUCTION / POSTING / ARCHIVAL / TERMINATED |
| `payout_mode` | ESCROW / MANUAL / BARTER |
| `industry` | D2C / SAAS / HEALTHCARE |
| `commercials` | `total_quote`, `advance_30`, `balance_70` ≥ 0; advance + balance ≈ total (±0.01); `round_count` 0–2 |
| | BARTER: all commercial amounts must be 0 |
| | MANUAL: `creator_bank_details_id` required |
| `logistics` | `fulfillment_issue_count` 0–2; ≥2 issues without `is_received_confirmed` → deadlock error |
| | D2C industry: `tracking_id` required (trim, min 1) |
| `production` | `revision_count` 0–2; ≥2 revisions + REJECTED → hard stop |
| | reel/story + `media_url` → `is_aspect_ratio_verified` required |
| `compliance` | `live_url` must be instagram/tiktok/youtube domain |
| | `is_70_payout_released` requires `is_link_verified` |

### API (`class-validator`)

| DTO | Field | Rules |
| --- | --- | --- |
| `ListCollaborationThreadsQueryDto` | `campaign_id` / `brief_id` | optional UUID |
| | `stage` | optional `UceMilestoneStage` |
| | `search` | optional, max 120 |
| `CreateCollaborationThreadDto` | `campaign_id`, `brief_id`, `creator_user_id` | UUID |
| | `product_id`, `uce_pipeline_collaboration_id` | optional UUID |
| | `payout_mode` | optional `CollaborationPayoutMode` |
| | `product_retail_value`, `initial_quote` | optional ≥ 0 |
| `PostCollaborationMessageDto` | `body` | 1–4000 |
| `SubmitCreatorQuoteDto` | `total_quote` | ≥ 0 |
| `BrandCounterOfferDto` | `counter_offer` | ≥ 0 |
| `AcceptCommercialsDto` | `final_quote` | optional ≥ 0 |
| `FundEscrowDto` | `escrow_vault_id` | optional, max 255 |
| `UploadReceiptDto` | `receipt_url` | URL |
| `DispatchLogisticsDto` | tracking/courier/credentials/redemption | optional strings with max lengths |
| `ReportFulfillmentIssueDto` | `issue_type` | `FulfillmentIssueType` enum |
| | `description` | 3–2000 |
| `SubmitCollaborationMediaDto` | `phase` | `CollaborationMediaPhase` enum |
| | `media_url` | URL |
| | `deliverable_type` | optional, max 50 |
| | `is_aspect_ratio_verified` | optional boolean |
| `ReviewCollaborationMediaDto` | `decision` | APPROVED / REJECTED |
| | `brand_feedback` | optional, max 2000 |
| `SubmitLivePostDto` | `live_post_url` | URL |
| | `partnership_ad_code` | optional, max 100 |
| `SubmitCollaborationReviewDto` | `rating` | int 1–5 |
| | `review_text` | optional, max 2000 |
| `UpsertCreatorBankDetailsDto` | holder/bank 2–120; account 4–40; IFSC/routing 4–20 |
| `UpsertCreatorShippingAddressDto` | recipient 2–120; address1 3–200; city 2–80; postal 3–20; optional state/country/phone |

---

## brand-escrow

### API (`class-validator`)

| DTO | Field | Rules |
| --- | --- | --- |
| `TopUpIntentDto` | `target_allocation` | number ≥ 0.01 |
| | `idempotency_key` | UUID |
| `CalculateEscrowBreakdownDto` | `gross_creator_quote` | ≥ 0.01 |
| | `currency` | INR or USD |
| | `expected_tds_percentage` | 0, 1, or 2 |
| `ExecuteLockAllocationDto` | `collaboration_id` | UUID |
| | `gross_creator_quote` | ≥ 0.01 |
| | `expected_tds_percentage` | 0, 1, or 2 |
| `ExecuteTrancheDisbursalDto` | `collaboration_id` | UUID |
| | `tranche` | ADVANCE_30 or FINAL_70 |
| `TransitionStageDto` | `collaboration_id` | UUID |
| | `target_stage` | `UceMilestoneStage` enum |
| `TriggerCancellationRefundDto` | `collaboration_id` | UUID |
| | `reason_code` | BR_03_LOGISTICS_STRIKE / BR_04_HARD_STOP_REJECTION / MUTUAL_TERMINATION |
| | `diagnostic_notes` | min 5 |
| `ListEscrowLedgerQueryDto` | `limit` | optional int 1–100 |

---

## pricing

### API (`class-validator`)

| DTO | Field | Rules |
| --- | --- | --- |
| `BootstrapTrialDto` | `currency` | optional INR or USD |
| `InitializeRazorpayTrialDto` | `currency` | optional INR or USD |
| `ChangeTierDto` | `target_tier` | `SubscriptionTier` enum (service: only GROWTH_STARTER, PROFESSIONAL) |
| `CancelSubscriptionDto` | `cancel_at_cycle_end` | optional boolean |

---

## creator-uce

### API (`class-validator`)

| DTO | Field | Rules |
| --- | --- | --- |
| `CreatorApplyToCampaignDto` | `brief_id` | UUID |
| | `product_id` | optional UUID |
| | `match_score` | optional 0–100 |

---

## creator-marketplace

### API (`class-validator` + Zod in service)

| DTO | Field | Rules |
| --- | --- | --- |
| `MarketplaceQueryDto` | `search_query` | optional, max 100 |
| | `niche` | optional, max 100 |
| | `deliverable_type` | optional enum: INSTAGRAM_REEL, INSTAGRAM_STORY, TIKTOK_VIDEO, YOUTUBE_SHORTS |
| | `show_match_eligible_only` | optional boolean |
| | `creator_tier` | optional array: NANO, MICRO, MID, MACRO, MEGA |
| | `target_geography` | optional ISO-2 string |
| | `production_timeline` | optional array: URGENT_PIPELINE, STANDARD_RUNWAY |

### Brand wizard (Zod) — new Step 2 fields

| Field | Rules |
| --- | --- |
| `visibility_scopes` | array min 1; EVERYONE, ELIGIBLE_ONLY, INVITED_ONLY; default `[EVERYONE]` |
| `application_scope` | enum; default `EVERYONE` |

---

## frontend — brand-onboarding

### Zod

**`urlSchema`**

| Rule |
| --- |
| min 1 char |
| regex: valid http(s) domain |
| reject instagram.com, tiktok.com, amazon.com, facebook.com |

**`brandDnaFormSchema`**

| Field | Rules |
| --- | --- |
| `brandName` | min 1 |
| `tagline` | optional |
| `description` | optional, max 500 |
| `personaName` | optional |

### Session shape (manual parse)

| Field | Rules |
| --- | --- |
| `leadId` | string |
| `brandProfileId` | string |
| `normalizedUrl` | string |

---

## frontend — uce (campaign wizard)

### Zod

Same schemas as backend **`uce-wizard.schema.ts`** (`Step1StrategySchema`, `Step2TargetingSchema`, `Step3CommercialsSchema`, `IntegratedCampaignWizardPayloadSchema`).

**Frontend-only differences**

| Field | Backend | Frontend |
| --- | --- | --- |
| `audience_age_min` | int ≥ 13 | int ≥ 18 |

**Validation entry points**

| Function | When |
| --- | --- |
| `validateCampaignWizardStep(1\|2\|3)` | per wizard step |
| `validateFullCampaignWizard()` | publish / integrated submit |

---

## frontend — API response guards (runtime)

| Module | Guards |
| --- | --- |
| `auth` | `isAuthTokenResponse` |
| `brand-onboarding` | `isSurfaceScanResponse`, `isBrandProfileResponse`, `isDiscoverValidateResponse`, `isDiscoveryResolveResponse`, `isDiscoverWaitlistResponse` |
| `brand-centre` | `isBrandCentreDnaResponse`, `isBrandCentreBudgetResponse`, `isBrandCentreAccountResponse`, `isBrandCentreScanStatusResponse`, `isBrandCentreIntelligenceResponse`, `isBrandCentrePlannerDashboardResponse` |
| `brand-escrow` | `isEscrowVaultApiResponse`, `isEscrowLedgerApiResponse`, `isEscrowTopUpIntentApiResponse`, `isEscrowBreakdownApiResponse` |
| `pricing` | `isPlansApiResponse`, `isSubscriptionApiResponse`, `isUsageApiResponse`, `isGeoContextApiResponse`, `isInvoicesApiResponse` |
