import { MODULE_METADATA } from "@nestjs/common/constants";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandEscrowModule } from "../brand-escrow/brand-escrow.module";
import { CreatorPayoutProfileModule } from "../brand-escrow/creator-payout-profile.module";
import { CreatorPayoutProfileService } from "../brand-escrow/services/creator-payout-profile.service";
import { BrandSettingsModule } from "../brand-settings/brand-settings.module";
import { BrandSettingsConsumerModule } from "../brand-settings/brand-settings-consumer.module";
import { CreatorAudienceModule } from "../creator-audience/creator-audience.module";
import { CreatorContentModule } from "../creator-content/creator-content.module";
import { CreatorSettingsModule } from "../creator-settings/creator-settings.module";
import { DataExtractionModule } from "../data-extraction/data-extraction.module";
import { InstagramConnectService } from "../instagram/instagram-connect.service";
import { InstagramGraphClient } from "../instagram/instagram-graph.client";
import { InstagramIntelligenceProviderClient } from "../instagram/instagram-intelligence-provider.client";
import { InstagramIntelligenceProviderModule } from "../instagram/instagram-intelligence-provider.module";
import { INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT } from "../instagram/instagram-intelligence-provider.types";
import { InstagramModule } from "../instagram/instagram.module";
import { InstagramOAuthClient } from "../instagram/instagram-oauth.client";
import { InstagramProviderClientModule } from "../instagram/instagram-provider-client.module";
import {
  InstagramContainedImageAcquisitionService,
  InstagramImageLocatorClient,
} from "../instagram/media/instagram-contained-image-acquisition.service";
import { InstagramImageTemporaryStore } from "../instagram/media/instagram-image-temporary-store";
import {
  InstagramSecureImageDownloader,
  NodeInstagramImageDnsResolver,
  NodeInstagramPinnedHttpsTransport,
} from "../instagram/media/instagram-secure-image-downloader";
import {
  FfmpegInstagramAudioExtractor,
  InstagramAudioExtractorPort,
} from "../instagram/media/video/instagram-audio-extractor";
import { InstagramContainedVideoAcquisitionService } from "../instagram/media/video/instagram-contained-video-acquisition.service";
import { InstagramSecureVideoDownloader } from "../instagram/media/video/instagram-secure-video-downloader";
import {
  FfmpegInstagramVideoDecoder,
  InstagramVideoDecoderPort,
} from "../instagram/media/video/instagram-video-decoder";
import { InstagramVideoLocatorClient } from "../instagram/media/video/instagram-video-locator.client";
import { InstagramVideoTemporaryStore } from "../instagram/media/video/instagram-video-temporary-store";
import { InstagramIntelligenceModule } from "../instagram-intelligence/instagram-intelligence.module";
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
  return (
    (Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) as
      | unknown[]
      | undefined) ?? []
  );
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

  it("CREATOR_SETTINGS_USES_NARROW_PAYOUT_PROFILE_BOUNDARY", () => {
    const creatorImports = moduleImports(CreatorSettingsModule);
    expect(creatorImports).toContain(CreatorPayoutProfileModule);
    expect(creatorImports).not.toContain(BrandEscrowModule);
    expect(
      creatorImports.filter(
        (entry) =>
          isForwardReference(entry) && entry.forwardRef() === BrandEscrowModule,
      ),
    ).toHaveLength(0);

    expect(moduleProviders(CreatorPayoutProfileModule)).toContain(
      CreatorPayoutProfileService,
    );
    expect(moduleExports(CreatorPayoutProfileModule)).toContain(
      CreatorPayoutProfileService,
    );
    expect(moduleExports(BrandEscrowModule)).toContain(
      CreatorPayoutProfileModule,
    );
  });

  it("BRAND_SETTINGS_USES_NARROW_INSTAGRAM_PROVIDER_CLIENT", () => {
    expect(moduleImports(BrandSettingsModule)).toContain(
      InstagramProviderClientModule,
    );
    expect(moduleImports(BrandSettingsModule)).not.toContain(InstagramModule);

    expect(moduleProviders(InstagramModule)).toContain(InstagramConnectService);
    expect(moduleProviders(InstagramModule)).not.toContain(
      InstagramOAuthClient,
    );
    expect(moduleProviders(InstagramModule)).not.toContain(
      InstagramGraphClient,
    );
    expect(moduleImports(InstagramModule)).toContain(
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

  it("SEPARATES_ACCEPTED_INTELLIGENCE_CAPABILITIES_FROM_LIFECYCLE_CLIENTS", () => {
    expect(moduleImports(InstagramIntelligenceProviderModule)).toEqual([]);
    expect(moduleProviders(InstagramIntelligenceProviderModule)).toEqual([
      InstagramIntelligenceProviderClient,
      InstagramImageLocatorClient,
      InstagramImageTemporaryStore,
      NodeInstagramImageDnsResolver,
      NodeInstagramPinnedHttpsTransport,
      InstagramSecureImageDownloader,
      InstagramContainedImageAcquisitionService,
      InstagramVideoLocatorClient,
      InstagramVideoTemporaryStore,
      InstagramSecureVideoDownloader,
      InstagramContainedVideoAcquisitionService,
      FfmpegInstagramVideoDecoder,
      FfmpegInstagramAudioExtractor,
      {
        provide: InstagramVideoDecoderPort,
        useExisting: FfmpegInstagramVideoDecoder,
      },
      {
        provide: InstagramAudioExtractorPort,
        useExisting: FfmpegInstagramAudioExtractor,
      },
      {
        provide: INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
        useExisting: InstagramIntelligenceProviderClient,
      },
    ]);
    expect(moduleExports(InstagramIntelligenceProviderModule)).toEqual([
      INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
      InstagramContainedImageAcquisitionService,
      InstagramImageTemporaryStore,
      InstagramContainedVideoAcquisitionService,
      InstagramVideoTemporaryStore,
      InstagramVideoDecoderPort,
      InstagramAudioExtractorPort,
    ]);
    expect(moduleExports(InstagramIntelligenceProviderModule)).not.toContain(
      InstagramOAuthClient,
    );
    expect(moduleExports(InstagramIntelligenceProviderModule)).not.toContain(
      InstagramGraphClient,
    );
    for (const internal of [
      InstagramIntelligenceProviderClient,
      InstagramImageLocatorClient,
      NodeInstagramImageDnsResolver,
      NodeInstagramPinnedHttpsTransport,
      InstagramSecureImageDownloader,
      InstagramVideoLocatorClient,
      InstagramSecureVideoDownloader,
      FfmpegInstagramVideoDecoder,
      FfmpegInstagramAudioExtractor,
    ]) {
      expect(moduleExports(InstagramIntelligenceProviderModule)).not.toContain(
        internal,
      );
    }
  });

  it("WIRES_ONLY_AUTHORIZED_INTELLIGENCE_CONSUMERS_TO_THE_BROAD_BOUNDARY", () => {
    for (const consumer of [
      BrandSettingsConsumerModule,
      CreatorAudienceModule,
      CreatorContentModule,
      DataExtractionModule,
      InstagramIntelligenceModule,
    ]) {
      expect(moduleImports(consumer)).toContain(
        InstagramIntelligenceProviderModule,
      );
      expect(moduleImports(consumer)).not.toContain(
        InstagramProviderClientModule,
      );
    }
    for (const lifecycle of [
      BrandSettingsModule,
      CreatorSettingsModule,
      InstagramModule,
    ]) {
      expect(moduleImports(lifecycle)).toContain(InstagramProviderClientModule);
      expect(moduleImports(lifecycle)).not.toContain(
        InstagramIntelligenceProviderModule,
      );
    }
  });

  it("FAILS_CLOSED_WHEN_A_LIFECYCLE_CONTEXT_RESOLVES_INTELLIGENCE", async () => {
    const context = await Test.createTestingModule({
      imports: [InstagramProviderClientModule],
    }).compile();
    expect(context.get(InstagramOAuthClient)).toBeDefined();
    expect(context.get(InstagramGraphClient)).toBeDefined();
    expect(() =>
      context.get(INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT),
    ).toThrow();
    expect(() =>
      context.get(InstagramContainedImageAcquisitionService),
    ).toThrow();
    expect(() => context.get(InstagramVideoDecoderPort)).toThrow();
    expect(() => context.get(InstagramAudioExtractorPort)).toThrow();
    await context.close();
  });

  it("COMPILES_EXACT_EXPORTED_INTELLIGENCE_PORTS_WITHOUT_LIFECYCLE_CLIENTS", async () => {
    const exportedCapabilities = [
      INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
      InstagramContainedImageAcquisitionService,
      InstagramImageTemporaryStore,
      InstagramContainedVideoAcquisitionService,
      InstagramVideoTemporaryStore,
      InstagramVideoDecoderPort,
      InstagramAudioExtractorPort,
    ];
    const context = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
        InstagramIntelligenceProviderModule,
      ],
      providers: exportedCapabilities.map((capability, index) => ({
        provide: `INTELLIGENCE_CAPABILITY_PROBE_${index}`,
        inject: [capability],
        useFactory: (resolved: unknown) => resolved,
      })),
    }).compile();
    for (const [index] of exportedCapabilities.entries()) {
      expect(
        context.get(`INTELLIGENCE_CAPABILITY_PROBE_${index}`),
      ).toBeDefined();
    }
    expect(() => context.get(InstagramOAuthClient)).toThrow();
    expect(() => context.get(InstagramGraphClient)).toThrow();
    await context.close();
  });
});
