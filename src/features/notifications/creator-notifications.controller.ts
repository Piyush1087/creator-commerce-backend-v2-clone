import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { RequestWithAuthUser } from "../auth/auth.controller";
import { CreatorNotificationQueryService } from "./services/creator-notification-query.service";

@Controller("api/v1/creator/notifications")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorNotificationsController {
  constructor(private readonly query: CreatorNotificationQueryService) {}
  @Get()
  list(
    @Req() req: RequestWithAuthUser,
    @Query("unread_only") unreadOnly?: string,
    @Query("limit") limit?: string,
  ) {
    const parsed = limit === undefined ? undefined : Number(limit);
    if (
      parsed !== undefined &&
      (!Number.isInteger(parsed) || parsed < 1 || parsed > 100)
    )
      throw new BadRequestException(
        "Notification limit must be between 1 and 100",
      );
    return this.query.listForUser(req.user, {
      unread_only: unreadOnly === "true",
      limit: parsed,
    });
  }
  @Get("unread-count")
  unreadCount(@Req() req: RequestWithAuthUser) {
    return this.query.unreadCount(req.user);
  }
  @Patch(":notificationId/read")
  markRead(
    @Req() req: RequestWithAuthUser,
    @Param("notificationId") id: string,
  ) {
    return this.query.markRead(req.user, id);
  }
  @Post("mark-all-read")
  @HttpCode(200)
  markAllRead(@Req() req: RequestWithAuthUser) {
    return this.query.markAllRead(req.user);
  }
}
