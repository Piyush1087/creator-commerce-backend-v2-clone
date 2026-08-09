-- CreateEnum
CREATE TYPE "SurfaceScanAttemptKind" AS ENUM ('SURFACE_VENDOR');

-- CreateTable
CREATE TABLE "surface_scan_attempts" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "client_ip" TEXT NOT NULL,
    "discovery_lead_id" TEXT,
    "brand_profile_id" TEXT,
    "kind" "SurfaceScanAttemptKind" NOT NULL DEFAULT 'SURFACE_VENDOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surface_scan_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "surface_scan_attempts_domain_created_at_idx" ON "surface_scan_attempts"("domain", "created_at");

-- CreateIndex
CREATE INDEX "surface_scan_attempts_client_ip_created_at_idx" ON "surface_scan_attempts"("client_ip", "created_at");
