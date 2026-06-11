import { Injectable } from "@nestjs/common";

import type { GeoContext } from "../types";

@Injectable()
export class GeoRoutingService {
  resolveGeoContext(countryCode: string | null | undefined): GeoContext {
    const normalizedCode = (countryCode ?? "US").toUpperCase();

    switch (normalizedCode) {
      case "IN":
        return {
          zone: "ZONE_IN",
          currency: "INR",
          complianceWarning:
            "RBI e-Mandate Rule: Enforce 24-hour pre-debit notifications.",
        };
      case "US":
        return {
          zone: "ZONE_US",
          currency: "USD",
        };
      default:
        return {
          zone: "ZONE_ROW",
          currency: "USD",
          complianceWarning:
            "Cross-Border FX Warning: Settle variance margins inside a 4-hour window.",
        };
    }
  }
}
