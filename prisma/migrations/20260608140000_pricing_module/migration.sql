-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'HALTED';

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FOUNDERS_BETA', 'GROWTH_STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionCurrency" AS ENUM ('INR', 'USD');

-- CreateTable
CREATE TABLE "brand_subscriptions" (
    "subscription_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FOUNDERS_BETA',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "currency" "SubscriptionCurrency" NOT NULL DEFAULT 'USD',
    "razorpay_customer_id" TEXT,
    "razorpay_subscription_id" TEXT,
    "razorpay_plan_id" TEXT,
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_subscriptions_pkey" PRIMARY KEY ("subscription_id")
);

-- CreateTable
CREATE TABLE "feature_usages" (
    "usage_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "current_usage_count" INTEGER NOT NULL DEFAULT 0,
    "reset_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_usages_pkey" PRIMARY KEY ("usage_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_subscriptions_brand_id_key" ON "brand_subscriptions"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_subscriptions_razorpay_subscription_id_key" ON "brand_subscriptions"("razorpay_subscription_id");

-- CreateIndex
CREATE INDEX "brand_subscriptions_brand_id_idx" ON "brand_subscriptions"("brand_id");

-- CreateIndex
CREATE INDEX "brand_subscriptions_status_idx" ON "brand_subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "feature_usages_subscription_id_feature_key_key" ON "feature_usages"("subscription_id", "feature_key");

-- AddForeignKey
ALTER TABLE "brand_subscriptions" ADD CONSTRAINT "brand_subscriptions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_usages" ADD CONSTRAINT "feature_usages_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "brand_subscriptions"("subscription_id") ON DELETE CASCADE ON UPDATE CASCADE;
