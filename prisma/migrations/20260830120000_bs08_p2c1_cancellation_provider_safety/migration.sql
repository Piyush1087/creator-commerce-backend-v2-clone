ALTER TABLE "brand_subscriptions"
ADD COLUMN "provider_cancellation_state" TEXT,
ADD COLUMN "continuation_razorpay_subscription_id" TEXT,
ADD COLUMN "continuation_razorpay_plan_id" TEXT,
ADD COLUMN "continuation_provider_status" TEXT,
ADD COLUMN "continuation_starts_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "brand_subscriptions_continuation_razorpay_subscription_id_key"
ON "brand_subscriptions"("continuation_razorpay_subscription_id");
