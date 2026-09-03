import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ServerClient } from "postmark";

import { MailService } from "./mail.service";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: "POSTMARK_CLIENT",
      useFactory: (configService: ConfigService) => {
        const apiToken = configService
          .get<string>("POSTMARK_SERVER_TOKEN")
          ?.trim();
        if (
          !apiToken ||
          /placeholder|replace-me|not-for-deploy/i.test(apiToken)
        ) {
          throw new Error("POSTMARK_SERVER_TOKEN is not configured");
        }
        for (const names of [
          ["POSTMARK_OTP_TEMPLATE_ID", "POSTMARK_AUTH_OTP_TEMPLATE_ID"],
          ["POSTMARK_PASSWORD_RESET_TEMPLATE_ID"],
        ]) {
          const configured = names.some((name) => {
            const id = Number(configService.get<string>(name));
            return Number.isSafeInteger(id) && id > 0;
          });
          if (!configured) {
            throw new Error(`${names[0]} is not configured`);
          }
        }
        return new ServerClient(apiToken);
      },
      inject: [ConfigService],
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
