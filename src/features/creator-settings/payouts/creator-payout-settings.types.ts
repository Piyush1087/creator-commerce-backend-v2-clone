import type {
  CreatorPayeeType,
  CreatorPayoutDestinationState,
  CreatorPayoutDestinationType,
} from "@prisma/client";

export const CREATOR_PAYOUT_ENCRYPTION_KEY_VERSION = 1;

export type CreatorPayoutDestinationRecord = {
  id: string;
  creatorProfileId: string;
  payeeType: CreatorPayeeType;
  beneficiaryName: string;
  destinationType: CreatorPayoutDestinationType;
  countryCode: string;
  currencyCode: string;
  secretPayloadEncrypted: string;
  encryptionKeyVersion: number;
  maskedDisplay: string;
  isPrimary: boolean;
  state: CreatorPayoutDestinationState;
  reasonCode: string | null;
  version: number;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatorLegalProfileRecord = {
  id: string;
  creatorProfileId: string;
  payeeType: CreatorPayeeType;
  legalName: string;
  countryCode: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateRegion: string | null;
  postalCode: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PersistCreatorPayoutDestination = Omit<
  CreatorPayoutDestinationRecord,
  | "id"
  | "version"
  | "state"
  | "reasonCode"
  | "disabledAt"
  | "createdAt"
  | "updatedAt"
>;

export type PersistCreatorLegalProfile = Omit<
  CreatorLegalProfileRecord,
  "id" | "version" | "createdAt" | "updatedAt"
>;

export interface CreatorPayoutSettingsRepository {
  findPrimaryDestination(
    creatorProfileId: string,
  ): Promise<CreatorPayoutDestinationRecord | null>;
  replacePrimaryDestination(
    input: PersistCreatorPayoutDestination,
  ): Promise<CreatorPayoutDestinationRecord>;
  disablePrimaryDestination(
    creatorProfileId: string,
    destinationId: string,
  ): Promise<CreatorPayoutDestinationRecord | null>;
  findLegalProfile(
    creatorProfileId: string,
  ): Promise<CreatorLegalProfileRecord | null>;
  upsertLegalProfile(
    input: PersistCreatorLegalProfile,
  ): Promise<CreatorLegalProfileRecord>;
}

export type CreatorPayoutReadinessInvalidationReason =
  | "IDENTITY_CHANGED"
  | "LINKED_ACCOUNT_REPLACED";

export interface CreatorPayoutReadinessInvalidator {
  invalidateReadiness(
    creatorProfileId: string,
    reason: CreatorPayoutReadinessInvalidationReason,
  ): Promise<void>;
}

export const CREATOR_PAYOUT_SETTINGS_REPOSITORY = Symbol(
  "CREATOR_PAYOUT_SETTINGS_REPOSITORY",
);

export const CREATOR_PAYOUT_READINESS_INVALIDATOR = Symbol(
  "CREATOR_PAYOUT_READINESS_INVALIDATOR",
);

export const CREATOR_WORKSPACE_ACTOR_RESOLVER = Symbol(
  "CREATOR_WORKSPACE_ACTOR_RESOLVER",
);
