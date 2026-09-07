import { describe, expect, it } from "vitest";

import { normalizeCreatorContactPhone } from "./creator-contact-phone";

describe("Creator contact phone normalization", () => {
  it("normalizes explicit international parts into E.164", () => {
    expect(normalizeCreatorContactPhone("+91", "98765 43210")).toEqual({
      countryCallingCode: "+91",
      nationalNumber: "9876543210",
      e164: "+919876543210",
    });
    expect(normalizeCreatorContactPhone("1", "(415) 555-2671")).toEqual({
      countryCallingCode: "+1",
      nationalNumber: "4155552671",
      e164: "+14155552671",
    });
  });

  it("keeps an absent phone absent without inferring legacy text", () => {
    expect(normalizeCreatorContactPhone(null, null)).toBeNull();
    expect(normalizeCreatorContactPhone("", "  ")).toBeNull();
  });

  it.each([
    ["+91", null, "supplied together"],
    [null, "9876543210", "supplied together"],
    ["+012", "9876543210", "1 to 3 digits"],
    ["+1234", "9876543210", "1 to 3 digits"],
    ["+44", "12A34", "invalid characters"],
    ["+999", "12345678901234", "maximum of 15 digits"],
  ])(
    "rejects callingCode=%s national=%s",
    (callingCode, nationalNumber, message) => {
      expect(() =>
        normalizeCreatorContactPhone(callingCode, nationalNumber),
      ).toThrow(message);
    },
  );
});
