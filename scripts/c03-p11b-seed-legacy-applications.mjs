import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
const parsed = databaseUrl ? new URL(databaseUrl) : null;
const allowedDatabases = new Set([
  "/c03_p11b_upgrade74",
  "/c03_p11b_upgrade75",
  "/c03_p11c_upgrade74",
  "/c03_p11c_upgrade76",
]);
if (
  !parsed ||
  !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
  !allowedDatabases.has(parsed.pathname)
) {
  throw new Error("C03_P11B_FIXTURE_REQUIRES_DISPOSABLE_UPGRADE_DATABASE");
}

const prisma = new PrismaClient();
const ids = {
  brand: "c0311b00-0000-4000-8000-000000000001",
  campaign: "c0311b00-0000-4000-8000-000000000002",
  product: "c0311b00-0000-4000-8000-000000000003",
  brief: "c0311b00-0000-4000-8000-000000000004",
  campaignCreator: "c0311b00-0000-4000-8000-000000000005",
};
const statuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
  "SUPERSEDED",
];
const applicationId = (index) =>
  `c0311b00-0000-4000-8000-${String(index + 10).padStart(12, "0")}`;
const snapshotId = (index) =>
  `c0311b00-0000-4000-8001-${String(index + 10).padStart(12, "0")}`;

try {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO brand_profiles
        (id, domain, brand_name, industry, brand_values, policy_flags,
         created_at, updated_at)
       VALUES ($1, $2, $3, $4::"IndustryVertical", ARRAY[]::text[],
         ARRAY[]::text[], NOW(), NOW())`,
      ids.brand,
      "c03-p11b-upgrade.example.test",
      "C03 P1.1B Legacy Upgrade Fixture",
      "D2C",
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO uce_campaigns
        (id, brand_profile_id, campaign_name, current_status, creation_source,
         canonical_definition, created_at, updated_at)
       VALUES ($1, $2, $3, 'LIVE', 'MANUAL', NULL, NOW(), NOW())`,
      ids.campaign,
      ids.brand,
      "C03 P1.1B legacy Application preservation",
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO uce_campaign_products
        (product_id, campaign_id, sku_code, product_name, inventory_count,
         cost_per_unit, created_at)
       VALUES ($1, $2, $3, $4, 0, 0, NOW())`,
      ids.product,
      ids.campaign,
      "C03-P11B-LEGACY",
      "C03 P1.1B legacy Product",
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO uce_campaign_briefs
        (brief_id, campaign_id, product_id, internal_title,
         creative_guidelines, required_platforms, created_at)
       VALUES ($1, $2, $3, $4, $5,
         ARRAY['INSTAGRAM']::"UceMediaPlatform"[], NOW())`,
      ids.brief,
      ids.campaign,
      ids.product,
      "C03 P1.1B legacy Brief",
      "Preserve this legacy free-text payload exactly.",
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO uce_campaign_creators
        (id, campaign_id, platform, social_handle, normalized_social_handle,
         source, ingestion_method, review_state, created_at, updated_at)
       VALUES ($1, $2, 'INSTAGRAM', $3, $4, 'MANUAL', 'MANUAL_SINGLE',
         'PENDING_REVIEW', NOW(), NOW())`,
      ids.campaignCreator,
      ids.campaign,
      "@c03_p11b_legacy",
      "c03_p11b_legacy",
    );

    for (const [index, status] of statuses.entries()) {
      const application = applicationId(index);
      await tx.$executeRawUnsafe(
        `INSERT INTO uce_applications
          (id, request_id, campaign_id, campaign_creator_id,
           campaign_asset_id, brief_id, status, source, applied_at,
           approved_at, rejected_at, withdrawn_at, expired_at, superseded_at,
           created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::"UceApplicationStatus", 'DIRECT',
           '2026-09-01T00:00:00Z'::timestamptz,
           CASE WHEN $7 = 'APPROVED' THEN '2026-09-01T01:00:00Z'::timestamptz END,
           CASE WHEN $7 = 'REJECTED' THEN '2026-09-01T02:00:00Z'::timestamptz END,
           CASE WHEN $7 = 'WITHDRAWN' THEN '2026-09-01T03:00:00Z'::timestamptz END,
           CASE WHEN $7 = 'EXPIRED' THEN '2026-09-01T04:00:00Z'::timestamptz END,
           CASE WHEN $7 = 'SUPERSEDED' THEN '2026-09-01T05:00:00Z'::timestamptz END,
           NOW(), NOW())`,
        application,
        `c03-p11b-legacy-${status.toLowerCase()}`,
        ids.campaign,
        ids.campaignCreator,
        ids.product,
        ids.brief,
        status,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO uce_application_snapshots
          (id, application_id, campaign_context, campaign_asset_context,
           brief_context, commercial_context, creator_identity, created_at)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb,
           $7::jsonb, NOW())`,
        snapshotId(index),
        application,
        JSON.stringify({ fixture: "campaign", status, ordinal: index }),
        JSON.stringify({ fixture: "legacy-product", status, ordinal: index }),
        JSON.stringify({ fixture: "legacy-brief", status, ordinal: index }),
        JSON.stringify({ fixture: "commercial", status, amount: index }),
        JSON.stringify({ fixture: "creator", status, ordinal: index }),
      );
    }
  });

  process.stdout.write(
    `${JSON.stringify({
      fixture: "C03_P11B_LEGACY_APPLICATIONS_V1",
      application_ids: statuses.map((_, index) => applicationId(index)),
      statuses,
    })}\n`,
  );
} finally {
  await prisma.$disconnect();
}
