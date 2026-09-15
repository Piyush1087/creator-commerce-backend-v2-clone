import { Injectable, BadRequestException } from "@nestjs/common";
import type { AuthUser } from "../../auth/types/auth-user";
import { PrismaCreatorPayoutReadinessService } from "../../brand-payouts/services/prisma-creator-payout-readiness.service";
import { WorkPreferencesConsumerSchema } from "../contracts/commercial-consumer.contract";
import { WorkPreferencesMutationSchema } from "../contracts/work-preferences.contract";
import { WorkPreferencesRepository } from "./work-preferences.repository";

@Injectable()
export class WorkPreferencesService {
  constructor(
    private readonly repository: WorkPreferencesRepository,
    private readonly payouts: PrismaCreatorPayoutReadinessService,
  ) {}
  async read(user: AuthUser) {
    return this.project(await this.repository.read(user));
  }
  async mutate(user: AuthUser, input: unknown) {
    const command = WorkPreferencesMutationSchema.safeParse(input);
    if (!command.success)
      throw new BadRequestException({
        code: "WORK_PREFERENCES_INVALID_COMMAND",
        issues: command.error.issues.map((issue) => ({
          path: issue.path,
          code: issue.code,
        })),
      });
    return this.project(await this.repository.mutate(user, command.data));
  }
  private async project(
    result: Awaited<ReturnType<WorkPreferencesRepository["read"]>>,
  ) {
    let payout: "READY" | "NEEDS_SETUP" | "PROVIDER_REVIEW" | "UNAVAILABLE" =
      "UNAVAILABLE";
    // Readiness dependency failure is an explicit UNAVAILABLE projection; manual
    // canonical preferences and bank-country authority remain independently usable.
    try {
      const current = await this.payouts.readCurrent({
        creatorProfileId: result.actor.subjectCreatorProfileId,
      });
      if (current.creatorProfileId === result.actor.subjectCreatorProfileId) {
        if (
          current.setupStatus === "READY" &&
          current.providerStatus === "READY"
        )
          payout = "READY";
        else if (
          current.providerStatus === "UNDER_REVIEW" ||
          current.providerStatus === "IN_PROGRESS"
        )
          payout = "PROVIDER_REVIEW";
        else if (
          current.providerStatus !== "UNKNOWN" &&
          current.providerStatus !== "BLOCKED" &&
          current.setupStatus !== "UNKNOWN" &&
          current.blockingReasonCode !== "UNSUPPORTED_GEOGRAPHY_OR_RAIL"
        )
          payout = "NEEDS_SETUP";
      }
    } catch {
      payout = "UNAVAILABLE";
    }
    return WorkPreferencesConsumerSchema.parse({
      contractVersion: "creator-work-preferences-v0.1",
      state: result.values ? "CONFIGURED" : "UNCONFIGURED",
      currentRevision: result.revision,
      values: result.values,
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
      readiness: { shipping: result.shipping, payout, kyc: "COMING_SOON" },
      country: result.country,
    });
  }
}
