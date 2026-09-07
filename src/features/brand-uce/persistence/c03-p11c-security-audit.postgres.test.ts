import { randomUUID } from "node:crypto";

import {
  ApplicationCommandType,
  ApplicationDomainEventName,
  ApplicationEventActorClass,
  CampaignIngressTouchKind,
  CampaignOpportunityEntryAuthorityKind,
  CampaignOpportunityEntrySurface,
  CreatorTeamRole,
  OrganizationKind,
  PrismaClient,
  UceBriefStatus,
  UceCampaignAssetKind,
  UceCampaignShareChannel,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const DIGEST_C = "c".repeat(64);
const DIGEST_D = "d".repeat(64);
const DIGEST_E = "e".repeat(64);
const DIGEST_F = "f".repeat(64);

describe.skipIf(process.env.C03_P11C_DATABASE_TEST !== "true")(
  "C-03 P1.1C real-PostgreSQL security and audit persistence",
  () => {
    const prisma = new PrismaClient();
    const brandIds = [randomUUID(), randomUUID()];
    const campaignIds = [randomUUID(), randomUUID()];
    const assetIds = [randomUUID(), randomUUID()];
    const briefIds = [randomUUID(), randomUUID()];
    const shareIds = [randomUUID(), randomUUID()];
    const creatorOrganizationId = randomUUID();
    const creatorUserId = randomUUID();
    const creatorProfileId = randomUUID();
    const creatorWorkspaceId = randomUUID();
    const creatorMembershipId = randomUUID();
    const brandActorUserId = randomUUID();
    const applicationId = randomUUID();
    const secondApplicationId = randomUUID();

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.pathname !== "/c03_p11c_fresh"
      ) {
        throw new Error(
          "C-03 P1.1C tests require disposable loopback c03_p11c_fresh.",
        );
      }

      for (const [index, brandId] of brandIds.entries()) {
        await prisma.brandProfile.create({
          data: {
            id: brandId,
            domain: `c03-p11c-${brandId}.example.test`,
            name: `C03 P1.1C Brand ${index}`,
            industry: "D2C",
            brandValues: [],
            policyFlags: [],
          },
        });
        await prisma.uceCampaign.create({
          data: {
            id: campaignIds[index],
            brandProfileId: brandId,
            name: `C03 P1.1C Campaign ${index}`,
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
            briefName: `C03 P1.1C Brief ${index}`,
          },
        });
        await prisma.uceCampaignShare.create({
          data: {
            id: shareIds[index],
            requestId: randomUUID(),
            campaignId: campaignIds[index],
            channel: UceCampaignShareChannel.COPY_LINK,
            trackingToken: randomUUID(),
          },
        });
      }

      await prisma.organization.create({
        data: {
          id: creatorOrganizationId,
          name: "C03 P1.1C Creator Workspace",
          kind: OrganizationKind.CREATOR,
        },
      });
      const creatorEmail = `c03-p11c-${creatorUserId}@example.test`;
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
      const brandEmail = `c03-p11c-brand-${brandActorUserId}@example.test`;
      await prisma.user.create({
        data: {
          id: brandActorUserId,
          email: brandEmail,
          normalizedEmail: brandEmail,
          role: UserRole.BRAND,
        },
      });

      await prisma.$executeRawUnsafe(
        `ALTER TABLE uce_applications
         DISABLE TRIGGER c03_canonical_application_write_closed`,
      );
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO uce_applications
            (id, authority_version, campaign_id, brand_profile_id,
             canonical_campaign_asset_id, canonical_brief_id,
             subject_creator_profile_id, subject_creator_workspace_id,
             actor_user_id, actor_membership_id, actor_role,
             status, source, status_version, created_at, updated_at)
           VALUES ($1, 'C03_CANONICAL', $2, $3, $4, $5, $6, $7, $8, $9,
             'OWNER', 'PENDING', 'DIRECT', 1, NOW(), NOW())`,
          applicationId,
          campaignIds[0],
          brandIds[0],
          assetIds[0],
          briefIds[0],
          creatorProfileId,
          creatorWorkspaceId,
          creatorUserId,
          creatorMembershipId,
        );
        await prisma.$executeRawUnsafe(
          `INSERT INTO uce_applications
            (id, authority_version, campaign_id, brand_profile_id,
             canonical_campaign_asset_id, canonical_brief_id,
             subject_creator_profile_id, subject_creator_workspace_id,
             actor_user_id, actor_membership_id, actor_role,
             status, source, status_version, created_at, updated_at)
           VALUES ($1, 'C03_CANONICAL', $2, $3, $4, $5, $6, $7, $8, $9,
             'OWNER', 'PENDING', 'DIRECT', 1, NOW(), NOW())`,
          secondApplicationId,
          campaignIds[1],
          brandIds[1],
          assetIds[1],
          briefIds[1],
          creatorProfileId,
          creatorWorkspaceId,
          creatorUserId,
          creatorMembershipId,
        );
      } finally {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE uce_applications
           ENABLE TRIGGER c03_canonical_application_write_closed`,
        );
      }
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it("keeps canonical Application writes closed through P1.1C", async () => {
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE uce_applications SET updated_at = NOW() WHERE id = $1`,
          applicationId,
        ),
      ).rejects.toThrow(/C03_CANONICAL_APPLICATION_WRITE_CLOSED/);
    });

    it("enforces invitation digest, lifetime, Owner binding, revocation, and append-only rules", async () => {
      await expect(
        prisma.campaignOpportunityInvitation.create({
          data: {
            campaignId: campaignIds[0],
            tokenDigest: "weak",
            issuedByActorUserId: brandActorUserId,
            expiresAt: new Date(Date.now() + 60_000),
          },
        }),
      ).rejects.toBeTruthy();

      const invitation = await prisma.campaignOpportunityInvitation.create({
        data: {
          campaignId: campaignIds[0],
          tokenDigest: DIGEST_A,
          intendedCreatorProfileId: creatorProfileId,
          issuedByActorUserId: brandActorUserId,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await expect(
        prisma.campaignOpportunityInvitation.create({
          data: {
            campaignId: campaignIds[0],
            tokenDigest: DIGEST_B,
            intendedVerifiedEmailHmac: DIGEST_C,
            issuedByActorUserId: brandActorUserId,
            issuedAt: new Date(Date.now() + 120_000),
            expiresAt: new Date(Date.now() + 60_000),
          },
        }),
      ).rejects.toBeTruthy();

      await prisma.campaignOpportunityInvitation.update({
        where: { id: invitation.id },
        data: {
          bindingVersion: 1,
          boundCreatorProfileId: creatorProfileId,
          boundCreatorWorkspaceId: creatorWorkspaceId,
        },
      });
      await expect(
        prisma.campaignOpportunityInvitation.update({
          where: { id: invitation.id },
          data: { boundCreatorProfileId: randomUUID() },
        }),
      ).rejects.toThrow(/C03_INVITATION_REBIND_FORBIDDEN|foreign key/);

      await prisma.campaignOpportunityInvitation.update({
        where: { id: invitation.id },
        data: {
          revokedAt: new Date(),
          revokedByActorUserId: brandActorUserId,
        },
      });
      await expect(
        prisma.campaignOpportunityInvitation.update({
          where: { id: invitation.id },
          data: { revokedAt: null, revokedByActorUserId: null },
        }),
      ).rejects.toThrow(/C03_INVITATION_REVOCATION_IMMUTABLE/);
      await expect(
        prisma.campaignOpportunityInvitation.delete({
          where: { id: invitation.id },
        }),
      ).rejects.toThrow(/C03_INVITATION_DELETE_FORBIDDEN/);
    });

    it("enforces ingress authority, same-Campaign ancestry, bounded UTM, and monotonic binding", async () => {
      await expect(
        prisma.campaignIngressTouch.create({
          data: {
            kind: CampaignIngressTouchKind.QUALIFIED_INGRESS,
            referenceDigest: DIGEST_B,
            campaignId: campaignIds[0],
            entrySurface:
              CampaignOpportunityEntrySurface.TRACKED_CAMPAIGN_SHARE,
            entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.SHARE,
            campaignShareId: shareIds[1],
          },
        }),
      ).rejects.toBeTruthy();

      await expect(
        prisma.campaignIngressTouch.create({
          data: {
            kind: CampaignIngressTouchKind.QUALIFIED_INGRESS,
            referenceDigest: DIGEST_C,
            campaignId: campaignIds[0],
            entrySurface: CampaignOpportunityEntrySurface.DIRECT_CAMPAIGN_LINK,
            entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.DIRECT,
            utmSource: "bad\ncontrol",
          },
        }),
      ).rejects.toBeTruthy();

      const touch = await prisma.campaignIngressTouch.create({
        data: {
          kind: CampaignIngressTouchKind.QUALIFIED_INGRESS,
          referenceDigest: DIGEST_D,
          campaignId: campaignIds[0],
          entrySurface: CampaignOpportunityEntrySurface.TRACKED_CAMPAIGN_SHARE,
          entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.SHARE,
          campaignShareId: shareIds[0],
          utmSource: "creator-newsletter",
        },
      });
      await prisma.campaignIngressTouch.update({
        where: { id: touch.id },
        data: {
          boundCreatorProfileId: creatorProfileId,
          boundCreatorWorkspaceId: creatorWorkspaceId,
          boundAt: new Date(),
        },
      });
      await expect(
        prisma.campaignIngressTouch.update({
          where: { id: touch.id },
          data: { boundAt: new Date(Date.now() + 1_000) },
        }),
      ).rejects.toThrow(/C03_INGRESS_REBIND_FORBIDDEN/);
      await expect(
        prisma.campaignIngressTouch.delete({ where: { id: touch.id } }),
      ).rejects.toThrow(/C03_INGRESS_DELETE_FORBIDDEN/);
    });

    it("preserves direct C-01 continuation defaults and constrains typed references and subject binding", async () => {
      const direct = await prisma.creatorEntryContinuation.create({
        data: {
          tokenDigest: DIGEST_E,
          campaignId: campaignIds[0],
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      expect(direct).toMatchObject({
        contextVersion: 1,
        entrySurface: CampaignOpportunityEntrySurface.DIRECT_CAMPAIGN_LINK,
        entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.DIRECT,
      });

      await expect(
        prisma.creatorEntryContinuation.create({
          data: {
            tokenDigest: DIGEST_F,
            campaignId: campaignIds[0],
            entrySurface:
              CampaignOpportunityEntrySurface.TRACKED_CAMPAIGN_SHARE,
            entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.SHARE,
            campaignShareId: shareIds[1],
            expiresAt: new Date(Date.now() + 60_000),
          },
        }),
      ).rejects.toBeTruthy();

      await prisma.creatorEntryContinuation.update({
        where: { id: direct.id },
        data: {
          boundCreatorWorkspaceId: creatorWorkspaceId,
          boundCreatorProfileId: creatorProfileId,
        },
      });
      await expect(
        prisma.creatorEntryContinuation.update({
          where: { id: direct.id },
          data: {
            entrySurface: CampaignOpportunityEntrySurface.CREATOR_OPPORTUNITIES,
          },
        }),
      ).rejects.toThrow(/C01_CREATOR_ENTRY_CONTINUATION_AUTHORITY_IMMUTABLE/);
      await expect(
        prisma.creatorEntryContinuation.update({
          where: { id: direct.id },
          data: { boundCreatorProfileId: randomUUID() },
        }),
      ).rejects.toThrow(/C01_CREATOR_ENTRY_CONTINUATION_AUTHORITY_IMMUTABLE/);
    });

    it("enforces event identity/shape and append-only scoped command receipts", async () => {
      const transitionId = randomUUID();
      const event = await prisma.applicationDomainEvent.create({
        data: {
          transitionId,
          applicationId,
          applicationVersion: 1,
          eventName: ApplicationDomainEventName.SUBMITTED,
          fromStatus: null,
          toStatus: "PENDING",
          actorClass: ApplicationEventActorClass.CREATOR_TEAM_USER,
          actorUserId: creatorUserId,
          actorMembershipId: creatorMembershipId,
          actorRole: CreatorTeamRole.OWNER,
          subjectCreatorProfileId: creatorProfileId,
          subjectCreatorWorkspaceId: creatorWorkspaceId,
          brandProfileId: brandIds[0],
          campaignId: campaignIds[0],
          canonicalCampaignAssetId: assetIds[0],
          canonicalBriefId: briefIds[0],
        },
      });

      await expect(
        prisma.applicationDomainEvent.create({
          data: {
            transitionId: randomUUID(),
            applicationId,
            applicationVersion: 2,
            eventName: ApplicationDomainEventName.REJECTED,
            fromStatus: "PENDING",
            toStatus: "REJECTED",
            actorClass: ApplicationEventActorClass.BRAND_USER,
            actorUserId: brandActorUserId,
            subjectCreatorProfileId: creatorProfileId,
            subjectCreatorWorkspaceId: creatorWorkspaceId,
            brandProfileId: brandIds[0],
            campaignId: campaignIds[1],
            canonicalCampaignAssetId: assetIds[0],
            canonicalBriefId: briefIds[0],
          },
        }),
      ).rejects.toBeTruthy();

      const receipt = await prisma.applicationCommandReceipt.create({
        data: {
          commandType: ApplicationCommandType.SUBMIT,
          actorUserId: creatorUserId,
          authoritySubjectId: creatorProfileId,
          idempotencyKeyDigest: DIGEST_B,
          requestFingerprint: DIGEST_C,
          applicationId,
          transitionId,
        },
      });

      const secondTransitionId = randomUUID();
      await prisma.applicationDomainEvent.create({
        data: {
          transitionId: secondTransitionId,
          applicationId: secondApplicationId,
          applicationVersion: 1,
          eventName: ApplicationDomainEventName.SUBMITTED,
          fromStatus: null,
          toStatus: "PENDING",
          actorClass: ApplicationEventActorClass.CREATOR_TEAM_USER,
          actorUserId: creatorUserId,
          actorMembershipId: creatorMembershipId,
          actorRole: CreatorTeamRole.OWNER,
          subjectCreatorProfileId: creatorProfileId,
          subjectCreatorWorkspaceId: creatorWorkspaceId,
          brandProfileId: brandIds[1],
          campaignId: campaignIds[1],
          canonicalCampaignAssetId: assetIds[1],
          canonicalBriefId: briefIds[1],
        },
      });

      await expect(
        prisma.applicationCommandReceipt.create({
          data: {
            commandType: ApplicationCommandType.SUBMIT,
            actorUserId: creatorUserId,
            authoritySubjectId: randomUUID(),
            idempotencyKeyDigest: DIGEST_D,
            requestFingerprint: DIGEST_E,
            applicationId: secondApplicationId,
            transitionId: secondTransitionId,
          },
        }),
      ).rejects.toThrow(/C03_RECEIPT_AUTHORITY_MISMATCH/);

      await expect(
        prisma.applicationCommandReceipt.create({
          data: {
            commandType: ApplicationCommandType.SUBMIT,
            actorUserId: creatorUserId,
            authoritySubjectId: creatorProfileId,
            idempotencyKeyDigest: DIGEST_B,
            requestFingerprint: DIGEST_D,
            applicationId: secondApplicationId,
            transitionId: secondTransitionId,
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.applicationCommandReceipt.update({
          where: { id: receipt.id },
          data: { requestFingerprint: DIGEST_D },
        }),
      ).rejects.toThrow(/C03_APPLICATION_RECEIPT_APPEND_ONLY/);
      await expect(
        prisma.applicationCommandReceipt.delete({ where: { id: receipt.id } }),
      ).rejects.toThrow(/C03_APPLICATION_RECEIPT_APPEND_ONLY/);
      await expect(
        prisma.applicationDomainEvent.update({
          where: { id: event.id },
          data: { occurredAt: new Date() },
        }),
      ).rejects.toThrow(/C03_APPLICATION_EVENT_APPEND_ONLY/);
      await expect(
        prisma.applicationDomainEvent.delete({ where: { id: event.id } }),
      ).rejects.toThrow(/C03_APPLICATION_EVENT_APPEND_ONLY/);
    });

    it("installs digest-only columns, exact enum mappings, composite FKs, and append-only triggers", async () => {
      const forbiddenColumns = await prisma.$queryRaw<
        Array<{ table_name: string; column_name: string }>
      >`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN (
            'campaign_opportunity_invitations',
            'campaign_ingress_touches',
            'application_command_receipts'
          )
          AND column_name ~ '(raw|token|credential|email)$'
          AND column_name NOT IN ('token_digest')
      `;
      expect(forbiddenColumns).toEqual([]);

      const enums = await prisma.$queryRaw<
        Array<{ name: string; values: string[] }>
      >`
        SELECT typ.typname AS name,
          array_agg(en.enumlabel ORDER BY en.enumsortorder) AS values
        FROM pg_type typ
        JOIN pg_enum en ON en.enumtypid = typ.oid
        WHERE typ.typname IN (
          'CampaignOpportunityEntrySurface',
          'CampaignOpportunityEntryAuthorityKind',
          'CampaignIngressTouchKind',
          'ApplicationCommandType',
          'ApplicationDomainEventName',
          'ApplicationEventActorClass'
        )
        GROUP BY typ.typname
      `;
      expect(enums).toHaveLength(6);
      expect(
        enums.find((row) => row.name === "ApplicationDomainEventName")?.values,
      ).toEqual([
        "application.submitted",
        "application.approved",
        "application.rejected",
        "application.withdrawn",
        "application.expired",
      ]);

      const requiredObjects = await prisma.$queryRaw<Array<{ name: string }>>`
        SELECT conname AS name
        FROM pg_constraint
        WHERE conname IN (
          'campaign_opportunity_invitations_bound_workspace_owner_fkey',
          'campaign_ingress_touches_campaign_share_fkey',
          'creator_entry_continuations_invitation_fkey',
          'uce_applications_first_qualified_touch_fkey',
          'application_domain_events_application_id_fkey',
          'application_command_receipts_transition_id_fkey'
        )
        UNION ALL
        SELECT tgname AS name
        FROM pg_trigger
        WHERE NOT tgisinternal
          AND tgname IN (
            'c03_canonical_application_write_closed',
            'c03_campaign_invitation_delete_guard',
            'c03_campaign_ingress_delete_guard',
            'c03_application_event_delete_guard',
            'c03_application_receipt_delete_guard'
          )
      `;
      expect(new Set(requiredObjects.map((row) => row.name)).size).toBe(11);
    });
  },
);
