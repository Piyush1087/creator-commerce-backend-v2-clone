import { buildPrompt, type PromptBuilderInput } from "../prompt_builder/prompt_builder";
import type { PromptBuilderPort } from "./types";

export class IntelligencePromptBuilderAdapter implements PromptBuilderPort {
  build(input: PromptBuilderInput) {
    return buildPrompt(input);
  }
}
