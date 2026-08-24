-- Gatekeeper submission consent is application/legal state, not Intelligence.
-- Rows are append-only by application contract; the runtime exposes create only.
CREATE TABLE "gatekeeper_submission_audits" (
    "id" TEXT NOT NULL,
    "raw_url" TEXT NOT NULL,
    "normalized_url" TEXT,
    "normalized_domain" TEXT,
    "ownership_authorization_attested" BOOLEAN NOT NULL,
    "terms_accepted" BOOLEAN NOT NULL,
    "privacy_policy_accepted" BOOLEAN NOT NULL,
    "terms_version" TEXT NOT NULL,
    "privacy_policy_version" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,
    "session_reference" TEXT,
    "discovery_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gatekeeper_submission_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gatekeeper_submission_audits_discovery_lead_id_idx"
ON "gatekeeper_submission_audits"("discovery_lead_id");

CREATE INDEX "gatekeeper_submission_audits_user_id_idx"
ON "gatekeeper_submission_audits"("user_id");

CREATE INDEX "gatekeeper_submission_audits_created_at_idx"
ON "gatekeeper_submission_audits"("created_at");
