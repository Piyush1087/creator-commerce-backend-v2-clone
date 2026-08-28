import { describe, expect, it, vi } from "vitest";
import type { ProcessorExecutorContext } from "../../execution/executor/processor-executor";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { verifiedOutputZodSchema } from "../../contracts/validation/verified-output-zod-schema";
import {
  BrandMeaningProcessorExecutor,
  type BrandMeaningOutput,
} from "./brand-meaning-processor.executor";
import { BrandMeaningProviderError } from "./brand-meaning-model.provider";
import {
  contracts,
  evidenceFixture,
  meaningOutput,
  preparation,
  registryKey,
  scope,
} from "./brand-meaning.test-fixtures";
import { BRAND_MEANING_SYSTEM_INSTRUCTION } from "./brand-meaning-prompt";

async function fixture(evidence = evidenceFixture("brand-meaning-unit")) {
  const dependencies = preparation(evidence.brandId, evidence);
  const prepared = await dependencies.prepare({
    brandId: evidence.brandId,
    registryKey,
    activeScope: scope(evidence.brandId),
  });
  const model = {
    generate: vi.fn(async () => ({
      output: meaningOutput(evidence, "", true),
      providerAttemptCount: 1,
    })),
  };
  const executor = new BrandMeaningProcessorExecutor(
    dependencies,
    contracts(),
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
  return { executor, model, context, prepared };
}
describe("brand_meaning executor", () => {
  it("accepts independent null output through the actual generated provider schema and validators", async () => {
    const f = await fixture();
    const result = await f.executor.execute(f.context);
    expect(result.readiness).toBe("PARTIAL");
    expect(result.persistencePayload.output.positioning).toBeNull();
    const call = f.model.generate.mock.calls[0] as unknown as [
      {
        outputSchema: ReturnType<typeof verifiedOutputZodSchema>;
        approvedContext: { canonicalState: unknown[] };
        instruction: string;
      },
    ];
    expect(
      call[0].outputSchema.safeParse(result.persistencePayload.output).success,
    ).toBe(true);
    expect(call[0].approvedContext.canonicalState).toHaveLength(4);
    expect(call[0].instruction).toBe(BRAND_MEANING_SYSTEM_INSTRUCTION);
    expect(
      f.prepared.evidence.capabilityResults.some(
        (cap) =>
          String(cap.capabilityId) === "brand_user_input_and_confirmations",
      ),
    ).toBe(false);
  });
  it("preserves all-null as NOT_READY rather than failure or filler", async () => {
    const f = await fixture();
    f.model.generate.mockResolvedValue({
      output: {
        brand_description: null,
        positioning: null,
        value_proposition: null,
        output_metadata: {
          brand_description: null,
          positioning: null,
          value_proposition: null,
        },
      },
      providerAttemptCount: 1,
    });
    expect((await f.executor.execute(f.context)).readiness).toBe("NOT_READY");
  });
  it("uses representativeEvidenceAnyOf without requiring every capability to contain items", async () => {
    const evidence = evidenceFixture("partial-evidence");
    const narrowed = {
      ...evidence,
      capabilityResults: evidence.capabilityResults.map((cap) =>
        cap.capabilityId === "owned_website.brand_messaging"
          ? cap
          : { ...cap, evidence: [] },
      ),
    };
    const prepared = await preparation(evidence.brandId, narrowed).prepare({
      brandId: evidence.brandId,
      registryKey,
      activeScope: scope(evidence.brandId),
    });
    expect(prepared.readiness.readiness).toBe("READY_TO_RUN");
  });
  it("blocks NOT_REQUESTED + null with no provider call", async () => {
    const evidence = evidenceFixture("missing");
    const f = await fixture({
      ...evidence,
      capabilityResults: evidence.capabilityResults.map((cap) => ({
        ...cap,
        status: "NOT_REQUESTED",
        capabilityExecutionRef: null,
        evidence: [],
      })),
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: {
        category: "DEPENDENCY_UNAVAILABLE",
        code: "WAITING_FOR_EVIDENCE",
      },
    });
    expect(f.model.generate).not.toHaveBeenCalled();
  });
  it("rejects single-offering support even when unrelated representative Evidence makes the processor eligible", async () => {
    const evidence = evidenceFixture("single-offering");
    const set = {
      ...evidence,
      capabilityResults: evidence.capabilityResults.map((cap) =>
        cap.capabilityId === "owned_website.offering_context"
          ? {
              ...cap,
              evidence: cap.evidence.map((item) => ({
                ...item,
                representativeness: "OFFERING_SPECIFIC" as const,
                boundedNormalizedPayload: {
                  generalization_scope: "SINGLE_OFFERING",
                },
              })),
            }
          : cap,
      ),
    };
    const f = await fixture(set);
    const output = meaningOutput(set);
    const ref = set.capabilityResults[2].evidence[0].evidenceRef;
    f.model.generate.mockResolvedValue({
      output: {
        ...output,
        output_metadata: {
          ...output.output_metadata,
          value_proposition: {
            ...output.output_metadata.value_proposition!,
            evidence_refs: [ref],
          },
        },
      },
      providerAttemptCount: 1,
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { code: "SEMANTIC_OFFERING_NOT_BRAND_TRUTH" },
    });
  });
  it.each([
    ["REPEATED_REPRESENTATIVE", "MULTIPLE_OFFERINGS"],
    ["CONTEXT_SPECIFIC", "BRAND_LEVEL_PORTFOLIO"],
  ] as const)(
    "permits representative or explicit Brand-level offering support: %s / %s",
    async (representativeness, generalizationScope) => {
      const evidence = evidenceFixture("brand-level-offerings");
      const set = {
        ...evidence,
        capabilityResults: evidence.capabilityResults.map((cap) =>
          cap.capabilityId === "owned_website.offering_context"
            ? {
                ...cap,
                evidence: cap.evidence.map((item) => ({
                  ...item,
                  representativeness,
                  boundedNormalizedPayload: {
                    generalization_scope: generalizationScope,
                  },
                })),
              }
            : cap,
        ),
      };
      const f = await fixture(set);
      const output = meaningOutput(set);
      f.model.generate.mockResolvedValue({
        output: {
          ...output,
          output_metadata: {
            ...output.output_metadata,
            value_proposition: {
              ...output.output_metadata.value_proposition!,
              evidence_refs: [set.capabilityResults[2].evidence[0].evidenceRef],
            },
          },
        },
        providerAttemptCount: 1,
      });
      expect((await f.executor.execute(f.context)).readiness).toBe("READY");
    },
  );
  it.each(["REQUEST_TIMEOUT", "RATE_LIMITED"])(
    "keeps %s under W1.0D retry ownership",
    async (code) => {
      const f = await fixture();
      f.model.generate.mockRejectedValue(
        new BrandMeaningProviderError(code, true),
      );
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { category: "RETRYABLE_TECHNICAL", code },
      });
    },
  );
  it("rejects drift before provider invocation", async () => {
    const f = await fixture();
    f.context.processorExecution.evidenceManifestHash = "wrong";
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { code: "DEPENDENCY_SNAPSHOT_CHANGED" },
    });
    expect(f.model.generate).not.toHaveBeenCalled();
  });
  it.each(["BRAND_CONFIRMED", "SUPPORT_CONTROLLED"])(
    "cannot emit %s",
    async (authority) => {
      const f = await fixture();
      const output = meaningOutput(f.prepared.evidence);
      f.model.generate.mockResolvedValue({
        output: {
          ...output,
          output_metadata: {
            ...output.output_metadata,
            brand_description: {
              ...output.output_metadata.brand_description!,
              authority,
            },
          },
        },
        providerAttemptCount: 1,
      });
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { category: "VALIDATION_FAILURE" },
      });
    },
  );
  it.each([
    "blank",
    "extra",
    "metadata",
    "unknown-lineage",
    "collapsed",
    "claim",
  ])("rejects %s output before persistence", async (mode) => {
    const f = await fixture();
    const output: BrandMeaningOutput = meaningOutput(f.prepared.evidence);
    const value =
      mode === "blank"
        ? { ...output, brand_description: " " }
        : mode === "extra"
          ? { ...output, preview: "forbidden" }
          : mode === "metadata"
            ? {
                ...output,
                output_metadata: {
                  ...output.output_metadata,
                  positioning: null,
                },
              }
            : mode === "unknown-lineage"
              ? {
                  ...output,
                  output_metadata: {
                    ...output.output_metadata,
                    positioning: {
                      ...output.output_metadata.positioning!,
                      evidence_refs: ["unknown"],
                    },
                  },
                }
              : mode === "collapsed"
                ? { ...output, positioning: output.brand_description }
                : {
                    ...output,
                    positioning: "The market leader with guaranteed outcomes",
                  };
    f.model.generate.mockResolvedValue({
      output: value,
      providerAttemptCount: 1,
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { category: "VALIDATION_FAILURE" },
    });
  });
});
