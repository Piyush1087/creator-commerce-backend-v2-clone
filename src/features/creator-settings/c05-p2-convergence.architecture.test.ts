import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("C-05 P2 backend convergence architecture", () => {
  it("registers one canonical Creator Settings root and binds every actor port to P1B", () => {
    const module = source(
      "src/features/creator-settings/creator-settings.module.ts",
    );
    expect(module).toContain("CreatorTeamModule");
    expect(module).toContain("CreatorProfileContactController");
    expect(module).toContain("CreatorInstagramSettingsController");
    expect(module).toContain("CreatorPayoutSettingsController");
    expect(
      module.match(/useExisting: CreatorWorkspaceActorService/g),
    ).toHaveLength(2);
    expect(module).toContain("CREATOR_INSTAGRAM_SETTINGS_ACTOR_PORT");
    expect(module).toContain("CREATOR_WORKSPACE_ACTOR_RESOLVER");
    expect(module).not.toContain("CreatorSettingsService,");
  });

  it("owns profile/contact routes exactly once and delegates old shipping writes", () => {
    const canonical = source(
      "src/features/creator-settings/creator-profile-contact.controller.ts",
    );
    const compatibility = source(
      "src/features/creator-settings/creator-settings.controller.ts",
    );
    expect(canonical).toContain('@Get("profile")');
    expect(canonical).toContain('@Patch("profile")');
    expect(canonical).toContain('@Get("contact")');
    expect(canonical).toContain('@Put("contact")');
    expect(compatibility).not.toMatch(/@(Get|Patch)\("profile"\)/);
    expect(compatibility).toContain("profileContact.upsertDefaultContact");
    expect(compatibility).toContain(
      "CREATOR_CONTACT_PHONE_RECONCILIATION_REQUIRED",
    );
    expect(compatibility).not.toContain("PrismaService");
  });

  it("closes all legacy Team and plaintext payout route bypasses", () => {
    const compatibility = source(
      "src/features/creator-settings/creator-settings.controller.ts",
    );
    for (const delegate of [
      "invitations.create",
      "team.updateRole",
      "team.remove",
    ]) {
      expect(compatibility).toContain(delegate);
    }
    expect(compatibility).not.toContain(
      '@Delete("team/invitations/:invitationId")',
    );
    expect(
      source("src/features/creator-settings/team/creator-team.controller.ts"),
    ).toContain('@Delete("invitations/:invitationId")');
    expect(compatibility).toContain(
      "CREATOR_LEGACY_PLAINTEXT_PAYOUT_WRITER_RETIRED",
    );
    const retiredService = source(
      "src/features/creator-settings/services/creator-settings.service.ts",
    );
    expect(retiredService).not.toMatch(
      /creatorBankDetails|creatorSettlementProfile|accountNumber|ifscOrRouting/,
    );
  });

  it("wires encrypted payout authority and only a fail-closed readiness adapter", () => {
    const module = source(
      "src/features/creator-settings/creator-settings.module.ts",
    );
    expect(module).toContain("PrismaCreatorPayoutSettingsRepository");
    expect(module).toContain("CreatorPayoutReadinessCompatibilityAdapter");
    expect(module).toContain("CREATOR_PAYOUT_SETTINGS_REPOSITORY");
    expect(module).toContain("CREATOR_PAYOUT_READINESS_INVALIDATOR");
    const adapter = source(
      "src/features/creator-settings/payouts/creator-payout-readiness.compatibility-adapter.ts",
    );
    expect(adapter).toContain("COMPATIBILITY_RECONCILIATION_ONLY");
    expect(adapter).toContain("payoutProfiles.invalidateReadiness");
    expect(adapter).not.toMatch(
      /\.(?:provisionBeneficiary|executeTransfer|settle|reconcile)\(/,
    );
  });

  it("adapts C-01 initial connect to actor/subject identity without adding provider behavior", () => {
    const connection = source(
      "src/features/creator-entry/creator-instagram-connection.service.ts",
    );
    expect(connection).toContain("resolveInitialConnectContext");
    expect(connection).toContain("actorUserId");
    expect(connection).toContain("subjectCreatorProfileId");
    expect(connection).toContain("subjectOwnerUserId");
    expect(connection).toContain("expectedGeneration: 0");
    expect(connection).toContain("expectedProviderAccountId: null");
    expect(connection).toContain("resolveInTransaction");
    expect(connection).toContain("INSTAGRAM_SETTINGS_MANAGE");
  });

  it("does not introduce downstream C-03, C-04, or C-06 business dependencies", () => {
    const convergence = [
      source("src/features/creator-settings/creator-settings.module.ts"),
      source("src/features/creator-settings/creator-settings.controller.ts"),
      source(
        "src/features/creator-settings/creator-profile-contact.controller.ts",
      ),
      source(
        "src/features/creator-entry/creator-instagram-connection.service.ts",
      ),
    ].join("\n");
    expect(convergence).not.toMatch(
      /CampaignApplication|CollaborationState|executeTransfer|Kyc|Settlement|Ledger/,
    );
  });
});
