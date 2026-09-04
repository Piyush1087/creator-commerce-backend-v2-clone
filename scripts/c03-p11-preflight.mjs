import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

const P11A_MIGRATION = "20260910120000_c03_campaign_asset_brief_convergence";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationRoot = join(root, "prisma", "migrations");
const prisma = new PrismaClient();

function count(value) {
  return Number(value ?? 0);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validCanonicalDefinition(value) {
  if (!isRecord(value) || value.version !== "1.2") return false;
  if (!isRecord(value.strategy) || !isRecord(value.targeting)) return false;
  if (!isRecord(value.commercials) || !isRecord(value.derived)) return false;
  const platforms = value.strategy.platforms;
  const visibility = value.strategy.campaign_visibility;
  const commercials = value.commercials;
  const currencies = new Set(["INR", "USD"]);
  const supportTypes = new Set([
    "PRODUCT",
    "SERVICE",
    "EXPERIENCE",
    "ACCESS_SUBSCRIPTION",
    "OTHER",
  ]);
  const support = commercials.receives_brand_support;
  return (
    ["MANUAL", "AI_RECOMMENDED"].includes(value.creationSource) &&
    Array.isArray(platforms) &&
    platforms.length === 1 &&
    platforms[0] === "INSTAGRAM" &&
    ["PUBLIC", "ELIGIBLE_CREATORS_ONLY", "INVITE_ONLY"].includes(visibility) &&
    typeof commercials.commercial_offer === "number" &&
    Number.isFinite(commercials.commercial_offer) &&
    commercials.commercial_offer >= 0 &&
    typeof commercials.total_campaign_budget === "number" &&
    Number.isFinite(commercials.total_campaign_budget) &&
    commercials.total_campaign_budget >= commercials.commercial_offer &&
    typeof support === "boolean" &&
    currencies.has(value.derived.currency) &&
    (support
      ? supportTypes.has(commercials.brand_support_type) &&
        (commercials.brand_support_estimated_value == null ||
          (typeof commercials.brand_support_estimated_value === "number" &&
            Number.isFinite(commercials.brand_support_estimated_value) &&
            commercials.brand_support_estimated_value >= 0))
      : commercials.brand_support_type == null &&
        commercials.brand_support_estimated_value == null)
  );
}

async function expectedP0Migrations() {
  const names = (await readdir(migrationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name < P11A_MIGRATION)
    .map((entry) => entry.name)
    .sort();
  const rows = await Promise.all(
    names.map(async (name) => {
      const sql = await readFile(join(migrationRoot, name, "migration.sql"));
      return {
        migration_name: name,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
  if (rows.length !== 74) {
    throw new Error(
      `C03_P0_MIGRATION_INVENTORY_EXPECTED_74_GOT_${rows.length}`,
    );
  }
  return rows;
}

const expected = await expectedP0Migrations();

try {
  const report = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const serverTime = await tx.$queryRawUnsafe(
      "SELECT clock_timestamp()::text AS timestamp",
    );
    const applied = await tx.$queryRawUnsafe(`
      SELECT migration_name, checksum
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name
    `);
    const columns = await tx.$queryRawUnsafe(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'uce_campaigns', 'uce_campaign_strategy',
          'uce_campaign_targeting', 'uce_campaign_commercials',
          'uce_campaign_assets', 'campaign_briefs',
          'campaign_brief_deliverables', 'uce_applications',
          'uce_application_snapshots', 'creator_workspaces',
          'creator_workspace_members', 'creator_entry_continuations'
        )
      ORDER BY table_name, ordinal_position
    `);
    const constraints = await tx.$queryRawUnsafe(`
      SELECT con.conname AS name, rel.relname AS table_name,
        pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = 'public'
        AND rel.relname IN (
          'uce_campaigns', 'uce_campaign_assets', 'campaign_briefs',
          'campaign_brief_deliverables', 'uce_applications',
          'uce_application_snapshots', 'creator_workspaces',
          'creator_workspace_members', 'creator_entry_continuations'
        )
      ORDER BY rel.relname, con.conname
    `);
    const enums = await tx.$queryRawUnsafe(`
      SELECT typ.typname AS name,
        array_agg(en.enumlabel ORDER BY en.enumsortorder) AS values
      FROM pg_type typ
      JOIN pg_enum en ON en.enumtypid = typ.oid
      JOIN pg_namespace ns ON ns.oid = typ.typnamespace
      WHERE ns.nspname = 'public'
        AND typ.typname IN (
          'UceCampaignStatus', 'UceCampaignAssetKind',
          'UceCampaignAssetStatus', 'UceVisibilityScope', 'UceMediaPlatform',
          'UceApplicationStatus', 'UceApplicationSource', 'CreatorTeamRole'
        )
      GROUP BY typ.typname
      ORDER BY typ.typname
    `);
    const campaigns = await tx.$queryRawUnsafe(`
      SELECT id, creation_source, canonical_definition
      FROM uce_campaigns
      ORDER BY id
    `);
    const visibility = await tx.$queryRawUnsafe(`
      SELECT
        count(*) FILTER (WHERE cardinality(visibility_scopes) = 1) AS exactly_one,
        count(*) FILTER (WHERE cardinality(visibility_scopes) = 0) AS missing,
        count(*) FILTER (WHERE cardinality(visibility_scopes) > 1) AS conflicting,
        coalesce(array_agg(campaign_id ORDER BY campaign_id)
          FILTER (WHERE cardinality(visibility_scopes) <> 1), ARRAY[]::text[]) AS ambiguous_ids
      FROM uce_campaign_targeting
    `);
    const commercials = await tx.$queryRawUnsafe(`
      SELECT
        count(*) AS total,
        count(*) FILTER (
          WHERE coalesce(fixed_fee_amount, 0) = 0
            AND coalesce(negotiable_min_fee, 0) = 0
            AND coalesce(negotiable_max_fee, 0) = 0
        ) AS legacy_default_zero,
        count(*) FILTER (WHERE advance_payment_percentage = 30) AS legacy_thirty_percent,
        coalesce(array_agg(campaign_id ORDER BY campaign_id)
          FILTER (
            WHERE coalesce(fixed_fee_amount, 0) = 0
              AND coalesce(negotiable_min_fee, 0) = 0
              AND coalesce(negotiable_max_fee, 0) = 0
          ), ARRAY[]::text[]) AS legacy_default_zero_ids
      FROM uce_campaign_commercials
    `);
    const briefs = await tx.$queryRawUnsafe(`
      SELECT brief_id, campaign_asset_id, is_active,
        (SELECT count(*) FROM campaign_brief_deliverables d
          WHERE d.brief_id = b.brief_id) AS deliverable_count
      FROM campaign_briefs b
      ORDER BY brief_id
    `);
    const ancestry = await tx.$queryRawUnsafe(`
      SELECT
        (SELECT count(*) FROM campaign_briefs b
          LEFT JOIN uce_campaign_assets a ON a.campaign_asset_id = b.campaign_asset_id
          WHERE a.campaign_asset_id IS NULL) AS orphan_briefs,
        (SELECT count(*) FROM campaign_brief_deliverables d
          LEFT JOIN campaign_briefs b ON b.brief_id = d.brief_id
          WHERE b.brief_id IS NULL) AS orphan_deliverables
    `);
    const applications = await tx.$queryRawUnsafe(`
      SELECT status::text AS status, count(*) AS count,
        coalesce(array_agg(id ORDER BY id), ARRAY[]::text[]) AS ids
      FROM uce_applications
      GROUP BY status
      ORDER BY status::text
    `);
    const applicationIntegrity = await tx.$queryRawUnsafe(`
      SELECT
        count(*) FILTER (WHERE snapshot.application_id IS NULL) AS missing_snapshots,
        coalesce(array_agg(application.id ORDER BY application.id)
          FILTER (WHERE snapshot.application_id IS NULL), ARRAY[]::text[])
          AS missing_snapshot_ids,
        count(*) FILTER (
          WHERE creator.campaign_id IS DISTINCT FROM application.campaign_id
        ) AS campaign_creator_mismatches,
        count(*) FILTER (
          WHERE product.campaign_id IS DISTINCT FROM application.campaign_id
        ) AS product_campaign_mismatches,
        count(*) FILTER (
          WHERE brief.campaign_id IS DISTINCT FROM application.campaign_id
             OR (
               brief.product_id IS NOT NULL
               AND brief.product_id IS DISTINCT FROM application.campaign_asset_id
             )
        ) AS brief_ancestry_mismatches,
        count(*) FILTER (
          WHERE application.status = 'PENDING'::"UceApplicationStatus"
            AND (
              application.approved_at IS NOT NULL
              OR application.rejected_at IS NOT NULL
              OR application.withdrawn_at IS NOT NULL
              OR application.expired_at IS NOT NULL
              OR application.superseded_at IS NOT NULL
            )
        ) AS pending_with_terminal_timestamp,
        count(*) FILTER (
          WHERE application.status = 'APPROVED'::"UceApplicationStatus"
            AND application.approved_at IS NULL
        ) AS approved_without_timestamp,
        count(*) FILTER (
          WHERE application.status = 'REJECTED'::"UceApplicationStatus"
            AND application.rejected_at IS NULL
        ) AS rejected_without_timestamp,
        count(*) FILTER (
          WHERE application.status = 'WITHDRAWN'::"UceApplicationStatus"
            AND application.withdrawn_at IS NULL
        ) AS withdrawn_without_timestamp,
        count(*) FILTER (
          WHERE application.status = 'EXPIRED'::"UceApplicationStatus"
            AND application.expired_at IS NULL
        ) AS expired_without_timestamp,
        count(*) FILTER (
          WHERE application.status = 'SUPERSEDED'::"UceApplicationStatus"
            AND application.superseded_at IS NULL
        ) AS superseded_without_timestamp,
        count(*) FILTER (WHERE creator.creator_profile_id IS NOT NULL)
          AS campaign_creator_profile_exact,
        count(*) FILTER (WHERE creator.creator_profile_id IS NULL)
          AS campaign_creator_profile_unresolved
      FROM uce_applications application
      LEFT JOIN uce_application_snapshots snapshot
        ON snapshot.application_id = application.id
      LEFT JOIN uce_campaign_creators creator
        ON creator.id = application.campaign_creator_id
      LEFT JOIN uce_campaign_products product
        ON product.product_id = application.campaign_asset_id
      LEFT JOIN uce_campaign_briefs brief
        ON brief.brief_id = application.brief_id
    `);
    const workspaceIntegrity = await tx.$queryRawUnsafe(`
      SELECT
        count(*) FILTER (WHERE owner.id IS NULL) AS missing_owner_profiles,
        count(*) FILTER (
          WHERE member.is_active_active = TRUE AND member.user_id IS NULL
        ) AS active_members_without_user,
        count(*) FILTER (
          WHERE member.is_active_active = TRUE AND member_workspace.id IS NULL
        ) AS active_members_without_workspace
      FROM creator_workspaces workspace
      LEFT JOIN creator_profiles owner ON owner.id = workspace.owner_profile_id
      LEFT JOIN creator_workspace_members member
        ON member.workspace_id = workspace.id
      LEFT JOIN creator_workspaces member_workspace
        ON member_workspace.id = member.workspace_id
    `);
    const continuations = await tx.$queryRawUnsafe(`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE bound_user_id IS NULL) AS unbound,
        count(*) FILTER (WHERE bound_user_id IS NOT NULL) AS bound,
        count(*) FILTER (WHERE consumed_at IS NOT NULL) AS consumed,
        count(*) FILTER (WHERE expires_at <= clock_timestamp()) AS expired,
        coalesce(array_agg(id ORDER BY id)
          FILTER (WHERE consumed_at IS NOT NULL AND consumed_at < created_at),
          ARRAY[]::text[]) AS invalid_consumption_ids
      FROM creator_entry_continuations
    `);
    const legacyInvitations = await tx.$queryRawUnsafe(`
      SELECT count(*) FILTER (WHERE invitation_token IS NOT NULL)
        AS plaintext_token_rows
      FROM uce_campaign_collaborations
    `);

    const expectedColumns = new Set([
      "uce_campaigns.creation_source",
      "uce_campaigns.canonical_definition",
      "uce_campaign_assets.campaign_asset_id",
      "uce_campaign_assets.campaign_id",
      "campaign_briefs.brief_id",
      "campaign_briefs.campaign_asset_id",
      "campaign_briefs.title",
      "campaign_briefs.creative_requirements",
      "campaign_briefs.is_active",
      "campaign_brief_deliverables.deliverable_id",
      "campaign_brief_deliverables.brief_id",
      "uce_applications.id",
      "uce_applications.request_id",
      "uce_applications.campaign_id",
      "uce_applications.campaign_creator_id",
      "uce_applications.campaign_asset_id",
      "uce_applications.brief_id",
      "uce_applications.status",
      "uce_application_snapshots.application_id",
      "uce_application_snapshots.campaign_context",
      "uce_application_snapshots.campaign_asset_context",
      "uce_application_snapshots.brief_context",
      "uce_application_snapshots.commercial_context",
      "uce_application_snapshots.creator_identity",
      "creator_workspaces.id",
      "creator_workspaces.owner_profile_id",
      "creator_workspace_members.id",
      "creator_workspace_members.workspace_id",
      "creator_workspace_members.user_id",
      "creator_workspace_members.security_role_token",
      "creator_workspace_members.is_active_active",
      "creator_entry_continuations.id",
      "creator_entry_continuations.campaign_id",
      "creator_entry_continuations.bound_user_id",
      "creator_entry_continuations.expires_at",
      "creator_entry_continuations.consumed_at",
    ]);
    const actualColumns = new Set(
      columns.map((row) => `${row.table_name}.${row.column_name}`),
    );
    const missingColumns = [...expectedColumns].filter(
      (column) => !actualColumns.has(column),
    );
    const requiredConstraints = [
      {
        name: "uce_campaigns_creation_source_check",
        contains: "creation_source",
      },
      {
        name: "uce_campaign_assets_exactly_one_reference",
        contains: "kind",
      },
      {
        name: "uce_campaign_assets_campaign_id_fkey",
        contains: "REFERENCES uce_campaigns(id)",
      },
      {
        name: "campaign_briefs_campaign_asset_id_fkey",
        contains: "REFERENCES uce_campaign_assets(campaign_asset_id)",
      },
      {
        name: "campaign_brief_deliverables_brief_id_fkey",
        contains: "REFERENCES campaign_briefs(brief_id)",
      },
      {
        name: "uce_applications_campaign_id_fkey",
        contains: "REFERENCES uce_campaigns(id)",
      },
      {
        name: "uce_applications_campaign_creator_id_fkey",
        contains: "REFERENCES uce_campaign_creators(id)",
      },
      {
        name: "uce_applications_campaign_asset_id_fkey",
        contains: "REFERENCES uce_campaign_products(product_id)",
      },
      {
        name: "uce_applications_brief_id_fkey",
        contains: "REFERENCES uce_campaign_briefs(brief_id)",
      },
      {
        name: "uce_application_snapshots_application_id_fkey",
        contains: "REFERENCES uce_applications(id)",
      },
      {
        name: "creator_workspaces_owner_profile_id_fkey",
        contains: "REFERENCES creator_profiles(id)",
      },
    ];
    const missingConstraints = requiredConstraints
      .filter((required) => {
        const actual = constraints.find((row) => row.name === required.name);
        return !actual || !actual.definition.includes(required.contains);
      })
      .map((required) => required.name);
    const expectedEnums = new Map([
      [
        "UceCampaignStatus",
        ["DRAFT", "PUBLISHED", "LIVE", "PAUSED", "COMPLETED", "ARCHIVED"],
      ],
      ["UceCampaignAssetKind", ["BRAND", "OFFERING", "OFFER"]],
      ["UceCampaignAssetStatus", ["ACTIVE", "PAUSED"]],
      ["UceVisibilityScope", ["EVERYONE", "ELIGIBLE_ONLY", "INVITED_ONLY"]],
      ["UceMediaPlatform", ["INSTAGRAM", "TIKTOK", "YOUTUBE"]],
      [
        "UceApplicationStatus",
        [
          "PENDING",
          "APPROVED",
          "REJECTED",
          "WITHDRAWN",
          "EXPIRED",
          "SUPERSEDED",
        ],
      ],
      ["UceApplicationSource", ["DIRECT", "OUTREACH", "SHARE"]],
      ["CreatorTeamRole", ["OWNER", "MANAGER", "ASSISTANT"]],
    ]);
    const enumMismatches = [...expectedEnums].flatMap(([name, values]) => {
      const actual = enums.find((row) => row.name === name)?.values ?? [];
      return JSON.stringify(actual) === JSON.stringify(values) ? [] : [name];
    });
    const migrationMismatch =
      applied.length !== expected.length ||
      expected.some(
        (item, index) =>
          applied[index]?.migration_name !== item.migration_name ||
          applied[index]?.checksum !== item.checksum,
      );
    const invalidCreationSourceIds = campaigns
      .filter(
        (row) => !["MANUAL", "AI_RECOMMENDED"].includes(row.creation_source),
      )
      .map((row) => row.id);
    const definition = { absent_ids: [], valid_v1_2_ids: [], invalid_ids: [] };
    for (const campaign of campaigns) {
      if (campaign.canonical_definition == null) {
        definition.absent_ids.push(campaign.id);
      } else if (validCanonicalDefinition(campaign.canonical_definition)) {
        definition.valid_v1_2_ids.push(campaign.id);
      } else {
        definition.invalid_ids.push(campaign.id);
      }
    }
    const ancestryRow = ancestry[0] ?? {};
    const contradictions = [
      ...(migrationMismatch ? ["P0_MIGRATION_INVENTORY_MISMATCH"] : []),
      ...(missingColumns.length ? ["P0_STRUCTURAL_COLUMN_MISMATCH"] : []),
      ...(missingConstraints.length ? ["P0_CONSTRAINT_OR_FK_MISMATCH"] : []),
      ...(enumMismatches.length ? ["P0_ENUM_MISMATCH"] : []),
      ...(invalidCreationSourceIds.length
        ? ["INVALID_CAMPAIGN_CREATION_SOURCE"]
        : []),
      ...(count(ancestryRow.orphan_briefs) > 0
        ? ["ORPHAN_CANONICAL_BRIEF"]
        : []),
      ...(count(ancestryRow.orphan_deliverables) > 0
        ? ["ORPHAN_CANONICAL_DELIVERABLE"]
        : []),
    ];

    return {
      report: "C03_P1_1_MIGRATION_PREFLIGHT_V1",
      scope: "P1.1A_B_CAMPAIGN_APPLICATION_SNAPSHOT",
      server_timestamp: serverTime[0]?.timestamp ?? null,
      result: contradictions.length ? "FAIL" : "PASS",
      p0_migrations: {
        expected_count: expected.length,
        applied_count: applied.length,
        names_and_checksums_match: !migrationMismatch,
      },
      structural_columns: { missing: missingColumns },
      structural_constraints: { missing_or_mismatched: missingConstraints },
      structural_enums: { mismatched: enumMismatches },
      campaign_creation_source: { invalid_ids: invalidCreationSourceIds },
      canonical_definition: definition,
      visibility: {
        exactly_one: count(visibility[0]?.exactly_one),
        missing: count(visibility[0]?.missing),
        conflicting: count(visibility[0]?.conflicting),
        ambiguous_ids: visibility[0]?.ambiguous_ids ?? [],
      },
      commercials: {
        total: count(commercials[0]?.total),
        legacy_default_zero: count(commercials[0]?.legacy_default_zero),
        legacy_thirty_percent: count(commercials[0]?.legacy_thirty_percent),
        legacy_default_zero_ids: commercials[0]?.legacy_default_zero_ids ?? [],
      },
      briefs: briefs.map((brief) => ({
        brief_id: brief.brief_id,
        campaign_asset_id: brief.campaign_asset_id,
        legacy_is_active: brief.is_active,
        deliverable_count: count(brief.deliverable_count),
      })),
      ancestry: {
        orphan_briefs: count(ancestryRow.orphan_briefs),
        orphan_deliverables: count(ancestryRow.orphan_deliverables),
      },
      applications: {
        by_status: Object.fromEntries(
          applications.map((row) => [row.status, count(row.count)]),
        ),
        missing_snapshots: count(applicationIntegrity[0]?.missing_snapshots),
        missing_snapshot_ids:
          applicationIntegrity[0]?.missing_snapshot_ids ?? [],
        campaign_creator_mismatches: count(
          applicationIntegrity[0]?.campaign_creator_mismatches,
        ),
        product_campaign_mismatches: count(
          applicationIntegrity[0]?.product_campaign_mismatches,
        ),
        brief_ancestry_mismatches: count(
          applicationIntegrity[0]?.brief_ancestry_mismatches,
        ),
        terminal_timestamp_inventory: {
          pending_with_terminal_timestamp: count(
            applicationIntegrity[0]?.pending_with_terminal_timestamp,
          ),
          approved_without_timestamp: count(
            applicationIntegrity[0]?.approved_without_timestamp,
          ),
          rejected_without_timestamp: count(
            applicationIntegrity[0]?.rejected_without_timestamp,
          ),
          withdrawn_without_timestamp: count(
            applicationIntegrity[0]?.withdrawn_without_timestamp,
          ),
          expired_without_timestamp: count(
            applicationIntegrity[0]?.expired_without_timestamp,
          ),
          superseded_without_timestamp: count(
            applicationIntegrity[0]?.superseded_without_timestamp,
          ),
        },
        campaign_creator_profile_lineage: {
          exact: count(applicationIntegrity[0]?.campaign_creator_profile_exact),
          unresolved: count(
            applicationIntegrity[0]?.campaign_creator_profile_unresolved,
          ),
        },
      },
      creator_workspace_integrity: {
        missing_owner_profiles: count(
          workspaceIntegrity[0]?.missing_owner_profiles,
        ),
        active_members_without_user: count(
          workspaceIntegrity[0]?.active_members_without_user,
        ),
        active_members_without_workspace: count(
          workspaceIntegrity[0]?.active_members_without_workspace,
        ),
      },
      continuations: {
        total: count(continuations[0]?.total),
        unbound: count(continuations[0]?.unbound),
        bound: count(continuations[0]?.bound),
        consumed: count(continuations[0]?.consumed),
        expired: count(continuations[0]?.expired),
        invalid_consumption_ids:
          continuations[0]?.invalid_consumption_ids ?? [],
      },
      legacy_plaintext_invitation_rows: count(
        legacyInvitations[0]?.plaintext_token_rows,
      ),
      contradictions,
    };
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.result !== "PASS") process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
