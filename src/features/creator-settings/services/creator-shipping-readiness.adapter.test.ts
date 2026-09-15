import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../prisma/prisma.service";
import { CreatorShippingReadinessAdapter } from "./creator-shipping-readiness.adapter";

describe("Settings-owned shipping readiness", () => {
  const valid = {
    recipientName: "Synthetic recipient",
    addressLine1: "Test street",
    addressLine2: null,
    city: "Test city",
    stateRegion: null,
    postalCode: "000000",
    countryCode: "IN",
    phoneCountryCallingCode: null,
    phoneNationalNumber: null,
    deliveryInstructions: null,
  };
  it.each([
    { address: null, expected: "NEEDS_SETUP" },
    { address: valid, expected: "READY" },
    { address: { ...valid, postalCode: "" }, expected: "NEEDS_SETUP" },
    { address: { ...valid, countryCode: "ZZ" }, expected: "NEEDS_SETUP" },
  ])(
    "validates canonical contact without returning it",
    async ({ address, expected }) => {
      const findFirst = vi.fn().mockResolvedValue(address);
      const prisma = {
        creatorShippingAddress: { findFirst },
      } as unknown as PrismaService;
      const adapter = new CreatorShippingReadinessAdapter(prisma);
      expect(await adapter.readCurrent({ creatorProfileId: "subject" })).toBe(
        expected,
      );
      expect(findFirst.mock.calls[0][0].where).toEqual({
        creatorProfileId: "subject",
        isDefault: true,
      });
    },
  );
});
