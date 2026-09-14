import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Creator Audience V0 architecture boundaries", () => {
  it("exposes one authenticated no-store read route without refresh or delete", () => {
    const controller = readFileSync(
      resolve(__dirname, "creator-audience.controller.ts"),
      "utf8",
    );
    expect(controller).toContain(
      '@Controller("api/v1/creator/insights/audience")',
    );
    expect(controller).toContain("JwtAuthGuard");
    expect(controller).toContain('"private, no-store"');
    expect(controller).not.toMatch(/@Post|@Put|@Patch|@Delete|refresh/i);
  });

  it("keeps credential decryption inside the dedicated provider fence", () => {
    const fence = readFileSync(
      resolve(__dirname, "creator-audience-credential-fence.service.ts"),
      "utf8",
    );
    const consumer = readFileSync(
      resolve(__dirname, "creator-audience.service.ts"),
      "utf8",
    );
    expect(fence).toContain("decryptField");
    expect(consumer).not.toContain("decryptField");
  });

  it("routes Intelligence publication through the shared verified execution and transition runtime", () => {
    const repository = readFileSync(
      resolve(__dirname, "creator-audience.repository.ts"),
      "utf8",
    );
    const pipeline = readFileSync(
      resolve(__dirname, "creator-audience-pipeline.service.ts"),
      "utf8",
    );
    const hook = readFileSync(
      resolve(__dirname, "creator-audience-persistence.hook.ts"),
      "utf8",
    );
    expect(repository).not.toMatch(
      /INSERT INTO intelligence_(subjects|actions|executions|processor|object|component|current|evidence|transitions)/,
    );
    expect(repository).not.toMatch(
      /UPDATE intelligence_(object|component|current|actions|transitions)/,
    );
    expect(pipeline).toContain("IntelligenceExecutionService");
    expect(pipeline).toContain("ProcessorWorkerService");
    expect(hook).toContain("ContractRuntimeRegistry");
    expect(hook).toContain("PersistenceTransitionValidator");
    expect(hook).toContain("IntelligenceGenerationRepository");
    expect(hook).toContain("IntelligenceTransitionService");
    expect(hook).toContain("lockOwnerScopedInCanonicalOrder");
    expect(hook).toContain("assertCurrentIntegration");
  });

  it("does not introduce a Creator-only current runtime or scheduler", () => {
    const files = [
      "creator-audience-pipeline.service.ts",
      "creator-audience.repository.ts",
      "creator-audience-persistence.hook.ts",
    ].map((file) => readFileSync(resolve(__dirname, file), "utf8"));
    expect(files.join("\n")).not.toMatch(
      /CreatorAudience(CurrentStore|Scheduler|RuntimeService)/,
    );
  });
});
