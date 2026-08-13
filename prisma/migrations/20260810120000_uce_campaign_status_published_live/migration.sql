-- Canonical Campaign lifecycle: DRAFT | PUBLISHED | LIVE | PAUSED | COMPLETED | ARCHIVED
-- Step 1: add enum values only (cannot use new values in the same PG transaction).

ALTER TYPE "UceCampaignStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';
ALTER TYPE "UceCampaignStatus" ADD VALUE IF NOT EXISTS 'LIVE';
