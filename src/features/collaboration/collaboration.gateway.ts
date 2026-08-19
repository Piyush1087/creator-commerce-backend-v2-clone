import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { UserRole } from "@prisma/client";
import type { Server, Socket } from "socket.io";

import { resolveJwtSecret } from "../auth/auth-jwt.config";
import type { AuthUser, JwtPayload } from "../auth/types/auth-user";
import { NotificationProcessorService } from "../notifications/services/notification-processor.service";
import { CollaborationAccessService } from "./services/collaboration-access.service";
import { CollaborationRealtimeService } from "./services/collaboration-realtime.service";

type JoinLeaveBody = {
  collaboration_id: string;
};

@WebSocketGateway({
  namespace: "/collaboration",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class CollaborationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CollaborationGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly access: CollaborationAccessService,
    private readonly realtime: CollaborationRealtimeService,
    private readonly notificationProcessor: NotificationProcessorService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attachServer(server);
    this.notificationProcessor.attachServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const user = this.authenticateSocket(client);
    if (!user) {
      client.disconnect(true);
      return;
    }
    client.data.user = user;
    await client.join(`user:${user.id}`);
    this.logger.debug(`collaboration-ws.connected userId=${user.id}`);
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user as AuthUser | undefined;
    if (user) {
      this.logger.debug(`collaboration-ws.disconnected userId=${user.id}`);
    }
  }

  @SubscribeMessage("collaboration:join")
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinLeaveBody,
  ): Promise<{ ok: boolean }> {
    const user = client.data.user as AuthUser | undefined;
    if (!user || !body?.collaboration_id) {
      return { ok: false };
    }
    await this.access.assertThreadForUser(user, body.collaboration_id);
    await client.join(`collaboration:${body.collaboration_id}`);
    return { ok: true };
  }

  @SubscribeMessage("collaboration:leave")
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinLeaveBody,
  ): Promise<{ ok: boolean }> {
    if (!body?.collaboration_id) {
      return { ok: false };
    }
    await client.leave(`collaboration:${body.collaboration_id}`);
    return { ok: true };
  }

  private authenticateSocket(client: Socket): AuthUser | null {
    const token = this.extractToken(client);
    if (!token) {
      return null;
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: resolveJwtSecret(this.config),
      });
      if (!payload?.sub || !payload.email || !payload.role) {
        return null;
      }
      if (
        payload.role !== UserRole.BRAND &&
        payload.role !== UserRole.CREATOR
      ) {
        return null;
      }
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name ?? null,
        role: payload.role,
        organizationId: payload.organizationId ?? null,
      };
    } catch {
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === "string" && auth.token.trim()) {
      return auth.token.trim().replace(/^Bearer\s+/i, "");
    }
    const header = client.handshake.headers.authorization;
    if (typeof header === "string" && header.trim()) {
      return header.trim().replace(/^Bearer\s+/i, "");
    }
    const query = client.handshake.query.token;
    if (typeof query === "string" && query.trim()) {
      return query.trim().replace(/^Bearer\s+/i, "");
    }
    return null;
  }
}
