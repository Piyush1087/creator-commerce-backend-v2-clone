import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  CollaborationActorClass,
  CollaborationDeliveryDestinationSource,
  Prisma,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import {
  commandConflict,
  unauthorizedActor,
} from "../errors/collaboration-command.error";
import {
  confirmDefaultDestinationSchema,
  overrideDestinationSchema,
  type ConfirmDefaultDestinationInput,
  type OverrideDestinationInput,
} from "../schemas/collaboration-destination-command.schema";
import {
  appendCommandEvent,
  assertExpectedVersion,
  parseCommand,
  replayOrThrow,
} from "../utils/collaboration-command-support";
import { CollaborationAccessService } from "./collaboration-access.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";
import { projectCanonicalCollaborationDetail } from "../utils/collaboration-thread.mapper";

type DestinationData = {
  recipientName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  stateRegion?: string | null;
  postalCode: string;
  countryCode: string;
  phoneCountryCallingCode?: string | null;
  phoneNationalNumber?: string | null;
  phoneE164?: string | null;
  deliveryInstructions?: string | null;
};

@Injectable()
export class CollaborationDestinationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CollaborationAccessService,
    private readonly realtime: CollaborationRealtimeService,
  ) {}

  async confirmDefault(user: AuthUser, collaborationId: string, raw: unknown) {
    const input = parseCommand(confirmDefaultDestinationSchema, raw);
    return this.execute(user, collaborationId, input, async (tx, profileId) => {
      const contact = await tx.creatorShippingAddress.findFirst({
        where: {
          id: input.sourceContactId,
          creatorProfileId: profileId,
          isDefault: true,
        },
      });
      if (!contact)
        commandConflict(
          "DEFAULT_DESTINATION_NOT_FOUND",
          "Creator default destination is unavailable",
        );
      if (contact.updatedAt.toISOString() !== input.sourceContactUpdatedAt) {
        commandConflict(
          "STALE_CREATOR_DEFAULT",
          "Creator default destination changed before confirmation",
        );
      }
      return {
        sourceType: CollaborationDeliveryDestinationSource.C05_DEFAULT,
        sourceContactId: contact.id,
        sourceContactUpdatedAt: contact.updatedAt,
        destination: {
          recipientName: contact.recipientName,
          addressLine1: contact.addressLine1,
          addressLine2: contact.addressLine2,
          city: contact.city,
          stateRegion: contact.stateRegion,
          postalCode: contact.postalCode,
          countryCode: contact.countryCode,
          phoneCountryCallingCode: contact.phoneCountryCallingCode,
          phoneNationalNumber: contact.phoneNationalNumber,
          phoneE164: contact.phoneE164,
          deliveryInstructions: contact.deliveryInstructionsNarrative,
        },
      };
    });
  }

  async override(user: AuthUser, collaborationId: string, raw: unknown) {
    const input = parseCommand(overrideDestinationSchema, raw);
    return this.execute(user, collaborationId, input, async () => ({
      sourceType: CollaborationDeliveryDestinationSource.COLLABORATION_OVERRIDE,
      sourceContactId: null,
      sourceContactUpdatedAt: null,
      destination: input,
    }));
  }

  private async execute(
    user: AuthUser,
    collaborationId: string,
    input: ConfirmDefaultDestinationInput | OverrideDestinationInput,
    resolve: (
      tx: Prisma.TransactionClient,
      profileId: string,
    ) => Promise<{
      sourceType: CollaborationDeliveryDestinationSource;
      sourceContactId: string | null;
      sourceContactUpdatedAt: Date | null;
      destination: DestinationData;
    }>,
  ) {
    if (user.role !== UserRole.CREATOR)
      unauthorizedActor("Creator access required");
    const accessible = await this.access.assertThreadForUser(
      user,
      collaborationId,
      "COMMAND",
    );
    const actor = await this.access.resolveCreatorActor(
      user,
      accessible.creatorWorkspaceId ?? undefined,
    );
    const fingerprint = this.hash(input);
    await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          "DELIVERY_DESTINATION_CONFIRMED",
          fingerprint,
        )
      )
        return;
      const row = await tx.collaboration.findUniqueOrThrow({
        where: { id: collaborationId },
        include: { snapshot: true, deliveryDestination: true },
      });
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      if (!row.snapshot?.physicalDeliveryRequired) {
        commandConflict(
          "DESTINATION_NOT_REQUIRED",
          "This Collaboration has no physical delivery requirement",
          row.aggregateVersion,
        );
      }
      if (row.deliveryDestination) {
        commandConflict(
          "DESTINATION_IMMUTABLE",
          "The Collaboration destination is already confirmed",
          row.aggregateVersion,
        );
      }
      const resolved = await resolve(tx, actor.subjectCreatorProfileId);
      const contentHash = this.hash(resolved.destination);
      await tx.collaborationDeliveryDestination.create({
        data: {
          collaborationId,
          sourceType: resolved.sourceType,
          sourceContactId: resolved.sourceContactId,
          sourceContactUpdatedAt: resolved.sourceContactUpdatedAt,
          ...resolved.destination,
          destinationContentHash: contentHash,
          confirmedByUserId: actor.actorUserId,
          confirmedByMembershipId: actor.actorMembershipId,
          confirmedByRole: actor.actorRole,
        },
      });
      const updated = await tx.collaboration.updateMany({
        where: { id: collaborationId, aggregateVersion: row.aggregateVersion },
        data: { aggregateVersion: { increment: 1 } },
      });
      if (updated.count !== 1)
        commandConflict(
          "STALE_AGGREGATE_VERSION",
          "Collaboration changed during destination confirmation",
          row.aggregateVersion,
        );
      await appendCommandEvent(tx, {
        collaborationId,
        eventType: "DELIVERY_DESTINATION_CONFIRMED",
        actorClass: CollaborationActorClass.CREATOR,
        actorUserId: user.id,
        commandId: input.commandId,
        aggregateVersion: row.aggregateVersion + 1,
        requestFingerprint: fingerprint,
        payload: {
          sourceType: resolved.sourceType,
          destinationContentHash: contentHash,
        },
      });
    });
    void this.realtime.broadcast(collaborationId, "thread.updated");
    return projectCanonicalCollaborationDetail(
      await this.access.assertThreadForUser(user, collaborationId),
      "CREATOR",
    );
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
}
