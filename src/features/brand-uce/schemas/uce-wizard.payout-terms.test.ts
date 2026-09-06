import { describe, expect, it } from "vitest";

import { UcePayoutTermsSchema } from "./uce-wizard.schema";

describe("UcePayoutTermsSchema", () => {
  it.each(["NET_7", "NET_15", "NET_30", "NET_45", "NET_60"])(
    "accepts canonical Campaign term %s without normalization",
    (term) => {
      expect(UcePayoutTermsSchema.parse(term)).toBe(term);
    },
  );
});
