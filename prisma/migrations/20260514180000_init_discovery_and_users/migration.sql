-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BRAND', 'INFLUENCER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DiscoveryLeadStatus" AS ENUM ('PENDING', 'VALIDATING', 'IDENTIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IndustryVertical" AS ENUM ('D2C', 'SAAS_AI', 'HEALTHCARE', 'OFFLINE_SERVICES', 'REAL_ESTATE', 'B2B_AGENCY', 'MEDIA', 'EDUCATION', 'ENTERTAINMENT', 'UNKNOWN', 'GAMBLING', 'ADULT', 'FRAUDULENT_HIGH_RISK');

-- CreateEnum
CREATE TYPE "MarketIntelRejectionType" AS ENUM ('UNSUPPORTED_NICHE', 'GARBAGE_ENTRY', 'BLOCKED_PLATFORM', 'SECURITY_RISK');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_leads" (
    "id" TEXT NOT NULL,
    "raw_url" TEXT NOT NULL,
    "normalized_url" TEXT NOT NULL,
    "status" "DiscoveryLeadStatus" NOT NULL DEFAULT 'PENDING',
    "is_supported" BOOLEAN NOT NULL DEFAULT false,
    "industry" "IndustryVertical",
    "sub_industry" TEXT,
    "industry_niche" TEXT,
    "security_score" INTEGER NOT NULL DEFAULT 0,
    "meta_handshake" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_intelligence_logs" (
    "id" TEXT NOT NULL,
    "domain_name" TEXT NOT NULL,
    "detected_industry" "IndustryVertical" NOT NULL,
    "rejection_type" "MarketIntelRejectionType" NOT NULL,
    "geo_location" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "last_attempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_intelligence_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_leads" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "industry_interest" "IndustryVertical" NOT NULL,
    "is_notified" BOOLEAN NOT NULL DEFAULT false,
    "discovery_lead_id" TEXT,
    "market_intelligence_log_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_leads_normalized_url_key" ON "discovery_leads"("normalized_url");

-- CreateIndex
CREATE INDEX "discovery_leads_created_at_idx" ON "discovery_leads"("created_at");

-- CreateIndex
CREATE INDEX "discovery_leads_user_id_idx" ON "discovery_leads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "market_intelligence_logs_domain_name_key" ON "market_intelligence_logs"("domain_name");

-- CreateIndex
CREATE INDEX "market_intelligence_logs_last_attempt_idx" ON "market_intelligence_logs"("last_attempt");

-- CreateIndex
CREATE INDEX "waitlist_leads_email_idx" ON "waitlist_leads"("email");

-- CreateIndex
CREATE INDEX "waitlist_leads_discovery_lead_id_idx" ON "waitlist_leads"("discovery_lead_id");

-- CreateIndex
CREATE INDEX "waitlist_leads_market_intelligence_log_id_idx" ON "waitlist_leads"("market_intelligence_log_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_leads" ADD CONSTRAINT "discovery_leads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_leads" ADD CONSTRAINT "waitlist_leads_discovery_lead_id_fkey" FOREIGN KEY ("discovery_lead_id") REFERENCES "discovery_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_leads" ADD CONSTRAINT "waitlist_leads_market_intelligence_log_id_fkey" FOREIGN KEY ("market_intelligence_log_id") REFERENCES "market_intelligence_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
