import { IntelligenceExecutionError } from "./intelligence-execution.error";

export async function executionErrorBoundary<T>(
  operation: () => Promise<T>,
  safeMessage: string,
  preserve?: (error: unknown) => boolean,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof IntelligenceExecutionError || preserve?.(error)) {
      throw error;
    }
    throw new IntelligenceExecutionError(
      "INVALID_EXECUTION_STATE",
      safeMessage,
    );
  }
}
