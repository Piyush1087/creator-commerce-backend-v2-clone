import {
  AuthMethodType,
  CreatorTeamRole,
  OrganizationKind,
  PrismaClient,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../src/prisma/prisma.service";
import { CreatorAudienceRepository } from "../src/features/creator-audience/creator-audience.repository";
import { normalizeCreatorAudience } from "../src/features/creator-audience/creator-audience-normalizer";
import { IntelligenceOwnerScopeRepository } from "../src/features/data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import { encryptField } from "../src/shared/crypto/field-encryption.util";
import { hashPasswordAsync } from "../src/shared/crypto/password.util";

const EMAIL = "creator-audience-p4@example.test";

async function main() {
  if (
    process.env.CREATOR_AUDIENCE_P4_FIXTURE !== "true" ||
    !process.env.CREATOR_AUDIENCE_P4_PASSWORD ||
    !process.env.CREATOR_AUDIENCE_P4_PROVIDER_TOKEN
  ) {
    throw new Error("P4 fixture guard and synthetic inputs are required");
  }
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/creator_audience_p4_clean"
  ) {
    throw new Error("P4 fixture requires the exact disposable local database");
  }

  const db = new PrismaClient();
  try {
    if (await db.user.count({ where: { email: EMAIL } })) {
      throw new Error("P4 fixture database must begin without the fixture");
    }
    const passwordHash = await hashPasswordAsync(
      process.env.CREATOR_AUDIENCE_P4_PASSWORD,
    );
    const organization = await db.organization.create({
      data: {
        name: "Creator Audience P4 Fixture",
        kind: OrganizationKind.CREATOR,
      },
    });
    const user = await db.user.create({
      data: {
        email: EMAIL,
        name: "Audience Fixture Owner",
        role: UserRole.CREATOR,
        authState: UserAuthState.ACTIVE,
        emailVerifiedAt: new Date(),
        organizationId: organization.id,
        hashedPassword: passwordHash,
        authMethods: {
          create: {
            type: AuthMethodType.PASSWORD,
            credentialHash: passwordHash,
          },
        },
        creatorProfile: { create: {} },
      },
      include: { creatorProfile: true },
    });
    if (!user.creatorProfile)
      throw new Error("Creator profile was not created");
    const workspace = await db.creatorWorkspace.create({
      data: {
        ownerProfileId: user.creatorProfile.id,
        organizationId: organization.id,
        members: {
          create: {
            assignedProfileId: user.creatorProfile.id,
            userId: user.id,
            associatedEmail: EMAIL,
            securityRole: CreatorTeamRole.OWNER,
            joinedAt: new Date(),
          },
        },
      },
    });
    const integration = await db.creatorSocialIntegration.create({
      data: {
        creatorProfileId: user.creatorProfile.id,
        platformNetwork: "INSTAGRAM",
        nativePlatformUserId: "creator-audience-p4-provider-account",
        channelHandleString: "creator_audience_p4",
        oauthAccessTokenEncrypted: encryptField(
          process.env.CREATOR_AUDIENCE_P4_PROVIDER_TOKEN,
        ),
        tokenScopePermissions: [
          "instagram_business_basic",
          "instagram_business_manage_insights",
        ],
        tokenStateCondition: "ACTIVE",
        authorizationGeneration: 1,
        authorizationHealth: "USABLE",
        basicAuthorizationCapability: "AVAILABLE",
        insightsCapability: "AVAILABLE",
        professionalAccountType: "CREATOR",
        lastAuthorizationValidatedAt: new Date(),
      },
    });
    const results = (["FOLLOWERS", "ENGAGED_AUDIENCE"] as const).flatMap(
      (population) =>
        (["AGE", "GENDER", "COUNTRY", "CITY"] as const).map(
          (breakdown, index) => ({
            availability: "AVAILABLE" as const,
            population,
            breakdown,
            timeframe: "THIS_MONTH" as const,
            values: [
              { dimension: index === 0 ? "18-24" : "A", value: 60 },
              { dimension: index === 0 ? "25-34" : "B", value: 40 },
            ],
            denominator: 100,
            limitation: null,
          }),
        ),
    );
    const acquisition = {
      capturedAt: new Date().toISOString(),
      followerCount: { state: "OBSERVED" as const, value: 1200 },
      results,
    };
    const repository = new CreatorAudienceRepository(
      db as PrismaService,
      new IntelligenceOwnerScopeRepository(db as PrismaService),
    );
    await repository.publish({
      identity: {
        creatorProfileId: user.creatorProfile.id,
        creatorWorkspaceId: workspace.id,
        integrationId: integration.id,
        providerAccountId: integration.nativePlatformUserId,
        authorizationGeneration: 1,
        requestIdentity: "creator-audience:p4:fixture:v1",
      },
      acquisition,
      value: normalizeCreatorAudience({
        acquisition,
        role: "OWNER",
        now: new Date(),
      }),
    });
    console.log(
      JSON.stringify({
        fixture: "CREATOR_AUDIENCE_P4_AUTHENTICATED_VERTICAL",
        credentials: "NOT_REPORTED",
        provider: "SYNTHETIC_NO_NETWORK",
        lineage: "PUBLISHED",
      }),
    );
  } finally {
    await db.$disconnect();
  }
}

void main();
