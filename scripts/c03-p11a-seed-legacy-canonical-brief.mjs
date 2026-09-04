import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
const parsed = databaseUrl ? new URL(databaseUrl) : null;
if (
  !parsed ||
  !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
  parsed.pathname !== "/c03_p11a_upgrade"
) {
  throw new Error("C03_P11A_FIXTURE_REQUIRES_DISPOSABLE_UPGRADE_DATABASE");
}

const prisma = new PrismaClient();
const ids = {
  brand: "c0311a00-0000-4000-8000-000000000001",
  campaign: "c0311a00-0000-4000-8000-000000000002",
  asset: "c0311a00-0000-4000-8000-000000000003",
  brief: "c0311a00-0000-4000-8000-000000000004",
  deliverable: "c0311a00-0000-4000-8000-000000000005",
};

try {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO brand_profiles
        (id, domain, name, industry, brand_values, policy_flags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, ARRAY[]::text[], ARRAY[]::text[], NOW(), NOW())`,
      ids.brand,
      "c03-p11a-upgrade.example.test",
      "C03 P1.1A Upgrade Fixture",
      "D2C",
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO uce_campaigns
        (id, brand_profile_id, campaign_name, current_status, creation_source,
         canonical_definition, created_at, updated_at)
       VALUES ($1, $2, $3, 'PUBLISHED', 'MANUAL', NULL, NOW(), NOW())`,
      ids.campaign,
      ids.brand,
      "C03 P1.1A minimal legacy canonical Brief",
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO uce_campaign_assets
        (campaign_asset_id, campaign_id, kind, status, brand_profile_id,
         created_at, updated_at)
       VALUES ($1, $2, 'BRAND', 'ACTIVE', $3, NOW(), NOW())`,
      ids.asset,
      ids.campaign,
      ids.brand,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO campaign_briefs
        (brief_id, campaign_asset_id, title, creative_requirements, is_active,
         created_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())`,
      ids.brief,
      ids.asset,
      "Legacy minimal canonical Brief",
      "Compatibility prose must not become canonical creator content.",
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO campaign_brief_deliverables
        (deliverable_id, brief_id, format, quantity, creative_requirements,
         publishing_required, created_at, updated_at)
       VALUES ($1, $2, $3, 1, $4, TRUE, NOW(), NOW())`,
      ids.deliverable,
      ids.brief,
      "Instagram Reel",
      "Legacy Deliverable prose",
    );
  });
  process.stdout.write(
    `${JSON.stringify({ fixture: "C03_P11A_LEGACY_CANONICAL_BRIEF_V1", ids })}\n`,
  );
} finally {
  await prisma.$disconnect();
}
