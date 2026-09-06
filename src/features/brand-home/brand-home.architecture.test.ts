import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { BrandSettingsConsumerModule } from "../brand-settings/brand-settings-consumer.module";
import { BrandSettingsModule } from "../brand-settings/brand-settings.module";
import { BrandCampaignConsumerModule } from "../brand-uce/consumer/brand-campaign-consumer.module";
import { BrandWorkspaceReadinessModule } from "../brand-workspace-readiness/brand-workspace-readiness.module";
import { CollaborationConsumerModule } from "../collaboration/collaboration-consumer.module";
import { CollaborationModule } from "../collaboration/collaboration.module";
import { IntelligenceConsumerModule } from "../intelligence-consumer/intelligence-consumer.module";
import { BrandHomeModule } from "./brand-home.module";

const moduleMetadata = (key: string, module: unknown): unknown[] =>
  (Reflect.getMetadata(key, module) as unknown[]) ?? [];

describe("Brand Home P5-B architecture", () => {
  const root = join(process.cwd(), "src/features/brand-home");
  const productionFiles = readdirSync(root)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(root, name));
  const source = productionFiles
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  it("uses narrow read modules without full Collaboration or Settings imports", () => {
    const imports = moduleMetadata(MODULE_METADATA.IMPORTS, BrandHomeModule);
    expect(imports).toContain(CollaborationConsumerModule);
    expect(imports).toContain(BrandSettingsConsumerModule);
    expect(imports).toContain(BrandWorkspaceReadinessModule);
    expect(imports).toContain(BrandCampaignConsumerModule);
    expect(imports).toContain(IntelligenceConsumerModule);
    expect(imports).not.toContain(CollaborationModule);
    expect(imports).not.toContain(BrandSettingsModule);
    expect(source).not.toMatch(/import\s+\{\s*CollaborationModule\s*\}/u);
    expect(source).not.toMatch(/import\s+\{\s*BrandSettingsModule\s*\}/u);
  });

  it("contains no model, provider, persistence, or forwardRef authority", () => {
    expect(source).not.toContain("GeminiJsonClient");
    expect(source).not.toContain("ChatModelGateway");
    expect(source).not.toContain("ChatCapability");
    expect(source).not.toContain("PrismaService");
    expect(source).not.toContain("forwardRef(");
    expect(source).not.toContain(".create(");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".upsert(");
  });

  it("registers the Home endpoint from the application root", () => {
    const app = readFileSync(join(process.cwd(), "src/app.module.ts"), "utf8");
    const controller = readFileSync(
      join(root, "brand-home.controller.ts"),
      "utf8",
    );
    expect(app).toContain("BrandHomeModule");
    expect(controller).toContain('@Controller("api/v1/brand/home")');
    expect(controller).toContain("JwtAuthGuard");
  });
});
