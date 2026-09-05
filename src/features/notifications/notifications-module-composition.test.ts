import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandIntelligenceModule } from "../brand-intelligence/brand-intelligence.module";
import { BrandSettingsModule } from "../brand-settings/brand-settings.module";
import { NotificationsModule } from "./notifications.module";

function moduleImports(target: object): readonly unknown[] {
  const imports = Reflect.getMetadata(
    MODULE_METADATA.IMPORTS,
    target,
  ) as unknown;
  if (!Array.isArray(imports)) {
    throw new Error("Expected Nest module import metadata");
  }
  return imports;
}

function unwrapForwardReference(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const forwardRef = Reflect.get(value, "forwardRef") as unknown;
  return typeof forwardRef === "function" ? forwardRef.call(value) : value;
}

describe("Notifications module composition", () => {
  it("defers the exact Brand Centre edges that close the existing module cycles", () => {
    const notificationImports = moduleImports(NotificationsModule);
    const settingsImports = moduleImports(BrandSettingsModule);
    const centreImports = moduleImports(BrandCentreModule);
    const intelligenceImports = moduleImports(BrandIntelligenceModule);

    expect(unwrapForwardReference(notificationImports[2])).toBe(
      BrandCentreModule,
    );
    expect(unwrapForwardReference(settingsImports[0])).toBe(BrandCentreModule);
    expect(unwrapForwardReference(centreImports[3])).toBe(
      BrandIntelligenceModule,
    );
    expect(unwrapForwardReference(intelligenceImports[2])).toBe(
      NotificationsModule,
    );

    for (const imports of [
      notificationImports,
      settingsImports,
      centreImports,
      intelligenceImports,
    ]) {
      expect(imports.map(unwrapForwardReference)).not.toContain(undefined);
    }
  });
});
