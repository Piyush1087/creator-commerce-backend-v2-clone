import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailService } from "../../../mail/mail.service";
import {
  getEventDefinition,
  resolveDeepLinkPath,
} from "../config/notification-event-registry";

@Injectable()
export class NotificationChannelService {
  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async deliverEmail(args: {
    targetEmail: string;
    recipientName: string | null;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<{ MessageID?: string }> {
    const definition = getEventDefinition(args.eventType);
    if (!definition)
      throw new Error(`Unknown notification event: ${args.eventType}`);
    const path = resolveDeepLinkPath(definition.deepLinkPath, args.payload);
    const base =
      this.config.get<string>("APP_FRONTEND_URL") ?? "http://localhost:5173";
    const actionUrl = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    return this.mail.sendNotificationEmail({
      to: args.targetEmail,
      eventType: definition.eventType,
      templateModel: {
        name: args.recipientName ?? args.targetEmail,
        title: definition.title,
        body: `You have a new notification: ${definition.eventType}.`,
        action_url: actionUrl,
        event_type: definition.eventType,
      },
    });
  }
}
