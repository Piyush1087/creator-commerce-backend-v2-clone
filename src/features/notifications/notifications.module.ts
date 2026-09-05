import {
  forwardRef,
  Module,
  RequestMethod,
  type NestModule,
  type MiddlewareConsumer,
} from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { CreatorNotificationsController } from "./creator-notifications.controller";
import { CreatorNotificationQueryService } from "./services/creator-notification-query.service";
import { ScheduleModule } from "@nestjs/schedule";

import { MailModule } from "../../mail/mail.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandSettingsModule } from "../brand-settings/brand-settings.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationAccessService } from "./services/notification-access.service";
import { NotificationChannelService } from "./services/notification-channel.service";
import { NotificationDispatchService } from "./services/notification-dispatch.service";
import { NotificationProcessorService } from "./services/notification-processor.service";
import { NotificationQueryService } from "./services/notification-query.service";
import { NotificationWorkerService } from "./services/notification-worker.service";
import { NotificationEmailWorkerService } from "./services/notification-email-worker.service";
import { NotificationRecipientPolicyService } from "./services/notification-recipient-policy.service";

@Module({
  imports: [
    ScheduleModule,
    CreatorTeamModule,
    MailModule,
    forwardRef(() => BrandCentreModule),
    forwardRef(() => BrandSettingsModule),
  ],
  controllers: [NotificationsController, CreatorNotificationsController],
  providers: [
    NotificationAccessService,
    CreatorNotificationQueryService,
    NotificationDispatchService,
    NotificationProcessorService,
    NotificationChannelService,
    NotificationWorkerService,
    NotificationEmailWorkerService,
    NotificationRecipientPolicyService,
    NotificationQueryService,
  ],
  exports: [NotificationDispatchService, NotificationProcessorService],
})
export class NotificationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((_req: Request, res: Response, next: NextFunction) => {
        res.setHeader("Cache-Control", "private, no-store");
        res.vary("Authorization");
        res.vary("Cookie");
        next();
      })
      .forRoutes(
        { path: "api/v1/creator/notifications", method: RequestMethod.ALL },
        { path: "api/v1/creator/notifications/*", method: RequestMethod.ALL },
      );
  }
}
