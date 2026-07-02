import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  SettingsNotificationCategory,
  SettingsNotificationChannel,
} from "@prisma/client";

import { MailService } from "../../../mail/mail.service";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  getEventDefinition,
  resolveDeepLinkPath,
} from "../config/notification-event-registry";
import type {
  NotificationEventType,
  NotificationPayload,
} from "../types/notifications.types";
import { formatAggregationSummary } from "../utils/notification-aggregation.util";

type ChannelMember = {
  userId: string;
  email: string;
  name: string | null;
};

@Injectable()
export class NotificationChannelService {
  private readonly logger = new Logger(NotificationChannelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async isInAppEnabled(
    workspaceId: string,
    category?: SettingsNotificationCategory,
  ): Promise<boolean> {
    if (!category) {
      return true;
    }

    const rows = await this.prisma.brandNotificationSetting.findMany({
      where: { brandProfileId: workspaceId, category },
    });

    return this.isChannelEnabled(rows, "IN_APP", true);
  }

  async deliverChannels(args: {
    workspaceId: string;
    notificationId: string;
    eventType: NotificationEventType;
    payload: NotificationPayload;
    members: ChannelMember[];
    skipEmail?: boolean;
  }): Promise<void> {
    const definition = getEventDefinition(args.eventType);
    if (!definition) {
      return;
    }

    const settings = await this.loadChannelSettings(
      args.workspaceId,
      definition.settingsCategory,
    );

    const actionUrl = this.buildActionUrl(
      resolveDeepLinkPath(definition.deepLinkPath, args.payload),
    );
    const title = this.buildTitle(definition.title, args.payload);
    const body = this.buildBody(args.eventType, args.payload);

    if (definition.email && !args.skipEmail && settings.emailEnabled) {
      await this.sendEmails({
        members: args.members,
        eventType: args.eventType,
        title,
        body,
        actionUrl,
        notificationId: args.notificationId,
      });
    }

    if (settings.slackWebhookUrl) {
      await this.sendSlack(settings.slackWebhookUrl, title, body, actionUrl);
    }
  }

  private async loadChannelSettings(
    workspaceId: string,
    category?: SettingsNotificationCategory,
  ) {
    if (!category) {
      return { emailEnabled: true, slackWebhookUrl: null as string | null };
    }

    const rows = await this.prisma.brandNotificationSetting.findMany({
      where: { brandProfileId: workspaceId, category },
    });

    const emailEnabled = this.isChannelEnabled(rows, "EMAIL", true);
    const slackEnabled = this.isChannelEnabled(rows, "SLACK_WEBHOOK", false);
    const slackRow = rows.find((row) => row.channel === "SLACK_WEBHOOK");

    return {
      emailEnabled,
      slackWebhookUrl:
        slackEnabled && slackRow?.slackWebhookUrl
          ? slackRow.slackWebhookUrl
          : null,
    };
  }

  private isChannelEnabled(
    rows: Array<{ channel: SettingsNotificationChannel; isEnabled: boolean }>,
    channel: SettingsNotificationChannel,
    defaultWhenMissing: boolean,
  ): boolean {
    const row = rows.find((item) => item.channel === channel);
    if (!row) {
      return defaultWhenMissing;
    }
    return row.isEnabled;
  }

  private buildActionUrl(path: string): string {
    const frontendBase =
      this.config.get<string>("APP_FRONTEND_URL") ?? "http://localhost:5173";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${frontendBase.replace(/\/$/, "")}${normalizedPath}`;
  }

  private buildTitle(baseTitle: string, payload: NotificationPayload): string {
    const campaignName = payload.campaign_name;
    if (typeof campaignName === "string" && campaignName.length > 0) {
      return `${baseTitle}: ${campaignName}`;
    }
    return baseTitle;
  }

  private buildBody(
    eventType: NotificationEventType,
    payload: NotificationPayload,
  ): string {
    const summary = formatAggregationSummary(payload);
    const campaignName =
      typeof payload.campaign_name === "string" ? payload.campaign_name : null;
    const creatorHandle =
      typeof payload.creator_handle === "string"
        ? payload.creator_handle
        : null;

    if (payload._aggregation) {
      return `${summary} triggered ${eventType}${campaignName ? ` in ${campaignName}` : ""}.`;
    }

    if (creatorHandle) {
      return `${creatorHandle} — ${eventType}${campaignName ? ` (${campaignName})` : ""}.`;
    }

    return `You have a new notification: ${eventType}.`;
  }

  private async sendEmails(args: {
    members: ChannelMember[];
    eventType: NotificationEventType;
    title: string;
    body: string;
    actionUrl: string;
    notificationId: string;
  }): Promise<void> {
    for (const member of args.members) {
      try {
        await this.mail.sendNotificationEmail({
          to: member.email,
          eventType: args.eventType,
          templateModel: {
            name: member.name ?? member.email,
            title: args.title,
            body: args.body,
            action_url: args.actionUrl,
            event_type: args.eventType,
          },
        });

        await this.prisma.notificationRecipient.updateMany({
          where: {
            notificationId: args.notificationId,
            userId: member.userId,
          },
          data: { isEmailed: true },
        });
      } catch (error: unknown) {
        this.logger.warn(
          `notification.email.failed userId=${member.userId} notificationId=${args.notificationId} error=${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private async sendSlack(
    webhookUrl: string,
    title: string,
    body: string,
    actionUrl: string,
  ): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${title}\n${body}\n${actionUrl}`,
        }),
      });
      if (!response.ok) {
        this.logger.warn(
          `notification.slack.failed status=${response.status} url=${webhookUrl}`,
        );
      }
    } catch (error: unknown) {
      this.logger.warn(
        `notification.slack.failed error=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
