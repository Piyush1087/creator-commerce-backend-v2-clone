import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectionRoot = join(
  process.cwd(),
  "src",
  "features",
  "brand-intelligence",
  "projection",
);

const productionProjectionSource = () =>
  readdirSync(projectionRoot)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => readFileSync(join(projectionRoot, file), "utf8"))
    .join("\n");

describe("W1.0F current-projection architecture boundary", () => {
  it("does not depend on legacy, frontend, provider, or API surfaces", () => {
    const source = productionProjectionSource();
    for (const forbidden of [
      ".brandProfile.",
      ".brandPreviewRun.",
      ".brandIntelligenceScan.",
      "strategicDna",
      "visualIdentity",
      "targetAudience",
      "provider/",
      "data-extraction",
      "@Controller",
      "@Resolver",
      "frontend",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("exposes stable projection values rather than persistence identities or mutation handles", () => {
    const publicTypes = readFileSync(
      join(projectionRoot, "intelligence-current-projection.types.ts"),
      "utf8",
    );
    for (const forbidden of [
      "@prisma/client",
      "Prisma",
      "objectGenerationId",
      "componentGenerationId",
      "candidateId",
      "update(",
      "delete(",
      "acceptCandidate",
      "rejectCandidate",
    ]) {
      expect(publicTypes).not.toContain(forbidden);
    }
  });

  it("reads one repeatable snapshot of active current rows and unresolved candidates", () => {
    const repository = readFileSync(
      join(projectionRoot, "intelligence-current-projection.repository.ts"),
      "utf8",
    );
    expect(repository).toContain(
      "Prisma.TransactionIsolationLevel.RepeatableRead",
    );
    expect(repository).toContain(
      "IntelligenceCurrentComponentLifecycle.ACTIVE",
    );
    expect(repository).toContain(
      "IntelligenceComponentCandidateStatus.PENDING",
    );
    expect(repository).not.toContain("intelligenceExecution.find");
    expect(repository).not.toContain("processorExecution.find");
  });

  it("adds no HTTP or GraphQL surface to the module", () => {
    const moduleSource = readFileSync(
      join(projectionRoot, "..", "brand-intelligence.module.ts"),
      "utf8",
    );
    expect(moduleSource).not.toContain("controllers:");
    expect(moduleSource).not.toContain("resolver");
  });
});
