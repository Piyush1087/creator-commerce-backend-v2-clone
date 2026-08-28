import { describe, expect, it } from "vitest";

import {
  credentialFingerprint,
  extractProviderHttpStatus,
  extractProviderMessage,
  sanitizeProviderMessage,
} from "./provider-error-diagnostics.util";

describe("provider error diagnostics", () => {
  it("fingerprints a present credential without exposing the secret", () => {
    expect(credentialFingerprint("AQ.secret-value-here")).toEqual({
      present: true,
      fingerprint: "len=20,suffix=here",
    });
    expect(credentialFingerprint("")).toEqual({
      present: false,
      fingerprint: "missing",
    });
  });

  it("redacts API key material from provider messages", () => {
    expect(
      sanitizeProviderMessage(
        'Incorrect API key provided: sk-proj-abc123. Bearer xyz Authorization: sk-proj-abc123',
      ),
    ).toContain("sk-[redacted]");
    expect(
      sanitizeProviderMessage("key AQ.Ab8RN6KEUQF5IAgzS4wrUKtix9ZWGSwsftO1"),
    ).toContain("AQ.[redacted]");
  });

  it("extracts Google-style nested status and message", () => {
    const error = Object.assign(new Error("wrapper"), {
      status: 403,
      error: {
        code: 403,
        message: "Requests from this IP address are not allowed.",
        status: "PERMISSION_DENIED",
      },
    });
    expect(extractProviderHttpStatus(error)).toBe(403);
    expect(extractProviderMessage(error)).toBe(
      "Requests from this IP address are not allowed.",
    );
  });

  it("extracts a JSON error blob from the Error message", () => {
    const error = new Error(
      '{"error":{"code":401,"message":"API key not valid. Please pass a valid API key.","status":"UNAUTHENTICATED"}}',
    );
    expect(extractProviderMessage(error)).toBe(
      "API key not valid. Please pass a valid API key.",
    );
  });
});
