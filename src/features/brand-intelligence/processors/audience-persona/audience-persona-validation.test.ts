import { describe, expect, it } from "vitest";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { verifiedOutputZodSchema } from "../../contracts/validation/verified-output-zod-schema";
import { evidenceFixture } from "../brand-character/brand-character.test-fixtures";
import {
  audienceOutput,
  contracts,
  persona,
  registryKey,
  scope,
  supersession,
} from "./audience-persona.test-fixtures";
import {
  validateAudienceIdentity,
  personaPath,
} from "./audience-persona-identity";
import { audienceComponentPlan } from "./audience-persona-plan";
import { supportsAudience } from "./audience-persona-evidence";
import type { AudienceCurrentState } from "./audience-persona-state.repository";
import type { AudienceOutput } from "./audience-persona.types";

const evidence = evidenceFixture("brand");
const qualified = {
  ...evidence,
  capabilityResults: evidence.capabilityResults.map((c) => ({
    ...c,
    evidence: c.evidence.map((e) => ({
      ...e,
      boundedNormalizedPayload: {
        statement_text:
          "We help small teams build reliable partnership workflows.",
      },
    })),
  })),
};
const manifest = qualified.capabilityResults.flatMap((c) =>
  c.evidence.map((e) => ({
    evidenceRef: e.evidenceRef,
    capabilityId: e.capabilityId,
    semanticId: e.evidenceRef,
    revisionIdentity: e.captureVersion,
    representativeness: e.representativeness,
    normalizedPayload: e.boundedNormalizedPayload,
  })),
);
const bundle = contracts().getVerifiedBundle(registryKey);
const valid = (output: unknown) =>
  new SemanticValidator().validate(output, {
    bundle,
    evidenceManifest: manifest,
    businessStateManifest: [],
  });
const row = (id: string): AudienceCurrentState =>
  ({
    componentSemanticPath: personaPath(id),
    currentComponentGeneration: { valuePayload: { semantic_id: id } },
  }) as unknown as AudienceCurrentState;

describe("Audience frozen structural/semantic/identity rules", () => {
  it("repeated customer decision context can suffice without an explicit target-audience sentence", () => {
    const entry = {
      ...manifest[0],
      representativeness: "REPEATED_REPRESENTATIVE",
      normalizedPayload: {
        text_or_normalized_message:
          "Small teams struggle with unreliable partnership workflows.",
      },
    };
    expect(supportsAudience(entry)).toBe(true);
    expect(
      supportsAudience({ ...entry, representativeness: "INCIDENTAL" }),
    ).toBe(false);
  });
  it("provider schema and frozen structural validator accept partial, empty, and null output", () => {
    for (const output of [
      audienceOutput(qualified),
      audienceOutput(qualified, []),
      { audience_personas: null, output_metadata: null, reconciliation: [] },
    ]) {
      expect(verifiedOutputZodSchema(bundle).safeParse(output).success).toBe(
        true,
      );
      expect(new StructuralValidator().validate(bundle, output).valid).toBe(
        true,
      );
      expect(valid(output).valid).toBe(true);
    }
  });
  it("duplicate Persona IDs and duplicate nested IDs are invalid", () => {
    expect(valid(audienceOutput(qualified, [persona(), persona()])).valid).toBe(
      false,
    );
    const p = persona();
    expect(
      valid(
        audienceOutput(qualified, [
          { ...p, motivations: [...p.motivations!, ...p.motivations!] },
        ]),
      ).valid,
    ).toBe(false);
  });
  it("wording/case/order never define identity; lexically similar distinct IDs are allowed", () => {
    const a = persona("group_a"),
      b = {
        ...persona("group_b"),
        label: a.label + " with another decision context",
      };
    expect(valid(audienceOutput(qualified, [a, b])).valid).toBe(true);
    const out = audienceOutput(
      qualified,
      [
        { ...b, label: b.label.toUpperCase() },
        { ...a, label: "Rewritten wording" },
      ],
      [a.semantic_id, b.semantic_id],
    );
    expect(() =>
      validateAudienceIdentity(out, [row(a.semantic_id), row(b.semantic_id)]),
    ).not.toThrow();
  });
  it.each(["BRAND_CONFIRMED", "SUPPORT_CONTROLLED", "SYSTEM_DERIVED"])(
    "processor cannot emit %s",
    (authority) => {
      const out = audienceOutput(qualified);
      const bad = {
        ...out,
        output_metadata: out.output_metadata!.map((m) => ({
          ...m,
          field_metadata: {
            ...m.field_metadata,
            label: { ...m.field_metadata.label, authority },
          },
        })),
      };
      expect(valid(bad).valid).toBe(false);
    },
  );
  it("unsupported demographics, commercial geography, campaign instructions and missing core are invalid", () => {
    for (const p of [
      { ...persona(), demographic_context: { gender: "inferred" } },
      { ...persona(), geography_context: { shipping_reach: "global" } },
      {
        ...persona(),
        creator_communication_implications: [
          {
            semantic_id: "instruction",
            value: "Set campaign targeting and creator count",
          },
        ],
      },
      { ...persona(), motivations: [] },
      { ...persona(), label: " " },
    ])
      expect(valid(audienceOutput(qualified, [p])).valid).toBe(false);
  });
  it("Preview identity/promotion is rejected; Preview absence is valid", () => {
    expect(
      valid(audienceOutput(qualified, [persona("preview:seed")])).valid,
    ).toBe(false);
    const out = audienceOutput(qualified);
    expect(
      valid({
        ...out,
        reconciliation: out.reconciliation.map((r) => ({
          ...r,
          origin_preview_group_ref: "preview:seed",
        })),
      }).valid,
    ).toBe(false);
    expect(valid(out).valid).toBe(true);
  });
  it("supersession requires existing sources, new IDs and reciprocal edges", () => {
    const source = { ...persona("source"), lifecycle: "SUPERSEDED" as const },
      target = persona("target");
    const out = audienceOutput(qualified, [source, target], ["source"]);
    expect(() => validateAudienceIdentity(out, [row("source")])).toThrow();
    expect(() =>
      validateAudienceIdentity(supersession(out, { source: ["target"] }), [
        row("source"),
      ]),
    ).not.toThrow();
    expect(() =>
      validateAudienceIdentity(supersession(out, { source: ["target"] }), []),
    ).toThrow();
  });
  it("no fuzzy threshold, optional-source cardinality, or coverage threshold admits generic/incidental Evidence", () => {
    const base = manifest[0];
    expect(supportsAudience(base)).toBe(true);
    for (const representativeness of [
      "INCIDENTAL",
      "OFFERING_SPECIFIC",
      "CONTEXT_SPECIFIC",
    ])
      expect(supportsAudience({ ...base, representativeness })).toBe(false);
    expect(
      supportsAudience({
        ...base,
        normalizedPayload: { statement_text: "We are innovative and premium." },
      }),
    ).toBe(false);
    expect(
      supportsAudience({
        ...base,
        normalizedPayload: { statement_text: "Designed for everyone." },
      }),
    ).toBe(false);
    expect(
      supportsAudience({
        ...base,
        normalizedPayload: {
          statement_text: "This campaign is designed for small teams.",
        },
      }),
    ).toBe(false);
  });
  it("ambiguous proposals have no current mutations", () => {
    const p = persona("possible"),
      out = audienceOutput(qualified, [p]);
    const ambiguous: AudienceOutput = {
      ...out,
      reconciliation: [
        {
          candidate_ref: p.semantic_id,
          relationship: "POSSIBLE_MATCH",
          matched_persona_semantic_id: "prior",
        },
      ],
    };
    const plans = audienceComponentPlan(
      ambiguous,
      [{ ...row("prior"), protectionState: "UNPROTECTED" }],
      scope("brand"),
    );
    expect(
      plans.filter((p) => p.path.includes("possible")).every((p) => !p.apply),
    ).toBe(true);
  });
  it("a protected nested parent never allows its finer-grained value to be written", () => {
    const p = persona(),
      path = `${personaPath(p.semantic_id)}/f/motivations/i/${p.motivations![0].semantic_id}`;
    const current = [
      { ...row(p.semantic_id), protectionState: "UNPROTECTED" },
      {
        componentSemanticPath: path,
        protectionState: "BRAND_CONFIRMED",
        currentComponentGeneration: { valuePayload: p.motivations![0] },
      },
      {
        componentSemanticPath: `${path}/f/value`,
        protectionState: "UNPROTECTED",
        currentComponentGeneration: { valuePayload: p.motivations![0].value },
      },
    ] as AudienceCurrentState[];
    const plans = audienceComponentPlan(
      audienceOutput(qualified, [p], [p.semantic_id]),
      current,
      scope("brand"),
    );
    expect(plans.find((plan) => plan.path === path)?.apply).toBe(true);
    expect(plans.some((plan) => plan.path === `${path}/f/value`)).toBe(false);
  });
  it("an ambiguous successor cannot supersede its source", () => {
    const source = persona("source"),
      target = persona("target");
    const out = supersession(
      audienceOutput(
        qualified,
        [{ ...source, lifecycle: "SUPERSEDED" }, target],
        [source.semantic_id],
      ),
      { source: ["target"] },
    );
    expect(() =>
      validateAudienceIdentity(
        {
          ...out,
          reconciliation: out.reconciliation.map((r) =>
            r.candidate_ref === "target"
              ? {
                  ...r,
                  relationship: "POSSIBLE_MATCH" as const,
                  matched_persona_semantic_id: "source",
                }
              : r,
          ),
        },
        [row("source")],
      ),
    ).toThrow();
  });
});
