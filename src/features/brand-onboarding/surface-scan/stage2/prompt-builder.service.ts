import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Phase 6 Prompt Builder — concatenates core + developer + contract templates
 * and appends the runtime context payload for Gemini.
 */
@Injectable()
export class PromptBuilderService {
  private readonly logger = new Logger(PromptBuilderService.name);

  async buildPrompt(
    promptFolder: string,
    runtimeContext: unknown,
  ): Promise<string> {
    const base = join(
      __dirname,
      "..",
      "..",
      "prompts",
      "surface",
      promptFolder,
    );
    const files = ["core.md", "developer.md", "contract.md"] as const;
    let parts: string[];
    try {
      parts = await Promise.all(
        files.map((name) => readFile(join(base, name), "utf8")),
      );
    } catch (err) {
      this.logger.error(
        `prompt-builder.missing_templates folder=${promptFolder} err=${err instanceof Error ? err.message : String(err)}`,
      );
      throw new InternalServerErrorException(
        `Prompt templates missing for folder "${promptFolder}".`,
      );
    }

    return [
      parts[0],
      parts[1],
      parts[2],
      "",
      "### RUNTIME CONTEXT DATA PAYLOAD",
      "",
      JSON.stringify(runtimeContext, null, 2),
    ].join("\n\n");
  }
}
