import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import {
  BrandLocationService,
  postalLocationAlias,
} from "./brand-location.service";
import { BrandVisualStateService } from "./brand-visual-state.service";
import { BrandCentreDnaService } from "../brand-centre/services/brand-centre-dna.service";
import { BrandProfileService } from "../brand-onboarding/brand-profile.service";
import type { S3Service } from "../../shared/s3/s3.service";
import type { ParallelExtractClient } from "../brand-onboarding/integrations/parallel/parallel-extract.client";

describe.skipIf(process.env.BRAND_CENTRE_DATABASE_TEST !== "true")(
  "Brand canonical state PostgreSQL",
  () => {
    const prisma = new PrismaClient();
    const db = prisma as unknown as PrismaService;
    const visuals = new BrandVisualStateService(db);
    const locations = new BrandLocationService(db);
    const authority = {
      authority: "BRAND_CONFIRMED",
      origin: "BRAND_EDIT",
    } as const;
    const address = {
      address: "10 Main Street",
      city: "Town",
      zip: "12345",
      name: "Store",
    };
    const brand = () =>
      prisma.brandProfile.create({
        data: {
          domain: `${randomUUID()}.example`,
          name: "Canonical test",
          industry: "D2C",
        },
      });
    afterAll(() => prisma.$disconnect());

    it("legacy unauthenticated profile patch cannot establish approval or displace approved logo", async () => {
      const b = await brand();
      const legacy = new BrandProfileService(db, {} as S3Service);
      await legacy.patch(b.id, {
        logoUrl: "https://legacy.example/a.png",
        visualIdentity: { colors: ["#000000"] },
      });
      expect(await visuals.read(b.id)).toBeNull();
      const approved = await visuals.confirmLogo(
        b.id,
        "https://approved.example/b.png",
        "BRAND_SELECTION",
      );
      await legacy.patch(b.id, { logoUrl: "https://legacy.example/c.png" });
      expect((await visuals.read(b.id))!.primaryLogo!.id).toBe(approved.id);
      expect(
        (await prisma.brandProfile.findUniqueOrThrow({ where: { id: b.id } }))
          .logoUrl,
      ).toBe(approved.url);
    });

    it("concurrent primary-logo CAS permits one winner and retains both durable assets", async () => {
      const b = await brand();
      const first = await visuals.saveAsset(
        b.id,
        { role: "LOGO", url: "https://approved.example/a.png" },
        authority,
      );
      const second = await visuals.saveAsset(
        b.id,
        { role: "LOGO", url: "https://approved.example/b.png" },
        authority,
      );
      const revision = (await visuals.read(b.id))!.revision;
      const results = await Promise.allSettled([
        visuals.selectPrimaryLogo(b.id, first.id, revision),
        visuals.selectPrimaryLogo(b.id, second.id, revision),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect((await visuals.read(b.id))!.assets).toHaveLength(2);
    });

    it("explicit identity disambiguates duplicate postal aliases without merging their rows", async () => {
      const b = await brand();
      const rows = await Promise.all(
        [1, 2].map(() =>
          prisma.location.create({
            data: { brandProfileId: b.id, ...address },
          }),
        ),
      );
      await prisma.brandLocationAlias.createMany({
        data: rows.map((row) => ({
          brandProfileId: b.id,
          locationId: row.id,
          kind: "POSTAL",
          key: postalLocationAlias(address)!,
        })),
      });
      const result = await locations.reconcile(
        b.id,
        [{ ...address, locationId: rows[0].id, name: "Explicit update" }],
        "scan",
      );
      expect(result[0]).toEqual({
        outcome: "MATCHED_EXISTING",
        locationId: rows[0].id,
      });
      expect(await locations.read(b.id)).toHaveLength(2);
      expect(
        (await prisma.location.findUniqueOrThrow({ where: { id: rows[1].id } }))
          .name,
      ).toBe("Store");
    });

    it("legacy font-role reorder retains exact existing font IDs and invalid visual input fails closed", async () => {
      const b = await brand();
      await prisma.$transaction((tx) =>
        visuals.confirmLegacyIdentity(
          b.id,
          { fonts: ["Font A", "Font B"] },
          tx,
        ),
      );
      const before = (await visuals.read(b.id))!.typography;
      await prisma.$transaction((tx) =>
        visuals.confirmLegacyIdentity(
          b.id,
          { fonts: ["Font B", "Font A"] },
          tx,
        ),
      );
      const after = (await visuals.read(b.id))!.typography;
      for (const font of before)
        expect(after.find((item) => item.family === font.family)!.id).toBe(
          font.id,
        );
      expect(after.find((item) => item.family === "Font B")!.usage).toBe(
        "HEADING",
      );
      await expect(
        visuals.saveAsset(
          b.id,
          { role: "LOGO", url: "javascript:alert(1)" },
          authority,
        ),
      ).rejects.toThrow("INVALID_CANONICAL_VISUAL_INPUT");
      const foreign = await brand();
      await expect(
        prisma.brandVisualState.update({
          where: { brandProfileId: b.id },
          data: { brandProfileId: foreign.id },
        }),
      ).rejects.toThrow();
    });

    it("scan-only logo/palette/fonts remain legacy-readable and never canonical approval", async () => {
      const b = await brand();
      const observed = { colors: ["#123456"], fonts: { heading: "Observed" } };
      await prisma.brandProfile.update({
        where: { id: b.id },
        data: {
          logoUrl: "https://scan.example/logo.png",
          visualIdentity: observed,
        },
      });
      expect(await visuals.read(b.id)).toBeNull();
      const legacy = await prisma.brandProfile.findUniqueOrThrow({
        where: { id: b.id },
      });
      expect(legacy.visualIdentity).toEqual(observed);
      expect(legacy.logoUrl).toBe("https://scan.example/logo.png");
    });

    it("explicit existing Brand selection changes pointer, retains old asset, and blocks scan mirror overwrite", async () => {
      const b = await brand();
      const dna = new BrandCentreDnaService(
        db,
        {} as ParallelExtractClient,
        visuals,
      );
      await dna.patchProfile(b.id, {
        logoUrl: "https://approved.example/one.png",
      });
      const first = (await visuals.read(b.id))!.primaryLogo!;
      await prisma.brandProfile.update({
        where: { id: b.id },
        data: {
          logoUrl: "https://scan.example/new.png",
          visualIdentity: { colors: ["#000000"] },
        },
      });
      expect((await visuals.read(b.id))!.primaryLogo!.id).toBe(first.id);
      expect(
        (await prisma.brandProfile.findUniqueOrThrow({ where: { id: b.id } }))
          .logoUrl,
      ).toBe(first.url);
      await dna.patchProfile(b.id, {
        logoUrl: "https://approved.example/two.png",
      });
      const next = (await visuals.read(b.id))!;
      expect(next.primaryLogo!.id).not.toBe(first.id);
      expect(next.assets.map((item) => item.id)).toContain(first.id);
      expect(next.primaryLogo!.authority).toBe("BRAND_CONFIRMED");
      expect(next.primaryLogo!.origin).toBe("BRAND_SELECTION");
    });

    it("visual URL/label/color/font edits preserve explicit IDs and reject stale revision", async () => {
      const b = await brand();
      const a = await visuals.confirmLogo(
        b.id,
        "https://approved.example/logo.png",
        "BRAND_UPLOAD",
      );
      const edited = await visuals.saveAsset(
        b.id,
        {
          id: a.id,
          expectedRevision: a.revision,
          role: "LOGO",
          url: "https://cdn.example/new-file.png",
          label: "New label",
        },
        authority,
      );
      expect(edited.id).toBe(a.id);
      expect(
        (await prisma.brandProfile.findUniqueOrThrow({ where: { id: b.id } }))
          .logoUrl,
      ).toBe(edited.url);
      await expect(
        visuals.saveAsset(
          b.id,
          { id: a.id, expectedRevision: a.revision, role: "LOGO", url: a.url },
          authority,
        ),
      ).rejects.toThrow("REVISION_CONFLICT");
      const c = await visuals.saveColor(b.id, { value: "#aabbcc" }, authority);
      expect(
        (
          await visuals.saveColor(
            b.id,
            {
              id: c.id,
              expectedRevision: c.revision,
              value: "#123456",
              label: "Adjusted",
            },
            authority,
          )
        ).id,
      ).toBe(c.id);
      const f = await visuals.saveTypography(
        b.id,
        { family: "First Font" },
        authority,
      );
      expect(
        (
          await visuals.saveTypography(
            b.id,
            {
              id: f.id,
              expectedRevision: f.revision,
              family: "Continuous Font Edit",
            },
            authority,
          )
        ).id,
      ).toBe(f.id);
      expect(
        (await visuals.saveColor(b.id, { value: "#123456" }, authority)).id,
      ).not.toBe(c.id);
    });

    it("database enforces immutable visual identity, same-Brand primary, active logo role", async () => {
      const a = await brand();
      const b = await brand();
      const logo = await visuals.confirmLogo(
        a.id,
        "https://approved.example/logo.png",
        "BRAND_UPLOAD",
      );
      await visuals.saveColor(b.id, { value: "#123456" }, authority);
      await expect(
        prisma.brandVisualAsset.update({
          where: { id: logo.id },
          data: { id: randomUUID() },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.brandVisualState.update({
          where: { brandProfileId: b.id },
          data: { primaryLogoAssetId: logo.id },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.brandVisualAsset.update({
          where: { id: logo.id },
          data: { lifecycle: "INACTIVE" },
        }),
      ).rejects.toThrow();
      await expect(
        visuals.saveAsset(
          b.id,
          { id: logo.id, expectedRevision: 1, role: "LOGO", url: logo.url },
          authority,
        ),
      ).rejects.toThrow();
      expect((await visuals.read(b.id))!.assets).toEqual([]);
    });

    it("explicit legacy identity edit establishes palette/font approval but never promotes prior scan values", async () => {
      const b = await brand();
      await prisma.brandProfile.update({
        where: { id: b.id },
        data: { visualIdentity: { colors: ["#000000"] } },
      });
      const dna = new BrandCentreDnaService(
        db,
        {} as ParallelExtractClient,
        visuals,
      );
      await dna.patchIdentity(b.id, {
        palette: ["#123456"],
        fonts: ["Approved Heading", "Approved Body"],
      });
      const current = (await visuals.read(b.id))!;
      expect(current.colors.map((item) => item.value)).toEqual(["#123456"]);
      expect(current.typography).toHaveLength(2);
      const id = current.colors[0].id;
      await dna.patchIdentity(b.id, { palette: ["#123456"] });
      expect((await visuals.read(b.id))!.colors[0].id).toBe(id);
    });

    it("exact postal alias/reordered rescans and non-identity changes preserve Location and Offering IDs", async () => {
      const b = await brand();
      const first = await locations.reconcile(b.id, [address], "scan");
      const id = first[0].locationId!;
      const offering = await prisma.offering.create({
        data: {
          brandProfileId: b.id,
          type: "PRODUCT",
          name: "Product",
          url: "https://example.test/product",
          locationIds: [id],
        },
      });
      const second = await locations.reconcile(
        b.id,
        [
          {
            ...address,
            address: " 10  MAIN Street ",
            name: "Updated display",
            lat: 10,
          },
        ],
        "scan",
      );
      expect(second).toEqual([{ outcome: "MATCHED_EXISTING", locationId: id }]);
      expect(
        (
          await prisma.offering.findUniqueOrThrow({
            where: { id: offering.id },
          })
        ).locationIds,
      ).toEqual([id]);
      expect((await locations.read(b.id))[0].name).toBe("Updated display");
      await locations.reconcile(b.id, [], "scan");
      expect((await locations.read(b.id))[0]).toMatchObject({
        id,
        lifecycle: "ACTIVE",
        observationFreshness: "POSSIBLY_STALE",
      });
    });

    it("explicit canonical ID and persisted external identity take precedence and survive address edits", async () => {
      const b = await brand();
      const [first] = await locations.reconcile(
        b.id,
        [{ ...address, sourceId: "store-a" }],
        "owned-site",
      );
      const [second] = await locations.reconcile(
        b.id,
        [{ ...address, address: "20 New Road", sourceId: "store-a" }],
        "owned-site",
      );
      expect(second.locationId).toBe(first.locationId);
      const [third] = await locations.reconcile(
        b.id,
        [
          {
            ...address,
            locationId: first.locationId!,
            address: "30 Canonical Road",
          },
        ],
        "scan",
      );
      expect(third.locationId).toBe(first.locationId);
      expect(await locations.read(b.id)).toHaveLength(1);
    });

    it("Brand-confirmed fields and canonical lifecycle resist conflicting observation and omission", async () => {
      const b = await brand();
      const [first] = await locations.reconcile(b.id, [address], "scan");
      const id = first.locationId!;
      await prisma.location.update({
        where: { id },
        data: { authority: "BRAND_CONFIRMED", lifecycle: "INACTIVE" },
      });
      await locations.reconcile(
        b.id,
        [
          {
            ...address,
            locationId: id,
            name: "Conflicting observed",
            address: "Different address",
          },
        ],
        "scan",
      );
      const current = (await locations.read(b.id))[0];
      expect(current).toMatchObject({
        id,
        name: "Store",
        address: address.address,
        authority: "BRAND_CONFIRMED",
        lifecycle: "INACTIVE",
      });
      expect(current.lastObservation).toMatchObject({
        name: "Conflicting observed",
      });
      await locations.reconcile(b.id, [], "scan");
      expect((await locations.read(b.id))[0].lifecycle).toBe("INACTIVE");
    });

    it("duplicate-looking persisted aliases remain ambiguous; no nearest match or overwrite", async () => {
      const b = await brand();
      const records = await Promise.all(
        [1, 2].map(() =>
          prisma.location.create({
            data: { brandProfileId: b.id, ...address },
          }),
        ),
      );
      await prisma.brandLocationAlias.createMany({
        data: records.map((row) => ({
          brandProfileId: b.id,
          locationId: row.id,
          kind: "POSTAL",
          key: postalLocationAlias(address)!,
        })),
      });
      const result = await locations.reconcile(
        b.id,
        [{ ...address, name: "Must not overwrite" }],
        "scan",
      );
      expect(result).toEqual([
        { outcome: "UNRESOLVED_OR_AMBIGUOUS", locationId: null },
      ]);
      expect((await locations.read(b.id)).map((row) => row.id).sort()).toEqual(
        records.map((row) => row.id).sort(),
      );
      expect(
        (await locations.read(b.id)).every((row) => row.name === "Store"),
      ).toBe(true);
      expect(
        await prisma.brandLocationObservation.count({
          where: { brandProfileId: b.id },
        }),
      ).toBe(1);
    });

    it("distinct identified candidates get new provisional IDs; insufficient identity is unresolved", async () => {
      const b = await brand();
      const result = await locations.reconcile(
        b.id,
        [
          address,
          { ...address, address: "99 Other Street" },
          { address: "vague" },
        ],
        "scan",
      );
      expect(result.map((r) => r.outcome)).toEqual([
        "NEW_PROVISIONAL_LOCATION",
        "NEW_PROVISIONAL_LOCATION",
        "UNRESOLVED_OR_AMBIGUOUS",
      ]);
      expect(result[0].locationId).not.toBe(result[1].locationId);
      expect(
        (await locations.read(b.id)).every(
          (row) => row.authority === "OBSERVED",
        ),
      ).toBe(true);
    });

    it("cross-Brand Location ID/alias cannot match or alter a foreign row", async () => {
      const a = await brand();
      const b = await brand();
      const [first] = await locations.reconcile(a.id, [address], "scan");
      const result = await locations.reconcile(
        b.id,
        [{ ...address, locationId: first.locationId! }],
        "scan",
      );
      expect(result[0]).toEqual({
        outcome: "UNRESOLVED_OR_AMBIGUOUS",
        locationId: null,
      });
      expect(await locations.read(b.id)).toEqual([]);
      await expect(
        prisma.brandLocationAlias.create({
          data: {
            brandProfileId: b.id,
            locationId: first.locationId!,
            kind: "EXTERNAL",
            key: "cross-brand",
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.location.update({
          where: { id: first.locationId! },
          data: { id: randomUUID() },
        }),
      ).rejects.toThrow();
    });
  },
);
