import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export type BusinessGeographyFinancialPolicy = {
  countryCode: "IN";
  policyVersion: "IN-MVP-2026-01";
  platformCommissionGstRate: Prisma.Decimal;
  escrowSupported: true;
  creatorWithholdingEnabled: false;
};

@Injectable()
export class BusinessGeographyFinancialPolicyService {
  resolve(
    countryCode: string | null | undefined,
  ): BusinessGeographyFinancialPolicy {
    if (countryCode?.toUpperCase() !== "IN") {
      throw new BadRequestException(
        "No frozen Collaboration financial policy exists for this Brand business country",
      );
    }
    return {
      countryCode: "IN",
      policyVersion: "IN-MVP-2026-01",
      platformCommissionGstRate: new Prisma.Decimal(18),
      escrowSupported: true,
      creatorWithholdingEnabled: false,
    };
  }
}
