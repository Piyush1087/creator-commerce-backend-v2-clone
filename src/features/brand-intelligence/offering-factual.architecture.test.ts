import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ContractBundleIntegrityVerifier } from "./contracts/bundle/contract-bundle.integrity";
import {
  CONTRACT_SOURCE_SPECS,
  EXECUTABLE_CONTRACT_PROCESSORS,
  PROCESSOR_ARCHITECTURE_COMMITS,
} from "./contracts/bundle/contract-source.spec";
import { ContractRuntimeRegistry } from "./contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "./contracts/validation/semantic.validator";

describe("Product Intelligence P4 architecture", () => {
  it("materializes exactly three executable Product processors at the frozen pin", () => {
    const runtime = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      new SemanticValidator(),
    );
    runtime.verifyAtRoot(
      resolve(
        process.cwd(),
        "src/features/brand-intelligence/generated/contract-bundles",
      ),
    );
    const product = runtime
      .registrations()
      .filter((entry) => entry.bundleId.startsWith("product_intelligence."));
    expect(product.map((entry) => entry.processorId)).toEqual([
      "offering_factual_synthesis",
      "offering_creator_communication",
      "offering_actionability_synthesis",
    ]);
    expect(product.every((entry) => entry.executionEnabled)).toBe(true);
    expect(
      product.map((entry) => PROCESSOR_ARCHITECTURE_COMMITS[entry.processorId]),
    ).toEqual([
      "bbb0be3345c36e9cc7c4f06ca68fb491b742b83f",
      "bbb0be3345c36e9cc7c4f06ca68fb491b742b83f",
      "bbb0be3345c36e9cc7c4f06ca68fb491b742b83f",
    ]);
    expect(
      CONTRACT_SOURCE_SPECS.filter(
        (spec) => spec.ownerEngine === "product_intelligence",
      ).map((spec) => spec.processorId),
    ).toEqual([
      "offering_factual_synthesis",
      "offering_creator_communication",
      "offering_actionability_synthesis",
    ]);
    expect(
      [...EXECUTABLE_CONTRACT_PROCESSORS].filter((id) =>
        id.startsWith("offering_"),
      ),
    ).toEqual([
      "offering_factual_synthesis",
      "offering_creator_communication",
      "offering_actionability_synthesis",
    ]);
  });

  it("keeps the accepted factual Object ownership and excludes commercial DE or consumers", () => {
    const spec = CONTRACT_SOURCE_SPECS.find(
      (candidate) => candidate.processorId === "offering_factual_synthesis",
    )!;
    expect(spec.ownedObjectSemanticIds).toEqual(["offering_factual_profile"]);
    expect(
      spec.ownedPathPatterns.map((entry) => entry.componentPathPattern),
    ).toEqual([
      "$",
      "$/f/factual_summary",
      "$/f/key_facts",
      "$/f/key_facts/i/{semantic_id}",
      "$/f/key_benefits",
      "$/f/key_benefits/i/{semantic_id}",
      "$/f/proof_points",
      "$/f/proof_points/i/{semantic_id}",
      "$/f/usage_context",
      "$/f/usage_context/i/{semantic_id}",
      "$/f/customer_context",
      "$/f/customer_context/i/{semantic_id}",
    ]);
    const root = join(__dirname, "processors", "offering-factual");
    const source = readdirSync(root)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => readFileSync(join(root, file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(
      /offering_commercial_evidence|@Controller|@Resolver/iu,
    );
    expect(source).not.toMatch(
      /evidence\/(acquisition|normalization)|\.offering\.(create|update|delete|upsert)/u,
    );
  });

  it("keeps the Product schema unchanged across the reconciled migration history", () => {
    expect(
      readdirSync(join(process.cwd(), "prisma", "migrations"), {
        withFileTypes: true,
      }).filter((entry) => entry.isDirectory()),
    ).toHaveLength(74);
    expect(
      readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8"),
    ).not.toContain("offering_factual_profile");
  });
});
