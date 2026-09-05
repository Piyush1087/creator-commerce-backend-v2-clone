import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
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

  it("CREATOR_SETTINGS_USES_FORWARDED_BRAND_ESCROW_PAYOUT_BOUNDARY", () => {
    // origin/development Creator Settings imports BrandEscrow via forwardRef and
    // consumes CreatorPayoutProfileService exported from BrandEscrowModule.
    // Chat-line CreatorPayoutProfileModule exists for compatibility but is not
    // the wired Settings edge on this merged tip.
    const creatorImports = moduleImports(CreatorSettingsModule);
    expect(creatorImports).not.toContain(BrandEscrowModule);
    expect(
      creatorImports.filter(
        (entry) =>
          isForwardReference(entry) && entry.forwardRef() === BrandEscrowModule,
      ),
    ).toHaveLength(1);

    expect(moduleProviders(BrandEscrowModule)).toContain(
      CreatorPayoutProfileService,
    );
    expect(moduleExports(BrandEscrowModule)).toContain(
      CreatorPayoutProfileService,
    );
  });

  it("BRAND_SETTINGS_USES_NARROW_INSTAGRAM_PROVIDER_CLIENT", () => {
    expect(moduleImports(BrandSettingsModule)).toContain(
      InstagramProviderClientModule,
    );
    expect(moduleImports(BrandSettingsModule)).not.toContain(InstagramModule);

    // Legacy Instagram feature module still owns creator-facing connect clients
    // on the development tip; Settings uses the narrow provider-client module.
    expect(moduleProviders(InstagramModule)).toContain(InstagramOAuthClient);
    expect(moduleProviders(InstagramModule)).toContain(InstagramGraphClient);
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
