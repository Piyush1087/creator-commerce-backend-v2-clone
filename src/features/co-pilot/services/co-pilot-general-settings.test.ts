import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../auth/types/auth-user";
import type { BrandSettingsService } from "../../brand-settings/services/brand-settings.service";
import { detectBrandSettingsWrite } from "../modules/brand-settings/brand-settings.intents";
import { BrandSettingsCoPilotToolsService } from "../modules/brand-settings/brand-settings.tools";
import { CoPilotHitlService } from "./co-pilot-hitl.service";

// Exercise the General adapter without bootstrapping unrelated Co-pilot domains.
// The callback below substitutes only the confirmation envelope, not validation.
const confirm = Reflect.get(
  CoPilotHitlService.prototype,
  "confirmSettingsUpdateGeneral",
) as (
  this: unknown,
  args: { userId: string; threadId: string },
  staged: Record<string, unknown>,
) => Promise<unknown>;
const actor: AuthUser = {
  id: "actor",
  email: "actor@example.test",
  name: "Ada Lovelace",
  role: "BRAND",
  organizationId: "organization",
};
function setup() {
  const updateGeneral = vi.fn().mockResolvedValue({});
  const context = {
    brandSettings: { updateGeneral },
    optionalString: (value: unknown) =>
      typeof value === "string" && value.trim() ? value.trim() : undefined,
    confirmSettingsAction: ({
      run,
    }: {
      run: (user: AuthUser) => Promise<unknown>;
    }) => run(actor),
  };
  return {
    updateGeneral,
    run: (staged: Record<string, unknown>) =>
      confirm.call(context, { userId: actor.id, threadId: "thread" }, staged),
  };
}
describe("BS-01 Co-pilot General compatibility", () => {
  it("allows personal and operational Organization-name edits without injecting absent legacy fields", async () => {
    const { run, updateGeneral } = setup();
    const input = {
      firstName: "Grace",
      lastName: "Hopper",
      organizationLegalName: "Workspace Name",
    };
    await expect(run(input)).resolves.toBe("General settings updated.");
    expect(updateGeneral).toHaveBeenCalledWith(actor, input);
  });
  it.each([
    { countryCode: "US" },
    { currencyCode: "USD" },
    { organizationAddress: "Billing address" },
    { taxId: "tax" },
    { taxId: null },
  ])("fails explicitly for legacy General mutation %j", async (input) => {
    const { run, updateGeneral } = setup();
    await expect(run({ firstName: "Grace", ...input })).rejects.toThrow();
    expect(updateGeneral).not.toHaveBeenCalled();
  });
  it("presents Organization.name as operational Organization identity", () => {
    const tools = new BrandSettingsCoPilotToolsService(
      {} as BrandSettingsService,
    );
    const general = {
      current_user_role: "BRAND_OWNER" as const,
      personal_profile: {
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.test",
        avatar_url: null,
      },
      organization: {
        company_legal_name: "Workspace Name",
        corporate_address: null,
        country_code: "IN",
        currency_code: "INR",
        tax_id: null,
      },
      brand_identity: {
        display_name: "Protected Brand",
        website_url: "brand.example.test",
        logo_url: null,
        is_locked: true,
      },
      team: {
        members: [],
        pending_invitations: [],
        seat_usage: {
          active_members: 0,
          pending_invitations: 0,
          max_seats: 5,
        },
      },
    } satisfies Awaited<ReturnType<BrandSettingsService["getGeneral"]>>;

    expect(tools.generalNarrative(general)).toContain(
      "Organization “Workspace Name”",
    );
    expect(tools.generalMetrics(general)).toContainEqual(
      expect.objectContaining({
        label: "Organization",
        value: "Workspace Name",
      }),
    );
    const intent = detectBrandSettingsWrite("change organization name");
    expect(intent?.kind).toBe("SETTINGS_UPDATE_GENERAL");
    if (!intent || intent.kind !== "SETTINGS_UPDATE_GENERAL") {
      throw new Error("Expected a General write intent");
    }
    expect(intent.missingSlots).toContainEqual(
      expect.objectContaining({
        fieldName: "organizationLegalName",
        uiLabel: "Organization name",
        placeholderText: "Workspace or organization name",
      }),
    );
  });
});
