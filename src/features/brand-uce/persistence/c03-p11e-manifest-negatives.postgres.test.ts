import { createHash, randomUUID } from "node:crypto";

import {
  ApplicationCommandType,
  ApplicationDomainEventName,
  ApplicationEventActorClass,
  CampaignIngressTouchKind,
  CampaignOpportunityEntryAuthorityKind,
  CampaignOpportunityEntrySurface,
  CreatorTeamRole,
  OrganizationKind,
  Prisma,
  PrismaClient,
  UceApplicationSnapshotVersion,
  UceApplicationSource,
  UceApplicationStatus,
  UceBriefStatus,
  UceCampaignAssetKind,
  UceCampaignShareChannel,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type ApplicationOverrides = {
  campaignId?: string;
  brandProfileId?: string;
  assetId?: string;
  briefId?: string;
  subjectProfileId?: string;
  subjectWorkspaceId?: string;
  actorUserId?: string;
  actorMembershipId?: string;
  actorRole?: CreatorTeamRole;
  invitationId?: string | null;
  firstTouchId?: string | null;
  conversionTouchId?: string | null;
  status?: UceApplicationStatus;
  source?: UceApplicationSource;
  statusVersion?: number;
  terminalAt?: Date | null;
  appliedAt?: Date;
};

type SnapshotOverrides = {
  schemaVersion?: UceApplicationSnapshotVersion | null;
  campaignContext?: Prisma.InputJsonValue;
  actorContext?: Prisma.InputJsonValue | null;
  attributionContext?: Prisma.InputJsonValue | null;
};

const opportunityCount = 64;

describe.skipIf(process.env.C03_P11E_DATABASE_TEST !== "true")(
  "C-03 P1.1E manifest negative PostgreSQL acceptance",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { maxWait: 10_000, timeout: 20_000 },
    });
    const brandProfileIds = [randomUUID(), randomUUID()];
    const campaignIds = Array.from({ length: opportunityCount }, () =>
      randomUUID(),
    );
    const assetIds = Array.from({ length: opportunityCount }, () =>
      randomUUID(),
    );
    const briefIds = Array.from({ length: opportunityCount }, () =>
      randomUUID(),
    );
    const otherCampaignId = randomUUID();
    const otherAssetId = randomUUID();
    const otherBriefId = randomUUID();
    const shareIds = [randomUUID(), randomUUID()];

    const creatorOrganizationId = randomUUID();
    const creatorUserId = randomUUID();
    const creatorProfileId = randomUUID();
    const creatorWorkspaceId = randomUUID();
    const creatorMembershipId = randomUUID();

    const teammateUserId = randomUUID();
    const teammateProfileId = randomUUID();
    const inactiveMembershipId = randomUUID();

    const otherCreatorOrganizationId = randomUUID();
    const otherCreatorUserId = randomUUID();
    const otherCreatorProfileId = randomUUID();
    const otherCreatorWorkspaceId = randomUUID();
    const otherCreatorMembershipId = randomUUID();

    const brandActorOrganizationId = randomUUID();
    const brandActorUserId = randomUUID();

    let opportunityCursor = 0;

    function takeOpportunity(): number {
      const index = opportunityCursor;
      opportunityCursor += 1;
      if (index >= opportunityCount) {
        throw new Error("C03_P11E_OPPORTUNITY_FIXTURE_EXHAUSTED");
      }
      return index;
    }

    function digest(label = randomUUID()): string {
      return createHash("sha256").update(label).digest("hex");
    }

    async function insertApplication(
      tx: Prisma.TransactionClient,
      applicationId: string,
      opportunityIndex: number,
      overrides: ApplicationOverrides = {},
    ) {
      await tx.$executeRawUnsafe(
        `INSERT INTO uce_applications
          (id, authority_version, campaign_id, brand_profile_id,
           canonical_campaign_asset_id, canonical_brief_id,
           subject_creator_profile_id, subject_creator_workspace_id,
           actor_user_id, actor_membership_id, actor_role,
           campaign_invitation_id, first_qualified_touch_id,
           conversion_touch_id, status, source, status_version, terminal_at,
           applied_at, created_at, updated_at)
         VALUES ($1, 'C03_CANONICAL', $2, $3, $4, $5, $6, $7, $8, $9,
           $10::"CreatorTeamRole", $11, $12, $13,
           $14::"UceApplicationStatus", $15::"UceApplicationSource", $16,
           $17, $18, NOW(), NOW())`,
        applicationId,
        overrides.campaignId ?? campaignIds[opportunityIndex],
        overrides.brandProfileId ?? brandProfileIds[0],
        overrides.assetId ?? assetIds[opportunityIndex],
        overrides.briefId ?? briefIds[opportunityIndex],
        overrides.subjectProfileId ?? creatorProfileId,
        overrides.subjectWorkspaceId ?? creatorWorkspaceId,
        overrides.actorUserId ?? creatorUserId,
        overrides.actorMembershipId ?? creatorMembershipId,
        overrides.actorRole ?? CreatorTeamRole.OWNER,
        overrides.invitationId ?? null,
        overrides.firstTouchId ?? null,
        overrides.conversionTouchId ?? null,
        overrides.status ?? UceApplicationStatus.PENDING,
        overrides.source ?? UceApplicationSource.DIRECT,
        overrides.statusVersion ?? 1,
        overrides.terminalAt ?? null,
        overrides.appliedAt ?? new Date(),
      );
    }

    async function insertSnapshot(
      tx: Prisma.TransactionClient,
      applicationId: string,
      overrides: SnapshotOverrides = {},
    ) {
      await tx.$executeRawUnsafe(
        `INSERT INTO uce_application_snapshots
          (id, application_id, schema_version, campaign_context,
           campaign_asset_context, brief_context, commercial_context,
           creator_identity, actor_context, attribution_context, created_at)
         VALUES ($1, $2, $3::"UceApplicationSnapshotVersion", $4::jsonb,
           $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb,
           $10::jsonb, NOW())`,
        randomUUID(),
        applicationId,
        overrides.schemaVersion === undefined
          ? UceApplicationSnapshotVersion.C03_APPLICATION_SNAPSHOT_V1
          : overrides.schemaVersion,
        JSON.stringify(overrides.campaignContext ?? { schema: "C03", v: 1 }),
        JSON.stringify({ schema: "C03", v: 1 }),
        JSON.stringify({ schema: "C03", v: 1 }),
        JSON.stringify({ schema: "C03", v: 1 }),
        JSON.stringify({ schema: "C03", v: 1 }),
        overrides.actorContext === null
          ? null
          : JSON.stringify(overrides.actorContext ?? { schema: "C03", v: 1 }),
        overrides.attributionContext === null
          ? null
          : JSON.stringify(
              overrides.attributionContext ?? { schema: "C03", v: 1 },
            ),
      );
    }

    async function insertSubmittedEvent(
      tx: Prisma.TransactionClient,
      applicationId: string,
      opportunityIndex: number,
      overrides: Partial<Prisma.ApplicationDomainEventUncheckedCreateInput> = {},
    ): Promise<string> {
      const transitionId = overrides.transitionId ?? randomUUID();
      await tx.applicationDomainEvent.create({
        data: {
          transitionId,
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
          brandProfileId: brandProfileIds[0],
          campaignId: campaignIds[opportunityIndex],
          canonicalCampaignAssetId: assetIds[opportunityIndex],
          canonicalBriefId: briefIds[opportunityIndex],
          ...overrides,
        } as Prisma.ApplicationDomainEventUncheckedCreateInput,
      });
      return transitionId;
    }

    async function createCanonicalApplication(
      opportunityIndex: number,
      order: "SNAPSHOT_FIRST" | "EVENT_FIRST" = "SNAPSHOT_FIRST",
      overrides: ApplicationOverrides = {},
    ): Promise<{ applicationId: string; transitionId: string }> {
      const applicationId = randomUUID();
      let transitionId = "";
      await prisma.$transaction(async (tx) => {
        await insertApplication(tx, applicationId, opportunityIndex, overrides);
        if (order === "SNAPSHOT_FIRST") {
          await insertSnapshot(tx, applicationId);
          transitionId = await insertSubmittedEvent(
            tx,
            applicationId,
            opportunityIndex,
          );
        } else {
          transitionId = await insertSubmittedEvent(
            tx,
            applicationId,
            opportunityIndex,
          );
          await insertSnapshot(tx, applicationId);
        }
      });
      return { applicationId, transitionId };
    }

    async function transitionApplication(
      applicationId: string,
      status:
        | UceApplicationStatus.APPROVED
        | UceApplicationStatus.REJECTED
        | UceApplicationStatus.WITHDRAWN
        | UceApplicationStatus.EXPIRED,
    ): Promise<string> {
      const application = await prisma.uceApplication.findUniqueOrThrow({
        where: { id: applicationId },
      });
      const transitionId = randomUUID();
      const eventName = {
        [UceApplicationStatus.APPROVED]: ApplicationDomainEventName.APPROVED,
        [UceApplicationStatus.REJECTED]: ApplicationDomainEventName.REJECTED,
        [UceApplicationStatus.WITHDRAWN]: ApplicationDomainEventName.WITHDRAWN,
        [UceApplicationStatus.EXPIRED]: ApplicationDomainEventName.EXPIRED,
      }[status];
      const creatorTransition = status === UceApplicationStatus.WITHDRAWN;
      const brandTransition =
        status === UceApplicationStatus.APPROVED ||
        status === UceApplicationStatus.REJECTED;

      await prisma.$transaction(async (tx) => {
        await tx.uceApplication.update({
          where: { id: applicationId },
          data: { status, statusVersion: 2, terminalAt: new Date() },
        });
        await tx.applicationDomainEvent.create({
          data: {
            transitionId,
            applicationId,
            applicationVersion: 2,
            eventName,
            fromStatus: UceApplicationStatus.PENDING,
            toStatus: status,
            actorClass: creatorTransition
              ? ApplicationEventActorClass.CREATOR_TEAM_USER
              : brandTransition
                ? ApplicationEventActorClass.BRAND_USER
                : ApplicationEventActorClass.SYSTEM,
            actorUserId: creatorTransition
              ? creatorUserId
              : brandTransition
                ? brandActorUserId
                : null,
            actorMembershipId: creatorTransition ? creatorMembershipId : null,
            actorRole: creatorTransition ? CreatorTeamRole.OWNER : null,
            subjectCreatorProfileId: application.subjectCreatorProfileId!,
            subjectCreatorWorkspaceId: application.subjectCreatorWorkspaceId!,
            brandProfileId: application.brandProfileId!,
            campaignId: application.campaignId,
            canonicalCampaignAssetId: application.canonicalCampaignAssetId!,
            canonicalBriefId: application.canonicalBriefId!,
          },
        });
      });
      return transitionId;
    }

    async function createInvitation(input: {
      campaignId: string;
      boundProfileId?: string;
      boundWorkspaceId?: string;
      bindingVersion?: number;
    }) {
      return prisma.campaignOpportunityInvitation.create({
        data: {
          campaignId: input.campaignId,
          tokenDigest: digest(),
          intendedCreatorProfileId: creatorProfileId,
          issuedByActorUserId: brandActorUserId,
          expiresAt: new Date(Date.now() + 60_000),
          bindingVersion: input.bindingVersion ?? 0,
          boundCreatorProfileId: input.boundProfileId,
          boundCreatorWorkspaceId: input.boundWorkspaceId,
        },
      });
    }

    async function createTouch(input: {
      campaignId: string;
      kind: CampaignIngressTouchKind;
      boundProfileId?: string;
      boundWorkspaceId?: string;
    }) {
      return prisma.campaignIngressTouch.create({
        data: {
          kind: input.kind,
          referenceDigest:
            input.kind === CampaignIngressTouchKind.QUALIFIED_INGRESS
              ? digest()
              : null,
          campaignId: input.campaignId,
          entrySurface: CampaignOpportunityEntrySurface.DIRECT_CAMPAIGN_LINK,
          entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.DIRECT,
          boundCreatorProfileId: input.boundProfileId,
          boundCreatorWorkspaceId: input.boundWorkspaceId,
          boundAt:
            input.boundProfileId && input.boundWorkspaceId
              ? new Date()
              : undefined,
        },
      });
    }

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.pathname !== "/c03_p11e_fresh"
      ) {
        throw new Error(
          "C-03 P1.1E tests require disposable loopback c03_p11e_fresh.",
        );
      }

      for (const [index, brandProfileId] of brandProfileIds.entries()) {
        await prisma.brandProfile.create({
          data: {
            id: brandProfileId,
            domain: `c03-p11e-${brandProfileId}.example.test`,
            name: `C03 P1.1E Brand ${index}`,
            industry: "D2C",
            brandValues: [],
            policyFlags: [],
          },
        });
      }

      for (let index = 0; index < opportunityCount; index += 1) {
        await prisma.uceCampaign.create({
          data: {
            id: campaignIds[index],
            brandProfileId: brandProfileIds[0],
            name: `C03 P1.1E Campaign ${index}`,
          },
        });
        await prisma.uceCampaignAsset.create({
          data: {
            id: assetIds[index],
            campaignId: campaignIds[index],
            kind: UceCampaignAssetKind.BRAND,
            brandProfileId: brandProfileIds[0],
          },
        });
        await prisma.canonicalCampaignBrief.create({
          data: {
            id: briefIds[index],
            campaignAssetId: assetIds[index],
            status: UceBriefStatus.PUBLISHED,
            briefName: `C03 P1.1E Brief ${index}`,
          },
        });
      }

      await prisma.uceCampaign.create({
        data: {
          id: otherCampaignId,
          brandProfileId: brandProfileIds[1],
          name: "C03 P1.1E Other Brand Campaign",
        },
      });
      await prisma.uceCampaignAsset.create({
        data: {
          id: otherAssetId,
          campaignId: otherCampaignId,
          kind: UceCampaignAssetKind.BRAND,
          brandProfileId: brandProfileIds[1],
        },
      });
      await prisma.canonicalCampaignBrief.create({
        data: {
          id: otherBriefId,
          campaignAssetId: otherAssetId,
          status: UceBriefStatus.PUBLISHED,
          briefName: "C03 P1.1E Other Brand Brief",
        },
      });

      await prisma.uceCampaignShare.create({
        data: {
          id: shareIds[0],
          requestId: randomUUID(),
          campaignId: campaignIds[0],
          channel: UceCampaignShareChannel.COPY_LINK,
          trackingToken: randomUUID(),
        },
      });
      await prisma.uceCampaignShare.create({
        data: {
          id: shareIds[1],
          requestId: randomUUID(),
          campaignId: otherCampaignId,
          channel: UceCampaignShareChannel.COPY_LINK,
          trackingToken: randomUUID(),
        },
      });

      await prisma.organization.create({
        data: {
          id: creatorOrganizationId,
          name: "C03 P1.1E Creator Organization",
          kind: OrganizationKind.CREATOR,
        },
      });
      const creatorEmail = `c03-p11e-${creatorUserId}@example.test`;
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

      const teammateEmail = `c03-p11e-${teammateUserId}@example.test`;
      await prisma.user.create({
        data: {
          id: teammateUserId,
          email: teammateEmail,
          normalizedEmail: teammateEmail,
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          organizationId: creatorOrganizationId,
        },
      });
      await prisma.creatorProfile.create({
        data: { id: teammateProfileId, userId: teammateUserId },
      });
      await prisma.creatorWorkspaceMember.create({
        data: {
          id: inactiveMembershipId,
          workspaceId: creatorWorkspaceId,
          assignedProfileId: teammateProfileId,
          userId: teammateUserId,
          associatedEmail: teammateEmail,
          securityRole: CreatorTeamRole.ASSISTANT,
          isActive: false,
          joinedAt: new Date(),
        },
      });

      await prisma.organization.create({
        data: {
          id: otherCreatorOrganizationId,
          name: "C03 P1.1E Other Creator Organization",
          kind: OrganizationKind.CREATOR,
        },
      });
      const otherCreatorEmail = `c03-p11e-${otherCreatorUserId}@example.test`;
      await prisma.user.create({
        data: {
          id: otherCreatorUserId,
          email: otherCreatorEmail,
          normalizedEmail: otherCreatorEmail,
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          organizationId: otherCreatorOrganizationId,
        },
      });
      await prisma.creatorProfile.create({
        data: { id: otherCreatorProfileId, userId: otherCreatorUserId },
      });
      await prisma.creatorWorkspace.create({
        data: {
          id: otherCreatorWorkspaceId,
          ownerProfileId: otherCreatorProfileId,
          organizationId: otherCreatorOrganizationId,
        },
      });
      await prisma.creatorWorkspaceMember.create({
        data: {
          id: otherCreatorMembershipId,
          workspaceId: otherCreatorWorkspaceId,
          assignedProfileId: otherCreatorProfileId,
          userId: otherCreatorUserId,
          associatedEmail: otherCreatorEmail,
          securityRole: CreatorTeamRole.OWNER,
          isActive: true,
          joinedAt: new Date(),
        },
      });

      await prisma.organization.create({
        data: {
          id: brandActorOrganizationId,
          name: "C03 P1.1E Brand Actor Organization",
          kind: OrganizationKind.BRAND,
        },
      });
      const brandActorEmail = `c03-p11e-${brandActorUserId}@example.test`;
      await prisma.user.create({
        data: {
          id: brandActorUserId,
          email: brandActorEmail,
          normalizedEmail: brandActorEmail,
          role: UserRole.BRAND,
          authState: UserAuthState.ACTIVE,
          organizationId: brandActorOrganizationId,
        },
      });
    }, 120_000);

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it("[01] rejects Campaign/Brand composite mismatch", async () => {
      const index = takeOpportunity();
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), index, {
            brandProfileId: brandProfileIds[1],
          }),
        ),
      ).rejects.toBeTruthy();
    });

    it("[02] rejects Application Campaign/Asset mismatch", async () => {
      const index = takeOpportunity();
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), index, {
            assetId: otherAssetId,
            briefId: otherBriefId,
          }),
        ),
      ).rejects.toBeTruthy();
    });

    it("[03] rejects Application Asset/Brief mismatch", async () => {
      const index = takeOpportunity();
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), index, {
            briefId: otherBriefId,
          }),
        ),
      ).rejects.toBeTruthy();
    });

    it("[06] rejects mixed and incomplete authority shapes", async () => {
      const mixedIndex = takeOpportunity();
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO uce_applications
            (id, authority_version, request_id, campaign_id, brand_profile_id,
             canonical_campaign_asset_id, canonical_brief_id,
             subject_creator_profile_id, subject_creator_workspace_id,
             actor_user_id, actor_membership_id, actor_role,
             status, source, status_version, created_at, updated_at)
           VALUES ($1, 'C03_CANONICAL', $2, $3, $4, $5, $6, $7, $8, $9,
             $10, 'OWNER', 'PENDING', 'DIRECT', 1, NOW(), NOW())`,
          randomUUID(),
          randomUUID(),
          campaignIds[mixedIndex],
          brandProfileIds[0],
          assetIds[mixedIndex],
          briefIds[mixedIndex],
          creatorProfileId,
          creatorWorkspaceId,
          creatorUserId,
          creatorMembershipId,
        ),
      ).rejects.toBeTruthy();

      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO uce_applications
            (id, campaign_id, status, source, created_at, updated_at)
           VALUES ($1, $2, 'PENDING', 'DIRECT', NOW(), NOW())`,
          randomUUID(),
          campaignIds[takeOpportunity()],
        ),
      ).rejects.toBeTruthy();
    });

    it("[07] rejects non-PENDING or non-version-1 canonical INSERT", async () => {
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), takeOpportunity(), {
            status: UceApplicationStatus.APPROVED,
            statusVersion: 2,
            terminalAt: new Date(),
          }),
        ),
      ).rejects.toThrow(/C03_APPLICATION_INITIAL_STATE_INVALID/);
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), takeOpportunity(), {
            statusVersion: 2,
          }),
        ),
      ).rejects.toThrow(/C03_APPLICATION_INITIAL_STATE_INVALID/);
    });

    it("[08] enforces active same-opportunity uniqueness and terminal retry predicate", async () => {
      const pendingIndex = takeOpportunity();
      await createCanonicalApplication(pendingIndex);
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), pendingIndex),
        ),
      ).rejects.toBeTruthy();

      const approvedIndex = takeOpportunity();
      const approved = await createCanonicalApplication(approvedIndex);
      await transitionApplication(
        approved.applicationId,
        UceApplicationStatus.APPROVED,
      );
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), approvedIndex),
        ),
      ).rejects.toBeTruthy();

      const rejectedIndex = takeOpportunity();
      const rejected = await createCanonicalApplication(rejectedIndex);
      await transitionApplication(
        rejected.applicationId,
        UceApplicationStatus.REJECTED,
      );
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), rejectedIndex),
        ),
      ).rejects.toBeTruthy();

      const withdrawnIndex = takeOpportunity();
      const withdrawn = await createCanonicalApplication(withdrawnIndex);
      await transitionApplication(
        withdrawn.applicationId,
        UceApplicationStatus.WITHDRAWN,
      );
      await createCanonicalApplication(withdrawnIndex);

      const expiredIndex = takeOpportunity();
      const expired = await createCanonicalApplication(expiredIndex);
      await transitionApplication(
        expired.applicationId,
        UceApplicationStatus.EXPIRED,
      );
      await createCanonicalApplication(expiredIndex);

      const rows = await prisma.$queryRaw<Array<{ definition: string }>>`
        SELECT indexdef AS definition
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'uce_applications_canonical_active_opportunity_key'
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0].definition).toContain("SUPERSEDED");
      expect(rows[0].definition).not.toContain("WITHDRAWN");
      expect(rows[0].definition).not.toContain("EXPIRED");
    });

    it("[09] rejects inactive, wrong-workspace, wrong-User, and wrong-role actor evidence", async () => {
      const cases: ApplicationOverrides[] = [
        {
          actorUserId: teammateUserId,
          actorMembershipId: inactiveMembershipId,
          actorRole: CreatorTeamRole.ASSISTANT,
        },
        {
          actorUserId: otherCreatorUserId,
          actorMembershipId: otherCreatorMembershipId,
          actorRole: CreatorTeamRole.OWNER,
        },
        { actorUserId: teammateUserId },
        { actorRole: CreatorTeamRole.ASSISTANT },
      ];
      for (const overrides of cases) {
        await expect(
          prisma.$transaction((tx) =>
            insertApplication(tx, randomUUID(), takeOpportunity(), overrides),
          ),
        ).rejects.toThrow(/C03_APPLICATION_ACTOR_EVIDENCE_INVALID/);
      }
    });

    it("[10] rejects a subject profile that is not the workspace Owner", async () => {
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), takeOpportunity(), {
            subjectProfileId: teammateProfileId,
          }),
        ),
      ).rejects.toBeTruthy();
    });

    it("[11] rejects optional invitation and touch references with wrong Campaign or subject", async () => {
      const campaignMismatchIndex = takeOpportunity();
      const otherInvitation = await createInvitation({
        campaignId: otherCampaignId,
        bindingVersion: 1,
        boundProfileId: creatorProfileId,
        boundWorkspaceId: creatorWorkspaceId,
      });
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), campaignMismatchIndex, {
            invitationId: otherInvitation.id,
          }),
        ),
      ).rejects.toBeTruthy();

      const invitationIndex = takeOpportunity();
      const wrongSubjectInvitation = await createInvitation({
        campaignId: campaignIds[invitationIndex],
        bindingVersion: 1,
        boundProfileId: otherCreatorProfileId,
        boundWorkspaceId: otherCreatorWorkspaceId,
      });
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), invitationIndex, {
            invitationId: wrongSubjectInvitation.id,
          }),
        ),
      ).rejects.toThrow(/C03_APPLICATION_INVITATION_SUBJECT_MISMATCH/);

      const qualifiedIndex = takeOpportunity();
      const wrongQualifiedTouch = await createTouch({
        campaignId: campaignIds[qualifiedIndex],
        kind: CampaignIngressTouchKind.QUALIFIED_INGRESS,
        boundProfileId: otherCreatorProfileId,
        boundWorkspaceId: otherCreatorWorkspaceId,
      });
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), qualifiedIndex, {
            firstTouchId: wrongQualifiedTouch.id,
          }),
        ),
      ).rejects.toThrow(/C03_APPLICATION_FIRST_TOUCH_SUBJECT_MISMATCH/);

      const conversionIndex = takeOpportunity();
      const wrongConversionTouch = await createTouch({
        campaignId: campaignIds[conversionIndex],
        kind: CampaignIngressTouchKind.APPLICATION_CONVERSION,
        boundProfileId: otherCreatorProfileId,
        boundWorkspaceId: otherCreatorWorkspaceId,
      });
      await expect(
        prisma.$transaction((tx) =>
          insertApplication(tx, randomUUID(), conversionIndex, {
            conversionTouchId: wrongConversionTouch.id,
          }),
        ),
      ).rejects.toThrow(/C03_APPLICATION_CONVERSION_TOUCH_SUBJECT_MISMATCH/);
    });

    it("[12] rejects commit without exactly one canonical snapshot", async () => {
      const index = takeOpportunity();
      await expect(
        prisma.$transaction(async (tx) => {
          const applicationId = randomUUID();
          await insertApplication(tx, applicationId, index);
          await insertSubmittedEvent(tx, applicationId, index);
        }),
      ).rejects.toThrow(/C03_CANONICAL_APPLICATION_REQUIRES_ONE_SNAPSHOT/);
    });

    it("[13] rejects second, wrong-version/shape, mutable, or deleted snapshot evidence", async () => {
      const valid = await createCanonicalApplication(takeOpportunity());
      await expect(
        prisma.$transaction((tx) => insertSnapshot(tx, valid.applicationId)),
      ).rejects.toBeTruthy();

      await expect(
        prisma.$transaction(async (tx) => {
          const index = takeOpportunity();
          const applicationId = randomUUID();
          await insertApplication(tx, applicationId, index);
          await insertSnapshot(tx, applicationId, { schemaVersion: null });
        }),
      ).rejects.toThrow(/C03_APPLICATION_SNAPSHOT_SHAPE_INVALID/);

      await expect(
        prisma.$transaction(async (tx) => {
          const index = takeOpportunity();
          const applicationId = randomUUID();
          await insertApplication(tx, applicationId, index);
          await insertSnapshot(tx, applicationId, { campaignContext: [] });
        }),
      ).rejects.toThrow(/C03_APPLICATION_SNAPSHOT_SHAPE_INVALID/);

      const snapshot = await prisma.uceApplicationSnapshot.findUniqueOrThrow({
        where: { applicationId: valid.applicationId },
      });
      await expect(
        prisma.uceApplicationSnapshot.update({
          where: { id: snapshot.id },
          data: { actorContext: { changed: true } },
        }),
      ).rejects.toThrow(/C03_APPLICATION_SNAPSHOT_IMMUTABLE/);
      await expect(
        prisma.uceApplicationSnapshot.delete({ where: { id: snapshot.id } }),
      ).rejects.toThrow(/C03_APPLICATION_SNAPSHOT_DELETE_FORBIDDEN/);
    });

    it("[14] rejects canonical identity, selection, source, appliedAt mutation and delete", async () => {
      const valid = await createCanonicalApplication(takeOpportunity());
      const mutations: Prisma.UceApplicationUpdateInput[] = [
        { brandProfileId: brandProfileIds[1] },
        { canonicalCampaignAssetId: otherAssetId },
        { canonicalBriefId: otherBriefId },
        { source: UceApplicationSource.OUTREACH },
        { appliedAt: new Date(Date.now() + 1_000) },
      ];
      for (const data of mutations) {
        await expect(
          prisma.uceApplication.update({
            where: { id: valid.applicationId },
            data,
          }),
        ).rejects.toThrow(/C03_APPLICATION_AUTHORITY_IMMUTABLE/);
      }
      await expect(
        prisma.uceApplication.delete({ where: { id: valid.applicationId } }),
      ).rejects.toThrow(/C03_APPLICATION_DELETE_FORBIDDEN/);
    });

    it("[15] rejects illegal and inconsistent terminal transitions", async () => {
      const pending = await createCanonicalApplication(takeOpportunity());
      await expect(
        prisma.uceApplication.update({
          where: { id: pending.applicationId },
          data: { statusVersion: 2 },
        }),
      ).rejects.toThrow(/C03_APPLICATION_VERSION_WITHOUT_TRANSITION/);
      await expect(
        prisma.uceApplication.update({
          where: { id: pending.applicationId },
          data: {
            status: UceApplicationStatus.SUPERSEDED,
            statusVersion: 2,
            terminalAt: new Date(),
          },
        }),
      ).rejects.toThrow(/C03_APPLICATION_TRANSITION_INVALID/);
      await expect(
        prisma.uceApplication.update({
          where: { id: pending.applicationId },
          data: {
            status: UceApplicationStatus.APPROVED,
            statusVersion: 1,
            terminalAt: new Date(),
          },
        }),
      ).rejects.toThrow(/C03_APPLICATION_TRANSITION_INVALID/);
      await expect(
        prisma.uceApplication.update({
          where: { id: pending.applicationId },
          data: {
            status: UceApplicationStatus.APPROVED,
            statusVersion: 2,
            terminalAt: null,
          },
        }),
      ).rejects.toThrow(/C03_APPLICATION_TRANSITION_INVALID/);

      const terminal = await createCanonicalApplication(takeOpportunity());
      await transitionApplication(
        terminal.applicationId,
        UceApplicationStatus.WITHDRAWN,
      );
      await expect(
        prisma.uceApplication.update({
          where: { id: terminal.applicationId },
          data: {
            status: UceApplicationStatus.PENDING,
            statusVersion: 3,
            terminalAt: null,
          },
        }),
      ).rejects.toThrow(/C03_APPLICATION_TRANSITION_INVALID/);
      await expect(
        prisma.uceApplication.update({
          where: { id: terminal.applicationId },
          data: {
            status: UceApplicationStatus.REJECTED,
            statusVersion: 3,
            terminalAt: new Date(),
          },
        }),
      ).rejects.toThrow(/C03_APPLICATION_TRANSITION_INVALID/);
    });

    it("[16] rejects commit without the matching Application event", async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          const index = takeOpportunity();
          const applicationId = randomUUID();
          await insertApplication(tx, applicationId, index);
          await insertSnapshot(tx, applicationId);
        }),
      ).rejects.toThrow(/C03_CANONICAL_APPLICATION_REQUIRES_MATCHING_EVENT/);
    });

    it("[17] rejects malformed, mismatched, duplicate, updated, or deleted events", async () => {
      const badEventCases: Array<
        Partial<Prisma.ApplicationDomainEventUncheckedCreateInput>
      > = [
        {
          eventName: ApplicationDomainEventName.APPROVED,
          fromStatus: UceApplicationStatus.PENDING,
        },
        { fromStatus: UceApplicationStatus.PENDING },
        { toStatus: UceApplicationStatus.APPROVED },
        {
          actorClass: ApplicationEventActorClass.BRAND_USER,
          actorMembershipId: null,
          actorRole: null,
        },
      ];
      for (const overrides of badEventCases) {
        const index = takeOpportunity();
        await expect(
          prisma.$transaction(async (tx) => {
            const applicationId = randomUUID();
            await insertApplication(tx, applicationId, index);
            await insertSnapshot(tx, applicationId);
            await insertSubmittedEvent(tx, applicationId, index, overrides);
          }),
        ).rejects.toBeTruthy();
      }

      const identityIndex = takeOpportunity();
      await expect(
        prisma.$transaction(async (tx) => {
          const applicationId = randomUUID();
          await insertApplication(tx, applicationId, identityIndex);
          await insertSnapshot(tx, applicationId);
          await insertSubmittedEvent(tx, applicationId, identityIndex, {
            campaignId: otherCampaignId,
          });
        }),
      ).rejects.toThrow(/C03_EVENT_APPLICATION_IDENTITY_MISMATCH/);

      const valid = await createCanonicalApplication(takeOpportunity());
      const event = await prisma.applicationDomainEvent.findFirstOrThrow({
        where: { applicationId: valid.applicationId },
      });
      await expect(
        prisma.applicationDomainEvent.create({
          data: { ...event, id: randomUUID(), transitionId: randomUUID() },
        }),
      ).rejects.toBeTruthy();

      const duplicateTransitionIndex = takeOpportunity();
      await expect(
        prisma.$transaction(async (tx) => {
          const applicationId = randomUUID();
          await insertApplication(tx, applicationId, duplicateTransitionIndex);
          await insertSnapshot(tx, applicationId);
          await insertSubmittedEvent(
            tx,
            applicationId,
            duplicateTransitionIndex,
            {
              transitionId: valid.transitionId,
            },
          );
        }),
      ).rejects.toBeTruthy();

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

    it("[18] rejects duplicate/malformed/mutable/deleted command receipts", async () => {
      const first = await createCanonicalApplication(takeOpportunity());
      const receipt = await prisma.applicationCommandReceipt.create({
        data: {
          commandType: ApplicationCommandType.SUBMIT,
          actorUserId: creatorUserId,
          authoritySubjectId: creatorProfileId,
          idempotencyKeyDigest: digest("receipt-key"),
          requestFingerprint: digest("receipt-request"),
          applicationId: first.applicationId,
          transitionId: first.transitionId,
        },
      });

      const second = await createCanonicalApplication(takeOpportunity());
      await expect(
        prisma.applicationCommandReceipt.create({
          data: {
            commandType: ApplicationCommandType.SUBMIT,
            actorUserId: creatorUserId,
            authoritySubjectId: creatorProfileId,
            idempotencyKeyDigest: digest("receipt-key"),
            requestFingerprint: digest(),
            applicationId: second.applicationId,
            transitionId: second.transitionId,
          },
        }),
      ).rejects.toBeTruthy();

      await expect(
        prisma.applicationCommandReceipt.create({
          data: {
            commandType: ApplicationCommandType.SUBMIT,
            actorUserId: creatorUserId,
            authoritySubjectId: creatorProfileId,
            idempotencyKeyDigest: "weak",
            requestFingerprint: digest(),
            applicationId: second.applicationId,
            transitionId: second.transitionId,
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.applicationCommandReceipt.create({
          data: {
            commandType: ApplicationCommandType.SUBMIT,
            actorUserId: creatorUserId,
            authoritySubjectId: creatorProfileId,
            idempotencyKeyDigest: digest(),
            requestFingerprint: "weak",
            applicationId: second.applicationId,
            transitionId: second.transitionId,
          },
        }),
      ).rejects.toBeTruthy();

      await expect(
        prisma.applicationCommandReceipt.create({
          data: {
            commandType: ApplicationCommandType.SUBMIT,
            actorUserId: creatorUserId,
            authoritySubjectId: creatorProfileId,
            idempotencyKeyDigest: digest(),
            requestFingerprint: digest(),
            applicationId: first.applicationId,
            transitionId: first.transitionId,
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.applicationCommandReceipt.update({
          where: { id: receipt.id },
          data: { requestFingerprint: digest() },
        }),
      ).rejects.toThrow(/C03_APPLICATION_RECEIPT_APPEND_ONLY/);
      await expect(
        prisma.applicationCommandReceipt.delete({ where: { id: receipt.id } }),
      ).rejects.toThrow(/C03_APPLICATION_RECEIPT_APPEND_ONLY/);
    });

    it("[19] rejects invalid, rebound, rewritten, or deleted invitations", async () => {
      const campaignId = campaignIds[takeOpportunity()];
      const base = {
        campaignId,
        issuedByActorUserId: brandActorUserId,
        expiresAt: new Date(Date.now() + 60_000),
      };
      await expect(
        prisma.campaignOpportunityInvitation.create({
          data: { ...base, tokenDigest: digest() },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.campaignOpportunityInvitation.create({
          data: {
            ...base,
            tokenDigest: "weak",
            intendedCreatorProfileId: creatorProfileId,
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.campaignOpportunityInvitation.create({
          data: {
            ...base,
            tokenDigest: digest(),
            intendedNativeInstagramIdHmac: "weak",
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.campaignOpportunityInvitation.create({
          data: {
            ...base,
            tokenDigest: digest(),
            intendedCreatorProfileId: creatorProfileId,
            issuedAt: new Date(Date.now() + 120_000),
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.campaignOpportunityInvitation.create({
          data: {
            ...base,
            tokenDigest: digest(),
            intendedCreatorProfileId: creatorProfileId,
            bindingVersion: 1,
            boundCreatorProfileId: creatorProfileId,
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.campaignOpportunityInvitation.create({
          data: {
            ...base,
            tokenDigest: digest(),
            intendedCreatorProfileId: creatorProfileId,
            bindingVersion: 1,
            boundCreatorProfileId: otherCreatorProfileId,
            boundCreatorWorkspaceId: creatorWorkspaceId,
          },
        }),
      ).rejects.toBeTruthy();

      const bound = await createInvitation({
        campaignId,
        bindingVersion: 1,
        boundProfileId: creatorProfileId,
        boundWorkspaceId: creatorWorkspaceId,
      });
      await expect(
        prisma.campaignOpportunityInvitation.update({
          where: { id: bound.id },
          data: {
            bindingVersion: 0,
            boundCreatorProfileId: null,
            boundCreatorWorkspaceId: null,
          },
        }),
      ).rejects.toThrow(/C03_INVITATION_REBIND_FORBIDDEN/);
      await expect(
        prisma.campaignOpportunityInvitation.update({
          where: { id: bound.id },
          data: { boundCreatorProfileId: otherCreatorProfileId },
        }),
      ).rejects.toThrow(/C03_INVITATION_REBIND_FORBIDDEN|foreign key/);

      const revoked = await createInvitation({ campaignId });
      await prisma.campaignOpportunityInvitation.update({
        where: { id: revoked.id },
        data: { revokedAt: new Date(), revokedByActorUserId: brandActorUserId },
      });
      await expect(
        prisma.campaignOpportunityInvitation.update({
          where: { id: revoked.id },
          data: { revokedAt: null, revokedByActorUserId: null },
        }),
      ).rejects.toThrow(/C03_INVITATION_REVOCATION_IMMUTABLE/);
      await expect(
        prisma.campaignOpportunityInvitation.update({
          where: { id: revoked.id },
          data: { revokedAt: new Date(Date.now() + 1_000) },
        }),
      ).rejects.toThrow(/C03_INVITATION_REVOCATION_IMMUTABLE/);
      await expect(
        prisma.campaignOpportunityInvitation.delete({
          where: { id: bound.id },
        }),
      ).rejects.toThrow(/C03_INVITATION_DELETE_FORBIDDEN/);
    });

    it("[20] rejects invalid, rewritten, rebound, or deleted ingress touches", async () => {
      const campaignId = campaignIds[takeOpportunity()];
      await expect(
        prisma.campaignIngressTouch.create({
          data: {
            kind: CampaignIngressTouchKind.QUALIFIED_INGRESS,
            referenceDigest: digest(),
            campaignId,
            entrySurface: CampaignOpportunityEntrySurface.DIRECT_CAMPAIGN_LINK,
            entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.DIRECT,
            campaignShareId: shareIds[0],
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.campaignIngressTouch.create({
          data: {
            kind: CampaignIngressTouchKind.QUALIFIED_INGRESS,
            referenceDigest: digest(),
            campaignId,
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
            referenceDigest: "weak",
            campaignId,
            entrySurface: CampaignOpportunityEntrySurface.DIRECT_CAMPAIGN_LINK,
            entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.DIRECT,
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.campaignIngressTouch.create({
          data: {
            kind: CampaignIngressTouchKind.QUALIFIED_INGRESS,
            referenceDigest: digest(),
            campaignId,
            entrySurface: CampaignOpportunityEntrySurface.DIRECT_CAMPAIGN_LINK,
            entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.DIRECT,
            utmSource: "x".repeat(101),
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.campaignIngressTouch.create({
          data: {
            kind: CampaignIngressTouchKind.QUALIFIED_INGRESS,
            referenceDigest: digest(),
            campaignId,
            entrySurface: CampaignOpportunityEntrySurface.DIRECT_CAMPAIGN_LINK,
            entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.DIRECT,
            utmSource: "control\nvalue",
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.campaignIngressTouch.create({
          data: {
            kind: CampaignIngressTouchKind.QUALIFIED_INGRESS,
            referenceDigest: digest(),
            campaignId,
            entrySurface: CampaignOpportunityEntrySurface.DIRECT_CAMPAIGN_LINK,
            entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.DIRECT,
            boundCreatorProfileId: otherCreatorProfileId,
            boundCreatorWorkspaceId: creatorWorkspaceId,
            boundAt: new Date(),
          },
        }),
      ).rejects.toBeTruthy();

      const touch = await createTouch({
        campaignId,
        kind: CampaignIngressTouchKind.QUALIFIED_INGRESS,
        boundProfileId: creatorProfileId,
        boundWorkspaceId: creatorWorkspaceId,
      });
      await expect(
        prisma.campaignIngressTouch.update({
          where: { id: touch.id },
          data: { utmSource: "rewritten" },
        }),
      ).rejects.toThrow(/C03_INGRESS_PROVENANCE_IMMUTABLE/);
      await expect(
        prisma.campaignIngressTouch.update({
          where: { id: touch.id },
          data: { boundAt: new Date(Date.now() + 1_000) },
        }),
      ).rejects.toThrow(/C03_INGRESS_REBIND_FORBIDDEN/);
      await expect(
        prisma.campaignIngressTouch.update({
          where: { id: touch.id },
          data: {
            boundCreatorProfileId: null,
            boundCreatorWorkspaceId: null,
            boundAt: null,
          },
        }),
      ).rejects.toThrow(/C03_INGRESS_REBIND_FORBIDDEN/);
      await expect(
        prisma.campaignIngressTouch.delete({ where: { id: touch.id } }),
      ).rejects.toThrow(/C03_INGRESS_DELETE_FORBIDDEN/);
    });

    it("[21] rejects cross-Campaign/invalid continuation authority and typed-subject rewrites", async () => {
      const campaignId = campaignIds[0];
      const otherInvitation = await createInvitation({
        campaignId: otherCampaignId,
      });
      await expect(
        prisma.creatorEntryContinuation.create({
          data: {
            tokenDigest: digest(),
            campaignId,
            entrySurface:
              CampaignOpportunityEntrySurface.TRACKED_CAMPAIGN_SHARE,
            entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.SHARE,
            campaignShareId: shareIds[1],
            expiresAt: new Date(Date.now() + 60_000),
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.creatorEntryContinuation.create({
          data: {
            tokenDigest: digest(),
            campaignId,
            entrySurface: CampaignOpportunityEntrySurface.BRAND_INVITATION,
            entryAuthorityKind:
              CampaignOpportunityEntryAuthorityKind.INVITATION,
            campaignInvitationId: otherInvitation.id,
            expiresAt: new Date(Date.now() + 60_000),
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.creatorEntryContinuation.create({
          data: {
            tokenDigest: digest(),
            campaignId,
            entrySurface:
              CampaignOpportunityEntrySurface.TRACKED_CAMPAIGN_SHARE,
            entryAuthorityKind: CampaignOpportunityEntryAuthorityKind.SHARE,
            expiresAt: new Date(Date.now() + 60_000),
          },
        }),
      ).rejects.toBeTruthy();

      const continuation = await prisma.creatorEntryContinuation.create({
        data: {
          tokenDigest: digest(),
          campaignId,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await prisma.creatorEntryContinuation.update({
        where: { id: continuation.id },
        data: {
          boundCreatorProfileId: creatorProfileId,
          boundCreatorWorkspaceId: creatorWorkspaceId,
        },
      });
      await expect(
        prisma.creatorEntryContinuation.update({
          where: { id: continuation.id },
          data: {
            entrySurface: CampaignOpportunityEntrySurface.CREATOR_OPPORTUNITIES,
          },
        }),
      ).rejects.toThrow(/C01_CREATOR_ENTRY_CONTINUATION_AUTHORITY_IMMUTABLE/);
      await expect(
        prisma.creatorEntryContinuation.update({
          where: { id: continuation.id },
          data: { boundCreatorProfileId: otherCreatorProfileId },
        }),
      ).rejects.toThrow(/C01_CREATOR_ENTRY_CONTINUATION_AUTHORITY_IMMUTABLE/);
    });

    it("[22] accepts both deferred snapshot/event insertion orders", async () => {
      const first = await createCanonicalApplication(
        takeOpportunity(),
        "SNAPSHOT_FIRST",
      );
      const second = await createCanonicalApplication(
        takeOpportunity(),
        "EVENT_FIRST",
      );
      expect(
        await prisma.uceApplication.count({
          where: { id: { in: [first.applicationId, second.applicationId] } },
        }),
      ).toBe(2);
    });

    it("[24] exposes the permanent final guard/catalog family", async () => {
      const rows = await prisma.$queryRaw<Array<{ name: string }>>`
        SELECT conname AS name
        FROM pg_constraint
        WHERE conname IN (
          'uce_applications_authority_shape_check',
          'uce_applications_canonical_lifecycle_shape_check',
          'uce_applications_campaign_id_brand_profile_id_fkey',
          'uce_applications_campaign_id_canonical_campaign_asset_id_fkey',
          'uce_applications_canonical_campaign_asset_id_canonical_brief_id_fkey'
        )
        UNION ALL
        SELECT tgname AS name
        FROM pg_trigger
        WHERE NOT tgisinternal
          AND tgname IN (
            'c03_canonical_application_insert_guard',
            'c03_canonical_application_update_guard',
            'c03_canonical_application_evidence_guard',
            'c03_application_snapshot_update_guard',
            'c03_application_event_update_guard',
            'c03_application_receipt_update_guard'
          )
      `;
      expect(new Set(rows.map((row) => row.name)).size).toBe(11);
      expect(
        await prisma.$queryRaw<Array<{ name: string }>>`
          SELECT tgname AS name
          FROM pg_trigger
          WHERE NOT tgisinternal
            AND tgname = 'c03_canonical_application_write_closed'
        `,
      ).toEqual([]);
    });
  },
);
