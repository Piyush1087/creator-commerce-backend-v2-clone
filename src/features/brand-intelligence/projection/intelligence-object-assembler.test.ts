import { describe, expect, it } from "vitest";

import { ComponentPathCodec } from "../semantic-path/component-path.codec";
import type { ProjectionComponentRecord } from "./intelligence-current-projection.repository";
import { IntelligenceObjectAssembler } from "./intelligence-object-assembler";

const brandId = "00000000-0000-4000-8000-0000000000f1";

export function projectionComponent(
  path: string,
  options: {
    valueState?: "VALUE" | "EXPLICIT_NULL" | "INTENTIONALLY_ABSENT";
    value?: unknown;
    objectSemanticId?: string;
    objectGenerationId?: string;
    componentGenerationId?: string;
    currentContractVersion?: string;
    authority?: string;
    sourceClass?: string;
    readiness?: string;
    freshness?: string;
    protectionState?: string;
    presentationOrder?: number | null;
    pendingCandidates?: ProjectionComponentRecord["pendingCandidates"];
  } = {},
): ProjectionComponentRecord {
  const objectSemanticId = options.objectSemanticId ?? "test_object";
  const componentGenerationId =
    options.componentGenerationId ?? `component:${path}`;
  const objectGenerationId =
    options.objectGenerationId ?? "object-generation:1";
  const valueState = options.valueState ?? "VALUE";
  const authority = options.authority ?? "CREATOR_SHOP_DERIVED";
  const protectionState =
    options.protectionState ??
    (authority === "BRAND_CONFIRMED" || authority === "SUPPORT_CONTROLLED"
      ? authority
      : "UNPROTECTED");
  const currentContractVersion = options.currentContractVersion ?? "1.0";
  const sourceClass = options.sourceClass ?? "MULTI_SOURCE";
  const readiness = options.readiness ?? "READY";
  return {
    id: `current:${path}`,
    brandId,
    objectSemanticId,
    pathSchemeVersion: 1,
    componentSemanticPath: path,
    nodeKind: path === "$" ? "SCALAR" : "OBJECT_FIELD",
    currentComponentGenerationId: componentGenerationId,
    currentContractId: "objects",
    currentContractVersion,
    currentAuthority: authority,
    currentSourceClass: sourceClass,
    currentReadiness: readiness,
    currentFreshness: options.freshness ?? "CURRENT",
    protectionState,
    revision: 1n,
    staleReasonCode: null,
    generation: {
      id: componentGenerationId,
      brandId,
      objectGenerationId,
      objectSemanticId,
      componentSemanticPath: path,
      pathSchemeVersion: 1,
      nodeKind: path === "$" ? "SCALAR" : "OBJECT_FIELD",
      componentContractId: "objects",
      componentContractVersion: currentContractVersion,
      valueState,
      valuePayload:
        valueState === "VALUE"
          ? (options.value ?? `value:${path}`)
          : valueState === "EXPLICIT_NULL"
            ? null
            : null,
      authority,
      sourceClass,
      readiness,
      freshnessAtGeneration: options.freshness ?? "CURRENT",
      presentationOrder: options.presentationOrder ?? null,
      createdAt: new Date("2026-08-25T10:00:00.000Z"),
      objectGeneration: {
        id: objectGenerationId,
        brandId,
        objectSemanticId,
        objectContractId: "objects",
        objectContractVersion: currentContractVersion,
        outputContractId: "test_output",
        outputContractVersion: currentContractVersion,
        bundleId: "test-bundle",
        bundleVersion: currentContractVersion,
        bundleHash: "a".repeat(64),
      },
    },
    pendingCandidates: options.pendingCandidates ?? [],
  };
}

describe("W1.0F semantic Object assembly", () => {
  const assembler = new IntelligenceObjectAssembler(new ComponentPathCodec());

  it("preserves scalar VALUE, EXPLICIT_NULL, and INTENTIONALLY_ABSENT", () => {
    expect(
      assembler.assemble([projectionComponent("$", { value: "hello" })]),
    ).toEqual({ state: "VALUE", value: "hello" });
    expect(
      assembler.assemble([
        projectionComponent("$", { valueState: "EXPLICIT_NULL" }),
      ]),
    ).toEqual({ state: "EXPLICIT_NULL", value: null });
    expect(
      assembler.assemble([
        projectionComponent("$", { valueState: "INTENTIONALLY_ABSENT" }),
      ]),
    ).toEqual({ state: "INTENTIONALLY_ABSENT" });
  });

  it("preserves path gaps and explicit null fields without synthesizing missing fields", () => {
    const assembled = assembler.assemble([
      projectionComponent("$/f/summary", { value: "Grounded" }),
      projectionComponent("$/f/optional", {
        valueState: "EXPLICIT_NULL",
      }),
      projectionComponent("$/f/removed", {
        valueState: "INTENTIONALLY_ABSENT",
      }),
    ]);
    expect(assembled).toEqual({
      state: "VALUE",
      value: { optional: null, summary: "Grounded" },
    });
    expect(assembled).not.toHaveProperty("value.missing");
  });

  it("preserves an evaluated empty semantic collection as VALUE", () => {
    expect(
      assembler.assemble([
        projectionComponent("$", {
          value: [],
          objectSemanticId: "brand_values",
        }),
      ]),
    ).toEqual({ state: "VALUE", value: [] });
  });

  it("assembles semantic items by stable IDs and presentation order", () => {
    const assembled = assembler.assemble([
      projectionComponent("$", {
        value: { tone_traits: [] },
        objectSemanticId: "communication_profile",
      }),
      projectionComponent("$/f/tone_traits/i/tone-b", {
        value: { semantic_id: "tone-b", label: "Bold" },
        objectSemanticId: "communication_profile",
        presentationOrder: 2,
      }),
      projectionComponent("$/f/tone_traits/i/tone-a", {
        value: { semantic_id: "tone-a", label: "Clear" },
        objectSemanticId: "communication_profile",
        presentationOrder: 1,
      }),
    ]);
    expect(assembled).toEqual({
      state: "VALUE",
      value: {
        tone_traits: [
          { semantic_id: "tone-a", label: "Clear" },
          { semantic_id: "tone-b", label: "Bold" },
        ],
      },
    });
  });

  it("assembles nested semantic lists and removes intentionally absent items", () => {
    const assembled = assembler.assemble([
      projectionComponent("$", {
        value: [
          {
            semantic_id: "persona-a",
            motivations: [{ semantic_id: "motivation-old", text: "Old" }],
          },
        ],
        objectSemanticId: "audience_personas",
      }),
      projectionComponent("$/i/persona-a/f/motivations/i/motivation-new", {
        value: { semantic_id: "motivation-new", text: "New" },
        objectSemanticId: "audience_personas",
      }),
      projectionComponent("$/i/persona-a/f/motivations/i/motivation-old", {
        valueState: "INTENTIONALLY_ABSENT",
        objectSemanticId: "audience_personas",
      }),
    ]);
    expect(assembled).toEqual({
      state: "VALUE",
      value: [
        {
          semantic_id: "persona-a",
          motivations: [{ semantic_id: "motivation-new", text: "New" }],
        },
      ],
    });
  });

  it("rejects array-index identity and mismatched item semantic IDs", () => {
    expect(() =>
      assembler.assemble([
        projectionComponent("$/f/items/i/0", {
          value: { semantic_id: "0", text: "invalid" },
        }),
      ]),
    ).toThrowError(expect.objectContaining({ code: "PROJECTION_INVARIANT" }));
    expect(() =>
      assembler.assemble([
        projectionComponent("$/f/items/i/item-a", {
          value: { semantic_id: "item-b", text: "mismatch" },
        }),
      ]),
    ).toThrowError(expect.objectContaining({ code: "PROJECTION_INVARIANT" }));
  });
});
