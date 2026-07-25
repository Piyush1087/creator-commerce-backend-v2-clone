import { GoogleGenerativeAI, type ResponseSchema } from "@google/generative-ai";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GeminiJsonClient {
  private readonly logger = new Logger(GeminiJsonClient.name);

  constructor(private readonly config: ConfigService) {}

  async generateJson(args: {
    systemInstruction: string;
    userText: string;
    /** OpenAPI-style schema; use `zodToGeminiResponseSchema` from brand-centre prompts. */
    responseSchema?: ResponseSchema;
    /** Overrides GEMINI_MODEL for callers with a dedicated model env (e.g. gatekeeper). */
    modelId?: string;
    temperature?: number;
  }): Promise<unknown> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY", "");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const modelId =
      args.modelId?.trim() ||
      this.config.get<string>("GEMINI_MODEL", "gemini-2.5-flash");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: args.systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: args.temperature ?? 0.2,
        ...(args.responseSchema ? { responseSchema: args.responseSchema } : {}),
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

  async generateText(args: {
    systemInstruction: string;
    userText: string;
    temperature?: number;
  }): Promise<string> {
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
        temperature: args.temperature ?? 0.2,
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

    return result.response.text();
  }
}
