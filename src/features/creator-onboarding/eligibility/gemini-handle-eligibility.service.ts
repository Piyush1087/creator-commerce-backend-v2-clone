import { Injectable, Logger } from "@nestjs/common";

import { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { loadCreatorOnboardingPrompt } from "../prompts/prompt-loader";
import { HandleEligibilityGeminiSchema } from "./handle-eligibility-gemini.schema";
import type { HandleEligibilityResult } from "./handle-eligibility.types";

@Injectable()
export class GeminiHandleEligibilityService {
  private readonly logger = new Logger(GeminiHandleEligibilityService.name);

  constructor(private readonly gemini: GeminiJsonClient) {}

  async evaluateHandle(
    instagramHandle: string,
  ): Promise<HandleEligibilityResult> {
    try {
      const systemInstruction = loadCreatorOnboardingPrompt(
        "handle-eligibility.prompt.md",
      );
      const userText = `Input Handle: @${instagramHandle}`;
      const raw = await this.gemini.generateJson({
        systemInstruction,
        userText,
      });
      const parsed = HandleEligibilityGeminiSchema.safeParse(raw);
      if (!parsed.success) {
        this.logger.warn(
          `handle eligibility invalid_json handle=${instagramHandle}`,
        );
        return this.rejectedFallback();
      }
      return parsed.data;
    } catch (err) {
      this.logger.warn(
        `handle eligibility failed handle=${instagramHandle} err=${String(err)}`,
      );
      return this.rejectedFallback();
    }
  }

  private rejectedFallback(): HandleEligibilityResult {
    return {
      is_approved: false,
      eligibility_score: 0,
      percentile_rank: 0,
      detected_vertical: "UNKNOWN",
    };
  }
}
