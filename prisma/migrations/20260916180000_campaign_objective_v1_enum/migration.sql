-- The enum extension is intentionally isolated from every operation that uses
-- the new labels. PostgreSQL must commit this boundary before later migrations
-- or application code can safely write the values.
ALTER TYPE "UceCampaignObjective" ADD VALUE IF NOT EXISTS 'AWARENESS';
ALTER TYPE "UceCampaignObjective" ADD VALUE IF NOT EXISTS 'TRUST';
ALTER TYPE "UceCampaignObjective" ADD VALUE IF NOT EXISTS 'ASSETS';
ALTER TYPE "UceCampaignObjective" ADD VALUE IF NOT EXISTS 'ACTION';
