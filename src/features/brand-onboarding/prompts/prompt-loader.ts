import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Loads human-editable prompt assets shipped next to this file in `dist/`
 * (see `nest-cli.json` asset copy rules).
 */
export function loadPromptMarkdown(fileName: string): string {
  const path = join(__dirname, fileName);
  return readFileSync(path, "utf8");
}
