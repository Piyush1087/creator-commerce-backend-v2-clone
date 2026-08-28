import { Injectable } from "@nestjs/common";

@Injectable()
export class RetryBackoffPolicy {
  eligibilityAfter(attemptNumber: number, now: Date): Date {
    const boundedExponent = Math.max(0, Math.min(attemptNumber - 1, 6));
    const delayMilliseconds = Math.min(60_000, 1_000 * 2 ** boundedExponent);
    return new Date(now.getTime() + delayMilliseconds);
  }
}
