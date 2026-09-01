import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CHAT_CAPABILITY_CATALOG } from "./capabilities/chat-capability.catalog";

describe("permanent Chat P2 architecture", () => {
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

  it("contains no controller, handler, direct persistence, legacy memory, or slot-session dependency", () => {
    expect(existsSync(join(root, "chat.controller.ts"))).toBe(false);
    expect(
      productionFiles(root).filter((path) => path.endsWith(".handler.ts")),
    ).toEqual([]);
    expect(source).not.toContain("PrismaService");
    expect(source).not.toContain("CoPilotConversationMemoryService");
    expect(source).not.toContain("CoPilotSlotSessionService");
    expect(source).not.toContain("IntelligenceCurrent");
    expect(source).not.toContain("DataExtraction");
    expect(source).not.toContain("ProviderRegistry");
    expect(source).not.toContain("ToolCallingFramework");
  });

  it("registers no business or EXECUTE implementation in production", () => {
    expect(
      CHAT_CAPABILITY_CATALOG.filter(
        (capability) => capability.implementationState === "IMPLEMENTED",
      ),
    ).toEqual([]);
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
