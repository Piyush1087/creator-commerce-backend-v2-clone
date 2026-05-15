import { GoogleGenerativeAI } from "@google/generative-ai";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GeminiJsonClient {
  private readonly logger = new Logger(GeminiJsonClient.name);

  constructor(private readonly config: ConfigService) {}

  async generateJson(args: {
    systemInstruction: string;
    userText: string;
  }): Promise<unknown> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY", "");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const modelId = this.config.get<string>("GEMINI_MODEL", "gemini-2.0-flash");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: args.systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const timeoutMs = this.config.get<number>(
      "GEMINI_REQUEST_TIMEOUT_MS",
      120_000,
    );
    const result = await Promise.race([
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: args.userText }] }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Gemini request timed out")),
          timeoutMs,
        ),
      ),
    ]);

    const text = result.response.text();
    try {
      return JSON.parse(text) as unknown;
    } catch (err) {
      this.logger.warn(
        `Gemini returned non-JSON text=${text.slice(0, 400)} err=${String(err)}`,
      );
      throw new Error("Gemini returned invalid JSON");
    }
  }
}
