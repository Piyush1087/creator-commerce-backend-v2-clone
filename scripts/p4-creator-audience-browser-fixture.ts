import { Test, type TestingModule } from "@nestjs/testing";
import {
  AuthMethodType,
  CreatorTeamRole,
  OrganizationKind,
  PrismaClient,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import { AppModule } from "../src/app.module";
import { CreatorAudiencePipelineService } from "../src/features/creator-audience/creator-audience-pipeline.service";
import {
  INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
  type InstagramIntelligenceProviderReadClient,
} from "../src/features/instagram/instagram-intelligence-provider.types";
import { encryptField } from "../src/shared/crypto/field-encryption.util";
import { hashPasswordAsync } from "../src/shared/crypto/password.util";

const EMAIL = "creator-audience-p4@example.test";
const ACCOUNT = "creator-audience-p4-provider-account";

async function main() {
  if (
    process.env.CREATOR_AUDIENCE_P4_FIXTURE !== "true" ||
    !process.env.CREATOR_AUDIENCE_P4_PASSWORD ||
    !process.env.CREATOR_AUDIENCE_P4_PROVIDER_TOKEN
  )
    throw new Error("P4 fixture guard and synthetic inputs are required");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/creator_audience_p4_clean"
  )
    throw new Error("P4 fixture requires the exact disposable local database");

  let unavailable = false;
  const provider: InstagramIntelligenceProviderReadClient = {
    readProfile: async () => ({
      availability: "AVAILABLE",
      providerAccountId: ACCOUNT,
      appScopedUserId: { state: "OBSERVED", value: ACCOUNT },
      username: { state: "OBSERVED", value: "creator_audience_p4" },
      name: { state: "OBSERVED", value: "Audience Fixture Owner" },
      accountType: { state: "OBSERVED", value: "CREATOR" },
      followersCount: { state: "OBSERVED", value: 1200 },
      followsCount: { state: "OBSERVED", value: 5 },
      mediaCount: { state: "OBSERVED", value: 10 },
    }),
    readAudienceInsights: async (_, population, breakdown) => ({
      availability: unavailable ? "UNAVAILABLE" : "AVAILABLE",
      population,
      breakdown,
      timeframe: "THIS_MONTH",
      values: unavailable
        ? []
        : [
            { dimension: breakdown === "AGE" ? "18-24" : "A", value: 60 },
            { dimension: breakdown === "AGE" ? "25-34" : "B", value: 40 },
          ],
      denominator: unavailable ? undefined : 100,
      limitation: null,
    }),
    readMediaInventory: async () => {
      throw new Error("UNEXPECTED_PROVIDER_METHOD");
    },
    readMediaInsights: async () => {
      throw new Error("UNEXPECTED_PROVIDER_METHOD");
    },
    readCarouselChildren: async () => {
      throw new Error("UNEXPECTED_PROVIDER_METHOD");
    },
  };
  const db = new PrismaClient();
  let module: TestingModule | undefined;
  try {
    if (await db.user.count({ where: { email: EMAIL } }))
      throw new Error("P4 fixture database must begin without the fixture");
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
        nativePlatformUserId: ACCOUNT,
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
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT)
      .useValue(provider)
      .compile();
    await module.init();
    const pipeline = module.get(CreatorAudiencePipelineService);
    const actor = {
      actorUserId: user.id,
      actorMembershipId: workspace.id,
      actorRole: "OWNER" as const,
      workspaceId: workspace.id,
      organizationId: organization.id,
      subjectCreatorProfileId: user.creatorProfile.id,
      subjectOwnerUserId: user.id,
      allowedActions: ["INSIGHTS_AUDIENCE_READ" as const],
    };
    const success = await pipeline.execute({
      actor,
      integrationId: integration.id,
      providerAccountId: ACCOUNT,
      authorizationGeneration: 1,
      capturedAt: new Date(Date.now() - 193 * 3_600_000),
      requestIdentity: "creator-audience:p4:production-path:success:v2",
    });
    unavailable = true;
    const failed = await pipeline.execute({
      actor,
      integrationId: integration.id,
      providerAccountId: ACCOUNT,
      authorizationGeneration: 1,
      requestIdentity: "creator-audience:p4:production-path:failure:v2",
    });
    if (success.reused || !failed.value.currentPreserved)
      throw new Error("P4 production-path success/failure proof failed");
    const rows = await db.$queryRawUnsafe<Array<Record<string, bigint>>>(`SELECT
      (SELECT count(*) FROM intelligence_executions WHERE brand_id IS NULL) executions,
      (SELECT count(*) FROM intelligence_processor_attempts WHERE brand_id IS NULL) attempts,
      (SELECT count(*) FROM intelligence_object_generations WHERE brand_id IS NULL) objects,
      (SELECT count(*) FROM intelligence_component_transitions WHERE brand_id IS NULL) transitions,
      (SELECT count(*) FROM intelligence_current_components WHERE brand_id IS NULL) current_rows`);
    console.log(
      JSON.stringify({
        fixture: "CREATOR_AUDIENCE_P4_AUTHENTICATED_PRODUCTION_VERTICAL",
        credentials: "NOT_REPORTED",
        provider: "SYNTHETIC_NO_NETWORK",
        successfulPath: "PIPELINE_SHARED_RUNTIME_CURRENT",
        failedPath: "CAPTURE_FAILURE_CURRENT_PRESERVED",
        staleCapture: true,
        lineage: Object.fromEntries(
          Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]),
        ),
      }),
    );
  } finally {
    await module?.close();
    await db.$disconnect();
  }
}

void main();
