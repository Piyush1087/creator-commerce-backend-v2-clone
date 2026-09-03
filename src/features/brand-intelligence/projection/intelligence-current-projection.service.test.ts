import { describe, expect, it, vi } from "vitest";

import { ComponentPathCodec } from "../semantic-path/component-path.codec";
import type { IntelligenceCurrentContractScopeService } from "./intelligence-current-contract-scope.service";
import { IntelligenceCurrentProjectionError } from "./intelligence-current-projection.error";
import type {
  IntelligenceCurrentProjectionRepository,
  ProjectionComponentRecord,
  ProjectionRepositorySnapshot,
} from "./intelligence-current-projection.repository";
import { IntelligenceCurrentProjectionService } from "./intelligence-current-projection.service";
import { IntelligenceObjectAssembler } from "./intelligence-object-assembler";

const brandId = "00000000-0000-4000-8000-0000000000f1";
const objectSemanticId = "communication_profile";

function component(
  path: string,
  options: Partial<{
    value: unknown;
    valueState: string;
    objectGenerationId: string;
    componentGenerationId: string;
    contractVersion: string;
    authority: string;
    sourceClass: string;
    readiness: string;
    generationReadiness: string;
    freshness: string;
    protectionState: string;
    pendingCandidateCount: number;
    generationCreatedAt: string;
  }> = {},
): ProjectionComponentRecord {
  const objectGenerationId =
    options.objectGenerationId ?? "object-generation:1";
  const componentGenerationId =
    options.componentGenerationId ?? `component-generation:${path}`;
  const authority = options.authority ?? "CREATOR_SHOP_DERIVED";
  const sourceClass = options.sourceClass ?? "MULTI_SOURCE";
  const readiness = options.readiness ?? "READY";
  const contractVersion = options.contractVersion ?? "1.0";
  const valueState = options.valueState ?? "VALUE";
  const protectionState =
    options.protectionState ??
    (authority === "BRAND_CONFIRMED" || authority === "SUPPORT_CONTROLLED"
      ? authority
      : "UNPROTECTED");
  return {
    id: `current:${path}`,
    brandId,
    objectSemanticId,
    pathSchemeVersion: 1,
    componentSemanticPath: path,
    nodeKind: path === "$" ? "SCALAR" : "OBJECT_FIELD",
    currentComponentGenerationId: componentGenerationId,
    currentContractId: "communication_profile.component",
    currentContractVersion: contractVersion,
    currentAuthority: authority,
    currentSourceClass: sourceClass,
    currentReadiness: readiness,
    currentFreshness: options.freshness ?? "CURRENT",
    protectionState,
    revision: 3n,
    staleReasonCode: options.freshness === "STALE" ? "SOURCE_CHANGED" : null,
    generation: {
      id: componentGenerationId,
      brandId,
      objectGenerationId,
      objectSemanticId,
      componentSemanticPath: path,
      pathSchemeVersion: 1,
      nodeKind: path === "$" ? "SCALAR" : "OBJECT_FIELD",
      componentContractId: "communication_profile.component",
      componentContractVersion: contractVersion,
      valueState,
      valuePayload:
        valueState === "VALUE" ? (options.value ?? `value:${path}`) : null,
      authority,
      sourceClass,
      readiness: options.generationReadiness ?? readiness,
      freshnessAtGeneration: "CURRENT",
      presentationOrder: null,
      createdAt: new Date(
        options.generationCreatedAt ?? "2026-08-25T12:00:00.000Z",
      ),
      objectGeneration: {
        id: objectGenerationId,
        brandId,
        objectSemanticId,
        objectContractId: "brand_communication",
        objectContractVersion: contractVersion,
        outputContractId: "brand_communication.output",
        outputContractVersion: contractVersion,
        bundleId: "brand_communication",
        bundleVersion: "1.0",
        bundleHash: "a".repeat(64),
      },
    },
    pendingCandidates: Array.from(
      { length: options.pendingCandidateCount ?? 0 },
      (_, index) => ({
        id: `candidate:${path}:${index}`,
        brandId,
        objectSemanticId,
        componentSemanticPath: path,
        pathSchemeVersion: 1,
        basisCurrentComponentGenerationId: componentGenerationId,
        basisCurrentRevision: 3n,
        discrepancyCode: "PROTECTED_VALUE_CONFLICT",
      }),
    ),
  };
}

function snapshot(
  components: readonly ProjectionComponentRecord[],
  overrides: Partial<ProjectionRepositorySnapshot> = {},
): ProjectionRepositorySnapshot {
  return {
    brandId,
    objectSemanticId,
    components,
    evidenceReferences: [],
    businessStateReferences: [],
    ...overrides,
  };
}

function harness(initial: ProjectionRepositorySnapshot) {
  const repository = {
    readObjectSnapshot: vi.fn().mockResolvedValue(initial),
    readComponentSnapshot: vi.fn().mockResolvedValue(initial),
  };
  const contracts = {
    resolveObject: vi.fn().mockReturnValue({
      objectSemanticId,
      outputContractId: "brand_communication.output",
      outputContractVersion: "1.0",
      ownedPathPatterns: ["$", "$/f/free_text", "$/f/primary_language"],
      requiredMaterializedPaths: ["$"],
    }),
    ownsPath: vi.fn((_brandId: string, _objectId: string, path: string) =>
      ["$", "$/f/free_text", "$/f/primary_language"].includes(path),
    ),
  };
  const service = new IntelligenceCurrentProjectionService(
    repository as unknown as IntelligenceCurrentProjectionRepository,
    contracts as unknown as IntelligenceCurrentContractScopeService,
    new IntelligenceObjectAssembler(new ComponentPathCodec()),
  );
  return { service, repository, contracts };
}

describe("W1.0F current Intelligence projection", () => {
  it("returns bounded NO_CURRENT and component absence states", async () => {
    const { service, repository } = harness(snapshot([]));
    await expect(
      service.readObject({ brandId, objectSemanticId }),
    ).resolves.toMatchObject({
      objectState: "NO_CURRENT",
      assembledValue: { state: "NO_CURRENT" },
      consumerReadiness: "NOT_READY",
      resultReadiness: "NOT_READY",
      freshness: "UNKNOWN",
      changedAt: null,
    });
    await expect(
      service.readComponent({
        brandId,
        objectSemanticId,
        componentSemanticPath: "$",
      }),
    ).resolves.toMatchObject({
      projectionState: "NO_CURRENT",
      valueState: "NO_CURRENT",
    });
    await expect(
      service.readComponent({
        brandId,
        objectSemanticId,
        componentSemanticPath: "$/f/not_owned",
      }),
    ).resolves.toMatchObject({
      projectionState: "NOT_OWNED",
      valueState: "NOT_OWNED",
    });
    expect(repository.readComponentSnapshot).toHaveBeenCalledTimes(1);
  });

  it("projects complete state, immutable lineage references, and protected candidates", async () => {
    const root = component("$", {
      value: { free_text: "Grounded" },
      authority: "BRAND_CONFIRMED",
      protectionState: "BRAND_CONFIRMED",
      pendingCandidateCount: 2,
    });
    const field = component("$/f/free_text", {
      value: "Grounded",
      objectGenerationId: "object-generation:2",
      sourceClass: "USER_INPUT",
      readiness: "PARTIAL",
      generationReadiness: "READY",
      freshness: "UNKNOWN",
      contractVersion: "1.1",
      generationCreatedAt: "2026-08-25T13:00:00.000Z",
    });
    const { service } = harness(
      snapshot([root, field], {
        evidenceReferences: [
          {
            brandId,
            objectGenerationId: root.generation.objectGenerationId,
            componentSemanticPath: "$",
            evidenceRef: "evidence:1",
            capabilityId: "web.extract",
            captureId: "capture:1",
            captureVersion: "7",
            sourceClass: "PUBLIC_WEB",
            capturedAt: new Date("2026-08-25T11:00:00.000Z"),
            observedFreshness: "POSSIBLY_STALE",
          },
        ],
        businessStateReferences: [
          {
            brandId,
            objectGenerationId: root.generation.objectGenerationId,
            componentSemanticPath: "$",
            entityType: "Brand",
            entityId: brandId,
            semanticFieldPath: "$.name",
            revisionKind: "UPDATED_AT",
            revisionToken: "2026-08-25T10:00:00.000Z",
            canonicalSnapshotRef: "brand-snapshot:1",
          },
        ],
      }),
    );
    const result = await service.readObject({ brandId, objectSemanticId });
    expect(result).toMatchObject({
      objectState: "CURRENT",
      consumerReadiness: "PARTIAL",
      resultReadiness: "PARTIAL",
      freshness: "UNKNOWN",
      authority: "MIXED",
      sourceClass: "MIXED",
      mixedGeneration: true,
      mixedContractVersion: true,
      changedAt: "2026-08-25T13:00:00.000Z",
      candidateSummary: {
        status: "CONFLICT",
        pendingCount: 2,
        currentPreserved: true,
        rawCandidateVisible: false,
      },
    });
    expect(result.components[0]).toMatchObject({
      authority: "BRAND_CONFIRMED",
      protectionState: "BRAND_CONFIRMED",
      evidenceReferenceSummary: [
        { evidenceRef: "evidence:1", observedFreshness: "POSSIBLY_STALE" },
      ],
      businessStateReferenceSummary: [
        { entityType: "Brand", canonicalSnapshotRef: "brand-snapshot:1" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("candidate:$");
  });

  it.each([
    [["CURRENT", "CURRENT"], "CURRENT"],
    [["CURRENT", "UNKNOWN"], "UNKNOWN"],
    [["UNKNOWN", "STALE"], "STALE"],
  ] as const)("aggregates freshness %j as %s", async (freshness, expected) => {
    const { service } = harness(
      snapshot([
        component("$", { freshness: freshness[0], value: {} }),
        component("$/f/free_text", { freshness: freshness[1] }),
      ]),
    );
    await expect(
      service.readObject({ brandId, objectSemanticId }),
    ).resolves.toMatchObject({
      freshness: expected,
    });
  });

  it.each([
    [["READY", "READY"], "READY"],
    [["READY", "PARTIAL"], "PARTIAL"],
    [["READY", "NOT_READY"], "PARTIAL"],
    [["NOT_READY", "NOT_READY"], "NOT_READY"],
  ] as const)(
    "aggregates result readiness %j as %s",
    async (readiness, expected) => {
      const { service } = harness(
        snapshot([
          component("$", { readiness: readiness[0], value: {} }),
          component("$/f/free_text", { readiness: readiness[1] }),
        ]),
      );
      await expect(
        service.readObject({ brandId, objectSemanticId }),
      ).resolves.toMatchObject({ resultReadiness: expected });
    },
  );

  it("preserves SUPPORT_CONTROLLED as component metadata without inferring editability", async () => {
    const protectedComponent = component("$", {
      value: {},
      authority: "SUPPORT_CONTROLLED",
      protectionState: "SUPPORT_CONTROLLED",
    });
    const { service } = harness(snapshot([protectedComponent]));
    await expect(
      service.readComponent({
        brandId,
        objectSemanticId,
        componentSemanticPath: "$",
      }),
    ).resolves.toMatchObject({
      projectionState: "CURRENT",
      authority: "SUPPORT_CONTROLLED",
      protectionState: "SUPPORT_CONTROLLED",
    });
  });

  it("preserves VALUE, EXPLICIT_NULL, and INTENTIONALLY_ABSENT without fillers", async () => {
    const { service } = harness(
      snapshot([
        component("$", { value: {} }),
        component("$/f/free_text", { valueState: "EXPLICIT_NULL" }),
        component("$/f/primary_language", {
          valueState: "INTENTIONALLY_ABSENT",
        }),
      ]),
    );
    await expect(
      service.readObject({ brandId, objectSemanticId }),
    ).resolves.toMatchObject({
      assembledValue: { state: "VALUE", value: { free_text: null } },
    });
  });

  it("reports PARTIAL_CURRENT when owned child state exists without a current root", async () => {
    const { service } = harness(snapshot([component("$/f/free_text")]));
    await expect(
      service.readObject({ brandId, objectSemanticId }),
    ).resolves.toMatchObject({
      objectState: "PARTIAL_CURRENT",
      consumerReadiness: "PARTIAL",
      assembledValue: {
        state: "VALUE",
        value: { free_text: "value:$/f/free_text" },
      },
    });
  });

  it("fails closed on cross-Brand state and stale-basis pending candidates", async () => {
    const crossBrand = { ...component("$"), brandId: "other-brand" };
    const first = harness(snapshot([crossBrand]));
    await expect(
      first.service.readObject({ brandId, objectSemanticId }),
    ).rejects.toEqual(
      expect.objectContaining<IntelligenceCurrentProjectionError>({
        code: "TENANCY_VIOLATION",
      }),
    );

    const staleBasis = component("$", { pendingCandidateCount: 1 });
    const mutated = {
      ...staleBasis,
      pendingCandidates: staleBasis.pendingCandidates.map((candidate) => ({
        ...candidate,
        basisCurrentComponentGenerationId: "old-generation",
      })),
    };
    const second = harness(snapshot([mutated]));
    await expect(
      second.service.readObject({ brandId, objectSemanticId }),
    ).rejects.toEqual(
      expect.objectContaining<IntelligenceCurrentProjectionError>({
        code: "PROJECTION_INVARIANT",
      }),
    );
  });

  it("fails closed when persisted current paths drift outside verified ownership", async () => {
    const { service } = harness(snapshot([component("$/f/unowned")]));
    await expect(
      service.readObject({ brandId, objectSemanticId }),
    ).rejects.toEqual(
      expect.objectContaining<IntelligenceCurrentProjectionError>({
        code: "CONTRACT_CONFIGURATION_DRIFT",
      }),
    );
  });
});
