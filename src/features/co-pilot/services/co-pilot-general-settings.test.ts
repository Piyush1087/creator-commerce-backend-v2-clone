import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../auth/types/auth-user";
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
  it("allows personal and legal-name edits without injecting absent legacy fields", async () => {
    const { run, updateGeneral } = setup();
    const input = {
      firstName: "Grace",
      lastName: "Hopper",
      organizationLegalName: "Legal Ltd",
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
});
