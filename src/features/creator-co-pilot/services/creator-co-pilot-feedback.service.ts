import { Injectable, NotFoundException } from "@nestjs/common";
import { CoPilotFeedbackRating } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class CreatorCoPilotFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(args: {
    creatorProfileId: string;
    userId: string;
    messageId: string;
    threadId: string;
    rating: CoPilotFeedbackRating;
    reason?: string;
  }) {
    const message = await this.prisma.creatorCoPilotMessage.findFirst({
      where: { id: args.messageId, threadId: args.threadId },
    });
    if (!message) {
      throw new NotFoundException("Message not found");
    }

    return this.prisma.creatorCoPilotMessageFeedback.upsert({
      where: { messageId: args.messageId },
      create: {
        messageId: args.messageId,
        threadId: args.threadId,
        creatorProfileId: args.creatorProfileId,
        userId: args.userId,
        rating: args.rating,
        reason: args.reason,
      },
      update: {
        rating: args.rating,
        reason: args.reason,
      },
    });
  }
}
