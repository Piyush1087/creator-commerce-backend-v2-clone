import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BRAND_PROCESSOR_IDS } from "./processor-runtime-projection.types";
import {
  PRODUCT_CONSUMER_OBJECTS,
  PRODUCT_PROCESSOR_IDS,
} from "./product-consumer.types";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Product consumer architecture", () => {
  it("has exactly three Product runtime entries and leaves Brand at seven", () => {
    expect(PRODUCT_PROCESSOR_IDS).toEqual([
      "offering_factual_synthesis",
      "offering_creator_communication",
      "offering_actionability_synthesis",
    ]);
    expect(PRODUCT_CONSUMER_OBJECTS).toEqual([
      "offering_factual_profile",
      "offering_creator_communication_profile",
      "offering_actionability_profile",
    ]);
    expect(BRAND_PROCESSOR_IDS).toHaveLength(7);
    expect(
      BRAND_PROCESSOR_IDS.some((processorId) =>
        processorId.startsWith("offering_"),
      ),
    ).toBe(false);
  });

  it("exposes one authenticated exact-Offering read route without execution or DE calls", () => {
    const controller = read(
      "src/features/brand-centre/consumer/product-consumer.controller.ts",
    );
    const service = read(
      "src/features/brand-centre/consumer/product-consumer.service.ts",
    );
    expect(controller).toContain('@Get("offerings/:offeringId/intelligence")');
    expect(controller).toContain("JwtAuthGuard");
    expect(controller).toContain("ParseUUIDPipe");
    expect(service).toContain("ProductConsumerResponseSchema.parse");
    expect(service).not.toMatch(
      /ProcessorExecutor|IntelligenceExecutionService|DataExtraction|ModelProvider|\.generate\(|\.request\(/u,
    );
    expect(service).not.toContain("resolveIntelligenceSubject(");
  });
});
