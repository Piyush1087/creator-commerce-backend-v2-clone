CREATE TYPE "CampaignApplicationStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');

CREATE TABLE "campaign_applications" (
  "application_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "canonical_brief_id" TEXT NOT NULL,
  "creator_user_id" TEXT NOT NULL,
  "status" "CampaignApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "collaboration_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campaign_applications_pkey" PRIMARY KEY ("application_id")
);

CREATE UNIQUE INDEX "campaign_applications_collaboration_id_key" ON "campaign_applications"("collaboration_id");
CREATE UNIQUE INDEX "campaign_applications_campaign_id_creator_user_id_key" ON "campaign_applications"("campaign_id", "creator_user_id");
CREATE INDEX "campaign_applications_campaign_id_status_idx" ON "campaign_applications"("campaign_id", "status");

ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_canonical_brief_id_fkey" FOREIGN KEY ("canonical_brief_id") REFERENCES "campaign_briefs"("brief_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
