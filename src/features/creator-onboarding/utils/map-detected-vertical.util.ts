import { IndustryVertical } from "@prisma/client";

import type { HandleEligibilityResult } from "../eligibility/handle-eligibility.types";

export function mapDetectedVertical(
  vertical: HandleEligibilityResult["detected_vertical"],
): IndustryVertical {
  switch (vertical) {
    case "D2C":
      return IndustryVertical.D2C;
    case "SAAS_AI":
      return IndustryVertical.SAAS_AI;
    case "HEALTHCARE":
      return IndustryVertical.HEALTHCARE;
    case "MEDIA":
      return IndustryVertical.MEDIA;
    case "ENTERTAINMENT":
      return IndustryVertical.ENTERTAINMENT;
    default:
      return IndustryVertical.UNKNOWN;
  }
}
