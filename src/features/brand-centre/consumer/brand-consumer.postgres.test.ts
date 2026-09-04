import "reflect-metadata";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  Prisma,
  PrismaClient,
  type IntelligenceProcessorExecutionStatus,
} from "@prisma/client";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { AuthSessionService } from "../../auth/auth-session.service";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../../prisma/prisma.service";
import { JwtStrategy } from "../../auth/jwt.strategy";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandVisualStateService } from "../../brand-canonical-state/brand-visual-state.service";
import { BrandLocationService } from "../../brand-canonical-state/brand-location.service";
import { M1CanonicalBrandStateAdapter } from "../../brand-intelligence/input/canonical-state/m1-canonical-brand-state.adapter";
import { ContractRuntimeRegistry } from "../../brand-intelligence/contracts/registry/contract-runtime.registry";
import { ContractBundleIntegrityVerifier } from "../../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { SemanticValidator } from "../../brand-intelligence/contracts/validation/semantic.validator";
import { BundlePathOwnershipRegistry } from "../../brand-intelligence/contracts/registry/bundle-path-ownership.registry";
import { ComponentPathCodec } from "../../brand-intelligence/semantic-path/component-path.codec";
import { IntelligenceCurrentContractScopeService } from "../../brand-intelligence/projection/intelligence-current-contract-scope.service";
import { IntelligenceCurrentProjectionRepository } from "../../brand-intelligence/projection/intelligence-current-projection.repository";
import { IntelligenceCurrentProjectionService } from "../../brand-intelligence/projection/intelligence-current-projection.service";
import { IntelligenceObjectAssembler } from "../../brand-intelligence/projection/intelligence-object-assembler";
import { resolveIntelligenceSubject } from "../../brand-intelligence/subject/intelligence-subject";
import { BrandCentreAuthService } from "../brand-centre-auth.service";
import { BrandCentreSessionEvictionService } from "../services/brand-centre-session-eviction.service";
import { BrandConsumerService } from "./brand-consumer.service";
import { BrandConsumerController } from "./brand-consumer.controller";
import { BRAND_CONSUMER_OBJECTS } from "./brand-consumer.mapper";
import { ProcessorRuntimeProjectionService } from "./processor-runtime-projection.service";

describe.skipIf(process.env.BRAND_CENTRE_DATABASE_TEST !== "true")(
  "Brand consumer PostgreSQL and authenticated HTTP",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { maxWait: 10_000 },
    });
    const db = prisma as unknown as PrismaService;
    const runtime = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      new SemanticValidator(),
    );
    const codec = new ComponentPathCodec();
    const ownership = new BundlePathOwnershipRegistry(runtime, codec);
    const scopes = new IntelligenceCurrentContractScopeService(
      runtime,
      ownership,
      codec,
    );
    const projection = new IntelligenceCurrentProjectionService(
      new IntelligenceCurrentProjectionRepository(db),
      scopes,
      new IntelligenceObjectAssembler(codec),
    );
    const visuals = new BrandVisualStateService(db);
    const locations = new BrandLocationService(db);
    const auth = new BrandCentreAuthService(
      db,
      new BrandCentreSessionEvictionService(db),
    );
    const service = new BrandConsumerService(
      auth,
      new M1CanonicalBrandStateAdapter(db),
      visuals,
      locations,
      projection,
      new ProcessorRuntimeProjectionService(db),
    );
    const hash = (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    let app: INestApplication;
    let baseUrl: string;
    const secret = randomBytes(32).toString("hex");
    const jwt = new JwtService({ secret });
    const config = new ConfigService({
      JWT_SECRET: secret,
      JWT_ISSUER: "creator-shop-brand-consumer-test",
      JWT_AUDIENCE: "creator-shop-brand-consumer-test-client",
    });
    const sessions = new AuthSessionService(db, jwt, config);

    async function brand() {
      const org = await prisma.organization.create({
        data: { name: "Consumer test" },
      });
      const b = await prisma.brandProfile.create({
        data: {
          organizationId: org.id,
          name: "Consumer test",
          industry: "D2C",
          domain: `${randomUUID()}.example`,
          visualIdentity: { colors: ["#123456"] },
          logoUrl: "https://legacy.example/unapproved.png",
          description: "Legacy must not leak",
        },
      });
      const user: AuthUser = {
        id: randomUUID(),
        organizationId: org.id,
        role: "BRAND",
        email: `${randomUUID()}@example.test`,
        name: "Test",
      };
      await prisma.user.create({
        data: {
          id: user.id,
          organizationId: org.id,
          role: "BRAND",
          authState: "ACTIVE",
          email: user.email,
          name: user.name,
          emailVerifiedAt: new Date(),
        },
      });
      await prisma.brandTeamMember.create({
        data: {
          brandProfileId: b.id,
          userId: user.id,
          role: "BRAND_OWNER",
        },
      });
      return { b, user };
    }

    async function generation(
      brandId: string,
      objectSemanticId: string,
      value: unknown,
      options: {
        protected?: boolean;
        partial?: boolean;
        stale?: boolean;
        supersedes?: { objectId: string; componentId: string };
      } = {},
    ) {
      const subject = await resolveIntelligenceSubject(prisma, brandId);
      const action = await prisma.intelligenceAction.create({
        data: {
          brandId,
          subjectId: subject.id,
          actionType: "CONSUMER_TEST_FIXTURE",
          actorType: "SYSTEM",
          actorRef: "test",
          requestIdempotencyKey: randomUUID(),
          correlationRef: randomUUID(),
          reasonCode: "TEST",
          requestedAtomicity: "GENERATION_ONLY",
          outcome: "PERSISTED",
        },
      });
      const valueState = value === null ? "EXPLICIT_NULL" : "VALUE";
      const payload =
        value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
      const readiness =
        value === null ? "NOT_READY" : options.partial ? "PARTIAL" : "READY";
      const scope = scopes.resolveObject(objectSemanticId);
      const obj = await prisma.intelligenceObjectGeneration.create({
        data: {
          brandId,
          subjectId: subject.id,
          objectSemanticId,
          objectContractId: objectSemanticId,
          objectContractVersion: "1.0",
          outputContractId: scope.outputContractId,
          outputContractVersion: "1.0",
          producerKind: "AUTHORIZED_APPLICATION_ACTION",
          producerId: "test",
          bundleId: "test",
          bundleVersion: "1.0",
          bundleHash: hash("fixture"),
          actionId: action.id,
          valueState,
          valuePayload: payload,
          valueHash: hash(value),
          objectMetadataPayload: {},
          readiness,
          freshnessAtGeneration: "CURRENT",
          activeScope: ["$"],
          activeScopeHash: hash(["$"]),
          basedOnObjectGenerationId: options.supersedes?.objectId,
          supersedesObjectGenerationId: options.supersedes?.objectId,
        },
      });
      const component = await prisma.intelligenceComponentGeneration.create({
        data: {
          brandId,
          subjectId: subject.id,
          objectGenerationId: obj.id,
          objectSemanticId,
          pathSchemeVersion: 1,
          componentSemanticPath: "$",
          nodeKind: Array.isArray(value)
            ? "COLLECTION"
            : typeof value === "object" && value !== null
              ? "OBJECT_FIELD"
              : "SCALAR",
          componentContractId: objectSemanticId,
          componentContractVersion: "1.0",
          valueState,
          valuePayload: payload,
          valueHash: hash(value),
          authority: options.protected
            ? "BRAND_CONFIRMED"
            : "CREATOR_SHOP_DERIVED",
          sourceClass: "OWNED_WEBSITE",
          readiness,
          freshnessAtGeneration: "CURRENT",
          metadataPayload: {},
          supersedesComponentGenerationId: options.supersedes?.componentId,
        },
      });
      return { action, object: obj, component };
    }

    async function current(
      brandId: string,
      object: string,
      value: unknown,
      options: { protected?: boolean; partial?: boolean; stale?: boolean } = {},
    ) {
      const generated = await generation(brandId, object, value, options);
      const { component } = generated;
      const row = await prisma.intelligenceCurrentComponent.create({
        data: {
          brandId,
          subjectId: generated.action.subjectId,
          objectSemanticId: object,
          pathSchemeVersion: 1,
          componentSemanticPath: "$",
          nodeKind: component.nodeKind,
          currentComponentGenerationId: component.id,
          currentContractId: component.componentContractId,
          currentContractVersion: "1.0",
          currentAuthority: component.authority,
          currentSourceClass: "OWNED_WEBSITE",
          currentReadiness: component.readiness,
          currentFreshness: options.stale ? "STALE" : "CURRENT",
          protectionState: options.protected
            ? "BRAND_CONFIRMED"
            : "UNPROTECTED",
        },
      });
      return { ...generated, row };
    }

    async function advanceCurrent(
      previous: Awaited<ReturnType<typeof current>>,
      brandId: string,
      objectSemanticId: string,
      value: unknown,
    ) {
      const generated = await generation(brandId, objectSemanticId, value, {
        supersedes: {
          objectId: previous.object.id,
          componentId: previous.component.id,
        },
      });
      const row = await prisma.intelligenceCurrentComponent.update({
        where: { id: previous.row.id },
        data: {
          currentComponentGenerationId: generated.component.id,
          currentReadiness: generated.component.readiness,
          currentFreshness: "CURRENT",
          freshnessEvaluatedAt: new Date(),
          staleSince: null,
          staleReasonCode: null,
          invalidatingRef: null,
          revision: { increment: 1 },
        },
      });
      return { ...generated, row };
    }

    async function processorExecution(
      brandId: string,
      processorId: string,
      status: IntelligenceProcessorExecutionStatus,
      options: {
        attemptCount?: number;
        lastErrorCategory?: string;
        lastErrorCode?: string;
        resultReadiness?: "READY" | "PARTIAL" | "NOT_READY";
      } = {},
    ) {
      const subject = await resolveIntelligenceSubject(prisma, brandId);
      const now = new Date();
      const running = status === "RUNNING";
      const terminal = ["COMPLETED", "FAILED_TERMINAL", "CANCELLED"].includes(
        status,
      );
      const executionStatus = running
        ? "RUNNING"
        : terminal
          ? status === "FAILED_TERMINAL"
            ? "FAILED"
            : status === "CANCELLED"
              ? "CANCELLED"
              : "COMPLETED"
          : "PENDING";
      return prisma.intelligenceExecution.create({
        data: {
          brandId,
          subjectId: subject.id,
          triggerType: "CONSUMER_RUNTIME_TEST",
          triggerRef: processorId,
          triggerIdempotencyKey: randomUUID(),
          correlationRef: randomUUID(),
          requestedImpact: [processorId],
          status: executionStatus,
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
              leaseOwnerRef: running ? "consumer-runtime-test" : null,
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

    async function completeProcessorExecution(
      execution: Awaited<ReturnType<typeof processorExecution>>,
      resultReadiness: "READY" | "PARTIAL" | "NOT_READY" = "READY",
    ) {
      const now = new Date();
      await prisma.intelligenceProcessorExecution.update({
        where: { id: execution.processorExecutions[0].id },
        data: {
          status: "COMPLETED",
          resultReadiness,
          eligibleAt: null,
          leaseToken: null,
          leaseOwnerRef: null,
          leaseExpiresAt: null,
          lastHeartbeatAt: null,
          lastErrorCategory: null,
          lastErrorCode: null,
          completedAt: now,
        },
      });
      await prisma.intelligenceExecution.update({
        where: { id: execution.id },
        data: {
          status: "COMPLETED",
          aggregateResult: "SUCCEEDED",
          completedAt: now,
        },
      });
    }

    beforeAll(async () => {
      runtime.verifyAtRoot(
        join(
          process.cwd(),
          "src/features/brand-intelligence/generated/contract-bundles",
        ),
      );
      // Use real JWT verification and the real ownership service; only rate limiting is irrelevant here.
      new JwtStrategy(config, sessions);
      Reflect.defineMetadata(
        "design:paramtypes",
        [BrandConsumerService],
        BrandConsumerController,
      );
      Reflect.defineMetadata("design:paramtypes", [Reflector], JwtAuthGuard);
      const module = await Test.createTestingModule({
        controllers: [BrandConsumerController],
        providers: [{ provide: BrandConsumerService, useValue: service }],
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

    it("all ten Objects remain readable; seven real processors own their registered writes", async () => {
      const { b } = await brand();
      for (const objectSemanticId of BRAND_CONSUMER_OBJECTS) {
        expect(
          (await projection.readObject({ brandId: b.id, objectSemanticId }))
            .objectState,
        ).toBe("NO_CURRENT");
        expect(scopes.ownsPath(b.id, objectSemanticId, "$")).toBe(true);
      }
      expect(
        scopes.ownsPath(b.id, "audience_personas", "$/i/persona-a/f/label"),
      ).toBe(true);
      expect(scopes.ownsPath(b.id, "audience_personas", "$/f/unknown")).toBe(
        false,
      );
      expect(
        ownership.owns({
          brandId: b.id,
          objectSemanticId: "visual_style_profile",
          pathSchemeVersion: 1,
          componentSemanticPath: "$",
        }),
      ).toBe(true);
      expect(
        ownership.owns({
          brandId: b.id,
          objectSemanticId: "serviceability_profile",
          pathSchemeVersion: 1,
          componentSemanticPath: "$",
        }),
      ).toBe(true);
      const executableIds = runtime
        .registrations()
        .filter((r) => r.executionEnabled)
        .map((r) => r.processorId)
        .sort();
      const productIds = executableIds.filter((processorId) =>
        processorId.startsWith("offering_"),
      );
      expect(productIds).toEqual([
        "offering_actionability_synthesis",
        "offering_creator_communication",
        "offering_factual_synthesis",
      ]);
      expect(
        executableIds.filter(
          (processorId) => !productIds.includes(processorId),
        ),
      ).toEqual([
        "audience_persona_synthesis",
        "brand_character",
        "brand_communication",
        "brand_differentiation",
        "brand_meaning",
        "serviceability_synthesis",
        "visual_style_synthesis",
      ]);
    });

    it("partial and explicit-null current remain truthful; no legacy values promoted", async () => {
      const { b, user } = await brand();
      await current(b.id, "brand_description", "Partial grounded description", {
        partial: true,
      });
      await current(b.id, "positioning", null);
      const result = await service.read(user);
      expect(result.brandIdentity.description.readiness).toBe("PARTIAL");
      expect(result.brandIdentity.positioning.current).toEqual({
        kind: "EXPLICIT_NULL",
      });
      expect(result.brandIdentity.positioning.resultReadiness).toBe(
        "NOT_READY",
      );
      expect(result.brandIdentity.valueProposition.current.kind).toBe(
        "NO_CURRENT",
      );
      expect(result.visualIdentity.canonical.primaryLogo.current.kind).toBe(
        "NO_CURRENT",
      );
      expect(result.visualIdentity.canonical.palette.current.kind).toBe(
        "NO_CURRENT",
      );
      expect(JSON.stringify(result)).not.toContain("Legacy must not leak");
      expect(JSON.stringify(result)).not.toContain("unapproved.png");
    });

    it("protected stale current survives candidate and failed refresh without raw candidate/lineage", async () => {
      const { b, user } = await brand();
      const base = await current(
        b.id,
        "brand_description",
        "Protected current",
        { protected: true, stale: true },
      );
      await current(b.id, "communication_profile", {
        primary_language: "English",
      });
      const candidate = await generation(
        b.id,
        "brand_description",
        "SECRET CANDIDATE",
      );
      await prisma.intelligenceComponentCandidate.create({
        data: {
          brandId: b.id,
          subjectId: candidate.action.subjectId,
          objectSemanticId: "brand_description",
          pathSchemeVersion: 1,
          componentSemanticPath: "$",
          candidateComponentGenerationId: candidate.component.id,
          currentComponentId: base.row.id,
          basisCurrentComponentGenerationId: base.component.id,
          basisCurrentRevision: base.row.revision,
          candidateValueHash: candidate.component.valueHash,
          producerActionId: candidate.action.id,
          discrepancyCode: "PROTECTED_VALUE_CONFLICT",
        },
      });
      await processorExecution(b.id, "brand_meaning", "FAILED_TERMINAL", {
        attemptCount: 3,
        lastErrorCategory: "VALIDATION_FAILURE",
        lastErrorCode: "STRUCTURED_OUTPUT_INVALID",
      });
      const result = await service.read(user);
      const field = result.brandIdentity.description;
      expect(field.current).toEqual({
        kind: "VALUE",
        value: "Protected current",
      });
      expect(field).toMatchObject({
        authority: "confirmed",
        freshness: "STALE",
        resultReadiness: "READY",
        candidate: { status: "CONFLICT", count: 1, rawCandidateVisible: false },
      });
      expect(result.runtimeActivity).toBe("NONE");
      expect(result.processorRuntime.brand_meaning).toMatchObject({
        activity: "TEMPORARILY_UNAVAILABLE",
        hasCurrent: true,
        failure: {
          code: "STRUCTURED_OUTPUT_INVALID",
          currentPreserved: true,
        },
      });
      expect(result.processorRuntime.brand_communication.activity).toBe("IDLE");
      const serialized = JSON.stringify(result);
      for (const secretValue of [
        "SECRET CANDIDATE",
        candidate.component.id,
        base.component.id,
        "evidenceReferenceSummary",
        "generationCreatedAt",
      ])
        expect(serialized).not.toContain(secretValue);
    });

    it("canonical visuals/Locations are independent from derived style/serviceability and active Personas only", async () => {
      const { b, user } = await brand();
      const logo = await visuals.confirmLogo(
        b.id,
        "https://approved.example/canonical.png",
        "BRAND_SELECTION",
      );
      const [location] = await locations.reconcile(
        b.id,
        [{ address: "10 Main", city: "Town", zip: "123" }],
        "test",
      );
      await current(b.id, "visual_style_profile", {
        summary: "Derived minimal style",
        style_traits: [],
      });
      await current(b.id, "serviceability_profile", {
        overall_scope: "COUNTRY",
        serviceable_markets: [],
        serviceability_basis: [{ evidence_refs: ["SECRET EVIDENCE"] }],
      });
      await current(b.id, "audience_personas", [
        { semantic_id: "active-persona", lifecycle: "ACTIVE", label: "Active" },
        {
          semantic_id: "inactive-secret",
          lifecycle: "INACTIVE",
          label: "History",
        },
      ]);
      const result = await service.read(user);
      expect(result.visualIdentity.canonical.primaryLogo.current).toMatchObject(
        { kind: "VALUE", value: { id: logo.id } },
      );
      expect(result.visualIdentity.style.current).toMatchObject({
        kind: "VALUE",
        value: { summary: "Derived minimal style" },
      });
      expect(result.locations[0].locationId).toBe(location.locationId);
      expect(result.audience.personas).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain("inactive-secret");
      expect(JSON.stringify(result)).not.toContain("SECRET EVIDENCE");
    });

    it("projects one coherent all-seven mixed runtime without global collapse", async () => {
      const { b, user } = await brand();
      await current(b.id, "communication_profile", {
        primary_language: "English",
      });
      await current(b.id, "brand_description", "Grounded description");
      await current(b.id, "positioning", "Grounded positioning");
      await current(b.id, "value_proposition", "Grounded value");
      await current(b.id, "brand_values", [{ semantic_id: "clarity" }], {
        partial: true,
      });
      await current(b.id, "brand_personality", [{ semantic_id: "direct" }], {
        partial: true,
      });
      await current(b.id, "differentiation_and_proof", {
        differentiators: [{ semantic_id: "bounded-proof" }],
      });
      await current(
        b.id,
        "visual_style_profile",
        { summary: "Observed restraint", style_traits: [] },
        { partial: true, stale: true },
      );

      await processorExecution(b.id, "brand_communication", "COMPLETED");
      await processorExecution(b.id, "brand_meaning", "COMPLETED");
      await processorExecution(b.id, "brand_character", "COMPLETED", {
        resultReadiness: "PARTIAL",
      });
      await processorExecution(
        b.id,
        "audience_persona_synthesis",
        "WAITING_FOR_DEPENDENCY",
        {
          lastErrorCategory: "DEPENDENCY_UNAVAILABLE",
          lastErrorCode: "WAITING_FOR_EVIDENCE",
        },
      );
      await processorExecution(b.id, "brand_differentiation", "RUNNING");
      await processorExecution(b.id, "visual_style_synthesis", "COMPLETED", {
        resultReadiness: "PARTIAL",
      });
      await processorExecution(
        b.id,
        "serviceability_synthesis",
        "FAILED_TERMINAL",
        {
          attemptCount: 3,
          lastErrorCategory: "RETRYABLE_TECHNICAL",
          lastErrorCode: "ATTEMPT_EXHAUSTED",
        },
      );

      const { accessToken: token } = await sessions.create(user.id);
      const response = await fetch(`${baseUrl}/api/v1/brand-centre/brand`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      const result = await response.json();

      expect(Object.keys(result.processorRuntime)).toEqual([
        "brand_communication",
        "brand_meaning",
        "brand_character",
        "audience_persona_synthesis",
        "brand_differentiation",
        "visual_style_synthesis",
        "serviceability_synthesis",
      ]);
      expect(
        Object.values(result.processorRuntime).filter(
          (state: { refreshing: boolean }) => state.refreshing,
        ),
      ).toHaveLength(1);
      expect(result.processorRuntime.brand_differentiation).toMatchObject({
        activity: "REFRESHING",
        hasCurrent: true,
        refreshing: true,
      });
      expect(result.processorRuntime.audience_persona_synthesis).toMatchObject({
        activity: "WAITING_FOR_EVIDENCE",
        hasCurrent: false,
      });
      expect(result.processorRuntime.serviceability_synthesis).toMatchObject({
        activity: "TEMPORARILY_UNAVAILABLE",
        hasCurrent: false,
        failure: { currentPreserved: false, retryEligible: false },
      });
      expect(result.runtimeActivity).toBe("REFRESHING");
      expect(result.workspaceReadiness).toBe("READY");
      expect(result.brandIdentity.communication.current.kind).toBe("VALUE");
      expect(result.brandIdentity.description.current.kind).toBe("VALUE");
      expect(result.brandIdentity.values.readiness).toBe("PARTIAL");
      expect(result.audience.state.current.kind).toBe("NO_CURRENT");
      expect(result.visualIdentity.style.readiness).toBe("PARTIAL");
      expect(result.visualIdentity.style.freshness).toBe("STALE");
      expect(result.processorRuntime.visual_style_synthesis.activity).toBe(
        "IDLE",
      );
      expect(result.serviceability.state.current.kind).toBe("NO_CURRENT");
    });

    it("coexists first-run LEARNING with an unrelated REFRESHING current", async () => {
      const { b, user } = await brand();
      await current(b.id, "differentiation_and_proof", {
        differentiators: [{ semantic_id: "existing" }],
      });
      await processorExecution(b.id, "audience_persona_synthesis", "RUNNING");
      await processorExecution(b.id, "brand_differentiation", "RUNNING");

      const result = await service.read(user);
      expect(result.processorRuntime.audience_persona_synthesis).toMatchObject({
        activity: "LEARNING",
        hasCurrent: false,
      });
      expect(result.processorRuntime.brand_differentiation).toMatchObject({
        activity: "REFRESHING",
        hasCurrent: true,
      });
      expect(result.runtimeActivity).toBe("LEARNING");
    });

    it("refreshes Differentiation then Visual Style without changing unrelated generations", async () => {
      const { b, user } = await brand();
      const initial = new Map<string, Awaited<ReturnType<typeof current>>>();
      for (const [objectSemanticId, value] of [
        ["communication_profile", { primary_language: "English" }],
        ["brand_description", "Description"],
        ["positioning", "Positioning"],
        ["value_proposition", "Value"],
        ["brand_values", [{ semantic_id: "clarity" }]],
        ["brand_personality", [{ semantic_id: "direct" }]],
        ["audience_personas", [{ semantic_id: "buyer", lifecycle: "ACTIVE" }]],
        ["differentiation_and_proof", { differentiators: [] }],
        ["visual_style_profile", { summary: "Initial style" }],
        ["serviceability_profile", { overall_scope: "COUNTRY" }],
      ] as const) {
        initial.set(
          objectSemanticId,
          await current(b.id, objectSemanticId, value),
        );
      }
      const generationIds = async () =>
        new Map(
          (
            await prisma.intelligenceCurrentComponent.findMany({
              where: { brandId: b.id, componentSemanticPath: "$" },
              select: {
                objectSemanticId: true,
                currentComponentGenerationId: true,
              },
            })
          ).map((row) => [
            row.objectSemanticId,
            row.currentComponentGenerationId,
          ]),
        );

      const beforeDifferentiation = await generationIds();
      const differentiationExecution = await processorExecution(
        b.id,
        "brand_differentiation",
        "RUNNING",
      );
      let result = await service.read(user);
      expect(result.processorRuntime.brand_differentiation).toMatchObject({
        activity: "REFRESHING",
        refreshing: true,
      });
      expect(result.brandIdentity.differentiation.freshness).toBe("CURRENT");
      expect(
        Object.entries(result.processorRuntime)
          .filter(([processorId]) => processorId !== "brand_differentiation")
          .every(([, state]) => !state.refreshing),
      ).toBe(true);

      const previousDifferentiation = initial.get("differentiation_and_proof")!;
      const nextDifferentiation = await advanceCurrent(
        previousDifferentiation,
        b.id,
        "differentiation_and_proof",
        { differentiators: [{ semantic_id: "refreshed" }] },
      );
      await completeProcessorExecution(differentiationExecution);
      const afterDifferentiation = await generationIds();
      for (const [objectSemanticId, generationId] of beforeDifferentiation) {
        expect(afterDifferentiation.get(objectSemanticId)).toBe(
          objectSemanticId === "differentiation_and_proof"
            ? nextDifferentiation.component.id
            : generationId,
        );
      }
      expect(nextDifferentiation.object).toMatchObject({
        basedOnObjectGenerationId: previousDifferentiation.object.id,
        supersedesObjectGenerationId: previousDifferentiation.object.id,
      });

      const previousVisual = initial.get("visual_style_profile")!;
      await prisma.intelligenceCurrentComponent.update({
        where: { id: previousVisual.row.id },
        data: { currentFreshness: "STALE", staleReasonCode: "CANONICAL_EDIT" },
      });
      const beforeVisual = await generationIds();
      const visualExecution = await processorExecution(
        b.id,
        "visual_style_synthesis",
        "RUNNING",
      );
      result = await service.read(user);
      expect(result.processorRuntime.visual_style_synthesis.activity).toBe(
        "REFRESHING",
      );
      expect(result.visualIdentity.style.freshness).toBe("STALE");
      expect(result.processorRuntime.brand_differentiation.activity).toBe(
        "IDLE",
      );

      const nextVisual = await advanceCurrent(
        previousVisual,
        b.id,
        "visual_style_profile",
        { summary: "Refreshed style" },
      );
      await completeProcessorExecution(visualExecution, "PARTIAL");
      const afterVisual = await generationIds();
      for (const [objectSemanticId, generationId] of beforeVisual) {
        expect(afterVisual.get(objectSemanticId)).toBe(
          objectSemanticId === "visual_style_profile"
            ? nextVisual.component.id
            : generationId,
        );
      }
      expect(nextVisual.object).toMatchObject({
        basedOnObjectGenerationId: previousVisual.object.id,
        supersedesObjectGenerationId: previousVisual.object.id,
      });
      result = await service.read(user);
      expect(result.processorRuntime.visual_style_synthesis.activity).toBe(
        "IDLE",
      );
      expect(result.visualIdentity.style.current).toMatchObject({
        kind: "VALUE",
        value: { summary: "Refreshed style" },
      });
    });

    it("HTTP requires JWT and Brand organization; query-supplied foreign Brand cannot redirect any read", async () => {
      const a = await brand();
      const b = await brand();
      const foreign = await visuals.confirmLogo(
        b.b.id,
        "https://foreign.example/secret.png",
        "BRAND_UPLOAD",
      );
      const [foreignLocation] = await locations.reconcile(
        b.b.id,
        [{ address: "Secret road", city: "Town", zip: "999" }],
        "test",
      );
      await current(b.b.id, "brand_description", "FOREIGN CURRENT");
      expect((await fetch(`${baseUrl}/api/v1/brand-centre/brand`)).status).toBe(
        401,
      );
      const { accessToken: token } = await sessions.create(a.user.id);
      const response = await fetch(
        `${baseUrl}/api/v1/brand-centre/brand?brandId=${b.b.id}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.brandId).toBe(a.b.id);
      for (const forbidden of [
        b.b.id,
        foreign.id,
        foreignLocation.locationId!,
        "FOREIGN CURRENT",
        "secret.png",
      ])
        expect(JSON.stringify(result)).not.toContain(forbidden);
      const creatorId = randomUUID();
      await prisma.user.create({
        data: {
          id: creatorId,
          role: "CREATOR",
          authState: "ACTIVE",
          email: `${randomUUID()}@example.test`,
          name: "Creator",
          emailVerifiedAt: new Date(),
        },
      });
      const { accessToken: creatorToken } = await sessions.create(creatorId);
      const denied = await fetch(`${baseUrl}/api/v1/brand-centre/brand`, {
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(denied.status).toBe(403);
      const organizationlessUserId = randomUUID();
      await prisma.user.create({
        data: {
          id: organizationlessUserId,
          role: "BRAND",
          authState: "ACTIVE",
          email: `${randomUUID()}@example.test`,
          name: "Organizationless Brand",
          emailVerifiedAt: new Date(),
        },
      });
      const { accessToken: organizationlessToken } = await sessions.create(
        organizationlessUserId,
      );
      const noOrganization = await fetch(
        `${baseUrl}/api/v1/brand-centre/brand`,
        {
          headers: {
            authorization: `Bearer ${organizationlessToken}`,
          },
        },
      );
      expect(noOrganization.status).toBe(403);
    });
  },
);
