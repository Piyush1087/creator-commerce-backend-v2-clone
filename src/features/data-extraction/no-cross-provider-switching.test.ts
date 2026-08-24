import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

async function providerSource(relativeUrl: string): Promise<string> {
  return readFile(resolve(__dirname, relativeUrl), "utf8");
}

describe("Data Extraction provider isolation", () => {
  it("keeps Gemini isolated from Parallel and OpenAI", async () => {
    const source = await providerSource(
      "./providers/gemini-gatekeeper.provider.ts",
    );

    expect(source).not.toMatch(
      /ParallelCompanyResearchProvider|OpenAIStructuredProvider/,
    );
  });

  it("keeps Parallel isolated from OpenAI", async () => {
    const source = await providerSource(
      "./providers/parallel-company-research.provider.ts",
    );

    expect(source).not.toMatch(/OpenAIStructuredProvider/);
  });

  it("keeps OpenAI isolated from Gemini and Parallel", async () => {
    const source = await providerSource(
      "./providers/openai-structured.provider.ts",
    );

    expect(source).not.toMatch(
      /GeminiGatekeeperProvider|ParallelCompanyResearchProvider/,
    );
  });
});
