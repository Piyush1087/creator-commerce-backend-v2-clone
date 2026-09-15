import { Injectable, BadRequestException } from "@nestjs/common";
import type { AuthUser } from "../auth/types/auth-user";
import { CreatorBrandRepository } from "./creator-brand.repository";
import {
  CreatorBrandConsumerSchema,
  CreatorBrandManualRequestSchema,
} from "./dto/creator-brand-consumer.schema";
import { CREATOR_BRAND_ACTIONS } from "./contracts/creator-brand-profile.contract";

@Injectable()
export class CreatorBrandService {
  constructor(private readonly repository: CreatorBrandRepository) {}
  async read(user: AuthUser) {
    return this.project(await this.repository.read(user));
  }
  async mutate(user: AuthUser, input: unknown) {
    const command = CreatorBrandManualRequestSchema.safeParse(input);
    if (!command.success)
      throw new BadRequestException({
        code: "CREATOR_BRAND_INVALID_COMMAND",
        issues: command.error.issues.map((issue) => ({
          path: issue.path,
          code: issue.code,
        })),
      });
    return this.project(await this.repository.mutate(user, command.data));
  }
  private project(result: Awaited<ReturnType<CreatorBrandRepository["read"]>>) {
    return CreatorBrandConsumerSchema.parse({
      contractVersion: "creator-brand-v0.1",
      identity: result.identity,
      state: result.values ? "CONFIGURED" : "UNCONFIGURED",
      profile: result.values,
      currentRevision: result.revision,
      context: {
        role: result.actor.actorRole,
        allowedActions: CREATOR_BRAND_ACTIONS.filter((action) =>
          result.actor.allowedActions.includes(action),
        ),
        manualFirst: true,
        sourceIndependent: true,
      },
      suggestions: { state: "NOT_IMPLEMENTED" },
    });
  }
}
