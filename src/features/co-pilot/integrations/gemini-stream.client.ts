import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

@Injectable()
export class GeminiStreamClient {
  constructor(private readonly config: ConfigService) {}

  async *streamText(args: {
    systemInstruction: string;
    userText: string;
  }): AsyncGenerator<string> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY", "");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const modelId = this.config.get<string>("GEMINI_MODEL", "gemini-2.5-flash");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: args.systemInstruction,
      generationConfig: {
        temperature: 0.3,
      },
    });

    const timeoutMs = this.config.get<number>(
      "GEMINI_REQUEST_TIMEOUT_MS",
      120_000,
    );

    const result = await Promise.race([
      model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: args.userText }] }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Gemini stream timed out")),
          timeoutMs,
        ),
      ),
    ]);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }
}
