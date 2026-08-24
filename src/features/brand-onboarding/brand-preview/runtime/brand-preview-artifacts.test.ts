import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { BrandPreviewArtifactLoader } from "./brand-preview-artifact.loader";

describe("frozen Brand Preview runtime artifacts", () => {
  const loader = new BrandPreviewArtifactLoader();

  it("loads the frozen execution profile and IE minimum output contract", async () => {
    const [profile, minimum] = await Promise.all([
      loader.loadExecutionProfile(),
      loader.loadMinimumOutputContract(),
    ]);
    expect(profile).toMatchObject({
      id: "brand_preview_fast",
      version: "1.0-frozen",
      status: "FROZEN",
    });
    expect(minimum).toMatchObject({
      version: "1.0-frozen",
      status: "FROZEN — PRODUCT APPROVED",
    });
  });

  it("loads the frozen processor, reasoning, output contract and taxonomy", async () => {
    const prompt = await loader.loadPromptArtifacts();
    expect(prompt.processor.version).toBe("1.0-frozen");
    expect(prompt.reasoning.version).toBe("1.0-frozen");
    expect(prompt.outputContract.version).toBe("1.0-frozen");
    const archetypes = await loader.loadArchetypes();
    expect(archetypes).toHaveLength(30);
    expect(archetypes.every((item) => item.isActive)).toBe(true);
    expect(archetypes.find((item) => item.id === "EDUCATOR")?.label).toBe(
      "Educator",
    );
  });

  it("resolves primary and technical fallback only through the shared registry", async () => {
    const [primary, fallback] = await Promise.all([
      loader.resolvePrimaryModel(),
      loader.resolveFallbackModel(),
    ]);
    expect(primary).toMatchObject({
      model_profile: "brand_preview_fast_reasoning",
      provider_adapter: "gemini",
      model_id: "gemini-3.5-flash",
    });
    expect(fallback).toMatchObject({
      model_profile: "brand_preview_fast_reasoning_fallback",
      provider_adapter: "openai",
      model_id: "gpt-5.6-luna",
    });
  });

  it("does not invoke legacy Surface/Brand DNA orchestration or timer phases", async () => {
    const source = await readFile(
      resolve(__dirname, "brand-preview-runtime.service.ts"),
      "utf8",
    );
    expect(source).not.toMatch(
      /Stage1bCoordinatorService|BrandDnaEngineService|SurfaceScanProgressStore|McpPlannerService/,
    );
    expect(source).not.toMatch(/setTimeout|setInterval|Date\.now/);
  });
});
