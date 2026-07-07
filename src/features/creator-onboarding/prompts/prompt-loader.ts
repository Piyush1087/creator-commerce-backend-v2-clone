import { readFileSync } from "node:fs";
import { join } from "node:path";

export function loadCreatorOnboardingPrompt(fileName: string): string {
  const path = join(__dirname, fileName);
  return readFileSync(path, "utf8");
}
