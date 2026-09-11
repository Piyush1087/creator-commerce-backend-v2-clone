import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { encryptField } from "../../../shared/crypto/field-encryption.util";
import type { InstagramIntelligenceProviderReadClient } from "../../instagram/instagram-intelligence-provider.types";
import { InstagramIntelligenceAuthorizedReadService } from "./instagram-intelligence-provider-read.service";

const databaseUrl = process.env.B2_INSTAGRAM_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres(
  "B2 Settings Instagram authorized-read PostgreSQL fences",
  () => {
    const prisma = new PrismaService();
    const provider = {
      readProfile: vi.fn().mockResolvedValue({ availability: "AVAILABLE" }),
      readMediaInventory: vi.fn(),
      readMediaInsights: vi.fn(),
      readAudienceInsights: vi.fn(),
      readCarouselChildren: vi.fn(),
    } as unknown as InstagramIntelligenceProviderReadClient & {
      readProfile: ReturnType<typeof vi.fn>;
    };
    const service = new InstagramIntelligenceAuthorizedReadService(
      prisma,
      provider,
    );
    const brandIds: string[] = [];

    beforeAll(async () => {
      process.env.SETTINGS_FIELD_ENCRYPTION_KEY = "b2-synthetic-local-only-key";
      await prisma.$connect();
    });
    afterAll(async () => {
      await prisma.brandProfile.deleteMany({ where: { id: { in: brandIds } } });
      await prisma.$disconnect();
    });

    it("accepts exact lineage, rejects stale/account/cross-Brand reads, and leaves the row unchanged", async () => {
      const firstBrand = await createBrand("first");
      const secondBrand = await createBrand("second");
      const integration = await prisma.brandIntegration.create({
        data: {
          brandProfileId: firstBrand.id,
          provider: "INSTAGRAM",
          status: "CONNECTED",
          currentPlatformHandle: "synthetic-handle",
          accessTokenEncrypted: encryptField("b2-synthetic-token"),
          isActive: true,
          providerAccountId: "synthetic-account",
          identityVerification: "VERIFIED",
          authorizationHealth: "CONNECTED_FULL",
          firstPartyProfileCapability: "YES",
          firstPartyInsightsCapability: "YES",
          authorizationGeneration: 7,
          credentialVersion: 4,
        },
      });
      const before = await prisma.brandIntegration.findUniqueOrThrow({
        where: { id: integration.id },
      });
      const valid = {
        brandProfileId: firstBrand.id,
        integrationId: integration.id,
        expectedProviderAccountId: "synthetic-account",
        expectedAuthorizationGeneration: 7,
        command: { kind: "PROFILE" } as const,
      };
      const result = await service.execute(valid);
      expect(result.lineage).toMatchObject({
        integrationId: integration.id,
        brandProfileId: firstBrand.id,
        providerAccountId: "synthetic-account",
        authorizationGeneration: 7,
        credentialVersion: 4,
      });
      expect(JSON.stringify(result)).not.toMatch(
        /b2-synthetic-token|accessTokenEncrypted/,
      );
      expect(provider.readProfile).toHaveBeenCalledTimes(1);

      await expect(
        service.execute({ ...valid, expectedAuthorizationGeneration: 6 }),
      ).rejects.toMatchObject({ code: "GENERATION_MISMATCH" });
      await expect(
        service.execute({
          ...valid,
          expectedProviderAccountId: "changed-account",
        }),
      ).rejects.toMatchObject({ code: "ACCOUNT_MISMATCH" });
      await expect(
        service.execute({ ...valid, brandProfileId: secondBrand.id }),
      ).rejects.toMatchObject({ code: "BRAND_MISMATCH" });
      expect(provider.readProfile).toHaveBeenCalledTimes(1);

      const after = await prisma.brandIntegration.findUniqueOrThrow({
        where: { id: integration.id },
      });
      expect(after).toEqual(before);
    });

    async function createBrand(label: string) {
      const brand = await prisma.brandProfile.create({
        data: {
          domain: `b2-${label}-${randomUUID()}.example.test`,
          name: `B2 ${label} Brand`,
          industry: "D2C",
          brandValues: [],
          policyFlags: [],
        },
      });
      brandIds.push(brand.id);
      return brand;
    }
  },
);
