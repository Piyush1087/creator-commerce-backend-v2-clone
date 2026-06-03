-- CreateEnum
CREATE TYPE "planner_signal_type_enum" AS ENUM ('LAUNCH_NEW_FRAMEWORK', 'INJECT_ASSET_LINE', 'FAST_TRACK_INTERRUPT');

-- CreateEnum
CREATE TYPE "bridge_sync_status_enum" AS ENUM ('RECEIVED', 'PROCESSING', 'SYNCHRONIZED', 'VALIDATION_FAILED');

-- AlterTable
ALTER TABLE "uce_campaign_products" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "uce_campaign_briefs" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "integration_bridge_signals_ledger" (
    "signal_id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "brand_profile_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "signal_type" "planner_signal_type_enum" NOT NULL,
    "sync_status" "bridge_sync_status_enum" NOT NULL DEFAULT 'RECEIVED',
    "raw_payload_snapshot" JSONB NOT NULL,
    "execution_error_logs" TEXT,
    "synchronized_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_bridge_signals_ledger_pkey" PRIMARY KEY ("signal_id")
);

-- CreateIndex
CREATE INDEX "integration_bridge_signals_ledger_sync_status_signal_type_idx" ON "integration_bridge_signals_ledger"("sync_status", "signal_type");

-- CreateIndex
CREATE INDEX "integration_bridge_signals_ledger_brand_profile_id_created_at_idx" ON "integration_bridge_signals_ledger"("brand_profile_id", "created_at");

-- AddForeignKey
ALTER TABLE "integration_bridge_signals_ledger" ADD CONSTRAINT "integration_bridge_signals_ledger_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_bridge_signals_ledger" ADD CONSTRAINT "integration_bridge_signals_ledger_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

