import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { BrandSettingsConsumerModule } from "../brand-settings/brand-settings-consumer.module";
import { BrandSettingsModule } from "../brand-settings/brand-settings.module";
import { BrandProviderReadinessService } from "../brand-settings/services/brand-provider-readiness.service";
import { BrandWorkspaceReadinessConsumerService } from "../brand-workspace-readiness/brand-workspace-readiness-consumer.service";
import { BrandWorkspaceReadinessModule } from "../brand-workspace-readiness/brand-workspace-readiness.module";
import { CollaborationConsumerModule } from "../collaboration/collaboration-consumer.module";
import { CollaborationModule } from "../collaboration/collaboration.module";
import { CollaborationConsumerService } from "../collaboration/services/collaboration-consumer.service";
import { CHAT_CAPABILITY_CATALOG } from "./capabilities/chat-capability.catalog";
import { CHAT_FIRST_SLICE_CAPABILITY_IDS } from "./capabilities/chat-capability.catalog";
import { ChatModule } from "./chat.module";

const moduleMetadata = (key: string, module: unknown): unknown[] =>
  (Reflect.getMetadata(key, module) as unknown[]) ?? [];

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
    ).toHaveLength(13);
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

  it("registers exactly the thirteen additive implementations and no EXECUTE capability", () => {
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

  it("uses only narrow P5-A read modules without forward references", () => {
    const chatModule = readFileSync(join(root, "chat.module.ts"), "utf8");
    expect(chatModule).toContain("CollaborationConsumerModule");
    expect(chatModule).toContain("BrandSettingsConsumerModule");
    expect(chatModule).toContain("BrandWorkspaceReadinessModule");
    expect(chatModule).not.toMatch(/import\s+\{\s*CollaborationModule\s*\}/u);
    expect(chatModule).not.toMatch(/import\s+\{\s*BrandSettingsModule\s*\}/u);
    expect(chatModule).not.toContain("forwardRef(");

    const imports = moduleMetadata(MODULE_METADATA.IMPORTS, ChatModule);
    expect(imports).toContain(CollaborationConsumerModule);
    expect(imports).toContain(BrandSettingsConsumerModule);
    expect(imports).toContain(BrandWorkspaceReadinessModule);
    expect(imports).not.toContain(CollaborationModule);
    expect(imports).not.toContain(BrandSettingsModule);

    expect(
      moduleMetadata(MODULE_METADATA.PROVIDERS, CollaborationConsumerModule),
    ).toContain(CollaborationConsumerService);
    expect(
      moduleMetadata(MODULE_METADATA.EXPORTS, CollaborationConsumerModule),
    ).toContain(CollaborationConsumerService);
    expect(
      moduleMetadata(MODULE_METADATA.PROVIDERS, BrandSettingsConsumerModule),
    ).toContain(BrandProviderReadinessService);
    expect(
      moduleMetadata(MODULE_METADATA.EXPORTS, BrandSettingsConsumerModule),
    ).toContain(BrandProviderReadinessService);
    expect(
      moduleMetadata(MODULE_METADATA.PROVIDERS, BrandWorkspaceReadinessModule),
    ).toContain(BrandWorkspaceReadinessConsumerService);

    for (const narrowModule of [
      CollaborationConsumerModule,
      BrandSettingsConsumerModule,
      BrandWorkspaceReadinessModule,
    ]) {
      expect(
        moduleMetadata(MODULE_METADATA.IMPORTS, narrowModule).some(
          (entry) =>
            typeof entry === "object" &&
            entry !== null &&
            "forwardRef" in entry,
        ),
      ).toBe(false);
    }
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
