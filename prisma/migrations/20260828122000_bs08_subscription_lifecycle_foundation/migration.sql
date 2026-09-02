-- BS08-P1 adds Product lifecycle metadata without rewriting legacy records.
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIAL_EXPIRED';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCEL_SCHEDULED';

ALTER TABLE "brand_subscriptions"
ADD COLUMN "cancel_scheduled_at" TIMESTAMP(3),
ADD COLUMN "cancel_effective_at" TIMESTAMP(3),
ADD COLUMN "first_payment_failure_at" TIMESTAMP(3),
ADD COLUMN "payment_grace_ends_at" TIMESTAMP(3),
ADD COLUMN "provider_status" TEXT;
