import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatTelemetryService } from "./chat-telemetry.service";

describe("ChatTelemetryService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs bounded structured metadata without prompt, token, credential, or reasoning fields", () => {
    const log = vi
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
    new ChatTelemetryService().recordTurn({
      requestId: "request-1",
      conversationId: "0198f719-8b92-7000-8000-000000000001",
      brandProfileId: "brand-a",
      capabilityIds: ["brand.current.read"],
      responseStatus: "ANSWERED",
      latencyMs: 12,
      modelId: "runtime-policy-model",
      inputTokens: 10,
      outputTokens: 20,
    });
    const serialized = String(log.mock.calls[0][0]);
    expect(serialized).toContain("chat.turn");
    for (const forbidden of [
      "promptText",
      "rawModelResponse",
      "apiKey",
      "authToken",
      "providerToken",
      "chainOfThought",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("rejects attempts to smuggle sensitive raw fields into telemetry", () => {
    expect(() =>
      new ChatTelemetryService().recordTurn({
        requestId: "request-1",
        brandProfileId: "brand-a",
        capabilityIds: [],
        promptText: "secret",
      } as never),
    ).toThrow();
  });
});
