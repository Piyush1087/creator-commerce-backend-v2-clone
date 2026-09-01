import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CHAT_CAPABILITY_CATALOG } from "./capabilities/chat-capability.catalog";
import { CHAT_FIRST_SLICE_CAPABILITY_IDS } from "./capabilities/chat-capability.catalog";

describe("permanent Chat P3 architecture", () => {
  const root = join(process.cwd(), "src/features/chat");
  const productionFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return productionFiles(path);
      return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
        ? [path]
        : [];
    });
  const source = productionFiles(root)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  it("contains the permanent controller and exact handlers without forbidden dependencies", () => {
    expect(existsSync(join(root, "chat.controller.ts"))).toBe(true);
    expect(
      productionFiles(root).filter((path) => path.endsWith(".handler.ts")),
    ).toHaveLength(9);
    expect(source).not.toContain("PrismaService");
    expect(source).not.toContain("PrismaClient");
    expect(source).not.toContain("CoPilotConversationMemoryService");
    expect(source).not.toContain("CoPilotSlotSessionService");
    expect(source).not.toContain("CoPilotOrchestratorService");
    expect(source).not.toContain("CoPilotHitlService");
    expect(source).not.toContain("IntelligenceCurrentProjectionService");
    expect(source).not.toContain("IntelligenceCurrentStateRepository");
    expect(source).not.toContain("DataExtraction");
    expect(source).not.toContain("ProviderRegistry");
    expect(source).not.toContain("ToolCallingFramework");
  });

  it("registers exactly the nine frozen implementations and no EXECUTE capability", () => {
    expect(
      CHAT_CAPABILITY_CATALOG.filter(
        (capability) => capability.implementationState === "IMPLEMENTED",
      ).map((capability) => capability.id),
    ).toEqual(CHAT_FIRST_SLICE_CAPABILITY_IDS);
    expect(
      CHAT_CAPABILITY_CATALOG.filter(
        (capability) => capability.class === "EXECUTE",
      ),
    ).toEqual([]);
  });

  it("keeps shared thread lookup user + Brand + thread scoped", () => {
    const threadService = readFileSync(
      join(
        process.cwd(),
        "src/features/co-pilot/services/co-pilot-thread.service.ts",
      ),
      "utf8",
    );
    expect(threadService).toContain("brandProfileId: scope.brandProfileId");
    expect(threadService).toContain("createdByUserId: scope.userId");
    expect(threadService).toContain("id: threadId");
    const controller = readFileSync(
      join(process.cwd(), "src/features/co-pilot/co-pilot.controller.ts"),
      "utf8",
    );
    expect(controller).toContain("this.ownerScope(req, brandProfileId)");
    expect(controller).not.toContain("getThreadForBrand");
  });
});
