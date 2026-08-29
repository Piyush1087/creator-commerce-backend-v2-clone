import { Module } from "@nestjs/common";
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
  imports: [ScheduleModule, MailModule, BrandCentreModule, BrandSettingsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationAccessService,
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
export class NotificationsModule {}
