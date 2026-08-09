import { Injectable } from "@nestjs/common";

export type ModerationResult =
  | { allowed: true }
  | { allowed: false; reason: string; refusalNarrative: string };

const OFF_DOMAIN_PATTERNS = [
  /\b(politics|election|president|war in)\b/i,
  /\b(write (me )?code|python script|javascript function)\b/i,
  /\b(hack|jailbreak|ignore (all )?previous instructions)\b/i,
  /\b(recipe|weather forecast)\b/i,
];

const SECRET_PROBE_PATTERNS = [
  /\b(matching algorithm|algo(rithm)? weights?)\b/i,
  /\b(source code|backend architecture|database schema)\b/i,
  /\b(fee formula|commission formula|internal fee)\b/i,
  /\b(how do you calculate|explain the algorithm)\b/i,
  /\b(razorpay|api key|secret key|webhook secret)\b/i,
];

const PROFANITY_PATTERNS = [/\b(f+u+c+k|sh+i+t|asshole)\b/i];

const REFUSAL_OFF_DOMAIN =
  "I am optimized exclusively for influencer marketing and platform operations on The Creator Shop. How can I assist you with your campaigns, Brand Centre, escrow, or collaborations today?";

const REFUSAL_SECRETS =
  "I cannot share internal matching weights, backend architecture, or fee formulas beyond publicly stated platform fees. I can help with read-only summaries from your brand data or stage actions for your confirmation.";

@Injectable()
export class CoPilotModerationService {
  checkInput(text: string): ModerationResult {
    const normalized = text.trim();
    if (!normalized) {
      return { allowed: false, reason: "EMPTY", refusalNarrative: REFUSAL_OFF_DOMAIN };
    }

    for (const pattern of PROFANITY_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          allowed: false,
          reason: "PROFANITY",
          refusalNarrative:
            "That message was blocked by our moderation policy. Please rephrase professionally.",
        };
      }
    }

    for (const pattern of SECRET_PROBE_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          allowed: false,
          reason: "SECRET_PROBE",
          refusalNarrative: REFUSAL_SECRETS,
        };
      }
    }

    for (const pattern of OFF_DOMAIN_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          allowed: false,
          reason: "OFF_DOMAIN",
          refusalNarrative: REFUSAL_OFF_DOMAIN,
        };
      }
    }

    return { allowed: true };
  }

  sanitizeOutput(text: string): string {
    let result = text;
    for (const pattern of SECRET_PROBE_PATTERNS) {
      if (pattern.test(result)) {
        return REFUSAL_SECRETS;
      }
    }
    return result;
  }
}
