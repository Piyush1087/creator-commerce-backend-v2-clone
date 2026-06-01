import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Loads human-editable prompt assets shipped next to this file in `dist/`
 * (see `nest-cli.json` asset copy rules). Same pattern as brand-onboarding.
 */
export function loadPromptMarkdown(fileName: string): string {
  const path = join(__dirname, fileName);
  return readFileSync(path, "utf8");
}

const PROMPT_CONTRACT_MAP: Record<string, string> = {
  "deep-scan-strategy.prompt.md": "contracts/deep-scan-prompt1.contract.md",
  "intelligence-leaks.prompt.md": "contracts/intelligence-prompt2.contract.md",
  "planner-aggregator.prompt.md": "contracts/planner-prompt3.contract.md",
};

/**
 * System instruction = role prompt + machine JSON contract (when mapped).
 * Contracts live in `prompts/contracts/*.contract.md` and mirror Zod validators.
 */
export function loadBrandCentreSystemPrompt(promptFileName: string): string {
  const prompt = loadPromptMarkdown(promptFileName);
  const contractFile = PROMPT_CONTRACT_MAP[promptFileName];
  if (!contractFile) {
    return prompt;
  }
  const contractPath = join(__dirname, contractFile);
  if (!existsSync(contractPath)) {
    return prompt;
  }
  const contract = readFileSync(contractPath, "utf8");
  return `${prompt.trim()}\n\n---\n\n${contract.trim()}`;
}
