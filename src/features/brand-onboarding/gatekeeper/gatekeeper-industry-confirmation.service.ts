import { BadRequestException, Injectable } from "@nestjs/common";
import { IndustryVertical } from "@prisma/client";

import type {
  GatekeeperIndustryConfirmation,
  GatekeeperStructuredResult,
} from "./gatekeeper-v1.types";
import { SUPPORTED_MVP_INDUSTRIES } from "./gatekeeper-v1.types";

const SUPPORTED = new Set<IndustryVertical>(SUPPORTED_MVP_INDUSTRIES);

@Injectable()
export class GatekeeperIndustryConfirmationService {
  confirm(args: {
    gatekeeper: GatekeeperStructuredResult;
    selectedIndustry: IndustryVertical;
  }): GatekeeperIndustryConfirmation {
    if (
      args.gatekeeper.decision.outcome !== "ADMITTED" ||
      args.gatekeeper.assessment?.provisional_industry == null
    ) {
      throw new BadRequestException(
        "Industry can only be confirmed after an ADMITTED Gatekeeper result",
      );
    }

    const assessedIndustry = args.gatekeeper.assessment.provisional_industry;
    const differs = assessedIndustry !== args.selectedIndustry;
    const surfaceEligible = SUPPORTED.has(args.selectedIndustry);

    return {
      assessedIndustry,
      confirmedIndustry: args.selectedIndustry,
      differsFromAssessment: differs,
      operationalReviewFlag: differs && surfaceEligible,
      surfaceEligible,
      surfaceHandoff: surfaceEligible
        ? {
            normalized_url: args.gatekeeper.submission.normalized_url,
            normalized_domain: args.gatekeeper.submission.normalized_domain,
            confirmed_industry: args.selectedIndustry,
            gatekeeper_completed: true,
            ...(args.gatekeeper.assessment.provisional_sub_industry
              ? {
                  provisional_sub_industry:
                    args.gatekeeper.assessment.provisional_sub_industry,
                }
              : {}),
          }
        : null,
    };
  }
}
