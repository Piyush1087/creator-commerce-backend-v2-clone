import { ConflictException, ForbiddenException } from "@nestjs/common";

export type CollaborationCommandErrorCode =
  | "INVALID_STAGE"
  | "INVALID_STATE"
  | "STALE_AGGREGATE_VERSION"
  | "NEGOTIATION_ALREADY_LOCKED"
  | "COUNTER_OFFER_ALREADY_USED"
  | "UNAUTHORIZED_ACTOR"
  | "FUNDING_NOT_CONFIRMED"
  | "INSUFFICIENT_SECURED_AMOUNT"
  | "MANUAL_PAYMENT_DISABLED"
  | "CREATOR_CONFIRMATION_REQUIRED"
  | "PAYMENT_DISPUTED"
  | "COMMAND_ID_REUSED";

export function commandConflict(
  code: CollaborationCommandErrorCode,
  message: string,
  aggregateVersion?: number,
): never {
  throw new ConflictException({ code, message, aggregateVersion });
}

export function unauthorizedActor(message: string): never {
  throw new ForbiddenException({ code: "UNAUTHORIZED_ACTOR", message });
}
