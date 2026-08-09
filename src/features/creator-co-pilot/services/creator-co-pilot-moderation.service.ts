import { Injectable } from "@nestjs/common";

const OFF_DOMAIN =
  "I focus on creator business operations: media kit, analytics, deals, and payouts.";

@Injectable()
export class CreatorCoPilotModerationService {
  checkInput(
    text: string,
  ): { allowed: true } | { allowed: false; refusalNarrative: string } {
    const normalized = text.trim();
    if (!normalized) {
      return { allowed: false, refusalNarrative: OFF_DOMAIN };
    }
    if (
      /\b(ignore previous|jailbreak|api key|database schema)\b/i.test(
        normalized,
      )
    ) {
      return { allowed: false, refusalNarrative: OFF_DOMAIN };
    }
    return { allowed: true };
  }
}
