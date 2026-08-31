import { Inject, Injectable, Logger } from "@nestjs/common";
import { Models, ServerClient } from "postmark";

import { resolveNotificationTemplateIdFromEnv } from "../features/notifications/config/notification-postmark-env";

export type AuthMailDeliveryClassification = "REJECTED" | "DELIVERY_UNKNOWN";

export class AuthMailDeliveryError extends Error {
  constructor(readonly classification: AuthMailDeliveryClassification) {
    super("Authentication email dispatch failed");
    this.name = "AuthMailDeliveryError";
  }
}

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

  async sendAuthenticationOtp(args: {
    to: string;
    code: string;
    displayName: string;
    expiresInMinutes: number;
  }): Promise<string> {
    const templateId = this.requiredTemplateId("POSTMARK_AUTH_OTP_TEMPLATE_ID");
    return this.sendAuthenticationMessage(() =>
      this.postmarkClient.sendEmailWithTemplate({
        From: process.env.POSTMARK_AUTH_FROM ?? "no-reply@thecreatorshop.in",
        To: args.to,
        TemplateId: templateId,
        TemplateModel: {
          name: args.displayName,
          otp: args.code,
          expires_in_minutes: args.expiresInMinutes,
        },
        MessageStream: process.env.POSTMARK_AUTH_MESSAGE_STREAM ?? "outbound",
        TrackLinks: Models.LinkTrackingOptions.None,
        TrackOpens: false,
      }),
    );
  }

  async sendPasswordReset(args: {
    to: string;
    rawToken: string;
    displayName: string;
    expiresInMinutes: number;
  }): Promise<string> {
    const templateId = this.requiredTemplateId(
      "POSTMARK_PASSWORD_RESET_TEMPLATE_ID",
    );
    const frontend = process.env.APP_FRONTEND_URL?.trim();
    if (!frontend) throw new Error("APP_FRONTEND_URL is not configured");
    const url = new URL("/reset-password", frontend);
    url.hash = new URLSearchParams({ token: args.rawToken }).toString();
    return this.sendAuthenticationMessage(() =>
      this.postmarkClient.sendEmailWithTemplate({
        From: process.env.POSTMARK_AUTH_FROM ?? "no-reply@thecreatorshop.in",
        To: args.to,
        TemplateId: templateId,
        TemplateModel: {
          name: args.displayName,
          reset_url: url.toString(),
          expires_in_minutes: args.expiresInMinutes,
        },
        MessageStream: process.env.POSTMARK_AUTH_MESSAGE_STREAM ?? "outbound",
        TrackLinks: Models.LinkTrackingOptions.None,
        TrackOpens: false,
      }),
    );
  }

  async sendTeamInvitation(args: {
    email: string;
    brandName: string;
    role: string;
    expiresAt: Date;
    rawToken: string;
  }): Promise<void> {
    const configuredId = process.env.POSTMARK_TEAM_INVITE_TEMPLATE_ID;
    const templateId = Number(configuredId);
    const frontend = process.env.APP_FRONTEND_URL;
    if (
      !configuredId ||
      !Number.isSafeInteger(templateId) ||
      templateId <= 0 ||
      !frontend
    ) {
      throw new Error(
        "Team invitation mail configuration is missing or invalid",
      );
    }
    const origin = new URL(frontend);
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password
    ) {
      throw new Error("APP_FRONTEND_URL must be an HTTP(S) origin");
    }
    const link = new URL("/brand/team-invitations/accept", origin);
    // A fragment keeps the bearer token out of frontend HTTP/access logs.
    link.hash = new URLSearchParams({ token: args.rawToken }).toString();
    try {
      const response = await this.postmarkClient.sendEmailWithTemplate({
        From: "no-reply@thecreatorshop.in",
        To: args.email,
        TemplateId: templateId,
        TemplateModel: {
          brand_name: args.brandName,
          invited_role: args.role,
          expires_at: args.expiresAt.toISOString(),
          acceptance_url: link.toString(),
        },
        MessageStream: "outbound",
        TrackLinks: Models.LinkTrackingOptions.None,
        TrackOpens: false,
      });
      if (response.ErrorCode !== 0)
        throw new Error("Provider rejected invitation");
    } catch {
      // Provider errors can echo the URL/template. Never log or rethrow them.
      throw new Error("Team invitation email dispatch failed");
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

  /** Legacy onboarding callers; delegates to the canonical auth OTP path. */
  async sendOtp(
    to: string,
    code: string,
    displayName: string,
    expiresInMinutes = 10,
  ): Promise<string> {
    return this.sendAuthenticationOtp({
      to,
      code,
      displayName,
      expiresInMinutes,
    });
  }

  private requiredTemplateId(name: string): number {
    const value = Number(process.env[name]);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${name} is missing or invalid`);
    }
    return value;
  }

  private async sendAuthenticationMessage(
    send: () => Promise<{ ErrorCode: number; MessageID: string }>,
  ): Promise<string> {
    try {
      const response = await send();
      if (response.ErrorCode !== 0) {
        throw new AuthMailDeliveryError("REJECTED");
      }
      if (!response.MessageID) {
        throw new AuthMailDeliveryError("DELIVERY_UNKNOWN");
      }
      return response.MessageID;
    } catch (error: unknown) {
      if (error instanceof AuthMailDeliveryError) throw error;
      const statusCode = (error as { statusCode?: number })?.statusCode;
      throw new AuthMailDeliveryError(
        typeof statusCode === "number" && statusCode >= 400 && statusCode < 500
          ? "REJECTED"
          : "DELIVERY_UNKNOWN",
      );
    }
  }
}
