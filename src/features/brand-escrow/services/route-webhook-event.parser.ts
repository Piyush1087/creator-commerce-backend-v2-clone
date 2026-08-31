import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type NormalizedRouteWebhookEvent =
  | {
      kind: "TRANSFER";
      rawEventType: string;
      objectId: string;
      providerState: string;
      onHold?: boolean;
      onHoldUntil?: Date | null;
    }
  | {
      kind: "SETTLEMENT";
      rawEventType: string;
      objectId: string;
      transferId: string;
      providerState: string;
    }
  | {
      kind: "REVERSAL";
      rawEventType: string;
      objectId: string;
      providerState: string;
    }
  | { kind: "UNKNOWN"; rawEventType: string };

type EventKind = "TRANSFER" | "SETTLEMENT" | "REVERSAL";

@Injectable()
export class RouteWebhookEventParser {
  constructor(private readonly config: ConfigService) {}

  parse(raw: unknown): NormalizedRouteWebhookEvent {
    if (!raw || typeof raw !== "object")
      return { kind: "UNKNOWN", rawEventType: "" };
    const envelope = raw as Record<string, unknown>;
    const rawEventType =
      typeof envelope.event === "string" ? envelope.event : "";
    const kind = this.eventMap()[rawEventType];
    if (!kind) return { kind: "UNKNOWN", rawEventType };
    const payload = this.record(envelope.payload);
    const entity = this.record(
      this.record(payload?.[kind.toLowerCase()])?.entity,
    );
    const objectId = this.string(entity?.id);
    const providerState = this.string(entity?.status);
    if (!entity || !objectId || !providerState)
      return { kind: "UNKNOWN", rawEventType };
    if (kind === "SETTLEMENT") {
      const transferId =
        this.string(entity.transfer_id) ?? this.string(entity.transferId);
      if (!transferId) return { kind: "UNKNOWN", rawEventType };
      return {
        kind,
        rawEventType,
        objectId,
        transferId,
        providerState,
      };
    }
    if (kind === "REVERSAL")
      return { kind, rawEventType, objectId, providerState };
    const rawUntil = entity.on_hold_until;
    return {
      kind,
      rawEventType,
      objectId,
      providerState,
      onHold: typeof entity.on_hold === "boolean" ? entity.on_hold : undefined,
      onHoldUntil:
        typeof rawUntil === "number" ? new Date(rawUntil * 1000) : undefined,
    };
  }

  private eventMap(): Record<string, EventKind> {
    const configured = this.config.get<string>(
      "RAZORPAY_ROUTE_WEBHOOK_EVENT_MAP",
      "{}",
    );
    try {
      const parsed = JSON.parse(configured) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, EventKind] =>
          ["TRANSFER", "SETTLEMENT", "REVERSAL"].includes(String(entry[1])),
        ),
      );
    } catch {
      return {};
    }
  }

  private record(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private string(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }
}
