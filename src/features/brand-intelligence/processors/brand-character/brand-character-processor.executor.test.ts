import { describe, expect, it, vi } from "vitest";
import type { ProcessorExecutorContext } from "../../execution/executor/processor-executor";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { verifiedOutputZodSchema } from "../../contracts/validation/verified-output-zod-schema";
import { BrandCharacterProcessorExecutor } from "./brand-character-processor.executor";
import { BrandCharacterProviderError } from "./brand-character-model.provider";
import {
  BrandCharacterStateRepository,
  type CharacterCurrentState,
} from "./brand-character-state.repository";
import {
  characterOutput,
  contracts,
  evidenceFixture,
  preparation,
  registryKey,
  scope,
} from "./brand-character.test-fixtures";
import {
  itemPath,
  validateCharacterIdentity,
} from "./brand-character-identity";
import type { BrandCharacterOutput } from "./brand-character.types";

async function fixture(evidence = evidenceFixture("character-unit")) {
  const dependencies = preparation(evidence.brandId, evidence);
  const prepared = await dependencies.prepare({
    brandId: evidence.brandId,
    registryKey,
    activeScope: scope(evidence.brandId),
  });
  const model = {
    generate: vi.fn(async () => ({
      output: characterOutput(evidence) as unknown,
      providerAttemptCount: 1,
    })),
  };
  const catalogue = {
    read: vi.fn(async (): Promise<CharacterCurrentState[]> => []),
  };
  const executor = new BrandCharacterProcessorExecutor(
    dependencies,
    contracts(),
    catalogue as unknown as BrandCharacterStateRepository,
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
const mutable = (value: BrandCharacterOutput) =>
  JSON.parse(JSON.stringify(value)) as {
    brand_values: Array<{ semantic_id: string; value: string }>;
    brand_personality: Array<{ semantic_id: string; trait: string }>;
    output_metadata: Record<
      string,
      Array<{ semantic_id: string; authority: string; evidence_refs: string[] }>
    >;
  };
describe("brand_character executor", () => {
  it.each([null, "not-an-item", 7, []])(
    "structurally rejects non-object items even when frozen item type is implicit: %s",
    (item) => {
      const output = {
        ...characterOutput(evidenceFixture("item-shape")),
        brand_values: [item],
      };
      const bundle = contracts().getVerifiedBundle(registryKey);
      expect(verifiedOutputZodSchema(bundle).safeParse(output).success).toBe(
        false,
      );
      const validation = new StructuralValidator().validate(bundle, output);
      expect(validation.valid).toBe(false);
      expect(validation.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "TYPE_MISMATCH" }),
        ]),
      );
    },
  );
  it("accepts explicit supported generic wording instead of applying a blanket adjective ban", async () => {
    const original = evidenceFixture("supported-friendly");
    const evidence = {
      ...original,
      capabilityResults: original.capabilityResults.map((cap, index) =>
        index
          ? {
              ...cap,
              evidence: cap.evidence.map((item) => ({
                ...item,
                boundedNormalizedPayload: {
                  text_or_normalized_message:
                    "We are a friendly and dependable brand in every partnership.",
                },
              })),
            }
          : cap,
      ),
    };
    const f = await fixture(evidence);
    const output = mutable(characterOutput(evidence));
    output.brand_personality[0].trait = "Friendly";
    f.model.generate.mockResolvedValue({ output, providerAttemptCount: 1 });
    expect((await f.executor.execute(f.context)).readiness).toBe("READY");
  });
  it.each([
    [true, true, "READY"],
    [true, false, "PARTIAL"],
    [false, true, "PARTIAL"],
    [false, false, "NOT_READY"],
  ] as const)(
    "supports independent collections %s/%s",
    async (values, personality, readiness) => {
      const f = await fixture();
      const output = characterOutput(f.evidence, values, personality);
      f.model.generate.mockResolvedValue({ output, providerAttemptCount: 1 });
      expect(
        verifiedOutputZodSchema(
          contracts().getVerifiedBundle(registryKey),
        ).safeParse(output).success,
      ).toBe(true);
      expect((await f.executor.execute(f.context)).readiness).toBe(readiness);
      expect(f.prepared.canonicalState.entries.map((e) => e.semantic)).toEqual([
        "brand_name",
        "industry",
        "sub_industry",
      ]);
      expect(
        f.prepared.evidence.capabilityResults.map((c) => c.capabilityId),
      ).toEqual([
        "owned_website.brand_company_context",
        "owned_website.brand_messaging",
      ]);
      expect(f.catalogue.read).toHaveBeenCalledWith(f.evidence.brandId, [
        "brand_values",
        "brand_personality",
      ]);
    },
  );
  it("blocks provider when representative owned-site Evidence is missing", async () => {
    const original = evidenceFixture("weak");
    const f = await fixture({
      ...original,
      capabilityResults: original.capabilityResults.map((cap) => ({
        ...cap,
        evidence: cap.evidence.map((e) => ({
          ...e,
          representativeness: "INCIDENTAL" as const,
        })),
      })),
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { code: "WAITING_FOR_EVIDENCE" },
    });
    expect(f.model.generate).not.toHaveBeenCalled();
  });
  it.each([
    "innovative",
    "authentic",
    "customer-centric",
    "friendly",
    "premium",
  ])("rejects unsupported filler %s", async (label) => {
    const f = await fixture();
    const output = mutable(characterOutput(f.evidence));
    output.brand_personality[0].trait = label;
    f.model.generate.mockResolvedValue({ output, providerAttemptCount: 1 });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { code: "SEMANTIC_UNSUPPORTED_GENERIC_CHARACTER" },
    });
  });
  it.each(["CONTEXT_SPECIFIC", "OFFERING_SPECIFIC", "INCIDENTAL"] as const)(
    "rejects referenced non-establishing support %s even if other Evidence makes input ready",
    async (representativeness) => {
      const original = evidenceFixture("weak-support");
      const evidence = {
        ...original,
        capabilityResults: original.capabilityResults.map((cap, index) =>
          index
            ? cap
            : {
                ...cap,
                evidence: cap.evidence.map((e) => ({
                  ...e,
                  representativeness,
                })),
              },
        ),
      };
      const f = await fixture(evidence);
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { code: "SEMANTIC_NON_ESTABLISHING_CHARACTER_EVIDENCE" },
      });
    },
  );
  it.each([
    "One playful headline for our summer campaign.",
    "Our logo uses a playful font.",
    "The founder is curious and friendly.",
    "A premium product feature benefits our customers.",
    "We donated once for a one-off CSR campaign.",
  ])("rejects non-establishing messaging: %s", async (text) => {
    const original = evidenceFixture("non-establishing");
    const f = await fixture({
      ...original,
      capabilityResults: original.capabilityResults.map((cap, index) =>
        index
          ? {
              ...cap,
              evidence: cap.evidence.map((e) => ({
                ...e,
                boundedNormalizedPayload: { text_or_normalized_message: text },
              })),
            }
          : cap,
      ),
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { code: "SEMANTIC_NON_ESTABLISHING_CHARACTER_EVIDENCE" },
    });
  });
  it.each([
    "unknown-ref",
    "duplicate-id",
    "missing-meta",
    "extra-meta",
    "protected-authority",
    "numeric-id",
    "blank-item",
    "extra-field",
  ])("rejects invalid output %s", async (mode) => {
    const f = await fixture();
    const output = mutable(characterOutput(f.evidence));
    if (mode === "unknown-ref")
      output.output_metadata.brand_values[0].evidence_refs = ["unknown"];
    if (mode === "duplicate-id")
      output.brand_values[1].semantic_id = output.brand_values[0].semantic_id;
    if (mode === "missing-meta") output.output_metadata.brand_values.pop();
    if (mode === "extra-meta")
      output.output_metadata.brand_values.push({
        ...output.output_metadata.brand_values[0],
        semantic_id: "orphan",
      });
    if (mode === "protected-authority")
      output.output_metadata.brand_values[0].authority = "BRAND_CONFIRMED";
    if (mode === "numeric-id") output.brand_values[0].semantic_id = "0";
    if (mode === "blank-item") output.brand_values[0].value = "  ";
    if (mode === "extra-field")
      Object.assign(output, { positioning: "not owned" });
    f.model.generate.mockResolvedValue({ output, providerAttemptCount: 1 });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { category: "VALIDATION_FAILURE" },
    });
  });
  it("rejects rekeying continuous protected meaning and preserves exact ID across wording/case changes", () => {
    const output = mutable(characterOutput(evidenceFixture("identity")));
    const prior = [
      {
        objectSemanticId: "brand_values",
        componentSemanticPath: itemPath("principle_transparency"),
        lifecycle: "ACTIVE",
        protectionState: "BRAND_CONFIRMED",
        currentComponentGeneration: {
          valuePayload: {
            semantic_id: "principle_transparency",
            value: "Transparency",
          },
        },
      },
    ] as unknown as CharacterCurrentState[];
    output.brand_values[0].semantic_id = "new_transparency";
    expect(() =>
      validateCharacterIdentity(
        output as unknown as BrandCharacterOutput,
        prior,
        scope("identity"),
      ),
    ).toThrow("CHARACTER_SEMANTIC_ID_CONTINUITY");
    output.brand_values[0].semantic_id = "principle_transparency";
    output.brand_values[0].value = "TRANSPARENCY";
    expect(() =>
      validateCharacterIdentity(
        output as unknown as BrandCharacterOutput,
        prior,
        scope("identity"),
      ),
    ).not.toThrow();
  });
  it.each(["RATE_LIMITED", "REQUEST_TIMEOUT", "NETWORK_ERROR"])(
    "keeps %s retry under W1.0D",
    async (code) => {
      const f = await fixture();
      f.model.generate.mockRejectedValue(
        new BrandCharacterProviderError(code, true),
      );
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { category: "RETRYABLE_TECHNICAL", code },
      });
    },
  );
  it("keeps malformed provider output non-retryable", async () => {
    const f = await fixture();
    f.model.generate.mockRejectedValue(
      new BrandCharacterProviderError("STRUCTURED_OUTPUT_INVALID", false),
    );
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { category: "VALIDATION_FAILURE" },
    });
  });
});
