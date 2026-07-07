import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DesignTheme, UserRole } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { CreatorCentreService } from "../../creator-centre/creator-centre.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { CreatorCoPilotSlotSessionService } from "./creator-co-pilot-slot-session.service";
import { CreatorCoPilotThreadService } from "./creator-co-pilot-thread.service";
import type { CreatorWriteIntentKind } from "./creator-co-pilot-intent.service";

export type CreatorHitlConfirmResult = {
  intent: CreatorWriteIntentKind;
  message: string;
  hitlResolution: {
    status: "CONFIRMED";
    resolvedAt: string;
    summary: string;
  };
};

@Injectable()
export class CreatorCoPilotHitlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slotSessions: CreatorCoPilotSlotSessionService,
    private readonly threads: CreatorCoPilotThreadService,
    private readonly centre: CreatorCentreService,
  ) {}

  async confirmStaged(args: {
    creatorProfileId: string;
    userId: string;
    threadId: string;
    idempotencyKey: string;
  }): Promise<CreatorHitlConfirmResult> {
    const prior = await this.threads.findHitlResolution(
      args.threadId,
      args.idempotencyKey,
    );
    if (prior?.status === "CONFIRMED") {
      throw new BadRequestException("This action was already confirmed.");
    }
    if (prior?.status === "DISCARDED") {
      throw new BadRequestException("This action was discarded.");
    }

    const session = await this.slotSessions.getActiveSession(args.threadId);
    if (!session) {
      throw new NotFoundException("No staged session for this thread.");
    }

    const staged = session.stagedPayload as Record<string, unknown>;
    if (staged.idempotencyKey !== args.idempotencyKey) {
      throw new BadRequestException(
        "Idempotency key does not match staged widget.",
      );
    }

    const intent = session.intentWorkspaceContext as CreatorWriteIntentKind;
    if (intent !== "MEDIA_KIT_UPDATE") {
      throw new BadRequestException(`Unsupported HITL intent: ${intent}`);
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: args.userId,
        role: UserRole.CREATOR,
        creatorProfile: { id: args.creatorProfileId },
      },
    });
    if (!user) {
      throw new NotFoundException("Creator user not found.");
    }

    const current = await this.prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!current) {
      throw new NotFoundException("User profile not found.");
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };

    await this.centre.saveMediaKit(authUser, {
      customBioOverride:
        (staged.customBioOverride as string | null | undefined) ??
        current.customBioOverride,
      activeTheme: current.activeTheme as DesignTheme,
      showTotalReach:
        (staged.showTotalReach as boolean | undefined) ?? current.showTotalReach,
      showEngagementRate:
        (staged.showEngagementRate as boolean | undefined) ??
        current.showEngagementRate,
      showViewsMetric:
        (staged.showViewsMetric as boolean | undefined) ??
        current.showViewsMetric,
      showRatesColumn:
        (staged.showRatesColumn as boolean | undefined) ??
        current.showRatesColumn,
      shortFormVideoRate: Number(
        staged.shortFormVideoRate ?? current.shortFormVideoRate,
      ),
      storyBundleRate: Number(
        staged.storyBundleRate ?? current.storyBundleRate,
      ),
      pastBrandLogos: current.pastBrandLogos,
      ...(typeof staged.isMediaKitPublic === "boolean"
        ? { isMediaKitPublic: staged.isMediaKitPublic as boolean }
        : {}),
    });

    await this.slotSessions.clearSession(args.threadId);

    const resolvedAt = new Date().toISOString();
    return {
      intent,
      message: "Media Kit updated successfully.",
      hitlResolution: {
        status: "CONFIRMED",
        resolvedAt,
        summary: "Media Kit rates and visibility saved.",
      },
    };
  }

  async discardStaged(args: { threadId: string; idempotencyKey: string }) {
    const session = await this.slotSessions.getActiveSession(args.threadId);
    if (!session) {
      return { ok: true };
    }

    const staged = session.stagedPayload as Record<string, unknown>;
    if (staged.idempotencyKey !== args.idempotencyKey) {
      throw new BadRequestException(
        "Idempotency key does not match staged widget.",
      );
    }

    await this.slotSessions.clearSession(args.threadId);
    return { ok: true };
  }
}
