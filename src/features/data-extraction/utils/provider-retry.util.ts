import { setTimeout as sleep } from "node:timers/promises";

export type RetryDecision = {
  retry: boolean;
  retryAfterMs?: number;
};

export async function withBoundedTechnicalRetry<T>(args: {
  maxAttempts: number;
  operation: (attempt: number) => Promise<T>;
  classify: (error: unknown) => RetryDecision;
}): Promise<{ value: T; attemptCount: number }> {
  const maxAttempts = Math.max(1, Math.min(args.maxAttempts, 3));
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await args.operation(attempt);
      return { value, attemptCount: attempt };
    } catch (error) {
      lastError = error;
      const decision = args.classify(error);
      if (!decision.retry || attempt >= maxAttempts) {
        throw error;
      }
      const delayMs = Math.max(
        0,
        Math.min(decision.retryAfterMs ?? 250 * 2 ** (attempt - 1), 5_000),
      );
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}
