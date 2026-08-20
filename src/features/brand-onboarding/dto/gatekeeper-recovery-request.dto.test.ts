import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import { GatekeeperRecoveryRequestDto } from "./gatekeeper-recovery-request.dto";

describe("GatekeeperRecoveryRequestDto", () => {
  it("normalizes a valid requester payload", async () => {
    const dto = plainToInstance(GatekeeperRecoveryRequestDto, {
      requesterEmail: "  Requester@Example.COM ",
      authorizedRepresentativeAttested: true,
      requesterName: "  Requester Name ",
      requesterNote: "  Please review this result. ",
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto).toEqual({
      requesterEmail: "requester@example.com",
      authorizedRepresentativeAttested: true,
      requesterName: "Requester Name",
      requesterNote: "Please review this result.",
    });
  });

  it("rejects invalid email and missing authorization attestation", async () => {
    const dto = plainToInstance(GatekeeperRecoveryRequestDto, {
      requesterEmail: "invalid",
      authorizedRepresentativeAttested: false,
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual(
      ["authorizedRepresentativeAttested", "requesterEmail"].sort(),
    );
  });
});
