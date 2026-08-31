import "reflect-metadata";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import {
  Prisma,
  PrismaClient,
  type IntelligenceProcessorExecutionStatus,
} from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { JwtStrategy } from "../../auth/jwt.strategy";
import type { AuthUser } from "../../auth/types/auth-user";
import { ContractBundleIntegrityVerifier } from "../../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { BundlePathOwnershipRegistry } from "../../brand-intelligence/contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../../brand-intelligence/contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../brand-intelligence/contracts/validation/semantic.validator";
import { IntelligenceCurrentContractScopeService } from "../../brand-intelligence/projection/intelligence-current-contract-scope.service";
import { IntelligenceCurrentProjectionRepository } from "../../brand-intelligence/projection/intelligence-current-projection.repository";
import { IntelligenceCurrentProjectionService } from "../../brand-intelligence/projection/intelligence-current-projection.service";
import { IntelligenceObjectAssembler } from "../../brand-intelligence/projection/intelligence-object-assembler";
import { ComponentPathCodec } from "../../brand-intelligence/semantic-path/component-path.codec";
import { resolveIntelligenceSubject } from "../../brand-intelligence/subject/intelligence-subject";
import {
  OwnedWebsiteWave1AcquisitionService,
  type OwnedWebsitePageAcquisitionMechanics,
} from "../../data-extraction/evidence/acquisition/owned-website-wave1-acquisition.service";
import { OwnedWebsiteWave1NormalizationService } from "../../data-extraction/evidence/normalization/owned-website-wave1-normalization.service";
import { DataExtractionPersistenceService } from "../../data-extraction/evidence/persistence/prisma-evidence-repositories";
import { BrandCentreAuthService } from "../brand-centre-auth.service";
import { BrandCentreSessionEvictionService } from "../services/brand-centre-session-eviction.service";
import { CanonicalOfferingStateService } from "../services/canonical-offering-state.service";
import { CanonicalOfferingDiscoveryService } from "./canonical-offering-discovery.service";
import { ProcessorRuntimeProjectionService } from "./processor-runtime-projection.service";
import { ProductConsumerController } from "./product-consumer.controller";
import { ProductConsumerService } from "./product-consumer.service";
import { PRODUCT_PROCESSOR_IDS } from "./product-consumer.types";

const databaseUrl = process.env.PRODUCT_CONSUMER_DATABASE_TEST_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const database = databaseUrl ? describe : describe.skip;

class CommercialEvidenceMechanics implements OwnedWebsitePageAcquisitionMechanics {
  async acquire(url: string) {
    return {
      url,
      html: `<main><p>Observed price INR 777.</p></main><script type="application/ld+json">${JSON.stringify(
        {
          "@type": "Product",
          offers: { "@type": "Offer", price: "777", priceCurrency: "INR" },
        },
      )}</script>`,
      cleanText: "Observed price INR 777.",
      internalLinks: [],
      quality: {
        state: "COMPLETE" as const,
        failureCategories: [],
        detailCodes: [],
      },
      attempts: [
        {
          providerExecutionRef: `provider-execution:${randomUUID()}`,
          attemptRole: "PRIMARY" as const,
        },
      ],
      reasonCodes: [],
    };
  }
}

database("Product consumer exact-Offering PostgreSQL surface", () => {
  const prisma = new PrismaClient({ transactionOptions: { maxWait: 10_000 } });
  const db = prisma as unknown as PrismaService;
  const codec = new ComponentPathCodec();
  const contracts = new ContractRuntimeRegistry(
    new ContractBundleIntegrityVerifier(),
    new SemanticValidator(),
  );
  const scopes = new IntelligenceCurrentContractScopeService(
    contracts,
    new BundlePathOwnershipRegistry(contracts, codec),
    codec,
  );
  const projection = new IntelligenceCurrentProjectionService(
    new IntelligenceCurrentProjectionRepository(db),
    scopes,
    new IntelligenceObjectAssembler(codec),
  );
  const auth = new BrandCentreAuthService(
    db,
    new BrandCentreSessionEvictionService(db),
  );
  const canonical = new CanonicalOfferingStateService(db);
  const discovery = new CanonicalOfferingDiscoveryService(auth, db);
  const runtime = new ProcessorRuntimeProjectionService(db);
  const service = new ProductConsumerService(
    auth,
    db,
    canonical,
    projection,
    runtime,
  );
  const persistence = new DataExtractionPersistenceService(db);
  const normalization = new OwnedWebsiteWave1NormalizationService(
    persistence,
    db,
  );
  const hash = (value: unknown) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const secret = randomBytes(32).toString("hex");
  const jwt = new JwtService({ secret });
  let app: INestApplication;
  let baseUrl: string;

  async function brand(label: string) {
    const organization = await prisma.organization.create({
      data: { name: `Product consumer ${label}` },
    });
    const profile = await prisma.brandProfile.create({
      data: {
        organizationId: organization.id,
        name: `Product consumer ${label}`,
        industry: "D2C",
        domain: `${randomUUID()}.example.test`,
      },
    });
    const user: AuthUser = {
      id: randomUUID(),
      organizationId: organization.id,
      role: "BRAND",
      email: `${label}@example.test`,
      name: label,
    };
    return { profile, user };
  }

  async function offering(
    brandId: string,
    name: string,
    lifecycle: "DRAFT_INCOMPLETE" | "ACTIVE" | "PAUSED_INACTIVE" = "ACTIVE",
  ) {
    return canonical.createCanonical({
      brandProfileId: brandId,
      legacyType: "PRODUCT",
      name,
      url: `https://shop.example.test/products/${randomUUID()}`,
      lifecycle,
      description: `${name} canonical description`,
    });
  }

  async function generation(
    brandId: string,
    offeringId: string,
    objectSemanticId: string,
    value: unknown,
    options: { protected?: boolean; partial?: boolean } = {},
  ) {
    const subject = await resolveIntelligenceSubject(prisma, brandId, {
      type: "OFFERING",
      ref: offeringId,
    });
    const action = await prisma.intelligenceAction.create({
      data: {
        brandId,
        subjectId: subject.id,
        actionType: "PRODUCT_CONSUMER_TEST_FIXTURE",
        actorType: "SYSTEM",
        actorRef: "test",
        requestIdempotencyKey: randomUUID(),
        correlationRef: randomUUID(),
        reasonCode: "TEST",
        requestedAtomicity: "GENERATION_ONLY",
        outcome: "PERSISTED",
      },
    });
    const scope = scopes.resolveObject(objectSemanticId);
    const readiness = options.partial ? "PARTIAL" : "READY";
    const payload = value as Prisma.InputJsonValue;
    const object = await prisma.intelligenceObjectGeneration.create({
      data: {
        brandId,
        subjectId: subject.id,
        objectSemanticId,
        objectContractId: objectSemanticId,
        objectContractVersion: "1.0",
        outputContractId: scope.outputContractId,
        outputContractVersion: scope.outputContractVersion,
        producerKind: "AUTHORIZED_APPLICATION_ACTION",
        producerId: "product-consumer-test",
        bundleId: `brand_intelligence.${objectSemanticId}`,
        bundleVersion: "1.0",
        bundleHash: hash(["bundle", objectSemanticId]),
        actionId: action.id,
        valueState: "VALUE",
        valuePayload: payload,
        valueHash: hash(value),
        objectMetadataPayload: {},
        readiness,
        freshnessAtGeneration: "CURRENT",
        activeScope: ["$"],
        activeScopeHash: hash(["$"]),
      },
    });
    const component = await prisma.intelligenceComponentGeneration.create({
      data: {
        brandId,
        subjectId: subject.id,
        objectGenerationId: object.id,
        objectSemanticId,
        pathSchemeVersion: 1,
        componentSemanticPath: "$",
        nodeKind: "OBJECT_FIELD",
        componentContractId: objectSemanticId,
        componentContractVersion: "1.0",
        valueState: "VALUE",
        valuePayload: payload,
        valueHash: hash(value),
        authority: options.protected
          ? "BRAND_CONFIRMED"
          : "CREATOR_SHOP_DERIVED",
        sourceClass: "CANONICAL_BUSINESS_STATE",
        readiness,
        freshnessAtGeneration: "CURRENT",
        metadataPayload: {},
      },
    });
    return { subject, action, object, component };
  }

  async function current(
    brandId: string,
    offeringId: string,
    objectSemanticId: string,
    value: unknown,
    options: { protected?: boolean; partial?: boolean; stale?: boolean } = {},
  ) {
    const generated = await generation(
      brandId,
      offeringId,
      objectSemanticId,
      value,
      options,
    );
    const row = await prisma.intelligenceCurrentComponent.create({
      data: {
        brandId,
        subjectId: generated.subject.id,
        objectSemanticId,
        pathSchemeVersion: 1,
        componentSemanticPath: "$",
        nodeKind: generated.component.nodeKind,
        currentComponentGenerationId: generated.component.id,
        currentContractId: generated.component.componentContractId,
        currentContractVersion: generated.component.componentContractVersion,
        currentAuthority: generated.component.authority,
        currentSourceClass: generated.component.sourceClass,
        currentReadiness: generated.component.readiness,
        currentFreshness: options.stale ? "STALE" : "CURRENT",
        protectionState: options.protected ? "BRAND_CONFIRMED" : "UNPROTECTED",
        staleReasonCode: options.stale ? "CANONICAL_EDIT" : null,
      },
    });
    return { ...generated, row };
  }

  async function candidate(
    brandId: string,
    offeringId: string,
    objectSemanticId: string,
    protectedCurrent: Awaited<ReturnType<typeof current>>,
  ) {
    const proposed = await generation(brandId, offeringId, objectSemanticId, {
      proposed: "candidate must remain hidden",
    });
    return prisma.intelligenceComponentCandidate.create({
      data: {
        brandId,
        subjectId: proposed.subject.id,
        objectSemanticId,
        pathSchemeVersion: 1,
        componentSemanticPath: "$",
        candidateComponentGenerationId: proposed.component.id,
        currentComponentId: protectedCurrent.row.id,
        basisCurrentComponentGenerationId: protectedCurrent.component.id,
        basisCurrentRevision: protectedCurrent.row.revision,
        candidateValueHash: proposed.component.valueHash,
        producerActionId: proposed.action.id,
        discrepancyCode: "PROTECTED_VALUE_CONFLICT",
      },
    });
  }

  async function processorExecution(
    brandId: string,
    offeringId: string,
    processorId: string,
    status: IntelligenceProcessorExecutionStatus,
    options: {
      attemptCount?: number;
      lastErrorCategory?: string;
      lastErrorCode?: string;
      resultReadiness?: "READY" | "PARTIAL" | "NOT_READY";
    } = {},
  ) {
    const subject = await resolveIntelligenceSubject(prisma, brandId, {
      type: "OFFERING",
      ref: offeringId,
    });
    const now = new Date();
    const running = status === "RUNNING";
    const terminal = ["COMPLETED", "FAILED_TERMINAL", "CANCELLED"].includes(
      status,
    );
    return prisma.intelligenceExecution.create({
      data: {
        brandId,
        subjectId: subject.id,
        triggerType: "PRODUCT_CONSUMER_RUNTIME_TEST",
        triggerRef: processorId,
        triggerIdempotencyKey: randomUUID(),
        correlationRef: randomUUID(),
        requestedImpact: [processorId],
        status: running
          ? "RUNNING"
          : terminal
            ? status === "FAILED_TERMINAL"
              ? "FAILED"
              : status === "CANCELLED"
                ? "CANCELLED"
                : "COMPLETED"
            : "PENDING",
        startedAt: running || terminal ? now : null,
        completedAt: terminal ? now : null,
        processorExecutions: {
          create: {
            brand: { connect: { id: brandId } },
            subject: { connect: { id: subject.id } },
            processorId,
            processorVersion: "1.0",
            bundleId: `brand_intelligence.${processorId}`,
            bundleVersion: "1.0",
            bundleHash: hash(["bundle", processorId]),
            outputContractId: `${processorId}_output_contract`,
            outputContractVersion: "1.0",
            activeScope: ["$"],
            activeScopeHash: hash(["scope", processorId]),
            dependencyManifest: {},
            dependencyManifestHash: hash(["dependency", processorId]),
            evidenceManifest: {},
            evidenceManifestHash: hash(["evidence", processorId]),
            triggerIntentKey: randomUUID(),
            processorExecutionKey: hash([randomUUID(), processorId]),
            maxAttempts: 3,
            status,
            resultReadiness:
              status === "COMPLETED"
                ? (options.resultReadiness ?? "READY")
                : null,
            eligibleAt: status === "QUEUED" ? now : null,
            attemptCount: options.attemptCount ?? (running ? 1 : 0),
            leaseToken: running ? randomUUID() : null,
            leaseOwnerRef: running ? "product-consumer-test" : null,
            leaseExpiresAt: running ? new Date(now.getTime() + 60_000) : null,
            lastHeartbeatAt: running ? now : null,
            lastErrorCategory: options.lastErrorCategory,
            lastErrorCode: options.lastErrorCode,
            startedAt: running || terminal ? now : null,
            completedAt: terminal ? now : null,
          },
        },
      },
      include: { processorExecutions: true },
    });
  }

  async function commercialEvidence(brandId: string, offeringId: string) {
    const mechanics = new CommercialEvidenceMechanics();
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics,
    );
    const url = `https://shop.example.test/products/${offeringId}`;
    const acquired = await acquisition.request({
      brandId,
      capabilityId: "owned_website.offering_commercial_evidence",
      requestKey: `consumer-commercial:${randomUUID()}`,
      normalizationContractVersion: "1.0",
      freshnessIntent: "REUSE_ALLOWED",
      ownedWebsiteRoot: "https://shop.example.test/",
      exactOfferingScope: {
        canonicalOfferingRef: offeringId,
        resourceUrls: [url],
      },
    });
    await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
      exactOfferingScope: {
        canonicalOfferingRef: offeringId,
        captureRefs: [acquired.exactOfferingResources![0]!.captureRef],
      },
    });
  }

  beforeAll(async () => {
    await prisma.$connect();
    contracts.verifyAtRoot(
      join(
        process.cwd(),
        "src/features/brand-intelligence/generated/contract-bundles",
      ),
    );
    new JwtStrategy(new ConfigService({ JWT_SECRET: secret }));
    Reflect.defineMetadata(
      "design:paramtypes",
      [ProductConsumerService, CanonicalOfferingDiscoveryService],
      ProductConsumerController,
    );
    Reflect.defineMetadata("design:paramtypes", [Reflector], JwtAuthGuard);
    const module = await Test.createTestingModule({
      controllers: [ProductConsumerController],
      providers: [
        { provide: ProductConsumerService, useValue: service },
        { provide: CanonicalOfferingDiscoveryService, useValue: discovery },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it("serves an authenticated empty canonical Offering collection", async () => {
    const { user } = await brand("discovery-empty");
    const token = jwt.sign({ sub: user.id, ...user });
    expect(
      (await fetch(`${baseUrl}/api/v1/brand-centre/offerings`)).status,
    ).toBe(401);

    const response = await fetch(`${baseUrl}/api/v1/brand-centre/offerings`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ offerings: [] });
  });

  it("lists only resolved own-Brand canonical Offerings in stable order", async () => {
    const own = await brand("discovery-own");
    const foreign = await brand("discovery-foreign");
    const definitions = [
      ["PRODUCT", "ACTIVE", "Canonical Product"],
      ["SERVICE", "DRAFT_INCOMPLETE", "Canonical Service"],
      ["EXPERIENCE", "PAUSED_INACTIVE", "Canonical Experience"],
      ["COLLECTION", "ACTIVE", "Canonical Bundle"],
      ["TREATMENT", "ACTIVE", "Canonical Treatment"],
    ] as const;
    const items = await Promise.all(
      definitions.map(([legacyType, lifecycle, name]) =>
        canonical.createCanonical({
          brandProfileId: own.profile.id,
          legacyType,
          lifecycle,
          name,
          url: `https://shop.example.test/discovery/${randomUUID()}`,
        }),
      ),
    );
    const createdAt = new Date("2026-08-28T00:00:00.000Z");
    await prisma.offering.updateMany({
      where: { id: { in: items.map((item) => item.id) } },
      data: { createdAt },
    });
    const foreignItem = await offering(
      foreign.profile.id,
      "Foreign Discovery Offering",
    );
    const unresolved = await prisma.offering.create({
      data: {
        brandProfileId: own.profile.id,
        type: "MODULE",
        canonicalKind: null,
        canonicalLifecycle: null,
        name: "Unresolved Historical Module",
        url: `https://shop.example.test/discovery/${randomUUID()}`,
        isActive: false,
      },
    });
    const before = {
      subjects: await prisma.intelligenceSubject.count({
        where: { brandId: own.profile.id },
      }),
      executions: await prisma.intelligenceExecution.count({
        where: { brandId: own.profile.id },
      }),
      capabilityExecutions:
        await prisma.dataExtractionCapabilityExecution.count({
          where: { brandId: own.profile.id },
        }),
      priceRevisions: await prisma.offeringPriceRevision.count({
        where: { brandProfileId: own.profile.id },
      }),
    };
    const token = jwt.sign({ sub: own.user.id, ...own.user });
    const response = await fetch(
      `${baseUrl}/api/v1/brand-centre/offerings?brandId=${foreign.profile.id}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    const expected = [...items]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => ({
        offeringId: item.id,
        name: item.name,
        kind: item.canonicalKind,
        subtype: item.canonicalSubtype,
        lifecycle: item.canonicalLifecycle,
      }));
    expect(result).toEqual({ offerings: expected });
    expect(
      result.offerings.every(
        (item: Record<string, unknown>) =>
          Object.keys(item).sort().join(",") ===
          "kind,lifecycle,name,offeringId,subtype",
      ),
    ).toBe(true);
    expect(result.offerings.map((item: { kind: string }) => item.kind)).toEqual(
      expect.arrayContaining(["PRODUCT", "SERVICE", "EXPERIENCE", "BUNDLE"]),
    );
    expect(
      result.offerings.map((item: { lifecycle: string }) => item.lifecycle),
    ).toEqual(
      expect.arrayContaining(["ACTIVE", "DRAFT_INCOMPLETE", "PAUSED_INACTIVE"]),
    );
    expect(result.offerings).toContainEqual(
      expect.objectContaining({ kind: "SERVICE", subtype: "TREATMENT" }),
    );
    expect(JSON.stringify(result)).not.toContain(foreignItem.id);
    expect(JSON.stringify(result)).not.toContain(unresolved.id);
    expect(JSON.stringify(result)).not.toContain("canonicalPrice");
    expect(JSON.stringify(result)).not.toContain("processorRuntime");
    expect(JSON.stringify(result)).not.toContain("intelligence");
    expect(JSON.stringify(result)).not.toContain("isDeepScanned");
    expect({
      subjects: await prisma.intelligenceSubject.count({
        where: { brandId: own.profile.id },
      }),
      executions: await prisma.intelligenceExecution.count({
        where: { brandId: own.profile.id },
      }),
      capabilityExecutions:
        await prisma.dataExtractionCapabilityExecution.count({
          where: { brandId: own.profile.id },
        }),
      priceRevisions: await prisma.offeringPriceRevision.count({
        where: { brandProfileId: own.profile.id },
      }),
    }).toEqual(before);

    for (const item of result.offerings as Array<{ offeringId: string }>) {
      const detail = await fetch(
        `${baseUrl}/api/v1/brand-centre/offerings/${item.offeringId}/intelligence`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      expect(detail.status).toBe(200);
      expect((await detail.json()).offering.id).toBe(item.offeringId);
    }
  }, 30_000);

  it("returns no-intelligence without writes and never promotes commercial Evidence to canonical price", async () => {
    const { profile, user } = await brand("no-intelligence");
    const item = await offering(profile.id, "Evidence-only Offering");
    await commercialEvidence(profile.id, item.id);
    expect(
      await prisma.dataExtractionEvidenceItem.count({
        where: {
          brandId: profile.id,
          capabilityId: "owned_website.offering_commercial_evidence",
        },
      }),
    ).toBeGreaterThan(0);
    const before = {
      subjects: await prisma.intelligenceSubject.count({
        where: { brandId: profile.id },
      }),
      executions: await prisma.intelligenceExecution.count({
        where: { brandId: profile.id },
      }),
      generations: await prisma.intelligenceObjectGeneration.count({
        where: { brandId: profile.id },
      }),
    };
    const result = await service.read(user, item.id);
    expect(result.offering.canonicalPrice).toEqual({ state: "UNAVAILABLE" });
    expect(
      Object.values(result.intelligence).every(
        (object) => object.current.kind === "NO_CURRENT",
      ),
    ).toBe(true);
    expect(Object.keys(result.processorRuntime)).toEqual(PRODUCT_PROCESSOR_IDS);
    expect(
      Object.values(result.processorRuntime).every(
        (entry) =>
          entry.activity === "IDLE" &&
          entry.readiness === "NOT_READY" &&
          !entry.hasCurrent,
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain(
      "owned_website.offering_commercial_evidence",
    );
    expect(JSON.stringify(result)).not.toContain("777");
    expect({
      subjects: await prisma.intelligenceSubject.count({
        where: { brandId: profile.id },
      }),
      executions: await prisma.intelligenceExecution.count({
        where: { brandId: profile.id },
      }),
      generations: await prisma.intelligenceObjectGeneration.count({
        where: { brandId: profile.id },
      }),
    }).toEqual(before);
  }, 30_000);

  it("preserves progressive, mixed, failed-refresh, stale, refreshing, and candidate dimensions", async () => {
    const { profile, user } = await brand("mixed");
    const a = await offering(profile.id, "Offering A");
    const b = await offering(profile.id, "Offering B");

    await current(profile.id, a.id, "offering_factual_profile", {
      factual_summary: "Offering A factual",
    });
    let result = await service.read(user, a.id);
    expect(result.intelligence.factualProfile.readiness).toBe("READY");
    expect(result.intelligence.creatorCommunicationProfile.readiness).toBe(
      "NOT_READY",
    );

    await current(
      profile.id,
      a.id,
      "offering_actionability_profile",
      { customer_action: [{ semantic_id: "visit", action: "Visit A" }] },
      { partial: true },
    );
    await processorExecution(
      profile.id,
      a.id,
      "offering_creator_communication",
      "WAITING_FOR_DEPENDENCY",
      {
        lastErrorCategory: "DEPENDENCY_UNAVAILABLE",
        lastErrorCode: "CURRENT_FACTUAL_PROFILE_NOT_AVAILABLE",
      },
    );
    result = await service.read(user, a.id);
    expect(result.processorRuntime.offering_factual_synthesis.readiness).toBe(
      "READY",
    );
    expect(
      result.processorRuntime.offering_creator_communication,
    ).toMatchObject({
      readiness: "NOT_READY",
      dependencyReadiness: "WAITING_FOR_DEPENDENCY",
      activity: "WAITING_FOR_DEPENDENCY",
    });
    expect(
      result.processorRuntime.offering_actionability_synthesis.readiness,
    ).toBe("PARTIAL");

    const creator = await current(
      profile.id,
      a.id,
      "offering_creator_communication_profile",
      { creator_talking_points: [{ semantic_id: "grounded", text: "A" }] },
      { protected: true },
    );
    result = await service.read(user, a.id);
    expect(result.intelligence.factualProfile.current.kind).toBe("VALUE");
    expect(result.intelligence.creatorCommunicationProfile.current.kind).toBe(
      "VALUE",
    );
    expect(result.intelligence.actionabilityProfile.current.kind).toBe("VALUE");
    expect(result.offering.canonicalPrice.state).toBe("UNAVAILABLE");

    await prisma.intelligenceCurrentComponent.updateMany({
      where: {
        brandId: profile.id,
        subjectId: creator.subject.id,
        objectSemanticId: "offering_factual_profile",
      },
      data: {
        currentFreshness: "STALE",
        staleReasonCode: "CANONICAL_EDIT",
      },
    });
    await candidate(
      profile.id,
      a.id,
      "offering_creator_communication_profile",
      creator,
    );
    await processorExecution(
      profile.id,
      a.id,
      "offering_factual_synthesis",
      "FAILED_TERMINAL",
      {
        attemptCount: 3,
        lastErrorCategory: "VALIDATION_FAILURE",
        lastErrorCode: "STRUCTURED_OUTPUT_INVALID",
      },
    );
    await processorExecution(
      profile.id,
      a.id,
      "offering_creator_communication",
      "RUNNING",
    );
    await processorExecution(
      profile.id,
      a.id,
      "offering_actionability_synthesis",
      "COMPLETED",
      { resultReadiness: "PARTIAL" },
    );
    result = await service.read(user, a.id);
    expect(result.intelligence.factualProfile.freshness).toBe("STALE");
    expect(result.intelligence.factualProfile.current.kind).toBe("VALUE");
    expect(result.processorRuntime.offering_factual_synthesis).toMatchObject({
      activity: "TEMPORARILY_UNAVAILABLE",
      readiness: "READY",
      hasCurrent: true,
      failure: {
        code: "STRUCTURED_OUTPUT_INVALID",
        currentPreserved: true,
      },
    });
    expect(
      result.processorRuntime.offering_creator_communication,
    ).toMatchObject({ activity: "REFRESHING", refreshing: true });
    expect(
      Object.values(result.processorRuntime).filter(
        (entry) => entry.refreshing,
      ),
    ).toHaveLength(1);
    expect(result.intelligence.creatorCommunicationProfile.candidate).toEqual({
      status: "CONFLICT",
      count: 1,
      currentPreserved: true,
      summaryAvailable: true,
      rawCandidateVisible: false,
    });
    expect(JSON.stringify(result)).not.toContain(
      "candidate must remain hidden",
    );

    await current(
      profile.id,
      b.id,
      "offering_factual_profile",
      { factual_summary: "Offering B only" },
      { stale: true },
    );
    await current(profile.id, b.id, "offering_creator_communication_profile", {
      creator_talking_points: [{ semantic_id: "b", text: "B" }],
    });
    const resultB = await service.read(user, b.id);
    expect(resultB.intelligence.factualProfile.freshness).toBe("STALE");
    expect(resultB.intelligence.creatorCommunicationProfile.readiness).toBe(
      "READY",
    );
    expect(resultB.intelligence.actionabilityProfile.readiness).toBe(
      "NOT_READY",
    );
    expect(JSON.stringify(resultB)).not.toContain("Offering A factual");
    expect(JSON.stringify(resultB)).not.toContain(
      "candidate must remain hidden",
    );
  }, 30_000);

  it("returns only exact canonical price, media, Offer, and Location references", async () => {
    const { profile, user } = await brand("canonical");
    const item = await offering(profile.id, "Canonical Offering");
    const media = await canonical.addMedia(profile.id, item.id, {
      url: "https://cdn.example.test/canonical.jpg",
      label: "Primary",
      altText: "Canonical Offering",
      makePrimary: true,
      authority: "APPLICATION_CANONICAL",
      origin: "APPLICATION_WORKFLOW",
    });
    const location = await prisma.location.create({
      data: {
        brandProfileId: profile.id,
        name: "Exact location",
        address: "10 Exact Street",
        authority: "APPLICATION_CANONICAL",
        lifecycle: "ACTIVE",
      },
    });
    await canonical.addLocationAvailability(profile.id, item.id, location.id);
    const offer = await prisma.brandOffer.create({
      data: {
        brandProfileId: profile.id,
        offerName: "Exact offer",
        promoCode: `EXACT-${randomUUID()}`,
        applicabilityScope: "EXACT_OFFERING",
        validityStart: new Date("2026-08-01T00:00:00.000Z"),
        validityEnd: new Date("2026-09-01T00:00:00.000Z"),
      },
    });
    await canonical.addOfferApplicability(profile.id, offer.id, item.id);
    const price = await canonical.advancePrice(profile.id, item.id, null, {
      mode: "EXACT",
      currentMinAmount: 25,
      currentMaxAmount: 25,
      regularMinAmount: null,
      regularMaxAmount: null,
      currency: "USD",
      freshness: "CURRENT",
      authority: "APPLICATION_CANONICAL",
      origin: "APPLICATION_WORKFLOW",
      sourceClass: "CANONICAL_BUSINESS_STATE",
      freshnessEvaluatedAt: new Date("2026-08-28T00:00:00.000Z"),
    });
    const result = await service.read(user, item.id);
    expect(result.offering.primaryMedia).toMatchObject({ id: media.id });
    expect(result.offering.offerRefs).toEqual([{ offerId: offer.id }]);
    expect(result.offering.locationRefs).toEqual([{ locationId: location.id }]);
    expect(result.offering.canonicalPrice).toEqual({
      state: "CURRENT",
      revisionId: price.id,
      mode: "EXACT",
      currentMinAmount: "25",
      currentMaxAmount: "25",
      regularMinAmount: null,
      regularMaxAmount: null,
      currency: "USD",
      freshness: "CURRENT",
      authority: "APPLICATION_CANONICAL",
      evaluatedAt: "2026-08-28T00:00:00.000Z",
    });
  }, 30_000);

  it("fails closed across Brands and serves the authenticated exact-Offering route", async () => {
    const a = await brand("tenant-a");
    const b = await brand("tenant-b");
    const own = await offering(a.profile.id, "Own Offering");
    const foreign = await offering(b.profile.id, "Foreign Offering");
    await current(b.profile.id, foreign.id, "offering_factual_profile", {
      factual_summary: "FOREIGN SECRET",
    });

    await expect(service.read(a.user, foreign.id)).rejects.toMatchObject({
      status: 404,
    });
    const token = jwt.sign({ sub: a.user.id, ...a.user });
    expect(
      (
        await fetch(
          `${baseUrl}/api/v1/brand-centre/offerings/${own.id}/intelligence`,
        )
      ).status,
    ).toBe(401);
    const ownResponse = await fetch(
      `${baseUrl}/api/v1/brand-centre/offerings/${own.id}/intelligence`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(ownResponse.status).toBe(200);
    const ownResult = await ownResponse.json();
    expect(ownResult.offering.id).toBe(own.id);
    expect(Object.keys(ownResult.processorRuntime)).toEqual(
      PRODUCT_PROCESSOR_IDS,
    );

    const foreignResponse = await fetch(
      `${baseUrl}/api/v1/brand-centre/offerings/${foreign.id}/intelligence`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    const missingResponse = await fetch(
      `${baseUrl}/api/v1/brand-centre/offerings/${randomUUID()}/intelligence`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(foreignResponse.status).toBe(404);
    expect(missingResponse.status).toBe(404);
    expect(await foreignResponse.json()).toEqual(await missingResponse.json());
  }, 30_000);
});
