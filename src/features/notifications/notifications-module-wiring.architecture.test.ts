import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { CreatorPayoutProfileModule } from "../brand-escrow/creator-payout-profile.module";
import { BrandEscrowModule } from "../brand-escrow/brand-escrow.module";
import { CreatorPayoutProfileService } from "../brand-escrow/services/creator-payout-profile.service";
import { BrandSettingsModule } from "../brand-settings/brand-settings.module";
import { CreatorSettingsModule } from "../creator-settings/creator-settings.module";
import { InstagramGraphClient } from "../instagram/instagram-graph.client";
import { InstagramModule } from "../instagram/instagram.module";
import { InstagramOAuthClient } from "../instagram/instagram-oauth.client";
import { InstagramProviderClientModule } from "../instagram/instagram-provider-client.module";
import { PricingModule } from "../pricing/pricing.module";
import { NotificationsModule } from "./notifications.module";

type ForwardReference = {
  forwardRef: () => unknown;
};

function isForwardReference(value: unknown): value is ForwardReference {
  return (
    typeof value === "object" &&
    value !== null &&
    "forwardRef" in value &&
    typeof value.forwardRef === "function"
  );
}

function moduleImports(module: unknown): unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) as unknown[];
}

function moduleProviders(module: unknown): unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module) as unknown[];
}

function moduleExports(module: unknown): unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.EXPORTS, module) as unknown[];
}

function expectDeferredBrandCentreImport(module: unknown): void {
  const imports = moduleImports(module);

  expect(imports).not.toContain(BrandCentreModule);
  expect(
    imports.filter(
      (entry) =>
        isForwardReference(entry) && entry.forwardRef() === BrandCentreModule,
    ),
  ).toHaveLength(1);
}

function expectDirectBrandCentreImport(module: unknown): void {
  const imports = moduleImports(module);

  expect(imports).toContain(BrandCentreModule);
  expect(
    imports.some(
      (entry) =>
        isForwardReference(entry) && entry.forwardRef() === BrandCentreModule,
    ),
  ).toBe(false);
}

describe("Brand module boundary wiring", () => {
  it("DEFERS_ONLY_THE_RUNTIME_REQUIRED_BRAND_CENTRE_EDGES", () => {
    expectDeferredBrandCentreImport(NotificationsModule);
    expectDeferredBrandCentreImport(BrandSettingsModule);
    expectDirectBrandCentreImport(BrandEscrowModule);
    expectDirectBrandCentreImport(PricingModule);
  });

  it("USES_THE_NARROW_CREATOR_PAYOUT_PROFILE_BOUNDARY", () => {
    expect(moduleImports(CreatorSettingsModule)).toContain(
      CreatorPayoutProfileModule,
    );
    expect(moduleImports(CreatorSettingsModule)).not.toContain(BrandEscrowModule);

    expect(moduleImports(BrandEscrowModule)).toContain(
      CreatorPayoutProfileModule,
    );
    expect(moduleProviders(BrandEscrowModule)).not.toContain(
      CreatorPayoutProfileService,
    );
    expect(moduleExports(BrandEscrowModule)).toContain(
      CreatorPayoutProfileModule,
    );
    expect(moduleProviders(CreatorPayoutProfileModule)).toContain(
      CreatorPayoutProfileService,
    );
    expect(moduleExports(CreatorPayoutProfileModule)).toContain(
      CreatorPayoutProfileService,
    );
  });

  it("USES_THE_NARROW_INSTAGRAM_PROVIDER_CLIENT_BOUNDARY", () => {
    expect(moduleImports(BrandSettingsModule)).toContain(
      InstagramProviderClientModule,
    );
    expect(moduleImports(BrandSettingsModule)).not.toContain(InstagramModule);

    expect(moduleImports(InstagramModule)).toContain(
      InstagramProviderClientModule,
    );
    expect(moduleImports(InstagramModule)).toContain(CreatorSettingsModule);
    expect(moduleProviders(InstagramModule)).not.toContain(InstagramOAuthClient);
    expect(moduleProviders(InstagramModule)).not.toContain(InstagramGraphClient);
    expect(moduleExports(InstagramModule)).toContain(
      InstagramProviderClientModule,
    );
    expect(moduleProviders(InstagramProviderClientModule)).toEqual([
      InstagramOAuthClient,
      InstagramGraphClient,
    ]);
    expect(moduleExports(InstagramProviderClientModule)).toEqual([
      InstagramOAuthClient,
      InstagramGraphClient,
    ]);
  });
});
