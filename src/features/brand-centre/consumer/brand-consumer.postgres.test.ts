import "reflect-metadata";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
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
import { BrandCentreAuthService } from "../brand-centre-auth.service";
import { BrandCentreSessionEvictionService } from "../services/brand-centre-session-eviction.service";
import { BrandConsumerService } from "./brand-consumer.service";
import { BrandConsumerController } from "./brand-consumer.controller";
import { BRAND_CONSUMER_OBJECTS } from "./brand-consumer.mapper";

describe.skipIf(process.env.BRAND_CENTRE_DATABASE_TEST !== "true")(
  "Brand consumer PostgreSQL and authenticated HTTP",
  () => {
    const prisma = new PrismaClient();
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
      db,
      new M1CanonicalBrandStateAdapter(db),
      visuals,
      locations,
      projection,
    );
    const hash = (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    let app: INestApplication;
    let baseUrl: string;
    const secret = randomBytes(32).toString("hex");
    const jwt = new JwtService({ secret });

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
        email: "test@example.test",
        name: "Test",
      };
      return { b, user };
    }

    async function generation(
      brandId: string,
      objectSemanticId: string,
      value: unknown,
      options: { protected?: boolean; partial?: boolean; stale?: boolean } = {},
    ) {
      const action = await prisma.intelligenceAction.create({
        data: {
          brandId,
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
        },
      });
      const component = await prisma.intelligenceComponentGeneration.create({
        data: {
          brandId,
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
        },
      });
      return { action, component };
    }

    async function current(
      brandId: string,
      object: string,
      value: unknown,
      options: { protected?: boolean; partial?: boolean; stale?: boolean } = {},
    ) {
      const { component } = await generation(brandId, object, value, options);
      const row = await prisma.intelligenceCurrentComponent.create({
        data: {
          brandId,
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
      return { component, row };
    }

    beforeAll(async () => {
      runtime.verifyAtRoot(
        join(
          process.cwd(),
          "src/features/brand-intelligence/generated/contract-bundles",
        ),
      );
      // Use real JWT verification and the real ownership service; only rate limiting is irrelevant here.
      new JwtStrategy(new ConfigService({ JWT_SECRET: secret }));
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

    it("all ten Objects remain readable; six real processors own their registered writes", async () => {
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
      ).toBe(false);
      expect(
        runtime
          .registrations()
          .filter((r) => r.executionEnabled)
          .map((r) => r.processorId)
          .sort(),
      ).toEqual([
        "audience_persona_synthesis",
        "brand_character",
        "brand_communication",
        "brand_differentiation",
        "brand_meaning",
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
      const candidate = await generation(
        b.id,
        "brand_description",
        "SECRET CANDIDATE",
      );
      await prisma.intelligenceComponentCandidate.create({
        data: {
          brandId: b.id,
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
      await prisma.intelligenceExecution.create({
        data: {
          brandId: b.id,
          triggerType: "test",
          triggerRef: "secret-internal",
          triggerIdempotencyKey: randomUUID(),
          correlationRef: randomUUID(),
          requestedImpact: [],
          status: "FAILED",
        },
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
      expect(result.runtimeActivity).toBe("TEMPORARILY_UNAVAILABLE");
      const serialized = JSON.stringify(result);
      for (const secretValue of [
        "SECRET CANDIDATE",
        "secret-internal",
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
      const token = (user: AuthUser) => jwt.sign({ sub: user.id, ...user });
      const response = await fetch(
        `${baseUrl}/api/v1/brand-centre/brand?brandId=${b.b.id}`,
        { headers: { authorization: `Bearer ${token(a.user)}` } },
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
      const denied = await fetch(`${baseUrl}/api/v1/brand-centre/brand`, {
        headers: {
          authorization: `Bearer ${token({ ...a.user, role: "CREATOR" })}`,
        },
      });
      expect(denied.status).toBe(403);
      const noOrganization = await fetch(
        `${baseUrl}/api/v1/brand-centre/brand`,
        {
          headers: {
            authorization: `Bearer ${token({ ...a.user, organizationId: null })}`,
          },
        },
      );
      expect(noOrganization.status).toBe(403);
    });
  },
);
