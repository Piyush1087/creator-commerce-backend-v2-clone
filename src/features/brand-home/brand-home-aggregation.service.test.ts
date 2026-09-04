import { describe, expect, it } from "vitest";

import type { AuthUser } from "../auth/types/auth-user";
import type {
  IntelligenceConsumerFreshness,
  IntelligenceConsumerObjectMeta,
  IntelligenceConsumerReadiness,
  IntelligenceConsumerResult,
} from "../intelligence-consumer/intelligence-consumer.contract";
import { BrandHomeAggregationService } from "./brand-home-aggregation.service";
import { BrandHomeClassifierService } from "./brand-home-classifier.service";
import type { BrandHomeSourceDomain } from "./brand-home.contract";
import { BrandHomeDuplicateSuppressor } from "./brand-home-duplicate-suppressor.service";
import { BrandHomePrioritizer } from "./brand-home-prioritizer.service";
import type { BrandHomeResponse } from "./brand-home.schema";

const FIXED_NOW = "2026-09-03T06:00:00.000Z";
const actor = {
  id: "user-1",
  email: "brand@example.test",
  name: "Brand User",
  role: "BRAND",
  organizationId: null,
} as AuthUser;

type IntelligenceOptions = Readonly<{
  objectState?: IntelligenceConsumerObjectMeta["objectState"];
  current?: IntelligenceConsumerObjectMeta["current"];
  readiness?: IntelligenceConsumerReadiness;
  resultReadiness?: IntelligenceConsumerReadiness;
  freshness?: IntelligenceConsumerFreshness;
}>;

function intelligenceResult(
  engineId: "brand_intelligence" | "product_intelligence",
  subjectId: string,
  options: IntelligenceOptions = {},
): IntelligenceConsumerResult {
  const objectId =
    engineId === "brand_intelligence"
      ? "differentiation_and_proof"
      : "offering_actionability_profile";
  return {
    contractVersion: "1.0",
    engineId,
    subject:
      engineId === "brand_intelligence"
        ? { type: "BRAND", id: subjectId }
        : { type: "OFFERING", id: subjectId },
    objects: [
      {
        objectId,
        objectState: options.objectState ?? "CURRENT",
        current: options.current ?? {
          kind: "VALUE",
          resultRef: `result:${subjectId}`,
        },
        readiness: options.readiness ?? "READY",
        resultReadiness: options.resultReadiness ?? "READY",
        freshness: options.freshness ?? "CURRENT",
        changedAt: "2026-09-03T04:00:00.000Z",
        authority: "creator_shop",
      },
    ],
    capabilityAvailability: { status: "AVAILABLE" },
    domainPayloadVersion: "1.0",
    domainPayload: {},
  };
}

function noCurrentBrand(): IntelligenceConsumerResult {
  return intelligenceResult("brand_intelligence", "brand-1", {
    objectState: "NO_CURRENT",
    current: { kind: "NO_CURRENT" },
    readiness: "NOT_READY",
    resultReadiness: "NOT_READY",
    freshness: "UNKNOWN",
  });
}

type ServiceOptions = Readonly<{
  brandIntelligence?: IntelligenceConsumerResult;
  offerings?: readonly Readonly<{
    offeringId: string;
    name: string;
    lifecycle: string;
  }>[];
  productIntelligence?: Readonly<
    Record<string, IntelligenceConsumerResult | Error>
  >;
  providers?: readonly Readonly<{
    provider: string;
    state: string;
    reasonCode: string;
    affectedProductCapabilities: readonly string[];
    humanActionRequired: boolean;
    freshness: "CURRENT" | "UNKNOWN";
  }>[];
}>;

function service(options: ServiceOptions = {}) {
  const offerings = options.offerings ?? [];
  const brandIntelligence = options.brandIntelligence ?? noCurrentBrand();
  const providerRows =
    options.providers ??
    ([
      {
        provider: "INSTAGRAM",
        state: "READY",
        reasonCode: "INSTAGRAM_READY",
        affectedProductCapabilities: [],
        humanActionRequired: false,
        freshness: "CURRENT",
      },
    ] as const);
  const intelligence = {
    async read(
      _user: AuthUser,
      engineId: "brand_intelligence" | "product_intelligence",
      subject: { type: "BRAND" | "OFFERING"; id: string },
    ) {
      if (engineId === "brand_intelligence") return brandIntelligence;
      const result = options.productIntelligence?.[subject.id];
      if (result instanceof Error) throw result;
      return (
        result ??
        intelligenceResult(engineId, subject.id, {
          objectState: "NO_CURRENT",
          current: { kind: "NO_CURRENT" },
          readiness: "NOT_READY",
          resultReadiness: "NOT_READY",
          freshness: "UNKNOWN",
        })
      );
    },
  };
  const prioritizer = new BrandHomePrioritizer();
  return new BrandHomeAggregationService(
    {
      resolveBrandContext: async () => ({ brandProfileId: "brand-1" }),
    } as never,
    {
      read: async () => ({
        fields: [{ semantic: "brand_name", value: "Example Brand" }],
      }),
    } as never,
    {
      listBoundedForWorkspace: async () => ({
        offerings,
        truncated: false,
      }),
    } as never,
    intelligence as never,
    {
      listForHome: async () => ({ collaborations: [], truncated: false }),
    } as never,
    {
      read: async () => ({
        observedAt: FIXED_NOW,
        workspace: { state: "READY" },
        setupItems: [],
      }),
    } as never,
    {
      read: async () => ({
        contractVersion: "1.0",
        brandId: "brand-1",
        observedAt: "2026-09-03T05:59:59.000Z",
        providers: providerRows,
        limitations: [],
      }),
    } as never,
    {
      listForHome: async () => ({ campaigns: [], truncated: false }),
    } as never,
    new BrandHomeClassifierService(),
    prioritizer,
    new BrandHomeDuplicateSuppressor(prioritizer),
    { now: () => new Date(FIXED_NOW) },
  );
}

function source(response: BrandHomeResponse, domain: BrandHomeSourceDomain) {
  return response.sourceStates.find(
    (candidate) => candidate.sourceDomain === domain,
  );
}

function section(
  response: BrandHomeResponse,
  id: BrandHomeResponse["sections"][number]["id"],
) {
  return response.sections.find((candidate) => candidate.id === id);
}

describe("Brand Home source-state aggregation", () => {
  it("treats Brand Intelligence NO_CURRENT as valid absence at the fixed request clock", async () => {
    const response = await service().read(actor);

    expect(source(response, "BRAND_INTELLIGENCE")).toMatchObject({
      state: "READY",
      freshness: "UNKNOWN",
    });
    expect(section(response, "CREATOR_SHOP_HAS_LEARNED")).toMatchObject({
      state: "EMPTY",
      items: [],
    });
    expect(response.status).toBe("READY");
    expect(response.sourceStates).toHaveLength(8);
    expect(
      response.sourceStates.every((state) => state.observedAt === FIXED_NOW),
    ).toBe(true);
  });

  it("preserves stale last-good Brand Intelligence without making Home partial", async () => {
    const response = await service({
      brandIntelligence: intelligenceResult("brand_intelligence", "brand-1", {
        freshness: "STALE",
      }),
    }).read(actor);

    expect(source(response, "BRAND_INTELLIGENCE")).toMatchObject({
      state: "READY",
      freshness: "STALE",
    });
    expect(response.status).toBe("READY");
    expect(
      section(response, "CREATOR_SHOP_HAS_LEARNED")?.items[0],
    ).toMatchObject({
      freshness: { state: "STALE" },
      limitations: [
        "This Intelligence is stale and reflects the last good state.",
      ],
    });
  });

  it("marks material partial Brand Intelligence while preserving supported data", async () => {
    const response = await service({
      brandIntelligence: intelligenceResult("brand_intelligence", "brand-1", {
        objectState: "PARTIAL_CURRENT",
        readiness: "PARTIAL",
        resultReadiness: "PARTIAL",
      }),
    }).read(actor);

    expect(source(response, "BRAND_INTELLIGENCE")).toMatchObject({
      state: "PARTIAL",
      freshness: "CURRENT",
      limitations: ["Brand Intelligence is materially partial for Home."],
    });
    expect(section(response, "CREATOR_SHOP_HAS_LEARNED")).toMatchObject({
      state: "PARTIAL",
      items: [expect.objectContaining({ kind: "BRAND_INTELLIGENCE_LEARNED" })],
    });
    expect(response.status).toBe("PARTIAL");
  });

  it("keeps valid Product Intelligence opportunities when another bounded read fails", async () => {
    const response = await service({
      offerings: [
        { offeringId: "offering-1", name: "Serum", lifecycle: "ACTIVE" },
        { offeringId: "offering-2", name: "Cream", lifecycle: "ACTIVE" },
      ],
      productIntelligence: {
        "offering-1": intelligenceResult("product_intelligence", "offering-1"),
        "offering-2": new Error("bounded read unavailable"),
      },
    }).read(actor);

    expect(source(response, "PRODUCT_INTELLIGENCE")).toMatchObject({
      state: "PARTIAL",
      freshness: "CURRENT",
      limitations: [
        "1 bounded Product Intelligence source read was unavailable.",
      ],
    });
    expect(section(response, "OPPORTUNITIES_NEXT_ACTIONS")).toMatchObject({
      state: "PARTIAL",
      items: [expect.objectContaining({ kind: "OFFERING_OPPORTUNITY" })],
    });
  });

  it("marks a successfully returned partial actionability object as partial", async () => {
    const response = await service({
      offerings: [
        { offeringId: "offering-1", name: "Serum", lifecycle: "ACTIVE" },
      ],
      productIntelligence: {
        "offering-1": intelligenceResult("product_intelligence", "offering-1", {
          objectState: "PARTIAL_CURRENT",
          readiness: "PARTIAL",
          resultReadiness: "PARTIAL",
        }),
      },
    }).read(actor);

    expect(source(response, "PRODUCT_INTELLIGENCE")).toMatchObject({
      state: "PARTIAL",
      freshness: "CURRENT",
      limitations: [
        "Product Intelligence actionability is materially partial for Home.",
      ],
    });
    expect(section(response, "OPPORTUNITIES_NEXT_ACTIONS")).toMatchObject({
      state: "PARTIAL",
      items: [expect.objectContaining({ kind: "OFFERING_OPPORTUNITY" })],
    });
  });

  it("keeps an action-required provider read READY with UNKNOWN freshness", async () => {
    const response = await service({
      providers: [
        {
          provider: "INSTAGRAM",
          state: "ACTION_REQUIRED",
          reasonCode: "INSTAGRAM_REVALIDATION_REQUIRED",
          affectedProductCapabilities: ["INSIGHTS"],
          humanActionRequired: true,
          freshness: "UNKNOWN",
        },
      ],
    }).read(actor);

    expect(source(response, "PROVIDER_READINESS")).toMatchObject({
      state: "READY",
      freshness: "UNKNOWN",
    });
    expect(section(response, "NEEDS_ATTENTION")?.items).toContainEqual(
      expect.objectContaining({ kind: "PROVIDER_RECOVERY" }),
    );
    expect(response.status).toBe("READY");
  });
});
