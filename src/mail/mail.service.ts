import { Inject, Injectable, Logger } from "@nestjs/common";
import { ServerClient } from "postmark";

import { resolveNotificationTemplateIdFromEnv } from "../features/notifications/config/notification-postmark-env";

/** ANSI colors for Postmark logs in dev terminals (request vs response vs error). */
const MAIL_LOG = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
} as const;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject("POSTMARK_CLIENT")
    private readonly postmarkClient: ServerClient,
  ) {}

  async sendOtp(email: string, otp: string, displayName: string) {
    const templateIdRaw = process.env.POSTMARK_OTP_TEMPLATE_ID;
    if (!templateIdRaw) {
      throw new Error("POSTMARK_OTP_TEMPLATE_ID is not configured");
    }

    const templateId = parseInt(templateIdRaw, 10);
    const payload = {
      From: "no-reply@thecreatorshop.in",
      To: email,
      TemplateId: templateId,
      TemplateModel: {
        name: displayName,
        otp: "[redacted in mail log]",
      },
      MessageStream: "outbound" as const,
    };

    this.logger.log(
      `${MAIL_LOG.cyan}[Postmark] SEND OTP${MAIL_LOG.reset} ` +
        `${MAIL_LOG.dim}to=${email} templateId=${templateId} stream=${payload.MessageStream} name=${displayName}${MAIL_LOG.reset}`,
    );
    this.logger.debug(
      `${MAIL_LOG.dim}[Postmark] template model keys: name, otp (otp value omitted from mail logs)${MAIL_LOG.reset}`,
    );

    try {
      const response = await this.postmarkClient.sendEmailWithTemplate({
        From: payload.From,
        To: email,
        TemplateId: templateId,
        TemplateModel: {
          name: displayName,
          otp,
        },
        MessageStream: payload.MessageStream,
      });

      this.logger.log(
        `${MAIL_LOG.green}[Postmark] SEND OK${MAIL_LOG.reset} ` +
          `MessageID=${response.MessageID ?? "n/a"} ` +
          `SubmittedAt=${response.SubmittedAt ?? "n/a"} ` +
          `To=${response.To ?? email} ` +
          `ErrorCode=${response.ErrorCode ?? 0}`,
      );

      return response;
    } catch (error: unknown) {
      const err = error as {
        statusCode?: number;
        message?: string;
        code?: number;
      };
      const isInactive =
        err.statusCode === 422 &&
        typeof err.message === "string" &&
        err.message.toLowerCase().includes("inactive");
      const color = isInactive ? MAIL_LOG.yellow : MAIL_LOG.red;
      const label = isInactive ? "SEND BLOCKED (inactive)" : "SEND FAILED";

      this.logger.warn(
        `${color}[Postmark] ${label}${MAIL_LOG.reset} ` +
          `to=${email} templateId=${templateId} ` +
          `statusCode=${err.statusCode ?? "n/a"} code=${err.code ?? "n/a"} ` +
          `message=${err.message ?? String(error)} — ` +
          `${MAIL_LOG.dim}verification flow still returns success; use BrandVerificationService OTP log${MAIL_LOG.reset}`,
      );
      throw error;
    }
  }

  async sendNotificationEmail(args: {
    to: string;
    eventType: string;
    templateModel: {
      name: string;
      title: string;
      body: string;
      action_url: string;
      event_type: string;
    };
  }) {
    const templateId = resolveNotificationTemplateIdFromEnv(args.eventType);
    const from =
      process.env.POSTMARK_NOTIFICATION_FROM ?? "no-reply@thecreatorshop.in";
    const payload = {
      From: from,
      To: args.to,
      TemplateId: templateId,
      TemplateModel: args.templateModel,
      MessageStream: "outbound" as const,
    };

    this.logger.log(
      `${MAIL_LOG.cyan}[Postmark] SEND NOTIFICATION${MAIL_LOG.reset} ` +
        `${MAIL_LOG.dim}to=${args.to} templateId=${templateId} event=${args.eventType}${MAIL_LOG.reset}`,
    );

    try {
      const response = await this.postmarkClient.sendEmailWithTemplate({
        From: payload.From,
        To: args.to,
        TemplateId: templateId,
        TemplateModel: args.templateModel,
        MessageStream: payload.MessageStream,
      });

      this.logger.log(
        `${MAIL_LOG.green}[Postmark] NOTIFICATION OK${MAIL_LOG.reset} ` +
          `MessageID=${response.MessageID ?? "n/a"} To=${response.To ?? args.to}`,
      );

      return response;
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message?: string };
      this.logger.warn(
        `${MAIL_LOG.red}[Postmark] NOTIFICATION FAILED${MAIL_LOG.reset} ` +
          `to=${args.to} event=${args.eventType} ` +
          `statusCode=${err.statusCode ?? "n/a"} message=${err.message ?? String(error)}`,
      );
      throw error;
    }
  }
}
