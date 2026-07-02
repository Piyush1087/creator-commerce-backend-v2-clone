import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../co-pilot/pipes/zod-validation.pipe";
import {
  markNotificationReadSchema,
  testEmitNotificationSchema,
} from "./schemas/notifications.schema";
import { getEventDefinition } from "./config/notification-event-registry";
import type { NotificationEventType } from "./types/notifications.types";
import { NotificationAccessService } from "./services/notification-access.service";
import { NotificationDispatchService } from "./services/notification-dispatch.service";
import { NotificationQueryService } from "./services/notification-query.service";

@Controller("api/v1/brand/notifications")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly query: NotificationQueryService,
    private readonly dispatch: NotificationDispatchService,
    private readonly access: NotificationAccessService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(
    @Req() req: RequestWithAuthUser,
    @Query("unread_only") unreadOnly?: string,
    @Query("limit") limit?: string,
  ) {
    return this.query.listForUser(req.user, {
      unread_only: unreadOnly === "true",
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("unread-count")
  unreadCount(@Req() req: RequestWithAuthUser) {
    return this.query.unreadCount(req.user);
  }

  @Patch(":notificationId/read")
  @UsePipes(new ZodValidationPipe(markNotificationReadSchema))
  markRead(
    @Req() req: RequestWithAuthUser,
    @Param("notificationId") notificationId: string,
    @Body() body: { is_read?: boolean },
  ) {
    return this.query.markRead(req.user, notificationId, body.is_read ?? true);
  }

  @Post("mark-all-read")
  @HttpCode(HttpStatus.OK)
  markAllRead(@Req() req: RequestWithAuthUser) {
    return this.query.markAllRead(req.user);
  }

  @Post("test-emit")
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ZodValidationPipe(testEmitNotificationSchema))
  async testEmit(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof testEmitNotificationSchema.parse>,
  ) {
    const enabled =
      this.config.get<string>("NOTIFICATIONS_DEV_EMIT_ENABLED") === "true" ||
      this.config.get<string>("STAGE") === "local";

    if (!enabled) {
      throw new ForbiddenException(
        "Test emit is disabled. Set NOTIFICATIONS_DEV_EMIT_ENABLED=true or run with STAGE=local.",
      );
    }

    const { brandProfileId } = await this.access.resolveBrandWorkspace(req.user);
    const definition = getEventDefinition(body.event_type);
    if (!definition) {
      throw new ForbiddenException(`Unknown event type: ${body.event_type}`);
    }

    return this.dispatch.dispatch({
      workspaceId: body.workspace_id ?? brandProfileId,
      eventType: body.event_type as NotificationEventType,
      urgencyLevel: definition.urgencyLevel,
      payload: body.payload ?? {},
      actorName: body.actor_name ?? null,
      triggerUserId: body.trigger_user_id ?? req.user.id,
    });
  }
}
