import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type Mapping = {
  eventTypePath: string;
  events: Record<
    string,
    {
      outcome:
        | "SUCCEEDED"
        | "TERMINAL_REJECTION"
        | "RETRYABLE_FAILURE"
        | "AMBIGUOUS";
      refundIdPath: string;
      providerStatePath?: string;
    }
  >;
};

export type ParsedBrandReturnWebhookEvent =
  | { kind: "UNKNOWN" }
  | {
      kind:
        | "SUCCEEDED"
        | "TERMINAL_REJECTION"
        | "RETRYABLE_FAILURE"
        | "AMBIGUOUS";
      rawEventType: string;
      providerRefundId: string;
      providerState: string;
    };

@Injectable()
export class BrandReturnWebhookEventParser {
  constructor(private readonly config: ConfigService) {}

  parse(raw: unknown): ParsedBrandReturnWebhookEvent {
    const mapping = this.mapping();
    if (!mapping?.eventTypePath || !Object.keys(mapping.events).length) {
      return { kind: "UNKNOWN" };
    }
    const rawEventType = this.readString(raw, mapping.eventTypePath);
    if (!rawEventType) return { kind: "UNKNOWN" };
    const event = mapping.events[rawEventType];
    if (!event?.refundIdPath) return { kind: "UNKNOWN" };
    const providerRefundId = this.readString(raw, event.refundIdPath);
    if (!providerRefundId) return { kind: "UNKNOWN" };
    return {
      kind: event.outcome,
      rawEventType,
      providerRefundId,
      providerState:
        (event.providerStatePath
          ? this.readString(raw, event.providerStatePath)
          : null) ?? rawEventType,
    };
  }

  private mapping(): Mapping | null {
    const raw = this.config.get<string>(
      "RAZORPAY_BRAND_RETURN_WEBHOOK_EVENT_MAP",
      "{}",
    );
    try {
      const parsed = JSON.parse(raw) as Partial<Mapping>;
      if (
        typeof parsed.eventTypePath !== "string" ||
        typeof parsed.events !== "object" ||
        !parsed.events
      ) {
        return null;
      }
      return parsed as Mapping;
    } catch {
      return null;
    }
  }

  private readString(value: unknown, path: string): string | null {
    let current: unknown = value;
    for (const segment of path.split(".").filter(Boolean)) {
      if (typeof current !== "object" || current === null) return null;
      current = (current as Record<string, unknown>)[segment];
    }
    return typeof current === "string" && current.trim() ? current : null;
  }
}
