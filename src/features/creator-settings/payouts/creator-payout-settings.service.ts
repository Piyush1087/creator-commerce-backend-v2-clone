import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreatorPayeeType, CreatorPayoutDestinationType } from "@prisma/client";

import { encryptField } from "../../../shared/crypto/field-encryption.util";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import type {
  CreatorLegalProfileInput,
  CreatorPayoutDestinationInput,
} from "./creator-payout-settings.schema";
import {
  CREATOR_PAYOUT_ENCRYPTION_KEY_VERSION,
  CREATOR_PAYOUT_READINESS_INVALIDATOR,
  CREATOR_PAYOUT_SETTINGS_REPOSITORY,
} from "./creator-payout-settings.types";
import type {
  CreatorLegalProfileRecord,
  CreatorPayoutDestinationRecord,
  CreatorPayoutReadinessInvalidator,
  CreatorPayoutSettingsRepository,
} from "./creator-payout-settings.types";

export const CREATOR_SUPPORTED_PAYOUT_RAILS = [
  {
    country_code: "IN",
    currency_code: "INR",
    destination_type: "BANK_ACCOUNT",
  },
  { country_code: "IN", currency_code: "INR", destination_type: "UPI" },
  {
    country_code: "US",
    currency_code: "USD",
    destination_type: "BANK_ACCOUNT",
  },
  { country_code: "US", currency_code: "USD", destination_type: "PAYPAL" },
] as const;

@Injectable()
export class CreatorPayoutSettingsService {
  constructor(
    @Inject(CREATOR_PAYOUT_SETTINGS_REPOSITORY)
    private readonly repository: CreatorPayoutSettingsRepository,
    @Inject(CREATOR_PAYOUT_READINESS_INVALIDATOR)
    private readonly readiness: CreatorPayoutReadinessInvalidator,
  ) {}

  async getSettings(actor: CreatorWorkspaceActorContext) {
    assertCreatorSettingsAction(actor, "PAYOUT_SETTINGS_READ");
    assertCreatorSettingsAction(actor, "LEGAL_PROFILE_READ");
    const [destination, legalProfile] = await Promise.all([
      this.repository.findPrimaryDestination(actor.subjectCreatorProfileId),
      this.repository.findLegalProfile(actor.subjectCreatorProfileId),
    ]);
    return {
      actor_role: actor.actorRole,
      can_manage: canManageCreatorPayoutSettings(actor),
      supported_rails: CREATOR_SUPPORTED_PAYOUT_RAILS,
      destination: destination ? mapDestination(destination) : null,
      legal_profile: legalProfile ? mapLegalProfile(legalProfile) : null,
      verification: {
        authority: "DEFERRED_TO_MVP_V2",
        provider_status: null,
      },
    };
  }

  async replaceDestination(
    actor: CreatorWorkspaceActorContext,
    input: CreatorPayoutDestinationInput,
  ) {
    assertCreatorSettingsAction(actor, "PAYOUT_SETTINGS_MANAGE");
    const legalProfile = await this.repository.findLegalProfile(
      actor.subjectCreatorProfileId,
    );
    if (!legalProfile) {
      throw new BadRequestException({
        code: "CREATOR_LEGAL_PROFILE_REQUIRED",
        message:
          "Complete the legal profile before adding a payout destination.",
      });
    }
    if (
      legalProfile.countryCode !== input.countryCode ||
      legalProfile.payeeType !== input.payeeType
    ) {
      throw new BadRequestException({
        code: "CREATOR_PAYOUT_LEGAL_PROFILE_MISMATCH",
        message:
          "The payout destination country and payee type must match the legal profile.",
      });
    }

    const secretPayloadEncrypted = encryptField(
      JSON.stringify(buildSecretPayload(input)),
    );
    const maskedDisplay = buildMaskedDisplay(input);

    // Fail closed: invalidate existing readiness before changing the canonical
    // destination. If the subsequent save fails, no stale ready state survives.
    await this.readiness.invalidateReadiness(
      actor.subjectCreatorProfileId,
      "LINKED_ACCOUNT_REPLACED",
    );
    const destination = await this.repository.replacePrimaryDestination({
      creatorProfileId: actor.subjectCreatorProfileId,
      payeeType: input.payeeType as CreatorPayeeType,
      beneficiaryName: input.beneficiaryName,
      destinationType: input.destinationType as CreatorPayoutDestinationType,
      countryCode: input.countryCode,
      currencyCode: input.currencyCode,
      secretPayloadEncrypted,
      encryptionKeyVersion: CREATOR_PAYOUT_ENCRYPTION_KEY_VERSION,
      maskedDisplay,
      isPrimary: true,
    });
    return { destination: mapDestination(destination) };
  }

  async disableDestination(
    actor: CreatorWorkspaceActorContext,
    destinationId: string,
  ) {
    assertCreatorSettingsAction(actor, "PAYOUT_SETTINGS_MANAGE");
    await this.readiness.invalidateReadiness(
      actor.subjectCreatorProfileId,
      "LINKED_ACCOUNT_REPLACED",
    );
    const destination = await this.repository.disablePrimaryDestination(
      actor.subjectCreatorProfileId,
      destinationId,
    );
    if (!destination) {
      throw new NotFoundException({
        code: "CREATOR_PAYOUT_DESTINATION_NOT_FOUND",
        message: "The active payout destination was not found.",
      });
    }
    return { destination: mapDestination(destination) };
  }

  async upsertLegalProfile(
    actor: CreatorWorkspaceActorContext,
    input: CreatorLegalProfileInput,
  ) {
    assertCreatorSettingsAction(actor, "LEGAL_PROFILE_MANAGE");
    const destination = await this.repository.findPrimaryDestination(
      actor.subjectCreatorProfileId,
    );
    if (
      destination &&
      (destination.countryCode !== input.countryCode ||
        destination.payeeType !== input.payeeType)
    ) {
      throw new BadRequestException({
        code: "CREATOR_LEGAL_PROFILE_PAYOUT_MISMATCH",
        message:
          "Disable the current payout destination before changing its country or payee type.",
      });
    }

    await this.readiness.invalidateReadiness(
      actor.subjectCreatorProfileId,
      "IDENTITY_CHANGED",
    );
    const profile = await this.repository.upsertLegalProfile({
      creatorProfileId: actor.subjectCreatorProfileId,
      payeeType: input.payeeType as CreatorPayeeType,
      legalName: input.legalName,
      countryCode: input.countryCode,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      stateRegion: input.stateRegion,
      postalCode: input.postalCode,
    });
    return { legal_profile: mapLegalProfile(profile) };
  }
}

type RequiredCreatorSettingsAction =
  | "PAYOUT_SETTINGS_READ"
  | "PAYOUT_SETTINGS_MANAGE"
  | "LEGAL_PROFILE_READ"
  | "LEGAL_PROFILE_MANAGE";

function assertCreatorSettingsAction(
  actor: CreatorWorkspaceActorContext,
  action: RequiredCreatorSettingsAction,
): void {
  if (
    actor.actorRole === "ASSISTANT" ||
    !actor.allowedActions.includes(action)
  ) {
    throw new ForbiddenException({
      code: "CREATOR_PAYOUT_SETTINGS_FORBIDDEN",
      message: "Creator payout and legal settings access is not permitted.",
    });
  }
}

function canManageCreatorPayoutSettings(
  actor: CreatorWorkspaceActorContext,
): boolean {
  return (
    (actor.actorRole === "OWNER" || actor.actorRole === "MANAGER") &&
    actor.allowedActions.includes("PAYOUT_SETTINGS_MANAGE") &&
    actor.allowedActions.includes("LEGAL_PROFILE_MANAGE")
  );
}

function buildSecretPayload(input: CreatorPayoutDestinationInput) {
  switch (input.destinationType) {
    case "BANK_ACCOUNT":
      return {
        accountNumber: input.accountNumber,
        routingCode: input.routingCode,
      };
    case "UPI":
      return { upiId: input.upiId };
    case "PAYPAL":
      return { paypalEmail: input.paypalEmail };
  }
}

function buildMaskedDisplay(input: CreatorPayoutDestinationInput): string {
  switch (input.destinationType) {
    case "BANK_ACCOUNT":
      return `Bank account ••••${lastCharacters(input.accountNumber, 4)} · routing ••••${lastCharacters(input.routingCode, 4)}`;
    case "UPI":
      return `UPI ${maskAddressLikeValue(input.upiId)}`;
    case "PAYPAL":
      return `PayPal ${maskAddressLikeValue(input.paypalEmail)}`;
  }
}

function lastCharacters(value: string, count: number): string {
  return value.slice(-count);
}

function maskAddressLikeValue(value: string): string {
  const separator = value.lastIndexOf("@");
  if (separator < 1) {
    return `••••${lastCharacters(value, 2)}`;
  }
  const local = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  const visibleLocal = local.slice(0, 1);
  const visibleDomain = domain.includes(".")
    ? domain.slice(domain.lastIndexOf("."))
    : "";
  return `${visibleLocal}•••@•••${visibleDomain}`;
}

function mapDestination(destination: CreatorPayoutDestinationRecord) {
  return {
    destination_id: destination.id,
    payee_type: destination.payeeType,
    beneficiary_name: destination.beneficiaryName,
    destination_type: destination.destinationType,
    country_code: destination.countryCode,
    currency_code: destination.currencyCode,
    masked_display: destination.maskedDisplay,
    is_primary: destination.isPrimary,
    state: destination.state,
    reason_code: destination.reasonCode,
    version: destination.version,
    encryption_key_version: destination.encryptionKeyVersion,
    disabled_at: destination.disabledAt?.toISOString() ?? null,
    updated_at: destination.updatedAt.toISOString(),
  };
}

function mapLegalProfile(profile: CreatorLegalProfileRecord) {
  return {
    legal_profile_id: profile.id,
    payee_type: profile.payeeType,
    legal_name: profile.legalName,
    country_code: profile.countryCode,
    address_line1: profile.addressLine1,
    address_line2: profile.addressLine2,
    city: profile.city,
    state_region: profile.stateRegion,
    postal_code: profile.postalCode,
    version: profile.version,
    updated_at: profile.updatedAt.toISOString(),
  };
}
