import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { CHAT_RESPONSE_STATUSES } from "../response/chat-response.contract";

const ChatTelemetryMetadataSchema = z
  .object({
    requestId: z.string().trim().min(1).max(128),
    conversationId: z.string().uuid().optional(),
    brandProfileId: z.string().trim().min(1).max(128),
    capabilityIds: z.array(z.string().trim().min(1).max(128)).default([]),
    responseStatus: z.enum(CHAT_RESPONSE_STATUSES).optional(),
    latencyMs: z.number().int().nonnegative().optional(),
    modelId: z.string().trim().min(1).max(128).optional(),
    errorCode: z.string().trim().min(1).max(128).optional(),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
  })
  .strict();

export type ChatTelemetryMetadata = z.infer<typeof ChatTelemetryMetadataSchema>;

@Injectable()
export class ChatTelemetryService {
  private readonly logger = new Logger(ChatTelemetryService.name);

  recordTurn(metadata: ChatTelemetryMetadata): void {
    const safeMetadata = ChatTelemetryMetadataSchema.parse(metadata);
    this.logger.log(JSON.stringify({ event: "chat.turn", ...safeMetadata }));
  }
}
