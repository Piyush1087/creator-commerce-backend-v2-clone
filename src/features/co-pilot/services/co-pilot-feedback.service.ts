import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CoPilotFeedbackRating } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class CoPilotFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submitFeedback(args: {
    brandProfileId: string;
    userId: string;
    threadId: string;
    messageId: string;
    rating: CoPilotFeedbackRating;
    reason?: string;
  }) {
    const message = await this.prisma.coPilotMessage.findFirst({
      where: {
        id: args.messageId,
        threadId: args.threadId,
        role: "ASSISTANT",
        thread: { brandProfileId: args.brandProfileId },
      },
    });

    if (!message) {
      throw new NotFoundException("Assistant message not found in this thread.");
    }

    const existing = await this.prisma.coPilotMessageFeedback.findUnique({
      where: { messageId: args.messageId },
    });
    if (existing) {
      throw new ConflictException("Feedback already submitted for this message.");
    }

    return this.prisma.coPilotMessageFeedback.create({
      data: {
        messageId: args.messageId,
        threadId: args.threadId,
        brandProfileId: args.brandProfileId,
        userId: args.userId,
        rating: args.rating,
        reason: args.reason?.trim() || null,
      },
    });
  }
}
