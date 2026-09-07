import { randomUUID } from "node:crypto";

import {
  ApplicationDomainEventName,
  ApplicationEventActorClass,
  CreatorTeamRole,
  OrganizationKind,
  Prisma,
  PrismaClient,
  UceApplicationSnapshotVersion,
  UceApplicationStatus,
  UceBriefStatus,
  UceCampaignAssetKind,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CampaignLifecycleLockService } from "../services/campaign-lifecycle-lock.service";

type EvidenceOrder = "SNAPSHOT_FIRST" | "EVENT_FIRST";

describe.skipIf(process.env.C03_P11D_DATABASE_TEST !== "true")(
  "C-03 P1.1D real-PostgreSQL integrity guards",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { maxWait: 10_000, timeout: 15_000 },
    });
    const lockContender = new PrismaClient({
      transactionOptions: { maxWait: 10_000, timeout: 15_000 },
    });
    const lockService = new CampaignLifecycleLockService();
    const brandIds = Array.from({ length: 6 }, () => randomUUID());
    const campaignIds = Array.from({ length: 6 }, () => randomUUID());
    const assetIds = Array.from({ length: 6 }, () => randomUUID());
    const briefIds = Array.from({ length: 6 }, () => randomUUID());
    const creatorOrganizationId = randomUUID();
    const creatorUserId = randomUUID();
    const creatorProfileId = randomUUID();
    const creatorWorkspaceId = randomUUID();
    const creatorMembershipId = randomUUID();
    const brandActorOrganizationId = randomUUID();
    const brandActorUserId = randomUUID();
    const snapshotFirstApplicationId = randomUUID();
    const eventFirstApplicationId = randomUUID();
    const terminalApplicationId = randomUUID();

    async function insertApplication(
      tx: Prisma.TransactionClient,
      applicationId: string,
      campaignIndex = 0,
      actorUserId = creatorUserId,
    ) {
      await tx.$executeRawUnsafe(
        `INSERT INTO uce_applications
          (id, authority_version, campaign_id, brand_profile_id,
           canonical_campaign_asset_id, canonical_brief_id,
           subject_creator_profile_id, subject_creator_workspace_id,
           actor_user_id, actor_membership_id, actor_role,
           status, source, status_version, created_at, updated_at)
         VALUES ($1, 'C03_CANONICAL', $2, $3, $4, $5, $6, $7, $8, $9,
           'OWNER', 'PENDING', 'DIRECT', 1, NOW(), NOW())`,
        applicationId,
        campaignIds[campaignIndex],
        brandIds[campaignIndex],
        assetIds[campaignIndex],
        briefIds[campaignIndex],
        creatorProfileId,
        creatorWorkspaceId,
        actorUserId,
        creatorMembershipId,
      );
    }

    async function insertSnapshot(
      tx: Prisma.TransactionClient,
      applicationId: string,
    ) {
      await tx.uceApplicationSnapshot.create({
        data: {
          applicationId,
          schemaVersion:
            UceApplicationSnapshotVersion.C03_APPLICATION_SNAPSHOT_V1,
          campaignContext: { schema: "C03", version: 1 },
          campaignAssetContext: { schema: "C03", version: 1 },
          briefContext: { schema: "C03", version: 1 },
          commercialContext: { schema: "C03", version: 1 },
          creatorIdentity: { schema: "C03", version: 1 },
          actorContext: { schema: "C03", version: 1 },
          attributionContext: { schema: "C03", version: 1 },
        },
      });
    }

    async function insertSubmittedEvent(
      tx: Prisma.TransactionClient,
      applicationId: string,
      campaignIndex = 0,
    ) {
      await tx.applicationDomainEvent.create({
        data: {
          transitionId: randomUUID(),
          applicationId,
          applicationVersion: 1,
          eventName: ApplicationDomainEventName.SUBMITTED,
          fromStatus: null,
          toStatus: UceApplicationStatus.PENDING,
          actorClass: ApplicationEventActorClass.CREATOR_TEAM_USER,
          actorUserId: creatorUserId,
          actorMembershipId: creatorMembershipId,
          actorRole: CreatorTeamRole.OWNER,
          subjectCreatorProfileId: creatorProfileId,
          subjectCreatorWorkspaceId: creatorWorkspaceId,
          brandProfileId: brandIds[campaignIndex],
          campaignId: campaignIds[campaignIndex],
          canonicalCampaignAssetId: assetIds[campaignIndex],
          canonicalBriefId: briefIds[campaignIndex],
        },
      });
    }

    async function createCanonicalApplication(
      applicationId: string,
      order: EvidenceOrder,
      campaignIndex = 0,
    ) {
      await prisma.$transaction(async (tx) => {
        await insertApplication(tx, applicationId, campaignIndex);
        if (order === "SNAPSHOT_FIRST") {
          await insertSnapshot(tx, applicationId);
          await insertSubmittedEvent(tx, applicationId, campaignIndex);
        } else {
          await insertSubmittedEvent(tx, applicationId, campaignIndex);
          await insertSnapshot(tx, applicationId);
        }
      });
    }

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.pathname !== "/c03_p11d_fresh"
      ) {
        throw new Error(
          "C-03 P1.1D tests require disposable loopback c03_p11d_fresh.",
        );
      }

      for (const [index, brandId] of brandIds.entries()) {
        await prisma.brandProfile.create({
          data: {
            id: brandId,
            domain: `c03-p11d-${brandId}.example.test`,
            name: `C03 P1.1D Brand ${index}`,
            industry: "D2C",
            brandValues: [],
            policyFlags: [],
          },
        });
        await prisma.uceCampaign.create({
          data: {
            id: campaignIds[index],
            brandProfileId: brandId,
            name: `C03 P1.1D Campaign ${index}`,
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
            briefName: `C03 P1.1D Brief ${index}`,
          },
        });
      }

      await prisma.organization.create({
        data: {
          id: creatorOrganizationId,
          name: "C03 P1.1D Creator Workspace",
          kind: OrganizationKind.CREATOR,
        },
      });
      const creatorEmail = `c03-p11d-${creatorUserId}@example.test`;
      await prisma.user.create({
        data: {
          id: creatorUserId,
          email: creatorEmail,
          normalizedEmail: creatorEmail,
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          organizationId: creatorOrganizationId,
        },
      });
      await prisma.creatorProfile.create({
        data: { id: creatorProfileId, userId: creatorUserId },
      });
      await prisma.creatorWorkspace.create({
        data: {
          id: creatorWorkspaceId,
          ownerProfileId: creatorProfileId,
          organizationId: creatorOrganizationId,
        },
      });
      await prisma.creatorWorkspaceMember.create({
        data: {
          id: creatorMembershipId,
          workspaceId: creatorWorkspaceId,
          assignedProfileId: creatorProfileId,
          userId: creatorUserId,
          associatedEmail: creatorEmail,
          securityRole: CreatorTeamRole.OWNER,
          isActive: true,
          joinedAt: new Date(),
        },
      });
      const brandEmail = `c03-p11d-brand-${brandActorUserId}@example.test`;
      await prisma.organization.create({
        data: {
          id: brandActorOrganizationId,
          name: "C03 P1.1D Wrong-Role Brand Actor",
          kind: OrganizationKind.BRAND,
        },
      });
      await prisma.user.create({
        data: {
          id: brandActorUserId,
          email: brandEmail,
          normalizedEmail: brandEmail,
          role: UserRole.BRAND,
          authState: UserAuthState.ACTIVE,
          organizationId: brandActorOrganizationId,
        },
      });

      await createCanonicalApplication(
        snapshotFirstApplicationId,
        "SNAPSHOT_FIRST",
        0,
      );
      await createCanonicalApplication(
        eventFirstApplicationId,
        "EVENT_FIRST",
        1,
      );
      await createCanonicalApplication(
        terminalApplicationId,
        "SNAPSHOT_FIRST",
        2,
      );
    });

    afterAll(async () => {
      await Promise.all([prisma.$disconnect(), lockContender.$disconnect()]);
    });

    it("accepts both snapshot/event insertion orders and rejects incomplete commits", async () => {
      expect(
        await prisma.uceApplication.count({
          where: {
            id: {
              in: [snapshotFirstApplicationId, eventFirstApplicationId],
            },
          },
        }),
      ).toBe(2);

      await expect(
        prisma.$transaction(async (tx) => {
          const id = randomUUID();
          await insertApplication(tx, id, 3);
          await insertSubmittedEvent(tx, id, 3);
        }),
      ).rejects.toThrow(/C03_CANONICAL_APPLICATION_REQUIRES_ONE_SNAPSHOT/);

      await expect(
        prisma.$transaction(async (tx) => {
          const id = randomUUID();
          await insertApplication(tx, id, 4);
          await insertSnapshot(tx, id);
        }),
      ).rejects.toThrow(/C03_CANONICAL_APPLICATION_REQUIRES_MATCHING_EVENT/);
    });

    it("rejects invalid submission actors and immutable identity/version mutation", async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await insertApplication(tx, randomUUID(), 5, brandActorUserId);
        }),
      ).rejects.toThrow(/C03_APPLICATION_ACTOR_EVIDENCE_INVALID/);

      await expect(
        prisma.uceApplication.update({
          where: { id: snapshotFirstApplicationId },
          data: { canonicalBriefId: briefIds[1] },
        }),
      ).rejects.toThrow(/C03_APPLICATION_AUTHORITY_IMMUTABLE/);

      await expect(
        prisma.uceApplication.update({
          where: { id: snapshotFirstApplicationId },
          data: { statusVersion: 2 },
        }),
      ).rejects.toThrow(/C03_APPLICATION_VERSION_WITHOUT_TRANSITION/);

      await expect(
        prisma.uceApplication.update({
          where: { id: snapshotFirstApplicationId },
          data: { status: UceApplicationStatus.SUPERSEDED },
        }),
      ).rejects.toThrow(/C03_APPLICATION_TRANSITION_INVALID/);
    });

    it("makes Application, snapshot, event, and continuation evidence non-deletable", async () => {
      const snapshot = await prisma.uceApplicationSnapshot.findUniqueOrThrow({
        where: { applicationId: snapshotFirstApplicationId },
      });
      const event = await prisma.applicationDomainEvent.findFirstOrThrow({
        where: { applicationId: snapshotFirstApplicationId },
      });

      await expect(
        prisma.uceApplicationSnapshot.update({
          where: { id: snapshot.id },
          data: { campaignContext: { changed: true } },
        }),
      ).rejects.toThrow(/C03_APPLICATION_SNAPSHOT_IMMUTABLE/);
      await expect(
        prisma.uceApplicationSnapshot.delete({ where: { id: snapshot.id } }),
      ).rejects.toThrow(/C03_APPLICATION_SNAPSHOT_DELETE_FORBIDDEN/);
      await expect(
        prisma.applicationDomainEvent.delete({ where: { id: event.id } }),
      ).rejects.toThrow(/C03_APPLICATION_EVENT_APPEND_ONLY/);
      await expect(
        prisma.uceApplication.delete({
          where: { id: snapshotFirstApplicationId },
        }),
      ).rejects.toThrow(/C03_APPLICATION_DELETE_FORBIDDEN/);

      const continuation = await prisma.creatorEntryContinuation.create({
        data: {
          tokenDigest: "d".repeat(64),
          campaignId: campaignIds[0],
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await expect(
        prisma.creatorEntryContinuation.update({
          where: { id: continuation.id },
          data: { expiresAt: new Date(Date.now() + 120_000) },
        }),
      ).rejects.toThrow(/C01_CREATOR_ENTRY_CONTINUATION_AUTHORITY_IMMUTABLE/);
      await expect(
        prisma.creatorEntryContinuation.delete({
          where: { id: continuation.id },
        }),
      ).rejects.toThrow(/C03_CREATOR_ENTRY_CONTINUATION_DELETE_FORBIDDEN/);
    });

    it("permits one guarded terminal transition and rejects later transitions", async () => {
      const terminalAt = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.uceApplication.update({
          where: { id: terminalApplicationId },
          data: {
            status: UceApplicationStatus.WITHDRAWN,
            statusVersion: 2,
            terminalAt,
          },
        });
        await tx.applicationDomainEvent.create({
          data: {
            transitionId: randomUUID(),
            applicationId: terminalApplicationId,
            applicationVersion: 2,
            eventName: ApplicationDomainEventName.WITHDRAWN,
            fromStatus: UceApplicationStatus.PENDING,
            toStatus: UceApplicationStatus.WITHDRAWN,
            actorClass: ApplicationEventActorClass.CREATOR_TEAM_USER,
            actorUserId: creatorUserId,
            actorMembershipId: creatorMembershipId,
            actorRole: CreatorTeamRole.OWNER,
            subjectCreatorProfileId: creatorProfileId,
            subjectCreatorWorkspaceId: creatorWorkspaceId,
            brandProfileId: brandIds[2],
            campaignId: campaignIds[2],
            canonicalCampaignAssetId: assetIds[2],
            canonicalBriefId: briefIds[2],
          },
        });
      });

      await expect(
        prisma.uceApplication.update({
          where: { id: terminalApplicationId },
          data: {
            status: UceApplicationStatus.REJECTED,
            statusVersion: 3,
            terminalAt: new Date(),
          },
        }),
      ).rejects.toThrow(/C03_APPLICATION_TRANSITION_INVALID/);
    });

    it("serializes concurrent Campaign mutations through the shared lock service", async () => {
      const order: string[] = [];
      let releaseFirst!: () => void;
      let signalFirstLocked!: () => void;
      const firstLocked = new Promise<void>((resolve) => {
        signalFirstLocked = resolve;
      });
      const holdFirst = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });

      const first = prisma.$transaction(async (tx) => {
        await lockService.lockCampaign(tx, campaignIds[0]);
        order.push("first");
        signalFirstLocked();
        await holdFirst;
      });
      await firstLocked;

      let secondAcquired = false;
      const second = lockContender.$transaction(async (tx) => {
        await lockService.lockCampaign(tx, campaignIds[0]);
        secondAcquired = true;
        order.push("second");
      });

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(secondAcquired).toBe(false);
      releaseFirst();
      await Promise.all([first, second]);
      expect(order).toEqual(["first", "second"]);
    }, 10_000);

    it("installs the deferred guard and removes the temporary write closure", async () => {
      const triggers = await prisma.$queryRaw<
        Array<{
          name: string;
          deferrable: boolean;
          initially_deferred: boolean;
        }>
      >`
        SELECT tgname AS name,
          tgdeferrable AS deferrable,
          tginitdeferred AS initially_deferred
        FROM pg_trigger
        WHERE NOT tgisinternal
          AND tgname IN (
            'c03_canonical_application_write_closed',
            'c03_canonical_application_insert_guard',
            'c03_canonical_application_update_guard',
            'c03_application_delete_guard',
            'c03_canonical_application_evidence_guard'
          )
        ORDER BY tgname
      `;

      expect(triggers.map((row) => row.name)).not.toContain(
        "c03_canonical_application_write_closed",
      );
      expect(triggers.map((row) => row.name)).toEqual([
        "c03_application_delete_guard",
        "c03_canonical_application_evidence_guard",
        "c03_canonical_application_insert_guard",
        "c03_canonical_application_update_guard",
      ]);
      expect(
        triggers.find(
          (row) => row.name === "c03_canonical_application_evidence_guard",
        ),
      ).toMatchObject({ deferrable: true, initially_deferred: true });
    });
  },
);
