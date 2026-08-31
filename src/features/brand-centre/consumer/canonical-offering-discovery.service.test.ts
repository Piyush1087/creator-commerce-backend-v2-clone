import { randomUUID } from "node:crypto";
import { OfferingKind, OfferingLifecycle } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import type { BrandCentreAuthService } from "../brand-centre-auth.service";
import { CanonicalOfferingIndexResponseSchema } from "./canonical-offering-discovery.schema";
import { CanonicalOfferingDiscoveryService } from "./canonical-offering-discovery.service";

const user: AuthUser = {
  id: randomUUID(),
  organizationId: randomUUID(),
  role: "BRAND",
  email: "discovery@example.test",
  name: "Discovery",
};

function fixture(rows: readonly Record<string, unknown>[]) {
  const resolveBrandProfileId = vi.fn().mockResolvedValue("brand-a");
  const findMany = vi.fn().mockResolvedValue(rows);
  const service = new CanonicalOfferingDiscoveryService(
    { resolveBrandProfileId } as unknown as BrandCentreAuthService,
    { offering: { findMany } } as unknown as PrismaService,
  );
  return { service, resolveBrandProfileId, findMany };
}

describe("canonical Offering discovery", () => {
  it("returns only strict canonical identity fields in repository order", async () => {
    const productId = randomUUID();
    const treatmentId = randomUUID();
    const { service, resolveBrandProfileId, findMany } = fixture([
      {
        id: productId,
        name: "Product",
        canonicalKind: OfferingKind.PRODUCT,
        canonicalSubtype: null,
        canonicalLifecycle: OfferingLifecycle.ACTIVE,
      },
      {
        id: treatmentId,
        name: "Treatment",
        canonicalKind: OfferingKind.SERVICE,
        canonicalSubtype: "TREATMENT",
        canonicalLifecycle: OfferingLifecycle.DRAFT_INCOMPLETE,
      },
    ]);

    await expect(service.list(user)).resolves.toEqual({
      offerings: [
        {
          offeringId: productId,
          name: "Product",
          kind: "PRODUCT",
          subtype: null,
          lifecycle: "ACTIVE",
        },
        {
          offeringId: treatmentId,
          name: "Treatment",
          kind: "SERVICE",
          subtype: "TREATMENT",
          lifecycle: "DRAFT_INCOMPLETE",
        },
      ],
    });
    expect(resolveBrandProfileId).toHaveBeenCalledWith(user);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        brandProfileId: "brand-a",
        canonicalKind: { not: null },
        canonicalLifecycle: { not: null },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        canonicalKind: true,
        canonicalSubtype: true,
        canonicalLifecycle: true,
      },
    });
  });

  it("returns an empty collection without synthesizing records", async () => {
    const { service, findMany } = fixture([]);
    await expect(service.list(user)).resolves.toEqual({ offerings: [] });
    expect(findMany).toHaveBeenCalledOnce();
  });

  it("fails closed if persistence violates the resolved-state predicate", async () => {
    const { service } = fixture([
      {
        id: randomUUID(),
        name: "Unresolved",
        canonicalKind: null,
        canonicalSubtype: null,
        canonicalLifecycle: null,
      },
    ]);
    await expect(service.list(user)).rejects.toThrow(
      "Canonical Offering discovery returned unresolved state",
    );
  });

  it("rejects legacy, intelligence, runtime, price, and unresolved fields", () => {
    expect(
      CanonicalOfferingIndexResponseSchema.safeParse({
        offerings: [
          {
            offeringId: randomUUID(),
            name: "Invalid",
            kind: "MODULE",
            subtype: null,
            lifecycle: "UNRESOLVED",
            canonicalPrice: { state: "UNAVAILABLE" },
            processorRuntime: {},
            intelligence: {},
            isDeepScanned: true,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
