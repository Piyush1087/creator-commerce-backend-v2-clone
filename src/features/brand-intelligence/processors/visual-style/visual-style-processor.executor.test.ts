import { describe, expect, it, vi } from "vitest";
import type { ProcessorExecutorContext } from "../../execution/executor/processor-executor";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { verifiedOutputZodSchema } from "../../contracts/validation/verified-output-zod-schema";
import { VisualStyleProcessorExecutor } from "./visual-style-processor.executor";
import { VisualStyleProviderError } from "./visual-style-model.provider";
import { VisualStyleStateRepository } from "./visual-style-state.repository";
import {
  contracts,
  visualStyleOutput,
  evidenceFixture,
  preparation,
  registryKey,
  scope,
  visualPayload,
  canonicalFixture,
} from "./visual-style.test-fixtures";
import { visualItemPath } from "./visual-style-identity";
import type { NormalizedEvidenceSet } from "../../input/evidence/intelligence-evidence.port";
import { CanonicalStateManifestBuilder } from "../../input/canonical-state/canonical-state-manifest";

async function fixture(
  evidence = evidenceFixture("visual-unit"),
  canonical = canonicalFixture(evidence.brandId),
) {
  const dependencies = preparation(evidence.brandId, evidence, canonical);
  const prepared = await dependencies.prepare({
    brandId: evidence.brandId,
    registryKey,
    activeScope: scope(evidence.brandId),
  });
  const model = {
    generate: vi.fn(async () => ({
      output: visualStyleOutput(evidence) as unknown,
      providerAttemptCount: 1,
    })),
  };
  const executor = new VisualStyleProcessorExecutor(
    dependencies,
    contracts(),
    { read: async () => [] } as unknown as VisualStyleStateRepository,
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
    heartbeat: vi.fn(async () => {}),
    attempt: {},
  } as unknown as ProcessorExecutorContext;
  return { evidence, canonical, prepared, model, executor, context };
}
describe("visual_style_synthesis bounded executor", () => {
  it("runs useful representative visual Evidence without approved canonical assets or other BI", async () => {
    const f = await fixture();
    expect(f.prepared.dependencyEligible).toBe(true);
    expect((await f.executor.execute(f.context)).readiness).toBe("READY");
    expect(f.model.generate).toHaveBeenCalledOnce();
    const input = JSON.stringify(f.model.generate.mock.calls[0]);
    expect(input).not.toContain("BrandProfile.visualIdentity");
  });
  it.each(["partial", "null"] as const)(
    "allows %s without filler or unsupported imagery",
    async (mode) => {
      const f = await fixture();
      f.model.generate.mockResolvedValue({
        output: visualStyleOutput(f.evidence, mode),
        providerAttemptCount: 1,
      });
      expect((await f.executor.execute(f.context)).readiness).toBe(
        mode === "partial" ? "PARTIAL" : "NOT_READY",
      );
    },
  );
  it.each([
    "missing",
    "empty",
    "page",
    "campaign",
    "incidental",
    "stale",
    "image-only",
    "unretained-css",
    "computed",
    "negative",
    "conflict",
  ])(
    "does not invoke provider for insufficient %s visual Evidence",
    async (kind) => {
      const original = evidenceFixture("visual-readiness");
      const evidence: NormalizedEvidenceSet = {
        ...original,
        capabilityResults: original.capabilityResults.map((cap) => ({
          ...cap,
          status: kind === "missing" ? "NOT_REQUESTED" : cap.status,
          capabilityExecutionRef:
            kind === "missing" ? null : cap.capabilityExecutionRef,
          evidence: ["empty", "missing"].includes(kind)
            ? []
            : cap.evidence.map((item) => ({
                ...item,
                representativeness:
                  kind === "page"
                    ? "PAGE_SPECIFIC"
                    : kind === "campaign"
                      ? "CAMPAIGN_SPECIFIC"
                      : kind === "incidental"
                        ? "INCIDENTAL"
                        : item.representativeness,
                freshness:
                  kind === "stale"
                    ? { ...item.freshness, state: "POSSIBLY_STALE" }
                    : item.freshness,
                polarity:
                  kind === "negative" ? "EXPLICIT_NEGATIVE" : item.polarity,
                conflictGroupRef:
                  kind === "conflict" ? "conflict:visual" : undefined,
                boundedNormalizedPayload:
                  kind === "image-only"
                    ? {
                        ...visualPayload(),
                        observed_property: "image_presence",
                        evidence_semantic: "GENERAL_VISUAL_PATTERN",
                      }
                    : kind === "unretained-css"
                      ? {
                          external_stylesheet:
                            "https://visual.example/style.css",
                        }
                      : kind === "computed"
                        ? { ...visualPayload(), computed_or_rendered: true }
                        : item.boundedNormalizedPayload,
              })),
        })),
      };
      const f = await fixture(evidence);
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: {
          category: "DEPENDENCY_UNAVAILABLE",
          code: "WAITING_FOR_EVIDENCE",
        },
      });
      expect(f.model.generate).not.toHaveBeenCalled();
    },
  );
  it.each([
    "Source-declared colours must always be used.",
    "Source-declared palette is approved.",
    "Source-declared typography is required.",
    "Source-declared visual style proves clinical efficacy.",
    "Source-declared photography conveys a soothing mood.",
    "Source declarations show no images.",
    "The rendered appearance is blue.",
    "Source-declared patterns show rendered appearance with blue.",
    "Source-declared patterns establish computed typography.",
    "Source-declared external stylesheet establishes the layout.",
    "Source-declared palette is #336699.",
  ])("rejects unsupported/promoted claim: %s", async (summary) => {
    const f = await fixture(),
      out = visualStyleOutput(f.evidence);
    f.model.generate.mockResolvedValue({
      output: {
        ...out,
        visual_style_profile: { ...out.visual_style_profile, summary },
      },
      providerAttemptCount: 1,
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { category: "VALIDATION_FAILURE" },
    });
  });
  it.each([
    "OBSERVED",
    "SYSTEM_DERIVED",
    "BRAND_CONFIRMED",
    "SUPPORT_CONTROLLED",
  ])("does not emit %s as derived interpretation", async (authority) => {
    const f = await fixture(),
      out = visualStyleOutput(f.evidence);
    f.model.generate.mockResolvedValue({
      output: {
        ...out,
        output_metadata: {
          ...out.output_metadata,
          summary: { ...out.output_metadata.summary, authority },
        },
      },
      providerAttemptCount: 1,
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { category: "VALIDATION_FAILURE" },
    });
  });
  it("rejects HIGH confidence from non-rendered DOM", async () => {
    const f = await fixture(),
      out = visualStyleOutput(f.evidence);
    f.model.generate.mockResolvedValue({
      output: {
        ...out,
        output_metadata: {
          ...out.output_metadata,
          summary: { ...out.output_metadata.summary, confidence: "HIGH" },
        },
      },
      providerAttemptCount: 1,
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { code: "SEMANTIC_VISUAL_RENDERING_CONFIDENCE_ELEVATION" },
    });
  });
  it.each(["style", "graphic", "imagery"])(
    "rejects duplicate %s semantic IDs",
    async (field) => {
      const f = await fixture(),
        out = visualStyleOutput(f.evidence),
        profile = out.visual_style_profile!;
      const item = {
        semantic_id: "duplicate",
        value: "Source-declared framing repetition",
      };
      const duplicate =
        field === "style"
          ? {
              ...profile,
              style_traits: [profile.style_traits[0], profile.style_traits[0]],
            }
          : field === "graphic"
            ? { ...profile, graphic_treatment: { traits: [item, item] } }
            : {
                ...profile,
                imagery_style: { subject_tendencies: [item, item] },
              };
      f.model.generate.mockResolvedValue({
        output: { ...out, visual_style_profile: duplicate },
        providerAttemptCount: 1,
      });
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { category: "VALIDATION_FAILURE" },
      });
    },
  );
  it("rejects processor-generated visual constraints", async () => {
    const f = await fixture(),
      out = visualStyleOutput(f.evidence);
    f.model.generate.mockResolvedValue({
      output: {
        ...out,
        visual_style_profile: {
          ...out.visual_style_profile,
          visual_constraints: [
            { semantic_id: "rule", rule: "Always use blue" },
          ],
        },
      },
      providerAttemptCount: 1,
    });
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: { code: "SEMANTIC_VISUAL_GENERATED_CONSTRAINT_FORBIDDEN" },
    });
  });
  it.each(["unknown", "cross-brand", "preview:logo"])(
    "rejects %s canonical reference",
    async (ref) => {
      const f = await fixture(),
        out = visualStyleOutput(f.evidence);
      f.model.generate.mockResolvedValue({
        output: {
          ...out,
          output_metadata: {
            ...out.output_metadata,
            summary: {
              ...out.output_metadata.summary,
              business_state_refs: [ref],
            },
          },
        },
        providerAttemptCount: 1,
      });
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { code: "SEMANTIC_UNKNOWN_BUSINESS_STATE_REFERENCE" },
      });
    },
  );
  it("rejects unknown Evidence refs and graphic output grounded only by colour", async () => {
    for (const ref of ["unknown", "visual:0"]) {
      const f = await fixture(),
        out = visualStyleOutput(f.evidence);
      f.model.generate.mockResolvedValue({
        output: {
          ...out,
          output_metadata: {
            ...out.output_metadata,
            graphic_treatment: {
              traits: [
                {
                  ...out.output_metadata.graphic_treatment!.traits[0],
                  evidence_refs: [ref],
                },
              ],
            },
          },
        },
        providerAttemptCount: 1,
      });
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { category: "VALIDATION_FAILURE" },
      });
    }
  });
  it("compiles exact frozen output plus item metadata without changing bundle bytes", () => {
    const bundle = contracts().getVerifiedBundle(registryKey),
      before = JSON.stringify(bundle.artifacts);
    const out = visualStyleOutput(evidenceFixture("visual-schema"));
    expect(verifiedOutputZodSchema(bundle).safeParse(out).success).toBe(true);
    expect(new StructuralValidator().validate(bundle, out).valid).toBe(true);
    expect(JSON.stringify(bundle.artifacts)).toBe(before);
    expect(
      verifiedOutputZodSchema(bundle).safeParse({ ...out, extra: "bad" })
        .success,
    ).toBe(false);
  });
  it("exact IDs are independent from text/order/case and preserve encoded identity", () => {
    expect(visualItemPath(["style_traits"], "same/id")).toBe(
      visualItemPath(["style_traits"], "same/id"),
    );
    expect(visualItemPath(["style_traits"], "same")).not.toBe(
      visualItemPath(["style_traits"], "SAME"),
    );
  });
  it("canonical revision manifests exclude asset payloads", () => {
    const canonical = canonicalFixture("visual-manifest");
    expect(
      JSON.stringify(new CanonicalStateManifestBuilder().build(canonical)),
    ).not.toContain("Visual Brand");
  });
  it.each(["RATE_LIMITED", "REQUEST_TIMEOUT", "NETWORK_ERROR"])(
    "keeps %s retry with W1",
    async (code) => {
      const f = await fixture();
      f.model.generate.mockRejectedValue(
        new VisualStyleProviderError(code, true),
      );
      await expect(f.executor.execute(f.context)).rejects.toMatchObject({
        failure: { category: "RETRYABLE_TECHNICAL", code },
      });
    },
  );
});
