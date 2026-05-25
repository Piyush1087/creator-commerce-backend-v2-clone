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
        const apiToken = configService.get<string>("POSTMARK_SERVER_TOKEN");
        if (!apiToken) {
          throw new Error("POSTMARK_SERVER_TOKEN is not configured");
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
