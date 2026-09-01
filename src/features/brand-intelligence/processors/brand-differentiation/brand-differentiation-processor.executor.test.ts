import { describe, expect, it, vi } from "vitest";
import type { ProcessorExecutorContext } from "../../execution/executor/processor-executor";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { verifiedOutputZodSchema } from "../../contracts/validation/verified-output-zod-schema";
import { BrandDifferentiationProcessorExecutor } from "./brand-differentiation-processor.executor";
import { BrandDifferentiationProviderError } from "./brand-differentiation-model.provider";
import { BrandDifferentiationStateRepository } from "./brand-differentiation-state.repository";
import {
  capabilities,
  contracts,
  differentiationOutput,
  evidenceFixture,
  preparation,
  proofPayload,
  registryKey,
  scope,
} from "./brand-differentiation.test-fixtures";
import {
  differentiatorPath,
  proofPath,
  validateDifferentiationIdentity,
} from "./brand-differentiation-identity";
import { differentiationComponentPlan } from "./brand-differentiation-plan";
import type { DifferentiationOutput } from "./brand-differentiation.types";

async function fixture(evidence = evidenceFixture("differentiation-unit")) {
  const dependencies = preparation(evidence.brandId, evidence);
  const prepared = await dependencies.prepare({
    brandId: evidence.brandId,
    registryKey,
    activeScope: scope(evidence.brandId),
  });
  const model = {
    generate: vi.fn(async () => ({
      output: differentiationOutput(evidence) as unknown,
      providerAttemptCount: 1,
    })),
  };
  const catalogue = { read: vi.fn(async () => []) };
  const executor = new BrandDifferentiationProcessorExecutor(
    dependencies,
    contracts(),
    catalogue as unknown as BrandDifferentiationStateRepository,
    new StructuralValidator(),
    new SemanticValidator(),
    model,
  );
  const context = {
    processorExecution: {
      ...registryKey,
      id: "execution",
      brandId: evidence.brandId,
      activeScope: scope(evidence.brandId),
      dependencyManifestHash: prepared.dependencyManifestHash,
      evidenceManifestHash: prepared.evidenceManifestHash,
    },
    attempt: {},
    heartbeat: vi.fn(async () => {}),
  } as unknown as ProcessorExecutorContext;
  return { evidence, prepared, model, executor, context, catalogue };
}
type Mutable<T> = T extends object
  ? { -readonly [P in keyof T]: Mutable<T[P]> }
  : T;
const mutable = (output: DifferentiationOutput) =>
  structuredClone(output) as Mutable<DifferentiationOutput>;
const withPayload = (payload: Record<string, unknown>) => {
  const evidence = evidenceFixture("proof-safety");
  return {
    ...evidence,
    capabilityResults: evidence.capabilityResults.map((cap, i) =>
      i !== 3
        ? cap
        : {
            ...cap,
            evidence: cap.evidence.map((e) => ({
              ...e,
              boundedNormalizedPayload: payload,
            })),
          },
    ),
  };
};
describe("brand_differentiation bounded executor", () => {
  it.each([
    {
      proof_class: "REGULATORY_OR_CREDENTIAL_STATEMENT",
      claim_sensitivity: [],
    },
    {
      proof_class: "DIRECT_FIRST_PARTY_FACTUAL_SUPPORT",
      claim_sensitivity: ["TREATMENT_EFFICACY"],
    },
  ])(
    "unverified credential or sensitive occurrence cannot establish strategic truth: %j",
    async (classification) => {
      const evidence = withPayload({ ...proofPayload(), ...classification });
      const f = await fixture(evidence);
      const out = mutable(differentiationOutput(evidence, false));
      out.output_metadata![0].differentiator_metadata.evidence_refs = [
        "evidence:3",
      ];
      f.model.generate.mockResolvedValue({
        output: out,
        providerAttemptCount: 1,
      });
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { code: "SEMANTIC_DIFFERENTIATION_UNSAFE_REASONING_BASIS" },
      });
    },
  );
  it("unsafe healthcare messaging cannot be laundered into a narrower strategic claim", async () => {
    const original = evidenceFixture("clinical-basis");
    const evidence = {
      ...original,
      capabilityResults: original.capabilityResults.map((c, i) =>
        i !== 1
          ? c
          : {
              ...c,
              evidence: c.evidence.map((e) => ({
                ...e,
                boundedNormalizedPayload: {
                  text_or_normalized_message:
                    "Clinically proven treatment with a 99% success rate.",
                },
              })),
            },
      ),
    };
    const f = await fixture(evidence);
    const out = mutable(differentiationOutput(evidence, false));
    out.output_metadata![0].differentiator_metadata.evidence_refs = [
      "evidence:1",
    ];
    f.model.generate.mockResolvedValue({
      output: out,
      providerAttemptCount: 1,
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { code: "SEMANTIC_DIFFERENTIATION_UNSAFE_REASONING_BASIS" },
    });
  });
  it("accepts independently derived differentiation and OBSERVED exact factual proof", async () => {
    const f = await fixture();
    const result = await f.executor.execute(f.context);
    expect(result.readiness).toBe("READY");
    expect(
      result.persistencePayload.output.output_metadata![0]
        .differentiator_metadata.authority,
    ).toBe("CREATOR_SHOP_DERIVED");
    expect(
      result.persistencePayload.output.output_metadata![0]
        .proof_point_metadata![0].authority,
    ).toBe("OBSERVED");
    expect(f.catalogue.read).toHaveBeenCalledWith(f.evidence.brandId);
    expect(f.prepared.canonicalState.entries.map((e) => e.semantic)).toEqual([
      "brand_name",
      "industry",
      "sub_industry",
      "website_url",
    ]);
  });
  it.each(capabilities)(
    "missing %s waits before provider invocation",
    async (missing) => {
      const evidence = evidenceFixture("missing");
      const f = await fixture({
        ...evidence,
        capabilityResults: evidence.capabilityResults.map((cap) =>
          cap.capabilityId !== missing
            ? cap
            : {
                ...cap,
                status: "NOT_REQUESTED",
                capabilityExecutionRef: null,
                evidence: [],
              },
        ),
      });
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { category: "DEPENDENCY_UNAVAILABLE" },
      });
      expect(f.model.generate).not.toHaveBeenCalled();
    },
  );
  it.each([null, []])(
    "available empty lineages allow bounded %j without filler",
    async (value) => {
      const evidence = evidenceFixture("empty");
      const f = await fixture({
        ...evidence,
        capabilityResults: evidence.capabilityResults.map((c) => ({
          ...c,
          evidence: [],
        })),
      });
      f.model.generate.mockResolvedValue({
        output: { differentiation_and_proof: value, output_metadata: value },
        providerAttemptCount: 1,
      });
      expect((await f.executor.execute(f.context)).readiness).toBe("NOT_READY");
      expect(f.model.generate).toHaveBeenCalledOnce();
    },
  );
  it("permits differentiators with null or zero proof and mixed record readiness", async () => {
    const f = await fixture();
    const out = mutable(differentiationOutput(f.evidence, false));
    f.model.generate.mockResolvedValue({
      output: out,
      providerAttemptCount: 1,
    });
    expect((await f.executor.execute(f.context)).readiness).toBe("PARTIAL");
    out.differentiation_and_proof![0].proof_points = [];
    out.output_metadata![0].proof_point_metadata = [];
    f.model.generate.mockResolvedValue({
      output: out,
      providerAttemptCount: 1,
    });
    expect((await f.executor.execute(f.context)).readiness).toBe("PARTIAL");
  });
  it.each([
    [
      "GENERIC_MARKETING_ASSERTION",
      "BRAND_AUTHORED_ASSERTION",
      [],
      "We are the leading company.",
    ],
    [
      "FIRST_PARTY_CLAIM",
      "CLAIM_REQUIRING_EXTERNAL_VERIFICATION",
      [],
      "Independent tests prove performance.",
    ],
    [
      "TESTIMONIAL_OR_SOCIAL_PROOF",
      "OTHER_BOUNDED_PROOF_CONTEXT",
      ["TESTIMONIAL"],
      "A customer loved our tools.",
    ],
    [
      "FIRST_PARTY_CLAIM",
      "CLAIM_REQUIRING_EXTERNAL_VERIFICATION",
      ["TREATMENT_EFFICACY"],
      "Our treatment cures disease.",
    ],
    [
      "FIRST_PARTY_CLAIM",
      "CLAIM_REQUIRING_EXTERNAL_VERIFICATION",
      ["MEDICAL_SUCCESS_RATE"],
      "Our success rate is 99%.",
    ],
    [
      "FIRST_PARTY_CLAIM",
      "CLAIM_REQUIRING_EXTERNAL_VERIFICATION",
      ["SAFETY_CLAIM"],
      "Our treatment is safe.",
    ],
    [
      "FIRST_PARTY_CLAIM",
      "CLAIM_REQUIRING_EXTERNAL_VERIFICATION",
      ["DIAGNOSTIC_ACCURACY"],
      "Our diagnostic accuracy is superior.",
    ],
    [
      "FIRST_PARTY_CLAIM",
      "CLAIM_REQUIRING_EXTERNAL_VERIFICATION",
      ["GUARANTEED_OUTCOME_LANGUAGE"],
      "Guaranteed outcomes.",
    ],
  ])(
    "does not promote %s / %s into factual proof",
    async (strength, classification, sensitivity, statement) => {
      const f = await fixture(
        withPayload({
          ...proofPayload(String(statement)),
          proof_strength: strength,
          proof_class: classification,
          claim_sensitivity: sensitivity,
        }),
      );
      const out = mutable(
        differentiationOutput(evidenceFixture("proof-safety")),
      );
      out.differentiation_and_proof![0].proof_points![0].statement =
        String(statement);
      f.model.generate.mockResolvedValue({
        output: out,
        providerAttemptCount: 1,
      });
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { category: "VALIDATION_FAILURE" },
      });
    },
  );
  it("credential occurrence is OBSERVED attribution, never validated regulatory status", async () => {
    const statement = "Our factory is ISO 9001 certified.";
    const f = await fixture(
      withPayload({
        ...proofPayload(statement),
        proof_class: "REGULATORY_OR_CREDENTIAL_STATEMENT",
        proof_strength: "EXPLICIT_CERTIFICATION_OR_CREDENTIAL",
        claim_sensitivity: ["REGULATORY_STATEMENT"],
      }),
    );
    const out = mutable(differentiationOutput(evidenceFixture("proof-safety")));
    out.differentiation_and_proof![0].proof_points![0].statement = statement;
    out.output_metadata![0].proof_point_metadata![0].proof_strength =
      "EXPLICIT_CERTIFICATION_OR_CREDENTIAL";
    f.model.generate.mockResolvedValue({
      output: out,
      providerAttemptCount: 1,
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: {
        code: "SEMANTIC_DIFFERENTIATION_OCCURRENCE_ATTRIBUTION_REQUIRED",
      },
    });
    out.differentiation_and_proof![0].proof_points![0].statement = `Owned website states: ${statement}`;
    expect((await f.executor.execute(f.context)).readiness).toBe("READY");
    out.output_metadata![0].proof_point_metadata![0].proof_strength =
      "VERIFIED_BUSINESS_FACT";
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { category: "VALIDATION_FAILURE" },
    });
  });
  it("rejects unrelated, unknown and overbroad proof refs", async () => {
    const f = await fixture();
    for (const refs of [
      ["unknown"],
      ["evidence:0"],
      ["evidence:0", "evidence:3"],
    ]) {
      const out = mutable(differentiationOutput(f.evidence));
      out.output_metadata![0].proof_point_metadata![0].evidence_refs = refs;
      f.model.generate.mockResolvedValue({
        output: out,
        providerAttemptCount: 1,
      });
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { category: "VALIDATION_FAILURE" },
      });
    }
    const out = mutable(differentiationOutput(f.evidence));
    out.differentiation_and_proof![0].proof_points![0].statement =
      "We own a different unrelated capability.";
    f.model.generate.mockResolvedValue({
      output: out,
      providerAttemptCount: 1,
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { code: "SEMANTIC_DIFFERENTIATION_PROOF_NOT_SUPPORTED_BY_REF" },
    });
  });
  it.each(["BRAND_CONFIRMED", "SUPPORT_CONTROLLED"])(
    "rejects protected authority %s at either level",
    async (authority) => {
      const f = await fixture();
      for (const field of [
        "differentiator_metadata",
        "proof_point_metadata",
      ] as const) {
        const out = structuredClone(differentiationOutput(f.evidence));
        const meta =
          field === "differentiator_metadata"
            ? out.output_metadata![0][field]
            : out.output_metadata![0][field]![0];
        f.model.generate.mockResolvedValue({
          output: JSON.parse(
            JSON.stringify(out).replace(
              JSON.stringify(meta),
              JSON.stringify({ ...meta, authority }),
            ),
          ) as unknown,
          providerAttemptCount: 1,
        });
        await expect(f.executor.execute(f.context)).rejects.toMatchObject({
          failure: { category: "VALIDATION_FAILURE" },
        });
      }
    },
  );
  it("rejects duplicate differentiator/proof IDs and orphan metadata", async () => {
    const f = await fixture();
    const duplicate = mutable(differentiationOutput(f.evidence));
    duplicate.differentiation_and_proof!.push(
      duplicate.differentiation_and_proof![0],
    );
    const nested = mutable(differentiationOutput(f.evidence));
    nested.differentiation_and_proof![0].proof_points!.push(
      nested.differentiation_and_proof![0].proof_points![0],
    );
    const orphan = mutable(differentiationOutput(f.evidence));
    orphan.output_metadata![0].semantic_id = "orphan";
    for (const output of [duplicate, nested, orphan]) {
      f.model.generate.mockResolvedValue({ output, providerAttemptCount: 1 });
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { category: "VALIDATION_FAILURE" },
      });
    }
  });
  it("same IDs survive wording/case/reorder; all six frozen node paths materialize", () => {
    const out = mutable(differentiationOutput(evidenceFixture("identity")));
    const oldPaths = differentiationComponentPlan(
      out,
      [],
      scope("identity"),
    ).map((p) => p.path);
    out.differentiation_and_proof![0].differentiator = "IN-HOUSE MANUFACTURING";
    out.differentiation_and_proof!.reverse();
    out.differentiation_and_proof![0].proof_points!.reverse();
    validateDifferentiationIdentity(out, []);
    expect(
      differentiationComponentPlan(out, [], scope("identity")).map(
        (p) => p.path,
      ),
    ).toEqual(oldPaths);
    expect(oldPaths).toHaveLength(6);
    expect(oldPaths).toContain(
      `${proofPath("in_house_manufacturing", "owned_factory")}/f/statement`,
    );
    expect(differentiatorPath("meaning with / separator")).not.toContain(
      "/ separator",
    );
  });
  it("single Offering cannot establish Brand differentiation; representative portfolio may", async () => {
    for (const representative of [false, true]) {
      const original = evidenceFixture("offering");
      const evidence = {
        ...original,
        capabilityResults: original.capabilityResults.map((c, index) =>
          index !== 2
            ? c
            : {
                ...c,
                evidence: c.evidence.map((e) => ({
                  ...e,
                  representativeness: representative
                    ? ("REPEATED_REPRESENTATIVE" as const)
                    : ("OFFERING_SPECIFIC" as const),
                  boundedNormalizedPayload: {
                    observed_context: "Manufacturing spans the tool portfolio.",
                    generalization_scope: representative
                      ? "MULTIPLE_OFFERINGS"
                      : "SINGLE_OFFERING",
                  },
                })),
              },
        ),
      };
      const f = await fixture(evidence),
        out = mutable(differentiationOutput(evidence, false));
      out.output_metadata![0].differentiator_metadata.evidence_refs = [
        "evidence:2",
      ];
      f.model.generate.mockResolvedValue({
        output: out,
        providerAttemptCount: 1,
      });
      if (representative)
        expect((await f.executor.execute(f.context)).readiness).toBe("PARTIAL");
      else
        await expect(f.executor.execute(f.context)).rejects.toMatchObject({
          failure: {
            code: "SEMANTIC_DIFFERENTIATION_OFFERING_NOT_BRAND_TRUTH",
          },
        });
    }
  });
  it("preserves both conflicted facts as attributed observations or rejects a silent winner", async () => {
    const original = evidenceFixture("conflict");
    const p = original.capabilityResults[3].evidence[0];
    const evidence = {
      ...original,
      capabilityResults: original.capabilityResults.map((c, i) =>
        i !== 3
          ? c
          : {
              ...c,
              evidence: [
                {
                  ...p,
                  conflictGroupRef: "foundation",
                  boundedNormalizedPayload: proofPayload(
                    "Our company was founded in 1990.",
                  ),
                },
                {
                  ...p,
                  evidenceRef: "evidence:conflict",
                  conflictGroupRef: "foundation",
                  boundedNormalizedPayload: proofPayload(
                    "Our company was founded in 1991.",
                  ),
                },
              ],
            },
      ),
    };
    const f = await fixture(evidence),
      out = mutable(differentiationOutput(evidence));
    out.differentiation_and_proof![0].proof_points![0].statement =
      "Owned website states: Our company was founded in 1990.";
    f.model.generate.mockResolvedValue({
      output: out,
      providerAttemptCount: 1,
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { code: "SEMANTIC_DIFFERENTIATION_SILENT_CONFLICT_WINNER" },
    });
    out.differentiation_and_proof![0].proof_points!.push({
      semantic_id: "alternate_foundation",
      statement: "Owned website states: Our company was founded in 1991.",
    });
    out.output_metadata![0].proof_point_metadata!.push({
      ...out.output_metadata![0].proof_point_metadata![0],
      semantic_id: "alternate_foundation",
      evidence_refs: ["evidence:conflict"],
    });
    expect((await f.executor.execute(f.context)).readiness).toBe("READY");
  });
  it("cannot convert stale Evidence into CURRENT proof", async () => {
    const original = evidenceFixture("stale");
    const f = await fixture({
      ...original,
      capabilityResults: original.capabilityResults.map((c, i) =>
        i !== 3
          ? c
          : {
              ...c,
              evidence: c.evidence.map((e) => ({
                ...e,
                freshness: { ...e.freshness, state: "POSSIBLY_STALE" },
              })),
            },
      ),
    });
    const out = mutable(differentiationOutput(f.evidence));
    f.model.generate.mockResolvedValue({
      output: out,
      providerAttemptCount: 1,
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { code: "SEMANTIC_DIFFERENTIATION_FRESHNESS_ELEVATION" },
    });
    out.output_metadata![0].proof_point_metadata![0].freshness = "STALE";
    expect((await f.executor.execute(f.context)).readiness).toBe("READY");
  });
  it("maps provider retry and invalid schema to existing W1 categories", async () => {
    const f = await fixture();
    for (const [code, retryable, category] of [
      ["RATE_LIMITED", true, "RETRYABLE_TECHNICAL"],
      ["STRUCTURED_OUTPUT_INVALID", false, "VALIDATION_FAILURE"],
    ] as const) {
      f.model.generate.mockRejectedValueOnce(
        new BrandDifferentiationProviderError(code, retryable),
      );
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { code, category },
      });
    }
  });
  it("provider schema and structural validator reject additional Offering truth fields", () => {
    const output = {
      ...differentiationOutput(evidenceFixture("extra")),
      offering: { id: "fabricated" },
    };
    const bundle = contracts().getVerifiedBundle(registryKey);
    expect(verifiedOutputZodSchema(bundle).safeParse(output).success).toBe(
      false,
    );
    expect(new StructuralValidator().validate(bundle, output).valid).toBe(
      false,
    );
  });
});
