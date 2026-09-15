import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../../../prisma/prisma.service";
import { IntelligenceOwnerScopeRepository } from "./intelligence-owner-scope.repository";

const enabled = process.env.CREATOR_AUDIENCE_P1_DATABASE_TEST === "true";

describe.skipIf(!enabled)(
  "Creator Audience shared owner scope (PostgreSQL)",
  () => {
    const db = new PrismaClient();
    const repository = new IntelligenceOwnerScopeRepository(
      db as PrismaService,
    );

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        url.hostname !== "localhost" ||
        ![
          "/creator_audience_p1_clean",
          "/c05_creator_brand_upgrade_shared",
        ].includes(url.pathname)
      ) {
        throw new Error("CREATOR_AUDIENCE_P1_DISPOSABLE_DATABASE_REQUIRED");
      }
      await db.$connect();
    });
    afterAll(() => db.$disconnect());

    async function creator() {
      const suffix = randomUUID();
      const organization = await db.organization.create({
        data: { kind: "CREATOR", name: `P1 ${suffix}` },
      });
      const user = await db.user.create({
        data: {
          email: `${suffix}@example.test`,
          normalizedEmail: `${suffix}@example.test`,
          role: "CREATOR",
          authState: "ACTIVE",
          organizationId: organization.id,
          emailVerifiedAt: new Date(),
        },
      });
      const profile = await db.creatorProfile.create({
        data: { userId: user.id },
      });
      const workspace = await db.creatorWorkspace.create({
        data: { ownerProfileId: profile.id, organizationId: organization.id },
      });
      return { profile, workspace };
    }

    it("creates first-class Creator scope and rejects Brand substitution", async () => {
      const { profile, workspace } = await creator();
      const owner = await repository.resolve({
        kind: "CREATOR",
        creatorProfileId: profile.id,
        creatorWorkspaceId: workspace.id,
      });
      const ref = `creator-resource:${randomUUID()}`;
      await db.$executeRawUnsafe(
        `INSERT INTO data_extraction_resources
       (id, resource_ref, owner_scope_id, brand_id, source_class, resource_type,
        canonical_resource_key, canonical_resource_key_hash, canonical_url, provider_account_id)
       VALUES ($1,$2,$3,NULL,'INSTAGRAM_OWNED','INSTAGRAM_ACCOUNT',$4,$5,$6,$7)`,
        randomUUID(),
        ref,
        owner.id,
        ref,
        "a".repeat(64),
        "instagram://creator-account",
        "provider-account",
      );
      const rows = await db.$queryRawUnsafe<
        Array<{ owner_scope_id: string; brand_id: string | null }>
      >(
        "SELECT owner_scope_id, brand_id FROM data_extraction_resources WHERE resource_ref = $1",
        ref,
      );
      expect(rows).toEqual([{ owner_scope_id: owner.id, brand_id: null }]);

      await expect(
        db.$executeRawUnsafe(
          `INSERT INTO data_extraction_resources
         (id, resource_ref, owner_scope_id, brand_id, source_class, resource_type,
          canonical_resource_key, canonical_resource_key_hash, canonical_url, provider_account_id)
         VALUES ($1,$2,$3,$4,'INSTAGRAM_OWNED','INSTAGRAM_ACCOUNT',$5,$6,$7,$8)`,
          randomUUID(),
          `bad:${randomUUID()}`,
          owner.id,
          "cross-brand",
          "bad",
          "b".repeat(64),
          "instagram://bad",
          "other-account",
        ),
      ).rejects.toThrow(/CREATOR_SCOPE_CANNOT_HAVE_BRAND/);

      expect(await repository.purgeCreatorInstagram(owner.id)).toBe(1);
      expect(
        await db.dataExtractionResource.count({ where: { resourceRef: ref } }),
      ).toBe(0);
      expect(
        await db.intelligenceOwnerScope.count({ where: { id: owner.id } }),
      ).toBe(1);
    });

    it("auto-backfills the exact Brand owner scope for unchanged Brand writes", async () => {
      const suffix = randomUUID();
      const brand = await db.brandProfile.create({
        data: {
          id: `brand-${suffix}`,
          domain: `${suffix}.example`,
          name: "P1 Brand",
          industry: "D2C",
        },
      });
      const row = await db.dataExtractionResource.create({
        data: {
          resourceRef: `brand-resource:${suffix}`,
          brandId: brand.id,
          resourceType: "OWNED_WEB_PAGE",
          canonicalResourceKey: suffix,
          canonicalResourceKeyHash: "c".repeat(64),
          canonicalUrl: `https://${suffix}.example`,
        },
      });
      const scope = await db.intelligenceOwnerScope.findUnique({
        where: { id: row.ownerScopeId },
      });
      expect(scope).toMatchObject({
        ownerType: "BRAND",
        brandProfileId: brand.id,
      });
    });

    it("rejects cross-Creator lineage even though legacy brand keys are null", async () => {
      const first = await creator();
      const second = await creator();
      const firstScope = await repository.resolve({
        kind: "CREATOR",
        creatorProfileId: first.profile.id,
        creatorWorkspaceId: first.workspace.id,
      });
      const secondScope = await repository.resolve({
        kind: "CREATOR",
        creatorProfileId: second.profile.id,
        creatorWorkspaceId: second.workspace.id,
      });
      const resourceRef = `creator-resource:${randomUUID()}`;
      await db.$executeRawUnsafe(
        `INSERT INTO data_extraction_resources
         (id, resource_ref, owner_scope_id, brand_id, source_class, resource_type,
          canonical_resource_key, canonical_resource_key_hash, canonical_url, provider_account_id)
         VALUES ($1,$2,$3,NULL,'INSTAGRAM_OWNED','INSTAGRAM_ACCOUNT',$4,$5,$6,$7)`,
        randomUUID(),
        resourceRef,
        firstScope.id,
        resourceRef,
        "d".repeat(64),
        "instagram://creator-account/first",
        "provider-first",
      );

      await expect(
        db.$executeRawUnsafe(
          `INSERT INTO data_extraction_captures
           (id, capture_ref, owner_scope_id, brand_id, resource_ref,
            acquisition_request_key, status, started_at, acquisition_quality,
            provider_account_id, authorization_generation)
           VALUES ($1,$2,$3,NULL,$4,$5,'RUNNING',CURRENT_TIMESTAMP,'COMPLETE',$6,1)`,
          randomUUID(),
          `creator-capture:${randomUUID()}`,
          secondScope.id,
          resourceRef,
          `request:${randomUUID()}`,
          "provider-second",
        ),
      ).rejects.toThrow(/OWNER_SCOPE_RESOURCE_LINEAGE_MISMATCH/);
    });
  },
);
