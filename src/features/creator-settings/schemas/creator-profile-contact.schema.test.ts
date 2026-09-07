import { describe, expect, it } from "vitest";

import {
  UpdateCreatorCanonicalProfileSchema,
  UpsertCreatorDefaultContactSchema,
} from "./creator-profile-contact.schema";

describe("Creator profile/contact input contracts", () => {
  it("normalizes canonical geography and nullable text", () => {
    const parsed = UpsertCreatorDefaultContactSchema.parse({
      recipientName: "  Ava Creator  ",
      addressLine1: "  18 Long International Address Road  ",
      addressLine2: "",
      city: "  Bengaluru ",
      stateRegion: " Karnataka ",
      postalCode: " 560001 ",
      countryCode: "in",
      phoneCountryCallingCode: "+91",
      phoneNationalNumber: "98765 43210",
      deliveryInstructions: "  Reception desk, west entrance.  ",
    });

    expect(parsed).toMatchObject({
      recipientName: "Ava Creator",
      addressLine1: "18 Long International Address Road",
      addressLine2: null,
      countryCode: "IN",
      phoneNationalNumber: "98765 43210",
    });
  });

  it("rejects unassigned country codes and incomplete phone pairs", () => {
    const base = {
      recipientName: "Ava Creator",
      addressLine1: "18 Address Road",
      city: "Bengaluru",
      postalCode: "560001",
      countryCode: "IN",
    };

    expect(
      UpsertCreatorDefaultContactSchema.safeParse({
        ...base,
        countryCode: "ZZ",
      }).success,
    ).toBe(false);
    expect(
      UpsertCreatorDefaultContactSchema.safeParse({
        ...base,
        phoneCountryCallingCode: "+91",
      }).success,
    ).toBe(false);
  });

  it("accepts only canonical profile fields", () => {
    expect(
      UpdateCreatorCanonicalProfileSchema.parse({
        userName: "Ava Creator",
        displayName: "Ava Creates",
        avatarUrl: "https://cdn.example.test/avatar.png",
        primaryRegion: "us",
        organizationName: "Ava Studio",
      }),
    ).toMatchObject({ primaryRegion: "US" });

    expect(
      UpdateCreatorCanonicalProfileSchema.safeParse({
        organizationDisplayName: "Legacy workspace label",
      }).success,
    ).toBe(false);
  });
});
