import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { CanonicalStateManifestBuilder } from "./canonical-state-manifest";
import {
  M1CanonicalBrandStateAdapter,
  assembleCanonicalBrandStateSnapshot,
} from "./m1-canonical-brand-state.adapter";

const brandId = "00000000-0000-4000-8000-0000000000e1";
const updatedAt = new Date("2026-08-25T10:00:00.000Z");

function seed(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: brandId,
    domain: "example.com",
    name: "Example",
    logoUrl: null,
    industry: "OTHER",
    subIndustry: null,
    countryCode: "IN",
    currencyCode: "INR",
    igHandle: "example",
    ytHandle: null,
    tiktokHandle: null,
    updatedAt,
    ...overrides,
  };
}

function adapterFor(profile = seed()) {
  const findUnique = vi.fn().mockResolvedValue(profile);
  const transaction = vi.fn(async (callback, options) => ({
    result: await callback({ brandProfile: { findUnique } }),
    options,
  }));
  const prisma = {
    $transaction: vi.fn(async (callback, options) => {
      const call = await transaction(callback, options);
      return call.result;
    }),
  };
  return {
    adapter: new M1CanonicalBrandStateAdapter(prisma as never),
    prisma,
    findUnique,
    transaction,
  };
}

describe("W1.0E canonical Brand-state input", () => {
  it("reads by Brand ID only in one repeatable-read snapshot", async () => {
    const { adapter, prisma, findUnique, transaction } = adapterFor();
    const result = await adapter.read({
      brandId,
      requiredSemantics: ["brand_name", "website_url", "industry"],
    });

    expect(findUnique).toHaveBeenCalledOnce();
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: brandId } }),
    );
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.mock.calls[0]?.[1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(result.entries.map((entry) => entry.semantic).sort()).toEqual([
      "brand_name",
      "industry",
      "website_url",
    ]);
  });

  it("preserves M1 source, authority, provenance, resolution, and valid nulls", async () => {
    const { adapter } = adapterFor();
    const result = await adapter.read({
      brandId,
      requiredSemantics: [
        "brand_logo",
        "sub_industry",
        "reporting_currency",
        "youtube_handle",
      ],
    });
    const entries = Object.fromEntries(
      result.entries.map((entry) => [entry.semantic, entry]),
    );

    expect(entries.brand_logo).toMatchObject({
      value: null,
      source: "BRAND_PROFILE",
      authority: "APPLICATION_CANONICAL",
      fallbackUsed: false,
      conflictDetected: false,
    });
    expect(entries.sub_industry).toMatchObject({
      value: null,
      authority: "PROVISIONAL",
      provenanceStatus: "UNATTRIBUTED_CANONICAL_FIELD",
    });
    expect(entries.reporting_currency).toMatchObject({
      value: "INR",
      authority: "UNVERIFIED_PROVENANCE",
      resolutionStatus: "UNKNOWN_PROVENANCE",
    });
    expect(entries.youtube_handle).toMatchObject({
      value: null,
      authority: "UNVERIFIED_PROVENANCE",
    });
    expect(entries.brand_logo.businessStateReference.revisionToken).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("changes fingerprints for value, authority, or conflict changes", () => {
    const base = {
      semantic: "brand_name" as const,
      fieldPath: "$.name",
      value: "Example",
      authority: "APPLICATION_CANONICAL" as const,
      conflictDetected: false,
    };
    const snapshot = (entry: typeof base) =>
      assembleCanonicalBrandStateSnapshot(brandId, updatedAt, [entry]);
    const original = snapshot(base);
    const changedValue = snapshot({ ...base, value: "Changed" });
    const changedAuthority = snapshot({
      ...base,
      authority: "BRAND_CONFIRMED",
    });
    const changedConflict = snapshot({ ...base, conflictDetected: true });

    expect(
      new Set([
        original.entries[0].businessStateReference.revisionToken,
        changedValue.entries[0].businessStateReference.revisionToken,
        changedAuthority.entries[0].businessStateReference.revisionToken,
        changedConflict.entries[0].businessStateReference.revisionToken,
      ]),
    ).toHaveLength(4);
  });

  it("preserves candidate/conflict diagnostics without putting candidate values in manifests", () => {
    const snapshot = assembleCanonicalBrandStateSnapshot(brandId, updatedAt, [
      {
        semantic: "brand_name",
        fieldPath: "$.name",
        value: "Canonical",
        authority: "APPLICATION_CANONICAL",
        conflictDetected: true,
        candidateValue: "Conflicting candidate",
      },
    ]);
    expect(snapshot.entries[0]).toMatchObject({
      value: "Canonical",
      conflictDetected: true,
      candidateValue: "Conflicting candidate",
    });
    expect(
      JSON.stringify(new CanonicalStateManifestBuilder().build(snapshot)),
    ).not.toContain("Conflicting candidate");
  });

  it("keeps stable state deterministic while excluding values and observation time from the manifest", () => {
    const seeds = [
      {
        semantic: "brand_name" as const,
        fieldPath: "$.name",
        value: "Secret transient value",
        authority: "APPLICATION_CANONICAL" as const,
      },
    ];
    const first = assembleCanonicalBrandStateSnapshot(
      brandId,
      updatedAt,
      seeds,
      new Date("2026-08-25T11:00:00.000Z"),
    );
    const second = assembleCanonicalBrandStateSnapshot(
      brandId,
      updatedAt,
      seeds,
      new Date("2026-08-25T12:00:00.000Z"),
    );
    const builder = new CanonicalStateManifestBuilder();
    const firstManifest = builder.build(first);
    const secondManifest = builder.build(second);

    expect(first.canonicalSnapshotRef).toBe(second.canonicalSnapshotRef);
    expect(firstManifest.hash).toBe(secondManifest.hash);
    expect(JSON.stringify(firstManifest.manifest)).not.toContain(
      "Secret transient value",
    );
    expect(JSON.stringify(firstManifest.manifest)).not.toContain("observedAt");
  });
});
