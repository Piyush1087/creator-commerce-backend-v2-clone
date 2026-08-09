-- Brand onboarding + lifecycle (depends on init_discovery_and_users)

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'SURFACE_COMPLETE', 'VERIFIED', 'DEEP_SCAN_IN_PROGRESS', 'READY');

-- CreateEnum
CREATE TYPE "OfferingType" AS ENUM ('PRODUCT', 'TREATMENT', 'SERVICE', 'COLLECTION');

-- CreateEnum
CREATE TYPE "IntelStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE_TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateTable
CREATE TABLE "brand_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "domain" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "industry" "IndustryVertical" NOT NULL,
    "sub_industry" TEXT,
    "industry_niche" TEXT,
    "logo_url" TEXT,
    "tagline" TEXT,
    "description" TEXT,
    "visual_identity" JSONB,
    "brand_values" TEXT[],
    "policy_flags" TEXT[],
    "target_audience" JSONB,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verification_email" TEXT,
    "scan_status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "deep_intel_status" "IntelStatus" NOT NULL DEFAULT 'PENDING',
    "country_code" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "plan_type" "PlanType" NOT NULL DEFAULT 'FREE_TRIAL',
    "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trial_ends_at" TIMESTAMP(3),
    "deep_scan_count" INTEGER NOT NULL DEFAULT 0,
    "competitor_count" INTEGER NOT NULL DEFAULT 0,
    "outreach_count" INTEGER NOT NULL DEFAULT 0,
    "is_user_edited" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offerings" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "type" "OfferingType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "offering_url" TEXT NOT NULL,
    "price_amount" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "location_ids" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deep_scanned" BOOLEAN NOT NULL DEFAULT false,
    "is_user_edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "zip" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "contact_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitors" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website_url" TEXT NOT NULL,
    "logo_url" TEXT,
    "social_handles" TEXT[],
    "why_competitor" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 99.00,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "brand_profile_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_profiles_organization_id_key" ON "brand_profiles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_profiles_domain_key" ON "brand_profiles"("domain");

-- CreateIndex
CREATE INDEX "verification_codes_identifier_idx" ON "verification_codes"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "team_invitations_token_key" ON "team_invitations"("token");

-- AddForeignKey
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
