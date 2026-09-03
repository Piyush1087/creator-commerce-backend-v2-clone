import "reflect-metadata";

import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import { PrismaClient } from "@prisma/client";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BrandLocationService } from "../brand-canonical-state/brand-location.service";
import { BrandVisualStateService } from "../brand-canonical-state/brand-visual-state.service";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "../brand-centre/brand-workspace-authorization.service";
import { BrandConsumerService } from "../brand-centre/consumer/brand-consumer.service";
import { BrandCurrentReadService } from "../brand-centre/consumer/brand-current-read.service";
import { CanonicalOfferingDiscoveryService } from "../brand-centre/consumer/canonical-offering-discovery.service";
import { ProcessorRuntimeProjectionService } from "../brand-centre/consumer/processor-runtime-projection.service";
import { ProductConsumerService } from "../brand-centre/consumer/product-consumer.service";
import { BrandCentreSessionEvictionService } from "../brand-centre/services/brand-centre-session-eviction.service";
import { CanonicalOfferingStateService } from "../brand-centre/services/canonical-offering-state.service";
import { ContractBundleIntegrityVerifier } from "../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { BundlePathOwnershipRegistry } from "../brand-intelligence/contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../brand-intelligence/contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../brand-intelligence/contracts/validation/semantic.validator";
import { M1CanonicalBrandStateAdapter } from "../brand-intelligence/input/canonical-state/m1-canonical-brand-state.adapter";
import { IntelligenceCurrentContractScopeService } from "../brand-intelligence/projection/intelligence-current-contract-scope.service";
import { IntelligenceCurrentProjectionRepository } from "../brand-intelligence/projection/intelligence-current-projection.repository";
import { IntelligenceCurrentProjectionService } from "../brand-intelligence/projection/intelligence-current-projection.service";
import { IntelligenceObjectAssembler } from "../brand-intelligence/projection/intelligence-object-assembler";
import { ComponentPathCodec } from "../brand-intelligence/semantic-path/component-path.codec";
import { BrandSettingsAccessService } from "../brand-settings/services/brand-settings-access.service";
import { BrandProviderReadinessService } from "../brand-settings/services/brand-provider-readiness.service";
import { BrandCampaignConsumerService } from "../brand-uce/consumer/brand-campaign-consumer.service";
import { BrandWorkspaceReadinessConsumerService } from "../brand-workspace-readiness/brand-workspace-readiness-consumer.service";
import { CollaborationConsumerService } from "../collaboration/services/collaboration-consumer.service";
import { BrandIntelligenceConsumerAdapter } from "../intelligence-consumer/adapters/brand-intelligence-consumer.adapter";
import { ProductIntelligenceConsumerAdapter } from "../intelligence-consumer/adapters/product-intelligence-consumer.adapter";
import { IntelligenceConsumerRegistry } from "../intelligence-consumer/intelligence-consumer.registry";
import { IntelligenceConsumerService } from "../intelligence-consumer/intelligence-consumer.service";
import { SubscriptionAccessService } from "../pricing/services/subscription-access.service";
import { SubscriptionCapabilityService } from "../pricing/services/subscription-capability.service";
import { BrandHomeAggregationService } from "./brand-home-aggregation.service";
import { BrandHomeClassifierService } from "./brand-home-classifier.service";
import { BRAND_HOME_SECTION_IDS } from "./brand-home.contract";
import { BrandHomeController } from "./brand-home.controller";
import { BrandHomeDuplicateSuppressor } from "./brand-home-duplicate-suppressor.service";
import { BrandHomePrioritizer } from "./brand-home-prioritizer.service";
import { BrandHomeResponseSchema } from "./brand-home.schema";

const FIXED_NOW = "2026-09-03T06:00:00.000Z";
const PRIMARY_USER_ID = "244023ed-0031-4e50-967c-ba58a4bc76f5";
const PRIMARY_BRAND_ID = "1af76731-f357-434f-96d3-2a37e5045e96";
const PRIMARY_OFFERING_ID = "549768e1-7d6b-466f-8451-f1f3ea505215";
const PRIMARY_COLLABORATION_ID = "5f100000-0000-4000-8000-000000000005";
const PRIMARY_CAMPAIGN_ID = "310e6b52-2001-4642-ba8d-d82190aa1ed1";
const MOMENTUM_CAMPAIGN_ID = "5f100000-0000-4000-8000-00000000000f";
const SECOND_USER_ID = "5f100000-0000-4000-8000-00000000000a";
const SECOND_BRAND_ID = "5f100000-0000-4000-8000-00000000000b";

describe.skipIf(process.env.CHAT_HOME_P5_B_DATABASE_TEST !== "true")(
  "P5-B Brand Home PostgreSQL and HTTP acceptance",
  () => {
    const prisma = new PrismaClient();
    const db = prisma as unknown as PrismaService;
    const runtime = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      new SemanticValidator(),
    );
    const codec = new ComponentPathCodec();
    const projection = new IntelligenceCurrentProjectionService(
      new IntelligenceCurrentProjectionRepository(db),
      new IntelligenceCurrentContractScopeService(
        runtime,
        new BundlePathOwnershipRegistry(runtime, codec),
        codec,
      ),
      new IntelligenceObjectAssembler(codec),
    );
    const visuals = new BrandVisualStateService(db);
    const canonicalBrand = new M1CanonicalBrandStateAdapter(db, visuals);
    const brandAuth = new BrandCentreAuthService(
      db,
      new BrandCentreSessionEvictionService(db),
    );
    const workspace = new BrandWorkspaceAuthorizationService(db, brandAuth);
    const processorRuntime = new ProcessorRuntimeProjectionService(db);
    const brandConsumer = new BrandConsumerService(
      brandAuth,
      canonicalBrand,
      visuals,
      new BrandLocationService(db),
      projection,
      processorRuntime,
    );
    const productConsumer = new ProductConsumerService(
      brandAuth,
      db,
      new CanonicalOfferingStateService(db),
      projection,
      processorRuntime,
    );
    const intelligence = new IntelligenceConsumerService(
      new IntelligenceConsumerRegistry([
        new BrandIntelligenceConsumerAdapter(brandConsumer),
        new ProductIntelligenceConsumerAdapter(productConsumer),
      ]),
    );
    const prioritizer = new BrandHomePrioritizer();
    const homeService = new BrandHomeAggregationService(
      workspace,
      new BrandCurrentReadService(canonicalBrand),
      new CanonicalOfferingDiscoveryService(brandAuth, db),
      intelligence,
      new CollaborationConsumerService(db, workspace),
      new BrandWorkspaceReadinessConsumerService(
        db,
        workspace,
        brandConsumer,
        new SubscriptionCapabilityService(db, new SubscriptionAccessService()),
      ),
      new BrandProviderReadinessService(
        db,
        new BrandSettingsAccessService(db, workspace),
      ),
      new BrandCampaignConsumerService(db),
      new BrandHomeClassifierService(),
      prioritizer,
      new BrandHomeDuplicateSuppressor(prioritizer),
      { now: () => new Date(FIXED_NOW) },
    );
    let app: INestApplication;
    let baseUrl: string;
    let primary: AuthUser;
    let second: AuthUser;
    let businessBefore: unknown;
    let secondIntelligenceBefore: Awaited<
      ReturnType<typeof intelligenceCounts>
    >;

    const asActor = (user: {
      id: string;
      email: string;
      name: string | null;
      role: AuthUser["role"];
      organizationId: string | null;
    }): AuthUser => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    });

    function intelligenceCounts(brandId: string) {
      return Promise.all([
        prisma.intelligenceSubject.count({ where: { brandId } }),
        prisma.intelligenceObjectGeneration.count({ where: { brandId } }),
        prisma.intelligenceComponentGeneration.count({ where: { brandId } }),
        prisma.intelligenceCurrentComponent.count({ where: { brandId } }),
      ]);
    }

    function businessSnapshot() {
      return Promise.all([
        prisma.collaboration.findUniqueOrThrow({
          where: { id: PRIMARY_COLLABORATION_ID },
          select: {
            id: true,
            currentStage: true,
            unreadCountBrand: true,
            isPaused: true,
            isTerminated: true,
            stageUpdatedAt: true,
            updatedAt: true,
          },
        }),
        prisma.uceCampaignCollaboration.findFirstOrThrow({
          where: { workflowCollaboration: { id: PRIMARY_COLLABORATION_ID } },
          select: {
            id: true,
            collabStatus: true,
            currentPhase: true,
            currentMilestone: true,
            pipelineHealth: true,
            actionRequiredByRole: true,
            currentMilestoneDeadline: true,
            updatedAt: true,
          },
        }),
        prisma.brandIntegration.findMany({
          where: {
            brandProfileId: { in: [PRIMARY_BRAND_ID, SECOND_BRAND_ID] },
          },
          orderBy: { id: "asc" },
          select: {
            id: true,
            authorizationHealth: true,
            humanActionRequired: true,
            isActive: true,
            updatedAt: true,
          },
        }),
        prisma.brandSubscription.findMany({
          where: {
            brandProfileId: { in: [PRIMARY_BRAND_ID, SECOND_BRAND_ID] },
          },
          orderBy: { id: "asc" },
          select: { id: true, status: true, tier: true, updatedAt: true },
        }),
        prisma.brandBillingProfile.findMany({
          where: {
            brandProfileId: { in: [PRIMARY_BRAND_ID, SECOND_BRAND_ID] },
          },
          orderBy: { id: "asc" },
          select: { id: true, profileState: true, updatedAt: true },
        }),
        prisma.uceCampaign.findMany({
          where: {
            id: { in: [PRIMARY_CAMPAIGN_ID, MOMENTUM_CAMPAIGN_ID] },
          },
          orderBy: { id: "asc" },
          select: { id: true, status: true, updatedAt: true },
        }),
        intelligenceCounts(PRIMARY_BRAND_ID),
        intelligenceCounts(SECOND_BRAND_ID),
      ]);
    }

    beforeAll(async () => {
      runtime.verifyAtRoot(
        join(
          process.cwd(),
          "src/features/brand-intelligence/generated/contract-bundles",
        ),
      );
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.pathname !== "/chat_home_p3_module_boundary_01"
      ) {
        throw new Error(
          "P5-B acceptance requires the exact disposable local fixture database",
        );
      }
      const migrations = await prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      `;
      expect(migrations[0]?.count).toBe(66);
      const [primaryUser, secondUser] = await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: PRIMARY_USER_ID },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            organizationId: true,
          },
        }),
        prisma.user.findUniqueOrThrow({
          where: { id: SECOND_USER_ID },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            organizationId: true,
          },
        }),
      ]);
      primary = asActor(primaryUser);
      second = asActor(secondUser);
      secondIntelligenceBefore = await intelligenceCounts(SECOND_BRAND_ID);
      expect(secondIntelligenceBefore).toEqual([0, 0, 0, 0]);
      businessBefore = await businessSnapshot();

      const allowActor = {
        canActivate(context: {
          switchToHttp(): {
            getRequest(): { headers: Record<string, string>; user?: AuthUser };
          };
        }) {
          const request = context.switchToHttp().getRequest();
          request.user =
            request.headers["x-test-actor"] === SECOND_USER_ID
              ? second
              : primary;
          return true;
        },
      };
      Reflect.defineMetadata(
        "design:paramtypes",
        [BrandHomeAggregationService],
        BrandHomeController,
      );
      const moduleRef = await Test.createTestingModule({
        controllers: [BrandHomeController],
        providers: [
          { provide: BrandHomeAggregationService, useValue: homeService },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(allowActor)
        .overrideGuard(ThrottlerGuard)
        .useValue({ canActivate: () => true })
        .compile();
      app = moduleRef.createNestApplication();
      await app.listen(0, "127.0.0.1");
      baseUrl = await app.getUrl();
    }, 120_000);

    afterAll(async () => {
      await app?.close();
      await prisma.$disconnect();
    });

    async function home(actor: AuthUser) {
      const response = await fetch(`${baseUrl}/api/v1/brand/home`, {
        headers: { "x-test-actor": actor.id },
      });
      return {
        status: response.status,
        payload: BrandHomeResponseSchema.parse(await response.json()),
      };
    }

    it("returns all four primary fixture sections with deterministic canonical items", async () => {
      const response = await home(primary);
      expect(response.status).toBe(200);
      expect(response.payload).toMatchObject({
        contractVersion: "1.0",
        generatedAt: FIXED_NOW,
        status: "READY",
        brand: { id: PRIMARY_BRAND_ID },
      });
      expect(
        response.payload.sourceStates.every(
          (source) => source.observedAt === FIXED_NOW,
        ),
      ).toBe(true);
      expect(
        response.payload.sourceStates.find(
          (source) => source.sourceDomain === "BRAND_INTELLIGENCE",
        ),
      ).toMatchObject({ state: "READY", freshness: "CURRENT" });
      expect(
        response.payload.sourceStates.find(
          (source) => source.sourceDomain === "PRODUCT_INTELLIGENCE",
        ),
      ).toMatchObject({ state: "READY", freshness: "CURRENT" });
      expect(response.payload.sections.map((section) => section.id)).toEqual(
        BRAND_HOME_SECTION_IDS,
      );
      const bySection = new Map(
        response.payload.sections.map((section) => [section.id, section]),
      );
      expect(bySection.get("NEEDS_ATTENTION")?.items).toContainEqual(
        expect.objectContaining({
          kind: "COLLABORATION_ATTENTION",
          entityRefs: expect.arrayContaining([
            { type: "COLLABORATION", id: PRIMARY_COLLABORATION_ID },
          ]),
          priorityTier: "DEADLINE_SLA_TIME_SENSITIVE",
        }),
      );
      expect(bySection.get("CREATOR_SHOP_HAS_LEARNED")?.items).toContainEqual(
        expect.objectContaining({
          kind: "BRAND_INTELLIGENCE_LEARNED",
          freshness: expect.objectContaining({
            changedAt: "2026-09-03T04:00:00.000Z",
          }),
        }),
      );
      expect(bySection.get("OPPORTUNITIES_NEXT_ACTIONS")?.items).toContainEqual(
        expect.objectContaining({
          kind: "OFFERING_OPPORTUNITY",
          entityRefs: expect.arrayContaining([
            { type: "OFFERING", id: PRIMARY_OFFERING_ID },
          ]),
          freshness: expect.objectContaining({
            changedAt: "2026-09-03T04:30:00.000Z",
          }),
        }),
      );
      expect(bySection.get("CURRENT_MOMENTUM")?.items).toContainEqual(
        expect.objectContaining({
          kind: "CAMPAIGN_MOMENTUM",
          entityRefs: [{ type: "CAMPAIGN", id: MOMENTUM_CAMPAIGN_ID }],
          freshness: expect.objectContaining({
            changedAt: "2026-09-03T05:00:00.000Z",
          }),
        }),
      );
      expect(
        bySection
          .get("CURRENT_MOMENTUM")
          ?.items.some((item) =>
            item.entityRefs.some(
              (ref) =>
                ref.type === "COLLABORATION" &&
                ref.id === PRIMARY_COLLABORATION_ID,
            ),
          ),
      ).toBe(false);
    }, 120_000);

    it("returns a safe second-Brand response without primary data or Intelligence writes", async () => {
      const response = await home(second);
      expect(response.status).toBe(200);
      expect(response.payload.brand.id).toBe(SECOND_BRAND_ID);
      expect(
        response.payload.sourceStates.every(
          (source) => source.observedAt === FIXED_NOW,
        ),
      ).toBe(true);
      expect(
        response.payload.sourceStates.find(
          (source) => source.sourceDomain === "PROVIDER_READINESS",
        ),
      ).toMatchObject({ state: "READY", freshness: "UNKNOWN" });
      expect(
        response.payload.sourceStates.find(
          (source) => source.sourceDomain === "BRAND_INTELLIGENCE",
        ),
      ).toMatchObject({ state: "READY", freshness: "UNKNOWN" });
      expect(
        response.payload.sourceStates.find(
          (source) => source.sourceDomain === "PRODUCT_INTELLIGENCE",
        ),
      ).toMatchObject({ state: "READY", freshness: "UNKNOWN" });
      expect(JSON.stringify(response.payload)).not.toMatch(
        new RegExp(
          [
            PRIMARY_BRAND_ID,
            PRIMARY_OFFERING_ID,
            PRIMARY_COLLABORATION_ID,
            MOMENTUM_CAMPAIGN_ID,
          ].join("|"),
          "u",
        ),
      );
      expect(response.payload.sections[0].items).toContainEqual(
        expect.objectContaining({
          kind: "PROVIDER_RECOVERY",
          navigation: { destinationId: "SETTINGS_INTEGRATIONS" },
        }),
      );
      expect(await intelligenceCounts(SECOND_BRAND_ID)).toEqual(
        secondIntelligenceBefore,
      );
    }, 120_000);

    it("leaves all snapshotted business and Intelligence state unchanged", async () => {
      expect(await businessSnapshot()).toEqual(businessBefore);
      expect(await intelligenceCounts(SECOND_BRAND_ID)).toEqual([0, 0, 0, 0]);
      const migrations = await prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      `;
      expect(migrations[0]?.count).toBe(66);
    });
  },
);
