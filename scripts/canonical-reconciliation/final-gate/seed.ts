import {
  ApplicationDomainEventName,
  ApplicationEventActorClass,
  AuthMethodType,
  BrandRole,
  CollaborationAuthorityVersion,
  CollaborationHandoffCommercialState,
  CollaborationIndustryType,
  CollaborationLifecycle,
  CollaborationPayoutMode,
  CollaborationStage,
  CollaborationStageStatus,
  CreatorMediaKitLifecycle,
  CreatorTeamRole,
  OrganizationKind,
  Prisma,
  PrismaClient,
  UceApplicationAuthorityVersion,
  UceApplicationSnapshotVersion,
  UceApplicationSource,
  UceApplicationStatus,
  UceBriefStatus,
  UceCampaignAssetKind,
  UceCampaignAssetStatus,
  UceCampaignObjective,
  UceCampaignStatus,
  UceMediaPlatform,
  UceTimelineStructure,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { writeFile } from "node:fs/promises";

import { hashCanonicalCampaignDefinition } from "../../../src/features/brand-uce/services/canonical-campaign-definition";
import { hashPasswordAsync } from "../../../src/shared/crypto/password.util";
import {
  FINAL_GATE_IDENTITIES,
  FINAL_GATE_IDS,
  FINAL_GATE_OBJECTIVES,
  FINAL_GATE_PUBLIC_MEDIA_KIT_ID,
  type FinalGateManifest,
} from "./contracts";
import {
  requireDisposableFinalGateDatabase,
  requireRunArtifactPath,
} from "./guard";

const prisma = new PrismaClient();

const json = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

async function createPasswordUser(input: {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}) {
  return prisma.user.create({
    data: {
      id: input.id,
      organizationId: input.organizationId,
      email: input.email,
      name: input.name,
      role: input.role,
      authState: UserAuthState.ACTIVE,
      emailVerifiedAt: new Date("2026-09-17T00:00:00.000Z"),
      hashedPassword: input.passwordHash,
      authMethods: {
        create: {
          type: AuthMethodType.PASSWORD,
          credentialHash: input.passwordHash,
        },
      },
    },
  });
}

async function main() {
  const url = requireDisposableFinalGateDatabase();
  const password = process.env.FINAL_GATE_FIXTURE_PASSWORD;
  if (!password) throw new Error("FINAL_GATE_FIXTURE_PASSWORD is required");
  if (
    await prisma.user.count({
      where: { email: { endsWith: "@example.test" } },
    })
  ) {
    throw new Error("Final Gate fixture requires a clean disposable database");
  }

  const passwordHash = await hashPasswordAsync(password);
  await prisma.organization.create({
    data: {
      id: FINAL_GATE_IDS.brandOrganization,
      name: "Final Gate Verified Brand",
      kind: OrganizationKind.BRAND,
      brandProfile: {
        create: {
          id: FINAL_GATE_IDS.brandProfile,
          domain: "final-gate-brand.example.test",
          name: "Final Gate Verified Brand",
          industry: "D2C",
          description: "Deterministic local-only final validation fixture.",
          brandValues: ["CLEAR", "TRUSTED"],
          policyFlags: [],
          isVerified: true,
          verifiedAt: new Date("2026-09-17T00:00:00.000Z"),
          identityConfirmedAt: new Date("2026-09-17T00:00:00.000Z"),
          socialSyncSkipped: true,
          strategicDna: json({ fixture: true, state: "CURRENT" }),
          surfaceOffers: json([]),
          countryCode: "IN",
          currencyCode: "INR",
        },
      },
    },
  });

  const brandActors = [
    [
      FINAL_GATE_IDS.brandOwner,
      FINAL_GATE_IDENTITIES.BRAND_OWNER,
      "Final Gate Brand Owner",
      BrandRole.BRAND_OWNER,
    ],
    [
      FINAL_GATE_IDS.brandFinance,
      FINAL_GATE_IDENTITIES.FINANCE_ADMIN,
      "Final Gate Finance Admin",
      BrandRole.FINANCE_ADMIN,
    ],
    [
      FINAL_GATE_IDS.brandManager,
      FINAL_GATE_IDENTITIES.CAMPAIGN_MANAGER,
      "Final Gate Campaign Manager",
      BrandRole.CAMPAIGN_MANAGER,
    ],
  ] as const;
  for (const [id, email, name, role] of brandActors) {
    const user = await createPasswordUser({
      id,
      organizationId: FINAL_GATE_IDS.brandOrganization,
      email,
      name,
      role: UserRole.BRAND,
      passwordHash,
    });
    await prisma.brandTeamMember.create({
      data: {
        brandProfileId: FINAL_GATE_IDS.brandProfile,
        userId: user.id,
        role,
        isActive: true,
      },
    });
  }
  await prisma.brandBillingProfile.create({
    data: {
      brandProfileId: FINAL_GATE_IDS.brandProfile,
      registeredCompanyName: "Final Gate Brand Private Limited",
      corporateBillingAddress: "Local fixture address",
      legalEntityType: "PRIVATE_LIMITED",
      billingCountryCode: "IN",
      currencyPreference: "INR",
      configuredAt: new Date("2026-09-17T00:00:00.000Z"),
    },
  });

  await prisma.organization.create({
    data: {
      id: FINAL_GATE_IDS.creatorOrganization,
      name: "Final Gate Creator Workspace",
      kind: OrganizationKind.CREATOR,
    },
  });
  const owner = await createPasswordUser({
    id: FINAL_GATE_IDS.creatorOwner,
    organizationId: FINAL_GATE_IDS.creatorOrganization,
    email: FINAL_GATE_IDENTITIES.CREATOR_OWNER,
    name: "Final Gate Creator Owner",
    role: UserRole.CREATOR,
    passwordHash,
  });
  await prisma.creatorProfile.create({
    data: {
      id: FINAL_GATE_IDS.creatorProfile,
      userId: owner.id,
      displayName: "Final Gate Creator",
      instagramHandle: "final_gate_creator",
      followerCount: 25000,
      primaryRegion: "IN",
      audienceDemographicsMatrix: json({ top_countries: { IN: 0.8 } }),
    },
  });
  await prisma.creatorWorkspace.create({
    data: {
      id: FINAL_GATE_IDS.creatorWorkspace,
      ownerProfileId: FINAL_GATE_IDS.creatorProfile,
      organizationId: FINAL_GATE_IDS.creatorOrganization,
      organizationDisplayName: "Final Gate Creator Workspace",
    },
  });
  await prisma.creatorWorkspaceMember.create({
    data: {
      id: FINAL_GATE_IDS.creatorOwnerMembership,
      workspaceId: FINAL_GATE_IDS.creatorWorkspace,
      assignedProfileId: FINAL_GATE_IDS.creatorProfile,
      userId: owner.id,
      associatedEmail: owner.email,
      securityRole: CreatorTeamRole.OWNER,
      isActive: true,
      joinedAt: new Date("2026-09-17T00:00:00.000Z"),
    },
  });
  const creatorActors = [
    [
      FINAL_GATE_IDS.creatorManager,
      FINAL_GATE_IDS.creatorManagerMembership,
      FINAL_GATE_IDENTITIES.CREATOR_MANAGER,
      CreatorTeamRole.MANAGER,
    ],
    [
      FINAL_GATE_IDS.creatorAssistant,
      FINAL_GATE_IDS.creatorAssistantMembership,
      FINAL_GATE_IDENTITIES.CREATOR_ASSISTANT,
      CreatorTeamRole.ASSISTANT,
    ],
  ] as const;
  for (const [id, membershipId, email, role] of creatorActors) {
    const actorOrganization = await prisma.organization.create({
      data: {
        name: `Final Gate Creator ${role}`,
        kind: OrganizationKind.CREATOR,
      },
    });
    const user = await createPasswordUser({
      id,
      organizationId: actorOrganization.id,
      email,
      name: `Final Gate Creator ${role}`,
      role: UserRole.CREATOR,
      passwordHash,
    });
    await prisma.creatorWorkspaceMember.create({
      data: {
        id: membershipId,
        workspaceId: FINAL_GATE_IDS.creatorWorkspace,
        userId: user.id,
        associatedEmail: email,
        securityRole: role,
        isActive: true,
        joinedAt: new Date("2026-09-17T00:00:00.000Z"),
      },
    });
  }
  await prisma.creatorMediaKit.create({
    data: {
      id: FINAL_GATE_IDS.mediaKit,
      workspaceId: FINAL_GATE_IDS.creatorWorkspace,
      ownerProfileId: FINAL_GATE_IDS.creatorProfile,
      publicId: FINAL_GATE_PUBLIC_MEDIA_KIT_ID,
      lifecycle: CreatorMediaKitLifecycle.LIVE,
      currentRevision: 1,
      publicVisuals: json([]),
      publishedAt: new Date("2026-09-17T00:00:00.000Z"),
      publishedByUserId: owner.id,
    },
  });

  const campaignIds: Record<string, string> = {};
  for (const [index, objective] of FINAL_GATE_OBJECTIVES.entries()) {
    const id = [
      FINAL_GATE_IDS.campaignAwareness,
      FINAL_GATE_IDS.campaignTrust,
      FINAL_GATE_IDS.campaignAssets,
      FINAL_GATE_IDS.campaignAction,
    ][index];
    const definition = {
      version: "2.0",
      creationSource: "MANUAL",
      strategy: {
        objective,
        platforms: ["INSTAGRAM"],
        campaign_visibility: "EVERYONE",
      },
      targeting: {},
      commercials: { compensation_model: "FIXED", currency: "INR" },
      derived: { fixture: true },
    };
    await prisma.uceCampaign.create({
      data: {
        id,
        brandProfileId: FINAL_GATE_IDS.brandProfile,
        name: `Final Gate ${objective} Campaign`,
        status: UceCampaignStatus.LIVE,
        canonicalDefinition: json(definition),
        canonicalDefinitionHash: hashCanonicalCampaignDefinition(definition),
        strategy: {
          create: {
            timelineType: UceTimelineStructure.DYNAMIC_MILESTONES,
            dynamicDaysLimit: 30,
            coreObjective: objective as UceCampaignObjective,
            platformDeliverables: json({ INSTAGRAM: ["REEL_VIDEO"] }),
            platforms: [UceMediaPlatform.INSTAGRAM],
          },
        },
      },
    });
    campaignIds[objective] = id;
  }
  await prisma.uceCampaign.create({
    data: {
      id: FINAL_GATE_IDS.campaignLegacy,
      brandProfileId: FINAL_GATE_IDS.brandProfile,
      name: "Final Gate Legacy Objective Campaign",
      status: UceCampaignStatus.LIVE,
      canonicalDefinition: json({
        version: "1.2",
        strategy: { objective: "PULSE" },
      }),
      strategy: {
        create: {
          timelineType: UceTimelineStructure.DYNAMIC_MILESTONES,
          dynamicDaysLimit: 30,
          coreObjective: UceCampaignObjective.BRAND_AWARENESS,
          platformDeliverables: json({ INSTAGRAM: ["REEL_VIDEO"] }),
          platforms: [UceMediaPlatform.INSTAGRAM],
        },
      },
    },
  });

  await prisma.uceCampaignProduct.create({
    data: {
      id: FINAL_GATE_IDS.product,
      campaignId: FINAL_GATE_IDS.campaignAwareness,
      productName: "Accepted Fixture Product",
      skuCode: "FINAL-GATE-001",
      inventoryCount: 10,
      costPerUnit: 2500,
      assetPayload: json({
        fixture: true,
        authority: "ACCEPTED_CAMPAIGN_ASSOCIATION",
      }),
    },
  });
  await prisma.uceCampaignBrief.create({
    data: {
      id: FINAL_GATE_IDS.legacyBrief,
      campaignId: FINAL_GATE_IDS.campaignAwareness,
      productId: FINAL_GATE_IDS.product,
      internalTitle: "Final Gate Campaign Brief",
      creativeGuidelines: "Local-only accepted fixture brief.",
      requiredPlatforms: [UceMediaPlatform.INSTAGRAM],
      deliverableFormatTags: ["REEL_VIDEO"],
    },
  });
  await prisma.uceCampaignAsset.create({
    data: {
      id: FINAL_GATE_IDS.canonicalAsset,
      campaignId: FINAL_GATE_IDS.campaignAwareness,
      kind: UceCampaignAssetKind.BRAND,
      status: UceCampaignAssetStatus.ACTIVE,
      brandProfileId: FINAL_GATE_IDS.brandProfile,
    },
  });
  await prisma.canonicalCampaignBrief.create({
    data: {
      id: FINAL_GATE_IDS.canonicalBrief,
      campaignAssetId: FINAL_GATE_IDS.canonicalAsset,
      status: UceBriefStatus.PUBLISHED,
      briefName: "Final Gate Canonical Brief",
      creatorBrief: "Create one local-only acceptance Reel.",
      platform: UceMediaPlatform.INSTAGRAM,
      deliverables: {
        create: {
          id: FINAL_GATE_IDS.canonicalDeliverable,
          format: "REEL_VIDEO",
          displayOrder: 0,
        },
      },
    },
  });
  await prisma.uceCampaignCreator.create({
    data: {
      id: FINAL_GATE_IDS.campaignCreator,
      campaignId: FINAL_GATE_IDS.campaignAwareness,
      creatorProfileId: FINAL_GATE_IDS.creatorProfile,
      creatorUserId: owner.id,
      platform: UceMediaPlatform.INSTAGRAM,
      socialHandle: "final_gate_creator",
      normalizedSocialHandle: "final_gate_creator",
      email: owner.email,
      source: "MANUAL",
      ingestionMethod: "MANUAL_SINGLE",
      reviewState: "REVIEWED",
    },
  });
  await prisma.$transaction(async (tx) => {
    await tx.uceApplication.create({
      data: {
        id: FINAL_GATE_IDS.application,
        authorityVersion: UceApplicationAuthorityVersion.C03_CANONICAL,
        campaignId: FINAL_GATE_IDS.campaignAwareness,
        brandProfileId: FINAL_GATE_IDS.brandProfile,
        campaignCreatorId: FINAL_GATE_IDS.campaignCreator,
        canonicalCampaignAssetId: FINAL_GATE_IDS.canonicalAsset,
        canonicalBriefId: FINAL_GATE_IDS.canonicalBrief,
        subjectCreatorProfileId: FINAL_GATE_IDS.creatorProfile,
        subjectCreatorWorkspaceId: FINAL_GATE_IDS.creatorWorkspace,
        actorUserId: owner.id,
        actorMembershipId: FINAL_GATE_IDS.creatorOwnerMembership,
        actorRole: CreatorTeamRole.OWNER,
        status: UceApplicationStatus.PENDING,
        statusVersion: 1,
        source: UceApplicationSource.DIRECT,
        snapshot: {
          create: {
            schemaVersion:
              UceApplicationSnapshotVersion.C03_APPLICATION_SNAPSHOT_V1,
            campaignContext: json({
              id: FINAL_GATE_IDS.campaignAwareness,
              objective: "AWARENESS",
            }),
            campaignAssetContext: json({ id: FINAL_GATE_IDS.canonicalAsset }),
            briefContext: json({ id: FINAL_GATE_IDS.canonicalBrief }),
            commercialContext: json({ provider: "DISABLED", currency: "INR" }),
            creatorIdentity: json({ profileId: FINAL_GATE_IDS.creatorProfile }),
            actorContext: json({
              role: "OWNER",
              workspaceId: FINAL_GATE_IDS.creatorWorkspace,
            }),
            attributionContext: json({
              schema: "C03",
              version: 1,
            }),
          },
        },
      },
    });
    await tx.applicationDomainEvent.create({
      data: {
        transitionId: FINAL_GATE_IDS.applicationSubmittedTransition,
        applicationId: FINAL_GATE_IDS.application,
        applicationVersion: 1,
        eventName: ApplicationDomainEventName.SUBMITTED,
        fromStatus: null,
        toStatus: UceApplicationStatus.PENDING,
        actorClass: ApplicationEventActorClass.CREATOR_TEAM_USER,
        actorUserId: owner.id,
        actorMembershipId: FINAL_GATE_IDS.creatorOwnerMembership,
        actorRole: CreatorTeamRole.OWNER,
        subjectCreatorProfileId: FINAL_GATE_IDS.creatorProfile,
        subjectCreatorWorkspaceId: FINAL_GATE_IDS.creatorWorkspace,
        brandProfileId: FINAL_GATE_IDS.brandProfile,
        campaignId: FINAL_GATE_IDS.campaignAwareness,
        canonicalCampaignAssetId: FINAL_GATE_IDS.canonicalAsset,
        canonicalBriefId: FINAL_GATE_IDS.canonicalBrief,
      },
    });
  });
  await prisma.$transaction(async (tx) => {
    await tx.uceApplication.update({
      where: { id: FINAL_GATE_IDS.application },
      data: {
        status: UceApplicationStatus.APPROVED,
        statusVersion: 2,
        terminalAt: new Date("2026-09-17T00:00:00.000Z"),
      },
    });
    await tx.collaboration.create({
      data: {
        id: FINAL_GATE_IDS.collaboration,
        authorityVersion: CollaborationAuthorityVersion.CANONICAL_V1,
        sourceApplicationId: FINAL_GATE_IDS.application,
        handoffCommercialState:
          CollaborationHandoffCommercialState.FIXED_AGREED,
        brandProfileId: FINAL_GATE_IDS.brandProfile,
        creatorUserId: owner.id,
        creatorProfileId: FINAL_GATE_IDS.creatorProfile,
        creatorWorkspaceId: FINAL_GATE_IDS.creatorWorkspace,
        campaignId: FINAL_GATE_IDS.campaignAwareness,
        campaignAssetId: FINAL_GATE_IDS.canonicalAsset,
        lifecycle: CollaborationLifecycle.ACTIVE,
        canonicalStage: CollaborationStage.NEGOTIATION,
        currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
        payoutMode: CollaborationPayoutMode.ESCROW,
        industry: CollaborationIndustryType.D2C_ECOMMERCE,
        lastMessageSnippet: "Canonical C03 to C04 final-gate fixture.",
        snapshot: {
          create: {
            campaignContext: json({ id: FINAL_GATE_IDS.campaignAwareness }),
            campaignAssetContext: json({ id: FINAL_GATE_IDS.canonicalAsset }),
            briefContext: json({ id: FINAL_GATE_IDS.canonicalBrief }),
            applicationContext: json({
              sourceApplicationId: FINAL_GATE_IDS.application,
              approvalTransitionId:
                FINAL_GATE_IDS.applicationApprovedTransition,
            }),
            creatorContext: json({ id: FINAL_GATE_IDS.creatorProfile }),
            brandContext: json({ id: FINAL_GATE_IDS.brandProfile }),
            campaignCommercialContext: json({ provider: "DISABLED" }),
            advancePercentageSnapshot: 0,
            commercialCurrency: "INR",
          },
        },
        commercialAgreement: {
          create: {
            negotiationState: "NOT_REQUIRED",
            agreedCreatorFee: new Prisma.Decimal(10000),
            currency: "INR",
            advancePercentageSnapshot: 0,
            paymentRail: "PLATFORM_ESCROW",
            securementState: "AWAITING_ESCROW_FUNDING",
            requiredSecuredAmount: new Prisma.Decimal(10000),
            termsLockedAt: new Date("2026-09-17T00:00:00.000Z"),
            agreementVersion: 1,
          },
        },
        fulfillment: { create: { state: "NOT_STARTED" } },
      },
    });
    await tx.applicationDomainEvent.create({
      data: {
        transitionId: FINAL_GATE_IDS.applicationApprovedTransition,
        applicationId: FINAL_GATE_IDS.application,
        applicationVersion: 2,
        eventName: ApplicationDomainEventName.APPROVED,
        fromStatus: UceApplicationStatus.PENDING,
        toStatus: UceApplicationStatus.APPROVED,
        actorClass: ApplicationEventActorClass.BRAND_USER,
        actorUserId: FINAL_GATE_IDS.brandOwner,
        subjectCreatorProfileId: FINAL_GATE_IDS.creatorProfile,
        subjectCreatorWorkspaceId: FINAL_GATE_IDS.creatorWorkspace,
        brandProfileId: FINAL_GATE_IDS.brandProfile,
        campaignId: FINAL_GATE_IDS.campaignAwareness,
        canonicalCampaignAssetId: FINAL_GATE_IDS.canonicalAsset,
        canonicalBriefId: FINAL_GATE_IDS.canonicalBrief,
        approvedCollaborationId: FINAL_GATE_IDS.collaboration,
      },
    });
  });

  const manifest: FinalGateManifest = {
    version: "FINAL_GATE_FIXTURE_V1",
    database: decodeURIComponent(url.pathname.slice(1)),
    identities: FINAL_GATE_IDENTITIES,
    objectives: FINAL_GATE_OBJECTIVES,
    campaigns: campaignIds,
    legacyCampaignId: FINAL_GATE_IDS.campaignLegacy,
    applicationId: FINAL_GATE_IDS.application,
    collaborationId: FINAL_GATE_IDS.collaboration,
    creatorWorkspaceId: FINAL_GATE_IDS.creatorWorkspace,
    publicMediaKitId: FINAL_GATE_PUBLIC_MEDIA_KIT_ID,
    providerMode: "DISABLED_SYNTHETIC_ONLY",
    reporting: "FAIL_CLOSED_UNIMPLEMENTED",
    creatorChat: "DEFERRED_ABSENT",
  };
  await writeFile(
    requireRunArtifactPath("fixture-manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  process.stdout.write(
    JSON.stringify({
      fixture: manifest.version,
      identities: 6,
      objectives: 4,
      providerMode: manifest.providerMode,
    }) + "\n",
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "FINAL_GATE_FIXTURE_FAILED",
    );
    process.exitCode = 1;
  });
