import { Injectable, Logger } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { Server } from "socket.io";

import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CollaborationRealtimeEventType,
  CollaborationRealtimePayload,
} from "../types/collaboration-realtime.types";

@Injectable()
export class CollaborationRealtimeService {
  private readonly logger = new Logger(CollaborationRealtimeService.name);
  private server: Server | null = null;

  constructor(private readonly prisma: PrismaService) {}

  attachServer(server: Server): void {
    this.server = server;
    this.logger.log("collaboration-realtime.server-attached");
  }

  async broadcast(
    collaborationId: string,
    type: CollaborationRealtimeEventType,
  ): Promise<void> {
    if (!this.server) {
      return;
    }

    const payload: CollaborationRealtimePayload = {
      type,
      collaboration_id: collaborationId,
      at: new Date().toISOString(),
    };

    this.server
      .to(`collaboration:${collaborationId}`)
      .emit("collaboration:event", payload);

    const collab = await this.prisma.collaboration.findUnique({
      where: { id: collaborationId },
      select: {
        creatorUserId: true,
        brandProfile: { select: { organizationId: true } },
      },
    });
    if (!collab) {
      return;
    }

    this.server
      .to(`user:${collab.creatorUserId}`)
      .emit("collaboration:inbox", payload);

    if (collab.brandProfile.organizationId) {
      const brandUsers = await this.prisma.user.findMany({
        where: {
          organizationId: collab.brandProfile.organizationId,
          role: UserRole.BRAND,
        },
        select: { id: true },
      });
      for (const user of brandUsers) {
        this.server.to(`user:${user.id}`).emit("collaboration:inbox", payload);
      }
    }
  }
}
