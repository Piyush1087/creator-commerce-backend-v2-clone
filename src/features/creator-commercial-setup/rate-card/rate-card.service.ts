import { Injectable, BadRequestException } from "@nestjs/common";
import type { AuthUser } from "../../auth/types/auth-user";
import { RateCardConsumerSchema } from "../contracts/commercial-consumer.contract";
import { RateCardMutationSchema } from "../contracts/rate-card.contract";
import { RateCardPersistence } from "./rate-card.persistence";
@Injectable()
export class RateCardService {
  constructor(private readonly repository: RateCardPersistence) {}
  async read(user: AuthUser) {
    return this.project(await this.repository.read(user));
  }
  async mutate(user: AuthUser, input: unknown) {
    const command = RateCardMutationSchema.safeParse(input);
    if (!command.success)
      throw new BadRequestException({
        code: "RATE_CARD_INVALID_COMMAND",
        issues: command.error.issues.map((issue) => ({
          path: issue.path,
          code: issue.code,
        })),
      });
    return this.project(await this.repository.mutate(user, command.data));
  }
  private project(result: Awaited<ReturnType<RateCardPersistence["read"]>>) {
    return RateCardConsumerSchema.parse({
      contractVersion: "creator-rate-card-v0.1",
      state: result.state,
      currentRevision: result.revision,
      values: result.values,
      country: result.country,
      context: {
        role: result.actor.actorRole,
        allowedActions: result.actor.allowedActions.filter((action) =>
          [
            "COMMERCIAL_SETUP_READ",
            "WORK_PREFERENCES_EDIT",
            "RATE_CARD_EDIT",
          ].includes(action),
        ),
        sourceIndependent: true,
      },
      workPreferences: result.workPreferences,
    });
  }
}
