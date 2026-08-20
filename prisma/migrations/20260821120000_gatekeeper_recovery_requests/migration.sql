CREATE TYPE "GatekeeperRecoveryRequestType" AS ENUM (
    'REQUEST_ORG_ACCESS',
    'REQUEST_CLASSIFICATION_REVIEW'
);

CREATE TABLE "gatekeeper_recovery_requests" (
    "id" TEXT NOT NULL,
    "request_type" "GatekeeperRecoveryRequestType" NOT NULL,
    "discovery_lead_id" TEXT,
    "normalized_domain" VARCHAR(255) NOT NULL,
    "requester_email" VARCHAR(320) NOT NULL,
    "requester_name" VARCHAR(120),
    "requester_note" VARCHAR(1000),
    "requester_user_id" TEXT,
    "target_organization_id" TEXT,
    "session_reference" VARCHAR(255),
    "context_version" VARCHAR(64) NOT NULL DEFAULT 'gatekeeper_recovery_context_v1',
    "gatekeeper_context" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gatekeeper_recovery_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_gatekeeper_recovery_request_actor"
ON "gatekeeper_recovery_requests"("request_type", "discovery_lead_id", "requester_email");

CREATE INDEX "gatekeeper_recovery_requests_request_type_created_at_idx"
ON "gatekeeper_recovery_requests"("request_type", "created_at");

CREATE INDEX "gatekeeper_recovery_requests_target_organization_id_created_at_idx"
ON "gatekeeper_recovery_requests"("target_organization_id", "created_at");

CREATE INDEX "gatekeeper_recovery_requests_requester_user_id_idx"
ON "gatekeeper_recovery_requests"("requester_user_id");

ALTER TABLE "gatekeeper_recovery_requests"
ADD CONSTRAINT "gatekeeper_recovery_requests_discovery_lead_id_fkey"
FOREIGN KEY ("discovery_lead_id") REFERENCES "discovery_leads"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gatekeeper_recovery_requests"
ADD CONSTRAINT "gatekeeper_recovery_requests_requester_user_id_fkey"
FOREIGN KEY ("requester_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gatekeeper_recovery_requests"
ADD CONSTRAINT "gatekeeper_recovery_requests_target_organization_id_fkey"
FOREIGN KEY ("target_organization_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
