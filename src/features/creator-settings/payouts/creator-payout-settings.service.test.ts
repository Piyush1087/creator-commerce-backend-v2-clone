import {
  CreatorPayeeType,
  CreatorPayoutDestinationState,
  CreatorPayoutDestinationType,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { decryptField } from "../../../shared/crypto/field-encryption.util";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import {
  creatorLegalProfileSchema,
  creatorPayoutDestinationSchema,
  isSupportedCreatorPayoutRail,
} from "./creator-payout-settings.schema";
import { CreatorPayoutSettingsService } from "./creator-payout-settings.service";
import type {
  CreatorLegalProfileRecord,
  CreatorPayoutDestinationRecord,
  CreatorPayoutReadinessInvalidator,
  CreatorPayoutSettingsRepository,
  PersistCreatorLegalProfile,
  PersistCreatorPayoutDestination,
} from "./creator-payout-settings.types";
import { assessLegacyCreatorPayoutEvidence } from "./legacy-creator-payout.adapter";

process.env.SETTINGS_FIELD_ENCRYPTION_KEY =
  "c05-p1d-local-test-key-material-only";

const manageActions = [
  "PAYOUT_SETTINGS_READ",
  "PAYOUT_SETTINGS_MANAGE",
  "LEGAL_PROFILE_READ",
  "LEGAL_PROFILE_MANAGE",
] as const;

function actor(
  role: "OWNER" | "MANAGER" | "ASSISTANT",
  actions: CreatorWorkspaceActorContext["allowedActions"] = manageActions,
): CreatorWorkspaceActorContext {
  return {
    actorUserId: `actor-${role.toLowerCase()}`,
    actorMembershipId: `membership-${role.toLowerCase()}`,
    actorRole: role,
    workspaceId: "workspace-1",
    organizationId: "organization-1",
    subjectCreatorProfileId: "creator-profile-1",
    subjectOwnerUserId: "owner-user-1",
    allowedActions: actions,
  };
}

function legalInput(countryCode: "IN" | "US" = "IN") {
  return creatorLegalProfileSchema.parse({
    payeeType: "INDIVIDUAL",
    legalName: "Canonical Creator",
    countryCode,
    addressLine1: "101 Test Avenue",
    city: countryCode === "IN" ? "Mumbai" : "Austin",
    stateRegion: countryCode === "IN" ? "Maharashtra" : "Texas",
    postalCode: countryCode === "IN" ? "400001" : "78701",
  });
}

function indianBankInput() {
  return creatorPayoutDestinationSchema.parse({
    payeeType: "INDIVIDUAL",
    beneficiaryName: "Canonical Creator",
    destinationType: "BANK_ACCOUNT",
    countryCode: "IN",
    currencyCode: "INR",
    accountNumber: "123456789012",
    confirmAccountNumber: "123456789012",
    routingCode: "HDFC0001234",
  });
}

class InMemoryRepository implements CreatorPayoutSettingsRepository {
  destination: CreatorPayoutDestinationRecord | null = null;
  legalProfile: CreatorLegalProfileRecord | null = null;
  persistedDestinations: PersistCreatorPayoutDestination[] = [];
  private lastDestinationVersion = 0;
  private queue: Promise<void> = Promise.resolve();

  findPrimaryDestination(): Promise<CreatorPayoutDestinationRecord | null> {
    return Promise.resolve(this.destination);
  }

  replacePrimaryDestination(
    input: PersistCreatorPayoutDestination,
  ): Promise<CreatorPayoutDestinationRecord> {
    return this.exclusive(async () => {
      this.persistedDestinations.push(input);
      const now = new Date("2026-09-01T12:00:00.000Z");
      this.lastDestinationVersion += 1;
      this.destination = {
        ...input,
        id: `destination-${this.lastDestinationVersion}`,
        version: this.lastDestinationVersion,
        state: CreatorPayoutDestinationState.CONFIGURED_UNVERIFIED,
        reasonCode: null,
        disabledAt: null,
        createdAt: now,
        updatedAt: now,
      };
      return this.destination;
    });
  }

  disablePrimaryDestination(
    creatorProfileId: string,
    destinationId: string,
  ): Promise<CreatorPayoutDestinationRecord | null> {
    if (
      !this.destination ||
      this.destination.id !== destinationId ||
      this.destination.creatorProfileId !== creatorProfileId
    ) {
      return Promise.resolve(null);
    }
    this.destination = {
      ...this.destination,
      isPrimary: false,
      state: CreatorPayoutDestinationState.DISABLED,
      reasonCode: "USER_DISABLED",
      version: this.destination.version + 1,
      disabledAt: new Date("2026-09-01T13:00:00.000Z"),
      updatedAt: new Date("2026-09-01T13:00:00.000Z"),
    };
    return Promise.resolve(this.destination);
  }

  findLegalProfile(): Promise<CreatorLegalProfileRecord | null> {
    return Promise.resolve(this.legalProfile);
  }

  upsertLegalProfile(
    input: PersistCreatorLegalProfile,
  ): Promise<CreatorLegalProfileRecord> {
    const now = new Date("2026-09-01T11:00:00.000Z");
    this.legalProfile = {
      ...input,
      id: this.legalProfile?.id ?? "legal-profile-1",
      version: (this.legalProfile?.version ?? 0) + 1,
      createdAt: this.legalProfile?.createdAt ?? now,
      updatedAt: now,
    };
    return Promise.resolve(this.legalProfile);
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

class ReadinessSpy implements CreatorPayoutReadinessInvalidator {
  readonly calls: Array<{ creatorProfileId: string; reason: string }> = [];

  invalidateReadiness(
    creatorProfileId: string,
    reason: "IDENTITY_CHANGED" | "LINKED_ACCOUNT_REPLACED",
  ): Promise<void> {
    this.calls.push({ creatorProfileId, reason });
    return Promise.resolve();
  }
}

function setup() {
  const repository = new InMemoryRepository();
  const readiness = new ReadinessSpy();
  const service = new CreatorPayoutSettingsService(repository, readiness);
  return { repository, readiness, service };
}

describe("C-05 P1D supported payout contracts", () => {
  it.each([
    ["IN", "BANK_ACCOUNT", "INR"],
    ["IN", "UPI", "INR"],
    ["US", "BANK_ACCOUNT", "USD"],
    ["US", "PAYPAL", "USD"],
  ])("accepts the launch rail %s/%s/%s", (country, type, currency) => {
    expect(isSupportedCreatorPayoutRail(country, type, currency)).toBe(true);
  });

  it.each([
    ["IN", "PAYPAL", "INR"],
    ["IN", "BANK_ACCOUNT", "USD"],
    ["US", "UPI", "USD"],
    ["US", "BANK_ACCOUNT", "INR"],
    ["GB", "BANK_ACCOUNT", "GBP"],
  ])("rejects unsupported rail %s/%s/%s", (country, type, currency) => {
    expect(isSupportedCreatorPayoutRail(country, type, currency)).toBe(false);
  });

  it("rejects mismatched confirmation, invalid routing, and cross-country rails without echoing secrets", () => {
    const result = creatorPayoutDestinationSchema.safeParse({
      payeeType: "INDIVIDUAL",
      beneficiaryName: "Canonical Creator",
      destinationType: "BANK_ACCOUNT",
      countryCode: "IN",
      currencyCode: "USD",
      accountNumber: "123456789012",
      confirmAccountNumber: "999999999999",
      routingCode: "INVALID",
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("123456789012");
    expect(JSON.stringify(result)).not.toContain("999999999999");
  });

  it("keeps PAN, tax, KYC, and verification fields outside the strict legal profile contract", () => {
    const base = legalInput();
    for (const forbiddenField of [
      "panNumber",
      "taxIdentifier",
      "kycStatus",
      "isVerified",
    ]) {
      expect(
        creatorLegalProfileSchema.safeParse({
          ...base,
          [forbiddenField]: "not-accepted",
        }).success,
      ).toBe(false);
    }
  });
});

describe("C-05 P1D encryption, masking, and lifecycle", () => {
  it("stores only ciphertext with key version 1 and returns only masked values", async () => {
    const { repository, service } = setup();
    await service.upsertLegalProfile(actor("OWNER"), legalInput());
    const response = await service.replaceDestination(
      actor("OWNER"),
      indianBankInput(),
    );
    const persisted = repository.persistedDestinations[0];
    expect(persisted.encryptionKeyVersion).toBe(1);
    expect(persisted.secretPayloadEncrypted).not.toContain("123456789012");
    expect(persisted.secretPayloadEncrypted).not.toContain("HDFC0001234");
    expect(JSON.parse(decryptField(persisted.secretPayloadEncrypted))).toEqual({
      accountNumber: "123456789012",
      routingCode: "HDFC0001234",
    });
    expect(response.destination.state).toBe("CONFIGURED_UNVERIFIED");
    expect(response.destination.masked_display).toBe(
      "Bank account ••••9012 · routing ••••1234",
    );
    expect(JSON.stringify(response)).not.toContain("123456789012");
    expect(JSON.stringify(response)).not.toContain("HDFC0001234");
  });

  it.each([
    [
      {
        payeeType: "INDIVIDUAL",
        beneficiaryName: "Canonical Creator",
        destinationType: "UPI",
        countryCode: "IN",
        currencyCode: "INR",
        upiId: "creator@bank",
      },
      "UPI c•••@•••",
      "creator@bank",
    ],
    [
      {
        payeeType: "INDIVIDUAL",
        beneficiaryName: "Canonical Creator",
        destinationType: "PAYPAL",
        countryCode: "US",
        currencyCode: "USD",
        paypalEmail: "creator@example.test",
      },
      "PayPal c•••@•••.test",
      "creator@example.test",
    ],
  ] as const)(
    "masks address-like destination %s",
    async (rawInput, expectedMask, secret) => {
      const { repository, service } = setup();
      await service.upsertLegalProfile(
        actor("MANAGER"),
        legalInput(rawInput.countryCode),
      );
      const input = creatorPayoutDestinationSchema.parse(rawInput);
      const response = await service.replaceDestination(
        actor("MANAGER"),
        input,
      );
      expect(response.destination.masked_display).toBe(expectedMask);
      expect(JSON.stringify(response)).not.toContain(secret);
      expect(
        repository.persistedDestinations[0].secretPayloadEncrypted,
      ).not.toContain(secret);
    },
  );

  it("serializes concurrent replacements into increasing versions with one primary", async () => {
    const { repository, service } = setup();
    await service.upsertLegalProfile(actor("OWNER"), legalInput());
    const first = indianBankInput();
    const second = creatorPayoutDestinationSchema.parse({
      ...first,
      accountNumber: "555566667777",
      confirmAccountNumber: "555566667777",
    });
    const responses = await Promise.all([
      service.replaceDestination(actor("OWNER"), first),
      service.replaceDestination(actor("OWNER"), second),
    ]);
    expect(responses.map((row) => row.destination.version).sort()).toEqual([
      1, 2,
    ]);
    expect(repository.destination?.version).toBe(2);
    expect(repository.destination?.isPrimary).toBe(true);
    expect(repository.persistedDestinations).toHaveLength(2);
  });

  it("invalidates downstream readiness before persistence and never marks a destination verified", async () => {
    const events: string[] = [];
    const repository = new InMemoryRepository();
    await repository.upsertLegalProfile({
      creatorProfileId: "creator-profile-1",
      ...legalInput(),
    });
    const replace = repository.replacePrimaryDestination.bind(repository);
    repository.replacePrimaryDestination = async (input) => {
      events.push("persist");
      return replace(input);
    };
    const readiness: CreatorPayoutReadinessInvalidator = {
      async invalidateReadiness() {
        events.push("invalidate");
      },
    };
    const service = new CreatorPayoutSettingsService(repository, readiness);
    const response = await service.replaceDestination(
      actor("OWNER"),
      indianBankInput(),
    );
    expect(events).toEqual(["invalidate", "persist"]);
    expect(response.destination.state).toBe("CONFIGURED_UNVERIFIED");
    expect(response.destination.state).not.toBe("VERIFIED");
    expect(JSON.stringify(response)).not.toContain("verification_status");
  });

  it("increments legal profile and disable versions while failing closed", async () => {
    const { repository, readiness, service } = setup();
    const first = await service.upsertLegalProfile(
      actor("OWNER"),
      legalInput(),
    );
    const second = await service.upsertLegalProfile(actor("MANAGER"), {
      ...legalInput(),
      legalName: "Canonical Creator Updated",
    });
    expect(first.legal_profile.version).toBe(1);
    expect(second.legal_profile.version).toBe(2);
    const created = await service.replaceDestination(
      actor("OWNER"),
      indianBankInput(),
    );
    const disabled = await service.disableDestination(
      actor("MANAGER"),
      created.destination.destination_id,
    );
    expect(disabled.destination.state).toBe("DISABLED");
    expect(disabled.destination.version).toBe(2);
    expect(readiness.calls.map((call) => call.reason)).toEqual([
      "IDENTITY_CHANGED",
      "IDENTITY_CHANGED",
      "LINKED_ACCOUNT_REPLACED",
      "LINKED_ACCOUNT_REPLACED",
    ]);
  });
});

describe("C-05 P1D authority and compatibility boundaries", () => {
  it.each(["OWNER", "MANAGER"] as const)(
    "permits %s to manage canonical payout and legal settings",
    async (role) => {
      const { service } = setup();
      await expect(
        service.upsertLegalProfile(actor(role), legalInput()),
      ).resolves.toBeTruthy();
      await expect(
        service.replaceDestination(actor(role), indianBankInput()),
      ).resolves.toBeTruthy();
      await expect(service.getSettings(actor(role))).resolves.toBeTruthy();
    },
  );

  it("denies Assistant even if a malformed upstream context includes payout actions", async () => {
    const { service } = setup();
    await expect(service.getSettings(actor("ASSISTANT"))).rejects.toMatchObject(
      {
        status: 403,
      },
    );
    await expect(
      service.upsertLegalProfile(actor("ASSISTANT"), legalInput()),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.replaceDestination(actor("ASSISTANT"), indianBankInput()),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("denies an Owner or Manager whose capability projection omits the action", async () => {
    const { service } = setup();
    await expect(service.getSettings(actor("OWNER", []))).rejects.toMatchObject(
      {
        status: 403,
      },
    );
    await expect(
      service.upsertLegalProfile(
        actor("MANAGER", ["LEGAL_PROFILE_READ"]),
        legalInput(),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("requires legal identity to match destination payee type and country", async () => {
    const { service } = setup();
    await service.upsertLegalProfile(actor("OWNER"), legalInput("US"));
    await expect(
      service.replaceDestination(actor("OWNER"), indianBankInput()),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("never promotes or imports legacy plaintext, PAN, or VERIFIED state", () => {
    const assessment = assessLegacyCreatorPayoutEvidence({
      accountNumber: "legacy-account-value",
      routingOrIfsc: "legacy-routing-value",
      panNumber: "legacy-tax-value",
      verificationStatus: "VERIFIED",
      providerReference: "legacy-provider-reference",
    });
    expect(assessment).toEqual({
      disposition: "COMPATIBILITY_ONLY",
      reasonCode: "PLAINTEXT_SECRET_REQUIRES_SEPARATE_DATA_AUTHORITY",
      importsCanonicalDestination: false,
      importsPan: false,
      canonicalState: "CONFIGURED_UNVERIFIED",
    });
    expect(JSON.stringify(assessment)).not.toContain("legacy-account-value");
    expect(JSON.stringify(assessment)).not.toContain("legacy-tax-value");
  });

  it("uses only canonical P0 enums in persisted records", async () => {
    const { repository, service } = setup();
    await service.upsertLegalProfile(actor("OWNER"), legalInput());
    await service.replaceDestination(actor("OWNER"), indianBankInput());
    expect(repository.destination).toMatchObject({
      payeeType: CreatorPayeeType.INDIVIDUAL,
      destinationType: CreatorPayoutDestinationType.BANK_ACCOUNT,
      state: CreatorPayoutDestinationState.CONFIGURED_UNVERIFIED,
    });
  });
});
