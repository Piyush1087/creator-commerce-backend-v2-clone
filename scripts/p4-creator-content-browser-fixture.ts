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
import { CreatorContentPipelineService } from "../src/features/creator-content/creator-content-pipeline.service";
import { CREATOR_CONTENT_SEMANTIC_ANALYZER } from "../src/features/creator-content/creator-content-semantic.port";
import {
  INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
  type InstagramIntelligenceProviderReadClient,
} from "../src/features/instagram/instagram-intelligence-provider.types";
import { encryptField } from "../src/shared/crypto/field-encryption.util";
import { hashPasswordAsync } from "../src/shared/crypto/password.util";

const EMAIL = "creator-content-p4@example.test";
const ACCOUNT = "creator-content-p4-provider-account";
const TEAM = [
  ["creator-content-p4-manager@example.test", CreatorTeamRole.MANAGER, true],
  [
    "creator-content-p4-assistant@example.test",
    CreatorTeamRole.ASSISTANT,
    true,
  ],
  [
    "creator-content-p4-inactive@example.test",
    CreatorTeamRole.ASSISTANT,
    false,
  ],
] as const;

async function main() {
  if (
    process.env.CREATOR_CONTENT_P4_FIXTURE !== "true" ||
    !process.env.CREATOR_CONTENT_P4_PASSWORD ||
    !process.env.CREATOR_CONTENT_P4_PROVIDER_TOKEN
  )
    throw new Error("P4 fixture guard and synthetic inputs are required");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/creator_content_p4_clean"
  )
    throw new Error("P4 fixture requires the exact disposable local database");
  let failProvider = false;
  let providerCalls = 0;
  let semanticCalls = 0;
  const capturedAt = new Date();
  const provider: InstagramIntelligenceProviderReadClient = {
    readProfile: async () => {
      throw new Error("UNEXPECTED_PROVIDER_METHOD");
    },
    readAudienceInsights: async () => {
      throw new Error("UNEXPECTED_PROVIDER_METHOD");
    },
    readCarouselChildren: async () => {
      throw new Error("UNEXPECTED_PROVIDER_METHOD");
    },
    readMediaInventory: async () => {
      providerCalls += 1;
      if (failProvider) throw new Error("SYNTHETIC_PROVIDER_FAILURE");
      const items = Array.from({ length: 8 }, (_, index) => ({
        providerMediaId: `content-media-${index}`,
        mediaType: {
          state: "OBSERVED" as const,
          value: index === 0 ? "CAROUSEL_ALBUM" : "IMAGE",
        },
        mediaProductType: {
          state: "OBSERVED" as const,
          value:
            index === 1 ? "REELS" : index === 0 ? "CAROUSEL_ALBUM" : "IMAGE",
        },
        permalink: {
          state: "OBSERVED" as const,
          value: `https://www.instagram.com/p/content-media-${index}/`,
        },
        caption: {
          state: "OBSERVED" as const,
          value: "untrusted fixture source text",
        },
        timestamp: {
          state: "OBSERVED" as const,
          value: new Date(
            capturedAt.getTime() - index * 86_400_000,
          ).toISOString(),
        },
      }));
      return {
        availability: "AVAILABLE" as const,
        items,
        coverage: {
          windowStart: new Date(
            capturedAt.getTime() - 90 * 86_400_000,
          ).toISOString(),
          windowEnd: capturedAt.toISOString(),
          pagesAttempted: 1,
          pagesCompleted: 1,
          rowsReturned: items.length,
          rowsEligible: items.length,
          rowsMissingTimestamp: 0,
          duplicatesDiscarded: 0,
          oldestObservedTimestamp: items.at(-1)!.timestamp.value,
          newestObservedTimestamp: items[0].timestamp.value,
          stopReason: "EXHAUSTED" as const,
        },
      };
    },
    readMediaInsights: async (_, mediaId) => {
      providerCalls += 1;
      const high = Number(mediaId.slice(-1)) < 4;
      const metric = (value: number) =>
        value === 0
          ? ({ state: "OBSERVED_ZERO", value: 0 } as const)
          : ({ state: "OBSERVED", value } as const);
      const unavailable = {
        state: "UNAVAILABLE" as const,
        reason: "NO_PROVIDER_DENOMINATOR" as const,
      };
      return {
        availability: "AVAILABLE" as const,
        mediaType: "IMAGE",
        metrics: {
          comments: metric(1),
          likes: metric(high ? 20 : 5),
          reach: metric(100),
          saved: metric(1),
          shares: metric(1),
          total_interactions: metric(high ? 20 : 5),
          views: metric(100),
        },
        units: {
          comments: "COUNT" as const,
          likes: "COUNT" as const,
          reach: "COUNT" as const,
          saved: "COUNT" as const,
          shares: "COUNT" as const,
          total_interactions: "COUNT" as const,
          views: "COUNT" as const,
        },
        denominators: {
          comments: unavailable,
          likes: unavailable,
          reach: unavailable,
          saved: unavailable,
          shares: unavailable,
          total_interactions: unavailable,
          views: unavailable,
        },
        providerObservationTime: {
          state: "UNAVAILABLE" as const,
          reason: "PROVIDER_DOES_NOT_RETURN_OBSERVATION_TIME" as const,
        },
        providerLagLimitHours: 48 as const,
      };
    },
  };
  const semantic = {
    analyze: async ({ media }: { media: { providerMediaId: string } }) => {
      semanticCalls += 1;
      return {
        providerMediaId: media.providerMediaId,
        state: "AVAILABLE" as const,
        themes: [
          Number(media.providerMediaId.slice(-1)) < 4 ? "Tutorial" : "Story",
        ],
        captionPatterns: ["Direct"],
        creativeStructures: ["Demonstration"],
        visualExecution: ["Close framing"],
      };
    },
  };
  const db = new PrismaClient();
  let module: TestingModule | undefined;
  try {
    if (await db.user.count({ where: { email: EMAIL } }))
      throw new Error("P4 fixture database must begin clean");
    const passwordHash = await hashPasswordAsync(
      process.env.CREATOR_CONTENT_P4_PASSWORD,
    );
    const organization = await db.organization.create({
      data: {
        name: "Creator Content P4 Fixture",
        kind: OrganizationKind.CREATOR,
      },
    });
    const user = await db.user.create({
      data: {
        email: EMAIL,
        name: "Content Fixture Owner",
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
    for (const [email, securityRole, isActive] of TEAM) {
      const memberOrganization = await db.organization.create({
        data: { name: `Content ${securityRole} Fixture`, kind: "CREATOR" },
      });
      const member = await db.user.create({
        data: {
          email,
          name: `Content ${securityRole} Fixture`,
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
          organizationId: memberOrganization.id,
          hashedPassword: passwordHash,
          authMethods: {
            create: {
              type: AuthMethodType.PASSWORD,
              credentialHash: passwordHash,
            },
          },
        },
      });
      await db.creatorWorkspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: member.id,
          associatedEmail: email,
          securityRole,
          isActive,
          joinedAt: isActive ? new Date() : null,
        },
      });
    }
    const integration = await db.creatorSocialIntegration.create({
      data: {
        creatorProfileId: user.creatorProfile.id,
        platformNetwork: "INSTAGRAM",
        nativePlatformUserId: ACCOUNT,
        channelHandleString: "creator_content_p4",
        oauthAccessTokenEncrypted: encryptField(
          process.env.CREATOR_CONTENT_P4_PROVIDER_TOKEN,
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
      .overrideProvider(CREATOR_CONTENT_SEMANTIC_ANALYZER)
      .useValue(semantic)
      .compile();
    await module.init();
    const pipeline = module.get(CreatorContentPipelineService);
    const actor = {
      actorUserId: user.id,
      actorMembershipId: workspace.id,
      actorRole: "OWNER" as const,
      workspaceId: workspace.id,
      organizationId: organization.id,
      subjectCreatorProfileId: user.creatorProfile.id,
      subjectOwnerUserId: user.id,
      allowedActions: ["INSIGHTS_CONTENT_READ" as const],
    };
    const input = {
      actor,
      integrationId: integration.id,
      providerAccountId: ACCOUNT,
      authorizationGeneration: 1,
      capturedAt,
      requestIdentity: "creator-content:p4:production-path:success:v1",
    };
    const success = await pipeline.execute(input);
    const callsAfterSuccess = {
      provider: providerCalls,
      semantic: semanticCalls,
    };
    const replay = await pipeline.execute(input);
    failProvider = true;
    let failed = false;
    try {
      await pipeline.execute({
        ...input,
        requestIdentity: "creator-content:p4:production-path:failure:v1",
      });
    } catch {
      failed = true;
    }
    if (
      success.reused ||
      !replay.reused ||
      !failed ||
      providerCalls !== callsAfterSuccess.provider + 1 ||
      semanticCalls !== callsAfterSuccess.semantic
    )
      throw new Error("P4 success/replay/failure proof failed");
    const rows = await db.$queryRawUnsafe<Array<Record<string, bigint>>>(
      `SELECT (SELECT count(*) FROM data_extraction_captures WHERE owner_scope_id IS NOT NULL) captures, (SELECT count(*) FROM data_extraction_evidence_items WHERE owner_scope_id IS NOT NULL) evidence, (SELECT count(*) FROM intelligence_object_generations WHERE brand_id IS NULL AND object_semantic_id='creator_content') objects, (SELECT count(*) FROM intelligence_component_generations WHERE brand_id IS NULL AND object_semantic_id='creator_content') components, (SELECT count(*) FROM intelligence_current_components WHERE brand_id IS NULL AND object_semantic_id='creator_content') current_rows`,
    );
    console.log(
      JSON.stringify({
        fixture: "CREATOR_CONTENT_P4_AUTHENTICATED_PRODUCTION_VERTICAL",
        credentials: "NOT_REPORTED",
        provider: "SYNTHETIC_NO_NETWORK",
        providerCalls: callsAfterSuccess.provider,
        semanticCalls: callsAfterSuccess.semantic,
        replayAdditionalCalls: 0,
        failedChangedExecution: "CURRENT_PRESERVED",
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
