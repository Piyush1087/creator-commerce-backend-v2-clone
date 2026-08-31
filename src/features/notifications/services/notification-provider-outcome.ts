export type NotificationProviderFailure = {
  disposition: "RETRYABLE" | "TERMINAL" | "AMBIGUOUS";
  diagnostic: string;
};

export function classifyNotificationProviderFailure(
  error: unknown,
  providerSendStarted: boolean,
): NotificationProviderFailure {
  const value = error as {
    statusCode?: number;
    code?: number | string;
    message?: string;
  };
  const message = value?.message ?? String(error);
  if (!providerSendStarted) {
    return {
      disposition: "TERMINAL",
      diagnostic: `NOTIFICATION_CONFIGURATION_FAILURE: ${message}`,
    };
  }
  if (typeof value?.statusCode === "number") {
    if (value.statusCode === 429 || value.statusCode >= 500) {
      return {
        disposition: "RETRYABLE",
        diagnostic: `POSTMARK_REJECTED_RETRYABLE: ${message}`,
      };
    }
    if (value.statusCode >= 400 && value.statusCode < 500) {
      return {
        disposition: "TERMINAL",
        diagnostic: `POSTMARK_REJECTED_TERMINAL: ${message}`,
      };
    }
  }
  return {
    disposition: "AMBIGUOUS",
    diagnostic: `AMBIGUOUS_PROVIDER_RESULT: ${message}`,
  };
}
