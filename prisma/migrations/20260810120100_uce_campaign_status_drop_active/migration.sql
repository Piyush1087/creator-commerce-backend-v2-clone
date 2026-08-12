-- Step 2: map historical ACTIVE → LIVE and remove ACTIVE from the enum.

UPDATE "uce_campaigns"
SET "current_status" = 'LIVE'
WHERE "current_status"::text = 'ACTIVE';

CREATE TYPE "UceCampaignStatus_new" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'LIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED'
);

ALTER TABLE "uce_campaigns" ALTER COLUMN "current_status" DROP DEFAULT;

ALTER TABLE "uce_campaigns"
  ALTER COLUMN "current_status" TYPE "UceCampaignStatus_new"
  USING (
    CASE "current_status"::text
      WHEN 'ACTIVE' THEN 'LIVE'
      ELSE "current_status"::text
    END::"UceCampaignStatus_new"
  );

ALTER TABLE "uce_campaigns"
  ALTER COLUMN "current_status" SET DEFAULT 'DRAFT'::"UceCampaignStatus_new";

DROP TYPE "UceCampaignStatus";
ALTER TYPE "UceCampaignStatus_new" RENAME TO "UceCampaignStatus";
