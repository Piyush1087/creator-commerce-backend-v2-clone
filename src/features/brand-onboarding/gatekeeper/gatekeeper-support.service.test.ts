import { ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import { GatekeeperSupportService } from "./gatekeeper-support.service";

describe("GatekeeperSupportService", () => {
  it("returns the configured canonical HTTPS destination", () => {
    const config = {
      get: vi.fn(() => "https://support.example.com/gatekeeper"),
    } as unknown as ConfigService;

    expect(new GatekeeperSupportService(config).destination()).toEqual({
      support: {
        type: "URL",
        href: "https://support.example.com/gatekeeper",
      },
    });
  });

  it.each([undefined, "", "mailto:support@example.com", "not-a-url"])(
    "fails closed for a missing or invalid destination: %s",
    (configured) => {
      const config = {
        get: vi.fn(() => configured),
      } as unknown as ConfigService;

      expect(() => new GatekeeperSupportService(config).destination()).toThrow(
        ServiceUnavailableException,
      );
    },
  );
});
