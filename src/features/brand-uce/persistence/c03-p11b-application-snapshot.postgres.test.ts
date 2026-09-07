import { randomUUID } from "node:crypto";

import {
  CreatorTeamRole,
  OrganizationKind,
  PrismaClient,
  UceApplicationSnapshotVersion,
  UceBriefStatus,
  UceCampaignAssetKind,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.skipIf(process.env.C03_P11B_DATABASE_TEST !== "true")(
  "C-03 P1.1B real-PostgreSQL Application/snapshot foundation",
  () => {
    const prisma = new PrismaClient();
    const brandIds = [randomUUID(), randomUUID()];
    const campaignIds = [randomUUID(), randomUUID()];
    const assetIds = [randomUUID(), randomUUID()];
    const briefIds = [randomUUID(), randomUUID()];
    const organizationId = randomUUID();
    const actorUserId = randomUUID();
    const subjectProfileId = randomUUID();
    const subjectWorkspaceId = randomUUID();
    const actorMembershipId = randomUUID();
    const createdApplicationIds = new Set<string>();
    let writeGuardDisabled = false;

    async function insertCanonical(input: {
      id?: string;
      campaignId?: string;
      brandProfileId?: string;
      assetId?: string;
      briefId?: string;
      status?: string;
    }) {
      const id = input.id ?? randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO uce_applications
          (id, authority_version, campaign_id, brand_profile_id,
           canonical_campaign_asset_id, canonical_brief_id,
           subject_creator_profile_id, subject_creator_workspace_id,
           actor_user_id, actor_membership_id, actor_role,
           status, source, status_version, created_at, updated_at)
         VALUES ($1, 'C03_CANONICAL', $2, $3, $4, $5, $6, $7, $8, $9,
           'OWNER', $10::"UceApplicationStatus", 'DIRECT', 1, NOW(), NOW())`,
        id,
        input.campaignId ?? campaignIds[0],
        input.brandProfileId ?? brandIds[0],
        input.assetId ?? assetIds[0],
        input.briefId ?? briefIds[0],
        subjectProfileId,
        subjectWorkspaceId,
        actorUserId,
        actorMembershipId,
        input.status ?? "PENDING",
      );
      createdApplicationIds.add(id);
      return id;
    }

    async function disableWriteGuard() {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE uce_applications
         DISABLE TRIGGER c03_canonical_application_write_closed`,
      );
      writeGuardDisabled = true;
    }

    async function enableWriteGuard() {
      if (!writeGuardDisabled) return;
      await prisma.$executeRawUnsafe(
        `ALTER TABLE uce_applications
         ENABLE TRIGGER c03_canonical_application_write_closed`,
      );
      writeGuardDisabled = false;
    }

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.pathname !== "/c03_p11b_fresh"
      ) {
        throw new Error(
          "C-03 P1.1B tests require disposable loopback c03_p11b_fresh.",
        );
      }

      for (const [index, brandId] of brandIds.entries()) {
        await prisma.brandProfile.create({
          data: {
            id: brandId,
            domain: `c03-p11b-${brandId}.example.test`,
            name: `C03 P1.1B Brand ${index}`,
            industry: "D2C",
            brandValues: [],
            policyFlags: [],
          },
        });
        await prisma.uceCampaign.create({
          data: {
            id: campaignIds[index],
            brandProfileId: brandId,
            name: `C03 P1.1B Campaign ${index}`,
          },
        });
        await prisma.uceCampaignAsset.create({
          data: {
            id: assetIds[index],
            campaignId: campaignIds[index],
            kind: UceCampaignAssetKind.BRAND,
            brandProfileId: brandId,
          },
        });
        await prisma.canonicalCampaignBrief.create({
          data: {
            id: briefIds[index],
            campaignAssetId: assetIds[index],
            status: UceBriefStatus.PUBLISHED,
            briefName: `C03 P1.1B Brief ${index}`,
          },
        });
      }

      await prisma.organization.create({
        data: {
          id: organizationId,
          name: "C03 P1.1B Creator Workspace",
          kind: OrganizationKind.CREATOR,
        },
      });
      const actorEmail = `c03-p11b-${actorUserId}@example.test`;
      await prisma.user.create({
        data: {
          id: actorUserId,
          email: actorEmail,
          normalizedEmail: actorEmail,
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          organizationId,
        },
      });
      await prisma.creatorProfile.create({
        data: { id: subjectProfileId, userId: actorUserId },
      });
      await prisma.creatorWorkspace.create({
        data: {
          id: subjectWorkspaceId,
          ownerProfileId: subjectProfileId,
          organizationId,
        },
      });
      await prisma.creatorWorkspaceMember.create({
        data: {
          id: actorMembershipId,
          workspaceId: subjectWorkspaceId,
          assignedProfileId: subjectProfileId,
          userId: actorUserId,
          associatedEmail: actorEmail,
          securityRole: CreatorTeamRole.OWNER,
          isActive: true,
          joinedAt: new Date(),
        },
      });
    });

    afterAll(async () => {
      try {
        await enableWriteGuard();
        await prisma.uceApplicationSnapshot.deleteMany({
          where: { applicationId: { in: [...createdApplicationIds] } },
        });
        await prisma.uceApplication.deleteMany({
          where: { id: { in: [...createdApplicationIds] } },
        });
        await prisma.canonicalCampaignBrief.deleteMany({
          where: { id: { in: briefIds } },
        });
        await prisma.uceCampaignAsset.deleteMany({
          where: { id: { in: assetIds } },
        });
        await prisma.uceCampaign.deleteMany({
          where: { id: { in: campaignIds } },
        });
        await prisma.creatorWorkspaceMember.deleteMany({
          where: { id: actorMembershipId },
        });
        await prisma.creatorWorkspace.deleteMany({
          where: { id: subjectWorkspaceId },
        });
        await prisma.creatorProfile.deleteMany({
          where: { id: subjectProfileId },
        });
        await prisma.user.deleteMany({ where: { id: actorUserId } });
        await prisma.organization.deleteMany({ where: { id: organizationId } });
        await prisma.brandProfile.deleteMany({
          where: { id: { in: brandIds } },
        });
      } finally {
        await prisma.$disconnect();
      }
    });

    it("keeps canonical Application writes closed until P1.1D", async () => {
      await expect(insertCanonical({})).rejects.toThrow(
        /C03_CANONICAL_APPLICATION_WRITE_CLOSED/,
      );
      expect(createdApplicationIds.size).toBe(0);
    });

    it("rejects an incomplete legacy authority shape", async () => {
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO uce_applications
            (id, campaign_id, status, source, created_at, updated_at)
           VALUES ($1, $2, 'PENDING', 'DIRECT', NOW(), NOW())`,
          randomUUID(),
          campaignIds[0],
        ),
      ).rejects.toBeTruthy();
    });

    it("enforces canonical ancestry, Owner subject, and active-opportunity uniqueness", async () => {
      await disableWriteGuard();
      try {
        await expect(
          insertCanonical({ brandProfileId: brandIds[1] }),
        ).rejects.toBeTruthy();
        await expect(
          insertCanonical({ assetId: assetIds[1], briefId: briefIds[1] }),
        ).rejects.toBeTruthy();
        await expect(
          insertCanonical({ briefId: briefIds[1] }),
        ).rejects.toBeTruthy();

        const activeId = await insertCanonical({});
        await expect(
          insertCanonical({ status: "REJECTED" }),
        ).rejects.toBeTruthy();
        const withdrawnId = await insertCanonical({ status: "WITHDRAWN" });
        const expiredId = await insertCanonical({ status: "EXPIRED" });
        expect([activeId, withdrawnId, expiredId]).toHaveLength(3);

        const wrongWorkspace = randomUUID();
        await expect(
          prisma.$executeRawUnsafe(
            `UPDATE uce_applications
             SET subject_creator_workspace_id = $1
             WHERE id = $2`,
            wrongWorkspace,
            activeId,
          ),
        ).rejects.toBeTruthy();
      } finally {
        await enableWriteGuard();
      }
    });

    it("uses RESTRICT for snapshot ownership", async () => {
      await disableWriteGuard();
      let applicationId: string | undefined;
      try {
        applicationId = await insertCanonical({
          assetId: assetIds[1],
          briefId: briefIds[1],
          campaignId: campaignIds[1],
          brandProfileId: brandIds[1],
        });
        await prisma.uceApplicationSnapshot.create({
          data: {
            applicationId,
            schemaVersion:
              UceApplicationSnapshotVersion.C03_APPLICATION_SNAPSHOT_V1,
            campaignContext: {},
            campaignAssetContext: {},
            briefContext: {},
            commercialContext: {},
            creatorIdentity: {},
            actorContext: {},
            attributionContext: {},
          },
        });
        await expect(
          prisma.uceApplication.delete({ where: { id: applicationId } }),
        ).rejects.toBeTruthy();
      } finally {
        await enableWriteGuard();
      }
    });

    it("installs exact enums, FKs, trigger, and partial predicate", async () => {
      const constraints = await prisma.$queryRaw<
        Array<{ name: string; delete_action: string; update_action: string }>
      >`
        SELECT conname AS name, confdeltype::text AS delete_action,
          confupdtype::text AS update_action
        FROM pg_constraint
        WHERE conname IN (
          'uce_applications_authority_shape_check',
          'uce_applications_campaign_id_brand_profile_id_fkey',
          'uce_applications_campaign_id_canonical_campaign_asset_id_fkey',
          'uce_applications_canonical_campaign_asset_id_canonical_brief_id_fkey',
          'uce_applications_subject_workspace_owner_fkey',
          'uce_applications_actor_user_id_fkey',
          'uce_applications_actor_membership_id_fkey',
          'uce_application_snapshots_application_id_fkey'
        )
      `;
      expect(new Set(constraints.map((row) => row.name)).size).toBe(8);
      const snapshotFk = constraints.find(
        (row) => row.name === "uce_application_snapshots_application_id_fkey",
      );
      expect(snapshotFk).toMatchObject({
        delete_action: "r",
        update_action: "r",
      });

      const catalog = await prisma.$queryRaw<
        Array<{ name: string; definition: string | null }>
      >`
        SELECT indexname AS name, indexdef AS definition
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'uce_applications_canonical_active_opportunity_key'
        UNION ALL
        SELECT tgname AS name, pg_get_triggerdef(oid) AS definition
        FROM pg_trigger
        WHERE NOT tgisinternal
          AND tgname = 'c03_canonical_application_write_closed'
      `;
      expect(new Set(catalog.map((row) => row.name)).size).toBe(2);
      const predicate = catalog.find((row) =>
        row.name.includes("canonical_active_opportunity"),
      )?.definition;
      expect(predicate).toContain("SUPERSEDED");
      expect(predicate).not.toContain("WITHDRAWN");
      expect(predicate).not.toContain("EXPIRED");

      const enumRows = await prisma.$queryRaw<
        Array<{ name: string; values: string[] }>
      >`
        SELECT typ.typname AS name,
          array_agg(en.enumlabel ORDER BY en.enumsortorder) AS values
        FROM pg_type typ
        JOIN pg_enum en ON en.enumtypid = typ.oid
        WHERE typ.typname IN (
          'UceApplicationAuthorityVersion',
          'UceApplicationSnapshotVersion'
        )
        GROUP BY typ.typname
      `;
      expect(enumRows).toEqual(
        expect.arrayContaining([
          {
            name: "UceApplicationAuthorityVersion",
            values: ["LEGACY_COMPATIBILITY", "C03_CANONICAL"],
          },
          {
            name: "UceApplicationSnapshotVersion",
            values: ["C03_APPLICATION_SNAPSHOT_V1"],
          },
        ]),
      );
    });
  },
);
