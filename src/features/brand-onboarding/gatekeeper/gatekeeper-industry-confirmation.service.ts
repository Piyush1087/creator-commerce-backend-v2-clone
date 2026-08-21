import { BadRequestException, Injectable } from "@nestjs/common";
import { IndustryVertical } from "@prisma/client";

import type { ConfirmGatekeeperIndustryDto } from "../dto/confirm-gatekeeper-industry.dto";
import { GatekeeperPersistenceService } from "./gatekeeper-persistence.service";
import {
  SUPPORTED_MVP_INDUSTRIES,
  type GatekeeperConfirmationResult,
  type GatekeeperSurfaceHandoff,
} from "./gatekeeper-v1.types";

const SUPPORTED = new Set<IndustryVertical>(SUPPORTED_MVP_INDUSTRIES);

@Injectable()
export class GatekeeperIndustryConfirmationService {
  constructor(private readonly persistence: GatekeeperPersistenceService) {}

  async confirm(
    leadId: string,
    dto: ConfirmGatekeeperIndustryDto,
  ): Promise<GatekeeperConfirmationResult> {
    const current = await this.persistence.getGatekeeperResult(leadId);
    const assessed = current.assessment?.provisional_industry ?? null;
    if (current.decision.outcome !== "ADMITTED" || assessed == null) {
      throw new BadRequestException(
        "Industry can only be confirmed after an ADMITTED Gatekeeper result",
      );
    }
    if (dto.explicitConfirmation !== true) {
      throw new BadRequestException(
        "Explicit Industry confirmation is required",
      );
    }

    const selected = dto.selectedIndustry;
    const selectedSupported = SUPPORTED.has(selected);
    const differs = selected !== assessed;
    const confirmation = selectedSupported
      ? {
          assessed_industry: assessed,
          confirmed_industry: selected,
          confirmation_source: differs
            ? ("USER_CONFIRMED_OVERRIDE" as const)
            : ("AI_ASSESSED_ACCEPTED" as const),
          industry_disagreement_flag: differs,
          surface_eligible: true,
        }
      : {
          assessed_industry: assessed,
          confirmed_industry: selected,
          confirmation_source: "USER_CONFIRMED_UNSUPPORTED" as const,
          industry_disagreement_flag: false,
          surface_eligible: false,
        };

    const gatekeeper = {
      ...current,
      decision: selectedSupported
        ? {
            outcome: "ADMITTED" as const,
            reason_code: null,
            recovery_actions: ["CONTINUE" as const],
            manual_review_eligible: false,
          }
        : {
            outcome: "UNSUPPORTED" as const,
            reason_code: "UNSUPPORTED_INDUSTRY" as const,
            recovery_actions: [
              "JOIN_WAITLIST" as const,
              "REQUEST_CLASSIFICATION_REVIEW" as const,
            ],
            manual_review_eligible: true,
          },
      confirmation,
      handoff: {
        ...current.handoff,
        confirmed_industry_required: false,
      },
    };
    const surfaceHandoff: GatekeeperSurfaceHandoff | null = selectedSupported
      ? {
          normalized_url: gatekeeper.submission.normalized_url,
          normalized_domain: gatekeeper.submission.normalized_domain,
          confirmed_industry: selected,
          gatekeeper_completed: true,
          ...(gatekeeper.assessment?.provisional_sub_industry
            ? {
                provisional_sub_industry:
                  gatekeeper.assessment.provisional_sub_industry,
              }
            : {}),
        }
      : null;

    await this.persistence.persistConfirmation(leadId, gatekeeper);
    return {
      leadId,
      gatekeeper_result: gatekeeper,
      surface_handoff: surfaceHandoff,
    };
  }
}
