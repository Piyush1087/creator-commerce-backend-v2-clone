import { describe, expect, it, vi } from "vitest";

import { withBoundedTechnicalRetry } from "./provider-retry.util";

describe("withBoundedTechnicalRetry", () => {
  it("retries transient failures and returns the successful final result", async () => {
    const operation = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new Error("transient"))
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("complete");

    const result = await withBoundedTechnicalRetry({
      maxAttempts: 3,
      operation,
      classify: () => ({ retry: true, retryAfterMs: 0 }),
    });

    expect(result).toEqual({ value: "complete", attemptCount: 3 });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("never exceeds the hard maximum of three attempts", async () => {
    const error = new Error("still transient");
    const operation = vi.fn().mockRejectedValue(error);

    await expect(
      withBoundedTechnicalRetry({
        maxAttempts: 99,
        operation,
        classify: () => ({ retry: true, retryAfterMs: 0 }),
      }),
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-retryable failure", async () => {
    const error = new Error("schema failure");
    const operation = vi.fn().mockRejectedValue(error);

    await expect(
      withBoundedTechnicalRetry({
        maxAttempts: 3,
        operation,
        classify: () => ({ retry: false }),
      }),
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("bounds a provider-requested delay to five seconds", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValue("complete");

    const started = Date.now();
    const result = await withBoundedTechnicalRetry({
      maxAttempts: 2,
      operation,
      classify: () => ({ retry: true, retryAfterMs: 60_000 }),
    });
    const elapsedMs = Date.now() - started;

    expect(result).toEqual({ value: "complete", attemptCount: 2 });
    expect(elapsedMs).toBeGreaterThanOrEqual(4_900);
    expect(elapsedMs).toBeLessThan(7_000);
  }, 8_000);
});
